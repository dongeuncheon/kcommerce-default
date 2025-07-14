import axios from 'axios'
import crypto from 'crypto'
import { PaymentGateway, PaymentRequest, RefundRequest } from '../paymentGateway'
import { 
  PaymentInitiationResponse, 
  GatewayResponse,
  PaymentReceipt 
} from '../../../types/payment'
import { AppError } from '../../../middleware/error'
import { logger } from '../../../utils/logger'

interface InicisConfig {
  mid: string
  signKey: string
  apiUrl: string
  testMode: boolean
}

export class InicisGateway extends PaymentGateway {
  private apiUrl: string

  constructor(config: InicisConfig) {
    super(config)
    this.validateConfig()
    
    this.apiUrl = config.testMode 
      ? 'https://stgstdpay.inicis.com'
      : 'https://stdpay.inicis.com'
  }

  protected override validateConfig(): void {
    if (!this.config.mid) {
      throw new Error('Inicis MID is required')
    }
    if (!this.config.signKey) {
      throw new Error('Inicis sign key is required')
    }
  }

  private generateSignature(params: Record<string, any>): string {
    // Inicis signature generation
    const signData = Object.keys(params)
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&')
    
    return crypto
      .createHash('sha256')
      .update(signData + this.config.signKey)
      .digest('hex')
  }

