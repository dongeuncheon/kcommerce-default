import { prisma } from '../../utils/database'
import { logger } from '../../utils/logger'
import { AppError } from '../../middleware/error'
import { PaymentGatewayFactory } from './paymentGatewayFactory'

export interface WebhookPayload {
  gateway: string
  event: string
  data: any
  signature?: string
  timestamp?: Date
}

export class WebhookService {
  /**
   * Process webhook from payment gateway
   */
  async processWebhook(payload: WebhookPayload): Promise<void> {
    try {
      const gateway = PaymentGatewayFactory.getGateway(payload.gateway)

      // Verify webhook signature if provided
      if (payload.signature && !gateway.verifyWebhookSignature(payload.data, payload.signature)) {
        throw new AppError('Invalid webhook signature', 401)
      }

      // Log webhook for debugging
      await this.logWebhook(payload)

      // Process based on gateway type
      switch (payload.gateway.toUpperCase()) {
        case 'STRIPE':
          await this.processStripeWebhook(payload)
          break
        case 'TOSS_PAYMENTS':
          await this.processTossPaymentsWebhook(payload)
          break
        case 'INICIS':
          await this.processInicisWebhook(payload)
          break
        case 'KCP':
          await this.processKcpWebhook(payload)
          break
        case 'PAYPAL':
          await this.processPayPalWebhook(payload)
          break
        default:
          logger.warn(`Unknown gateway webhook: ${payload.gateway}`)
      }

      logger.info(`Webhook processed successfully for ${payload.gateway}: ${payload.event}`)
    } catch (error) {
      logger.error('Webhook processing failed:', error)
      throw error
    }
  }

  /**
   * Process Stripe webhook events
   */
  private async processStripeWebhook(payload: WebhookPayload): Promise<void> {
    const { event, data } = payload

    switch (event) {
      case 'payment_intent.succeeded':
        await this.handlePaymentSuccess(data.object, 'STRIPE')
        break
      case 'payment_intent.payment_failed':
        await this.handlePaymentFailed(data.object, 'STRIPE')
        break
      case 'charge.dispute.created':
        await this.handleChargeback(data.object, 'STRIPE')
        break
      case 'invoice.payment_succeeded':
        await this.handleRecurringPaymentSuccess(data.object, 'STRIPE')
        break
      default:
        logger.info(`Unhandled Stripe event: ${event}`)
    }
  }

  /**
   * Process TossPayments webhook events
   */
  private async processTossPaymentsWebhook(payload: WebhookPayload): Promise<void> {
    const { event, data } = payload

    switch (event) {
      case 'PAYMENT_COMPLETED':
        await this.handlePaymentSuccess(data, 'TOSS_PAYMENTS')
        break
      case 'PAYMENT_FAILED':
        await this.handlePaymentFailed(data, 'TOSS_PAYMENTS')
        break
      case 'PAYMENT_CANCELLED':
        await this.handlePaymentCancelled(data, 'TOSS_PAYMENTS')
        break
      default:
        logger.info(`Unhandled TossPayments event: ${event}`)
    }
  }

  /**
   * Process Inicis webhook events
   */
  private async processInicisWebhook(payload: WebhookPayload): Promise<void> {
    const { data } = payload

    // Inicis typically sends result codes in data
    if (data.resultCode === '0000') {
      await this.handlePaymentSuccess(data, 'INICIS')
    } else {
      await this.handlePaymentFailed(data, 'INICIS')
    }
  }

  /**
   * Process KCP webhook events
   */
  private async processKcpWebhook(payload: WebhookPayload): Promise<void> {
    const { data } = payload

    // KCP sends result codes in data
    if (data.res_cd === '0000') {
      await this.handlePaymentSuccess(data, 'KCP')
    } else {
      await this.handlePaymentFailed(data, 'KCP')
    }
  }

  /**
   * Process PayPal webhook events
   */
  private async processPayPalWebhook(payload: WebhookPayload): Promise<void> {
    const { event, data } = payload

    switch (event) {
      case 'PAYMENT.CAPTURE.COMPLETED':
        await this.handlePaymentSuccess(data, 'PAYPAL')
        break
      case 'PAYMENT.CAPTURE.DENIED':
        await this.handlePaymentFailed(data, 'PAYPAL')
        break
      case 'PAYMENT.CAPTURE.REFUNDED':
        await this.handleRefundCompleted(data, 'PAYPAL')
        break
      default:
        logger.info(`Unhandled PayPal event: ${event}`)
    }
  }

