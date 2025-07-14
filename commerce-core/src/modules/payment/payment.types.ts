/**
 * Payment Module Types
 * Supports multiple Korean payment gateways with unified interfaces
 */

import { BaseEntity } from '../../types/entities/base.entity';

/**
 * Supported payment gateway types
 */
export enum PaymentGateway {
  KAKAO_PAY = 'kakao_pay',
  NAVER_PAY = 'naver_pay',
  TOSS_PAY = 'toss_pay',
  NICE_PAY = 'nice_pay',
  BANK_TRANSFER = 'bank_transfer',
}

/**
 * Payment status types
 */
export enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
  PARTIALLY_REFUNDED = 'partially_refunded',
}

/**
 * Payment method types
 */
export enum PaymentMethod {
  CREDIT_CARD = 'credit_card',
  DEBIT_CARD = 'debit_card',
  MOBILE_PAYMENT = 'mobile_payment',
  BANK_TRANSFER = 'bank_transfer',
  VIRTUAL_ACCOUNT = 'virtual_account',
  EASY_PAYMENT = 'easy_payment', // 간편결제
}

/**
 * Currency types
 */
export enum Currency {
  KRW = 'KRW',
  USD = 'USD',
  JPY = 'JPY',
  EUR = 'EUR',
}

/**
 * Base payment entity
 */
export interface Payment extends BaseEntity {
  paymentId: string;
  orderId: string;
  customerId: string;
  gateway: PaymentGateway;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: number;
  currency: Currency;
  description?: string;
  metadata?: Record<string, any>;
  gatewayTransactionId?: string;
  gatewayResponseData?: Record<string, any>;
  failureReason?: string;
  refundedAmount?: number;
  webhookData?: Record<string, any>;
  paidAt?: Date;
  failedAt?: Date;
  refundedAt?: Date;
}

/**
 * Payment initialization request
 */
export interface PaymentInitRequest {
  orderId: string;
  customerId: string;
  gateway: PaymentGateway;
  method?: PaymentMethod;
  amount: number;
  currency: Currency;
  description?: string;
  returnUrl: string;
  cancelUrl: string;
  webhookUrl?: string;
  metadata?: Record<string, any>;
  customerInfo?: CustomerInfo;
  items?: PaymentItem[];
}

/**
 * Payment initialization response
 */
export interface PaymentInitResponse {
  paymentId: string;
  gateway: PaymentGateway;
  redirectUrl?: string;
  mobileUrl?: string;
  qrCodeUrl?: string;
  virtualAccount?: VirtualAccountInfo;
  expiresAt?: Date;
  additionalData?: Record<string, any>;
}

/**
 * Payment process request
 */
export interface PaymentProcessRequest {
  paymentId: string;
  gateway: PaymentGateway;
  gatewayData: Record<string, any>;
}

/**
 * Payment verification request
 */
export interface PaymentVerifyRequest {
  paymentId: string;
  gatewayTransactionId?: string;
}

/**
 * Payment verification response
 */
export interface PaymentVerifyResponse {
  paymentId: string;
  orderId: string;
  status: PaymentStatus;
  amount: number;
  currency: Currency;
  paidAt?: Date;
  method?: PaymentMethod;
  cardInfo?: CardInfo;
  receiptUrl?: string;
}

/**
 * Refund request
 */
export interface RefundRequest {
  paymentId: string;
  amount: number;
  reason: string;
  requesterName?: string;
  bankInfo?: BankInfo;
}

/**
 * Refund response
 */
export interface RefundResponse {
  refundId: string;
  paymentId: string;
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  refundedAt?: Date;
  failureReason?: string;
}

/**
 * Webhook payload
 */
export interface WebhookPayload {
  gateway: PaymentGateway;
  eventType: string;
  timestamp: Date;
  signature?: string;
  data: Record<string, any>;
}

/**
 * Customer information for payment
 */
export interface CustomerInfo {
  name: string;
  email: string;
  phone: string;
  address?: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
}

/**
 * Payment item details
 */
export interface PaymentItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  category?: string;
}

