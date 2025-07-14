/**
 * Order-Payment Integration Service
 * Handles the integration between payment system and order management
 */

import { 
  IPaymentService,
  Payment,
  PaymentStatus,
  PaymentEvent,
  PaymentEventPayload,
} from '../payment.types';

// Order module interfaces (these would be imported from the order module)
export interface Order {
  id: string;
  orderId: string;
  customerId: string;
  status: OrderStatus;
  totalAmount: number;
  currency: string;
  items: OrderItem[];
  paymentStatus: PaymentStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderItem {
  id: string;
  productId: string;
  name: string;
  quantity: number;
  price: number;
  totalPrice: number;
}

export enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  PROCESSING = 'processing',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
}

// Order service interface (this would be the actual order service)
export interface IOrderService {
  findByOrderId(orderId: string): Promise<Order | null>;
  updateOrderStatus(orderId: string, status: OrderStatus): Promise<Order>;
  updatePaymentStatus(orderId: string, paymentStatus: PaymentStatus): Promise<Order>;
  cancelOrder(orderId: string, reason: string): Promise<Order>;
  refundOrder(orderId: string, amount: number, reason: string): Promise<Order>;
}

export class OrderPaymentIntegration {
  constructor(
    private paymentService: IPaymentService,
    private orderService: IOrderService,
    private eventEmitter?: any // Event emitter for cross-module communication
  ) {
    this.setupPaymentEventHandlers();
  }

  /**
   * Setup payment event handlers to update orders
   */
  private setupPaymentEventHandlers(): void {
    if (!this.eventEmitter) return;

    // Handle payment completion
    this.eventEmitter.on(PaymentEvent.PAYMENT_COMPLETED, async (payload: PaymentEventPayload) => {
      await this.handlePaymentCompleted(payload.payment);
    });

    // Handle payment failure
    this.eventEmitter.on(PaymentEvent.PAYMENT_FAILED, async (payload: PaymentEventPayload) => {
      await this.handlePaymentFailed(payload.payment);
    });

    // Handle payment cancellation
    this.eventEmitter.on(PaymentEvent.PAYMENT_CANCELLED, async (payload: PaymentEventPayload) => {
      await this.handlePaymentCancelled(payload.payment);
    });

    // Handle payment refund
    this.eventEmitter.on(PaymentEvent.PAYMENT_REFUNDED, async (payload: PaymentEventPayload) => {
      await this.handlePaymentRefunded(payload.payment, payload.metadata);
    });
  }

  /**
   * Handle successful payment completion
   */
  private async handlePaymentCompleted(payment: Payment): Promise<void> {
    try {
      const order = await this.orderService.findByOrderId(payment.orderId);
      if (!order) {
        console.error(`Order not found for payment: ${payment.paymentId}`);
        return;
      }

      // Update order payment status
      await this.orderService.updatePaymentStatus(payment.orderId, PaymentStatus.COMPLETED);

      // Update order status to confirmed if it was pending
      if (order.status === OrderStatus.PENDING) {
        await this.orderService.updateOrderStatus(payment.orderId, OrderStatus.CONFIRMED);
      }

      // Emit order confirmed event
      this.emitEvent('order.payment.completed', {
        orderId: payment.orderId,
        paymentId: payment.paymentId,
        amount: payment.amount,
        gateway: payment.gateway,
      });

      console.log(`Order ${payment.orderId} payment completed successfully`);
    } catch (error) {
      console.error('Error handling payment completion:', error);
    }
  }

  /**
   * Handle payment failure
   */
  private async handlePaymentFailed(payment: Payment): Promise<void> {
    try {
      const order = await this.orderService.findByOrderId(payment.orderId);
      if (!order) {
        console.error(`Order not found for payment: ${payment.paymentId}`);
        return;
      }

      // Update order payment status
      await this.orderService.updatePaymentStatus(payment.orderId, PaymentStatus.FAILED);

      // Cancel the order if payment failed
      await this.orderService.cancelOrder(payment.orderId, `Payment failed: ${payment.failureReason}`);

      // Emit order payment failed event
      this.emitEvent('order.payment.failed', {
        orderId: payment.orderId,
        paymentId: payment.paymentId,
        reason: payment.failureReason,
        gateway: payment.gateway,
      });

      console.log(`Order ${payment.orderId} payment failed and order cancelled`);
    } catch (error) {
      console.error('Error handling payment failure:', error);
    }
  }