  private generateTimestamp(): string {
    const now = new Date()
    return now.toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)
  }

  async initiatePayment(request: PaymentRequest): Promise<PaymentInitiationResponse> {
    try {
      const timestamp = this.generateTimestamp()
      const moid = this.generateOrderId(request.orderId)
      
      const paymentData = {
        mid: this.config.mid,
        oid: moid,
        amt: this.formatAmount(request.amount, request.currency),
        goodsName: `Order ${request.orderId}`,
        buyerName: request.customerName,
        buyerEmail: request.customerEmail,
        buyerTel: request.customerPhone || '',
        timestamp,
        returnUrl: request.returnUrl,
        closeUrl: request.cancelUrl,
        mKey: this.generateSignature({
          mid: this.config.mid,
          oid: moid,
          amt: this.formatAmount(request.amount, request.currency),
          timestamp,
        }),
      }

      // Inicis uses form-based payment page
      // Return session data for frontend to create payment form
      const paymentId = `inicis_${moid}`
      
      return {
        paymentId,
        sessionData: {
          formUrl: `${this.apiUrl}/stdpay/INIStdPay.jsp`,
          formData: paymentData,
        },
        expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
      }
    } catch (error) {
      logger.error('Inicis initiate payment error:', error)
      throw new AppError('Failed to initiate payment', 500)
    }
  }

  async confirmPayment(_paymentId: string, data: any): Promise<GatewayResponse> {
    try {
      const { authToken, authUrl } = data

      // Verify payment with auth token
      const response = await axios.post(
        authUrl,
        {
          mid: this.config.mid,
          authToken,
          timestamp: this.generateTimestamp(),
        },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      )

      if (response.data.resultCode === '0000') {
        return {
          success: true,
          transactionId: response.data.tid,
          approvalNumber: response.data.authCode,
          rawResponse: response.data,
        }
      } else {
        return {
          success: false,
          errorCode: response.data.resultCode,
          errorMessage: response.data.resultMsg,
          rawResponse: response.data,
        }
      }
    } catch (error: any) {
      logger.error('Inicis confirm payment error:', error)
      
      return {
        success: false,
        errorCode: 'CONFIRM_ERROR',
        errorMessage: error.message,
      }
    }
  }

  async cancelPayment(paymentId: string, _reason: string): Promise<GatewayResponse> {
    try {
      // Inicis doesn't support direct payment cancellation before completion
      // This would typically be handled by letting the payment expire
      
      return {
        success: true,
        transactionId: paymentId,
      }
    } catch (error) {
      logger.error('Inicis cancel payment error:', error)
      
      return {
        success: false,
        errorCode: 'CANCEL_ERROR',
        errorMessage: 'Failed to cancel payment',
      }
    }
  }

  async refundPayment(request: RefundRequest): Promise<GatewayResponse> {
    try {
      const timestamp = this.generateTimestamp()
      
      const refundData = {
        type: 'Refund',
        mid: this.config.mid,
        tid: request.transactionId,
        msg: request.reason,
        amt: this.formatAmount(request.amount, 'KRW'),
        timestamp,
      }

      const refundDataWithHash = {
        ...refundData,
        hashData: this.generateSignature(refundData)
      }

      const response = await axios.post(
        `${this.apiUrl}/api/refund.jsp`,
        new URLSearchParams(refundDataWithHash as unknown as Record<string, string>),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      )

      if (response.data.resultCode === '00') {
        return {
          success: true,
          transactionId: response.data.tid,
          approvalNumber: response.data.cancelNum,
          rawResponse: response.data,
        }
      } else {
        return {
          success: false,
          errorCode: response.data.resultCode,
          errorMessage: response.data.resultMsg,
          rawResponse: response.data,
        }
      }
    } catch (error: any) {
      logger.error('Inicis refund payment error:', error)
      
      return {
        success: false,
        errorCode: 'REFUND_ERROR',
        errorMessage: error.message,
      }
    }
  }

  async getPaymentStatus(transactionId: string): Promise<GatewayResponse> {
    try {
      const timestamp = this.generateTimestamp()
      
      const queryData = {
        type: 'Query',
        mid: this.config.mid,
        tid: transactionId,
        timestamp,
      }

      const queryDataWithHash = {
        ...queryData,
        hashData: this.generateSignature(queryData)
      }

      const response = await axios.post(
        `${this.apiUrl}/api/inquire.jsp`,
        new URLSearchParams(queryDataWithHash),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      )

      if (response.data.resultCode === '00') {
        return {
          success: true,
          transactionId: response.data.tid,
          approvalNumber: response.data.authCode,
          rawResponse: response.data,
        }
      } else {
        return {
          success: false,
          errorCode: response.data.resultCode,
          errorMessage: response.data.resultMsg,
          rawResponse: response.data,
        }
      }
    } catch (error: any) {
      logger.error('Inicis get payment status error:', error)
      
      return {
        success: false,
        errorCode: 'QUERY_ERROR',
        errorMessage: error.message,
      }
    }
  }

  verifyWebhookSignature(payload: any, signature: string): boolean {
    try {
      // Inicis webhook verification
      const expectedSignature = this.generateSignature(payload)
      return signature === expectedSignature
    } catch (error) {
      logger.error('Inicis webhook verification error:', error)
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
        receiptNumber: `IN-${transactionId}`,
        issuedAt: new Date(),
        amount: parseInt(payment.amt),
        currency: 'KRW',
        taxAmount: parseInt(payment.tax || '0'),
        items: [{
          name: payment.goodsName || 'Order',
          quantity: 1,
          unitPrice: parseInt(payment.amt),
          totalPrice: parseInt(payment.amt),
        }],
        customerInfo: {
          name: payment.buyerName || 'Unknown',
          email: payment.buyerEmail || '',
          phone: payment.buyerTel,
        },
        paymentInfo: {
          method: payment.payMethod,
          transactionId,
          approvalNumber: payment.authCode,
        },
      }
    } catch (error) {
      logger.error('Inicis generate receipt error:', error)
      throw new AppError('Failed to generate receipt', 500)
    }
  }

  getSupportedMethods(): string[] {
    return [
      'Card',          // 신용카드
      'DirectBank',    // 실시간계좌이체
      'VBank',         // 가상계좌
      'HPP',           // 휴대폰
      'Culture',       // 문화상품권
      'HPMN',          // 해피머니
      'BCSH',          // 도서문화상품권
      'POINT',         // 포인트
      'EasyPay',       // 간편결제
    ]
  }

  getSupportedCurrencies(): string[] {
    return ['KRW'] // Inicis primarily supports KRW
  }
}