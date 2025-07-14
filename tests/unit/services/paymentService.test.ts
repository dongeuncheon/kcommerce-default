import { PaymentService } from '../../../src/services/paymentService'
import { PrismaClient } from '@prisma/client'
import { PaymentGatewayFactory } from '../../../src/services/payment/paymentGatewayFactory'

// Mock Prisma Client
jest.mock('@prisma/client')
const mockPrisma = {
  payment: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
    groupBy: jest.fn(),
  },
  paymentSession: {
    create: jest.fn(),
    update: jest.fn(),
  },
  paymentMethod: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
  },
  order: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  orderTimeline: {
    create: jest.fn(),
  },
  refund: {
    create: jest.fn(),
  },
  $transaction: jest.fn(),
} as any

// Mock PaymentGatewayFactory
jest.mock('../../../src/services/payment/paymentGatewayFactory')
const mockGatewayFactory = PaymentGatewayFactory as jest.Mocked<typeof PaymentGatewayFactory>

// Mock order service
jest.mock('../../../src/services/orderService', () => ({
  orderService: {
    getOrderById: jest.fn(),
  },
}))

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}))

// Mock database utility
jest.mock('../../../src/utils/database', () => ({
  prisma: mockPrisma,
}))

describe('PaymentService', () => {
  let paymentService: PaymentService
  let mockGateway: any

  beforeEach(() => {
    paymentService = new PaymentService()
    
    // Setup mock gateway
    mockGateway = {
      initiatePayment: jest.fn(),
      confirmPayment: jest.fn(),
      cancelPayment: jest.fn(),
      refundPayment: jest.fn(),
      getPaymentStatus: jest.fn(),
      generateReceipt: jest.fn(),
      verifyWebhookSignature: jest.fn(),
    }

    mockGatewayFactory.getGateway.mockReturnValue(mockGateway)
    
    // Clear all mocks
    jest.clearAllMocks()
  })

  describe('initiatePayment', () => {
    const mockOrder = {
      id: 'order-1',
      orderNumber: 'ORD-001',
      userId: 'user-1',
      status: 'PENDING',
      totals: {
        total: 50000,
        currency: 'KRW',
      },
    }

    const mockUser = {
      id: 'user-1',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      phone: '010-1234-5678',
    }

    const initiatePaymentInput = {
      orderId: 'order-1',
      gateway: 'STRIPE',
      returnUrl: 'http://localhost:3000/success',
      cancelUrl: 'http://localhost:3000/cancel',
      metadata: { source: 'web' },
    }

    beforeEach(() => {
      // Setup common mocks
      require('../../../src/services/orderService').orderService.getOrderById.mockResolvedValue(mockOrder)
      mockPrisma.payment.findFirst.mockResolvedValue(null) // No existing payment
      mockPrisma.user.findUnique.mockResolvedValue(mockUser)
    })

    it('should successfully initiate payment', async () => {
      const mockPayment = {
        id: 'payment-1',
        orderId: 'order-1',
        amount: 50000,
        currency: 'KRW',
        status: 'PENDING',
        gateway: 'STRIPE',
      }

      const mockGatewayResponse = {
        paymentId: 'stripe-payment-id',
        paymentUrl: 'https://checkout.stripe.com/session',
        sessionData: {
          publishableKey: 'pk_test_123',
        },
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      }

      mockPrisma.$transaction.mockResolvedValue(mockPayment)
      mockGateway.initiatePayment.mockResolvedValue(mockGatewayResponse)

      const result = await paymentService.initiatePayment(initiatePaymentInput)

      expect(result).toEqual({
        ...mockGatewayResponse,
        paymentId: mockPayment.id,
      })

      expect(mockGateway.initiatePayment).toHaveBeenCalledWith({
        orderId: mockOrder.orderNumber,
        amount: mockOrder.totals.total,
        currency: mockOrder.totals.currency,
        customerName: `${mockUser.firstName} ${mockUser.lastName}`,
        customerEmail: mockUser.email,
        customerPhone: mockUser.phone,
        returnUrl: initiatePaymentInput.returnUrl,
        cancelUrl: initiatePaymentInput.cancelUrl,
        metadata: expect.objectContaining({
          paymentId: mockPayment.id,
          ...initiatePaymentInput.metadata,
        }),
      })
    })

    it('should throw error if order not found', async () => {
      require('../../../src/services/orderService').orderService.getOrderById.mockResolvedValue(null)

      await expect(paymentService.initiatePayment(initiatePaymentInput))
        .rejects
        .toThrow('Order not found')
    })

    it('should throw error if order is not in payable status', async () => {
      const completedOrder = { ...mockOrder, status: 'COMPLETED' }
      require('../../../src/services/orderService').orderService.getOrderById.mockResolvedValue(completedOrder)

      await expect(paymentService.initiatePayment(initiatePaymentInput))
        .rejects
        .toThrow('Order is not in payable status')
    })

    it('should throw error if payment already exists', async () => {
      const existingPayment = {
        id: 'existing-payment',
        status: 'PENDING',
      }
      mockPrisma.payment.findFirst.mockResolvedValue(existingPayment)

      await expect(paymentService.initiatePayment(initiatePaymentInput))
        .rejects
        .toThrow('Payment already initiated for this order')
    })

    it('should throw error if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)

      await expect(paymentService.initiatePayment(initiatePaymentInput))
        .rejects
        .toThrow('User not found')
    })
  })

  describe('confirmPayment', () => {
    const mockPayment = {
      id: 'payment-1',
      orderId: 'order-1',
      status: 'PENDING',
      gateway: 'STRIPE',
      order: {
        id: 'order-1',
        orderNumber: 'ORD-001',
        userId: 'user-1',
      },
    }

    const confirmPaymentInput = {
      paymentId: 'payment-1',
      transactionId: 'stripe-tx-123',
      gatewayResponse: {
        status: 'succeeded',
        id: 'stripe-tx-123',
      },
    }

    beforeEach(() => {
      mockPrisma.payment.findUnique.mockResolvedValue(mockPayment)
    })

    it('should successfully confirm payment', async () => {
      const mockGatewayResponse = {
        success: true,
        transactionId: 'stripe-tx-123',
        approvalNumber: 'approval-123',
        rawResponse: { status: 'succeeded' },
      }

      const updatedPayment = {
        ...mockPayment,
        status: 'COMPLETED',
        transactionId: 'stripe-tx-123',
      }

      mockGateway.confirmPayment.mockResolvedValue(mockGatewayResponse)
      mockPrisma.$transaction.mockResolvedValue(updatedPayment)

      // Mock getPaymentWithOrder method
      jest.spyOn(paymentService as any, 'getPaymentWithOrder').mockResolvedValue({
        ...updatedPayment,
        order: mockPayment.order,
      })

      const result = await paymentService.confirmPayment(confirmPaymentInput)

      expect(result.status).toBe('COMPLETED')
      expect(mockGateway.confirmPayment).toHaveBeenCalledWith(
        confirmPaymentInput.transactionId,
        confirmPaymentInput.gatewayResponse
      )
    })

    it('should handle failed payment confirmation', async () => {
      const mockGatewayResponse = {
        success: false,
        errorCode: 'card_declined',
        errorMessage: 'Your card was declined',
        rawResponse: { error: 'card_declined' },
      }

      const updatedPayment = {
        ...mockPayment,
        status: 'FAILED',
      }

      mockGateway.confirmPayment.mockResolvedValue(mockGatewayResponse)
      mockPrisma.$transaction.mockResolvedValue(updatedPayment)

      jest.spyOn(paymentService as any, 'getPaymentWithOrder').mockResolvedValue({
        ...updatedPayment,
        order: mockPayment.order,
      })

      const result = await paymentService.confirmPayment(confirmPaymentInput)

      expect(result.status).toBe('FAILED')
    })

    it('should throw error if payment not found', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(null)

      await expect(paymentService.confirmPayment(confirmPaymentInput))
        .rejects
        .toThrow('Payment not found')
    })

    it('should throw error if payment is not confirmable', async () => {
      const completedPayment = { ...mockPayment, status: 'COMPLETED' }
      mockPrisma.payment.findUnique.mockResolvedValue(completedPayment)

      await expect(paymentService.confirmPayment(confirmPaymentInput))
        .rejects
        .toThrow('Payment is not in confirmable status')
    })
  })

  describe('cancelPayment', () => {
    const mockPayment = {
      id: 'payment-1',
      orderId: 'order-1',
      status: 'PENDING',
      gateway: 'STRIPE',
      transactionId: 'stripe-tx-123',
      metadata: {},
    }

    const cancelPaymentInput = {
      reason: 'CUSTOMER_REQUEST',
      description: 'Customer cancelled the order',
    }

    beforeEach(() => {
      mockPrisma.payment.findUnique.mockResolvedValue(mockPayment)
    })

    it('should successfully cancel payment', async () => {
      const mockGatewayResponse = {
        success: true,
        transactionId: 'stripe-cancel-123',
      }

      const cancelledPayment = {
        ...mockPayment,
        status: 'CANCELLED',
      }

      mockGateway.cancelPayment.mockResolvedValue(mockGatewayResponse)
      mockPrisma.$transaction.mockResolvedValue(cancelledPayment)

      jest.spyOn(paymentService as any, 'getPaymentWithOrder').mockResolvedValue({
        ...cancelledPayment,
        order: { id: 'order-1' },
      })

      const result = await paymentService.cancelPayment('payment-1', cancelPaymentInput)

      expect(result.status).toBe('CANCELLED')
      expect(mockGateway.cancelPayment).toHaveBeenCalledWith(
        mockPayment.transactionId,
        cancelPaymentInput.reason
      )
    })

    it('should throw error if payment not found', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(null)

      await expect(paymentService.cancelPayment('payment-1', cancelPaymentInput))
        .rejects
        .toThrow('Payment not found')
    })

    it('should throw error if payment cannot be cancelled', async () => {
      const completedPayment = { ...mockPayment, status: 'COMPLETED' }
      mockPrisma.payment.findUnique.mockResolvedValue(completedPayment)

      await expect(paymentService.cancelPayment('payment-1', cancelPaymentInput))
        .rejects
        .toThrow('Payment cannot be cancelled in current status')
    })
  })

  describe('refundPayment', () => {
    const mockPayment = {
      id: 'payment-1',
      orderId: 'order-1',
      status: 'COMPLETED',
      gateway: 'STRIPE',
      transactionId: 'stripe-tx-123',
      amount: { toNumber: () => 50000 },
      refundedAmount: { toNumber: () => 0 },
      metadata: {},
    }

    const refundPaymentInput = {
      amount: 25000,
      reason: 'PRODUCT_ISSUE',
      description: 'Product was damaged',
    }

    beforeEach(() => {
      mockPrisma.payment.findUnique.mockResolvedValue(mockPayment)
    })

    it('should successfully process partial refund', async () => {
      const mockGatewayResponse = {
        success: true,
        transactionId: 'refund-tx-123',
        rawResponse: { id: 'refund-tx-123' },
      }

      const refundedPayment = {
        ...mockPayment,
        status: 'PARTIALLY_REFUNDED',
        refundedAmount: { toNumber: () => 25000 },
      }

      mockGateway.refundPayment.mockResolvedValue(mockGatewayResponse)
      mockPrisma.$transaction.mockResolvedValue(refundedPayment)

      jest.spyOn(paymentService as any, 'getPaymentWithOrder').mockResolvedValue({
        ...refundedPayment,
        order: { id: 'order-1' },
      })

      const result = await paymentService.refundPayment('payment-1', refundPaymentInput)

      expect(result.status).toBe('PARTIALLY_REFUNDED')
      expect(mockGateway.refundPayment).toHaveBeenCalledWith({
        paymentId: mockPayment.id,
        transactionId: mockPayment.transactionId,
        amount: refundPaymentInput.amount,
        reason: refundPaymentInput.description,
        metadata: {
          originalPaymentId: mockPayment.id,
          refundReason: refundPaymentInput.reason,
        },
      })
    })

    it('should process full refund', async () => {
      const fullRefundInput = {
        amount: 50000, // Full amount
        reason: 'CUSTOMER_REQUEST',
        description: 'Full refund requested',
      }

      const mockGatewayResponse = {
        success: true,
        transactionId: 'refund-tx-456',
        rawResponse: { id: 'refund-tx-456' },
      }

      const refundedPayment = {
        ...mockPayment,
        status: 'REFUNDED',
        refundedAmount: { toNumber: () => 50000 },
      }

      mockGateway.refundPayment.mockResolvedValue(mockGatewayResponse)
      mockPrisma.$transaction.mockResolvedValue(refundedPayment)

      jest.spyOn(paymentService as any, 'getPaymentWithOrder').mockResolvedValue({
        ...refundedPayment,
        order: { id: 'order-1' },
      })

      const result = await paymentService.refundPayment('payment-1', fullRefundInput)

      expect(result.status).toBe('REFUNDED')
    })

    it('should throw error if payment not found', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(null)

      await expect(paymentService.refundPayment('payment-1', refundPaymentInput))
        .rejects
        .toThrow('Payment not found')
    })

    it('should throw error if payment is not completed', async () => {
      const pendingPayment = { ...mockPayment, status: 'PENDING' }
      mockPrisma.payment.findUnique.mockResolvedValue(pendingPayment)

      await expect(paymentService.refundPayment('payment-1', refundPaymentInput))
        .rejects
        .toThrow('Only completed payments can be refunded')
    })

    it('should throw error if refund amount exceeds remaining amount', async () => {
      const partiallyRefundedPayment = {
        ...mockPayment,
        refundedAmount: { toNumber: () => 30000 },
      }
      mockPrisma.payment.findUnique.mockResolvedValue(partiallyRefundedPayment)

      const largeRefundInput = {
        amount: 30000, // Would exceed remaining 20000
        reason: 'CUSTOMER_REQUEST',
        description: 'Large refund',
      }

      await expect(paymentService.refundPayment('payment-1', largeRefundInput))
        .rejects
        .toThrow('Maximum refundable amount is 20000')
    })

    it('should throw error if gateway refund fails', async () => {
      const mockGatewayResponse = {
        success: false,
        errorCode: 'refund_failed',
        errorMessage: 'Refund not allowed for this payment',
      }

      mockGateway.refundPayment.mockResolvedValue(mockGatewayResponse)

      await expect(paymentService.refundPayment('payment-1', refundPaymentInput))
        .rejects
        .toThrow('Refund not allowed for this payment')
    })
  })

  describe('getPayments', () => {
    it('should get payments with filters and pagination', async () => {
      const mockPayments = [
        {
          id: 'payment-1',
          orderId: 'order-1',
          amount: { toNumber: () => 50000 },
          status: 'COMPLETED',
          gateway: 'STRIPE',
          order: {
            id: 'order-1',
            orderNumber: 'ORD-001',
            userId: 'user-1',
            total: { toNumber: () => 50000 },
            status: 'CONFIRMED',
            user: {
              id: 'user-1',
              firstName: 'Test',
              lastName: 'User',
              email: 'test@example.com',
            },
          },
        },
      ]

      const queryInput = {
        page: 1,
        limit: 10,
        status: 'COMPLETED' as any,
        gateway: 'STRIPE',
        sortBy: 'createdAt',
        sortOrder: 'desc' as any,
      }

      mockPrisma.payment.findMany.mockResolvedValue(mockPayments)
      mockPrisma.payment.count.mockResolvedValue(1)

      const result = await paymentService.getPayments(queryInput)

      expect(result.payments).toHaveLength(1)
      expect(result.pagination.total).toBe(1)
      expect(result.pagination.page).toBe(1)
      expect(result.pagination.limit).toBe(10)
      expect(result.pagination.totalPages).toBe(1)
    })
  })

  describe('savePaymentMethod', () => {
    const savePaymentMethodInput = {
      type: 'CREDIT_CARD' as any,
      provider: 'STRIPE',
      token: 'pm_1234567890',
      last4: '4242',
      expiryMonth: 12,
      expiryYear: 2025,
      brand: 'visa',
      holderName: 'Test User',
      isDefault: true,
    }

    it('should successfully save payment method', async () => {
      const mockPaymentMethod = {
        id: 'pm-1',
        userId: 'user-1',
        ...savePaymentMethodInput,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockPrisma.paymentMethod.updateMany.mockResolvedValue({ count: 0 })
      mockPrisma.paymentMethod.create.mockResolvedValue(mockPaymentMethod)

      const result = await paymentService.savePaymentMethod('user-1', savePaymentMethodInput)

      expect(result.type).toBe('CREDIT_CARD')
      expect(result.isDefault).toBe(true)
      expect(mockPrisma.paymentMethod.updateMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          isDefault: true,
        },
        data: {
          isDefault: false,
        },
      })
    })
  })

  describe('generateReceipt', () => {
    it('should generate payment receipt', async () => {
      const mockPayment = {
        id: 'payment-1',
        status: 'COMPLETED',
        transactionId: 'stripe-tx-123',
        gateway: 'STRIPE',
        order: {
          items: [],
          addresses: [],
          user: {},
        },
      }

      const mockReceipt = {
        paymentId: 'payment-1',
        receiptNumber: 'ST-stripe-tx-123',
        issuedAt: new Date(),
        amount: 50000,
        currency: 'KRW',
        taxAmount: 0,
        items: [],
        customerInfo: {
          name: 'Test User',
          email: 'test@example.com',
        },
        paymentInfo: {
          method: 'card',
          transactionId: 'stripe-tx-123',
          approvalNumber: 'stripe-tx-123',
        },
      }

      mockPrisma.payment.findUnique.mockResolvedValue(mockPayment)
      mockGateway.generateReceipt.mockResolvedValue(mockReceipt)

      const result = await paymentService.generateReceipt('payment-1')

      expect(result).toEqual(mockReceipt)
      expect(mockGateway.generateReceipt).toHaveBeenCalledWith('payment-1', 'stripe-tx-123')
    })

    it('should throw error if payment not found', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(null)

      await expect(paymentService.generateReceipt('payment-1'))
        .rejects
        .toThrow('Payment not found')
    })

    it('should throw error if payment not completed', async () => {
      const mockPayment = {
        id: 'payment-1',
        status: 'PENDING',
        transactionId: null,
      }

      mockPrisma.payment.findUnique.mockResolvedValue(mockPayment)

      await expect(paymentService.generateReceipt('payment-1'))
        .rejects
        .toThrow('Receipt only available for completed payments')
    })
  })
})