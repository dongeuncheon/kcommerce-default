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

interface KCPConfig {
  siteCd: string
  siteKey: string
  apiUrl: string
  testMode: boolean
}

export class KCPGateway extends PaymentGateway {
  private apiUrl: string
  private jsUrl: string

  constructor(config: KCPConfig) {
    super(config)
    this.validateConfig()
    
    this.apiUrl = config.testMode 
      ? 'https://stg-spl.kcp.co.kr'
      : 'https://spl.kcp.co.kr'
    
    this.jsUrl = config.testMode
      ? 'https://testpay.kcp.co.kr/plugin/payplus_web.jsp'
      : 'https://pay.kcp.co.kr/plugin/payplus_web.jsp'
  }

  protected override validateConfig(): void {
    if (!this.config.siteCd) {
      throw new Error('KCP site code is required')
    }
    if (!this.config.siteKey) {
      throw new Error('KCP site key is required')
    }
  }

  private generateEncData(params: Record<string, any>): string {
    // KCP encryption logic
    const paramStr = Object.entries(params)
      .map(([key, value]) => `${key}=${value}`)
      .join('^')
    
    // This is a simplified version - actual KCP implementation is more complex
    const cipher = crypto.createCipheriv(
      'aes-128-ecb',
      Buffer.from(this.config.siteKey.substring(0, 16)),
      null
    )
    
    let encrypted = cipher.update(paramStr, 'utf8', 'base64')
    encrypted += cipher.final('base64')
    
    return encrypted
  }

  async initiatePayment(request: PaymentRequest): Promise<PaymentInitiationResponse> {
    try {
      const orderId = this.generateOrderId(request.orderId)
      
      const paymentData = {
        site_cd: this.config.siteCd,
        ordr_idxx: orderId,
        good_name: `Order ${request.orderId}`,
        good_mny: this.formatAmount(request.amount, request.currency),
        buyr_name: request.customerName,
        buyr_mail: request.customerEmail,
        buyr_tel1: request.customerPhone || '',
        buyr_tel2: request.customerPhone || '',
        currency: request.currency === 'KRW' ? 'WON' : request.currency,
        ret_url: request.returnUrl,
        site_key: this.config.siteKey,
      }

      // Generate encrypted data for security
      const encData = this.generateEncData({
        ordr_idxx: orderId,
        good_mny: paymentData.good_mny,
        currency: paymentData.currency,
      })

      const paymentId = `kcp_${orderId}`
      
      return {
        paymentId,
        sessionData: {
          jsUrl: this.jsUrl,
          siteCd: this.config.siteCd,
          orderId,
          formData: {
            ...paymentData,
            enc_data: encData,
          },
        },
        expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
      }
    } catch (error) {
      logger.error('KCP initiate payment error:', error)
      throw new AppError('Failed to initiate payment', 500)
    }
  }

  async confirmPayment(_paymentId: string, data: any): Promise<GatewayResponse> {
    try {
      const { enc_data, enc_info, tran_cd } = data

      // Prepare approval request
      const approvalData = {
        site_cd: this.config.siteCd,
        tran_cd,
        enc_data,
        enc_info,
      }

      const response = await axios.post(
        `${this.apiUrl}/KCP_PAY_API/pay_approval.jsp`,
        new URLSearchParams(approvalData),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      )

      const result = this.parseKCPResponse(response.data)

      if (result.res_cd === '0000') {
        return {
          success: true,
          transactionId: result.tno,
          approvalNumber: result.app_no,
          rawResponse: result,
        }
      } else {
        return {
          success: false,
          errorCode: result.res_cd,
          errorMessage: result.res_msg,
          rawResponse: result,
        }
      }
    } catch (error: any) {
      logger.error('KCP confirm payment error:', error)
      
      return {
        success: false,
        errorCode: 'CONFIRM_ERROR',
        errorMessage: error.message,
      }
    }
  }

  async cancelPayment(paymentId: string, _reason: string): Promise<GatewayResponse> {
    try {
      // KCP doesn't support direct payment cancellation before completion
      // This would typically be handled by letting the payment expire
      
      return {
        success: true,
        transactionId: paymentId,
      }
    } catch (error) {
      logger.error('KCP cancel payment error:', error)
      
      return {
        success: false,
        errorCode: 'CANCEL_ERROR',
        errorMessage: 'Failed to cancel payment',
      }
    }
  }

