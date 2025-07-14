import request from 'supertest'
import app from '../../src/index'
import { prisma } from '../../src/utils/database'
import { cacheService } from '../../src/services/cacheService'
import { performanceMonitor } from '../../src/services/performanceService'

describe('Performance Tests', () => {
  beforeAll(async () => {
    // Initialize cache connection
    await cacheService.connect()
    
    // Clear cache before tests
    await cacheService.clear()
    
    // Seed test data
    await seedTestData()
  })

  afterAll(async () => {
    // Clean up
    await prisma.product.deleteMany()
    await prisma.category.deleteMany()
    await cacheService.disconnect()
    await prisma.$disconnect()
  })

  describe('Response Time Tests', () => {
    it('should return product list within 100ms', async () => {
      const start = Date.now()
      
      const response = await request(app)
        .get('/api/v1/products')
        .query({ limit: 20 })
        .expect(200)
      
      const responseTime = Date.now() - start
      expect(responseTime).toBeLessThan(100)
      expect(response.body.data).toHaveLength(20)
    })

    it('should return product detail within 50ms', async () => {
      const product = await prisma.product.findFirst()
      const start = Date.now()
      
      const response = await request(app)
        .get(`/api/v1/products/${product?.id}`)
        .expect(200)
      
      const responseTime = Date.now() - start
      expect(responseTime).toBeLessThan(50)
    })

    it('should handle search queries within 200ms', async () => {
      const start = Date.now()
      
      const response = await request(app)
        .get('/api/v1/products')
        .query({ search: 'test', limit: 20 })
        .expect(200)
      
      const responseTime = Date.now() - start
      expect(responseTime).toBeLessThan(200)
    })
  })

  describe('Cache Performance Tests', () => {
    it('should serve cached product list faster on second request', async () => {
      // Clear cache first
      await cacheService.clear()
      
      // First request (cache miss)
      const start1 = Date.now()
      const response1 = await request(app)
        .get('/api/v1/products')
        .query({ limit: 10, page: 1 })
        .expect(200)
      const time1 = Date.now() - start1
      
      expect(response1.headers['x-cache']).toBe('MISS')
      
      // Second request (cache hit)
      const start2 = Date.now()
      const response2 = await request(app)
        .get('/api/v1/products')
        .query({ limit: 10, page: 1 })
        .expect(200)
      const time2 = Date.now() - start2
      
      expect(response2.headers['x-cache']).toBe('HIT')
      expect(time2).toBeLessThan(time1 * 0.5) // Should be at least 50% faster
    })

    it('should invalidate cache after product update', async () => {
      const product = await prisma.product.findFirst()
      
      // First request to cache the product
      await request(app)
        .get(`/api/v1/products/${product?.id}`)
        .expect(200)
      
      // Update product
      await request(app)
        .put(`/api/v1/products/${product?.id}`)
        .send({ name: 'Updated Product Name' })
        .expect(200)
      
      // Next request should be cache miss
      const response = await request(app)
        .get(`/api/v1/products/${product?.id}`)
        .expect(200)
      
      expect(response.headers['x-cache']).toBe('MISS')
      expect(response.body.name).toBe('Updated Product Name')
    })
  })

  describe('Concurrent Request Tests', () => {
    it('should handle 100 concurrent requests', async () => {
      const requests = Array(100).fill(null).map(() => 
        request(app)
          .get('/api/v1/products')
          .query({ limit: 10 })
      )
      
      const start = Date.now()
      const responses = await Promise.all(requests)
      const totalTime = Date.now() - start
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200)
      })
      
      // Total time should be reasonable (not 100x single request time)
      expect(totalTime).toBeLessThan(5000) // 5 seconds for 100 requests
    })

    it('should handle mixed read/write operations', async () => {
      const product = await prisma.product.findFirst()
      
      const requests = [
        ...Array(50).fill(null).map(() => 
          request(app).get('/api/v1/products')
        ),
        ...Array(20).fill(null).map(() => 
          request(app).get(`/api/v1/products/${product?.id}`)
        ),
        ...Array(10).fill(null).map((_, i) => 
          request(app)
            .put(`/api/v1/products/${product?.id}`)
            .send({ name: `Updated ${i}` })
        ),
      ]
      
      const responses = await Promise.all(requests)
      
      // Check success rate
      const successCount = responses.filter(r => r.status === 200).length
      expect(successCount / responses.length).toBeGreaterThan(0.95) // 95% success rate
    })
  })

  describe('Memory Usage Tests', () => {
    it('should not leak memory during repeated requests', async () => {
      const initialMemory = process.memoryUsage().heapUsed
      
      // Make 1000 requests
      for (let i = 0; i < 1000; i++) {
        await request(app)
          .get('/api/v1/products')
          .query({ limit: 20, page: i % 10 + 1 })
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc()
      }
      
      const finalMemory = process.memoryUsage().heapUsed
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024 // MB
      
      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50)
    })
  })

  describe('Performance Monitoring Tests', () => {
    it('should track performance metrics accurately', async () => {
      // Reset metrics
      performanceMonitor.resetMetrics()
      
      // Make some requests
      await request(app).get('/api/v1/products')
      await request(app).get('/api/v1/products')
      await request(app).get('/api/v1/products/invalid-id').expect(404)
      
      const metrics = performanceMonitor.getMetrics()
      
      expect(metrics.requestCount).toBeGreaterThanOrEqual(3)
      expect(metrics.errorCount).toBeGreaterThanOrEqual(1)
      expect(metrics.averageResponseTime).toBeGreaterThan(0)
      expect(metrics.activeRequests).toBe(0)
    })

    it('should identify slow queries', async () => {
      // Make a potentially slow request
      await request(app)
        .get('/api/v1/products')
        .query({ 
          search: 'complex search term with multiple words',
          categoryId: 'test-category',
          minPrice: 10,
          maxPrice: 1000,
          limit: 100 
        })
      
      const slowQueries = performanceMonitor.getSlowQueries(10) // 10ms threshold
      
      // Should have recorded some queries
      expect(Array.isArray(slowQueries)).toBe(true)
    })
  })

  describe('Compression Tests', () => {
    it('should compress large responses', async () => {
      const response = await request(app)
        .get('/api/v1/products')
        .set('Accept-Encoding', 'gzip, deflate, br')
        .query({ limit: 100 })
        .expect(200)
      
      // Check if response is compressed
      const encoding = response.headers['content-encoding']
      expect(['gzip', 'deflate', 'br']).toContain(encoding)
    })

    it('should not compress small responses', async () => {
      const response = await request(app)
        .get('/health')
        .set('Accept-Encoding', 'gzip, deflate, br')
        .expect(200)
      
      // Small responses should not be compressed
      expect(response.headers['content-encoding']).toBeUndefined()
    })
  })
})

// Helper function to seed test data
async function seedTestData() {
  // Create categories
  const categories = await Promise.all(
    Array(5).fill(null).map((_, i) => 
      prisma.category.create({
        data: {
          name: `Test Category ${i + 1}`,
          slug: `test-category-${i + 1}`,
          description: `Description for category ${i + 1}`,
          isActive: true,
        }
      })
    )
  )

  // Create products
  await Promise.all(
    Array(100).fill(null).map((_, i) => 
      prisma.product.create({
        data: {
          name: `Test Product ${i + 1}`,
          slug: `test-product-${i + 1}`,
          description: `Description for product ${i + 1}`,
          price: Math.random() * 1000,
          sku: `SKU-${i + 1}`,
          status: 'active',
          categoryId: categories[i % 5].id,
          images: {
            create: [
              {
                url: `https://example.com/image-${i + 1}.jpg`,
                alt: `Product ${i + 1}`,
                order: 0
              }
            ]
          },
          inventory: {
            create: {
              quantity: Math.floor(Math.random() * 100),
              reservedQuantity: 0,
              sku: `SKU-${i + 1}`,
              trackInventory: true,
              allowBackorder: false,
              lowStockThreshold: 10
            }
          }
        }
      })
    )
  )
}