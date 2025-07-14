import { 
  PaymentInitiationResponse, 
  GatewayResponse,
  PaymentReceipt 
} from '../../types/payment'

export interface PaymentRequest {
  orderId: string
  amount: number
  currency: string
  customerName: string
  customerEmail: string
  customerPhone?: string
  returnUrl: string
  cancelUrl: string
  metadata?: Record<string, any>
}

export interface RefundRequest {
  paymentId: string
  transactionId: string
  amount: number
  reason: string
  metadata?: Record<string, any>
}

export abstract class PaymentGateway {
  protected config: any

  constructor(config: any) {
    this.config = config
  }

  // Initialize payment and return payment URL or session data
  abstract initiatePayment(request: PaymentRequest): Promise<PaymentInitiationResponse>

  // Confirm/verify payment after customer returns
  abstract confirmPayment(paymentId: string, data: any): Promise<GatewayResponse>

  // Cancel ongoing payment
  abstract cancelPayment(paymentId: string, reason: string): Promise<GatewayResponse>

  // Process refund
  abstract refundPayment(request: RefundRequest): Promise<GatewayResponse>

  // Get payment status
  abstract getPaymentStatus(transactionId: string): Promise<GatewayResponse>

  // Verify webhook signature
  abstract verifyWebhookSignature(payload: any, signature: string): boolean

  // Generate payment receipt
  abstract generateReceipt(paymentId: string, transactionId: string): Promise<PaymentReceipt>

  // Get supported payment methods
  abstract getSupportedMethods(): string[]

  // Get supported currencies
  abstract getSupportedCurrencies(): string[]

  // Validate configuration
  protected validateConfig(): void {
    // Override in subclasses to validate specific config
  }

  // Format amount for gateway (handle decimal places, currency conversion etc)
  protected formatAmount(amount: number, currency: string): number {
    // Most Korean gateways expect amount in won without decimals
    if (currency === 'KRW') {
      return Math.round(amount)
    }
    // For other currencies, convert to smallest unit (e.g., cents for USD)
    return Math.round(amount * 100)
  }

  // Generate unique order ID for gateway
  protected generateOrderId(orderId: string): string {
    // Some gateways have specific format requirements
    return `${orderId}_${Date.now()}`
  }
}