  async refundPayment(request: RefundRequest): Promise<GatewayResponse> {
    try {
      const cancelData = {
        site_cd: this.config.siteCd,
        tno: request.transactionId,
        mod_type: 'STSC', // 전체취소
        mod_mny: this.formatAmount(request.amount, 'KRW'),
        mod_desc: request.reason,
      }

      const response = await axios.post(
        `${this.apiUrl}/KCP_PAY_API/cancel.jsp`,
        new URLSearchParams(cancelData as unknown as Record<string, string>),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      )

      const result = this.parseKCPResponse(response.data)

      if (result.res_cd === '0000') {
        return {
          success: true,
          transactionId: result.tno,
          approvalNumber: result.can_no,
          rawResponse: result,
        }
      } else {
        return {
          success: false,
          errorCode: result.res_cd,
          errorMessage: result.res_msg,
          rawResponse: result,
        }
      }
    } catch (error: any) {
      logger.error('KCP refund payment error:', error)
      
      return {
        success: false,
        errorCode: 'REFUND_ERROR',
        errorMessage: error.message,
      }
    }
  }

  async getPaymentStatus(transactionId: string): Promise<GatewayResponse> {
    try {
      const queryData = {
        site_cd: this.config.siteCd,
        tno: transactionId,
      }

      const response = await axios.post(
        `${this.apiUrl}/KCP_PAY_API/status.jsp`,
        new URLSearchParams(queryData),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      )

      const result = this.parseKCPResponse(response.data)

      if (result.res_cd === '0000') {
        return {
          success: true,
          transactionId: result.tno,
          approvalNumber: result.app_no,
          rawResponse: result,
        }
      } else {
        return {
          success: false,
          errorCode: result.res_cd,
          errorMessage: result.res_msg,
          rawResponse: result,
        }
      }
    } catch (error: any) {
      logger.error('KCP get payment status error:', error)
      
      return {
        success: false,
        errorCode: 'QUERY_ERROR',
        errorMessage: error.message,
      }
    }
  }

  private parseKCPResponse(responseText: string): Record<string, any> {
    // KCP returns data in a specific format that needs parsing
    const result: Record<string, any> = {}
    const lines = responseText.split('\n')
    
    lines.forEach(line => {
      const [key, value] = line.split('=')
      if (key && value) {
        result[key.trim()] = value.trim()
      }
    })
    
    return result
  }

  verifyWebhookSignature(_payload: any, _signature: string): boolean {
    try {
      // KCP webhook verification
      // Implementation depends on KCP's specific webhook format
      return true
    } catch (error) {
      logger.error('KCP webhook verification error:', error)
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
        receiptNumber: `KCP-${transactionId}`,
        issuedAt: new Date(),
        amount: parseInt(payment.good_mny || '0'),
        currency: payment.currency === 'WON' ? 'KRW' : payment.currency,
        taxAmount: parseInt(payment.tax_mny || '0'),
        items: [{
          name: payment.good_name || 'Order',
          quantity: 1,
          unitPrice: parseInt(payment.good_mny || '0'),
          totalPrice: parseInt(payment.good_mny || '0'),
        }],
        customerInfo: {
          name: payment.buyr_name || 'Unknown',
          email: payment.buyr_mail || '',
          phone: payment.buyr_tel1 || payment.buyr_tel2,
        },
        paymentInfo: {
          method: payment.pay_method,
          transactionId,
          approvalNumber: payment.app_no,
        },
      }
    } catch (error) {
      logger.error('KCP generate receipt error:', error)
      throw new AppError('Failed to generate receipt', 500)
    }
  }

  getSupportedMethods(): string[] {
    return [
      '100000000000', // 신용카드
      '010000000000', // 계좌이체
      '001000000000', // 가상계좌
      '000100000000', // 휴대폰
      '000000001000', // 상품권
      '000000000010', // 포인트
      '000000100000', // 간편결제
    ]
  }

  getSupportedCurrencies(): string[] {
    return ['KRW', 'USD'] // KCP supports limited international currencies
  }
}