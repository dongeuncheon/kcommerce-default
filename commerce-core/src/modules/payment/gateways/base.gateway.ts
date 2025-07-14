/**
 * Base Payment Gateway
 * Abstract base class for all payment gateway implementations
 */

import crypto from 'crypto';
import {
  IPaymentGateway,
  PaymentGateway,
  PaymentGatewayConfig,
  PaymentInitRequest,
  PaymentInitResponse,
  PaymentProcessRequest,
  PaymentVerifyRequest,
  PaymentVerifyResponse,
  RefundRequest,
  RefundResponse,
  WebhookPayload,
  Payment,
  PaymentMethod,
  Currency,
  PaymentStatus,
} from '../payment.types';

export abstract class BasePaymentGateway implements IPaymentGateway {
  protected config: PaymentGatewayConfig;

  constructor(config: PaymentGatewayConfig) {
    this.config = config;
  }

  abstract readonly gateway: PaymentGateway;

  abstract initializePayment(request: PaymentInitRequest): Promise<PaymentInitResponse>;
  abstract processPayment(request: PaymentProcessRequest): Promise<Payment>;
  abstract verifyPayment(request: PaymentVerifyRequest): Promise<PaymentVerifyResponse>;
  abstract refundPayment(request: RefundRequest): Promise<RefundResponse>;
  abstract parseWebhook(payload: WebhookPayload): Promise<Payment>;

  /**
   * Validate webhook signature
   */
  async validateWebhook(payload: WebhookPayload): Promise<boolean> {
    if (!this.config.webhookSecret || !payload.signature) {
      return false;
    }

    const expectedSignature = this.generateWebhookSignature(payload.data);
    return this.compareSignatures(payload.signature, expectedSignature);
  }

  /**
   * Get supported payment methods
   */
  getSupportedMethods(): PaymentMethod[] {
    return this.config.supportedMethods;
  }

  /**
   * Get supported currencies
   */
  getSupportedCurrencies(): Currency[] {
    return this.config.supportedCurrencies;
  }

  /**
   * Check if gateway is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Check if gateway is in sandbox mode
   */
  isSandbox(): boolean {
    return this.config.sandbox;
  }

  /**
   * Generate webhook signature
   */
  protected generateWebhookSignature(data: any): string {
    const dataString = typeof data === 'string' ? data : JSON.stringify(data);
    return crypto
      .createHmac('sha256', this.config.webhookSecret!)
      .update(dataString)
      .digest('hex');
  }

  /**
   * Compare signatures safely to prevent timing attacks
   */
  protected compareSignatures(signature1: string, signature2: string): boolean {
    if (signature1.length !== signature2.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < signature1.length; i++) {
      result |= signature1.charCodeAt(i) ^ signature2.charCodeAt(i);
    }

    return result === 0;
  }

  /**
   * Make HTTP request to gateway API
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
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    if (data && (method === 'POST' || method === 'PUT')) {
      requestOptions.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, requestOptions);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      } else {
        return await response.text();
      }
    } catch (error) {
      console.error(`Request to ${url} failed:`, error);
      throw error;
    }
  }

  /**
   * Generate unique transaction ID
   */
  protected generateTransactionId(): string {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    return `TXN_${this.gateway.toUpperCase()}_${timestamp}_${random}`;
  }

  /**
   * Format amount for gateway (some gateways require different formats)
   */
  protected formatAmount(amount: number, currency: Currency): number {
    // Most Korean gateways expect amounts in won (no decimal places)
    if (currency === Currency.KRW) {
      return Math.round(amount);
    }
    return amount;
  }

  /**
   * Get gateway API base URL
   */
  protected getApiBaseUrl(): string {
    return this.config.sandbox 
      ? this.getSandboxApiUrl() 
      : this.getProductionApiUrl();
  }

  /**
   * Get sandbox API URL (to be implemented by each gateway)
   */
  protected abstract getSandboxApiUrl(): string;

  /**
   * Get production API URL (to be implemented by each gateway)
   */
  protected abstract getProductionApiUrl(): string;

  /**
   * Validate gateway configuration
   */
  protected validateConfig(): void {
    if (!this.config.enabled) {
      throw new Error(`${this.gateway} gateway is disabled`);
    }

    const requiredCredentials = this.getRequiredCredentials();
    for (const credential of requiredCredentials) {
      if (!this.config.credentials[credential]) {
        throw new Error(`Missing required credential: ${credential}`);
      }
    }
  }

  /**
   * Get required credentials for the gateway (to be implemented by each gateway)
   */
  protected abstract getRequiredCredentials(): string[];

  /**
   * Log gateway activity (can be overridden for specific logging needs)
   */
  protected log(level: 'info' | 'warn' | 'error', message: string, data?: any): void {
    const logData = {
      gateway: this.gateway,
      level,
      message,
      timestamp: new Date().toISOString(),
      ...(data && { data }),
    };

    console.log(JSON.stringify(logData));
  }

  /**
   * Encrypt sensitive data
   */
  protected encrypt(data: string): string {
    const algorithm = 'aes-256-cbc';
    const key = crypto.createHash('sha256').update(this.config.credentials.secretKey || '').digest();
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipher(algorithm, key);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return `${iv.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypt sensitive data
   */
  protected decrypt(encryptedData: string): string {
    const algorithm = 'aes-256-cbc';
    const key = crypto.createHash('sha256').update(this.config.credentials.secretKey || '').digest();
    
    const [ivHex, encrypted] = encryptedData.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    
    const decipher = crypto.createDecipher(algorithm, key);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}