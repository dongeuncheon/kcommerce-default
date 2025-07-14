import request from 'supertest'
import app from '../../src/index'
import { prisma } from '../../src/utils/database'

describe('Cart Integration Tests', () => {
  let productId: string

  beforeEach(async () => {
    // Clean up database before each test
    await prisma.cartCoupon.deleteMany()
    await prisma.cartItem.deleteMany()
    await prisma.cart.deleteMany()
    await prisma.productImage.deleteMany()
    await prisma.productVariant.deleteMany()
    await prisma.product.deleteMany()

    // Create test product
    const product = await prisma.product.create({
      data: {
        name: 'Test Product',
        slug: 'test-product',
        sku: 'TEST-001',
        price: 99.99,
        status: 'PUBLISHED',
        type: 'SIMPLE',
        quantity: 10,
        trackQuantity: true,
      },
    })
    productId = product.id
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  describe('POST /api/v1/carts', () => {
    it('should create a new cart', async () => {
      const cartData = {
        currency: 'USD',
        sessionId: 'test-session-123',
      }

      const response = await request(app)
        .post('/api/v1/carts')
        .send(cartData)
        .expect(201)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toMatchObject({
        currency: 'USD',
        sessionId: 'test-session-123',
        items: [],
        totals: {
          subtotal: 0,
          total: 0,
          itemCount: 0,
        },
      })
      expect(response.body.data.id).toBeDefined()
      expect(response.body.data.expiresAt).toBeDefined()
    })

    it('should create a cart with initial items', async () => {
      const cartData = {
        currency: 'USD',
        sessionId: 'test-session-123',
        items: [
          {
            productId,
            quantity: 2,
          },
        ],
      }

      const response = await request(app)
        .post('/api/v1/carts')
        .send(cartData)
        .expect(201)

      expect(response.body.success).toBe(true)
      expect(response.body.data.items).toHaveLength(1)
      expect(response.body.data.items[0]).toMatchObject({
        productId,
        quantity: 2,
        unitPrice: 99.99,
        totalPrice: 199.98,
      })
      expect(response.body.data.totals.itemCount).toBe(2)
    })
  })

  describe('GET /api/v1/carts/find', () => {
    let cartId: string

    beforeEach(async () => {
      const cart = await prisma.cart.create({
        data: {
          sessionId: 'test-session-123',
          currency: 'USD',
          expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000), // 72 hours
        },
      })
      cartId = cart.id
    })

    it('should find cart by session ID', async () => {
      const response = await request(app)
        .get('/api/v1/carts/find?sessionId=test-session-123')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.id).toBe(cartId)
      expect(response.body.data.sessionId).toBe('test-session-123')
    })

    it('should return 404 for non-existent session', async () => {
      const response = await request(app)
        .get('/api/v1/carts/find?sessionId=non-existent')
        .expect(404)

      expect(response.body.success).toBe(false)
      expect(response.body.error.type).toBe('NotFoundError')
    })

    it('should return 400 if no userId or sessionId provided', async () => {
      const response = await request(app)
        .get('/api/v1/carts/find')
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error.type).toBe('ValidationError')
    })
  })

  describe('POST /api/v1/carts/:id/items', () => {
    let cartId: string

    beforeEach(async () => {
      const cart = await prisma.cart.create({
        data: {
          sessionId: 'test-session-123',
          currency: 'USD',
          expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
        },
      })
      cartId = cart.id
    })

    it('should add item to cart', async () => {
      const itemData = {
        productId,
        quantity: 2,
      }

      const response = await request(app)
        .post(`/api/v1/carts/${cartId}/items`)
        .send(itemData)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.items).toHaveLength(1)
      expect(response.body.data.items[0]).toMatchObject({
        productId,
        quantity: 2,
        unitPrice: 99.99,
      })
      expect(response.body.data.totals.itemCount).toBe(2)
    })

    it('should update quantity if item already exists', async () => {
      // Add item first time
      await request(app)
        .post(`/api/v1/carts/${cartId}/items`)
        .send({ productId, quantity: 1 })
        .expect(200)

      // Add same item again
      const response = await request(app)
        .post(`/api/v1/carts/${cartId}/items`)
        .send({ productId, quantity: 2 })
        .expect(200)

      expect(response.body.data.items).toHaveLength(1)
      expect(response.body.data.items[0].quantity).toBe(3) // 1 + 2
      expect(response.body.data.totals.itemCount).toBe(3)
    })

    it('should return 400 for insufficient stock', async () => {
      const itemData = {
        productId,
        quantity: 20, // More than available (10)
      }

      const response = await request(app)
        .post(`/api/v1/carts/${cartId}/items`)
        .send(itemData)
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error.message).toContain('Insufficient stock')
    })

    it('should return 404 for non-existent product', async () => {
      const itemData = {
        productId: 'clxxxxxxxxxxxxxxxxxxxxxxxx',
        quantity: 1,
      }

      const response = await request(app)
        .post(`/api/v1/carts/${cartId}/items`)
        .send(itemData)
        .expect(404)

      expect(response.body.success).toBe(false)
      expect(response.body.error.message).toBe('Product not found')
    })
  })

  describe('PUT /api/v1/carts/:cartId/items/:itemId', () => {
    let cartId: string
    let itemId: string

    beforeEach(async () => {
      // Create cart with item
      const cart = await prisma.cart.create({
        data: {
          sessionId: 'test-session-123',
          currency: 'USD',
          expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
        },
      })
      cartId = cart.id

      const item = await prisma.cartItem.create({
        data: {
          cartId,
          productId,
          quantity: 2,
          price: 99.99,
        },
      })
      itemId = item.id
    })

    it('should update cart item quantity', async () => {
      const updateData = {
        quantity: 5,
      }

      const response = await request(app)
        .put(`/api/v1/carts/${cartId}/items/${itemId}`)
        .send(updateData)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.items[0].quantity).toBe(5)
      expect(response.body.data.totals.itemCount).toBe(5)
    })

    it('should return 400 for insufficient stock', async () => {
      const updateData = {
        quantity: 15, // More than available (10)
      }

      const response = await request(app)
        .put(`/api/v1/carts/${cartId}/items/${itemId}`)
        .send(updateData)
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error.message).toContain('Insufficient stock')
    })

    it('should return 404 for non-existent item', async () => {
      const response = await request(app)
        .put(`/api/v1/carts/${cartId}/items/clxxxxxxxxxxxxxxxxxxxxxxxx`)
        .send({ quantity: 1 })
        .expect(404)

      expect(response.body.success).toBe(false)
      expect(response.body.error.type).toBe('NotFoundError')
    })
  })

  describe('DELETE /api/v1/carts/:cartId/items/:itemId', () => {
    let cartId: string
    let itemId: string

    beforeEach(async () => {
      // Create cart with item
      const cart = await prisma.cart.create({
        data: {
          sessionId: 'test-session-123',
          currency: 'USD',
          expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
        },
      })
      cartId = cart.id

      const item = await prisma.cartItem.create({
        data: {
          cartId,
          productId,
          quantity: 2,
          price: 99.99,
        },
      })
      itemId = item.id
    })

    it('should remove item from cart', async () => {
      const response = await request(app)
        .delete(`/api/v1/carts/${cartId}/items/${itemId}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.items).toHaveLength(0)
      expect(response.body.data.totals.itemCount).toBe(0)
    })

    it('should return 404 for non-existent item', async () => {
      const response = await request(app)
        .delete(`/api/v1/carts/${cartId}/items/clxxxxxxxxxxxxxxxxxxxxxxxx`)
        .expect(404)

      expect(response.body.success).toBe(false)
      expect(response.body.error.type).toBe('NotFoundError')
    })
  })

  describe('DELETE /api/v1/carts/:id/items', () => {
    let cartId: string

    beforeEach(async () => {
      // Create cart with items
      const cart = await prisma.cart.create({
        data: {
          sessionId: 'test-session-123',
          currency: 'USD',
          expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
        },
      })
      cartId = cart.id

      await prisma.cartItem.createMany({
        data: [
          { cartId, productId, quantity: 2, price: 99.99 },
          { cartId, productId, quantity: 1, price: 99.99 },
        ],
      })
    })

    it('should clear all items from cart', async () => {
      const response = await request(app)
        .delete(`/api/v1/carts/${cartId}/items`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.items).toHaveLength(0)
      expect(response.body.data.totals.itemCount).toBe(0)
      expect(response.body.data.totals.total).toBe(0)
    })
  })

  describe('GET /api/v1/carts/:id/validate-stock', () => {
    let cartId: string

    beforeEach(async () => {
      // Create cart with item
      const cart = await prisma.cart.create({
        data: {
          sessionId: 'test-session-123',
          currency: 'USD',
          expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
        },
      })
      cartId = cart.id

      await prisma.cartItem.create({
        data: {
          cartId,
          productId,
          quantity: 5, // Within stock limit
          price: 99.99,
        },
      })
    })

    it('should validate cart stock successfully', async () => {
      const response = await request(app)
        .get(`/api/v1/carts/${cartId}/validate-stock`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.isValid).toBe(true)
      expect(response.body.data.issues).toHaveLength(0)
    })

    it('should return stock issues for insufficient inventory', async () => {
      // Update cart item to exceed stock
      await prisma.cartItem.updateMany({
        where: { cartId },
        data: { quantity: 15 }, // Exceeds available stock (10)
      })

      const response = await request(app)
        .get(`/api/v1/carts/${cartId}/validate-stock`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.isValid).toBe(false)
      expect(response.body.data.issues).toHaveLength(1)
      expect(response.body.data.issues[0]).toMatchObject({
        productId,
        requestedQuantity: 15,
        availableQuantity: 10,
      })
    })
  })

  describe('POST /api/v1/carts/quick-add', () => {
    it('should create cart and add item in one request', async () => {
      const quickAddData = {
        productId,
        quantity: 2,
      }

      const response = await request(app)
        .post('/api/v1/carts/quick-add?sessionId=test-session-123')
        .send(quickAddData)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.items).toHaveLength(1)
      expect(response.body.data.items[0]).toMatchObject({
        productId,
        quantity: 2,
      })
      expect(response.body.data.sessionId).toBe('test-session-123')
    })

    it('should add to existing cart if found', async () => {
      // Create existing cart
      const existingCart = await prisma.cart.create({
        data: {
          sessionId: 'test-session-123',
          currency: 'USD',
          expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
        },
      })

      await prisma.cartItem.create({
        data: {
          cartId: existingCart.id,
          productId,
          quantity: 1,
          price: 99.99,
        },
      })

      const quickAddData = {
        productId,
        quantity: 1,
      }

      const response = await request(app)
        .post('/api/v1/carts/quick-add?sessionId=test-session-123')
        .send(quickAddData)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.id).toBe(existingCart.id)
      expect(response.body.data.items[0].quantity).toBe(2) // 1 + 1
    })

    it('should return 400 if productId is missing', async () => {
      const response = await request(app)
        .post('/api/v1/carts/quick-add?sessionId=test-session-123')
        .send({ quantity: 1 })
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error.type).toBe('ValidationError')
    })
  })

  describe('GET /api/v1/carts/count/items', () => {
    it('should return cart item count', async () => {
      // Create cart with items
      const cart = await prisma.cart.create({
        data: {
          sessionId: 'test-session-123',
          currency: 'USD',
          expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
        },
      })

      await prisma.cartItem.createMany({
        data: [
          { cartId: cart.id, productId, quantity: 2, price: 99.99 },
          { cartId: cart.id, productId, quantity: 3, price: 99.99 },
        ],
      })

      const response = await request(app)
        .get('/api/v1/carts/count/items?sessionId=test-session-123')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.count).toBe(5) // 2 + 3
    })

    it('should return 0 for non-existent cart', async () => {
      const response = await request(app)
        .get('/api/v1/carts/count/items?sessionId=non-existent')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.count).toBe(0)
    })
  })
})