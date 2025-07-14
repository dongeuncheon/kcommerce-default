import request from 'supertest'
import app from '../../src/index'
import { prisma } from '../../src/utils/database'
import jwt from 'jsonwebtoken'
import { config } from '../../src/config/config'

describe('Order Integration Tests', () => {
  let userId: string
  let authToken: string
  let productId: string
  let cartId: string
  let addressId: string

  beforeEach(async () => {
    // Clean up database before each test
    await prisma.orderTimeline.deleteMany()
    await prisma.orderCoupon.deleteMany()
    await prisma.orderAddress.deleteMany()
    await prisma.orderItem.deleteMany()
    await prisma.order.deleteMany()
    await prisma.cartCoupon.deleteMany()
    await prisma.cartItem.deleteMany()
    await prisma.cart.deleteMany()
    await prisma.productImage.deleteMany()
    await prisma.productVariant.deleteMany()
    await prisma.inventoryLog.deleteMany()
    await prisma.product.deleteMany()
    await prisma.address.deleteMany()
    await prisma.user.deleteMany()

    // Create test user
    const user = await prisma.user.create({
      data: {
        email: 'test@example.com',
        password: 'hashedpassword',
        firstName: 'Test',
        lastName: 'User',
        role: 'CUSTOMER',
        isActive: true,
        isVerified: true,
      },
    })
    userId = user.id

    // Generate auth token
    authToken = jwt.sign({ id: userId, email: user.email }, config.jwtSecret)

    // Create test address
    const address = await prisma.address.create({
      data: {
        userId,
        type: 'SHIPPING',
        firstName: 'Test',
        lastName: 'User',
        street1: '123 Test St',
        city: 'Test City',
        state: 'TS',
        postalCode: '12345',
        country: 'US',
        phone: '+1234567890',
        email: 'test@example.com',
      },
    })
    addressId = address.id

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

    // Create test cart with item
    const cart = await prisma.cart.create({
      data: {
        userId,
        currency: 'USD',
        expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
        subtotal: 199.98,
        taxAmount: 16.50,
        shippingCost: 9.99,
        discountAmount: 0,
        total: 226.47,
      },
    })
    cartId = cart.id

    await prisma.cartItem.create({
      data: {
        cartId,
        productId,
        quantity: 2,
        price: 99.99,
      },
    })
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  describe('POST /api/v1/orders', () => {
    it('should create an order from cart', async () => {
      const orderData = {
        cartId,
        shippingAddressId: addressId,
        billingAddressId: addressId,
        notes: 'Please handle with care',
      }

      const response = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send(orderData)
        .expect(201)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toMatchObject({
        orderNumber: expect.stringMatching(/^ORD-\d{8}-\d{4}$/),
        userId,
        status: 'PENDING',
        items: expect.arrayContaining([
          expect.objectContaining({
            productId,
            quantity: 2,
            unitPrice: 99.99,
          }),
        ]),
        totals: expect.objectContaining({
          subtotal: 199.98,
          total: 226.47,
          itemCount: 2,
        }),
      })

      // Verify cart was deleted
      const deletedCart = await prisma.cart.findUnique({ where: { id: cartId } })
      expect(deletedCart).toBeNull()

      // Verify inventory was updated
      const updatedProduct = await prisma.product.findUnique({ where: { id: productId } })
      expect(updatedProduct?.quantity).toBe(8) // 10 - 2
    })

    it('should fail with empty cart', async () => {
      // Create empty cart
      const emptyCart = await prisma.cart.create({
        data: {
          userId,
          currency: 'USD',
          expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
        },
      })

      const orderData = {
        cartId: emptyCart.id,
        shippingAddressId: addressId,
      }

      const response = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send(orderData)
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error.message).toContain('Cart is empty')
    })

    it('should fail without authentication', async () => {
      const response = await request(app)
        .post('/api/v1/orders')
        .send({ cartId })
        .expect(401)

      expect(response.body.success).toBe(false)
      expect(response.body.error.type).toBe('UnauthorizedError')
    })
  })

  describe('GET /api/v1/orders/:id', () => {
    let orderId: string

    beforeEach(async () => {
      // Create test order
      const order = await prisma.order.create({
        data: {
          orderNumber: 'ORD-20240101-0001',
          userId,
          status: 'PENDING',
          subtotal: 199.98,
          taxAmount: 16.50,
          shippingCost: 9.99,
          discountAmount: 0,
          total: 226.47,
          currency: 'USD',
        },
      })
      orderId = order.id

      // Create order items
      await prisma.orderItem.create({
        data: {
          orderId,
          productId,
          quantity: 2,
          unitPrice: 99.99,
          totalPrice: 199.98,
          discountAmount: 0,
          taxAmount: 16.50,
        },
      })

      // Create order addresses
      await prisma.orderAddress.createMany({
        data: [
          {
            orderId,
            type: 'SHIPPING',
            firstName: 'Test',
            lastName: 'User',
            street1: '123 Test St',
            city: 'Test City',
            state: 'TS',
            postalCode: '12345',
            country: 'US',
          },
          {
            orderId,
            type: 'BILLING',
            firstName: 'Test',
            lastName: 'User',
            street1: '123 Test St',
            city: 'Test City',
            state: 'TS',
            postalCode: '12345',
            country: 'US',
          },
        ],
      })
    })

    it('should get order by ID', async () => {
      const response = await request(app)
        .get(`/api/v1/orders/${orderId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toMatchObject({
        id: orderId,
        orderNumber: 'ORD-20240101-0001',
        userId,
        status: 'PENDING',
        items: expect.arrayContaining([
          expect.objectContaining({
            productId,
            quantity: 2,
          }),
        ]),
      })
    })

    it('should return 403 for unauthorized access', async () => {
      // Create another user
      const otherUser = await prisma.user.create({
        data: {
          email: 'other@example.com',
          password: 'hashedpassword',
          role: 'CUSTOMER',
        },
      })
      const otherToken = jwt.sign({ id: otherUser.id, email: otherUser.email }, config.jwtSecret)

      const response = await request(app)
        .get(`/api/v1/orders/${orderId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403)

      expect(response.body.success).toBe(false)
      expect(response.body.error.type).toBe('ForbiddenError')
    })
  })

  describe('GET /api/v1/orders/my-orders', () => {
    beforeEach(async () => {
      // Create multiple orders
      await prisma.order.createMany({
        data: [
          {
            orderNumber: 'ORD-20240101-0001',
            userId,
            status: 'DELIVERED',
            subtotal: 99.99,
            taxAmount: 8.25,
            shippingCost: 0,
            discountAmount: 0,
            total: 108.24,
            currency: 'USD',
          },
          {
            orderNumber: 'ORD-20240102-0001',
            userId,
            status: 'PROCESSING',
            subtotal: 199.98,
            taxAmount: 16.50,
            shippingCost: 9.99,
            discountAmount: 20,
            total: 206.47,
            currency: 'USD',
          },
        ],
      })
    })

    it('should get user orders with pagination', async () => {
      const response = await request(app)
        .get('/api/v1/orders/my-orders')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveLength(2)
      expect(response.body.pagination).toMatchObject({
        page: 1,
        limit: 10,
        total: 2,
        totalPages: 1,
      })
    })

    it('should filter orders by status', async () => {
      const response = await request(app)
        .get('/api/v1/orders/my-orders?status=DELIVERED')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body.data).toHaveLength(1)
      expect(response.body.data[0].status).toBe('DELIVERED')
    })
  })

  describe('POST /api/v1/orders/:id/cancel', () => {
    let orderId: string

    beforeEach(async () => {
      // Create cancellable order
      const order = await prisma.order.create({
        data: {
          orderNumber: 'ORD-20240101-0001',
          userId,
          status: 'PENDING',
          subtotal: 99.99,
          taxAmount: 8.25,
          shippingCost: 0,
          discountAmount: 0,
          total: 108.24,
          currency: 'USD',
        },
      })
      orderId = order.id

      // Create order item
      await prisma.orderItem.create({
        data: {
          orderId,
          productId,
          quantity: 1,
          unitPrice: 99.99,
          totalPrice: 99.99,
          discountAmount: 0,
          taxAmount: 8.25,
        },
      })
    })

    it('should cancel order', async () => {
      const cancelData = {
        reason: 'CUSTOMER_REQUEST',
        description: 'Changed my mind',
      }

      const response = await request(app)
        .post(`/api/v1/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(cancelData)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.status).toBe('CANCELLED')

      // Verify inventory was restored
      const updatedProduct = await prisma.product.findUnique({ where: { id: productId } })
      expect(updatedProduct?.quantity).toBe(11) // 10 + 1
    })

    it('should fail to cancel delivered order', async () => {
      // Update order to delivered status
      await prisma.order.update({
        where: { id: orderId },
        data: { status: 'DELIVERED' },
      })

      const cancelData = {
        reason: 'CUSTOMER_REQUEST',
      }

      const response = await request(app)
        .post(`/api/v1/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(cancelData)
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error.message).toContain('cannot be cancelled')
    })
  })

  describe('GET /api/v1/orders/:id/timeline', () => {
    let orderId: string

    beforeEach(async () => {
      // Create order with timeline events
      const order = await prisma.order.create({
        data: {
          orderNumber: 'ORD-20240101-0001',
          userId,
          status: 'PROCESSING',
          subtotal: 99.99,
          taxAmount: 8.25,
          shippingCost: 0,
          discountAmount: 0,
          total: 108.24,
          currency: 'USD',
        },
      })
      orderId = order.id

      // Create timeline events
      await prisma.orderTimeline.createMany({
        data: [
          {
            orderId,
            type: 'ORDER_CREATED',
            description: 'Order created',
            createdAt: new Date('2024-01-01T10:00:00Z'),
          },
          {
            orderId,
            type: 'ORDER_CONFIRMED',
            description: 'Order confirmed',
            createdAt: new Date('2024-01-01T10:05:00Z'),
          },
          {
            orderId,
            type: 'STATUS_CHANGED',
            description: 'Order status changed to PROCESSING',
            createdAt: new Date('2024-01-01T11:00:00Z'),
          },
        ],
      })
    })

    it('should get order timeline', async () => {
      const response = await request(app)
        .get(`/api/v1/orders/${orderId}/timeline`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveLength(3)
      expect(response.body.data[0].type).toBe('STATUS_CHANGED') // Most recent first
    })
  })

  describe('GET /api/v1/orders/my-analytics', () => {
    beforeEach(async () => {
      // Create orders with different statuses
      await prisma.order.createMany({
        data: [
          {
            orderNumber: 'ORD-20240101-0001',
            userId,
            status: 'DELIVERED',
            subtotal: 100,
            taxAmount: 8.25,
            shippingCost: 0,
            discountAmount: 0,
            total: 108.25,
            currency: 'USD',
          },
          {
            orderNumber: 'ORD-20240102-0001',
            userId,
            status: 'DELIVERED',
            subtotal: 200,
            taxAmount: 16.50,
            shippingCost: 10,
            discountAmount: 0,
            total: 226.50,
            currency: 'USD',
          },
          {
            orderNumber: 'ORD-20240103-0001',
            userId,
            status: 'PROCESSING',
            subtotal: 150,
            taxAmount: 12.38,
            shippingCost: 5,
            discountAmount: 10,
            total: 157.38,
            currency: 'USD',
          },
        ],
      })
    })

    it('should get order analytics', async () => {
      const response = await request(app)
        .get('/api/v1/orders/my-analytics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toMatchObject({
        totalOrders: 3,
        totalRevenue: 492.13, // 108.25 + 226.50 + 157.38
        averageOrderValue: 164.04, // 492.13 / 3
        statusCounts: expect.arrayContaining([
          expect.objectContaining({
            status: 'DELIVERED',
            count: 2,
            totalValue: 334.75,
          }),
          expect.objectContaining({
            status: 'PROCESSING',
            count: 1,
            totalValue: 157.38,
          }),
        ]),
      })
    })
  })
})