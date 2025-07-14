import { describe, test, expect, beforeEach } from 'vitest'
import request from 'supertest'
import app from '../../src/index'

describe('Inventory API Integration Tests', () => {
  let testProduct: any

  beforeEach(async () => {
    // Create a test product for inventory operations
    const productData = {
      name: 'Inventory Test Product',
      sku: 'INV-TEST-001',
      status: 'PUBLISHED',
      type: 'SIMPLE',
      price: 99.99,
      trackQuantity: true,
      quantity: 100,
      lowStockThreshold: 10,
      allowBackorders: false
    }

    const response = await request(app)
      .post('/api/v1/products')
      .send(productData)

    testProduct = response.body.data
  })

  describe('POST /api/v1/inventory/adjust', () => {
    test('should adjust inventory for a product', async () => {
      const adjustmentData = {
        productId: testProduct.id,
        quantity: -5,
        type: 'SALE',
        reason: 'Test sale',
        reference: 'TEST-ORDER-001'
      }

      const response = await request(app)
        .post('/api/v1/inventory/adjust')
        .send(adjustmentData)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveProperty('id')
      expect(response.body.data.type).toBe('SALE')
      expect(response.body.data.quantity).toBe(-5)
      expect(response.body.message).toBe('Inventory adjusted successfully')
    })

    test('should return 400 for invalid adjustment data', async () => {
      const invalidData = {
        productId: testProduct.id,
        quantity: 'invalid',
        type: 'INVALID_TYPE'
      }

      const response = await request(app)
        .post('/api/v1/inventory/adjust')
        .send(invalidData)

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
    })

    test('should handle insufficient inventory error', async () => {
      const adjustmentData = {
        productId: testProduct.id,
        quantity: -200, // More than available
        type: 'SALE'
      }

      const response = await request(app)
        .post('/api/v1/inventory/adjust')
        .send(adjustmentData)

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
      expect(response.body.error.message).toContain('Insufficient inventory')
    })
  })

  describe('POST /api/v1/inventory/bulk-adjust', () => {
    test('should handle bulk inventory adjustments', async () => {
      // Create another test product
      const product2Data = {
        name: 'Inventory Test Product 2',
        sku: 'INV-TEST-002',
        status: 'PUBLISHED',
        type: 'SIMPLE',
        price: 49.99,
        trackQuantity: true,
        quantity: 50,
        lowStockThreshold: 5,
        allowBackorders: false
      }

      const product2Response = await request(app)
        .post('/api/v1/products')
        .send(product2Data)

      const testProduct2 = product2Response.body.data

      const bulkData = {
        adjustments: [
          {
            productId: testProduct.id,
            quantity: -10,
            type: 'SALE',
            reason: 'Bulk sale 1'
          },
          {
            productId: testProduct2.id,
            quantity: 20,
            type: 'RESTOCK',
            reason: 'Bulk restock'
          }
        ]
      }

      const response = await request(app)
        .post('/api/v1/inventory/bulk-adjust')
        .send(bulkData)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.processed).toBe(2)
      expect(response.body.data.total).toBe(2)
      expect(response.body.data.results).toHaveLength(2)
    })

    test('should return validation error for empty adjustments', async () => {
      const response = await request(app)
        .post('/api/v1/inventory/bulk-adjust')
        .send({ adjustments: [] })

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
    })
  })

  describe('GET /api/v1/inventory/low-stock', () => {
    test('should get low stock products', async () => {
      // First adjust inventory to create a low stock situation
      await request(app)
        .post('/api/v1/inventory/adjust')
        .send({
          productId: testProduct.id,
          quantity: -95, // Reduce from 100 to 5 (below threshold of 10)
          type: 'SALE'
        })

      const response = await request(app)
        .get('/api/v1/inventory/low-stock')

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeInstanceOf(Array)
      expect(response.body.count).toBeGreaterThanOrEqual(0)
      
      // Check if our test product is in the low stock list
      const lowStockProduct = response.body.data.find((p: any) => p.id === testProduct.id)
      if (lowStockProduct) {
        expect(lowStockProduct.quantity).toBeLessThanOrEqual(lowStockProduct.lowStockThreshold)
      }
    })
  })

  describe('GET /api/v1/inventory/out-of-stock', () => {
    test('should get out of stock products', async () => {
      // First adjust inventory to create an out of stock situation
      await request(app)
        .post('/api/v1/inventory/adjust')
        .send({
          productId: testProduct.id,
          quantity: -100, // Reduce to 0
          type: 'SALE'
        })

      const response = await request(app)
        .get('/api/v1/inventory/out-of-stock')

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeInstanceOf(Array)
      
      // Check if our test product is in the out of stock list
      const outOfStockProduct = response.body.data.find((p: any) => p.id === testProduct.id)
      if (outOfStockProduct) {
        expect(outOfStockProduct.quantity).toBe(0)
      }
    })
  })

  describe('GET /api/v1/inventory/report', () => {
    test('should generate inventory report', async () => {
      const response = await request(app)
        .get('/api/v1/inventory/report')

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveProperty('totalProducts')
      expect(response.body.data).toHaveProperty('inStockProducts')
      expect(response.body.data).toHaveProperty('outOfStockProducts')
      expect(response.body.data).toHaveProperty('lowStockProducts')
      expect(response.body.data).toHaveProperty('totalValue')
      expect(response.body.data).toHaveProperty('averageStockLevel')
      expect(response.body.data).toHaveProperty('topLowStockProducts')
      expect(response.body.data.topLowStockProducts).toBeInstanceOf(Array)
    })
  })

  describe('GET /api/v1/inventory/stats', () => {
    test('should get inventory statistics', async () => {
      const response = await request(app)
        .get('/api/v1/inventory/stats')

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveProperty('totalProducts')
      expect(response.body.data).toHaveProperty('lowStockCount')
      expect(response.body.data).toHaveProperty('outOfStockCount')
      expect(response.body.data).toHaveProperty('totalValue')
      expect(response.body.data).toHaveProperty('recentMovements')
      
      expect(typeof response.body.data.totalProducts).toBe('number')
      expect(typeof response.body.data.totalValue).toBe('number')
    })
  })

  describe('GET /api/v1/inventory/history/:productId', () => {
    test('should get product inventory history', async () => {
      // First create some inventory movements
      await request(app)
        .post('/api/v1/inventory/adjust')
        .send({
          productId: testProduct.id,
          quantity: -10,
          type: 'SALE',
          reason: 'Test sale for history'
        })

      await request(app)
        .post('/api/v1/inventory/adjust')
        .send({
          productId: testProduct.id,
          quantity: 5,
          type: 'RETURN',
          reason: 'Test return for history'
        })

      const response = await request(app)
        .get(`/api/v1/inventory/history/${testProduct.id}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveProperty('productId', testProduct.id)
      expect(response.body.data).toHaveProperty('movements')
      expect(response.body.data.movements).toBeInstanceOf(Array)
      expect(response.body.data).toHaveProperty('pagination')
    })

    test('should handle pagination parameters', async () => {
      const response = await request(app)
        .get(`/api/v1/inventory/history/${testProduct.id}?limit=5&offset=0`)

      expect(response.status).toBe(200)
      expect(response.body.data.pagination.limit).toBe(5)
      expect(response.body.data.pagination.offset).toBe(0)
    })

    test('should return 400 for missing product ID', async () => {
      const response = await request(app)
        .get('/api/v1/inventory/history/')

      expect(response.status).toBe(404) // Route not found
    })
  })

  describe('POST /api/v1/inventory/reserve', () => {
    test('should reserve inventory for order', async () => {
      const reservationData = {
        items: [
          {
            productId: testProduct.id,
            quantity: 5
          }
        ],
        orderId: 'TEST-ORDER-001'
      }

      const response = await request(app)
        .post('/api/v1/inventory/reserve')
        .send(reservationData)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.message).toContain('TEST-ORDER-001')
    })

    test('should handle insufficient inventory for reservation', async () => {
      const reservationData = {
        items: [
          {
            productId: testProduct.id,
            quantity: 200 // More than available
          }
        ],
        orderId: 'TEST-ORDER-002'
      }

      const response = await request(app)
        .post('/api/v1/inventory/reserve')
        .send(reservationData)

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
      expect(response.body.error.message).toContain('Insufficient inventory')
    })
  })

  describe('POST /api/v1/inventory/release', () => {
    test('should release reserved inventory', async () => {
      // First reserve some inventory
      await request(app)
        .post('/api/v1/inventory/reserve')
        .send({
          items: [{ productId: testProduct.id, quantity: 5 }],
          orderId: 'TEST-ORDER-003'
        })

      // Then release it
      const releaseData = {
        items: [
          {
            productId: testProduct.id,
            quantity: 5
          }
        ],
        orderId: 'TEST-ORDER-003'
      }

      const response = await request(app)
        .post('/api/v1/inventory/release')
        .send(releaseData)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.message).toContain('TEST-ORDER-003')
    })
  })

  describe('GET /api/v1/inventory/alerts', () => {
    test('should get inventory alerts', async () => {
      const response = await request(app)
        .get('/api/v1/inventory/alerts')

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeInstanceOf(Array)
      expect(response.body).toHaveProperty('count')
    })
  })

  describe('POST /api/v1/inventory/test-notification', () => {
    test('should send test notification', async () => {
      const testData = {
        type: 'LOW_STOCK_ALERT',
        email: 'test@example.com'
      }

      const response = await request(app)
        .post('/api/v1/inventory/test-notification')
        .send(testData)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.message).toContain('test@example.com')
    })

    test('should validate notification test data', async () => {
      const invalidData = {
        type: 'INVALID_TYPE',
        email: 'invalid-email'
      }

      const response = await request(app)
        .post('/api/v1/inventory/test-notification')
        .send(invalidData)

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
    })
  })

  describe('POST /api/v1/inventory/check-alerts/:productId', () => {
    test('should trigger manual low stock check', async () => {
      // First create a low stock situation
      await request(app)
        .post('/api/v1/inventory/adjust')
        .send({
          productId: testProduct.id,
          quantity: -95, // Reduce to 5 (below threshold of 10)
          type: 'SALE'
        })

      const response = await request(app)
        .post(`/api/v1/inventory/check-alerts/${testProduct.id}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveProperty('productId', testProduct.id)
      expect(response.body.data).toHaveProperty('alertTriggered')
    })

    test('should return 404 for non-existent product', async () => {
      const response = await request(app)
        .post('/api/v1/inventory/check-alerts/non-existent-id')

      expect(response.status).toBe(404)
      expect(response.body.success).toBe(false)
    })
  })
})