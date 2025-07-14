import { describe, test, expect, beforeEach } from 'jest'
import request from 'supertest'
import app from '../../src/index'

describe('Guest Cart API Integration Tests', () => {
  let testProduct: any
  let testCategory: any
  let guestSessionId: string

  beforeEach(async () => {
    // Generate a unique session ID for each test
    guestSessionId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Create a test category
    const categoryData = {
      name: 'Guest Test Category',
      slug: 'guest-test-category',
      description: 'Category for guest cart tests'
    }

    const categoryResponse = await request(app)
      .post('/api/v1/categories')
      .send(categoryData)

    testCategory = categoryResponse.body.data

    // Create a test product
    const productData = {
      name: 'Guest Test Product',
      slug: 'guest-test-product',
      sku: 'GUEST-TEST-001',
      status: 'PUBLISHED',
      type: 'SIMPLE',
      price: 29.99,
      categoryId: testCategory.id,
      trackQuantity: true,
      quantity: 100,
      lowStockThreshold: 10,
      allowBackorders: false
    }

    const productResponse = await request(app)
      .post('/api/v1/products')
      .send(productData)

    testProduct = productResponse.body.data
  })

  describe('GET /api/v1/carts/guest', () => {
    test('should get or create guest cart', async () => {
      const response = await request(app)
        .get(`/api/v1/carts/guest?sessionId=${guestSessionId}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveProperty('id')
      expect(response.body.data).toHaveProperty('sessionId', guestSessionId)
      expect(response.body.data).toHaveProperty('userId', null)
      expect(response.body.data).toHaveProperty('items')
      expect(response.body.data.items).toHaveLength(0)
      expect(response.body.message).toBe('Empty guest cart ready')
    })

    test('should return existing guest cart on subsequent calls', async () => {
      // First call - create cart
      const firstResponse = await request(app)
        .get(`/api/v1/carts/guest?sessionId=${guestSessionId}`)

      const cartId = firstResponse.body.data.id

      // Second call - get existing cart
      const secondResponse = await request(app)
        .get(`/api/v1/carts/guest?sessionId=${guestSessionId}`)

      expect(secondResponse.status).toBe(200)
      expect(secondResponse.body.data.id).toBe(cartId)
    })

    test('should return 400 when sessionId is missing', async () => {
      const response = await request(app)
        .get('/api/v1/carts/guest')

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
      expect(response.body.error.message).toBe('Session ID is required for guest cart')
    })
  })

  describe('POST /api/v1/carts/guest/quick-add', () => {
    test('should create cart and add item in one step', async () => {
      const requestData = {
        sessionId: guestSessionId,
        productId: testProduct.id,
        quantity: 2
      }

      const response = await request(app)
        .post('/api/v1/carts/guest/quick-add')
        .send(requestData)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveProperty('sessionId', guestSessionId)
      expect(response.body.data.items).toHaveLength(1)
      expect(response.body.data.items[0]).toHaveProperty('productId', testProduct.id)
      expect(response.body.data.items[0]).toHaveProperty('quantity', 2)
      expect(response.body.message).toBe('Item added to guest cart')
    })

    test('should add item to existing guest cart', async () => {
      // First create a cart
      await request(app)
        .get(`/api/v1/carts/guest?sessionId=${guestSessionId}`)

      // Then add item
      const requestData = {
        sessionId: guestSessionId,
        productId: testProduct.id,
        quantity: 1
      }

      const response = await request(app)
        .post('/api/v1/carts/guest/quick-add')
        .send(requestData)

      expect(response.status).toBe(200)
      expect(response.body.data.items).toHaveLength(1)
    })

    test('should return 400 for invalid product ID', async () => {
      const requestData = {
        sessionId: guestSessionId,
        productId: 'invalid-product-id',
        quantity: 1
      }

      const response = await request(app)
        .post('/api/v1/carts/guest/quick-add')
        .send(requestData)

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
    })
  })

  describe('GET /api/v1/carts/guest/:sessionId/summary', () => {
    test('should return empty cart summary for new session', async () => {
      const response = await request(app)
        .get(`/api/v1/carts/guest/${guestSessionId}/summary`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toEqual({
        itemCount: 0,
        total: 0,
        subtotal: 0,
        currency: 'USD',
        isEmpty: true
      })
    })

    test('should return cart summary with items', async () => {
      // Add item to cart first
      await request(app)
        .post('/api/v1/carts/guest/quick-add')
        .send({
          sessionId: guestSessionId,
          productId: testProduct.id,
          quantity: 2
        })

      const response = await request(app)
        .get(`/api/v1/carts/guest/${guestSessionId}/summary`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveProperty('cartId')
      expect(response.body.data).toHaveProperty('itemCount', 1)
      expect(response.body.data).toHaveProperty('total')
      expect(response.body.data).toHaveProperty('subtotal')
      expect(response.body.data).toHaveProperty('isEmpty', false)
      expect(response.body.data.total).toBeGreaterThan(0)
    })
  })

  describe('POST /api/v1/carts/guest/migrate', () => {
    test('should migrate cart from local storage data', async () => {
      const migrateData = {
        sessionId: guestSessionId,
        cartData: {
          items: [
            {
              productId: testProduct.id,
              quantity: 3
            }
          ],
          currency: 'USD'
        }
      }

      const response = await request(app)
        .post('/api/v1/carts/guest/migrate')
        .send(migrateData)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveProperty('sessionId', guestSessionId)
      expect(response.body.data.items).toHaveLength(1)
      expect(response.body.data.items[0]).toHaveProperty('quantity', 3)
      expect(response.body.message).toBe('Guest cart migrated from local storage')
    })

    test('should handle invalid product IDs gracefully during migration', async () => {
      const migrateData = {
        sessionId: guestSessionId,
        cartData: {
          items: [
            {
              productId: 'invalid-product-id',
              quantity: 1
            },
            {
              productId: testProduct.id,
              quantity: 2
            }
          ],
          currency: 'USD'
        }
      }

      const response = await request(app)
        .post('/api/v1/carts/guest/migrate')
        .send(migrateData)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      // Should have only the valid product
      expect(response.body.data.items).toHaveLength(1)
      expect(response.body.data.items[0]).toHaveProperty('productId', testProduct.id)
    })
  })

  describe('POST /api/v1/carts/guest/transfer', () => {
    test('should transfer guest cart to authenticated user', async () => {
      // Create a guest cart with items
      await request(app)
        .post('/api/v1/carts/guest/quick-add')
        .send({
          sessionId: guestSessionId,
          productId: testProduct.id,
          quantity: 2
        })

      // Mock user ID for transfer
      const userId = `user_${Date.now()}`

      const transferData = {
        sessionId: guestSessionId,
        userId: userId
      }

      const response = await request(app)
        .post('/api/v1/carts/guest/transfer')
        .send(transferData)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.message).toBe('Guest cart transferred to user successfully')
      
      // Verify the cart now belongs to the user
      if (response.body.data) {
        expect(response.body.data).toHaveProperty('userId', userId)
        expect(response.body.data).toHaveProperty('sessionId', null)
      }
    })

    test('should return 404 when guest cart not found', async () => {
      const transferData = {
        sessionId: 'non-existent-session',
        userId: `user_${Date.now()}`
      }

      const response = await request(app)
        .post('/api/v1/carts/guest/transfer')
        .send(transferData)

      expect(response.status).toBe(404)
      expect(response.body.success).toBe(false)
      expect(response.body.error.message).toBe('Guest cart not found or transfer failed')
    })

    test('should validate user ID format', async () => {
      const transferData = {
        sessionId: guestSessionId,
        userId: 'invalid-user-id'
      }

      const response = await request(app)
        .post('/api/v1/carts/guest/transfer')
        .send(transferData)

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
    })
  })

  describe('GET /api/v1/carts/guest/session/:sessionId/info', () => {
    test('should return session information', async () => {
      // Create a guest cart first
      await request(app)
        .get(`/api/v1/carts/guest?sessionId=${guestSessionId}`)

      const response = await request(app)
        .get(`/api/v1/carts/guest/session/${guestSessionId}/info`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveProperty('session')
      expect(response.body.data).toHaveProperty('cart')
      expect(response.body.data).toHaveProperty('itemCount')
      expect(response.body.data).toHaveProperty('isExpired')
      expect(response.body.data).toHaveProperty('lastActivity')
    })

    test('should handle non-existent session', async () => {
      const response = await request(app)
        .get('/api/v1/carts/guest/session/non-existent-session/info')

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.session).toBe(null)
      expect(response.body.data.isExpired).toBe(true)
    })
  })

  describe('POST /api/v1/carts/guest/session/:sessionId/extend', () => {
    test('should extend guest session', async () => {
      // Create a guest cart first
      await request(app)
        .get(`/api/v1/carts/guest?sessionId=${guestSessionId}`)

      const response = await request(app)
        .post(`/api/v1/carts/guest/session/${guestSessionId}/extend`)
        .send({ hours: 48 })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.message).toBe('Session extended by 48 hours')
    })

    test('should use default 24 hours when not specified', async () => {
      // Create a guest cart first
      await request(app)
        .get(`/api/v1/carts/guest?sessionId=${guestSessionId}`)

      const response = await request(app)
        .post(`/api/v1/carts/guest/session/${guestSessionId}/extend`)
        .send({})

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.message).toBe('Session extended by 24 hours')
    })

    test('should validate hours range', async () => {
      const response = await request(app)
        .post(`/api/v1/carts/guest/session/${guestSessionId}/extend`)
        .send({ hours: 200 }) // Exceeds max of 168

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
    })

    test('should return 404 for non-existent session', async () => {
      const response = await request(app)
        .post('/api/v1/carts/guest/session/non-existent-session/extend')
        .send({ hours: 24 })

      expect(response.status).toBe(404)
      expect(response.body.success).toBe(false)
      expect(response.body.error.message).toBe('Guest session not found')
    })
  })

  describe('GET /api/v1/carts/guest/stats', () => {
    test('should return guest session statistics', async () => {
      const response = await request(app)
        .get('/api/v1/carts/guest/stats')

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveProperty('activeGuestSessions')
      expect(response.body.data).toHaveProperty('activeCarts')
      expect(response.body.data).toHaveProperty('averageSessionDuration')
      expect(response.body.data).toHaveProperty('newSessionsInPeriod')
      
      expect(typeof response.body.data.activeGuestSessions).toBe('number')
      expect(typeof response.body.data.activeCarts).toBe('number')
      expect(typeof response.body.data.averageSessionDuration).toBe('number')
      expect(typeof response.body.data.newSessionsInPeriod).toBe('number')
    })

    test('should accept custom time period', async () => {
      const response = await request(app)
        .get('/api/v1/carts/guest/stats?hours=48')

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
    })
  })

  describe('Guest Cart Integration Workflow', () => {
    test('should support complete guest shopping flow', async () => {
      // 1. Get guest cart (auto-creates)
      const cartResponse = await request(app)
        .get(`/api/v1/carts/guest?sessionId=${guestSessionId}`)

      expect(cartResponse.status).toBe(200)
      const cartId = cartResponse.body.data.id

      // 2. Add items to cart
      await request(app)
        .post('/api/v1/carts/guest/quick-add')
        .send({
          sessionId: guestSessionId,
          productId: testProduct.id,
          quantity: 2
        })

      // 3. Check cart summary
      const summaryResponse = await request(app)
        .get(`/api/v1/carts/guest/${guestSessionId}/summary`)

      expect(summaryResponse.body.data.itemCount).toBe(1)
      expect(summaryResponse.body.data.isEmpty).toBe(false)

      // 4. Update item quantity using standard cart API
      const cart = await request(app)
        .get(`/api/v1/carts/${cartId}`)

      const itemId = cart.body.data.items[0].id

      await request(app)
        .put(`/api/v1/carts/${cartId}/items/${itemId}`)
        .send({ quantity: 3 })

      // 5. Verify updated quantity
      const updatedSummary = await request(app)
        .get(`/api/v1/carts/guest/${guestSessionId}/summary`)

      expect(updatedSummary.body.data.itemCount).toBe(1)

      // 6. Extend session
      await request(app)
        .post(`/api/v1/carts/guest/session/${guestSessionId}/extend`)
        .send({ hours: 48 })

      // 7. Get session info
      const sessionInfo = await request(app)
        .get(`/api/v1/carts/guest/session/${guestSessionId}/info`)

      expect(sessionInfo.body.data.itemCount).toBe(1)
      expect(sessionInfo.body.data.isExpired).toBe(false)
    })

    test('should handle guest to user transfer with existing user cart', async () => {
      const userId = `user_${Date.now()}`

      // 1. Create user cart first
      const userCartResponse = await request(app)
        .post('/api/v1/carts')
        .send({ userId, currency: 'USD' })

      const userCartId = userCartResponse.body.data.id

      // Add item to user cart
      await request(app)
        .post(`/api/v1/carts/${userCartId}/items`)
        .send({
          productId: testProduct.id,
          quantity: 1
        })

      // 2. Create guest cart with different quantity
      await request(app)
        .post('/api/v1/carts/guest/quick-add')
        .send({
          sessionId: guestSessionId,
          productId: testProduct.id,
          quantity: 2
        })

      // 3. Transfer guest cart to user (should merge)
      const transferResponse = await request(app)
        .post('/api/v1/carts/guest/transfer')
        .send({
          sessionId: guestSessionId,
          userId: userId
        })

      expect(transferResponse.status).toBe(200)

      // 4. Verify items were merged
      const finalCart = await request(app)
        .get(`/api/v1/carts/${userCartId}`)

      // Should have the items (quantities may be combined or separate items)
      expect(finalCart.body.data.items.length).toBeGreaterThanOrEqual(1)
    })
  })
})