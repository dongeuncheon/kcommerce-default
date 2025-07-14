/**
 * Payment Module
 * Main module configuration for the payment system
 */

import { Router } from 'express';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { PaymentRepository } from './payment.repository';
import { PaymentSecurityService, SecurityConfig } from './security/payment-security.service';
import { WebhookHandlerService, WebhookConfig } from './webhooks/webhook-handler.service';
import { OrderPaymentIntegration } from './integrations/order-payment.integration';

// Gateway implementations
import { KakaoPayGateway } from './gateways/kakao-pay.gateway';
import { NaverPayGateway } from './gateways/naver-pay.gateway';
import { TossPayGateway } from './gateways/toss-pay.gateway';
import { NicePayGateway } from './gateways/nicepay.gateway';
import { BankTransferGateway } from './gateways/bank-transfer.gateway';

import { PaymentGateway, PaymentGatewayConfig } from './payment.types';

export interface PaymentModuleConfig {
  gateways: Record<PaymentGateway, PaymentGatewayConfig>;
  security: SecurityConfig;
  webhooks: WebhookConfig;
  database?: any; // Database adapter
  eventEmitter?: any; // Event emitter for cross-module communication
  orderService?: any; // Order service for integration
}

export class PaymentModule {
  private paymentService: PaymentService;
  private paymentController: PaymentController;
  private paymentRepository: PaymentRepository;
  private securityService: PaymentSecurityService;
  private webhookHandler: WebhookHandlerService;
  private orderIntegration?: OrderPaymentIntegration;
  private router: Router;

  constructor(config: PaymentModuleConfig) {
    // Initialize services
    this.paymentRepository = new PaymentRepository(config.database);
    this.securityService = new PaymentSecurityService(config.security);
    this.paymentService = new PaymentService(this.paymentRepository, config.eventEmitter);
    this.paymentController = new PaymentController(this.paymentService);
    
    this.webhookHandler = new WebhookHandlerService(
      this.paymentService,
      this.securityService,
      config.webhooks
    );

    // Initialize order integration if order service is provided
    if (config.orderService) {
      this.orderIntegration = new OrderPaymentIntegration(
        this.paymentService,
        config.orderService,
        config.eventEmitter
      );
    }

    // Register payment gateways
    this.registerGateways(config.gateways);

    // Setup routes
    this.router = this.setupRoutes();
  }

  /**
   * Register payment gateways
   */
  private registerGateways(gatewayConfigs: Record<PaymentGateway, PaymentGatewayConfig>): void {
    Object.entries(gatewayConfigs).forEach(([gatewayType, config]) => {
      if (!config.enabled) {
        console.log(`Payment gateway ${gatewayType} is disabled`);
        return;
      }

      try {
        let gateway;
        
        switch (gatewayType as PaymentGateway) {
          case PaymentGateway.KAKAO_PAY:
            gateway = new KakaoPayGateway(config);
            break;
          case PaymentGateway.NAVER_PAY:
            gateway = new NaverPayGateway(config);
            break;
          case PaymentGateway.TOSS_PAY:
            gateway = new TossPayGateway(config);
            break;
          case PaymentGateway.NICE_PAY:
            gateway = new NicePayGateway(config);
            break;
          case PaymentGateway.BANK_TRANSFER:
            gateway = new BankTransferGateway(config);
            break;
          default:
            console.warn(`Unknown payment gateway: ${gatewayType}`);
            return;
        }

        this.paymentService.registerGateway(gateway);
        console.log(`Payment gateway ${gatewayType} registered successfully`);
      } catch (error) {
        console.error(`Failed to register payment gateway ${gatewayType}:`, error);
      }
    });
  }

