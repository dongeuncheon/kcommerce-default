/**
 * Webhook Handler Service
 * Centralized webhook handling for all payment gateways
 */

import { Request, Response } from 'express';
import { 
  IPaymentService,
  PaymentGateway,
  WebhookPayload,
  Payment,
} from '../payment.types';
import { PaymentSecurityService } from '../security/payment-security.service';

export interface WebhookConfig {
  retryAttempts: number;
  retryDelay: number; // in milliseconds
  timeoutMs: number;
  enableLogging: boolean;
}

export interface WebhookEvent {
  id: string;
  gateway: PaymentGateway;
  eventType: string;
  paymentId: string;
  timestamp: Date;
  payload: any;
  processed: boolean;
  retryCount: number;
  lastError?: string;
}

export class WebhookHandlerService {
  private webhookEvents: Map<string, WebhookEvent> = new Map();
  private retryQueue: WebhookEvent[] = [];

  constructor(
    private paymentService: IPaymentService,
    private securityService: PaymentSecurityService,
    private config: WebhookConfig
  ) {
    // Start retry processor
    this.startRetryProcessor();
  }

  /**
   * Handle webhook from any payment gateway
   */
  async handleWebhook(req: Request, res: Response): Promise<void> {
    const gateway = req.params.gateway as PaymentGateway;
    const startTime = Date.now();
    
    try {
      // Extract client IP for security logging
      const clientIP = this.securityService.extractClientIP(req);
      
      // Check rate limits
      if (!this.securityService.checkRateLimit('webhooks', clientIP)) {
        res.status(429).json({ error: 'Rate limit exceeded' });
        return;
      }

      // Validate gateway
      if (!Object.values(PaymentGateway).includes(gateway)) {
        res.status(400).json({ error: 'Invalid gateway' });
        return;
      }

      // Extract signature from headers (different gateways use different header names)
      const signature = this.extractSignature(req, gateway);
      
      // Create webhook payload
      const webhookPayload: WebhookPayload = {
        gateway,
        eventType: this.extractEventType(req.body, gateway),
        timestamp: new Date(),
        signature,
        data: req.body,
      };

      // Verify webhook signature
      if (signature && !this.securityService.verifyWebhookSignature(gateway, req.body, signature)) {
        this.securityService.auditLog({
          event: 'WEBHOOK_SIGNATURE_INVALID',
          gateway,
          ipAddress: clientIP,
          success: false,
          errorMessage: 'Webhook signature verification failed',
        });
        
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }

      // Create webhook event record
      const webhookEvent: WebhookEvent = {
        id: this.generateWebhookEventId(),
        gateway,
        eventType: webhookPayload.eventType,
        paymentId: this.extractPaymentId(webhookPayload.data, gateway),
        timestamp: new Date(),
        payload: webhookPayload.data,
        processed: false,
        retryCount: 0,
      };

      this.webhookEvents.set(webhookEvent.id, webhookEvent);

      // Process webhook
      await this.processWebhook(webhookEvent, webhookPayload);

      // Log processing time
      const processingTime = Date.now() - startTime;
      this.securityService.auditLog({
        event: 'WEBHOOK_PROCESSED',
        gateway,
        paymentId: webhookEvent.paymentId,
        ipAddress: clientIP,
        success: true,
        metadata: { processingTimeMs: processingTime },
      });

      res.status(200).json({ 
        success: true, 
        eventId: webhookEvent.id,
        processingTimeMs: processingTime,
      });
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      this.securityService.auditLog({
        event: 'WEBHOOK_PROCESSING_ERROR',
        gateway,
        ipAddress: this.securityService.extractClientIP(req),
        success: false,
        errorMessage: error.message,
        metadata: { processingTimeMs: processingTime },
      });

      console.error(`Webhook processing error for ${gateway}:`, error);
      res.status(500).json({ 
        error: 'Webhook processing failed',
        message: error.message,
      });
    }
  }

