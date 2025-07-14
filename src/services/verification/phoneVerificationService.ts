import { PrismaClient } from '@prisma/client';
import { logger } from '../../utils/logger';
import crypto from 'crypto';
import {
  PhoneVerificationConfig,
  VerificationRequest,
  VerificationResponse,
  VerificationResult,
  SMSConfig,
  SMSRequest,
  SMSResponse
} from '../../types/verification';
import { NICEGateway } from './gateways/niceGateway';
import { KMCGateway } from './gateways/kmcGateway';
import { LGUGateway } from './gateways/lguGateway';
import { PASSGateway } from './gateways/passGateway';

export class PhoneVerificationService {
  private prisma: PrismaClient;
  private config: PhoneVerificationConfig;
  private smsConfig: SMSConfig;
  private gateway: any;

  constructor(config: PhoneVerificationConfig, smsConfig: SMSConfig) {
    this.prisma = new PrismaClient();
    this.config = config;
    this.smsConfig = smsConfig;
    
    // Initialize gateway based on provider
    switch (config.provider) {
      case 'NICE':
        this.gateway = new NICEGateway(config);
        break;
      case 'KMC':
        this.gateway = new KMCGateway(config);
        break;
      case 'LGU':
        this.gateway = new LGUGateway(config);
        break;
      case 'PASS':
        this.gateway = new PASSGateway(config);
        break;
      default:
        throw new Error(`Unsupported verification provider: ${config.provider}`);
    }
  }

  /**
   * 인증번호 발송
   */
  async sendVerificationCode(request: VerificationRequest): Promise<VerificationResponse> {
    try {
      // Generate 6-digit verification code
      const code = this.generateVerificationCode();
      const expiresAt = new Date(Date.now() + 3 * 60 * 1000); // 3분 후 만료

      // Check for existing pending verification
      const existing = await this.prisma.phoneVerification.findFirst({
        where: {
          phone: request.phone,
          status: 'PENDING',
          expiresAt: { gt: new Date() }
        }
      });

      if (existing && existing.attempts >= existing.maxAttempts) {
        return {
          success: false,
          error: '인증 시도 횟수를 초과했습니다. 잠시 후 다시 시도해주세요.'
        };
      }

      // Create or update verification record
      const verification = await this.prisma.phoneVerification.create({
        data: {
          userId: request.userId,
          phone: request.phone,
          code,
          type: request.type,
          provider: this.config.provider,
          status: 'PENDING',
          expiresAt,
          metadata: {
            ip: request.ip,
            userAgent: request.userAgent
          }
        }
      });

      // Send SMS
      const smsResponse = await this.sendSMS({
        phone: request.phone,
        message: `[${this.config.siteName}] 인증번호는 ${code}입니다. (3분간 유효)`
      });

      if (!smsResponse.success) {
        await this.prisma.phoneVerification.update({
          where: { id: verification.id },
          data: { status: 'FAILED' }
        });
        return {
          success: false,
          error: 'SMS 발송에 실패했습니다.'
        };
      }

      // Update status to SENT
      await this.prisma.phoneVerification.update({
        where: { id: verification.id },
        data: { status: 'SENT' }
      });

      logger.info('Verification code sent', {
        phone: request.phone,
        type: request.type,
        provider: this.config.provider
      });

      return {
        success: true,
        requestId: verification.id,
        message: '인증번호가 발송되었습니다.'
      };
    } catch (error) {
      logger.error('Failed to send verification code', error);
      return {
        success: false,
        error: '인증번호 발송에 실패했습니다.'
      };
    }
  }