  /**
   * Setup Express routes
   */
  private setupRoutes(): Router {
    const router = Router();

    // Payment routes
    router.post('/initialize', this.paymentController.initializePayment.bind(this.paymentController));
    router.post('/process', this.paymentController.processPayment.bind(this.paymentController));
    router.get('/:id/verify', this.paymentController.verifyPayment.bind(this.paymentController));
    router.post('/:id/refund', this.paymentController.refundPayment.bind(this.paymentController));
    router.get('/:id', this.paymentController.getPayment.bind(this.paymentController));
    
    // Payment queries
    router.get('/order/:orderId', this.paymentController.getPaymentsByOrder.bind(this.paymentController));
    router.get('/customer/:customerId', this.paymentController.getPaymentsByCustomer.bind(this.paymentController));
    
    // Gateway management
    router.get('/gateways', this.paymentController.getAvailableGateways.bind(this.paymentController));
    router.post('/test', this.paymentController.testGateway.bind(this.paymentController));
    
    // Health check
    router.get('/health', this.paymentController.healthCheck.bind(this.paymentController));
    
    // Webhook routes (with specific gateway handling)
    router.post('/webhook/:gateway', this.webhookHandler.handleWebhook.bind(this.webhookHandler));

    // Security and audit routes
    router.get('/security/audit', this.getSecurityAuditLogs.bind(this));
    router.get('/webhooks/stats', this.getWebhookStats.bind(this));
    router.get('/webhooks/events/:eventId', this.getWebhookEvent.bind(this));

    // Order integration routes (if order service is available)
    if (this.orderIntegration) {
      router.post('/orders/:orderId/pay', this.processOrderPayment.bind(this));
      router.get('/orders/:orderId/status', this.getOrderPaymentStatus.bind(this));
      router.post('/orders/:orderId/refund', this.processOrderRefund.bind(this));
      router.get('/orders/:orderId/verify', this.verifyOrderPayment.bind(this));
      router.get('/orders/:orderId/history', this.getOrderPaymentHistory.bind(this));
    }

    return router;
  }

  /**
   * Get security audit logs endpoint
   */
  private async getSecurityAuditLogs(req: any, res: any): Promise<void> {
    try {
      const filters = {
        startDate: req.query.startDate ? new Date(req.query.startDate) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate) : undefined,
        event: req.query.event,
        gateway: req.query.gateway,
        success: req.query.success !== undefined ? req.query.success === 'true' : undefined,
      };

      const logs = this.securityService.getAuditLogs(filters);
      
      res.json({
        success: true,
        data: logs,
        total: logs.length,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve audit logs',
        message: error.message,
      });
    }
  }

  /**
   * Get webhook statistics endpoint
   */
  private async getWebhookStats(req: any, res: any): Promise<void> {
    try {
      const stats = this.webhookHandler.getWebhookStats();
      
      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve webhook stats',
        message: error.message,
      });
    }
  }

  /**
   * Get webhook event endpoint
   */
  private async getWebhookEvent(req: any, res: any): Promise<void> {
    try {
      const eventId = req.params.eventId;
      const event = this.webhookHandler.getWebhookEvent(eventId);
      
      if (!event) {
        res.status(404).json({
          success: false,
          error: 'Webhook event not found',
        });
        return;
      }

      res.json({
        success: true,
        data: event,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve webhook event',
        message: error.message,
      });
    }
  }

  /**
   * Process order payment endpoint
   */
  private async processOrderPayment(req: any, res: any): Promise<void> {
    if (!this.orderIntegration) {
      res.status(503).json({
        success: false,
        error: 'Order integration not available',
      });
      return;
    }

    try {
      const orderId = req.params.orderId;
      const paymentData = req.body;

      // This would typically fetch the order from the order service
      // For now, we'll assume the order data is passed in the request
      const order = req.body.order;
      
      const result = await this.orderIntegration.processOrderPayment(order, paymentData);
      
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to process order payment',
        message: error.message,
      });
    }
  }

  /**
   * Get order payment status endpoint
   */
  private async getOrderPaymentStatus(req: any, res: any): Promise<void> {
    if (!this.orderIntegration) {
      res.status(503).json({
        success: false,
        error: 'Order integration not available',
      });
      return;
    }

    try {
      const orderId = req.params.orderId;
      const status = await this.orderIntegration.getOrderPaymentStatus(orderId);
      
      res.json({
        success: true,
        data: status,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get order payment status',
        message: error.message,
      });
    }
  }

  /**
   * Process order refund endpoint
   */
  private async processOrderRefund(req: any, res: any): Promise<void> {
    if (!this.orderIntegration) {
      res.status(503).json({
        success: false,
        error: 'Order integration not available',
      });
      return;
    }

    try {
      const orderId = req.params.orderId;
      const { amount, reason } = req.body;
      
      const result = await this.orderIntegration.processPartialRefund(orderId, amount, reason);
      
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to process order refund',
        message: error.message,
      });
    }
  }

  /**
   * Verify order payment endpoint
   */
  private async verifyOrderPayment(req: any, res: any): Promise<void> {
    if (!this.orderIntegration) {
      res.status(503).json({
        success: false,
        error: 'Order integration not available',
      });
      return;
    }

    try {
      const orderId = req.params.orderId;
      const paymentId = req.query.paymentId as string;
      
      const result = await this.orderIntegration.verifyOrderPayment(orderId, paymentId);
      
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to verify order payment',
        message: error.message,
      });
    }
  }

  /**
   * Get order payment history endpoint
   */
  private async getOrderPaymentHistory(req: any, res: any): Promise<void> {
    if (!this.orderIntegration) {
      res.status(503).json({
        success: false,
        error: 'Order integration not available',
      });
      return;
    }

    try {
      const orderId = req.params.orderId;
      const history = await this.orderIntegration.getOrderPaymentHistory(orderId);
      
      res.json({
        success: true,
        data: history,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get order payment history',
        message: error.message,
      });
    }
  }

  /**
   * Get the router for Express app integration
   */
  getRouter(): Router {
    return this.router;
  }

  /**
   * Get payment service (for direct access if needed)
   */
  getPaymentService(): PaymentService {
    return this.paymentService;
  }

  /**
   * Get security service (for direct access if needed)
   */
  getSecurityService(): PaymentSecurityService {
    return this.securityService;
  }

  /**
   * Get webhook handler (for direct access if needed)
   */
  getWebhookHandler(): WebhookHandlerService {
    return this.webhookHandler;
  }

  /**
   * Get order integration (for direct access if needed)
   */
  getOrderIntegration(): OrderPaymentIntegration | undefined {
    return this.orderIntegration;
  }

  /**
   * Cleanup method (call on app shutdown)
   */
  async cleanup(): Promise<void> {
    // Cleanup rate limits
    this.securityService.cleanupRateLimits();
    
    // Cleanup old webhook events
    this.webhookHandler.cleanupOldEvents();
    
    // Any other cleanup tasks
    console.log('Payment module cleanup completed');
  }
}

