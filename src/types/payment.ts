import { z } from 'zod'

// Payment validation schemas
export const InitiatePaymentSchema = z.object({
  orderId: z.string().cuid('Invalid order ID'),
  paymentMethodId: z.string().cuid('Invalid payment method ID').optional(),
  gateway: z.enum(['TOSS_PAYMENTS', 'INICIS', 'KCP', 'STRIPE', 'PAYPAL']),
  savePaymentMethod: z.boolean().default(false),
  returnUrl: z.string().url('Invalid return URL'),
  cancelUrl: z.string().url('Invalid cancel URL'),
  metadata: z.record(z.any()).optional(),
})

export const ConfirmPaymentSchema = z.object({
  paymentId: z.string().cuid('Invalid payment ID'),
  transactionId: z.string().min(1, 'Transaction ID is required'),
  gatewayResponse: z.record(z.any()),
})

export const CancelPaymentSchema = z.object({
  reason: z.enum([
    'CUSTOMER_REQUEST',
    'FRAUD_DETECTED',
    'INSUFFICIENT_FUNDS',
    'TECHNICAL_ERROR',
    'OTHER',
  ]),
  description: z.string().max(500).optional(),
})

export const RefundPaymentSchema = z.object({
  amount: z.number().positive('Refund amount must be positive'),
  reason: z.enum([
    'CUSTOMER_REQUEST',
    'DUPLICATE_PAYMENT',
    'FRAUDULENT_TRANSACTION',
    'PRODUCT_ISSUE',
    'OTHER',
  ]),
  description: z.string().max(500).optional(),
})

