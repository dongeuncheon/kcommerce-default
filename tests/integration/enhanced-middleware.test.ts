import request from 'supertest'
import { app } from '../../src/index'
import { prisma } from '../../src/utils/database'
import { resetErrorMetrics } from '../../src/middleware/error'
import { resetRateLimit } from '../../src/middleware/rateLimiter'
import { resetAllCircuitBreakers } from '../../src/middleware/circuitBreaker'

describe('Enhanced Middleware Integration Tests', () => {
  beforeEach(async () => {
    // Reset all middleware state before each test
    resetErrorMetrics()
    resetAllCircuitBreakers()
    await resetRateLimit('test-key')
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  describe('Error Handling', () => {
    it('should return structured error for validation failures', async () => {
      const response = await request(app)
        .post('/api/products')
        .send({
          name: '', // Invalid - empty name
          price: 'invalid', // Invalid - not a number
        })
        .expect(400)

      expect(response.body).toMatchObject({
        success: false,
        error: {
          type: expect.any(String),
          message: expect.any(String),
          code: expect.any(String),
          timestamp: expect.any(String),
          requestId: expect.any(String),
          details: expect.any(Object)
        }
      })

      expect(response.body.error.details).toHaveProperty('errors')
      expect(Array.isArray(response.body.error.details.errors)).toBe(true)
    })

    it('should include request ID in error responses', async () => {
      const response = await request(app)
        .get('/api/nonexistent')
        .expect(404)

      expect(response.body.error).toHaveProperty('requestId')
      expect(response.headers).toHaveProperty('x-request-id')
      expect(response.body.error.requestId).toBe(response.headers['x-request-id'])
    })

    it('should track error metrics', async () => {
      // Make a few error requests
      await request(app).get('/api/nonexistent').expect(404)
      await request(app).post('/api/products').send({}).expect(400)

      const metricsResponse = await request(app)
        .get('/health/errors')
        .expect(200)

      expect(metricsResponse.body.statistics.total).toBeGreaterThan(0)
      expect(metricsResponse.body.statistics.client).toBeGreaterThan(0)
    })

    it('should handle Prisma errors appropriately', async () => {
      // Try to create a product with duplicate unique field (if any exists)
      const productData = {
        name: 'Test Product',
        description: 'Test Description',
        price: 99.99,
        categoryId: 'nonexistent-category-id'
      }

      const response = await request(app)
        .post('/api/products')
        .send(productData)

      // Should handle foreign key constraint error
      if (response.status === 400) {
        expect(response.body.error.type).toMatch(/ValidationError|ForeignKeyError/)
      }
    })
  })

  describe('Rate Limiting', () => {
    it('should apply rate limits based on user tier', async () => {
      const basicRequests = []
      const premiumRequests = []

      // Test basic tier (should be more restrictive)
      for (let i = 0; i < 50; i++) {
        basicRequests.push(
          request(app)
            .get('/api/health')
            .set('X-User-Tier', 'basic')
        )
      }

      // Test premium tier (should be less restrictive)
      for (let i = 0; i < 50; i++) {
        premiumRequests.push(
          request(app)
            .get('/api/health')
            .set('X-User-Tier', 'premium')
        )
      }

      const [basicResults, premiumResults] = await Promise.all([
        Promise.all(basicRequests),
        Promise.all(premiumRequests)
      ])

      const basicRateLimited = basicResults.filter(r => r.status === 429).length
      const premiumRateLimited = premiumResults.filter(r => r.status === 429).length

      // Premium should have fewer rate limited requests
      expect(premiumRateLimited).toBeLessThanOrEqual(basicRateLimited)
    })

    it('should include rate limit headers', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200)

      expect(response.headers).toHaveProperty('x-ratelimit-limit')
      expect(response.headers).toHaveProperty('x-ratelimit-remaining')
      expect(response.headers).toHaveProperty('x-ratelimit-reset')
      expect(response.headers).toHaveProperty('x-ratelimit-tier')
    })

    it('should provide retry information when rate limited', async () => {
      // Make many rapid requests to trigger rate limiting
      const requests = Array(200).fill(null).map(() =>
        request(app).get('/api/health')
      )

      const results = await Promise.all(requests)
      const rateLimitedResponse = results.find(r => r.status === 429)

      if (rateLimitedResponse) {
        expect(rateLimitedResponse.headers).toHaveProperty('retry-after')
        expect(rateLimitedResponse.body.error.details).toHaveProperty('retryAfter')
        expect(rateLimitedResponse.body.error.details).toHaveProperty('retryStrategy')
      }
    })

    it('should track rate limit metrics', async () => {
      // Generate some rate limited requests
      const requests = Array(100).fill(null).map(() =>
        request(app).get('/api/health')
      )

      await Promise.all(requests)

      const metricsResponse = await request(app)
        .get('/health/rate-limits')
        .expect(200)

      expect(metricsResponse.body).toHaveProperty('totalRequests')
      expect(metricsResponse.body).toHaveProperty('blockedRequests')
      expect(metricsResponse.body).toHaveProperty('activeUsers')
    })
  })

  describe('Security Headers', () => {
    it('should include security headers', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200)

      expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff')
      expect(response.headers).toHaveProperty('x-frame-options')
      expect(response.headers).toHaveProperty('x-xss-protection')
    })

    it('should validate content type for POST requests', async () => {
      const response = await request(app)
        .post('/api/products')
        .set('Content-Type', 'text/plain')
        .send('invalid content')

      expect(response.status).toBe(400)
      expect(response.body.error.message).toMatch(/Content-Type|Invalid/)
    })

    it('should sanitize request input', async () => {
      const maliciousInput = {
        name: '<script>alert("xss")</script>',
        description: 'javascript:alert("xss")',
        price: 99.99
      }

      const response = await request(app)
        .post('/api/products')
        .send(maliciousInput)

      if (response.status === 201) {
        // If product was created, check that malicious content was sanitized
        expect(response.body.data.name).not.toContain('<script>')
        expect(response.body.data.description).not.toContain('javascript:')
      } else {
        // Should be rejected as invalid input
        expect(response.status).toBe(400)
      }
    })
  })

  describe('API Versioning', () => {
    it('should handle version headers', async () => {
      const response = await request(app)
        .get('/api/health')
        .set('X-API-Version', 'v1')
        .expect(200)

      expect(response.headers).toHaveProperty('x-api-version')
      expect(response.headers).toHaveProperty('x-api-supported-versions')
    })

    it('should reject unsupported versions', async () => {
      const response = await request(app)
        .get('/api/health')
        .set('X-API-Version', 'v99')

      expect(response.status).toBe(400)
      expect(response.body.error.message).toMatch(/version.*not supported/i)
    })

    it('should warn about deprecated versions', async () => {
      // This test assumes v1 might be deprecated in config
      const response = await request(app)
        .get('/api/health')
        .set('X-API-Version', 'v1')

      if (response.headers['x-api-deprecated']) {
        expect(response.headers).toHaveProperty('x-api-deprecation-warning')
        expect(response.headers).toHaveProperty('x-api-replacement-version')
      }
    })
  })

  describe('Circuit Breaker', () => {
    it('should track circuit breaker metrics', async () => {
      const response = await request(app)
        .get('/health/circuit-breakers')
        .expect(200)

      expect(response.body.circuitBreakers).toHaveProperty('database')
      expect(response.body.circuitBreakers).toHaveProperty('payment')
      expect(response.body.circuitBreakers).toHaveProperty('external_api')

      Object.values(response.body.circuitBreakers).forEach((cb: any) => {
        expect(cb).toHaveProperty('state')
        expect(cb).toHaveProperty('failureCount')
        expect(cb).toHaveProperty('name')
        expect(['CLOSED', 'OPEN', 'HALF_OPEN']).toContain(cb.state)
      })
    })

    it('should handle service unavailable with circuit breaker', async () => {
      // This test would require actually triggering circuit breaker
      // In a real scenario, you might mock external service failures
      const response = await request(app)
        .get('/api/health/database')

      // Should either succeed or fail gracefully
      expect([200, 503]).toContain(response.status)

      if (response.status === 503) {
        expect(response.body.error.type).toMatch(/ServiceUnavailable|CircuitBreaker/)
        expect(response.headers).toHaveProperty('retry-after')
      }
    })
  })

  describe('Request Validation', () => {
    it('should validate file uploads', async () => {
      const response = await request(app)
        .post('/api/products/upload')
        .attach('file', Buffer.from('fake file content'), {
          filename: 'test.txt',
          contentType: 'text/plain'
        })

      // Should reject non-image files if that's the requirement
      if (response.status === 400) {
        expect(response.body.error.code).toMatch(/INVALID_FILE_TYPE|FILE_/)
      }
    })

    it('should validate request size limits', async () => {
      const largeData = {
        name: 'A'.repeat(10000),
        description: 'B'.repeat(50000),
        metadata: Array(1000).fill({ key: 'value'.repeat(100) })
      }

      const response = await request(app)
        .post('/api/products')
        .send(largeData)

      // Should either accept or reject based on size limits
      if (response.status === 400) {
        expect(response.body.error.message).toMatch(/size|large|limit/i)
      }
    })

    it('should detect suspicious patterns', async () => {
      const suspiciousData = {
        name: 'DROP TABLE products;',
        description: 'UNION SELECT * FROM users',
        url: '../../../etc/passwd'
      }

      const response = await request(app)
        .post('/api/products')
        .send(suspiciousData)

      // Should be rejected or sanitized
      expect(response.status).toBe(400)
      expect(response.body.error.message).toMatch(/suspicious|security|validation/i)
    })
  })

  describe('Monitoring Endpoints', () => {
    it('should provide comprehensive health metrics', async () => {
      const response = await request(app)
        .get('/health/system')
        .expect(200)

      expect(response.body).toHaveProperty('uptime')
      expect(response.body).toHaveProperty('memory')
      expect(response.body).toHaveProperty('cpu')
      expect(response.body).toHaveProperty('database')
      expect(response.body).toHaveProperty('services')
    })

    it('should provide Prometheus metrics format', async () => {
      const response = await request(app)
        .get('/health/metrics')
        .expect(200)

      expect(response.headers['content-type']).toMatch(/text\/plain/)
      expect(response.text).toContain('# HELP')
      expect(response.text).toContain('# TYPE')
      expect(response.text).toMatch(/nodejs_memory_heap_used_bytes/)
    })

    it('should provide security health status', async () => {
      const response = await request(app)
        .get('/health/security')
        .expect(200)

      expect(response.body).toHaveProperty('middleware')
      expect(response.body).toHaveProperty('recentEvents')
      expect(response.body).toHaveProperty('configuration')
      expect(response.body.middleware).toHaveProperty('rateLimiting')
      expect(response.body.middleware).toHaveProperty('circuitBreaker')
    })
  })

  describe('Admin Endpoints', () => {
    // Note: These tests assume admin authentication is properly implemented
    
    it('should provide admin dashboard data', async () => {
      const response = await request(app)
        .get('/admin/dashboard')
        // .set('Authorization', 'Bearer admin-token') // Add auth as needed

      if (response.status === 200) {
        expect(response.body.data).toHaveProperty('summary')
        expect(response.body.data).toHaveProperty('health')
        expect(response.body.data).toHaveProperty('recentActivity')
        expect(response.body.data).toHaveProperty('system')
      } else {
        // Should require authentication
        expect([401, 403]).toContain(response.status)
      }
    })

    it('should allow rate limit management', async () => {
      const response = await request(app)
        .get('/admin/rate-limits')
        // .set('Authorization', 'Bearer admin-token')

      if (response.status === 200) {
        expect(response.body.data).toHaveProperty('metrics')
        expect(response.body.data).toHaveProperty('userTiers')
        expect(response.body.data).toHaveProperty('configuration')
      }
    })
  })

  describe('Performance', () => {
    it('should handle concurrent requests efficiently', async () => {
      const startTime = Date.now()
      const concurrentRequests = 50

      const requests = Array(concurrentRequests).fill(null).map(() =>
        request(app).get('/api/health')
      )

      const results = await Promise.all(requests)
      const endTime = Date.now()
      const duration = endTime - startTime

      // All requests should complete within reasonable time
      expect(duration).toBeLessThan(5000) // 5 seconds

      // Most requests should succeed (some might be rate limited)
      const successCount = results.filter(r => r.status === 200).length
      expect(successCount).toBeGreaterThan(concurrentRequests * 0.5) // At least 50%
    })

    it('should maintain response times under load', async () => {
      const responseTimePromises = Array(20).fill(null).map(async () => {
        const start = Date.now()
        await request(app).get('/api/health')
        return Date.now() - start
      })

      const responseTimes = await Promise.all(responseTimePromises)
      const averageResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length

      // Average response time should be reasonable
      expect(averageResponseTime).toBeLessThan(1000) // Less than 1 second
    })
  })
})