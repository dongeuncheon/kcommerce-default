/**
 * Payment Service
 * Abstract payment processor that manages multiple payment gateways
 */

import {
  IPaymentService,
  IPaymentRepository,
  IPaymentGateway,
  PaymentGateway,
  PaymentInitRequest,
  PaymentInitResponse,
  PaymentProcessRequest,
  PaymentVerifyRequest,
  PaymentVerifyResponse,
  RefundRequest,
  RefundResponse,
  WebhookPayload,
  Payment,
  PaymentStatus,
  PaymentEvent,
  PaymentEventPayload,
} from './payment.types';

export class PaymentService implements IPaymentService {
  private gateways: Map<PaymentGateway, IPaymentGateway> = new Map();

  constructor(
    private paymentRepository: IPaymentRepository,
    private eventEmitter?: any // Event emitter for payment events
  ) {}

  /**
   * Register a payment gateway
   */
  registerGateway(gateway: IPaymentGateway): void {
    this.gateways.set(gateway.gateway, gateway);
  }

  /**
   * Get a payment gateway by type
   */
  private getGateway(gateway: PaymentGateway): IPaymentGateway {
    const gatewayInstance = this.gateways.get(gateway);
    if (!gatewayInstance) {
      throw new Error(`Payment gateway ${gateway} is not registered`);
    }
    return gatewayInstance;
  }

  /**
   * Initialize a payment
   */
  async initializePayment(request: PaymentInitRequest): Promise<PaymentInitResponse> {
    try {
      // Validate request
      this.validateInitRequest(request);

      // Get the appropriate gateway
      const gateway = this.getGateway(request.gateway);

      // Generate unique payment ID
      const paymentId = this.generatePaymentId();

      // Create payment record in database
      const payment = await this.paymentRepository.create({
        paymentId,
        orderId: request.orderId,
        customerId: request.customerId,
        gateway: request.gateway,
        method: request.method,
        status: PaymentStatus.PENDING,
        amount: request.amount,
        currency: request.currency,
        description: request.description,
        metadata: request.metadata,
      });

      // Initialize payment with gateway
      const gatewayRequest = {
        ...request,
        paymentId,
      };

      const initResponse = await gateway.initializePayment(gatewayRequest);

      // Update payment with gateway response data
      await this.paymentRepository.update(payment.id, {
        gatewayResponseData: initResponse.additionalData,
      });

      // Emit payment initialized event
      this.emitEvent(PaymentEvent.PAYMENT_INITIALIZED, { payment });

      return {
        ...initResponse,
        paymentId,
      };
    } catch (error) {
      console.error('Payment initialization failed:', error);
      throw new Error(`Payment initialization failed: ${error.message}`);
    }
  }

  /**
   * Process a payment (handle gateway callback)
   */
  async processPayment(request: PaymentProcessRequest): Promise<Payment> {
    try {
      // Get existing payment
      const payment = await this.paymentRepository.findByPaymentId(request.paymentId);
      if (!payment) {
        throw new Error(`Payment ${request.paymentId} not found`);
      }

      // Get the appropriate gateway
      const gateway = this.getGateway(request.gateway);

      // Update status to processing
      await this.paymentRepository.updateStatus(request.paymentId, PaymentStatus.PROCESSING);
      this.emitEvent(PaymentEvent.PAYMENT_PROCESSING, { 
        payment: { ...payment, status: PaymentStatus.PROCESSING },
        previousStatus: payment.status,
      });

      // Process payment with gateway
      const processedPayment = await gateway.processPayment(request);

      // Update payment record
      const updatedPayment = await this.paymentRepository.update(payment.id, {
        status: processedPayment.status,
        gatewayTransactionId: processedPayment.gatewayTransactionId,
        gatewayResponseData: processedPayment.gatewayResponseData,
        paidAt: processedPayment.paidAt,
        failedAt: processedPayment.failedAt,
        failureReason: processedPayment.failureReason,
      });

      // Emit appropriate event based on status
      const eventType = this.getEventTypeFromStatus(processedPayment.status);
      this.emitEvent(eventType, { 
        payment: updatedPayment,
        previousStatus: PaymentStatus.PROCESSING,
      });

      return updatedPayment;
    } catch (error) {
      // Update payment status to failed
      const payment = await this.paymentRepository.findByPaymentId(request.paymentId);
      if (payment) {
        await this.paymentRepository.update(payment.id, {
          status: PaymentStatus.FAILED,
          failedAt: new Date(),
          failureReason: error.message,
        });

        this.emitEvent(PaymentEvent.PAYMENT_FAILED, { 
          payment: { ...payment, status: PaymentStatus.FAILED },
          previousStatus: payment.status,
        });
      }

      console.error('Payment processing failed:', error);
      throw error;
    }
  }

