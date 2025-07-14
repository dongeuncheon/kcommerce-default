/**
 * Payment Repository Implementation
 * Database operations for payment entities
 */

import { BaseRepository } from '../../core/repository/base.repository';
import { IPaymentRepository, Payment, PaymentStatus } from './payment.types';

export class PaymentRepository extends BaseRepository<Payment> implements IPaymentRepository {
  protected tableName = 'payments';

  /**
   * Create a new payment record
   */
  async create(payment: Partial<Payment>): Promise<Payment> {
    const now = new Date();
    const paymentData = {
      ...payment,
      createdAt: now,
      updatedAt: now,
    };

    try {
      const result = await this.insert(paymentData);
      return result;
    } catch (error) {
      console.error('Failed to create payment:', error);
      throw new Error(`Failed to create payment: ${error.message}`);
    }
  }

  /**
   * Find payment by ID
   */
  async findById(id: string): Promise<Payment | null> {
    try {
      return await this.findOne({ id });
    } catch (error) {
      console.error('Failed to find payment by ID:', error);
      return null;
    }
  }

  /**
   * Find payment by payment ID
   */
  async findByPaymentId(paymentId: string): Promise<Payment | null> {
    try {
      return await this.findOne({ paymentId });
    } catch (error) {
      console.error('Failed to find payment by payment ID:', error);
      return null;
    }
  }

  /**
   * Find payments by order ID
   */
  async findByOrderId(orderId: string): Promise<Payment[]> {
    try {
      return await this.findMany({ orderId });
    } catch (error) {
      console.error('Failed to find payments by order ID:', error);
      return [];
    }
  }

  /**
   * Find payments by customer ID
   */
  async findByCustomerId(customerId: string): Promise<Payment[]> {
    try {
      const payments = await this.findMany({ customerId });
      // Sort by creation date, newest first
      return payments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (error) {
      console.error('Failed to find payments by customer ID:', error);
      return [];
    }
  }

  /**
   * Update payment record
   */
  async update(id: string, payment: Partial<Payment>): Promise<Payment> {
    try {
      const updateData = {
        ...payment,
        updatedAt: new Date(),
      };

      const updated = await this.updateOne({ id }, updateData);
      if (!updated) {
        throw new Error(`Payment with ID ${id} not found`);
      }

      return updated;
    } catch (error) {
      console.error('Failed to update payment:', error);
      throw new Error(`Failed to update payment: ${error.message}`);
    }
  }

  /**
   * Update payment status
   */
  async updateStatus(paymentId: string, status: PaymentStatus): Promise<Payment> {
    try {
      const updateData: Partial<Payment> = {
        status,
        updatedAt: new Date(),
      };

      // Add status-specific timestamps
      switch (status) {
        case PaymentStatus.COMPLETED:
          if (!updateData.paidAt) {
            updateData.paidAt = new Date();
          }
          break;
        case PaymentStatus.FAILED:
        case PaymentStatus.CANCELLED:
          updateData.failedAt = new Date();
          break;
        case PaymentStatus.REFUNDED:
        case PaymentStatus.PARTIALLY_REFUNDED:
          updateData.refundedAt = new Date();
          break;
      }

      const updated = await this.updateOne({ paymentId }, updateData);
      if (!updated) {
        throw new Error(`Payment with ID ${paymentId} not found`);
      }

      return updated;
    } catch (error) {
      console.error('Failed to update payment status:', error);
      throw new Error(`Failed to update payment status: ${error.message}`);
    }
  }

  /**
   * Find payments by status
   */
  async findByStatus(status: PaymentStatus): Promise<Payment[]> {
    try {
      return await this.findMany({ status });
    } catch (error) {
      console.error('Failed to find payments by status:', error);
      return [];
    }
  }

  /**
   * Find payments by gateway
   */
  async findByGateway(gateway: string): Promise<Payment[]> {
    try {
      return await this.findMany({ gateway });
    } catch (error) {
      console.error('Failed to find payments by gateway:', error);
      return [];
    }
  }

  /**
   * Find payments by gateway transaction ID
   */
  async findByGatewayTransactionId(gatewayTransactionId: string): Promise<Payment | null> {
    try {
      return await this.findOne({ gatewayTransactionId });
    } catch (error) {
      console.error('Failed to find payment by gateway transaction ID:', error);
      return null;
    }
  }

  /**
   * Find payments within date range
   */
  async findByDateRange(startDate: Date, endDate: Date): Promise<Payment[]> {
    try {
      // This would need to be implemented based on your database adapter
      const query = {
        createdAt: {
          $gte: startDate,
          $lte: endDate,
        },
      };
      return await this.findMany(query);
    } catch (error) {
      console.error('Failed to find payments by date range:', error);
      return [];
    }
  }

  /**
   * Find pending payments that are older than specified minutes
   */
  async findStalePayments(minutesOld: number = 30): Promise<Payment[]> {
    try {
      const cutoffTime = new Date(Date.now() - minutesOld * 60 * 1000);
      const query = {
        status: PaymentStatus.PENDING,
        createdAt: {
          $lt: cutoffTime,
        },
      };
      return await this.findMany(query);
    } catch (error) {
      console.error('Failed to find stale payments:', error);
      return [];
    }
  }

  /**
   * Get payment statistics
   */
  async getPaymentStats(filters?: {
    startDate?: Date;
    endDate?: Date;
    gateway?: string;
    customerId?: string;
  }): Promise<{
    totalCount: number;
    totalAmount: number;
    statusBreakdown: Record<PaymentStatus, number>;
    gatewayBreakdown: Record<string, number>;
    averageAmount: number;
  }> {
    try {
      let payments = await this.findAll();

      // Apply filters
      if (filters?.startDate) {
        payments = payments.filter(p => new Date(p.createdAt) >= filters.startDate!);
      }
      if (filters?.endDate) {
        payments = payments.filter(p => new Date(p.createdAt) <= filters.endDate!);
      }
      if (filters?.gateway) {
        payments = payments.filter(p => p.gateway === filters.gateway);
      }
      if (filters?.customerId) {
        payments = payments.filter(p => p.customerId === filters.customerId);
      }

      // Calculate statistics
      const totalCount = payments.length;
      const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);
      const averageAmount = totalCount > 0 ? totalAmount / totalCount : 0;

      // Status breakdown
      const statusBreakdown: Record<PaymentStatus, number> = {
        [PaymentStatus.PENDING]: 0,
        [PaymentStatus.PROCESSING]: 0,
        [PaymentStatus.COMPLETED]: 0,
        [PaymentStatus.FAILED]: 0,
        [PaymentStatus.CANCELLED]: 0,
        [PaymentStatus.REFUNDED]: 0,
        [PaymentStatus.PARTIALLY_REFUNDED]: 0,
      };

      // Gateway breakdown
      const gatewayBreakdown: Record<string, number> = {};

      payments.forEach(payment => {
        statusBreakdown[payment.status]++;
        gatewayBreakdown[payment.gateway] = (gatewayBreakdown[payment.gateway] || 0) + 1;
      });

      return {
        totalCount,
        totalAmount,
        statusBreakdown,
        gatewayBreakdown,
        averageAmount,
      };
    } catch (error) {
      console.error('Failed to get payment stats:', error);
      throw new Error(`Failed to get payment stats: ${error.message}`);
    }
  }

