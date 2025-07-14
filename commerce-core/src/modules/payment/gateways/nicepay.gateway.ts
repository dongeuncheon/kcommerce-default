/**
 * NicePay Gateway Implementation
 * Korean payment gateway primarily for credit card processing
 */

import { BasePaymentGateway } from './base.gateway';
import {
  PaymentGateway,
  PaymentInitRequest,
  PaymentInitResponse,
  PaymentProcessRequest,
  PaymentVerifyRequest,
  PaymentVerifyResponse,
  RefundRequest,
  RefundResponse,
  WebhookPayload,
  Payment,
  PaymentStatus,
  PaymentMethod,
  Currency,
} from '../payment.types';

interface NicePayResponse {
  ResultCode: string;
  ResultMsg: string;
  MID: string;
  TID: string;
  PayMethod: string;
  TxTmn: string;
  Moid: string;
  Amt: string;
  ReqReserved?: string;
  AuthDate?: string;
  AuthCode?: string;
  CardCode?: string;
  CardName?: string;
  CardQuota?: string;
  CardNum?: string;
  CardInterest?: string;
  AcquCardCode?: string;
  AcquCardName?: string;
  VbankCode?: string;
  VbankName?: string;
  VbankNum?: string;
  VbankExpDate?: string;
  VbankInputName?: string;
  NextAppURL?: string;
  NextUrl?: string;
  NetCancelURL?: string;
  charset?: string;
}

export class NicePayGateway extends BasePaymentGateway {
  readonly gateway = PaymentGateway.NICE_PAY;

  constructor(config: any) {
    super({
      ...config,
      gateway: PaymentGateway.NICE_PAY,
      supportedMethods: [
        PaymentMethod.CREDIT_CARD,
        PaymentMethod.DEBIT_CARD,
        PaymentMethod.VIRTUAL_ACCOUNT,
        PaymentMethod.BANK_TRANSFER,
      ],
      supportedCurrencies: [Currency.KRW],
    });
  }

  protected getSandboxApiUrl(): string {
    return 'https://sandbox-api.nicepay.co.kr';
  }

  protected getProductionApiUrl(): string {
    return 'https://api.nicepay.co.kr';
  }

  protected getRequiredCredentials(): string[] {
    return ['merchantId', 'merchantKey', 'cancelPassword'];
  }

  /**
   * Initialize NicePay payment
   */
  async initializePayment(request: PaymentInitRequest): Promise<PaymentInitResponse> {
    this.validateConfig();

    const { paymentId, orderId, amount, currency, description, returnUrl, cancelUrl } = request;

    // NicePay requires form-based integration
    // We return the form URL and parameters
    const initParams = {
      PayMethod: this.getPayMethodCode(request.method),
      MID: this.config.credentials.merchantId,
      Moid: orderId,
      Amt: this.formatAmount(amount, currency).toString(),
      GoodsName: description || 'Order Payment',
      BuyerName: (request as any).customerInfo?.name || 'Customer',
      BuyerTel: (request as any).customerInfo?.phone || '',
      BuyerEmail: (request as any).customerInfo?.email || '',
      ReturnURL: returnUrl,
      CancelURL: cancelUrl,
      VbankExpDate: this.formatDateForNicePay(new Date(Date.now() + 24 * 60 * 60 * 1000)), // 24 hours
      CharSet: 'utf-8',
      ReqReserved: paymentId,
    };

    // Generate EdiDate and SignData for authentication
    const ediDate = this.getCurrentDateTime();
    const signData = this.generateSignData(initParams, ediDate);

    this.log('info', 'NicePay initialization successful', { paymentId, orderId });

    return {
      paymentId,
      gateway: this.gateway,
      redirectUrl: `${this.getApiBaseUrl()}/v1/payments`,
      additionalData: {
        ...initParams,
        EdiDate: ediDate,
        SignData: signData,
        formAction: `${this.getApiBaseUrl()}/v1/payments`,
      },
    };
  }