  /**
   * Process individual webhook event
   */
  private async processWebhook(webhookEvent: WebhookEvent, webhookPayload: WebhookPayload): Promise<void> {
    try {
      // Handle the webhook through payment service
      const payment = await this.paymentService.handleWebhook(webhookEvent.gateway, webhookPayload);
      
      // Mark as processed
      webhookEvent.processed = true;
      this.webhookEvents.set(webhookEvent.id, webhookEvent);

      // Gateway-specific post-processing
      await this.handleGatewaySpecificProcessing(webhookEvent, payment);

      if (this.config.enableLogging) {
        console.log(`Webhook processed successfully: ${webhookEvent.id}`, {
          gateway: webhookEvent.gateway,
          paymentId: webhookEvent.paymentId,
          eventType: webhookEvent.eventType,
        });
      }

    } catch (error) {
      webhookEvent.lastError = error.message;
      webhookEvent.retryCount++;
      
      // Add to retry queue if within retry limits
      if (webhookEvent.retryCount < this.config.retryAttempts) {
        this.retryQueue.push(webhookEvent);
        
        if (this.config.enableLogging) {
          console.warn(`Webhook processing failed, added to retry queue: ${webhookEvent.id}`, {
            error: error.message,
            retryCount: webhookEvent.retryCount,
          });
        }
      } else {
        // Maximum retries reached
        this.securityService.auditLog({
          event: 'WEBHOOK_MAX_RETRIES_EXCEEDED',
          gateway: webhookEvent.gateway,
          paymentId: webhookEvent.paymentId,
          success: false,
          errorMessage: `Max retries exceeded: ${error.message}`,
          metadata: { retryCount: webhookEvent.retryCount },
        });
      }

      this.webhookEvents.set(webhookEvent.id, webhookEvent);
      throw error;
    }
  }

  /**
   * Handle gateway-specific post-processing
   */
  private async handleGatewaySpecificProcessing(webhookEvent: WebhookEvent, payment: Payment): Promise<void> {
    switch (webhookEvent.gateway) {
      case PaymentGateway.KAKAO_PAY:
        await this.handleKakaoPayWebhook(webhookEvent, payment);
        break;
      case PaymentGateway.NAVER_PAY:
        await this.handleNaverPayWebhook(webhookEvent, payment);
        break;
      case PaymentGateway.TOSS_PAY:
        await this.handleTossPayWebhook(webhookEvent, payment);
        break;
      case PaymentGateway.NICE_PAY:
        await this.handleNicePayWebhook(webhookEvent, payment);
        break;
      case PaymentGateway.BANK_TRANSFER:
        await this.handleBankTransferWebhook(webhookEvent, payment);
        break;
    }
  }

  /**
   * Handle Kakao Pay specific webhook processing
   */
  private async handleKakaoPayWebhook(webhookEvent: WebhookEvent, payment: Payment): Promise<void> {
    // Kakao Pay doesn't have official webhooks, but if they did...
    // This is where you'd handle Kakao Pay specific logic
    if (this.config.enableLogging) {
      console.log('Kakao Pay webhook processed (note: Kakao Pay does not support webhooks natively)');
    }
  }

  /**
   * Handle Naver Pay specific webhook processing
   */
  private async handleNaverPayWebhook(webhookEvent: WebhookEvent, payment: Payment): Promise<void> {
    const eventData = webhookEvent.payload;
    
    // Handle different Naver Pay event types
    switch (webhookEvent.eventType) {
      case 'PAYMENT_APPROVED':
        // Send confirmation receipt or update inventory
        break;
      case 'PAYMENT_CANCELED':
        // Handle cancellation logic
        break;
    }
  }

  /**
   * Handle Toss Payments specific webhook processing
   */
  private async handleTossPayWebhook(webhookEvent: WebhookEvent, payment: Payment): Promise<void> {
    const eventData = webhookEvent.payload;
    
    // Toss Payments webhook events
    switch (webhookEvent.eventType) {
      case 'Payment.PaymentStatusChanged':
        // Handle payment status changes
        break;
      case 'Payment.Canceled':
        // Handle payment cancellations
        break;
    }
  }

  /**
   * Handle NicePay specific webhook processing
   */
  private async handleNicePayWebhook(webhookEvent: WebhookEvent, payment: Payment): Promise<void> {
    const eventData = webhookEvent.payload;
    
    // NicePay webhook processing
    switch (eventData.ResultCode) {
      case '3001': // Success
        // Handle successful payment
        break;
      case '4100': // Cancel
        // Handle cancellation
        break;
    }
  }

  /**
   * Handle Bank Transfer specific webhook processing
   */
  private async handleBankTransferWebhook(webhookEvent: WebhookEvent, payment: Payment): Promise<void> {
    const eventData = webhookEvent.payload;
    
    // Bank transfer confirmation processing
    if (eventData.depositAmount && eventData.depositorName) {
      // Additional verification or notification logic
    }
  }

  /**
   * Start retry processor (runs in background)
   */
  private startRetryProcessor(): void {
    setInterval(async () => {
      if (this.retryQueue.length === 0) return;

      const eventsToRetry = this.retryQueue.splice(0, 5); // Process 5 at a time
      
      for (const webhookEvent of eventsToRetry) {
        try {
          await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
          
          const webhookPayload: WebhookPayload = {
            gateway: webhookEvent.gateway,
            eventType: webhookEvent.eventType,
            timestamp: webhookEvent.timestamp,
            data: webhookEvent.payload,
          };

          await this.processWebhook(webhookEvent, webhookPayload);
          
        } catch (error) {
          // Already handled in processWebhook
        }
      }
    }, this.config.retryDelay * 2);
  }

