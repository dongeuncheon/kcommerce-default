import request from 'supertest'
import { PrismaClient } from '@prisma/client'
import app from '../../src/index'
import { paymentService } from '../../src/services/paymentService'
import { orderService } from '../../src/services/orderService'

const prisma = new PrismaClient()

describe('Payment System Integration Tests', () => {
  let testUserId: string
  let testOrderId: string
  let testPaymentId: string

  beforeAll(async () => {
    // Clean up and create test data
    await prisma.payment.deleteMany()
    await prisma.order.deleteMany()
    await prisma.user.deleteMany()

    // Create test user
    const user = await prisma.user.create({
      data: {
        email: 'payment.test@example.com',
        firstName: 'Payment',
        lastName: 'Tester',
        password: 'hashedpassword',
      },
    })
    testUserId = user.id

    // Create test order
    const order = await orderService.createOrder({
      userId: testUserId,
      items: [
        {
          productId: 'test-product-1',
          variantId: null,
          quantity: 2,
          price: 25000,
        },
      ],
      shippingAddress: {
        firstName: 'Test',
        lastName: 'User',
        addressLine1: '123 Test St',
        city: 'Test City',
        state: 'Test State',
        postalCode: '12345',
        country: 'KR',
        phone: '010-1234-5678',
      },
      billingAddress: {
        firstName: 'Test',
        lastName: 'User',
        addressLine1: '123 Test St',
        city: 'Test City',
        state: 'Test State',
        postalCode: '12345',
        country: 'KR',
        phone: '010-1234-5678',
      },
    })
    testOrderId = order.id
  })

  afterAll(async () => {
    // Clean up test data
    await prisma.payment.deleteMany()
    await prisma.order.deleteMany()
    await prisma.user.deleteMany()
    await prisma.$disconnect()
  })

  describe('Payment Initiation', () => {
    it('should initiate payment with Stripe gateway', async () => {
      const paymentData = {
        orderId: testOrderId,
        gateway: 'STRIPE',
        returnUrl: 'http://localhost:3000/payment/success',
        cancelUrl: 'http://localhost:3000/payment/cancel',
        metadata: {
          source: 'web',
          userAgent: 'test-browser',
        },
      }

      const response = await request(app)
        .post('/api/v1/payments/initiate')
        .send(paymentData)
        .expect(201)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveProperty('paymentId')
      expect(response.body.data).toHaveProperty('sessionData')
      expect(response.body.data.gateway).toBe('STRIPE')

      testPaymentId = response.body.data.paymentId
    })

    it('should initiate payment with TossPayments gateway', async () => {
      // Create another order for TossPayments test
      const order = await orderService.createOrder({
        userId: testUserId,
        items: [
          {
            productId: 'test-product-2',
            variantId: null,
            quantity: 1,
            price: 15000,
          },
        ],
        shippingAddress: {
          firstName: 'Test',
          lastName: 'User',
          addressLine1: '123 Test St',
          city: 'Test City',
          state: 'Test State',
          postalCode: '12345',
          country: 'KR',
        },
      })

      const paymentData = {
        orderId: order.id,
        gateway: 'TOSS_PAYMENTS',
        returnUrl: 'http://localhost:3000/payment/success',
        cancelUrl: 'http://localhost:3000/payment/cancel',
      }

      const response = await request(app)
        .post('/api/v1/payments/initiate')
        .send(paymentData)
        .expect(201)

      expect(response.body.success).toBe(true)
      expect(response.body.data.gateway).toBe('TOSS_PAYMENTS')
      expect(response.body.data.sessionData).toHaveProperty('clientKey')
    })

    it('should fail to initiate payment for non-existent order', async () => {
      const paymentData = {
        orderId: 'non-existent-order',
        gateway: 'STRIPE',
        returnUrl: 'http://localhost:3000/payment/success',
        cancelUrl: 'http://localhost:3000/payment/cancel',
      }

      const response = await request(app)
        .post('/api/v1/payments/initiate')
        .send(paymentData)
        .expect(404)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toContain('Order not found')
    })

    it('should fail to initiate payment with unsupported gateway', async () => {
      const paymentData = {
        orderId: testOrderId,
        gateway: 'UNSUPPORTED_GATEWAY',
        returnUrl: 'http://localhost:3000/payment/success',
        cancelUrl: 'http://localhost:3000/payment/cancel',
      }

      const response = await request(app)
        .post('/api/v1/payments/initiate')
        .send(paymentData)
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toContain('not found')
    })
  })

  describe('Payment Confirmation', () => {
    it('should confirm successful payment', async () => {
      const confirmationData = {
        paymentId: testPaymentId,
        transactionId: 'test_transaction_id_123',
        gatewayResponse: {
          status: 'succeeded',
          amount: 50000,
          currency: 'krw',
        },
      }

      const response = await request(app)
        .post('/api/v1/payments/confirm')
        .send(confirmationData)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.status).toBe('COMPLETED')
      expect(response.body.data.order.status).toBe('CONFIRMED')
    })

    it('should handle failed payment confirmation', async () => {
      // Create another payment for failure test
      const order = await orderService.createOrder({
        userId: testUserId,
        items: [
          {
            productId: 'test-product-3',
            variantId: null,
            quantity: 1,
            price: 10000,
          },
        ],
        shippingAddress: {
          firstName: 'Test',
          lastName: 'User',
          addressLine1: '123 Test St',
          city: 'Test City',
          state: 'Test State',
          postalCode: '12345',
          country: 'KR',
        },
      })

      const payment = await paymentService.initiatePayment({
        orderId: order.id,
        gateway: 'STRIPE',
        returnUrl: 'http://localhost:3000/payment/success',
        cancelUrl: 'http://localhost:3000/payment/cancel',
      })

      const confirmationData = {
        paymentId: payment.paymentId,
        transactionId: 'failed_transaction_id',
        gatewayResponse: {
          status: 'failed',
          error: 'card_declined',
        },
      }

      const response = await request(app)
        .post('/api/v1/payments/confirm')
        .send(confirmationData)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.status).toBe('FAILED')
    })
  })

  describe('Payment Cancellation', () => {
    it('should cancel pending payment', async () => {
      // Create a payment for cancellation test
      const order = await orderService.createOrder({
        userId: testUserId,
        items: [
          {
            productId: 'test-product-4',
            variantId: null,
            quantity: 1,
            price: 20000,
          },
        ],
        shippingAddress: {
          firstName: 'Test',
          lastName: 'User',
          addressLine1: '123 Test St',
          city: 'Test City',
          state: 'Test State',
          postalCode: '12345',
          country: 'KR',
        },
      })

      const payment = await paymentService.initiatePayment({
        orderId: order.id,
        gateway: 'STRIPE',
        returnUrl: 'http://localhost:3000/payment/success',
        cancelUrl: 'http://localhost:3000/payment/cancel',
      })

      const cancellationData = {
        reason: 'CUSTOMER_REQUEST',
        description: 'Customer requested cancellation',
      }

      const response = await request(app)
        .post(`/api/v1/payments/${payment.paymentId}/cancel`)
        .send(cancellationData)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.status).toBe('CANCELLED')
    })
  })

  describe('Payment Refund', () => {
    it('should process full refund', async () => {
      // Use the successfully completed payment for refund test
      const refundData = {
        amount: 50000,
        reason: 'CUSTOMER_REQUEST',
        description: 'Customer requested full refund',
      }

      const response = await request(app)
        .post(`/api/v1/payments/${testPaymentId}/refund`)
        .send(refundData)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.status).toBe('REFUNDED')
      expect(response.body.data.refundedAmount).toBe(50000)
    })

    it('should process partial refund', async () => {
      // Create another completed payment for partial refund test
      const order = await orderService.createOrder({
        userId: testUserId,
        items: [
          {
            productId: 'test-product-5',
            variantId: null,
            quantity: 2,
            price: 30000,
          },
        ],
        shippingAddress: {
          firstName: 'Test',
          lastName: 'User',
          addressLine1: '123 Test St',
          city: 'Test City',
          state: 'Test State',
          postalCode: '12345',
          country: 'KR',
        },
      })

      const payment = await paymentService.initiatePayment({
        orderId: order.id,
        gateway: 'STRIPE',
        returnUrl: 'http://localhost:3000/payment/success',
        cancelUrl: 'http://localhost:3000/payment/cancel',
      })

      // Complete the payment first
      await paymentService.confirmPayment({
        paymentId: payment.paymentId,
        transactionId: 'partial_refund_test_tx',
        gatewayResponse: { status: 'succeeded' },
      })

      // Now process partial refund
      const refundData = {
        amount: 20000, // Partial refund
        reason: 'PRODUCT_ISSUE',
        description: 'Partial refund for damaged item',
      }

      const response = await request(app)
        .post(`/api/v1/payments/${payment.paymentId}/refund`)
        .send(refundData)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.status).toBe('PARTIALLY_REFUNDED')
      expect(response.body.data.refundedAmount).toBe(20000)
    })
  })

  describe('Payment Queries', () => {
    it('should get payment by ID', async () => {
      const response = await request(app)
        .get(`/api/v1/payments/${testPaymentId}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.id).toBe(testPaymentId)
      expect(response.body.data).toHaveProperty('order')
    })

    it('should get payments with filters', async () => {
      const response = await request(app)
        .get('/api/v1/payments')
        .query({
          page: 1,
          limit: 10,
          status: 'COMPLETED',
          gateway: 'STRIPE',
        })
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveProperty('payments')
      expect(response.body.data).toHaveProperty('pagination')
      expect(Array.isArray(response.body.data.payments)).toBe(true)
    })

    it('should get payment analytics', async () => {
      const response = await request(app)
        .get('/api/v1/payments/analytics')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveProperty('totalPayments')
      expect(response.body.data).toHaveProperty('totalAmount')
      expect(response.body.data).toHaveProperty('paymentsByStatus')
      expect(response.body.data).toHaveProperty('paymentsByGateway')
    })
  })

  describe('Payment Methods', () => {
    it('should save payment method', async () => {
      const paymentMethodData = {
        type: 'CREDIT_CARD',
        provider: 'STRIPE',
        token: 'pm_1234567890',
        last4: '4242',
        expiryMonth: 12,
        expiryYear: 2025,
        brand: 'visa',
        holderName: 'Test User',
        isDefault: true,
      }

      const response = await request(app)
        .post(`/api/v1/users/${testUserId}/payment-methods`)
        .send(paymentMethodData)
        .expect(201)

      expect(response.body.success).toBe(true)
      expect(response.body.data.type).toBe('CREDIT_CARD')
      expect(response.body.data.isDefault).toBe(true)
    })

    it('should get user payment methods', async () => {
      const response = await request(app)
        .get(`/api/v1/users/${testUserId}/payment-methods`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(Array.isArray(response.body.data)).toBe(true)
      expect(response.body.data.length).toBeGreaterThan(0)
    })
  })

  describe('Payment Receipt', () => {
    it('should generate payment receipt', async () => {
      const response = await request(app)
        .get(`/api/v1/payments/${testPaymentId}/receipt`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveProperty('receiptNumber')
      expect(response.body.data).toHaveProperty('amount')
      expect(response.body.data).toHaveProperty('customerInfo')
      expect(response.body.data).toHaveProperty('paymentInfo')
    })
  })

  describe('Webhook Processing', () => {
    it('should process Stripe webhook', async () => {
      const webhookPayload = {
        id: 'evt_test_webhook',
        object: 'event',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_test_payment_intent',
            status: 'succeeded',
            amount: 50000,
            currency: 'krw',
            metadata: {
              orderId: testOrderId,
            },
          },
        },
      }

      const response = await request(app)
        .post('/api/v1/payments/webhook/stripe')
        .send(webhookPayload)
        .set('stripe-signature', 'test_signature')
        .expect(200)

      expect(response.body.success).toBe(true)
    })

    it('should process TossPayments webhook', async () => {
      const webhookPayload = {
        eventType: 'PAYMENT_COMPLETED',
        data: {
          paymentKey: 'test_payment_key',
          orderId: testOrderId,
          status: 'DONE',
          totalAmount: 15000,
        },
        createdAt: new Date().toISOString(),
      }

      const response = await request(app)
        .post('/api/v1/payments/webhook/toss-payments')
        .send(webhookPayload)
        .expect(200)

      expect(response.body.success).toBe(true)
    })

    it('should reject webhook with invalid signature', async () => {
      const webhookPayload = {
        id: 'evt_invalid_signature',
        object: 'event',
        type: 'payment_intent.succeeded',
        data: {},
      }

      const response = await request(app)
        .post('/api/v1/payments/webhook/stripe')
        .send(webhookPayload)
        .set('stripe-signature', 'invalid_signature')
        .expect(401)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toContain('signature')
    })
  })
})