  /**
   * Handle payment cancellation
   */
  private async handlePaymentCancelled(payment: Payment): Promise<void> {
    try {
      const order = await this.orderService.findByOrderId(payment.orderId);
      if (!order) {
        console.error(`Order not found for payment: ${payment.paymentId}`);
        return;
      }

      // Update order payment status
      await this.orderService.updatePaymentStatus(payment.orderId, PaymentStatus.CANCELLED);

      // Cancel the order
      await this.orderService.cancelOrder(payment.orderId, 'Payment cancelled by customer');

      // Emit order cancelled event
      this.emitEvent('order.payment.cancelled', {
        orderId: payment.orderId,
        paymentId: payment.paymentId,
        gateway: payment.gateway,
      });

      console.log(`Order ${payment.orderId} payment cancelled and order cancelled`);
    } catch (error) {
      console.error('Error handling payment cancellation:', error);
    }
  }

  /**
   * Handle payment refund
   */
  private async handlePaymentRefunded(payment: Payment, metadata?: Record<string, any>): Promise<void> {
    try {
      const order = await this.orderService.findByOrderId(payment.orderId);
      if (!order) {
        console.error(`Order not found for payment: ${payment.paymentId}`);
        return;
      }

      const refundAmount = metadata?.refundAmount || payment.refundedAmount || 0;
      const refundReason = metadata?.refundReason || 'Refund processed';

      // Update order payment status
      const newPaymentStatus = payment.status === PaymentStatus.REFUNDED 
        ? PaymentStatus.REFUNDED 
        : PaymentStatus.PARTIALLY_REFUNDED;
      
      await this.orderService.updatePaymentStatus(payment.orderId, newPaymentStatus);

      // Update order status if fully refunded
      if (payment.status === PaymentStatus.REFUNDED) {
        await this.orderService.refundOrder(payment.orderId, refundAmount, refundReason);
      }

      // Emit order refund event
      this.emitEvent('order.payment.refunded', {
        orderId: payment.orderId,
        paymentId: payment.paymentId,
        refundAmount,
        totalRefunded: payment.refundedAmount,
        isPartialRefund: payment.status === PaymentStatus.PARTIALLY_REFUNDED,
        gateway: payment.gateway,
      });

      console.log(`Order ${payment.orderId} refund processed: ${refundAmount}`);
    } catch (error) {
      console.error('Error handling payment refund:', error);
    }
  }

  /**
   * Process order payment (called when order is created)
   */
  async processOrderPayment(order: Order, paymentData: {
    gateway: string;
    method?: string;
    returnUrl: string;
    cancelUrl: string;
    customerInfo?: any;
  }): Promise<{ paymentId: string; redirectUrl?: string; [key: string]: any }> {
    try {
      const paymentRequest = {
        orderId: order.orderId,
        customerId: order.customerId,
        gateway: paymentData.gateway as any,
        method: paymentData.method as any,
        amount: order.totalAmount,
        currency: order.currency as any,
        description: `Order ${order.orderId} payment`,
        returnUrl: paymentData.returnUrl,
        cancelUrl: paymentData.cancelUrl,
        customerInfo: paymentData.customerInfo,
        items: order.items.map(item => ({
          id: item.productId,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
        })),
      };

      const result = await this.paymentService.initializePayment(paymentRequest);

      // Update order with payment ID
      await this.orderService.updatePaymentStatus(order.orderId, PaymentStatus.PENDING);

      // Emit payment initialized event
      this.emitEvent('order.payment.initialized', {
        orderId: order.orderId,
        paymentId: result.paymentId,
        gateway: paymentData.gateway,
        amount: order.totalAmount,
      });

      return result;
    } catch (error) {
      console.error('Error processing order payment:', error);
      throw new Error(`Failed to process order payment: ${error.message}`);
    }
  }

  /**
   * Get payment status for order
   */
  async getOrderPaymentStatus(orderId: string): Promise<{
    order: Order;
    payments: Payment[];
    totalPaid: number;
    totalRefunded: number;
    remainingAmount: number;
  }> {
    try {
      const order = await this.orderService.findByOrderId(orderId);
      if (!order) {
        throw new Error(`Order ${orderId} not found`);
      }

      const payments = await this.paymentService.getPaymentsByOrder(orderId);
      
      const totalPaid = payments
        .filter(p => p.status === PaymentStatus.COMPLETED)
        .reduce((sum, p) => sum + p.amount, 0);

      const totalRefunded = payments
        .reduce((sum, p) => sum + (p.refundedAmount || 0), 0);

      const remainingAmount = order.totalAmount - totalPaid + totalRefunded;

      return {
        order,
        payments,
        totalPaid,
        totalRefunded,
        remainingAmount,
      };
    } catch (error) {
      console.error('Error getting order payment status:', error);
      throw error;
    }
  }