  /**
   * Extract signature from request headers based on gateway
   */
  private extractSignature(req: Request, gateway: PaymentGateway): string | undefined {
    switch (gateway) {
      case PaymentGateway.KAKAO_PAY:
        return req.headers['x-kakao-signature'] as string;
      case PaymentGateway.NAVER_PAY:
        return req.headers['x-naver-signature'] as string;
      case PaymentGateway.TOSS_PAY:
        return req.headers['x-toss-signature'] as string;
      case PaymentGateway.NICE_PAY:
        return req.headers['x-nice-signature'] as string;
      case PaymentGateway.BANK_TRANSFER:
        return req.headers['x-bank-signature'] as string;
      default:
        return req.headers['x-signature'] as string || req.headers['x-webhook-signature'] as string;
    }
  }

  /**
   * Extract event type from webhook payload based on gateway
   */
  private extractEventType(payload: any, gateway: PaymentGateway): string {
    switch (gateway) {
      case PaymentGateway.KAKAO_PAY:
        return payload.eventType || 'payment.status.changed';
      case PaymentGateway.NAVER_PAY:
        return payload.eventType || payload.event || 'payment.updated';
      case PaymentGateway.TOSS_PAY:
        return payload.eventType || 'Payment.PaymentStatusChanged';
      case PaymentGateway.NICE_PAY:
        return payload.eventType || 'payment.result';
      case PaymentGateway.BANK_TRANSFER:
        return payload.eventType || 'deposit.confirmed';
      default:
        return payload.eventType || 'payment.updated';
    }
  }

  /**
   * Extract payment ID from webhook payload based on gateway
   */
  private extractPaymentId(payload: any, gateway: PaymentGateway): string {
    switch (gateway) {
      case PaymentGateway.KAKAO_PAY:
        return payload.partner_order_id || payload.orderId;
      case PaymentGateway.NAVER_PAY:
        return payload.merchantPayKey || payload.paymentId;
      case PaymentGateway.TOSS_PAY:
        return payload.orderId || payload.paymentId;
      case PaymentGateway.NICE_PAY:
        return payload.Moid || payload.ReqReserved;
      case PaymentGateway.BANK_TRANSFER:
        return payload.paymentId || payload.orderId;
      default:
        return payload.paymentId || payload.orderId || 'unknown';
    }
  }

  /**
   * Generate unique webhook event ID
   */
  private generateWebhookEventId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2);
    return `WHK_${timestamp}_${random}`.toUpperCase();
  }

  /**
   * Get webhook event by ID
   */
  getWebhookEvent(eventId: string): WebhookEvent | undefined {
    return this.webhookEvents.get(eventId);
  }

  /**
   * Get webhook events by payment ID
   */
  getWebhookEventsByPaymentId(paymentId: string): WebhookEvent[] {
    return Array.from(this.webhookEvents.values())
      .filter(event => event.paymentId === paymentId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get webhook events by gateway
   */
  getWebhookEventsByGateway(gateway: PaymentGateway): WebhookEvent[] {
    return Array.from(this.webhookEvents.values())
      .filter(event => event.gateway === gateway)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get failed webhook events
   */
  getFailedWebhookEvents(): WebhookEvent[] {
    return Array.from(this.webhookEvents.values())
      .filter(event => !event.processed && event.retryCount >= this.config.retryAttempts)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get webhook statistics
   */
  getWebhookStats(): {
    totalEvents: number;
    processedEvents: number;
    failedEvents: number;
    retryQueueSize: number;
    gatewayBreakdown: Record<PaymentGateway, number>;
  } {
    const events = Array.from(this.webhookEvents.values());
    
    const gatewayBreakdown: Record<PaymentGateway, number> = {
      [PaymentGateway.KAKAO_PAY]: 0,
      [PaymentGateway.NAVER_PAY]: 0,
      [PaymentGateway.TOSS_PAY]: 0,
      [PaymentGateway.NICE_PAY]: 0,
      [PaymentGateway.BANK_TRANSFER]: 0,
    };

    events.forEach(event => {
      gatewayBreakdown[event.gateway]++;
    });

    return {
      totalEvents: events.length,
      processedEvents: events.filter(e => e.processed).length,
      failedEvents: events.filter(e => !e.processed && e.retryCount >= this.config.retryAttempts).length,
      retryQueueSize: this.retryQueue.length,
      gatewayBreakdown,
    };
  }

  /**
   * Clean up old webhook events (call periodically)
   */
  cleanupOldEvents(daysOld: number = 30): number {
    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
    let cleanedCount = 0;
    
    for (const [eventId, event] of this.webhookEvents.entries()) {
      if (event.timestamp < cutoffDate) {
        this.webhookEvents.delete(eventId);
        cleanedCount++;
      }
    }
    
    return cleanedCount;
  }
}