  /**
   * Handle successful payment
   */
  private async handlePaymentSuccess(data: any, gateway: string): Promise<void> {
    try {
      // Find payment by transaction ID or metadata
      const payment = await this.findPaymentByGatewayData(data, gateway)
      
      if (!payment) {
        logger.warn(`Payment not found for successful webhook from ${gateway}`)
        return
      }

      if (payment.status === 'COMPLETED') {
        logger.info(`Payment ${payment.id} already completed`)
        return
      }

      // Update payment status
      await prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: 'COMPLETED',
            processedAt: new Date(),
            gatewayResponse: data,
          },
        })

        // Update order status
        await tx.order.update({
          where: { id: payment.orderId },
          data: {
            status: 'CONFIRMED',
          },
        })

        // Create timeline event using order status history
        await tx.orderStatusHistory.create({
          data: {
            orderId: payment.orderId,
            status: 'CONFIRMED',
            notes: `Payment completed via webhook from ${gateway}`,
          },
        })
      })

      logger.info(`Payment ${payment.id} marked as completed via webhook`)
    } catch (error) {
      logger.error('Error handling payment success webhook:', error)
      throw error
    }
  }

  /**
   * Handle failed payment
   */
  private async handlePaymentFailed(data: any, gateway: string): Promise<void> {
    try {
      const payment = await this.findPaymentByGatewayData(data, gateway)
      
      if (!payment) {
        logger.warn(`Payment not found for failed webhook from ${gateway}`)
        return
      }

      if (payment.status === 'FAILED') {
        logger.info(`Payment ${payment.id} already marked as failed`)
        return
      }

      // Update payment status
      await prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: 'FAILED',
            gatewayResponse: data,
          },
        })

        // Create timeline event
        await tx.orderStatusHistory.create({
          data: {
            orderId: payment.orderId,
            status: 'CANCELLED',
            notes: `Payment failed via webhook from ${gateway}`,
          },
        })
      })

      logger.info(`Payment ${payment.id} marked as failed via webhook`)
    } catch (error) {
      logger.error('Error handling payment failure webhook:', error)
      throw error
    }
  }

  /**
   * Handle payment cancellation
   */
  private async handlePaymentCancelled(data: any, gateway: string): Promise<void> {
    try {
      const payment = await this.findPaymentByGatewayData(data, gateway)
      
      if (!payment) {
        logger.warn(`Payment not found for cancellation webhook from ${gateway}`)
        return
      }

      await prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: 'CANCELLED',
            gatewayResponse: data,
          },
        })

        await tx.orderStatusHistory.create({
          data: {
            orderId: payment.orderId,
            status: 'CANCELLED',
            notes: `Payment cancelled via webhook from ${gateway}`,
          },
        })
      })

      logger.info(`Payment ${payment.id} marked as cancelled via webhook`)
    } catch (error) {
      logger.error('Error handling payment cancellation webhook:', error)
      throw error
    }
  }

  /**
   * Handle chargeback notification
   */
  private async handleChargeback(data: any, gateway: string): Promise<void> {
    try {
      const payment = await this.findPaymentByGatewayData(data, gateway)
      
      if (!payment) {
        logger.warn(`Payment not found for chargeback webhook from ${gateway}`)
        return
      }

      await prisma.$transaction(async (tx) => {
        // Create timeline event using order status history
        await tx.orderStatusHistory.create({
          data: {
            orderId: payment.orderId,
            status: 'PENDING', // Keep order status as pending during dispute
            notes: `Chargeback initiated: ${data.reason || 'Unknown reason'}`,
          },
        })
      })

      logger.warn(`Chargeback created for payment ${payment.id}`)
    } catch (error) {
      logger.error('Error handling chargeback webhook:', error)
      throw error
    }
  }

  /**
   * Handle recurring payment success
   */
  private async handleRecurringPaymentSuccess(_data: any, _gateway: string): Promise<void> {
    try {
      // Handle subscription payment success
      // This would be implemented based on subscription requirements
      logger.info(`Recurring payment succeeded for ${_gateway}`)
    } catch (error) {
      logger.error('Error handling recurring payment webhook:', error)
      throw error
    }
  }

  /**
   * Handle refund completion
   */
  private async handleRefundCompleted(data: any, gateway: string): Promise<void> {
    try {
      const payment = await this.findPaymentByGatewayData(data, gateway)
      
      if (!payment) {
        logger.warn(`Payment not found for refund webhook from ${gateway}`)
        return
      }

      const refundAmount = this.extractRefundAmount(data, gateway)

      await prisma.$transaction(async (tx) => {
        // Update payment status
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: refundAmount >= payment.amount.toNumber() ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
            gatewayResponse: data,
          },
        })

        // Create timeline event using order status history
        await tx.orderStatusHistory.create({
          data: {
            orderId: payment.orderId,
            status: 'REFUNDED',
            notes: `Refund completed: ${refundAmount}`,
          },
        })
      })

      logger.info(`Refund processed for payment ${payment.id}: ${refundAmount}`)
    } catch (error) {
      logger.error('Error handling refund webhook:', error)
      throw error
    }
  }

  /**
   * Find payment by gateway-specific data
   */
  private async findPaymentByGatewayData(data: any, gateway: string): Promise<any> {
    let where: any = {}

    switch (gateway.toUpperCase()) {
      case 'STRIPE':
        where = {
          OR: [
            { transactionId: data.id },
            { metadata: { path: ['stripePaymentIntentId'], equals: data.id } },
          ],
        }
        break
      case 'TOSS_PAYMENTS':
        where = {
          OR: [
            { transactionId: data.paymentKey },
            { metadata: { path: ['orderId'], equals: data.orderId } },
          ],
        }
        break
      case 'INICIS':
        where = {
          OR: [
            { transactionId: data.tid },
            { metadata: { path: ['oid'], equals: data.oid } },
          ],
        }
        break
      case 'KCP':
        where = {
          OR: [
            { transactionId: data.tno },
            { metadata: { path: ['ordr_idxx'], equals: data.ordr_idxx } },
          ],
        }
        break
      case 'PAYPAL':
        where = {
          OR: [
            { transactionId: data.id },
            { metadata: { path: ['paypalOrderId'], equals: data.id } },
          ],
        }
        break
    }

    return await prisma.payment.findFirst({ where })
  }

  /**
   * Extract failure reason from gateway data (currently unused)
   */
  /*
  private _extractFailureReason(data: any, gateway: string): string {
    switch (gateway.toUpperCase()) {
      case 'STRIPE':
        return data.last_payment_error?.message || 'Payment failed'
      case 'TOSS_PAYMENTS':
        return data.message || 'Payment failed'
      case 'INICIS':
        return data.resultMsg || 'Payment failed'
      case 'KCP':
        return data.res_msg || 'Payment failed'
      case 'PAYPAL':
        return data.reason || 'Payment failed'
      default:
        return 'Payment failed'
    }
  }

  /**
   * Extract refund amount from gateway data
   */
  private extractRefundAmount(data: any, gateway: string): number {
    switch (gateway.toUpperCase()) {
      case 'STRIPE':
        return data.amount / 100 // Stripe uses cents
      case 'TOSS_PAYMENTS':
        return data.cancelAmount
      case 'PAYPAL':
        return parseFloat(data.amount.value)
      default:
        return 0
    }
  }

  /**
   * Extract refund transaction ID from gateway data (currently unused)
   */
  /*
  private _extractRefundTransactionId(data: any, gateway: string): string {
    switch (gateway.toUpperCase()) {
      case 'STRIPE':
        return data.id
      case 'TOSS_PAYMENTS':
        return data.transactionKey
      case 'PAYPAL':
        return data.id
      default:
        return `${gateway}_${Date.now()}`
    }
  }
  */

  /**
   * Log webhook for debugging and audit
   */
  private async logWebhook(payload: WebhookPayload): Promise<void> {
    try {
      // Log webhook using audit log service since webhookLog table doesn't exist
      logger.info('Webhook processed', {
        gateway: payload.gateway,
        event: payload.event,
        signature: payload.signature,
        processedAt: new Date(),
      })
    } catch (error) {
      logger.error('Failed to log webhook:', error)
      // Don't throw here as webhook logging shouldn't break the main process
    }
  }
}

export const webhookService = new WebhookService()