  /**
   * Verify payment status
   */
  async verifyPayment(request: PaymentVerifyRequest): Promise<PaymentVerifyResponse> {
    try {
      // Get existing payment
      const payment = await this.paymentRepository.findByPaymentId(request.paymentId);
      if (!payment) {
        throw new Error(`Payment ${request.paymentId} not found`);
      }

      // Get the appropriate gateway
      const gateway = this.getGateway(payment.gateway);

      // Verify payment with gateway
      const verifyResponse = await gateway.verifyPayment(request);

      // Update payment if status has changed
      if (verifyResponse.status !== payment.status) {
        await this.paymentRepository.update(payment.id, {
          status: verifyResponse.status,
          paidAt: verifyResponse.paidAt,
        });

        const eventType = this.getEventTypeFromStatus(verifyResponse.status);
        this.emitEvent(eventType, { 
          payment: { ...payment, status: verifyResponse.status },
          previousStatus: payment.status,
        });
      }

      return verifyResponse;
    } catch (error) {
      console.error('Payment verification failed:', error);
      throw error;
    }
  }

  /**
   * Process refund
   */
  async refundPayment(request: RefundRequest): Promise<RefundResponse> {
    try {
      // Get existing payment
      const payment = await this.paymentRepository.findByPaymentId(request.paymentId);
      if (!payment) {
        throw new Error(`Payment ${request.paymentId} not found`);
      }

      // Validate refund amount
      const totalRefunded = payment.refundedAmount || 0;
      if (totalRefunded + request.amount > payment.amount) {
        throw new Error('Refund amount exceeds payment amount');
      }

      // Get the appropriate gateway
      const gateway = this.getGateway(payment.gateway);

      // Process refund with gateway
      const refundResponse = await gateway.refundPayment(request);

      // Update payment record
      const newRefundedAmount = totalRefunded + request.amount;
      const newStatus = newRefundedAmount >= payment.amount 
        ? PaymentStatus.REFUNDED 
        : PaymentStatus.PARTIALLY_REFUNDED;

      await this.paymentRepository.update(payment.id, {
        status: newStatus,
        refundedAmount: newRefundedAmount,
        refundedAt: new Date(),
      });

      this.emitEvent(PaymentEvent.PAYMENT_REFUNDED, { 
        payment: { ...payment, status: newStatus, refundedAmount: newRefundedAmount },
        previousStatus: payment.status,
        metadata: { refundAmount: request.amount, refundReason: request.reason },
      });

      return refundResponse;
    } catch (error) {
      console.error('Payment refund failed:', error);
      throw error;
    }
  }