/**
 * Virtual account information
 */
export interface VirtualAccountInfo {
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  dueDate: Date;
}

/**
 * Card information
 */
export interface CardInfo {
  cardNumber: string; // Masked
  cardType: 'credit' | 'debit' | 'prepaid';
  issuerCode: string;
  issuerName: string;
  acquirerCode?: string;
  acquirerName?: string;
  installmentMonths?: number;
}

/**
 * Bank information for refunds
 */
export interface BankInfo {
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
}

/**
 * Payment gateway configuration
 */
export interface PaymentGatewayConfig {
  gateway: PaymentGateway;
  enabled: boolean;
  sandbox: boolean;
  credentials: {
    clientId?: string;
    clientSecret?: string;
    merchantId?: string;
    apiKey?: string;
    secretKey?: string;
    [key: string]: any;
  };
  webhookSecret?: string;
  supportedMethods: PaymentMethod[];
  supportedCurrencies: Currency[];
}

/**
 * Payment gateway interface that all gateways must implement
 */
export interface IPaymentGateway {
  readonly gateway: PaymentGateway;
  
  /**
   * Initialize a payment
   */
  initializePayment(request: PaymentInitRequest): Promise<PaymentInitResponse>;
  
  /**
   * Process a payment (handle gateway callback)
   */
  processPayment(request: PaymentProcessRequest): Promise<Payment>;
  
  /**
   * Verify payment status
   */
  verifyPayment(request: PaymentVerifyRequest): Promise<PaymentVerifyResponse>;
  
  /**
   * Process refund
   */
  refundPayment(request: RefundRequest): Promise<RefundResponse>;
  
  /**
   * Validate webhook signature
   */
  validateWebhook(payload: WebhookPayload): Promise<boolean>;
  
  /**
   * Parse webhook data
   */
  parseWebhook(payload: WebhookPayload): Promise<Payment>;
  
  /**
   * Get supported payment methods
   */
  getSupportedMethods(): PaymentMethod[];
  
  /**
   * Get supported currencies
   */
  getSupportedCurrencies(): Currency[];
}

/**
 * Payment service interface
 */
export interface IPaymentService {
  initializePayment(request: PaymentInitRequest): Promise<PaymentInitResponse>;
  processPayment(request: PaymentProcessRequest): Promise<Payment>;
  verifyPayment(request: PaymentVerifyRequest): Promise<PaymentVerifyResponse>;
  refundPayment(request: RefundRequest): Promise<RefundResponse>;
  handleWebhook(gateway: PaymentGateway, payload: WebhookPayload): Promise<Payment>;
  getPayment(paymentId: string): Promise<Payment | null>;
  getPaymentsByOrder(orderId: string): Promise<Payment[]>;
  getPaymentsByCustomer(customerId: string): Promise<Payment[]>;
}

/**
 * Payment repository interface
 */
export interface IPaymentRepository {
  create(payment: Partial<Payment>): Promise<Payment>;
  findById(id: string): Promise<Payment | null>;
  findByPaymentId(paymentId: string): Promise<Payment | null>;
  findByOrderId(orderId: string): Promise<Payment[]>;
  findByCustomerId(customerId: string): Promise<Payment[]>;
  update(id: string, payment: Partial<Payment>): Promise<Payment>;
  updateStatus(paymentId: string, status: PaymentStatus): Promise<Payment>;
}

/**
 * Payment events
 */
export enum PaymentEvent {
  PAYMENT_INITIALIZED = 'payment.initialized',
  PAYMENT_PROCESSING = 'payment.processing',
  PAYMENT_COMPLETED = 'payment.completed',
  PAYMENT_FAILED = 'payment.failed',
  PAYMENT_CANCELLED = 'payment.cancelled',
  PAYMENT_REFUNDED = 'payment.refunded',
  PAYMENT_WEBHOOK_RECEIVED = 'payment.webhook_received',
}

/**
 * Payment event payloads
 */
export interface PaymentEventPayload {
  payment: Payment;
  previousStatus?: PaymentStatus;
  metadata?: Record<string, any>;
}