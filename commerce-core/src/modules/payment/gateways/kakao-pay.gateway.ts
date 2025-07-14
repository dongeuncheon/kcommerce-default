/**
 * Kakao Pay Gateway Implementation
 * Korean mobile payment service by Kakao
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

interface KakaoPayResponse {
  tid: string;
  next_redirect_app_url?: string;
  next_redirect_mobile_url?: string;
  next_redirect_pc_url?: string;
  android_app_scheme?: string;
  ios_app_scheme?: string;
  created_at: string;
}

interface KakaoPayApprovalResponse {
  aid: string;
  tid: string;
  cid: string;
  sid?: string;
  partner_order_id: string;
  partner_user_id: string;
  payment_method_type: string;
  amount: {
    total: number;
    tax_free: number;
    vat: number;
    point: number;
    discount: number;
    green_deposit: number;
  };
  card_info?: {
    kakaopay_purchase_corp: string;
    kakaopay_purchase_corp_code: string;
    kakaopay_issuer_corp: string;
    kakaopay_issuer_corp_code: string;
    bin: string;
    card_type: string;
    install_month: string;
    approved_id: string;
    card_mid: string;
    interest_free_install: string;
    installment_type: string;
    card_item_code: string;
  };
  item_name: string;
  item_code?: string;
  quantity: number;
  created_at: string;
  approved_at: string;
  payload?: string;
}

export class KakaoPayGateway extends BasePaymentGateway {
  readonly gateway = PaymentGateway.KAKAO_PAY;

  constructor(config: any) {
    super({
      ...config,
      gateway: PaymentGateway.KAKAO_PAY,
      supportedMethods: [PaymentMethod.MOBILE_PAYMENT, PaymentMethod.EASY_PAYMENT],
      supportedCurrencies: [Currency.KRW],
    });
  }

  protected getSandboxApiUrl(): string {
    return 'https://kapi.kakao.com';
  }

  protected getProductionApiUrl(): string {
    return 'https://kapi.kakao.com';
  }

  protected getRequiredCredentials(): string[] {
    return ['clientId', 'adminKey'];
  }

  /**
   * Initialize Kakao Pay payment
   */
  async initializePayment(request: PaymentInitRequest): Promise<PaymentInitResponse> {
    this.validateConfig();

    const { paymentId, orderId, customerId, amount, currency, description, returnUrl, cancelUrl, items } = request;

    // Prepare Kakao Pay request
    const kakaoPayRequest = {
      cid: this.config.credentials.clientId,
      partner_order_id: orderId,
      partner_user_id: customerId,
      item_name: description || 'Order Payment',
      item_code: items?.[0]?.id || '',
      quantity: items?.reduce((sum, item) => sum + item.quantity, 0) || 1,
      total_amount: this.formatAmount(amount, currency),
      tax_free_amount: 0,
      vat_amount: Math.floor(amount / 11), // 10% VAT
      approval_url: returnUrl,
      cancel_url: cancelUrl,
      fail_url: cancelUrl,
      payload: JSON.stringify({ paymentId, orderId }),
    };

    try {
      const response = await this.makeRequest({
        url: `${this.getApiBaseUrl()}/v1/payment/ready`,
        method: 'POST',
        headers: {
          'Authorization': `KakaoAK ${this.config.credentials.adminKey}`,
          'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
        },
        data: new URLSearchParams(kakaoPayRequest).toString(),
      });

      this.log('info', 'Kakao Pay initialization successful', { paymentId, tid: response.tid });

      return {
        paymentId,
        gateway: this.gateway,
        redirectUrl: response.next_redirect_pc_url,
        mobileUrl: response.next_redirect_mobile_url,
        additionalData: {
          tid: response.tid,
          androidScheme: response.android_app_scheme,
          iosScheme: response.ios_app_scheme,
        },
      };
    } catch (error) {
      this.log('error', 'Kakao Pay initialization failed', { paymentId, error: error.message });
      throw new Error(`Kakao Pay initialization failed: ${error.message}`);
    }
  }

  /**
   * Process Kakao Pay payment approval
   */
  async processPayment(request: PaymentProcessRequest): Promise<Payment> {
    this.validateConfig();

    const { paymentId, gatewayData } = request;
    const { pg_token, tid, partner_order_id, partner_user_id } = gatewayData;

    if (!pg_token || !tid) {
      throw new Error('Missing required gateway data: pg_token or tid');
    }

    try {
      const approvalRequest = {
        cid: this.config.credentials.clientId,
        tid,
        partner_order_id,
        partner_user_id,
        pg_token,
      };

      const response: KakaoPayApprovalResponse = await this.makeRequest({
        url: `${this.getApiBaseUrl()}/v1/payment/approve`,
        method: 'POST',
        headers: {
          'Authorization': `KakaoAK ${this.config.credentials.adminKey}`,
          'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
        },
        data: new URLSearchParams(approvalRequest).toString(),
      });

      this.log('info', 'Kakao Pay approval successful', { paymentId, aid: response.aid });

      // Map Kakao Pay response to our Payment entity
      const payment: Payment = {
        id: '',
        paymentId,
        orderId: response.partner_order_id,
        customerId: response.partner_user_id,
        gateway: this.gateway,
        method: this.mapPaymentMethod(response.payment_method_type),
        status: PaymentStatus.COMPLETED,
        amount: response.amount.total,
        currency: Currency.KRW,
        description: response.item_name,
        gatewayTransactionId: response.aid,
        gatewayResponseData: response,
        paidAt: new Date(response.approved_at),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      return payment;
    } catch (error) {
      this.log('error', 'Kakao Pay approval failed', { paymentId, error: error.message });
      
      return {
        id: '',
        paymentId,
        orderId: partner_order_id || '',
        customerId: partner_user_id || '',
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
   * Verify Kakao Pay payment
   */
  async verifyPayment(request: PaymentVerifyRequest): Promise<PaymentVerifyResponse> {
    this.validateConfig();

    const { paymentId, gatewayTransactionId } = request;

    if (!gatewayTransactionId) {
      throw new Error('Gateway transaction ID is required for verification');
    }

    try {
      // Kakao Pay doesn't have a direct verification API
      // We use the order inquiry API instead
      const response = await this.makeRequest({
        url: `${this.getApiBaseUrl()}/v1/payment/order`,
        method: 'POST',
        headers: {
          'Authorization': `KakaoAK ${this.config.credentials.adminKey}`,
          'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
        },
        data: new URLSearchParams({
          cid: this.config.credentials.clientId,
          tid: gatewayTransactionId,
        }).toString(),
      });

      return {
        paymentId,
        orderId: response.partner_order_id,
        status: PaymentStatus.COMPLETED,
        amount: response.amount.total,
        currency: Currency.KRW,
        paidAt: new Date(response.approved_at),
        method: this.mapPaymentMethod(response.payment_method_type),
        cardInfo: response.card_info ? {
          cardNumber: `****-****-****-${response.card_info.bin}`,
          cardType: response.card_info.card_type === 'CREDIT' ? 'credit' : 'debit',
          issuerCode: response.card_info.kakaopay_issuer_corp_code,
          issuerName: response.card_info.kakaopay_issuer_corp,
          installmentMonths: parseInt(response.card_info.install_month) || 0,
        } : undefined,
      };
    } catch (error) {
      this.log('error', 'Kakao Pay verification failed', { paymentId, error: error.message });
      throw error;
    }
  }

  /**
   * Process Kakao Pay refund
   */
  async refundPayment(request: RefundRequest): Promise<RefundResponse> {
    this.validateConfig();

    const { paymentId, amount, reason } = request;

    // First, we need to get the transaction ID from the payment
    // This would typically come from the payment record
    // For now, we'll assume it's passed in the request
    const tid = (request as any).gatewayTransactionId;

    if (!tid) {
      throw new Error('Gateway transaction ID is required for refund');
    }

    try {
      const refundRequest = {
        cid: this.config.credentials.clientId,
        tid,
        cancel_amount: this.formatAmount(amount, Currency.KRW),
        cancel_tax_free_amount: 0,
        cancel_vat_amount: Math.floor(amount / 11),
        payload: JSON.stringify({ reason, paymentId }),
      };

      const response = await this.makeRequest({
        url: `${this.getApiBaseUrl()}/v1/payment/cancel`,
        method: 'POST',
        headers: {
          'Authorization': `KakaoAK ${this.config.credentials.adminKey}`,
          'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
        },
        data: new URLSearchParams(refundRequest).toString(),
      });

      this.log('info', 'Kakao Pay refund successful', { paymentId, refundAmount: amount });

      return {
        refundId: response.aid,
        paymentId,
        amount: response.canceled_amount.total,
        status: 'completed',
        refundedAt: new Date(response.canceled_at),
      };
    } catch (error) {
      this.log('error', 'Kakao Pay refund failed', { paymentId, error: error.message });
      
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
   * Parse Kakao Pay webhook (Note: Kakao Pay doesn't provide webhooks, this is for completeness)
   */
  async parseWebhook(payload: WebhookPayload): Promise<Payment> {
    // Kakao Pay doesn't support webhooks natively
    // This method is implemented for interface compliance
    throw new Error('Kakao Pay does not support webhooks');
  }

  /**
   * Map Kakao Pay payment method to our enum
   */
  private mapPaymentMethod(kakaoMethod: string): PaymentMethod {
    switch (kakaoMethod) {
      case 'CARD':
        return PaymentMethod.CREDIT_CARD;
      case 'MONEY':
        return PaymentMethod.MOBILE_PAYMENT;
      default:
        return PaymentMethod.EASY_PAYMENT;
    }
  }

  /**
   * Override makeRequest to handle Kakao Pay's form-encoded requests
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

      return await response.json();
    } catch (error) {
      console.error(`Request to ${url} failed:`, error);
      throw error;
    }
  }
}