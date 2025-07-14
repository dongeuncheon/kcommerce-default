import { logger } from '../../../utils/logger';
import {
  PhoneVerificationConfig,
  VerificationRequest,
  VerificationResponse,
  VerificationResult
} from '../../../types/verification';

export class PASSGateway {
  private config: PhoneVerificationConfig;

  constructor(config: PhoneVerificationConfig) {
    this.config = config;
  }

  async requestVerification(request: VerificationRequest): Promise<VerificationResponse> {
    // TODO: Implement PASS gateway
    logger.info('PASS verification request (mock)', request);
    
    return {
      success: true,
      requestId: `PASS_${Date.now()}`,
      message: 'PASS 본인인증 요청 (개발 중)'
    };
  }

  async checkVerification(requestId: string): Promise<VerificationResult> {
    // TODO: Implement PASS gateway
    logger.info('PASS verification check (mock)', { requestId });
    
    return {
      success: true,
      verified: true,
      message: 'PASS 본인인증 확인 (개발 중)'
    };
  }
}