  /**
   * Process NicePay payment result
   */
  async processPayment(request: PaymentProcessRequest): Promise<Payment> {
    this.validateConfig();

    const { paymentId, gatewayData } = request;

    try {
      // Verify the payment result
      const verifyResult = await this.verifyPaymentResult(gatewayData);

      if (verifyResult.ResultCode !== '3001') {
        throw new Error(`Payment failed: ${verifyResult.ResultMsg}`);
      }

      this.log('info', 'NicePay processing successful', { paymentId, tid: verifyResult.TID });

      const payment: Payment = {
        id: '',
        paymentId,
        orderId: verifyResult.Moid,
        customerId: '', // Would need to be passed in request
        gateway: this.gateway,
        method: this.mapPaymentMethod(verifyResult.PayMethod),
        status: PaymentStatus.COMPLETED,
        amount: parseInt(verifyResult.Amt),
        currency: Currency.KRW,
        gatewayTransactionId: verifyResult.TID,
        gatewayResponseData: verifyResult,
        paidAt: verifyResult.AuthDate ? this.parseNicePayDate(verifyResult.AuthDate) : new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      return payment;
    } catch (error) {
      this.log('error', 'NicePay processing failed', { paymentId, error: error.message });
      
      return {
        id: '',
        paymentId,
        orderId: gatewayData.Moid || '',
        customerId: '',
        gateway: this.gateway,
        method: PaymentMethod.CREDIT_CARD,
        status: PaymentStatus.FAILED,
        amount: parseInt(gatewayData.Amt) || 0,
        currency: Currency.KRW,
        failureReason: error.message,
        failedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
  }

  /**
   * Verify NicePay payment
   */
  async verifyPayment(request: PaymentVerifyRequest): Promise<PaymentVerifyResponse> {
    this.validateConfig();

    const { paymentId, gatewayTransactionId } = request;

    if (!gatewayTransactionId) {
      throw new Error('Gateway transaction ID (TID) is required for verification');
    }

    try {
      const ediDate = this.getCurrentDateTime();
      const signData = this.generateVerifySignData(gatewayTransactionId, ediDate);

      const verifyParams = {
        TID: gatewayTransactionId,
        MID: this.config.credentials.merchantId,
        EdiDate: ediDate,
        SignData: signData,
      };

      const response: NicePayResponse = await this.makeRequest({
        url: `${this.getApiBaseUrl()}/v1/payments/${gatewayTransactionId}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        data: new URLSearchParams(verifyParams).toString(),
      });

      if (response.ResultCode !== '3001') {
        throw new Error(`Verification failed: ${response.ResultMsg}`);
      }

      return {
        paymentId,
        orderId: response.Moid,
        status: PaymentStatus.COMPLETED,
        amount: parseInt(response.Amt),
        currency: Currency.KRW,
        paidAt: response.AuthDate ? this.parseNicePayDate(response.AuthDate) : undefined,
        method: this.mapPaymentMethod(response.PayMethod),
        cardInfo: response.CardCode ? {
          cardNumber: response.CardNum || '',
          cardType: 'credit', // NicePay doesn't distinguish credit/debit
          issuerCode: response.CardCode,
          issuerName: response.CardName || '',
          acquirerCode: response.AcquCardCode,
          acquirerName: response.AcquCardName,
          installmentMonths: parseInt(response.CardQuota || '0'),
        } : undefined,
      };
    } catch (error) {
      this.log('error', 'NicePay verification failed', { paymentId, error: error.message });
      throw error;
    }
  }

  /**
   * Process NicePay refund
   */
  async refundPayment(request: RefundRequest): Promise<RefundResponse> {
    this.validateConfig();

    const { paymentId, amount, reason } = request;
    const gatewayTransactionId = (request as any).gatewayTransactionId;

    if (!gatewayTransactionId) {
      throw new Error('Gateway transaction ID (TID) is required for refund');
    }

    try {
      const ediDate = this.getCurrentDateTime();
      const signData = this.generateCancelSignData(gatewayTransactionId, amount, ediDate);

      const cancelParams = {
        TID: gatewayTransactionId,
        MID: this.config.credentials.merchantId,
        Moid: paymentId, // Use payment ID as order ID
        CancelAmt: this.formatAmount(amount, Currency.KRW).toString(),
        CancelMsg: reason,
        PartialCancelCode: '0', // 0: full cancel, 1: partial cancel
        EdiDate: ediDate,
        SignData: signData,
        CharSet: 'utf-8',
      };

      const response: NicePayResponse = await this.makeRequest({
        url: `${this.getApiBaseUrl()}/v1/payments/${gatewayTransactionId}/cancel`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        data: new URLSearchParams(cancelParams).toString(),
      });

      if (response.ResultCode !== '2001' && response.ResultCode !== '2211') {
        throw new Error(`Refund failed: ${response.ResultMsg}`);
      }

      this.log('info', 'NicePay refund successful', { paymentId, refundAmount: amount });

      return {
        refundId: response.TID,
        paymentId,
        amount: parseInt(response.Amt),
        status: 'completed',
        refundedAt: new Date(),
      };
    } catch (error) {
      this.log('error', 'NicePay refund failed', { paymentId, error: error.message });
      
      return {
        refundId: '',
        paymentId,
        amount,
        status: 'failed',
        failureReason: error.message,
      };
    }
  }

  /**
   * Parse NicePay webhook
   */
  async parseWebhook(payload: WebhookPayload): Promise<Payment> {
    const webhookData = payload.data;

    return {
      id: '',
      paymentId: webhookData.ReqReserved || webhookData.Moid,
      orderId: webhookData.Moid,
      customerId: '',
      gateway: this.gateway,
      method: this.mapPaymentMethod(webhookData.PayMethod),
      status: webhookData.ResultCode === '3001' ? PaymentStatus.COMPLETED : PaymentStatus.FAILED,
      amount: parseInt(webhookData.Amt),
      currency: Currency.KRW,
      gatewayTransactionId: webhookData.TID,
      gatewayResponseData: webhookData,
      webhookData: payload.data,
      paidAt: webhookData.AuthDate ? this.parseNicePayDate(webhookData.AuthDate) : undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Verify payment result from NicePay callback
   */
  private async verifyPaymentResult(gatewayData: any): Promise<NicePayResponse> {
    const ediDate = this.getCurrentDateTime();
    const signData = this.generateVerifySignData(gatewayData.TID, ediDate);

    const verifyParams = {
      TID: gatewayData.TID,
      MID: this.config.credentials.merchantId,
      EdiDate: ediDate,
      SignData: signData,
    };

    return await this.makeRequest({
      url: `${this.getApiBaseUrl()}/v1/payments/verify`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      data: new URLSearchParams(verifyParams).toString(),
    });
  }

  /**
   * Generate signature for initial payment request
   */
  private generateSignData(params: any, ediDate: string): string {
    const signStr = `${params.Amt}${ediDate}${params.MID}${params.Moid}${this.config.credentials.merchantKey}`;
    return require('crypto').createHash('sha256').update(signStr).digest('hex');
  }

  /**
   * Generate signature for verification
   */
  private generateVerifySignData(tid: string, ediDate: string): string {
    const signStr = `${ediDate}${this.config.credentials.merchantId}${tid}${this.config.credentials.merchantKey}`;
    return require('crypto').createHash('sha256').update(signStr).digest('hex');
  }

  /**
   * Generate signature for cancellation
   */
  private generateCancelSignData(tid: string, amount: number, ediDate: string): string {
    const cancelAmt = this.formatAmount(amount, Currency.KRW).toString();
    const signStr = `${cancelAmt}${ediDate}${this.config.credentials.merchantId}${tid}${this.config.credentials.merchantKey}`;
    return require('crypto').createHash('sha256').update(signStr).digest('hex');
  }

  /**
   * Get current date time in NicePay format (YYYYMMDDHHMMSS)
   */
  private getCurrentDateTime(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    return `${year}${month}${day}${hours}${minutes}${seconds}`;
  }

  /**
   * Format date for NicePay (YYYYMMDD)
   */
  private formatDateForNicePay(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}${month}${day}`;
  }

  /**
   * Parse NicePay date format (YYYYMMDDHHMMSS)
   */
  private parseNicePayDate(dateStr: string): Date {
    const year = parseInt(dateStr.substr(0, 4));
    const month = parseInt(dateStr.substr(4, 2)) - 1;
    const day = parseInt(dateStr.substr(6, 2));
    const hours = parseInt(dateStr.substr(8, 2));
    const minutes = parseInt(dateStr.substr(10, 2));
    const seconds = parseInt(dateStr.substr(12, 2));
    
    return new Date(year, month, day, hours, minutes, seconds);
  }

  /**
   * Get payment method code for NicePay
   */
  private getPayMethodCode(method?: PaymentMethod): string {
    switch (method) {
      case PaymentMethod.CREDIT_CARD:
      case PaymentMethod.DEBIT_CARD:
        return 'CARD';
      case PaymentMethod.VIRTUAL_ACCOUNT:
        return 'VBANK';
      case PaymentMethod.BANK_TRANSFER:
        return 'BANK';
      default:
        return 'CARD';
    }
  }

  /**
   * Map NicePay payment method to our enum
   */
  private mapPaymentMethod(niceMethod: string): PaymentMethod {
    switch (niceMethod) {
      case 'CARD':
        return PaymentMethod.CREDIT_CARD;
      case 'VBANK':
        return PaymentMethod.VIRTUAL_ACCOUNT;
      case 'BANK':
        return PaymentMethod.BANK_TRANSFER;
      default:
        return PaymentMethod.CREDIT_CARD;
    }
  }

  /**
   * Override makeRequest to handle form-encoded data
   */
  protected async makeRequest(options: {
    url: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    headers?: Record<string, string>;
    data?: any;
  }): Promise<any> {
    const { url, method, headers = {}, data } = options;

    const requestOptions: RequestInit = {
      method,
      headers,
    };

    if (data && (method === 'POST' || method === 'PUT')) {
      requestOptions.body = data;
    }

    try {
      const response = await fetch(url, requestOptions);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const responseText = await response.text();
      
      // Parse form-encoded response
      const params = new URLSearchParams(responseText);
      const result: any = {};
      for (const [key, value] of params.entries()) {
        result[key] = value;
      }
      
      return result;
    } catch (error) {
      console.error(`Request to ${url} failed:`, error);
      throw error;
    }
  }
}