  /**
   * Process partial refund for order
   */
  async processPartialRefund(orderId: string, amount: number, reason: string): Promise<{
    refundId: string;
    refundedAmount: number;
    remainingAmount: number;
  }> {
    try {
      const orderStatus = await this.getOrderPaymentStatus(orderId);
      
      if (orderStatus.totalPaid < amount) {
        throw new Error('Refund amount cannot exceed paid amount');
      }

      // Find the latest successful payment to refund
      const paymentToRefund = orderStatus.payments
        .filter(p => p.status === PaymentStatus.COMPLETED)
        .sort((a, b) => new Date(b.paidAt!).getTime() - new Date(a.paidAt!).getTime())[0];

      if (!paymentToRefund) {
        throw new Error('No completed payment found to refund');
      }

      const refundRequest = {
        paymentId: paymentToRefund.paymentId,
        amount,
        reason,
        gatewayTransactionId: paymentToRefund.gatewayTransactionId,
      };

      const refundResult = await this.paymentService.refundPayment(refundRequest);

      if (refundResult.status !== 'completed') {
        throw new Error(`Refund failed: ${refundResult.failureReason}`);
      }

      return {
        refundId: refundResult.refundId,
        refundedAmount: refundResult.amount,
        remainingAmount: orderStatus.remainingAmount - amount,
      };
    } catch (error) {
      console.error('Error processing partial refund:', error);
      throw error;
    }
  }

  /**
   * Verify order payment
   */
  async verifyOrderPayment(orderId: string, paymentId: string): Promise<{
    isValid: boolean;
    payment: Payment | null;
    order: Order | null;
    discrepancies: string[];
  }> {
    try {
      const order = await this.orderService.findByOrderId(orderId);
      const payment = await this.paymentService.getPayment(paymentId);

      const discrepancies: string[] = [];

      if (!order) {
        discrepancies.push('Order not found');
      }

      if (!payment) {
        discrepancies.push('Payment not found');
      }

      if (order && payment) {
        if (order.orderId !== payment.orderId) {
          discrepancies.push('Order ID mismatch');
        }

        if (order.customerId !== payment.customerId) {
          discrepancies.push('Customer ID mismatch');
        }

        if (order.totalAmount !== payment.amount) {
          discrepancies.push(`Amount mismatch: order ${order.totalAmount} vs payment ${payment.amount}`);
        }

        if (order.currency !== payment.currency) {
          discrepancies.push('Currency mismatch');
        }
      }

      return {
        isValid: discrepancies.length === 0,
        payment,
        order,
        discrepancies,
      };
    } catch (error) {
      console.error('Error verifying order payment:', error);
      return {
        isValid: false,
        payment: null,
        order: null,
        discrepancies: [`Verification error: ${error.message}`],
      };
    }
  }

  /**
   * Get order payment history
   */
  async getOrderPaymentHistory(orderId: string): Promise<{
    order: Order;
    paymentEvents: Array<{
      timestamp: Date;
      event: string;
      paymentId?: string;
      amount?: number;
      status: PaymentStatus;
      gateway?: string;
      details?: any;
    }>;
  }> {
    try {
      const order = await this.orderService.findByOrderId(orderId);
      if (!order) {
        throw new Error(`Order ${orderId} not found`);
      }

      const payments = await this.paymentService.getPaymentsByOrder(orderId);
      
      const paymentEvents = payments.flatMap(payment => {
        const events = [];
        
        // Payment created
        events.push({
          timestamp: payment.createdAt,
          event: 'payment.created',
          paymentId: payment.paymentId,
          amount: payment.amount,
          status: PaymentStatus.PENDING,
          gateway: payment.gateway,
        });

        // Payment completed/failed
        if (payment.paidAt) {
          events.push({
            timestamp: payment.paidAt,
            event: 'payment.completed',
            paymentId: payment.paymentId,
            amount: payment.amount,
            status: PaymentStatus.COMPLETED,
            gateway: payment.gateway,
          });
        }

        if (payment.failedAt) {
          events.push({
            timestamp: payment.failedAt,
            event: 'payment.failed',
            paymentId: payment.paymentId,
            amount: payment.amount,
            status: PaymentStatus.FAILED,
            gateway: payment.gateway,
            details: { reason: payment.failureReason },
          });
        }

        // Refunds
        if (payment.refundedAt && payment.refundedAmount) {
          events.push({
            timestamp: payment.refundedAt,
            event: 'payment.refunded',
            paymentId: payment.paymentId,
            amount: payment.refundedAmount,
            status: payment.status,
            gateway: payment.gateway,
          });
        }

        return events;
      });

      // Sort events by timestamp
      paymentEvents.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      return {
        order,
        paymentEvents,
      };
    } catch (error) {
      console.error('Error getting order payment history:', error);
      throw error;
    }
  }

  /**
   * Emit cross-module event
   */
  private emitEvent(event: string, data: any): void {
    if (this.eventEmitter) {
      this.eventEmitter.emit(event, data);
    }
  }
}