  /**
   * Delete old payment records (for cleanup)
   */
  async deleteOldPayments(daysOld: number = 365): Promise<number> {
    try {
      const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
      
      // Only delete completed, failed, or cancelled payments that are old
      const query = {
        status: {
          $in: [PaymentStatus.COMPLETED, PaymentStatus.FAILED, PaymentStatus.CANCELLED],
        },
        createdAt: {
          $lt: cutoffDate,
        },
      };

      const paymentsToDelete = await this.findMany(query);
      
      for (const payment of paymentsToDelete) {
        await this.deleteOne({ id: payment.id });
      }

      return paymentsToDelete.length;
    } catch (error) {
      console.error('Failed to delete old payments:', error);
      throw new Error(`Failed to delete old payments: ${error.message}`);
    }
  }

  /**
   * Archive old payments (move to archive table)
   */
  async archiveOldPayments(daysOld: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
      
      const paymentsToArchive = await this.findMany({
        status: {
          $in: [PaymentStatus.COMPLETED, PaymentStatus.FAILED, PaymentStatus.CANCELLED],
        },
        createdAt: {
          $lt: cutoffDate,
        },
      });

      // In a real implementation, you would move these to an archive table
      // For now, we'll just mark them as archived
      for (const payment of paymentsToArchive) {
        await this.updateOne(
          { id: payment.id },
          { 
            metadata: { 
              ...payment.metadata, 
              archived: true, 
              archivedAt: new Date(),
            },
          }
        );
      }

      return paymentsToArchive.length;
    } catch (error) {
      console.error('Failed to archive old payments:', error);
      throw new Error(`Failed to archive old payments: ${error.message}`);
    }
  }

  /**
   * Find payments that need webhook retry
   */
  async findPaymentsNeedingWebhookRetry(): Promise<Payment[]> {
    try {
      // Find payments that had webhook failures and need retry
      return await this.findMany({
        status: PaymentStatus.COMPLETED,
        metadata: {
          webhookFailed: true,
          webhookRetryCount: { $lt: 3 }, // Max 3 retries
        },
      });
    } catch (error) {
      console.error('Failed to find payments needing webhook retry:', error);
      return [];
    }
  }

  /**
   * Mark webhook as failed and increment retry count
   */
  async markWebhookFailed(paymentId: string, error: string): Promise<Payment> {
    try {
      const payment = await this.findByPaymentId(paymentId);
      if (!payment) {
        throw new Error(`Payment ${paymentId} not found`);
      }

      const retryCount = (payment.metadata?.webhookRetryCount || 0) + 1;
      
      return await this.update(payment.id, {
        metadata: {
          ...payment.metadata,
          webhookFailed: true,
          webhookRetryCount: retryCount,
          lastWebhookError: error,
          lastWebhookAttempt: new Date(),
        },
      });
    } catch (error) {
      console.error('Failed to mark webhook as failed:', error);
      throw error;
    }
  }

  /**
   * Mark webhook as successful
   */
  async markWebhookSuccess(paymentId: string): Promise<Payment> {
    try {
      const payment = await this.findByPaymentId(paymentId);
      if (!payment) {
        throw new Error(`Payment ${paymentId} not found`);
      }

      return await this.update(payment.id, {
        metadata: {
          ...payment.metadata,
          webhookFailed: false,
          webhookRetryCount: 0,
          lastWebhookSuccess: new Date(),
        },
      });
    } catch (error) {
      console.error('Failed to mark webhook as successful:', error);
      throw error;
    }
  }
}