/**
 * Naver Pay Gateway Implementation
 * Korean mobile payment service by Naver
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

interface NaverPayResponse {
  code: string;
  message: string;
  body?: {
    paymentId: string;
    merchantPayKey: string;
    totalPayAmount: number;
    primaryPayMeans: string;
    naverpayPaymentId: string;
    admissionYmdt: string;
    payHistId: string;
    merchantId: string;
    payMeans: Array<{
      payMeansType: string;
      payMeansName: string;
      cardNo?: string;
      cardCorpCode?: string;
      cardCorpName?: string;
      cardAuthNo?: string;
      cardInstCount?: number;
      useCardPoint?: boolean;
    }>;
  };
}

export class NaverPayGateway extends BasePaymentGateway {
  readonly gateway = PaymentGateway.NAVER_PAY;

  constructor(config: any) {
    super({
      ...config,
      gateway: PaymentGateway.NAVER_PAY,
      supportedMethods: [PaymentMethod.MOBILE_PAYMENT, PaymentMethod.EASY_PAYMENT, PaymentMethod.CREDIT_CARD],
      supportedCurrencies: [Currency.KRW],
    });
  }

  protected getSandboxApiUrl(): string {
    return 'https://dev.apis.naver.com/naverpay-partner/naverpay';
  }

  protected getProductionApiUrl(): string {
    return 'https://apis.naver.com/naverpay-partner/naverpay';
  }

  protected getRequiredCredentials(): string[] {
    return ['clientId', 'clientSecret', 'merchantId'];
  }

  /**
   * Initialize Naver Pay payment
   */
  async initializePayment(request: PaymentInitRequest): Promise<PaymentInitResponse> {
    this.validateConfig();

    const { paymentId, orderId, customerId, amount, currency, description, returnUrl, cancelUrl, items } = request;

    const naverPayRequest = {
      merchantId: this.config.credentials.merchantId,
      merchantPayKey: paymentId,
      productName: description || 'Order Payment',
      totalPayAmount: this.formatAmount(amount, currency),
      returnUrl,
      productCount: items?.length || 1,
      productItems: items?.map(item => ({
        categoryType: item.category || 'GENERAL',
        categoryId: item.id,
        uid: item.id,
        name: item.name,
        payReferrer: 'NAVER_BOOK',
        count: item.quantity,
        sellerId: this.config.credentials.merchantId,
        payAmount: this.formatAmount(item.price * item.quantity, currency),
      })) || [],
      purchaserName: (request as any).customerInfo?.name || 'Customer',
      purchaserBirthday: (request as any).customerInfo?.birthday || '',
      useCfmYmdt: this.formatDateForNaver(new Date(Date.now() + 30 * 60 * 1000)), // 30 minutes from now
    };

    try {
      const response = await this.makeRequest({
        url: `${this.getApiBaseUrl()}/payments/v2.2/apply/payment`,
        method: 'POST',
        headers: {
          'X-Naver-Client-Id': this.config.credentials.clientId,
          'X-Naver-Client-Secret': this.config.credentials.clientSecret,
          'Content-Type': 'application/json',
        },
        data: naverPayRequest,
      });

      if (response.code !== 'Success') {
        throw new Error(`Naver Pay error: ${response.message}`);
      }

      this.log('info', 'Naver Pay initialization successful', { paymentId, naverPaymentId: response.body.paymentId });

      return {
        paymentId,
        gateway: this.gateway,
        redirectUrl: `https://nid.naver.com/nidlogin.login?svctype=262144&url=${encodeURIComponent(response.body.paymentId)}`,
        additionalData: {
          naverPaymentId: response.body.paymentId,
          merchantPayKey: response.body.merchantPayKey,
        },
      };
    } catch (error) {
      this.log('error', 'Naver Pay initialization failed', { paymentId, error: error.message });
      throw new Error(`Naver Pay initialization failed: ${error.message}`);
    }
  }

  /**
   * Process Naver Pay payment
   */
  async processPayment(request: PaymentProcessRequest): Promise<Payment> {
    this.validateConfig();

    const { paymentId, gatewayData } = request;
    const { naverPaymentId, merchantPayKey } = gatewayData;

    try {
      // Get payment details from Naver Pay
      const response = await this.makeRequest({
        url: `${this.getApiBaseUrl()}/payments/v2.2/apply/payment/${naverPaymentId}`,
        method: 'GET',
        headers: {
          'X-Naver-Client-Id': this.config.credentials.clientId,
          'X-Naver-Client-Secret': this.config.credentials.clientSecret,
        },
      });

      if (response.code !== 'Success') {
        throw new Error(`Naver Pay error: ${response.message}`);
      }

      const paymentData = response.body;

      this.log('info', 'Naver Pay processing successful', { paymentId, naverPaymentId: paymentData.naverpayPaymentId });

      const payment: Payment = {
        id: '',
        paymentId,
        orderId: paymentData.merchantPayKey.split('_')[0] || paymentId, // Extract order ID from merchant pay key
        customerId: '', // Would need to be passed in request
        gateway: this.gateway,
        method: this.mapPaymentMethod(paymentData.primaryPayMeans),
        status: PaymentStatus.COMPLETED,
        amount: paymentData.totalPayAmount,
        currency: Currency.KRW,
        gatewayTransactionId: paymentData.naverpayPaymentId,
        gatewayResponseData: paymentData,
        paidAt: new Date(paymentData.admissionYmdt),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      return payment;
    } catch (error) {
      this.log('error', 'Naver Pay processing failed', { paymentId, error: error.message });
      
      return {
        id: '',
        paymentId,
        orderId: '',
        customerId: '',
        gateway: this.gateway,
        method: PaymentMethod.MOBILE_PAYMENT,
        status: PaymentStatus.FAILED,
        amount: 0,
        currency: Currency.KRW,
        failureReason: error.message,
        failedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
  }

  /**
   * Verify Naver Pay payment
   */
  async verifyPayment(request: PaymentVerifyRequest): Promise<PaymentVerifyResponse> {
    this.validateConfig();

    const { paymentId, gatewayTransactionId } = request;

    if (!gatewayTransactionId) {
      throw new Error('Gateway transaction ID is required for verification');
    }

    try {
      const response = await this.makeRequest({
        url: `${this.getApiBaseUrl()}/payments/v2.2/apply/payment/${gatewayTransactionId}`,
        method: 'GET',
        headers: {
          'X-Naver-Client-Id': this.config.credentials.clientId,
          'X-Naver-Client-Secret': this.config.credentials.clientSecret,
        },
      });

      if (response.code !== 'Success') {
        throw new Error(`Naver Pay verification error: ${response.message}`);
      }

      const paymentData = response.body;

      return {
        paymentId,
        orderId: paymentData.merchantPayKey,
        status: PaymentStatus.COMPLETED,
        amount: paymentData.totalPayAmount,
        currency: Currency.KRW,
        paidAt: new Date(paymentData.admissionYmdt),
        method: this.mapPaymentMethod(paymentData.primaryPayMeans),
        cardInfo: paymentData.payMeans?.find(pm => pm.payMeansType === 'CARD') ? {
          cardNumber: paymentData.payMeans[0].cardNo || '',
          cardType: 'credit', // Naver Pay doesn't distinguish credit/debit
          issuerCode: paymentData.payMeans[0].cardCorpCode || '',
          issuerName: paymentData.payMeans[0].cardCorpName || '',
          installmentMonths: paymentData.payMeans[0].cardInstCount || 0,
        } : undefined,
      };
    } catch (error) {
      this.log('error', 'Naver Pay verification failed', { paymentId, error: error.message });
      throw error;
    }
  }

  /**
   * Process Naver Pay refund
   */
  async refundPayment(request: RefundRequest): Promise<RefundResponse> {
    this.validateConfig();

    const { paymentId, amount, reason } = request;
    const gatewayTransactionId = (request as any).gatewayTransactionId;

    if (!gatewayTransactionId) {
      throw new Error('Gateway transaction ID is required for refund');
    }

    try {
      const refundRequest = {
        payHistId: gatewayTransactionId,
        cancelAmount: this.formatAmount(amount, Currency.KRW),
        cancelReason: reason,
        cancelRequester: (request as any).requesterName || 'Merchant',
      };

      const response = await this.makeRequest({
        url: `${this.getApiBaseUrl()}/payments/v2.2/apply/cancel`,
        method: 'POST',
        headers: {
          'X-Naver-Client-Id': this.config.credentials.clientId,
          'X-Naver-Client-Secret': this.config.credentials.clientSecret,
          'Content-Type': 'application/json',
        },
        data: refundRequest,
      });

      if (response.code !== 'Success') {
        throw new Error(`Naver Pay refund error: ${response.message}`);
      }

      this.log('info', 'Naver Pay refund successful', { paymentId, refundAmount: amount });

      return {
        refundId: response.body.cancelId,
        paymentId,
        amount: response.body.cancelAmount,
        status: 'completed',
        refundedAt: new Date(),
      };
    } catch (error) {
      this.log('error', 'Naver Pay refund failed', { paymentId, error: error.message });
      
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
   * Parse Naver Pay webhook
   */
  async parseWebhook(payload: WebhookPayload): Promise<Payment> {
    const webhookData = payload.data;

    return {
      id: '',
      paymentId: webhookData.merchantPayKey,
      orderId: webhookData.merchantPayKey,
      customerId: '',
      gateway: this.gateway,
      method: this.mapPaymentMethod(webhookData.primaryPayMeans),
      status: webhookData.paymentStatus === 'SUCCESS' ? PaymentStatus.COMPLETED : PaymentStatus.FAILED,
      amount: webhookData.totalPayAmount,
      currency: Currency.KRW,
      gatewayTransactionId: webhookData.naverpayPaymentId,
      gatewayResponseData: webhookData,
      webhookData: payload.data,
      paidAt: webhookData.admissionYmdt ? new Date(webhookData.admissionYmdt) : undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Map Naver Pay payment method to our enum
   */
  private mapPaymentMethod(naverMethod: string): PaymentMethod {
    switch (naverMethod) {
      case 'CARD':
        return PaymentMethod.CREDIT_CARD;
      case 'BANK':
        return PaymentMethod.BANK_TRANSFER;
      case 'POINT':
        return PaymentMethod.MOBILE_PAYMENT;
      default:
        return PaymentMethod.EASY_PAYMENT;
    }
  }

  /**
   * Format date for Naver Pay API (YYYYMMDDHHMISS)
   */
  private formatDateForNaver(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    return `${year}${month}${day}${hours}${minutes}${seconds}`;
  }
}