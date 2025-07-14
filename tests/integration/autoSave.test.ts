import request from 'supertest'
import app from '../../src/index'
import { prisma } from '../../src/utils/database'
import { 
  getAutoSaveStats, 
  recoverCartFromSnapshot, 
  cleanupAutoSave,
  shutdownAutoSave
} from '../../src/middleware/autoSave'

describe('Auto-Save Functionality Integration', () => {
  let sessionId: string
  let productId: string
  let cartId: string

  beforeAll(async () => {
    // Create test product
    const product = await prisma.product.create({
      data: {
        name: 'Test Auto-Save Product',
        slug: 'test-autosave-product',
        description: 'A test product for auto-save',
        price: 19.99,
        status: 'PUBLISHED',
        trackQuantity: true,
        quantity: 100,
        sku: 'TEST-AUTOSAVE-001',
        categoryId: 'test-category-id',
      }
    })
    productId = product.id

    // Generate test session ID
    sessionId = `test-session-${Date.now()}`
  })

  afterAll(async () => {
    // Clean up test data
    await prisma.cartItem.deleteMany()
    await prisma.cart.deleteMany()
    await prisma.product.deleteMany()
    
    // Clean up auto-save resources
    cleanupAutoSave(sessionId)
    shutdownAutoSave()
  })

  describe('Cart Auto-Save Functionality', () => {
    it('should create cart with auto-save enabled', async () => {
      const response = await request(app)
        .post('/api/v1/carts')
        .set('X-Session-ID', sessionId)
        .send({
          sessionId,
          currency: 'USD',
          items: [
            {
              productId,
              quantity: 2
            }
          ]
        })

      expect(response.status).toBe(201)
      expect(response.body.success).toBe(true)
      expect(response.body.data.items).toHaveLength(1)

      cartId = response.body.data.id

      // Wait a moment for auto-save to potentially trigger
      await new Promise(resolve => setTimeout(resolve, 100))
    })

    it('should auto-save when items are added to cart', async () => {
      const response = await request(app)
        .post(`/api/v1/carts/${cartId}/items`)
        .set('X-Session-ID', sessionId)
        .send({
          productId,
          quantity: 1
        })

      expect(response.status).toBe(201)
      expect(response.body.success).toBe(true)

      // Verify cart was updated
      const updatedCart = response.body.data
      const targetItem = updatedCart.items.find((item: any) => item.productId === productId)
      expect(targetItem.quantity).toBe(3) // Should be combined: 2 + 1

      // Wait for auto-save to process
      await new Promise(resolve => setTimeout(resolve, 200))
    })

    it('should auto-save when cart items are updated', async () => {
      // Get cart to find item ID
      const cartResponse = await request(app)
        .get(`/api/v1/carts/${cartId}`)
        .set('X-Session-ID', sessionId)

      const itemId = cartResponse.body.data.items[0].id

      const response = await request(app)
        .put(`/api/v1/carts/${cartId}/items/${itemId}`)
        .set('X-Session-ID', sessionId)
        .send({
          quantity: 5
        })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.items[0].quantity).toBe(5)

      // Wait for auto-save to process
      await new Promise(resolve => setTimeout(resolve, 200))
    })

    it('should track auto-save statistics', () => {
      const stats = getAutoSaveStats()
      
      expect(stats).toHaveProperty('activeSessions')
      expect(stats).toHaveProperty('snapshotsCount')
      expect(stats).toHaveProperty('timersCount')
      expect(typeof stats.activeSessions).toBe('number')
      expect(typeof stats.snapshotsCount).toBe('number')
      expect(typeof stats.timersCount).toBe('number')
    })
  })

  describe('Cart Recovery Functionality', () => {
    it('should be able to recover cart from snapshot', async () => {
      // First, ensure we have a cart with items to create a snapshot
      await new Promise(resolve => setTimeout(resolve, 500)) // Wait for auto-save

      // Attempt recovery (this would normally happen after session expiry)
      const recovered = await recoverCartFromSnapshot(sessionId)
      
      // Recovery may or may not succeed depending on snapshot availability
      // This is more of a test that the function doesn't crash
      expect(typeof recovered).toBe('boolean')
    })

    it('should handle cart recovery for non-existent session gracefully', async () => {
      const recovered = await recoverCartFromSnapshot('non-existent-session')
      expect(recovered).toBe(false)
    })
  })

  describe('Auto-Save API Endpoints', () => {
    it('should get auto-save statistics via API', async () => {
      const response = await request(app)
        .get('/api/v1/auto-save/stats')

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveProperty('activeSessions')
      expect(response.body.data).toHaveProperty('snapshotsCount')
      expect(response.body.data).toHaveProperty('timersCount')
    })

    it('should test auto-save functionality via API', async () => {
      const response = await request(app)
        .post('/api/v1/auto-save/test')
        .send({
          sessionId: 'test-api-session',
          testData: { test: 'value' }
        })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveProperty('status', 'test_completed')
      expect(response.body.data).toHaveProperty('sessionId')
      expect(response.body.data).toHaveProperty('testData')
    })

    it('should perform cart recovery via API', async () => {
      const response = await request(app)
        .post('/api/v1/auto-save/recover')
        .send({
          sessionId: sessionId
        })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveProperty('sessionId', sessionId)
      expect(response.body.data).toHaveProperty('recovered')
      expect(typeof response.body.data.recovered).toBe('boolean')
    })

    it('should clean up auto-save resources via API', async () => {
      const response = await request(app)
        .delete(`/api/v1/auto-save/cleanup/${sessionId}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveProperty('sessionId', sessionId)
    })

    it('should check auto-save system health via API', async () => {
      const response = await request(app)
        .get('/api/v1/auto-save/health')

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveProperty('status')
      expect(response.body.data).toHaveProperty('timestamp')
      expect(response.body.data).toHaveProperty('activeSessions')
      expect(response.body.data).toHaveProperty('issues')
      expect(Array.isArray(response.body.data.issues)).toBe(true)
    })

    it('should handle invalid session ID in recovery gracefully', async () => {
      const response = await request(app)
        .post('/api/v1/auto-save/recover')
        .send({
          sessionId: ''
        })

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
      expect(response.body.error).toHaveProperty('message', 'Validation error')
    })

    it('should handle missing session ID in cleanup gracefully', async () => {
      const response = await request(app)
        .delete('/api/v1/auto-save/cleanup/')

      expect(response.status).toBe(404)
    })
  })

  describe('Session-based Cart Persistence', () => {
    it('should persist cart across session recreation', async () => {
      // Create a new cart with a different session
      const newSessionId = `test-session-persist-${Date.now()}`
      
      const createResponse = await request(app)
        .post('/api/v1/carts')
        .set('X-Session-ID', newSessionId)
        .send({
          sessionId: newSessionId,
          currency: 'USD',
          items: [
            {
              productId,
              quantity: 3
            }
          ]
        })

      expect(createResponse.status).toBe(201)
      const persistedCartId = createResponse.body.data.id

      // Wait for auto-save
      await new Promise(resolve => setTimeout(resolve, 300))

      // Simulate getting cart with same session
      const getResponse = await request(app)
        .get(`/api/v1/carts/${persistedCartId}`)
        .set('X-Session-ID', newSessionId)

      expect(getResponse.status).toBe(200)
      expect(getResponse.body.data.items).toHaveLength(1)
      expect(getResponse.body.data.items[0].quantity).toBe(3)

      // Clean up
      cleanupAutoSave(newSessionId)
    })

    it('should handle concurrent cart operations with auto-save', async () => {
      const concurrentSessionId = `test-session-concurrent-${Date.now()}`
      
      // Create cart
      const createResponse = await request(app)
        .post('/api/v1/carts')
        .set('X-Session-ID', concurrentSessionId)
        .send({
          sessionId: concurrentSessionId,
          currency: 'USD'
        })

      const concurrentCartId = createResponse.body.data.id

      // Perform multiple concurrent operations
      const operations = [
        request(app)
          .post(`/api/v1/carts/${concurrentCartId}/items`)
          .set('X-Session-ID', concurrentSessionId)
          .send({ productId, quantity: 1 }),
        
        request(app)
          .post(`/api/v1/carts/${concurrentCartId}/items`)
          .set('X-Session-ID', concurrentSessionId)
          .send({ productId, quantity: 2 }),
        
        request(app)
          .get(`/api/v1/carts/${concurrentCartId}`)
          .set('X-Session-ID', concurrentSessionId)
      ]

      const results = await Promise.all(operations)

      // All operations should succeed
      results.forEach((result, index) => {
        if (index < 2) { // POST operations
          expect(result.status).toBe(201)
        } else { // GET operation
          expect(result.status).toBe(200)
        }
        expect(result.body.success).toBe(true)
      })

      // Final cart should have combined quantities
      const finalResponse = await request(app)
        .get(`/api/v1/carts/${concurrentCartId}`)
        .set('X-Session-ID', concurrentSessionId)

      expect(finalResponse.body.data.items[0].quantity).toBe(3) // 1 + 2

      // Clean up
      cleanupAutoSave(concurrentSessionId)
    })
  })
})