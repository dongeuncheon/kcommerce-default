/**
 * Bank Transfer Gateway Implementation
 * Korean bank transfer payment method (무통장입금)
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
  VirtualAccountInfo,
} from '../payment.types';

interface BankTransferConfig {
  banks: Array<{
    code: string;
    name: string;
    accountNumber: string;
    accountHolder: string;
  }>;
  defaultExpiryHours: number;
}

interface BankTransferRecord {
  paymentId: string;
  virtualAccount: VirtualAccountInfo;
  expectedAmount: number;
  status: 'pending' | 'confirmed' | 'expired';
  depositedAmount?: number;
  depositorName?: string;
  depositedAt?: Date;
  expiresAt: Date;
}

export class BankTransferGateway extends BasePaymentGateway {
  readonly gateway = PaymentGateway.BANK_TRANSFER;
  private bankConfig: BankTransferConfig;
  private transfers: Map<string, BankTransferRecord> = new Map();

  constructor(config: any) {
    super({
      ...config,
      gateway: PaymentGateway.BANK_TRANSFER,
      supportedMethods: [PaymentMethod.BANK_TRANSFER, PaymentMethod.VIRTUAL_ACCOUNT],
      supportedCurrencies: [Currency.KRW],
    });

    this.bankConfig = {
      banks: config.banks || [
        {
          code: '011',
          name: '농협은행',
          accountNumber: '301-0123-4567-89',
          accountHolder: 'Commerce Corp',
        },
        {
          code: '004',
          name: '국민은행',
          accountNumber: '123456-01-123456',
          accountHolder: 'Commerce Corp',
        },
        {
          code: '020',
          name: '우리은행',
          accountNumber: '1005-123-123456',
          accountHolder: 'Commerce Corp',
        },
      ],
      defaultExpiryHours: config.defaultExpiryHours || 24,
    };
  }

  protected getSandboxApiUrl(): string {
    return 'https://api.sandbox.bank-transfer.co.kr';
  }

  protected getProductionApiUrl(): string {
    return 'https://api.bank-transfer.co.kr';
  }

  protected getRequiredCredentials(): string[] {
    return ['apiKey']; // Minimal credentials for bank transfer
  }

  /**
   * Initialize bank transfer payment
   */
  async initializePayment(request: PaymentInitRequest): Promise<PaymentInitResponse> {
    this.validateConfig();

    const { paymentId, orderId, amount, currency, description } = request;

    // Select a bank (could be random or based on load balancing)
    const selectedBank = this.selectBank();
    
    // Generate virtual account (in real implementation, this would call bank API)
    const virtualAccount = this.generateVirtualAccount(selectedBank, paymentId);
    
    // Set expiry time
    const expiresAt = new Date(Date.now() + this.bankConfig.defaultExpiryHours * 60 * 60 * 1000);

    // Store transfer record
    const transferRecord: BankTransferRecord = {
      paymentId,
      virtualAccount,
      expectedAmount: this.formatAmount(amount, currency),
      status: 'pending',
      expiresAt,
    };

    this.transfers.set(paymentId, transferRecord);

    this.log('info', 'Bank transfer initialization successful', { 
      paymentId, 
      bankCode: selectedBank.code,
      accountNumber: virtualAccount.accountNumber,
    });

    return {
      paymentId,
      gateway: this.gateway,
      virtualAccount,
      expiresAt,
      additionalData: {
        bankCode: selectedBank.code,
        bankName: selectedBank.name,
        instructions: this.getBankTransferInstructions(virtualAccount, amount),
      },
    };
  }

  /**
   * Process bank transfer (typically called when deposit is confirmed)
   */
  async processPayment(request: PaymentProcessRequest): Promise<Payment> {
    const { paymentId, gatewayData } = request;
    
    const transferRecord = this.transfers.get(paymentId);
    if (!transferRecord) {
      throw new Error(`Bank transfer record not found for payment ${paymentId}`);
    }

    const { depositAmount, depositorName, depositTime } = gatewayData;

    try {
      // Verify deposit amount
      if (depositAmount !== transferRecord.expectedAmount) {
        this.log('warn', 'Bank transfer amount mismatch', { 
          paymentId, 
          expected: transferRecord.expectedAmount,
          received: depositAmount,
        });
      }

      // Check if not expired
      const now = new Date();
      if (now > transferRecord.expiresAt) {
        throw new Error('Bank transfer has expired');
      }

      // Update transfer record
      transferRecord.status = 'confirmed';
      transferRecord.depositedAmount = depositAmount;
      transferRecord.depositorName = depositorName;
      transferRecord.depositedAt = depositTime ? new Date(depositTime) : new Date();

      this.transfers.set(paymentId, transferRecord);

      this.log('info', 'Bank transfer confirmed', { 
        paymentId, 
        amount: depositAmount,
        depositor: depositorName,
      });

      const payment: Payment = {
        id: '',
        paymentId,
        orderId: paymentId, // In real implementation, this would be stored
        customerId: '', // Would need to be stored during initialization
        gateway: this.gateway,
        method: PaymentMethod.BANK_TRANSFER,
        status: PaymentStatus.COMPLETED,
        amount: depositAmount,
        currency: Currency.KRW,
        gatewayTransactionId: this.generateTransactionId(),
        gatewayResponseData: {
          virtualAccount: transferRecord.virtualAccount,
          depositorName,
          depositedAmount: depositAmount,
        },
        paidAt: transferRecord.depositedAt,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      return payment;
    } catch (error) {
      this.log('error', 'Bank transfer processing failed', { paymentId, error: error.message });
      
      return {
        id: '',
        paymentId,
        orderId: paymentId,
        customerId: '',
        gateway: this.gateway,
        method: PaymentMethod.BANK_TRANSFER,
        status: PaymentStatus.FAILED,
        amount: transferRecord.expectedAmount,
        currency: Currency.KRW,
        failureReason: error.message,
        failedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
  }

  /**
   * Verify bank transfer payment
   */
  async verifyPayment(request: PaymentVerifyRequest): Promise<PaymentVerifyResponse> {
    const { paymentId } = request;

    const transferRecord = this.transfers.get(paymentId);
    if (!transferRecord) {
      throw new Error(`Bank transfer record not found for payment ${paymentId}`);
    }

    const now = new Date();
    let status: PaymentStatus;

    if (transferRecord.status === 'confirmed') {
      status = PaymentStatus.COMPLETED;
    } else if (now > transferRecord.expiresAt) {
      status = PaymentStatus.FAILED;
      transferRecord.status = 'expired';
      this.transfers.set(paymentId, transferRecord);
    } else {
      status = PaymentStatus.PENDING;
    }

    return {
      paymentId,
      orderId: paymentId,
      status,
      amount: transferRecord.depositedAmount || transferRecord.expectedAmount,
      currency: Currency.KRW,
      paidAt: transferRecord.depositedAt,
      method: PaymentMethod.BANK_TRANSFER,
    };
  }

  /**
   * Process bank transfer refund
   */
  async refundPayment(request: RefundRequest): Promise<RefundResponse> {
    const { paymentId, amount, reason, bankInfo } = request;

    if (!bankInfo) {
      throw new Error('Bank information is required for bank transfer refund');
    }

    const transferRecord = this.transfers.get(paymentId);
    if (!transferRecord) {
      throw new Error(`Bank transfer record not found for payment ${paymentId}`);
    }

    if (transferRecord.status !== 'confirmed') {
      throw new Error('Cannot refund unconfirmed bank transfer');
    }

    try {
      // In real implementation, this would initiate bank transfer to customer
      const refundId = this.generateTransactionId();

      this.log('info', 'Bank transfer refund initiated', { 
        paymentId, 
        refundId,
        amount,
        refundAccount: `${bankInfo.bankName} ${bankInfo.accountNumber}`,
      });

      // For demo purposes, we'll mark it as completed immediately
      // In real implementation, this would be pending until bank confirms
      return {
        refundId,
        paymentId,
        amount,
        status: 'completed',
        refundedAt: new Date(),
      };
    } catch (error) {
      this.log('error', 'Bank transfer refund failed', { paymentId, error: error.message });
      
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
   * Parse bank transfer webhook (deposit confirmation from bank)
   */
  async parseWebhook(payload: WebhookPayload): Promise<Payment> {
    const webhookData = payload.data;
    const { paymentId, depositAmount, depositorName, depositTime } = webhookData;

    // Process the payment with the webhook data
    const processRequest: PaymentProcessRequest = {
      paymentId,
      gateway: this.gateway,
      gatewayData: {
        depositAmount,
        depositorName,
        depositTime,
      },
    };

    return await this.processPayment(processRequest);
  }

  /**
   * Select a bank for the transfer (simple round-robin for demo)
   */
  private selectBank() {
    const banks = this.bankConfig.banks;
    const randomIndex = Math.floor(Math.random() * banks.length);
    return banks[randomIndex];
  }

  /**
   * Generate virtual account information
   */
  private generateVirtualAccount(bank: any, paymentId: string): VirtualAccountInfo {
    // In real implementation, this would call bank API to generate virtual account
    // For demo, we'll generate a mock virtual account
    const accountSuffix = paymentId.slice(-6);
    const virtualAccountNumber = `${bank.accountNumber}-${accountSuffix}`;

    return {
      bankCode: bank.code,
      bankName: bank.name,
      accountNumber: virtualAccountNumber,
      accountHolder: bank.accountHolder,
      dueDate: new Date(Date.now() + this.bankConfig.defaultExpiryHours * 60 * 60 * 1000),
    };
  }

  /**
   * Generate bank transfer instructions for customer
   */
  private getBankTransferInstructions(virtualAccount: VirtualAccountInfo, amount: number): string {
    return `
무통장입금 안내:

은행: ${virtualAccount.bankName}
계좌번호: ${virtualAccount.accountNumber}
예금주: ${virtualAccount.accountHolder}
입금금액: ${amount.toLocaleString()}원
입금기한: ${virtualAccount.dueDate.toLocaleString('ko-KR')}

※ 입금자명을 정확히 입력해주세요.
※ 입금기한 내에 입금하지 않으면 주문이 자동 취소됩니다.
※ 입금확인은 평일 기준 1-2시간 소요될 수 있습니다.
    `.trim();
  }

  /**
   * Check for expired transfers (should be called periodically)
   */
  public checkExpiredTransfers(): string[] {
    const now = new Date();
    const expiredPaymentIds: string[] = [];

    for (const [paymentId, record] of this.transfers.entries()) {
      if (record.status === 'pending' && now > record.expiresAt) {
        record.status = 'expired';
        this.transfers.set(paymentId, record);
        expiredPaymentIds.push(paymentId);
        
        this.log('info', 'Bank transfer expired', { paymentId });
      }
    }

    return expiredPaymentIds;
  }

  /**
   * Get transfer record (for admin purposes)
   */
  public getTransferRecord(paymentId: string): BankTransferRecord | undefined {
    return this.transfers.get(paymentId);
  }

  /**
   * Get all pending transfers (for admin purposes)
   */
  public getPendingTransfers(): Array<BankTransferRecord & { paymentId: string }> {
    const pending: Array<BankTransferRecord & { paymentId: string }> = [];
    
    for (const [paymentId, record] of this.transfers.entries()) {
      if (record.status === 'pending') {
        pending.push({ ...record, paymentId });
      }
    }
    
    return pending;
  }

  /**
   * Manually confirm a deposit (for admin purposes)
   */
  public async confirmDeposit(paymentId: string, depositAmount: number, depositorName: string): Promise<Payment> {
    return await this.processPayment({
      paymentId,
      gateway: this.gateway,
      gatewayData: {
        depositAmount,
        depositorName,
        depositTime: new Date().toISOString(),
      },
    });
  }
}