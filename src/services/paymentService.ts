import { Prisma } from '@prisma/client'
import { prisma } from '../utils/database'
import { logger } from '../utils/logger'
import { AppError } from '../middleware/error'
import { orderService } from './orderService'
import { PaymentGatewayFactory } from './payment/paymentGatewayFactory'
import {
  InitiatePaymentInput,
  ConfirmPaymentInput,
  CancelPaymentInput,
  RefundPaymentInput,
  PaymentQueryInput,
  SavePaymentMethodInput,
  PaymentDetails,
  PaymentWithOrder,
  PaymentMethod,
  PaymentInitiationResponse,
  PaymentAnalytics,
  PaymentReceipt,
} from '../types/payment'

export class PaymentService {
  // Initiate payment for order
  async initiatePayment(data: InitiatePaymentInput): Promise<PaymentInitiationResponse> {
    try {
      // Get order details
      const order = await orderService.getOrderById(data.orderId)

      if (!order) {
        throw new AppError('Order not found', 404)
      }

      if (order.status !== 'PENDING' && order.status !== 'CONFIRMED') {
        throw new AppError('Order is not in payable status', 400)
      }

      // Check if payment already exists
      const existingPayment = await prisma.payment.findFirst({
        where: {
          orderId: data.orderId,
          status: {
            in: ['PENDING', 'PROCESSING', 'COMPLETED'],
          },
        },
      })

      if (existingPayment) {
        throw new AppError('Payment already initiated for this order', 409)
      }

      // Get user info
      const user = await prisma.user.findUnique({
        where: { id: order.userId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
        },
      })

      if (!user) {
        throw new AppError('User not found', 404)
      }

      // Get payment gateway
      const gateway = PaymentGatewayFactory.getGateway(data.gateway)

      // Create payment record
      const payment = await prisma.$transaction(async (tx) => {
        const createdPayment = await tx.payment.create({
          data: {
            orderId: data.orderId,
            amount: order.totals.total,
            currency: order.totals.currency,
            status: 'PENDING',
            method: this.mapGatewayToPaymentMethod(data.gateway),
            gateway: data.gateway,
          },
        })

        // Store session data in payment gatewayResponse for now since paymentSession table doesn't exist
        await tx.payment.update({
          where: { id: createdPayment.id },
          data: {
            gatewayResponse: {
              sessionId: `session_${createdPayment.id}`,
              expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
            } as unknown as Prisma.JsonObject,
          },
        })

        return createdPayment
      })

      // Initiate payment with gateway
      const paymentRequest = {
        orderId: order.orderNumber,
        amount: order.totals.total,
        currency: order.totals.currency,
        customerName: `${user.firstName} ${user.lastName}`,
        customerEmail: user.email,
        customerPhone: user.phone || undefined,
        returnUrl: data.returnUrl,
        cancelUrl: data.cancelUrl,
        metadata: {
          paymentId: payment.id,
          ...data.metadata,
        },
      }

      const gatewayResponse = await gateway.initiatePayment(paymentRequest)

      // Update payment with gateway session data
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          gatewayResponse: {
            ...gatewayResponse.sessionData,
            expiresAt: gatewayResponse.expiresAt?.toISOString(),
          } as unknown as Prisma.JsonObject,
        },
      })

      logger.info(`Payment initiated: ${payment.id} for order: ${data.orderId}`)

      return {
        ...gatewayResponse,
        paymentId: payment.id,
      }
    } catch (error) {
      logger.error('Error initiating payment:', error)
      throw error
    }
  }

  // Confirm payment after return from gateway
  async confirmPayment(data: ConfirmPaymentInput): Promise<PaymentWithOrder> {
    const payment = await prisma.payment.findUnique({
      where: { id: data.paymentId },
      include: {
        order: true,
      },
    })

    if (!payment) {
      throw new AppError('Payment not found', 404)
    }

    if (payment.status !== 'PENDING' && payment.status !== 'PROCESSING') {
      throw new AppError('Payment is not in confirmable status', 400)
    }

    // Get payment gateway
    const gateway = PaymentGatewayFactory.getGateway(payment.gateway)

    // Confirm with gateway
    const gatewayResponse = await gateway.confirmPayment(data.transactionId, data.gatewayResponse)

    const updatedPayment = await prisma.$transaction(async (tx) => {
      if (gatewayResponse.success) {
        // Update payment as completed
        const updated = await tx.payment.update({
          where: { id: data.paymentId },
          data: {
            status: 'COMPLETED',
            transactionId: gatewayResponse.transactionId,
            gatewayResponse: gatewayResponse.rawResponse as Prisma.JsonObject,
            processedAt: new Date(),
          },
        })

        // Update order status
        await tx.order.update({
          where: { id: payment.orderId },
          data: {
            status: 'CONFIRMED',
          },
        })

        // Create order status history event
        await tx.orderStatusHistory.create({
          data: {
            orderId: payment.orderId,
            status: 'CONFIRMED',
            notes: `Payment completed via ${payment.gateway}`,
          },
        })

        return updated
      } else {
        // Update payment as failed
        return await tx.payment.update({
          where: { id: data.paymentId },
          data: {
            status: 'FAILED',
            gatewayResponse: {
              errorCode: gatewayResponse.errorCode,
              errorMessage: gatewayResponse.errorMessage,
              ...(gatewayResponse.rawResponse as Prisma.JsonObject || {}),
            } as Prisma.JsonObject,
          },
        })
      }
    })

    logger.info(`Payment confirmed: ${data.paymentId}, status: ${updatedPayment.status}`)
    return this.getPaymentWithOrder(updatedPayment.id)
  }

  // Cancel payment
  async cancelPayment(id: string, data: CancelPaymentInput): Promise<PaymentWithOrder> {
    const payment = await prisma.payment.findUnique({
      where: { id },
    })

    if (!payment) {
      throw new AppError('Payment not found', 404)
    }

    if (!['PENDING', 'PROCESSING'].includes(payment.status)) {
      throw new AppError('Payment cannot be cancelled in current status', 400)
    }

    // Get payment gateway
    const gateway = PaymentGatewayFactory.getGateway(payment.gateway)

    // Cancel with gateway if transaction exists
    if (payment.transactionId) {
      await gateway.cancelPayment(payment.transactionId, data.reason)
    }

    await prisma.$transaction(async (tx) => {
      const updated = await tx.payment.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          gatewayResponse: {
            cancellationReason: data.reason,
            cancellationDescription: data.description,
            cancelledAt: new Date().toISOString(),
          } as unknown as Prisma.JsonObject,
        },
      })

      // Create order status history event
      await tx.orderStatusHistory.create({
        data: {
          orderId: payment.orderId,
          status: 'CANCELLED',
          notes: `Payment cancelled: ${data.reason}`,
        },
      })

      return updated
    })

    logger.info(`Payment cancelled: ${id}, reason: ${data.reason}`)
    return this.getPaymentWithOrder(id)
  }

  // Process refund
  async refundPayment(id: string, data: RefundPaymentInput): Promise<PaymentWithOrder> {
    const payment = await prisma.payment.findUnique({
      where: { id },
    })

    if (!payment) {
      throw new AppError('Payment not found', 404)
    }

    if (payment.status !== 'COMPLETED') {
      throw new AppError('Only completed payments can be refunded', 400)
    }

    if (!payment.transactionId) {
      throw new AppError('No transaction ID found for refund', 400)
    }

    // Calculate refundable amount
    const maxRefundAmount = payment.amount.toNumber()

    if (data.amount > maxRefundAmount) {
      throw new AppError(`Maximum refundable amount is ${maxRefundAmount}`, 400)
    }

    // Get payment gateway
    const gateway = PaymentGatewayFactory.getGateway(payment.gateway)

    // Process refund with gateway
    const refundRequest = {
      paymentId: payment.id,
      transactionId: payment.transactionId,
      amount: data.amount,
      reason: data.description || data.reason,
      metadata: {
        originalPaymentId: payment.id,
        refundReason: data.reason,
      },
    }

    const gatewayResponse = await gateway.refundPayment(refundRequest)

    if (!gatewayResponse.success) {
      throw new AppError(
        gatewayResponse.errorMessage || 'Refund failed at payment gateway',
        400,
      )
    }

    await prisma.$transaction(async (tx) => {
      const isFullRefund = data.amount === maxRefundAmount

      const updated = await tx.payment.update({
        where: { id },
        data: {
          status: isFullRefund ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
          gatewayResponse: {
            refunds: [
              {
                amount: data.amount,
                reason: data.reason,
                description: data.description,
                transactionId: gatewayResponse.transactionId,
                processedAt: new Date().toISOString(),
              },
            ],
          } as unknown as Prisma.JsonObject,
        },
      })

      // Update order status if fully refunded
      if (isFullRefund) {
        await tx.order.update({
          where: { id: payment.orderId },
          data: {
            status: 'REFUNDED',
          },
        })
      }

      // Create order status history event
      await tx.orderStatusHistory.create({
        data: {
          orderId: payment.orderId,
          status: isFullRefund ? 'REFUNDED' : 'PENDING',
          notes: isFullRefund
            ? `Payment fully refunded: ${data.amount} ${payment.currency}`
            : `Partial refund processed: ${data.amount} ${payment.currency}`,
        },
      })

      return updated
    })

    logger.info(`Payment refunded: ${id}, amount: ${data.amount}`)
    return this.getPaymentWithOrder(id)
  }

  // Get payment by ID
  async getPaymentById(id: string): Promise<PaymentWithOrder> {
    return this.getPaymentWithOrder(id)
  }

  // Get payments with filters
  async getPayments(query: PaymentQueryInput): Promise<{
    payments: PaymentWithOrder[]
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
    }
  }> {
    const { page, limit, orderId, userId, status, gateway, fromDate, toDate, sortBy, sortOrder } = query

    const where: Prisma.PaymentWhereInput = {}

    if (orderId) {
      where.orderId = orderId
    }

    if (userId) {
      where.order = {
        userId,
      }
    }

    if (status) {
      where.status = status
    }

    if (gateway) {
      where.gateway = gateway
    }

    if (fromDate || toDate) {
      where.createdAt = {}
      if (fromDate) {
        where.createdAt.gte = new Date(fromDate)
      }
      if (toDate) {
        where.createdAt.lte = new Date(toDate)
      }
    }

    const skip = (page - 1) * limit

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          order: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
        },
      }),
      prisma.payment.count({ where }),
    ])

    const paymentsWithOrder = payments.map(payment => this.formatPaymentWithOrder(payment))

    return {
      payments: paymentsWithOrder,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }
  }

  // Save payment method
  async savePaymentMethod(userId: string, data: SavePaymentMethodInput): Promise<PaymentMethod> {
    // If setting as default, unset other defaults
    if (data.isDefault) {
      await prisma.paymentMethod.updateMany({
        where: {
          userId,
          isDefault: true,
        },
        data: {
          isDefault: false,
        },
      })
    }

    const paymentMethod = await prisma.paymentMethod.create({
      data: {
        userId,
        type: this.mapToValidPaymentMethodType(data.type),
        provider: data.provider,
        last4: data.last4,
        expiryMonth: data.expiryMonth,
        expiryYear: data.expiryYear,
        brand: data.brand,
        isDefault: data.isDefault,
      },
    })

    logger.info(`Payment method saved for user: ${userId}`)
    return this.formatPaymentMethod(paymentMethod)
  }

  // Get user payment methods
  async getUserPaymentMethods(userId: string): Promise<PaymentMethod[]> {
    const methods = await prisma.paymentMethod.findMany({
      where: { userId },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' },
      ],
    })

    return methods.map(method => this.formatPaymentMethod(method))
  }

  // Delete payment method
  async deletePaymentMethod(id: string, userId: string): Promise<void> {
    const method = await prisma.paymentMethod.findFirst({
      where: { id, userId },
    })

    if (!method) {
      throw new AppError('Payment method not found', 404)
    }

    await prisma.paymentMethod.delete({
      where: { id },
    })

    logger.info(`Payment method deleted: ${id}`)
  }

  // Generate payment receipt
  async generateReceipt(paymentId: string): Promise<PaymentReceipt> {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        order: {
          include: {
            items: {
              include: {
                product: true,
              },
            },
            shippingAddress: true,
            billingAddress: true,
            user: true,
          },
        },
      },
    })

    if (!payment) {
      throw new AppError('Payment not found', 404)
    }

    if (payment.status !== 'COMPLETED' || !payment.transactionId) {
      throw new AppError('Receipt only available for completed payments', 400)
    }

    // Get gateway to generate receipt
    const gateway = PaymentGatewayFactory.getGateway(payment.gateway)
    return gateway.generateReceipt(payment.id, payment.transactionId)
  }

  // Get payment analytics
  async getPaymentAnalytics(userId?: string): Promise<PaymentAnalytics> {
    const where: Prisma.PaymentWhereInput = userId
      ? { order: { userId } }
      : {}

    const [totalPayments, paymentStats] = await Promise.all([
      prisma.payment.count({ where }),
      prisma.payment.aggregate({
        where,
        _sum: {
          amount: true,
        },
        _avg: {
          amount: true,
        },
      }),
    ])

    // Get payments by status
    const paymentsByStatus = await prisma.payment.groupBy({
      by: ['status'],
      where,
      _count: {
        status: true,
      },
      _sum: {
        amount: true,
      },
    })

    // Get payments by gateway
    const paymentsByGateway = await prisma.payment.groupBy({
      by: ['gateway'],
      where,
      _count: {
        gateway: true,
      },
      _sum: {
        amount: true,
      },
    })

    // Calculate success rates by gateway
    const gatewayStats = await Promise.all(
      paymentsByGateway.map(async (gw) => {
        const successCount = await prisma.payment.count({
          where: {
            ...where,
            gateway: gw.gateway,
            status: 'COMPLETED',
          },
        })

        return {
          gateway: gw.gateway,
          count: gw._count.gateway,
          amount: gw._sum.amount?.toNumber() || 0,
          successRate: gw._count.gateway > 0
            ? (successCount / gw._count.gateway) * 100
            : 0,
        }
      }),
    )

    // Get recent payments
    const recentPayments = await prisma.payment.findMany({
      where,
      take: 10,
      orderBy: { createdAt: 'desc' },
    })

    return {
      totalPayments,
      totalAmount: paymentStats._sum.amount?.toNumber() || 0,
      averagePaymentAmount: paymentStats._avg.amount?.toNumber() || 0,
      paymentsByStatus: paymentsByStatus.map(ps => ({
        status: ps.status,
        count: ps._count.status,
        amount: ps._sum.amount?.toNumber() || 0,
      })),
      paymentsByGateway: gatewayStats,
      recentPayments: recentPayments.map(payment => this.formatPaymentDetails(payment)),
    }
  }

  // Process webhook from payment gateway
  async processWebhook(gateway: string, payload: any, signature?: string): Promise<void> {
    const paymentGateway = PaymentGatewayFactory.getGateway(gateway)

    // Verify webhook signature
    if (signature && !paymentGateway.verifyWebhookSignature(payload, signature)) {
      throw new AppError('Invalid webhook signature', 401)
    }

    // Process webhook based on gateway type
    // Implementation depends on specific gateway webhook format
    logger.info(`Webhook processed for gateway: ${gateway}`)
  }

  // Private helper methods
  private async getPaymentWithOrder(paymentId: string): Promise<PaymentWithOrder> {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        order: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    })

    if (!payment) {
      throw new AppError('Payment not found', 404)
    }

    return this.formatPaymentWithOrder(payment)
  }

  private formatPaymentWithOrder(payment: any): PaymentWithOrder {
    return {
      id: payment.id,
      orderId: payment.orderId,
      amount: payment.amount.toNumber(),
      currency: payment.currency,
      status: payment.status,
      gateway: payment.gateway,
      method: payment.method || undefined,
      transactionId: payment.transactionId || undefined,
      gatewayResponse: payment.gatewayResponse as Record<string, any>,
      processedAt: payment.processedAt || undefined,
      metadata: payment.metadata as Record<string, any>,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
      order: {
        id: payment.order.id,
        orderNumber: payment.order.orderNumber,
        userId: payment.order.userId,
        total: payment.order.total.toNumber(),
        status: payment.order.status,
        customer: {
          id: payment.order.user.id,
          firstName: payment.order.user.firstName || '',
          lastName: payment.order.user.lastName || '',
          email: payment.order.user.email,
        },
      },
    }
  }

  private formatPaymentDetails(payment: any): PaymentDetails {
    return {
      id: payment.id,
      orderId: payment.orderId,
      amount: payment.amount.toNumber(),
      currency: payment.currency,
      status: payment.status,
      gateway: payment.gateway,
      method: payment.method || undefined,
      transactionId: payment.transactionId || undefined,
      gatewayResponse: payment.gatewayResponse as Record<string, any>,
      processedAt: payment.processedAt || undefined,
      metadata: payment.metadata as Record<string, any>,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    }
  }

  private formatPaymentMethod(method: any): PaymentMethod {
    const currentYear = new Date().getFullYear()
    const currentMonth = new Date().getMonth() + 1

    const isExpired = method.expiryYear && method.expiryMonth
      ? method.expiryYear < currentYear ||
        (method.expiryYear === currentYear && method.expiryMonth < currentMonth)
      : false

    return {
      id: method.id,
      userId: method.userId,
      type: method.type,
      provider: method.provider,
      last4: method.last4 || undefined,
      expiryMonth: method.expiryMonth || undefined,
      expiryYear: method.expiryYear || undefined,
      brand: method.brand || undefined,
      isDefault: method.isDefault,
      isExpired,
      createdAt: method.createdAt,
      updatedAt: method.updatedAt,
    }
  }

  /**
   * Map gateway name to PaymentMethodType enum
   */
  private mapGatewayToPaymentMethod(gateway: string): 'CREDIT_CARD' | 'DEBIT_CARD' | 'PAYPAL' | 'BANK_TRANSFER' | 'APPLE_PAY' | 'GOOGLE_PAY' | 'CRYPTOCURRENCY' {
    switch (gateway.toUpperCase()) {
    case 'PAYPAL':
      return 'PAYPAL'
    case 'STRIPE':
      return 'CREDIT_CARD'
    case 'APPLE_PAY':
      return 'APPLE_PAY'
    case 'GOOGLE_PAY':
      return 'GOOGLE_PAY'
    case 'BANK_TRANSFER':
      return 'BANK_TRANSFER'
    default:
      return 'CREDIT_CARD'
    }
  }

  /**
   * Map any payment method type to valid PaymentMethodType enum
   */
  private mapToValidPaymentMethodType(type: string): 'CREDIT_CARD' | 'DEBIT_CARD' | 'PAYPAL' | 'BANK_TRANSFER' | 'APPLE_PAY' | 'GOOGLE_PAY' | 'CRYPTOCURRENCY' {
    switch (type.toUpperCase()) {
    case 'CREDIT_CARD':
      return 'CREDIT_CARD'
    case 'DEBIT_CARD':
      return 'DEBIT_CARD'
    case 'PAYPAL':
      return 'PAYPAL'
    case 'BANK_TRANSFER':
      return 'BANK_TRANSFER'
    case 'APPLE_PAY':
      return 'APPLE_PAY'
    case 'GOOGLE_PAY':
      return 'GOOGLE_PAY'
    case 'DIGITAL_WALLET': // Map DIGITAL_WALLET to APPLE_PAY
      return 'APPLE_PAY'
    case 'CRYPTOCURRENCY':
      return 'CRYPTOCURRENCY'
    default:
      return 'CREDIT_CARD'
    }
  }
}

export const paymentService = new PaymentService()
