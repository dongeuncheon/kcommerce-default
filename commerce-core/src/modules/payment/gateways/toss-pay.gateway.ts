/**
 * Toss Pay Gateway Implementation
 * Korean fintech payment service by Viva Republica
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

interface TossPaymentsResponse {
  paymentKey: string;
  type: string;
  orderId: string;
  orderName: string;
  mId: string;
  currency: string;
  method: string;
  totalAmount: number;
  balanceAmount: number;
  status: string;
  requestedAt: string;
  approvedAt?: string;
  useEscrow: boolean;
  lastTransactionKey?: string;
  suppliedAmount: number;
  vat: number;
  cultureBenefit: boolean;
  taxFreeAmount: number;
  taxExemptionAmount: number;
  cancels?: Array<{
    cancelAmount: number;
    cancelReason: string;
    taxFreeAmount: number;
    taxExemptionAmount: number;
    refundableAmount: number;
    easyPayDiscountAmount: number;
    canceledAt: string;
    transactionKey: string;
    receiptKey?: string;
  }>;
  isPartialCancelable: boolean;
  card?: {
    amount: number;
    issuerCode: string;
    acquirerCode?: string;
    number: string;
    installmentPlanMonths: number;
    approveNo: string;
    useCardPoint: boolean;
    cardType: string;
    ownerType: string;
    acquireStatus: string;
    isInterestFree: boolean;
    interestPayer?: string;
  };
  virtualAccount?: {
    accountType: string;
    accountNumber: string;
    bankCode: string;
    customerName: string;
    dueDate: string;
    refundStatus: string;
    expired: boolean;
    settlementStatus: string;
    refundReceiveAccount?: {
      bankCode: string;
      accountNumber: string;
      holderName: string;
    };
  };
  transfer?: {
    bankCode: string;
    settlementStatus: string;
  };
  mobilePhone?: {
    customerMobilePhone: string;
    settlementStatus: string;
    receiptUrl: string;
  };
  giftCertificate?: {
    approveNo: string;
    settlementStatus: string;
  };
  cashReceipt?: {
    type: string;
    receiptKey: string;
    issueNumber: string;
    receiptUrl: string;
    amount: number;
    taxFreeAmount: number;
  };
  cashReceipts?: Array<{
    receiptKey: string;
    orderId: string;
    orderName: string;
    type: string;
    issueNumber: string;
    receiptUrl: string;
    businessNumber: string;
    transactionType: string;
    amount: number;
    taxFreeAmount: number;
    issueStatus: string;
    failure?: {
      code: string;
      message: string;
    };
    customerIdentityNumber: string;
    requestedAt: string;
  }>;
  discount?: {
    amount: number;
  };
  country: string;
  failure?: {
    code: string;
    message: string;
  };
  receipt?: {
    url: string;
  };
  checkout?: {
    url: string;
  };
  easyPay?: {
    provider: string;
    amount: number;
    discountAmount: number;
  };
}

export class TossPayGateway extends BasePaymentGateway {
  readonly gateway = PaymentGateway.TOSS_PAY;

  constructor(config: any) {
    super({
      ...config,
      gateway: PaymentGateway.TOSS_PAY,
      supportedMethods: [
        PaymentMethod.CREDIT_CARD,
        PaymentMethod.DEBIT_CARD,
        PaymentMethod.VIRTUAL_ACCOUNT,
        PaymentMethod.MOBILE_PAYMENT,
        PaymentMethod.EASY_PAYMENT,
        PaymentMethod.BANK_TRANSFER,
      ],
      supportedCurrencies: [Currency.KRW, Currency.USD],
    });
  }

  protected getSandboxApiUrl(): string {
    return 'https://api.tosspayments.com';
  }

  protected getProductionApiUrl(): string {
    return 'https://api.tosspayments.com';
  }

  protected getRequiredCredentials(): string[] {
    return ['clientId', 'secretKey'];
  }

  /**
   * Initialize Toss Payments
   */
  async initializePayment(request: PaymentInitRequest): Promise<PaymentInitResponse> {
    this.validateConfig();

    const { paymentId, orderId, amount, currency, description, returnUrl, cancelUrl } = request;

    // Toss Payments uses client-side integration
    // We return the checkout URL for redirect
    const checkoutUrl = this.buildCheckoutUrl({
      clientKey: this.config.credentials.clientId,
      amount: this.formatAmount(amount, currency),
      orderId,
      orderName: description || 'Order Payment',
      successUrl: returnUrl,
      failUrl: cancelUrl,
      customerName: (request as any).customerInfo?.name,
      customerEmail: (request as any).customerInfo?.email,
      customerMobilePhone: (request as any).customerInfo?.phone,
    });

    this.log('info', 'Toss Payments initialization successful', { paymentId, orderId });

    return {
      paymentId,
      gateway: this.gateway,
      redirectUrl: checkoutUrl,
      additionalData: {
        clientKey: this.config.credentials.clientId,
        orderId,
        amount: this.formatAmount(amount, currency),
      },
    };
  }

  /**
   * Process Toss Payments confirmation
   */
  async processPayment(request: PaymentProcessRequest): Promise<Payment> {
    this.validateConfig();

    const { paymentId, gatewayData } = request;
    const { paymentKey, orderId, amount } = gatewayData;

    if (!paymentKey || !orderId || !amount) {
      throw new Error('Missing required gateway data: paymentKey, orderId, or amount');
    }

    try {
      // Confirm payment
      const response: TossPaymentsResponse = await this.makeRequest({
        url: `${this.getApiBaseUrl()}/v1/payments/confirm`,
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.config.credentials.secretKey}:`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
        data: {
          paymentKey,
          orderId,
          amount: this.formatAmount(amount, Currency.KRW),
        },
      });

      this.log('info', 'Toss Payments confirmation successful', { paymentId, paymentKey: response.paymentKey });

      const payment: Payment = {
        id: '',
        paymentId,
        orderId: response.orderId,
        customerId: '', // Would need to be passed in request
        gateway: this.gateway,
        method: this.mapPaymentMethod(response.method),
        status: this.mapPaymentStatus(response.status),
        amount: response.totalAmount,
        currency: response.currency as Currency,
        description: response.orderName,
        gatewayTransactionId: response.paymentKey,
        gatewayResponseData: response,
        paidAt: response.approvedAt ? new Date(response.approvedAt) : undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      return payment;
    } catch (error) {
      this.log('error', 'Toss Payments confirmation failed', { paymentId, error: error.message });
      
      return {
        id: '',
        paymentId,
        orderId: orderId || '',
        customerId: '',
        gateway: this.gateway,
        method: PaymentMethod.CREDIT_CARD,
        status: PaymentStatus.FAILED,
        amount: amount || 0,
        currency: Currency.KRW,
        failureReason: error.message,
        failedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
  }

  /**
   * Verify Toss Payments
   */
  async verifyPayment(request: PaymentVerifyRequest): Promise<PaymentVerifyResponse> {
    this.validateConfig();

    const { paymentId, gatewayTransactionId } = request;

    if (!gatewayTransactionId) {
      throw new Error('Gateway transaction ID (paymentKey) is required for verification');
    }

    try {
      const response: TossPaymentsResponse = await this.makeRequest({
        url: `${this.getApiBaseUrl()}/v1/payments/${gatewayTransactionId}`,
        method: 'GET',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.config.credentials.secretKey}:`).toString('base64')}`,
        },
      });

      return {
        paymentId,
        orderId: response.orderId,
        status: this.mapPaymentStatus(response.status),
        amount: response.totalAmount,
        currency: response.currency as Currency,
        paidAt: response.approvedAt ? new Date(response.approvedAt) : undefined,
        method: this.mapPaymentMethod(response.method),
        cardInfo: response.card ? {
          cardNumber: response.card.number,
          cardType: response.card.cardType === 'CREDIT' ? 'credit' : 'debit',
          issuerCode: response.card.issuerCode,
          issuerName: '', // Toss doesn't provide issuer name
          acquirerCode: response.card.acquirerCode,
          installmentMonths: response.card.installmentPlanMonths,
        } : undefined,
        receiptUrl: response.receipt?.url,
      };
    } catch (error) {
      this.log('error', 'Toss Payments verification failed', { paymentId, error: error.message });
      throw error;
    }
  }

  /**
   * Process Toss Payments refund
   */
  async refundPayment(request: RefundRequest): Promise<RefundResponse> {
    this.validateConfig();

    const { paymentId, amount, reason } = request;
    const gatewayTransactionId = (request as any).gatewayTransactionId;

    if (!gatewayTransactionId) {
      throw new Error('Gateway transaction ID (paymentKey) is required for refund');
    }

    try {
      const refundRequest = {
        cancelReason: reason,
        cancelAmount: this.formatAmount(amount, Currency.KRW),
        refundReceiveAccount: request.bankInfo ? {
          bank: request.bankInfo.bankCode,
          accountNumber: request.bankInfo.accountNumber,
          holderName: request.bankInfo.accountHolder,
        } : undefined,
      };

      const response: TossPaymentsResponse = await this.makeRequest({
        url: `${this.getApiBaseUrl()}/v1/payments/${gatewayTransactionId}/cancel`,
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.config.credentials.secretKey}:`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
        data: refundRequest,
      });

      this.log('info', 'Toss Payments refund successful', { paymentId, refundAmount: amount });

      const latestCancel = response.cancels?.[response.cancels.length - 1];

      return {
        refundId: latestCancel?.transactionKey || '',
        paymentId,
        amount: latestCancel?.cancelAmount || amount,
        status: 'completed',
        refundedAt: latestCancel ? new Date(latestCancel.canceledAt) : new Date(),
      };
    } catch (error) {
      this.log('error', 'Toss Payments refund failed', { paymentId, error: error.message });
      
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
   * Parse Toss Payments webhook
   */
  async parseWebhook(payload: WebhookPayload): Promise<Payment> {
    const webhookData = payload.data;

    return {
      id: '',
      paymentId: webhookData.orderId,
      orderId: webhookData.orderId,
      customerId: '',
      gateway: this.gateway,
      method: this.mapPaymentMethod(webhookData.method),
      status: this.mapPaymentStatus(webhookData.status),
      amount: webhookData.totalAmount,
      currency: webhookData.currency as Currency,
      gatewayTransactionId: webhookData.paymentKey,
      gatewayResponseData: webhookData,
      webhookData: payload.data,
      paidAt: webhookData.approvedAt ? new Date(webhookData.approvedAt) : undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Map Toss Payments method to our enum
   */
  private mapPaymentMethod(tossMethod: string): PaymentMethod {
    switch (tossMethod) {
      case '카드':
        return PaymentMethod.CREDIT_CARD;
      case '가상계좌':
        return PaymentMethod.VIRTUAL_ACCOUNT;
      case '계좌이체':
        return PaymentMethod.BANK_TRANSFER;
      case '휴대폰':
        return PaymentMethod.MOBILE_PAYMENT;
      case '상품권':
      case '포인트':
        return PaymentMethod.EASY_PAYMENT;
      default:
        return PaymentMethod.CREDIT_CARD;
    }
  }

  /**
   * Map Toss Payments status to our enum
   */
  private mapPaymentStatus(tossStatus: string): PaymentStatus {
    switch (tossStatus) {
      case 'READY':
        return PaymentStatus.PENDING;
      case 'IN_PROGRESS':
        return PaymentStatus.PROCESSING;
      case 'WAITING_FOR_DEPOSIT':
        return PaymentStatus.PENDING;
      case 'DONE':
        return PaymentStatus.COMPLETED;
      case 'CANCELED':
        return PaymentStatus.CANCELLED;
      case 'PARTIAL_CANCELED':
        return PaymentStatus.PARTIALLY_REFUNDED;
      case 'ABORTED':
      case 'EXPIRED':
        return PaymentStatus.FAILED;
      default:
        return PaymentStatus.PENDING;
    }
  }

  /**
   * Build checkout URL for Toss Payments
   */
  private buildCheckoutUrl(params: {
    clientKey: string;
    amount: number;
    orderId: string;
    orderName: string;
    successUrl: string;
    failUrl: string;
    customerName?: string;
    customerEmail?: string;
    customerMobilePhone?: string;
  }): string {
    const baseUrl = 'https://js.tosspayments.com/v1/payment';
    const queryParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, value.toString());
      }
    });

    return `${baseUrl}?${queryParams.toString()}`;
  }
}