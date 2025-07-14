/**
 * Payment Security Service
 * Handles encryption, token management, and security features for payments
 */

import crypto from 'crypto';
import { Request } from 'express';

export interface SecurityConfig {
  encryptionKey: string;
  tokenSecret: string;
  webhookSecrets: Record<string, string>;
  maxTokenAge: number; // in seconds
  rateLimits: {
    paymentInit: { requests: number; window: number }; // requests per window (seconds)
    webhooks: { requests: number; window: number };
  };
  pciCompliance: {
    logSensitiveData: boolean;
    encryptStoredData: boolean;
    tokenizeCardNumbers: boolean;
  };
}

export interface PaymentToken {
  paymentId: string;
  amount: number;
  currency: string;
  gateway: string;
  customerId: string;
  iat: number; // issued at
  exp: number; // expires
}

export interface SecurityAuditLog {
  timestamp: Date;
  event: string;
  paymentId?: string;
  gateway?: string;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

export class PaymentSecurityService {
  private config: SecurityConfig;
  private auditLogs: SecurityAuditLog[] = [];
  private rateLimitStore: Map<string, { count: number; resetTime: number }> = new Map();

  constructor(config: SecurityConfig) {
    this.config = config;
  }

  /**
   * Generate secure payment token
   */
  generatePaymentToken(paymentData: {
    paymentId: string;
    amount: number;
    currency: string;
    gateway: string;
    customerId: string;
  }): string {
    const now = Math.floor(Date.now() / 1000);
    const tokenData: PaymentToken = {
      ...paymentData,
      iat: now,
      exp: now + this.config.maxTokenAge,
    };

    const payload = JSON.stringify(tokenData);
    const signature = this.generateHMAC(payload, this.config.tokenSecret);
    
    return Buffer.from(`${payload}.${signature}`).toString('base64');
  }

  /**
   * Verify and decode payment token
   */
  verifyPaymentToken(token: string): PaymentToken | null {
    try {
      const decoded = Buffer.from(token, 'base64').toString('utf-8');
      const [payload, signature] = decoded.split('.');
      
      if (!payload || !signature) {
        throw new Error('Invalid token format');
      }

      // Verify signature
      const expectedSignature = this.generateHMAC(payload, this.config.tokenSecret);
      if (!this.compareSignatures(signature, expectedSignature)) {
        throw new Error('Invalid token signature');
      }

      const tokenData: PaymentToken = JSON.parse(payload);
      
      // Check expiration
      const now = Math.floor(Date.now() / 1000);
      if (tokenData.exp < now) {
        throw new Error('Token has expired');
      }

      return tokenData;
    } catch (error) {
      this.auditLog({
        event: 'TOKEN_VERIFICATION_FAILED',
        success: false,
        errorMessage: error.message,
        metadata: { token: token.substring(0, 20) + '...' },
      });
      return null;
    }
  }