/**
 * Factory function to create payment module with default configuration
 */
export function createPaymentModule(config: Partial<PaymentModuleConfig>): PaymentModule {
  const defaultConfig: PaymentModuleConfig = {
    gateways: {
      [PaymentGateway.KAKAO_PAY]: {
        gateway: PaymentGateway.KAKAO_PAY,
        enabled: false,
        sandbox: true,
        credentials: {},
        supportedMethods: [],
        supportedCurrencies: [],
      },
      [PaymentGateway.NAVER_PAY]: {
        gateway: PaymentGateway.NAVER_PAY,
        enabled: false,
        sandbox: true,
        credentials: {},
        supportedMethods: [],
        supportedCurrencies: [],
      },
      [PaymentGateway.TOSS_PAY]: {
        gateway: PaymentGateway.TOSS_PAY,
        enabled: false,
        sandbox: true,
        credentials: {},
        supportedMethods: [],
        supportedCurrencies: [],
      },
      [PaymentGateway.NICE_PAY]: {
        gateway: PaymentGateway.NICE_PAY,
        enabled: false,
        sandbox: true,
        credentials: {},
        supportedMethods: [],
        supportedCurrencies: [],
      },
      [PaymentGateway.BANK_TRANSFER]: {
        gateway: PaymentGateway.BANK_TRANSFER,
        enabled: false,
        sandbox: true,
        credentials: {},
        supportedMethods: [],
        supportedCurrencies: [],
      },
    },
    security: {
      encryptionKey: process.env.PAYMENT_ENCRYPTION_KEY || 'default-key-change-in-production',
      tokenSecret: process.env.PAYMENT_TOKEN_SECRET || 'default-secret-change-in-production',
      webhookSecrets: {},
      maxTokenAge: 1800, // 30 minutes
      rateLimits: {
        paymentInit: { requests: 10, window: 60 },
        webhooks: { requests: 100, window: 60 },
      },
      pciCompliance: {
        logSensitiveData: false,
        encryptStoredData: true,
        tokenizeCardNumbers: true,
      },
    },
    webhooks: {
      retryAttempts: 3,
      retryDelay: 5000, // 5 seconds
      timeoutMs: 30000, // 30 seconds
      enableLogging: true,
    },
  };

  // Merge with provided config
  const mergedConfig = {
    ...defaultConfig,
    ...config,
    gateways: { ...defaultConfig.gateways, ...config.gateways },
    security: { ...defaultConfig.security, ...config.security },
    webhooks: { ...defaultConfig.webhooks, ...config.webhooks },
  };

  return new PaymentModule(mergedConfig);
}