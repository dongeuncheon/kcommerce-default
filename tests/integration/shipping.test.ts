import request from 'supertest'
import app from '../../src/index'
import { prisma } from '../../src/utils/database'

describe('Shipping Integration Tests', () => {
  let orderId: string
  let shipmentId: string
  let userId: string
  let adminAuthToken: string
  let customerAuthToken: string

  beforeEach(async () => {
    // Clean up database before each test
    await prisma.trackingEvent.deleteMany()
    await prisma.shipment.deleteMany()
    await prisma.orderTimeline.deleteMany()
    await prisma.orderItem.deleteMany()
    await prisma.order.deleteMany()
    await prisma.productImage.deleteMany()
    await prisma.product.deleteMany()
    await prisma.address.deleteMany()
    await prisma.user.deleteMany()

    // Create test user (customer)
    const user = await prisma.user.create({
      data: {
        email: 'customer@test.com',
        firstName: 'John',
        lastName: 'Doe',
        password: 'hashedpassword',
        role: 'CUSTOMER',
        isVerified: true,
      },
    })
    userId = user.id

    // Create admin user
    const adminUser = await prisma.user.create({
      data: {
        email: 'admin@test.com',
        firstName: 'Admin',
        lastName: 'User',
        password: 'hashedpassword',
        role: 'ADMIN',
        isVerified: true,
      },
    })

    // Create test address
    const address = await prisma.address.create({
      data: {
        userId: userId,
        type: 'SHIPPING',
        firstName: 'John',
        lastName: 'Doe',
        addressLine1: '123 Test St',
        city: 'Test City',
        state: 'CA',
        postalCode: '12345',
        country: 'US',
        isDefault: true,
      },
    })

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
        weight: 1.5, // 1.5 kg
        metadata: {
          dimensions: {
            length: 10,
            width: 8,
            height: 6,
          },
        },
      },
    })

    // Create test order
    const order = await prisma.order.create({
      data: {
        orderNumber: 'ORD-20241205-0001',
        userId: userId,
        status: 'PENDING',
        subtotal: 99.99,
        taxAmount: 8.00,
        shippingCost: 15.99,
        discountAmount: 0,
        total: 123.98,
        currency: 'USD',
        shippingAddressId: address.id,
        billingAddressId: address.id,
      },
    })
    orderId = order.id

    // Create order item
    await prisma.orderItem.create({
      data: {
        orderId: orderId,
        productId: product.id,
        quantity: 1,
        unitPrice: 99.99,
        totalPrice: 99.99,
        discountAmount: 0,
        taxAmount: 8.00,
      },
    })

    // Mock authentication tokens (in real app, these would be JWT tokens)
    adminAuthToken = 'mock-admin-token'
    customerAuthToken = 'mock-customer-token'
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  describe('POST /api/v1/shipping/rates', () => {
    it('should calculate shipping rates', async () => {
      const rateData = {
        origin: {
          street1: '123 Warehouse St',
          city: 'Seoul',
          state: 'Seoul',
          postalCode: '12345',
          country: 'KR',
        },
        destination: {
          street1: '456 Customer Ave',
          city: 'Los Angeles',
          state: 'CA',
          postalCode: '90210',
          country: 'US',
        },
        packages: [
          {
            weight: 1.5,
            weightUnit: 'kg',
            length: 10,
            width: 8,
            height: 6,
            dimensionUnit: 'cm',
            value: 99.99,
            currency: 'USD',
          },
        ],
      }

      const response = await request(app)
        .post('/api/v1/shipping/rates')
        .send(rateData)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.rates).toBeInstanceOf(Array)
      expect(response.body.data.rates.length).toBeGreaterThan(0)
      
      const firstRate = response.body.data.rates[0]
      expect(firstRate).toHaveProperty('carrier')
      expect(firstRate).toHaveProperty('service')
      expect(firstRate).toHaveProperty('cost')
      expect(firstRate).toHaveProperty('currency')
      expect(firstRate).toHaveProperty('estimatedDays')
    })

    it('should validate package data', async () => {
      const invalidRateData = {
        origin: {
          street1: '123 Warehouse St',
          city: 'Seoul',
          state: 'Seoul',
          postalCode: '12345',
          country: 'KR',
        },
        destination: {
          street1: '456 Customer Ave',
          city: 'Los Angeles',
          state: 'CA',
          postalCode: '90210',
          country: 'US',
        },
        packages: [
          {
            weight: -1, // Invalid negative weight
            weightUnit: 'kg',
            length: 10,
            width: 8,
            height: 6,
            dimensionUnit: 'cm',
            value: 99.99,
            currency: 'USD',
          },
        ],
      }

      const response = await request(app)
        .post('/api/v1/shipping/rates')
        .send(invalidRateData)
        .expect(400)

      expect(response.body.success).toBe(false)
    })
  })

  describe('GET /api/v1/shipping/carriers', () => {
    it('should return available carriers', async () => {
      const response = await request(app)
        .get('/api/v1/shipping/carriers')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeInstanceOf(Array)
      expect(response.body.data.length).toBeGreaterThan(0)
      
      const firstCarrier = response.body.data[0]
      expect(firstCarrier).toHaveProperty('code')
      expect(firstCarrier).toHaveProperty('name')
      expect(firstCarrier).toHaveProperty('services')
    })
  })

  describe('GET /api/v1/shipping/track/:trackingNumber', () => {
    beforeEach(async () => {
      // Create test shipment
      const shipment = await prisma.shipment.create({
        data: {
          orderId: orderId,
          trackingNumber: 'UPS123456789',
          carrier: 'UPS',
          method: 'STANDARD',
          status: 'SHIPPED',
          cost: 15.99,
          currency: 'USD',
          estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        },
      })
      shipmentId = shipment.id

      // Create tracking events
      await prisma.trackingEvent.create({
        data: {
          shipmentId: shipmentId,
          status: 'SHIPPED',
          description: 'Package shipped from origin',
          timestamp: new Date(),
        },
      })
    })

    it('should track shipment by tracking number', async () => {
      const response = await request(app)
        .get('/api/v1/shipping/track/UPS123456789')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveProperty('trackingNumber', 'UPS123456789')
      expect(response.body.data).toHaveProperty('carrier', 'UPS')
      expect(response.body.data).toHaveProperty('status', 'SHIPPED')
      expect(response.body.data).toHaveProperty('events')
      expect(response.body.data.events).toBeInstanceOf(Array)
    })

    it('should return 404 for non-existent tracking number', async () => {
      const response = await request(app)
        .get('/api/v1/shipping/track/NONEXISTENT123')
        .expect(404)

      expect(response.body.success).toBe(false)
    })
  })

  describe('POST /api/v1/shipping (Admin/Staff only)', () => {
    it('should create shipment with admin privileges', async () => {
      const shipmentData = {
        orderId: orderId,
        carrier: 'UPS',
        service: 'STANDARD',
        packageInfo: {
          weight: 1.5,
          weightUnit: 'kg',
          length: 10,
          width: 8,
          height: 6,
          dimensionUnit: 'cm',
          value: 99.99,
          currency: 'USD',
        },
        labelFormat: 'PDF',
        insurance: false,
        signature: false,
        saturdayDelivery: false,
      }

      // Mock admin authentication
      const response = await request(app)
        .post('/api/v1/shipping')
        .set('Authorization', `Bearer ${adminAuthToken}`)
        .send(shipmentData)
        .expect(201)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveProperty('id')
      expect(response.body.data).toHaveProperty('trackingNumber')
      expect(response.body.data).toHaveProperty('carrier', 'UPS')
      expect(response.body.data).toHaveProperty('service', 'STANDARD')
      
      shipmentId = response.body.data.id
    })

    it('should deny access to regular customers', async () => {
      const shipmentData = {
        orderId: orderId,
        carrier: 'UPS',
        service: 'STANDARD',
        packageInfo: {
          weight: 1.5,
          weightUnit: 'kg',
          length: 10,
          width: 8,
          height: 6,
          dimensionUnit: 'cm',
          value: 99.99,
          currency: 'USD',
        },
      }

      const response = await request(app)
        .post('/api/v1/shipping')
        .set('Authorization', `Bearer ${customerAuthToken}`)
        .send(shipmentData)
        .expect(403)

      expect(response.body.success).toBe(false)
    })
  })

  describe('PUT /api/v1/shipping/:id (Admin/Staff only)', () => {
    beforeEach(async () => {
      const shipment = await prisma.shipment.create({
        data: {
          orderId: orderId,
          trackingNumber: 'UPS123456789',
          carrier: 'UPS',
          method: 'STANDARD',
          status: 'SHIPPED',
          cost: 15.99,
          currency: 'USD',
        },
      })
      shipmentId = shipment.id
    })

    it('should update shipment status', async () => {
      const updateData = {
        status: 'DELIVERED',
        actualDelivery: new Date().toISOString(),
        notes: 'Package delivered successfully',
      }

      const response = await request(app)
        .put(`/api/v1/shipping/${shipmentId}`)
        .set('Authorization', `Bearer ${adminAuthToken}`)
        .send(updateData)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.status).toBe('DELIVERED')
      expect(response.body.data.actualDelivery).toBeTruthy()
    })
  })

  describe('GET /api/v1/shipping/:id (Admin/Staff only)', () => {
    beforeEach(async () => {
      const shipment = await prisma.shipment.create({
        data: {
          orderId: orderId,
          trackingNumber: 'UPS123456789',
          carrier: 'UPS',
          method: 'STANDARD',
          status: 'SHIPPED',
          cost: 15.99,
          currency: 'USD',
        },
      })
      shipmentId = shipment.id
    })

    it('should get shipment details', async () => {
      const response = await request(app)
        .get(`/api/v1/shipping/${shipmentId}`)
        .set('Authorization', `Bearer ${adminAuthToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveProperty('id', shipmentId)
      expect(response.body.data).toHaveProperty('trackingNumber', 'UPS123456789')
      expect(response.body.data).toHaveProperty('carrier', 'UPS')
    })
  })

  describe('GET /api/v1/shipping (Admin/Staff only)', () => {
    beforeEach(async () => {
      // Create multiple test shipments
      await prisma.shipment.createMany({
        data: [
          {
            orderId: orderId,
            trackingNumber: 'UPS111111111',
            carrier: 'UPS',
            method: 'STANDARD',
            status: 'SHIPPED',
            cost: 15.99,
            currency: 'USD',
          },
          {
            orderId: orderId,
            trackingNumber: 'FEDEX222222222',
            carrier: 'FEDEX',
            method: 'EXPRESS',
            status: 'DELIVERED',
            cost: 25.99,
            currency: 'USD',
          },
        ],
      })
    })

    it('should get shipments with pagination', async () => {
      const response = await request(app)
        .get('/api/v1/shipping?page=1&limit=10')
        .set('Authorization', `Bearer ${adminAuthToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeInstanceOf(Array)
      expect(response.body.pagination).toHaveProperty('page', 1)
      expect(response.body.pagination).toHaveProperty('limit', 10)
      expect(response.body.pagination).toHaveProperty('total')
    })

    it('should filter shipments by carrier', async () => {
      const response = await request(app)
        .get('/api/v1/shipping?carrier=UPS')
        .set('Authorization', `Bearer ${adminAuthToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.length).toBeGreaterThan(0)
      response.body.data.forEach((shipment: any) => {
        expect(shipment.carrier).toBe('UPS')
      })
    })
  })

  describe('POST /api/v1/shipping/webhooks/:carrier', () => {
    beforeEach(async () => {
      const shipment = await prisma.shipment.create({
        data: {
          orderId: orderId,
          trackingNumber: 'UPS123456789',
          carrier: 'UPS',
          method: 'STANDARD',
          status: 'SHIPPED',
          cost: 15.99,
          currency: 'USD',
        },
      })
      shipmentId = shipment.id
    })

    it('should handle carrier webhook', async () => {
      const webhookData = {
        trackingNumber: 'UPS123456789',
        status: 'IN_TRANSIT',
        location: 'Los Angeles, CA',
        timestamp: new Date().toISOString(),
        description: 'Package is in transit',
      }

      const response = await request(app)
        .post('/api/v1/shipping/webhooks/ups')
        .send(webhookData)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.message).toBe('Webhook processed successfully')

      // Verify tracking event was created
      const trackingEvents = await prisma.trackingEvent.findMany({
        where: { shipmentId: shipmentId },
        orderBy: { timestamp: 'desc' },
      })

      expect(trackingEvents.length).toBeGreaterThan(0)
      expect(trackingEvents[0].status).toBe('IN_TRANSIT')
      expect(trackingEvents[0].location).toBe('Los Angeles, CA')
    })
  })

  describe('GET /api/v1/shipping/analytics/overview (Admin only)', () => {
    beforeEach(async () => {
      // Create test shipments for analytics
      await prisma.shipment.createMany({
        data: [
          {
            orderId: orderId,
            trackingNumber: 'UPS111111111',
            carrier: 'UPS',
            method: 'STANDARD',
            status: 'DELIVERED',
            cost: 15.99,
            currency: 'USD',
          },
          {
            orderId: orderId,
            trackingNumber: 'FEDEX222222222',
            carrier: 'FEDEX',
            method: 'EXPRESS',
            status: 'SHIPPED',
            cost: 25.99,
            currency: 'USD',
          },
        ],
      })
    })

    it('should return shipping analytics', async () => {
      const response = await request(app)
        .get('/api/v1/shipping/analytics/overview')
        .set('Authorization', `Bearer ${adminAuthToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveProperty('totalShipments')
      expect(response.body.data).toHaveProperty('totalCost')
      expect(response.body.data).toHaveProperty('averageCost')
      expect(response.body.data).toHaveProperty('statusCounts')
      expect(response.body.data).toHaveProperty('carrierCounts')
      expect(response.body.data).toHaveProperty('recentShipments')
    })
  })

  describe('POST /api/v1/shipping/:id/cancel (Admin/Staff only)', () => {
    beforeEach(async () => {
      const shipment = await prisma.shipment.create({
        data: {
          orderId: orderId,
          trackingNumber: 'UPS123456789',
          carrier: 'UPS',
          method: 'STANDARD',
          status: 'PENDING',
          cost: 15.99,
          currency: 'USD',
        },
      })
      shipmentId = shipment.id
    })

    it('should cancel shipment', async () => {
      const cancelData = {
        reason: 'Customer requested cancellation',
      }

      const response = await request(app)
        .post(`/api/v1/shipping/${shipmentId}/cancel`)
        .set('Authorization', `Bearer ${adminAuthToken}`)
        .send(cancelData)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.status).toBe('CANCELLED')
      expect(response.body.message).toBe('Shipment cancelled successfully')
    })
  })
})