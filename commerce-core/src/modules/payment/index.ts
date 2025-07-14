/**
 * Payment Module Exports
 * Main entry point for the payment system
 */

// Core types and interfaces
export * from './payment.types';

// Main services
export { PaymentService } from './payment.service';
export { PaymentController } from './payment.controller';
export { PaymentRepository } from './payment.repository';

// Security
export { PaymentSecurityService, SecurityConfig } from './security/payment-security.service';

// Webhooks
export { WebhookHandlerService, WebhookConfig } from './webhooks/webhook-handler.service';

// Integrations
export { OrderPaymentIntegration } from './integrations/order-payment.integration';

// Gateway implementations
export { BasePaymentGateway } from './gateways/base.gateway';
export { KakaoPayGateway } from './gateways/kakao-pay.gateway';
export { NaverPayGateway } from './gateways/naver-pay.gateway';
export { TossPayGateway } from './gateways/toss-pay.gateway';
export { NicePayGateway } from './gateways/nicepay.gateway';
export { BankTransferGateway } from './gateways/bank-transfer.gateway';

// Main module
export { PaymentModule, PaymentModuleConfig, createPaymentModule } from './payment.module';

// Re-export commonly used types for convenience
export type {
  Payment,
  PaymentInitRequest,
  PaymentInitResponse,
  PaymentProcessRequest,
  PaymentVerifyRequest,
  PaymentVerifyResponse,
  RefundRequest,
  RefundResponse,
  WebhookPayload,
  IPaymentGateway,
  IPaymentService,
  IPaymentRepository,
} from './payment.types';