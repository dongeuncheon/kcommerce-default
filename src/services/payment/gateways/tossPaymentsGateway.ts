import axios from 'axios'
import { PaymentGateway, PaymentRequest, RefundRequest } from '../paymentGateway'
import { 
  PaymentInitiationResponse, 
  GatewayResponse,
  PaymentReceipt 
} from '../../../types/payment'
import { AppError } from '../../../middleware/error'
import { logger } from '../../../utils/logger'

interface TossPaymentsConfig {
  secretKey: string
  clientKey: string
  testMode: boolean
}

export class TossPaymentsGateway extends PaymentGateway {
  private apiUrl: string
  private headers: Record<string, string>

  constructor(config: TossPaymentsConfig) {
    super(config)
    this.validateConfig()
    
    this.apiUrl = config.testMode 
      ? 'https://api.tosspayments.com/v1'
      : 'https://api.tosspayments.com/v1'
    
    // Base64 encode the secret key for Basic Auth
    const authToken = Buffer.from(`${config.secretKey}:`).toString('base64')
    this.headers = {
      'Authorization': `Basic ${authToken}`,
      'Content-Type': 'application/json',
    }
  }

  protected override validateConfig(): void {
    if (!this.config.secretKey) {
      throw new Error('TossPayments secret key is required')
    }
    if (!this.config.clientKey) {
      throw new Error('TossPayments client key is required')
    }
  }