  /**
   * 인증번호 확인
   */
  async verifyCode(phone: string, code: string): Promise<VerificationResult> {
    try {
      const verification = await this.prisma.phoneVerification.findFirst({
        where: {
          phone,
          code,
          status: { in: ['PENDING', 'SENT'] },
          expiresAt: { gt: new Date() }
        },
        orderBy: { createdAt: 'desc' }
      });

      if (!verification) {
        return {
          success: false,
          verified: false,
          message: '유효하지 않은 인증번호입니다.'
        };
      }

      // Update attempts
      await this.prisma.phoneVerification.update({
        where: { id: verification.id },
        data: { attempts: { increment: 1 } }
      });

      // Check max attempts
      if (verification.attempts >= verification.maxAttempts) {
        await this.prisma.phoneVerification.update({
          where: { id: verification.id },
          data: { status: 'FAILED' }
        });
        return {
          success: false,
          verified: false,
          message: '인증 시도 횟수를 초과했습니다.'
        };
      }

      // Verify code
      if (verification.code !== code) {
        return {
          success: false,
          verified: false,
          message: '인증번호가 일치하지 않습니다.'
        };
      }

      // Update verification status
      await this.prisma.phoneVerification.update({
        where: { id: verification.id },
        data: {
          status: 'VERIFIED',
          verifiedAt: new Date()
        }
      });

      // Update user phone verification status
      if (verification.userId) {
        await this.prisma.user.update({
          where: { id: verification.userId },
          data: { isPhoneVerified: true }
        });
      }

      logger.info('Phone verified successfully', {
        phone,
        userId: verification.userId,
        type: verification.type
      });

      return {
        success: true,
        verified: true,
        message: '휴대폰 인증이 완료되었습니다.'
      };
    } catch (error) {
      logger.error('Failed to verify code', error);
      return {
        success: false,
        verified: false,
        message: '인증 확인에 실패했습니다.'
      };
    }
  }

  /**
   * 본인인증 요청 (NICE, PASS 등)
   */
  async requestIdentityVerification(request: VerificationRequest): Promise<VerificationResponse> {
    try {
      // Gateway를 통한 본인인증 요청
      const response = await this.gateway.requestVerification(request);
      
      if (response.success && response.requestId) {
        // Save verification request
        await this.prisma.phoneVerification.create({
          data: {
            userId: request.userId,
            phone: request.phone,
            code: response.requestId, // Use requestId as code for identity verification
            type: request.type,
            provider: this.config.provider,
            status: 'PENDING',
            expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30분 후 만료
            metadata: {
              requestData: request,
              gatewayResponse: response
            }
          }
        });
      }

      return response;
    } catch (error) {
      logger.error('Failed to request identity verification', error);
      return {
        success: false,
        error: '본인인증 요청에 실패했습니다.'
      };
    }
  }

  /**
   * 본인인증 결과 확인
   */
  async checkIdentityVerification(requestId: string): Promise<VerificationResult> {
    try {
      const verification = await this.prisma.phoneVerification.findFirst({
        where: {
          code: requestId,
          provider: this.config.provider,
          status: 'PENDING'
        }
      });

      if (!verification) {
        return {
          success: false,
          verified: false,
          message: '유효하지 않은 인증 요청입니다.'
        };
      }

      // Check verification result from gateway
      const result = await this.gateway.checkVerification(requestId);

      if (result.verified) {
        // Update verification record
        await this.prisma.phoneVerification.update({
          where: { id: verification.id },
          data: {
            status: 'VERIFIED',
            verifiedAt: new Date(),
            metadata: {
              ...verification.metadata,
              verificationResult: result
            }
          }
        });

        // Update user verification status
        if (verification.userId) {
          await this.prisma.user.update({
            where: { id: verification.userId },
            data: { isPhoneVerified: true }
          });
        }
      }

      return result;
    } catch (error) {
      logger.error('Failed to check identity verification', error);
      return {
        success: false,
        verified: false,
        message: '본인인증 확인에 실패했습니다.'
      };
    }
  }

  /**
   * SMS 발송
   */
  private async sendSMS(request: SMSRequest): Promise<SMSResponse> {
    try {
      // TODO: Implement SMS gateway integration
      // For now, just log the SMS
      logger.info('SMS sent (mock)', {
        phone: request.phone,
        message: request.message
      });

      return {
        success: true,
        messageId: crypto.randomUUID()
      };
    } catch (error) {
      logger.error('Failed to send SMS', error);
      return {
        success: false,
        error: 'SMS 발송 실패'
      };
    }
  }

  /**
   * 6자리 인증번호 생성
   */
  private generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * 만료된 인증 정리
   */
  async cleanupExpiredVerifications(): Promise<void> {
    try {
      const result = await this.prisma.phoneVerification.updateMany({
        where: {
          status: { in: ['PENDING', 'SENT'] },
          expiresAt: { lt: new Date() }
        },
        data: { status: 'EXPIRED' }
      });

      logger.info(`Cleaned up ${result.count} expired verifications`);
    } catch (error) {
      logger.error('Failed to cleanup expired verifications', error);
    }
  }
}