import { logger } from '../../../utils/logger';
import {
  PhoneVerificationConfig,
  VerificationRequest,
  VerificationResponse,
  VerificationResult
} from '../../../types/verification';

export class LGUGateway {
  private config: PhoneVerificationConfig;

  constructor(config: PhoneVerificationConfig) {
    this.config = config;
  }

  async requestVerification(request: VerificationRequest): Promise<VerificationResponse> {
    // TODO: Implement LG U+ gateway
    logger.info('LG U+ verification request (mock)', request);
    
    return {
      success: true,
      requestId: `LGU_${Date.now()}`,
      message: 'LG U+ 본인인증 요청 (개발 중)'
    };
  }

  async checkVerification(requestId: string): Promise<VerificationResult> {
    // TODO: Implement LG U+ gateway
    logger.info('LG U+ verification check (mock)', { requestId });
    
    return {
      success: true,
      verified: true,
      message: 'LG U+ 본인인증 확인 (개발 중)'
    };
  }
}