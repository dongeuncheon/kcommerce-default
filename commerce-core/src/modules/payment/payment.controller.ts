/**
 * Payment Controller
 * Unified API endpoints for all payment gateways
 */

import { Request, Response } from 'express';
import { 
  IPaymentService,
  PaymentGateway,
  PaymentInitRequest,
  PaymentProcessRequest,
  PaymentVerifyRequest,
  RefundRequest,
  PaymentStatus,
} from './payment.types';

export class PaymentController {
  constructor(private paymentService: IPaymentService) {}

  /**
   * POST /api/payments/initialize
   * Initialize a payment with the specified gateway
   */
  async initializePayment(req: Request, res: Response): Promise<void> {
    try {
      const initRequest: PaymentInitRequest = {
        orderId: req.body.orderId,
        customerId: req.body.customerId,
        gateway: req.body.gateway as PaymentGateway,
        method: req.body.method,
        amount: req.body.amount,
        currency: req.body.currency,
        description: req.body.description,
        returnUrl: req.body.returnUrl,
        cancelUrl: req.body.cancelUrl,
        webhookUrl: req.body.webhookUrl,
        metadata: req.body.metadata,
        customerInfo: req.body.customerInfo,
        items: req.body.items,
      };

      // Validate required fields
      const validation = this.validateInitRequest(initRequest);
      if (!validation.isValid) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validation.errors,
        });
        return;
      }

      const result = await this.paymentService.initializePayment(initRequest);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Payment initialization error:', error);
      res.status(500).json({
        success: false,
        error: 'Payment initialization failed',
        message: error.message,
      });
    }
  }

  /**
   * POST /api/payments/process
   * Process a payment (handle gateway callback)
   */
  async processPayment(req: Request, res: Response): Promise<void> {
    try {
      const processRequest: PaymentProcessRequest = {
        paymentId: req.body.paymentId,
        gateway: req.body.gateway as PaymentGateway,
        gatewayData: req.body.gatewayData,
      };

      // Validate required fields
      if (!processRequest.paymentId || !processRequest.gateway) {
        res.status(400).json({
          success: false,
          error: 'Payment ID and gateway are required',
        });
        return;
      }

      const payment = await this.paymentService.processPayment(processRequest);

      res.status(200).json({
        success: true,
        data: payment,
      });
    } catch (error) {
      console.error('Payment processing error:', error);
      res.status(500).json({
        success: false,
        error: 'Payment processing failed',
        message: error.message,
      });
    }
  }

  /**
   * GET /api/payments/:id/verify
   * Verify payment status
   */
  async verifyPayment(req: Request, res: Response): Promise<void> {
    try {
      const paymentId = req.params.id;
      const gatewayTransactionId = req.query.gatewayTransactionId as string;

      const verifyRequest: PaymentVerifyRequest = {
        paymentId,
        gatewayTransactionId,
      };

      const result = await this.paymentService.verifyPayment(verifyRequest);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Payment verification error:', error);
      res.status(500).json({
        success: false,
        error: 'Payment verification failed',
        message: error.message,
      });
    }
  }

  /**
   * POST /api/payments/webhook/:gateway
   * Handle webhook from payment gateway
   */
  async handleWebhook(req: Request, res: Response): Promise<void> {
    try {
      const gateway = req.params.gateway as PaymentGateway;
      const signature = req.headers['x-signature'] as string || req.headers['x-webhook-signature'] as string;

      const webhookPayload = {
        gateway,
        eventType: req.body.eventType || 'payment.updated',
        timestamp: new Date(),
        signature,
        data: req.body,
      };

      const payment = await this.paymentService.handleWebhook(gateway, webhookPayload);

      res.status(200).json({
        success: true,
        data: payment,
      });
    } catch (error) {
      console.error('Webhook handling error:', error);
      res.status(500).json({
        success: false,
        error: 'Webhook handling failed',
        message: error.message,
      });
    }
  }

  /**
   * POST /api/payments/:id/refund
   * Process payment refund
   */
  async refundPayment(req: Request, res: Response): Promise<void> {
    try {
      const paymentId = req.params.id;
      
      const refundRequest: RefundRequest = {
        paymentId,
        amount: req.body.amount,
        reason: req.body.reason,
        requesterName: req.body.requesterName,
        bankInfo: req.body.bankInfo,
      };

      // Validate required fields
      if (!refundRequest.amount || !refundRequest.reason) {
        res.status(400).json({
          success: false,
          error: 'Amount and reason are required for refund',
        });
        return;
      }

      const result = await this.paymentService.refundPayment(refundRequest);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Payment refund error:', error);
      res.status(500).json({
        success: false,
        error: 'Payment refund failed',
        message: error.message,
      });
    }
  }

  /**
   * GET /api/payments/:id
   * Get payment details
   */
  async getPayment(req: Request, res: Response): Promise<void> {
    try {
      const paymentId = req.params.id;
      const payment = await this.paymentService.getPayment(paymentId);

      if (!payment) {
        res.status(404).json({
          success: false,
          error: 'Payment not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: payment,
      });
    } catch (error) {
      console.error('Get payment error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve payment',
        message: error.message,
      });
    }
  }

  /**
   * GET /api/payments/order/:orderId
   * Get payments by order ID
   */
  async getPaymentsByOrder(req: Request, res: Response): Promise<void> {
    try {
      const orderId = req.params.orderId;
      const payments = await this.paymentService.getPaymentsByOrder(orderId);

      res.status(200).json({
        success: true,
        data: payments,
      });
    } catch (error) {
      console.error('Get payments by order error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve payments',
        message: error.message,
      });
    }
  }

  /**
   * GET /api/payments/customer/:customerId
   * Get payments by customer ID
   */
  async getPaymentsByCustomer(req: Request, res: Response): Promise<void> {
    try {
      const customerId = req.params.customerId;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const status = req.query.status as PaymentStatus;

      let payments = await this.paymentService.getPaymentsByCustomer(customerId);

      // Filter by status if provided
      if (status) {
        payments = payments.filter(payment => payment.status === status);
      }

      // Implement pagination
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedPayments = payments.slice(startIndex, endIndex);

      res.status(200).json({
        success: true,
        data: paginatedPayments,
        pagination: {
          page,
          limit,
          total: payments.length,
          totalPages: Math.ceil(payments.length / limit),
        },
      });
    } catch (error) {
      console.error('Get payments by customer error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve payments',
        message: error.message,
      });
    }
  }

  /**
   * GET /api/payments/gateways
   * Get available payment gateways and their information
   */
  async getAvailableGateways(req: Request, res: Response): Promise<void> {
    try {
      const gateways = (this.paymentService as any).getAvailableGateways();
      
      const gatewayInfo = gateways.map((gateway: PaymentGateway) => {
        try {
          return (this.paymentService as any).getGatewayInfo(gateway);
        } catch (error) {
          return {
            gateway,
            error: error.message,
          };
        }
      });

      res.status(200).json({
        success: true,
        data: gatewayInfo,
      });
    } catch (error) {
      console.error('Get available gateways error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve gateway information',
        message: error.message,
      });
    }
  }

  /**
   * POST /api/payments/test
   * Test payment gateway configuration
   */
  async testGateway(req: Request, res: Response): Promise<void> {
    try {
      const gateway = req.body.gateway as PaymentGateway;
      
      if (!gateway) {
        res.status(400).json({
          success: false,
          error: 'Gateway is required',
        });
        return;
      }

      // Create a minimal test payment request
      const testRequest: PaymentInitRequest = {
        orderId: `TEST_${Date.now()}`,
        customerId: 'test_customer',
        gateway,
        amount: 1000, // Minimal test amount
        currency: 'KRW' as any,
        description: 'Gateway test payment',
        returnUrl: 'https://example.com/return',
        cancelUrl: 'https://example.com/cancel',
      };

      try {
        const result = await this.paymentService.initializePayment(testRequest);
        
        res.status(200).json({
          success: true,
          message: 'Gateway test successful',
          data: {
            gateway,
            testResult: 'PASS',
            paymentId: result.paymentId,
          },
        });
      } catch (testError) {
        res.status(200).json({
          success: false,
          message: 'Gateway test failed',
          data: {
            gateway,
            testResult: 'FAIL',
            error: testError.message,
          },
        });
      }
    } catch (error) {
      console.error('Gateway test error:', error);
      res.status(500).json({
        success: false,
        error: 'Gateway test failed',
        message: error.message,
      });
    }
  }

  /**
   * GET /api/payments/health
   * Health check endpoint
   */
  async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      const gateways = (this.paymentService as any).getAvailableGateways();
      
      res.status(200).json({
        success: true,
        message: 'Payment service is healthy',
        data: {
          timestamp: new Date().toISOString(),
          availableGateways: gateways,
          serviceStatus: 'HEALTHY',
        },
      });
    } catch (error) {
      console.error('Health check error:', error);
      res.status(500).json({
        success: false,
        error: 'Payment service health check failed',
        message: error.message,
      });
    }
  }

  /**
   * Validate payment initialization request
   */
  private validateInitRequest(request: PaymentInitRequest): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!request.orderId) {
      errors.push('Order ID is required');
    }

    if (!request.customerId) {
      errors.push('Customer ID is required');
    }

    if (!request.gateway) {
      errors.push('Payment gateway is required');
    }

    if (!request.amount || request.amount <= 0) {
      errors.push('Amount must be greater than 0');
    }

    if (!request.currency) {
      errors.push('Currency is required');
    }

    if (!request.returnUrl) {
      errors.push('Return URL is required');
    }

    if (!request.cancelUrl) {
      errors.push('Cancel URL is required');
    }

    // Validate URL formats
    if (request.returnUrl && !this.isValidUrl(request.returnUrl)) {
      errors.push('Return URL must be a valid URL');
    }

    if (request.cancelUrl && !this.isValidUrl(request.cancelUrl)) {
      errors.push('Cancel URL must be a valid URL');
    }

    if (request.webhookUrl && !this.isValidUrl(request.webhookUrl)) {
      errors.push('Webhook URL must be a valid URL');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate URL format
   */
  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}