  /**
   * Handle webhook
   */
  async handleWebhook(gateway: PaymentGateway, payload: WebhookPayload): Promise<Payment> {
    try {
      // Get the appropriate gateway
      const gatewayInstance = this.getGateway(gateway);

      // Validate webhook signature
      const isValid = await gatewayInstance.validateWebhook(payload);
      if (!isValid) {
        throw new Error('Invalid webhook signature');
      }

      // Parse webhook data
      const payment = await gatewayInstance.parseWebhook(payload);

      // Update payment record
      const existingPayment = await this.paymentRepository.findByPaymentId(payment.paymentId);
      if (!existingPayment) {
        throw new Error(`Payment ${payment.paymentId} not found`);
      }

      const updatedPayment = await this.paymentRepository.update(existingPayment.id, {
        status: payment.status,
        gatewayTransactionId: payment.gatewayTransactionId,
        gatewayResponseData: payment.gatewayResponseData,
        webhookData: payload.data,
        paidAt: payment.paidAt,
        failedAt: payment.failedAt,
        failureReason: payment.failureReason,
      });

      // Emit webhook received event
      this.emitEvent(PaymentEvent.PAYMENT_WEBHOOK_RECEIVED, { 
        payment: updatedPayment,
        previousStatus: existingPayment.status,
      });

      // Emit status change event if status changed
      if (payment.status !== existingPayment.status) {
        const eventType = this.getEventTypeFromStatus(payment.status);
        this.emitEvent(eventType, { 
          payment: updatedPayment,
          previousStatus: existingPayment.status,
        });
      }

      return updatedPayment;
    } catch (error) {
      console.error('Webhook handling failed:', error);
      throw error;
    }
  }

  /**
   * Get payment by ID
   */
  async getPayment(paymentId: string): Promise<Payment | null> {
    return this.paymentRepository.findByPaymentId(paymentId);
  }

  /**
   * Get payments by order ID
   */
  async getPaymentsByOrder(orderId: string): Promise<Payment[]> {
    return this.paymentRepository.findByOrderId(orderId);
  }

  /**
   * Get payments by customer ID
   */
  async getPaymentsByCustomer(customerId: string): Promise<Payment[]> {
    return this.paymentRepository.findByCustomerId(customerId);
  }

  /**
   * Validate payment initialization request
   */
  private validateInitRequest(request: PaymentInitRequest): void {
    if (!request.orderId) {
      throw new Error('Order ID is required');
    }
    if (!request.customerId) {
      throw new Error('Customer ID is required');
    }
    if (!request.gateway) {
      throw new Error('Payment gateway is required');
    }
    if (!request.amount || request.amount <= 0) {
      throw new Error('Invalid payment amount');
    }
    if (!request.currency) {
      throw new Error('Currency is required');
    }
    if (!request.returnUrl) {
      throw new Error('Return URL is required');
    }
    if (!request.cancelUrl) {
      throw new Error('Cancel URL is required');
    }
  }

  /**
   * Generate unique payment ID
   */
  private generatePaymentId(): string {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    return `PAY_${timestamp}_${random}`;
  }

  /**
   * Get event type from payment status
   */
  private getEventTypeFromStatus(status: PaymentStatus): PaymentEvent {
    switch (status) {
      case PaymentStatus.COMPLETED:
        return PaymentEvent.PAYMENT_COMPLETED;
      case PaymentStatus.FAILED:
        return PaymentEvent.PAYMENT_FAILED;
      case PaymentStatus.CANCELLED:
        return PaymentEvent.PAYMENT_CANCELLED;
      case PaymentStatus.REFUNDED:
      case PaymentStatus.PARTIALLY_REFUNDED:
        return PaymentEvent.PAYMENT_REFUNDED;
      default:
        return PaymentEvent.PAYMENT_PROCESSING;
    }
  }

  /**
   * Emit payment event
   */
  private emitEvent(event: PaymentEvent, payload: PaymentEventPayload): void {
    if (this.eventEmitter) {
      this.eventEmitter.emit(event, payload);
    }
  }

  /**
   * Get available payment gateways
   */
  getAvailableGateways(): PaymentGateway[] {
    return Array.from(this.gateways.keys());
  }

  /**
   * Get gateway information
   */
  getGatewayInfo(gateway: PaymentGateway) {
    const gatewayInstance = this.gateways.get(gateway);
    if (!gatewayInstance) {
      throw new Error(`Payment gateway ${gateway} is not registered`);
    }

    return {
      gateway,
      supportedMethods: gatewayInstance.getSupportedMethods(),
      supportedCurrencies: gatewayInstance.getSupportedCurrencies(),
    };
  }
}