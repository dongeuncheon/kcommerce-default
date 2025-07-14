import { logger } from '../../../utils/logger';
import {
  PhoneVerificationConfig,
  VerificationRequest,
  VerificationResponse,
  VerificationResult
} from '../../../types/verification';

export class KMCGateway {
  private config: PhoneVerificationConfig;

  constructor(config: PhoneVerificationConfig) {
    this.config = config;
  }

  async requestVerification(request: VerificationRequest): Promise<VerificationResponse> {
    // TODO: Implement KMC gateway
    logger.info('KMC verification request (mock)', request);
    
    return {
      success: true,
      requestId: `KMC_${Date.now()}`,
      message: 'KMC 본인인증 요청 (개발 중)'
    };
  }

  async checkVerification(requestId: string): Promise<VerificationResult> {
    // TODO: Implement KMC gateway
    logger.info('KMC verification check (mock)', { requestId });
    
    return {
      success: true,
      verified: true,
      message: 'KMC 본인인증 확인 (개발 중)'
    };
  }
}