  async initiatePayment(request: PaymentRequest): Promise<PaymentInitiationResponse> {
    try {
      const paymentData = {
        amount: this.formatAmount(request.amount, request.currency),
        orderId: this.generateOrderId(request.orderId),
        orderName: `Order ${request.orderId}`,
        successUrl: request.returnUrl,
        failUrl: request.cancelUrl,
        customerName: request.customerName,
        customerEmail: request.customerEmail,
        customerMobilePhone: request.customerPhone,
        currency: request.currency === 'KRW' ? undefined : request.currency,
      }

      // TossPayments uses client-side payment widget
      // Return payment key and session data for frontend
      const paymentKey = `payment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      return {
        paymentId: paymentKey,
        paymentKey,
        sessionData: {
          clientKey: this.config.clientKey,
          amount: paymentData.amount,
          orderId: paymentData.orderId,
          orderName: paymentData.orderName,
          customerName: paymentData.customerName,
          customerEmail: paymentData.customerEmail,
        },
        expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
      }
    } catch (error) {
      logger.error('TossPayments initiate payment error:', error)
      throw new AppError('Failed to initiate payment', 500)
    }
  }

  async confirmPayment(paymentKey: string, data: any): Promise<GatewayResponse> {
    try {
      const { orderId, amount } = data

      const response = await axios.post(
        `${this.apiUrl}/payments/confirm`,
        {
          paymentKey,
          orderId,
          amount,
        },
        { headers: this.headers }
      )

      return {
        success: true,
        transactionId: response.data.paymentKey,
        approvalNumber: response.data.approvalNumber,
        rawResponse: response.data,
      }
    } catch (error: any) {
      logger.error('TossPayments confirm payment error:', error)
      
      return {
        success: false,
        errorCode: error.response?.data?.code || 'UNKNOWN_ERROR',
        errorMessage: error.response?.data?.message || error.message,
        rawResponse: error.response?.data,
      }
    }
  }

  async cancelPayment(paymentKey: string, reason: string): Promise<GatewayResponse> {
    try {
      const response = await axios.post(
        `${this.apiUrl}/payments/${paymentKey}/cancel`,
        {
          cancelReason: reason,
        },
        { headers: this.headers }
      )

      return {
        success: true,
        transactionId: response.data.paymentKey,
        rawResponse: response.data,
      }
    } catch (error: any) {
      logger.error('TossPayments cancel payment error:', error)
      
      return {
        success: false,
        errorCode: error.response?.data?.code || 'UNKNOWN_ERROR',
        errorMessage: error.response?.data?.message || error.message,
        rawResponse: error.response?.data,
      }
    }
  }

  async refundPayment(request: RefundRequest): Promise<GatewayResponse> {
    try {
      const response = await axios.post(
        `${this.apiUrl}/payments/${request.transactionId}/cancel`,
        {
          cancelAmount: this.formatAmount(request.amount, 'KRW'),
          cancelReason: request.reason,
          refundReceiveAccount: request.metadata?.refundAccount,
        },
        { headers: this.headers }
      )

      return {
        success: true,
        transactionId: response.data.cancels?.[0]?.transactionKey,
        approvalNumber: response.data.cancels?.[0]?.approvalNumber,
        rawResponse: response.data,
      }
    } catch (error: any) {
      logger.error('TossPayments refund payment error:', error)
      
      return {
        success: false,
        errorCode: error.response?.data?.code || 'UNKNOWN_ERROR',
        errorMessage: error.response?.data?.message || error.message,
        rawResponse: error.response?.data,
      }
    }
  }

  async getPaymentStatus(paymentKey: string): Promise<GatewayResponse> {
    try {
      const response = await axios.get(
        `${this.apiUrl}/payments/${paymentKey}`,
        { headers: this.headers }
      )

      return {
        success: true,
        transactionId: response.data.paymentKey,
        approvalNumber: response.data.approvalNumber,
        rawResponse: response.data,
      }
    } catch (error: any) {
      logger.error('TossPayments get payment status error:', error)
      
      return {
        success: false,
        errorCode: error.response?.data?.code || 'UNKNOWN_ERROR',
        errorMessage: error.response?.data?.message || error.message,
        rawResponse: error.response?.data,
      }
    }
  }

  verifyWebhookSignature(_payload: any, _signature: string): boolean {
    // TossPayments webhook verification
    // Implementation depends on their webhook signature method
    try {
      // TODO: Implement actual signature verification
      return true
    } catch (error) {
      logger.error('TossPayments webhook verification error:', error)
      return false
    }
  }

  async generateReceipt(paymentId: string, transactionId: string): Promise<PaymentReceipt> {
    try {
      const paymentData = await this.getPaymentStatus(transactionId)
      
      if (!paymentData.success || !paymentData.rawResponse) {
        throw new AppError('Failed to get payment data for receipt', 400)
      }

      const payment = paymentData.rawResponse

      return {
        paymentId,
        receiptNumber: `TP-${payment.paymentKey}`,
        issuedAt: new Date(),
        amount: payment.totalAmount,
        currency: payment.currency || 'KRW',
        taxAmount: payment.taxFreeAmount || 0,
        items: [{
          name: payment.orderName,
          quantity: 1,
          unitPrice: payment.totalAmount,
          totalPrice: payment.totalAmount,
        }],
        customerInfo: {
          name: payment.customerName || 'Unknown',
          email: payment.customerEmail || '',
          phone: payment.customerMobilePhone,
        },
        paymentInfo: {
          method: payment.method,
          transactionId: payment.paymentKey,
          approvalNumber: payment.approvalNumber,
        },
      }
    } catch (error) {
      logger.error('TossPayments generate receipt error:', error)
      throw new AppError('Failed to generate receipt', 500)
    }
  }

  getSupportedMethods(): string[] {
    return [
      'CARD',           // 신용/체크카드
      'VIRTUAL_ACCOUNT', // 가상계좌
      'TRANSFER',       // 계좌이체
      'MOBILE_PHONE',   // 휴대폰
      'GIFT_CARD',      // 상품권
      'EASY_PAY',       // 간편결제 (토스페이, 네이버페이, 카카오페이 등)
    ]
  }

  getSupportedCurrencies(): string[] {
    return ['KRW', 'USD', 'JPY', 'EUR', 'GBP', 'CNY', 'HKD']
  }
}