  /**
   * Encrypt sensitive payment data
   */
  encryptSensitiveData(data: string): string {
    const algorithm = 'aes-256-gcm';
    const iv = crypto.randomBytes(16);
    const key = crypto.scryptSync(this.config.encryptionKey, 'salt', 32);
    
    const cipher = crypto.createCipher(algorithm, key);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypt sensitive payment data
   */
  decryptSensitiveData(encryptedData: string): string {
    try {
      const algorithm = 'aes-256-gcm';
      const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
      
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      const key = crypto.scryptSync(this.config.encryptionKey, 'salt', 32);
      
      const decipher = crypto.createDecipher(algorithm, key);
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      this.auditLog({
        event: 'DECRYPTION_FAILED',
        success: false,
        errorMessage: error.message,
      });
      throw new Error('Failed to decrypt sensitive data');
    }
  }

  /**
   * Tokenize card number for PCI compliance
   */
  tokenizeCardNumber(cardNumber: string): string {
    if (!this.config.pciCompliance.tokenizeCardNumbers) {
      return cardNumber;
    }

    // Keep first 6 and last 4 digits, replace middle with asterisks
    const cleaned = cardNumber.replace(/\D/g, '');
    if (cleaned.length < 10) {
      return '*'.repeat(cleaned.length);
    }

    const first6 = cleaned.substring(0, 6);
    const last4 = cleaned.substring(cleaned.length - 4);
    const middleLength = cleaned.length - 10;
    
    return `${first6}${'*'.repeat(middleLength)}${last4}`;
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(gateway: string, payload: any, signature: string): boolean {
    const webhookSecret = this.config.webhookSecrets[gateway];
    if (!webhookSecret) {
      this.auditLog({
        event: 'WEBHOOK_SECRET_NOT_FOUND',
        gateway,
        success: false,
        errorMessage: `No webhook secret configured for gateway: ${gateway}`,
      });
      return false;
    }

    const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const expectedSignature = this.generateHMAC(payloadString, webhookSecret);
    
    const isValid = this.compareSignatures(signature, expectedSignature);
    
    this.auditLog({
      event: 'WEBHOOK_SIGNATURE_VERIFICATION',
      gateway,
      success: isValid,
      errorMessage: isValid ? undefined : 'Webhook signature verification failed',
    });

    return isValid;
  }

  /**
   * Check rate limit for payment operations
   */
  checkRateLimit(operation: 'paymentInit' | 'webhooks', identifier: string): boolean {
    const limits = this.config.rateLimits[operation];
    const key = `${operation}:${identifier}`;
    const now = Date.now();
    
    const current = this.rateLimitStore.get(key);
    
    if (!current || now > current.resetTime) {
      // Reset or initialize
      this.rateLimitStore.set(key, {
        count: 1,
        resetTime: now + (limits.window * 1000),
      });
      return true;
    }
    
    if (current.count >= limits.requests) {
      this.auditLog({
        event: 'RATE_LIMIT_EXCEEDED',
        success: false,
        errorMessage: `Rate limit exceeded for ${operation}`,
        metadata: { identifier, operation, currentCount: current.count },
      });
      return false;
    }
    
    current.count++;
    return true;
  }

  /**
   * Sanitize payment data for logging (PCI compliance)
   */
  sanitizeForLogging(data: any): any {
    if (!this.config.pciCompliance.logSensitiveData) {
      return this.deepSanitize(data);
    }
    return data;
  }

  /**
   * Validate payment amount to prevent manipulation
   */
  validatePaymentAmount(clientAmount: number, serverAmount: number, tolerance: number = 0.01): boolean {
    const difference = Math.abs(clientAmount - serverAmount);
    const isValid = difference <= tolerance;
    
    if (!isValid) {
      this.auditLog({
        event: 'PAYMENT_AMOUNT_MISMATCH',
        success: false,
        errorMessage: 'Client and server payment amounts do not match',
        metadata: { clientAmount, serverAmount, difference },
      });
    }
    
    return isValid;
  }

  /**
   * Generate secure random payment ID
   */
  generateSecurePaymentId(prefix: string = 'PAY'): string {
    const timestamp = Date.now().toString(36);
    const randomBytes = crypto.randomBytes(8).toString('hex');
    return `${prefix}_${timestamp}_${randomBytes}`.toUpperCase();
  }

  /**
   * Extract and validate IP address from request
   */
  extractClientIP(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'] as string;
    const realIp = req.headers['x-real-ip'] as string;
    const clientIp = req.ip || req.connection.remoteAddress;
    
    // Prefer x-forwarded-for, then x-real-ip, then connection IP
    return (forwarded && forwarded.split(',')[0].trim()) || realIp || clientIp || 'unknown';
  }

  /**
   * Audit log for security events
   */
  auditLog(log: Omit<SecurityAuditLog, 'timestamp'>): void {
    const auditEntry: SecurityAuditLog = {
      timestamp: new Date(),
      ...log,
    };
    
    this.auditLogs.push(auditEntry);
    
    // Keep only last 10000 logs in memory
    if (this.auditLogs.length > 10000) {
      this.auditLogs = this.auditLogs.slice(-5000);
    }
    
    // In production, this should be sent to a logging service
    console.log('PAYMENT_SECURITY_AUDIT:', JSON.stringify(auditEntry));
  }

  /**
   * Get security audit logs
   */
  getAuditLogs(filters?: {
    startDate?: Date;
    endDate?: Date;
    event?: string;
    gateway?: string;
    success?: boolean;
  }): SecurityAuditLog[] {
    let logs = [...this.auditLogs];
    
    if (filters?.startDate) {
      logs = logs.filter(log => log.timestamp >= filters.startDate!);
    }
    
    if (filters?.endDate) {
      logs = logs.filter(log => log.timestamp <= filters.endDate!);
    }
    
    if (filters?.event) {
      logs = logs.filter(log => log.event === filters.event);
    }
    
    if (filters?.gateway) {
      logs = logs.filter(log => log.gateway === filters.gateway);
    }
    
    if (filters?.success !== undefined) {
      logs = logs.filter(log => log.success === filters.success);
    }
    
    return logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Clear expired rate limit entries
   */
  cleanupRateLimits(): void {
    const now = Date.now();
    for (const [key, value] of this.rateLimitStore.entries()) {
      if (now > value.resetTime) {
        this.rateLimitStore.delete(key);
      }
    }
  }

  /**
   * Generate HMAC signature
   */
  private generateHMAC(data: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
  }

  /**
   * Compare signatures safely to prevent timing attacks
   */
  private compareSignatures(signature1: string, signature2: string): boolean {
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
   * Deep sanitize object for PCI compliance
   */
  private deepSanitize(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.deepSanitize(item));
    }

    const sensitiveFields = [
      'cardNumber', 'cardNum', 'card_number',
      'cvv', 'cvc', 'securityCode',
      'accountNumber', 'account_number',
      'pin', 'password', 'secret',
      'ssn', 'socialSecurityNumber',
      'bankAccount', 'routingNumber',
    ];

    const sanitized: any = {};
    
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      
      if (sensitiveFields.some(field => lowerKey.includes(field.toLowerCase()))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object') {
        sanitized[key] = this.deepSanitize(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }
}