export const PaymentQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().min(1)).default('1'),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).default('10'),
  orderId: z.string().cuid().optional(),
  userId: z.string().cuid().optional(),
  status: z.enum([
    'PENDING',
    'PROCESSING',
    'COMPLETED',
    'FAILED',
    'CANCELLED',
    'REFUNDED',
    'PARTIALLY_REFUNDED',
  ]).optional(),
  gateway: z.string().optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  sortBy: z.enum(['createdAt', 'amount', 'status']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

export const PaymentParamsSchema = z.object({
  id: z.string().cuid('Invalid payment ID'),
})

export const SavePaymentMethodSchema = z.object({
  type: z.enum([
    'CREDIT_CARD',
    'DEBIT_CARD',
    'BANK_TRANSFER',
    'DIGITAL_WALLET',
  ]),
  provider: z.string().min(1, 'Provider is required'),
  token: z.string().min(1, 'Token is required'),
  last4: z.string().length(4).optional(),
  expiryMonth: z.number().int().min(1).max(12).optional(),
  expiryYear: z.number().int().min(new Date().getFullYear()).optional(),
  brand: z.string().optional(),
  holderName: z.string().optional(),
  isDefault: z.boolean().default(false),
})

export const WebhookPayloadSchema = z.object({
  gateway: z.string(),
  event: z.string(),
  data: z.record(z.any()),
  signature: z.string().optional(),
})

// Korean payment gateway specific schemas
export const TossPaymentsRequestSchema = z.object({
  amount: z.number().positive(),
  orderId: z.string(),
  orderName: z.string(),
  successUrl: z.string().url(),
  failUrl: z.string().url(),
  customerName: z.string().optional(),
  customerEmail: z.string().email().optional(),
  customerMobilePhone: z.string().optional(),
  taxFreeAmount: z.number().optional(),
  metadata: z.record(z.any()).optional(),
})

export const InicisRequestSchema = z.object({
  amt: z.number().positive(),
  mid: z.string(),
  oid: z.string(),
  goodsName: z.string(),
  buyerName: z.string(),
  buyerEmail: z.string().email(),
  buyerTel: z.string(),
  returnUrl: z.string().url(),
  closeUrl: z.string().url(),
  gopaymethod: z.string().optional(),
  acceptmethod: z.string().optional(),
})

export const KCPRequestSchema = z.object({
  site_cd: z.string(),
  ordr_idxx: z.string(),
  good_name: z.string(),
  good_mny: z.number().positive(),
  buyr_name: z.string(),
  buyr_mail: z.string().email(),
  buyr_tel1: z.string(),
  buyr_tel2: z.string(),
  ret_url: z.string().url(),
  currency: z.string().default('WON'),
})

// Response type definitions
export type InitiatePaymentInput = z.infer<typeof InitiatePaymentSchema>
export type ConfirmPaymentInput = z.infer<typeof ConfirmPaymentSchema>
export type CancelPaymentInput = z.infer<typeof CancelPaymentSchema>
export type RefundPaymentInput = z.infer<typeof RefundPaymentSchema>
export type PaymentQueryInput = z.infer<typeof PaymentQuerySchema>
export type PaymentParamsInput = z.infer<typeof PaymentParamsSchema>
export type SavePaymentMethodInput = z.infer<typeof SavePaymentMethodSchema>
export type WebhookPayloadInput = z.infer<typeof WebhookPayloadSchema>
export type TossPaymentsRequestInput = z.infer<typeof TossPaymentsRequestSchema>
export type InicisRequestInput = z.infer<typeof InicisRequestSchema>
export type KCPRequestInput = z.infer<typeof KCPRequestSchema>

// Payment interfaces
export interface PaymentDetails {
  id: string
  orderId: string
  amount: number
  currency: string
  status: string
  gateway: string
  method?: string
  transactionId?: string
  gatewayResponse?: Record<string, any>
  processedAt?: Date
  metadata?: Record<string, any>
  createdAt: Date
  updatedAt: Date
}

export interface PaymentWithOrder extends PaymentDetails {
  order: {
    id: string
    orderNumber: string
    userId: string
    total: number
    status: string
    customer: {
      id: string
      firstName: string
      lastName: string
      email: string
    }
  }
}

export interface PaymentMethod {
  id: string
  userId: string
  type: string
  provider: string
  last4?: string
  expiryMonth?: number
  expiryYear?: number
  brand?: string
  holderName?: string
  isDefault: boolean
  isExpired: boolean
  createdAt: Date
  updatedAt: Date
}

export interface PaymentGatewayConfig {
  gateway: string
  apiKey?: string
  secretKey?: string
  merchantId?: string
  testMode: boolean
  webhookSecret?: string
  supportedMethods: string[]
  supportedCurrencies: string[]
}

export interface PaymentSession {
  id: string
  paymentId: string
  gateway: string
  sessionData: Record<string, any>
  expiresAt: Date
  createdAt: Date
}

export interface PaymentReceipt {
  paymentId: string
  receiptNumber: string
  issuedAt: Date
  amount: number
  currency: string
  taxAmount: number
  items: Array<{
    name: string
    quantity: number
    unitPrice: number
    totalPrice: number
  }>
  customerInfo: {
    name: string
    email: string
    phone?: string
  }
  paymentInfo: {
    method: string
    transactionId: string
    approvalNumber?: string
  }
}

export interface PaymentAnalytics {
  totalPayments: number
  totalAmount: number
  averagePaymentAmount: number
  paymentsByStatus: Array<{
    status: string
    count: number
    amount: number
  }>
  paymentsByGateway: Array<{
    gateway: string
    count: number
    amount: number
    successRate: number
  }>
  recentPayments: PaymentDetails[]
}

// Payment gateway response types
export interface GatewayResponse {
  success: boolean
  transactionId?: string
  approvalNumber?: string
  errorCode?: string
  errorMessage?: string
  rawResponse?: Record<string, any>
}

export interface PaymentInitiationResponse {
  paymentId: string
  paymentUrl?: string
  paymentKey?: string
  sessionData?: Record<string, any>
  expiresAt: Date
}

// Payment event types for WebSocket
export interface PaymentEvent {
  type: 'PAYMENT_INITIATED' | 'PAYMENT_COMPLETED' | 'PAYMENT_FAILED' | 'PAYMENT_CANCELLED' | 'PAYMENT_REFUNDED'
  paymentId: string
  orderId: string
  userId: string
  data: any
  timestamp: Date
}
