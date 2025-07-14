import crypto from 'crypto';
import axios from 'axios';
import { logger } from '../../../utils/logger';
import {
  PhoneVerificationConfig,
  VerificationRequest,
  VerificationResponse,
  VerificationResult
} from '../../../types/verification';

export class NICEGateway {
  private config: PhoneVerificationConfig;
  private baseUrl: string;

  constructor(config: PhoneVerificationConfig) {
    this.config = config;
    this.baseUrl = process.env.NODE_ENV === 'production' 
      ? 'https://nice.checkplus.co.kr' 
      : 'https://test.nice.checkplus.co.kr';
  }

  /**
   * NICE 본인인증 요청
   */
  async requestVerification(request: VerificationRequest): Promise<VerificationResponse> {
    try {
      const requestId = this.generateRequestId();
      const authType = this.getAuthType(request.type);
      
      // Encrypt request data
      const encData = this.encryptData({
        requestId,
        siteCode: this.config.siteCode,
        authType,
        returnUrl: this.config.returnUrl,
        errorUrl: this.config.errorUrl,
        mobileNo: request.phone,
        name: request.name,
        birthDate: request.birthDate
      });

      // Generate form data
      const formData = {
        m: 'checkplusService',
        EncodeData: encData
      };

      logger.info('NICE verification request', {
        requestId,
        authType,
        phone: request.phone.substring(0, 7) + '****'
      });

      return {
        success: true,
        requestId,
        message: '본인인증 요청이 생성되었습니다.',
        data: {
          formAction: `${this.baseUrl}/checkplus_main`,
          formData
        }
      };
    } catch (error) {
      logger.error('NICE verification request failed', error);
      return {
        success: false,
        error: '본인인증 요청 생성에 실패했습니다.'
      };
    }
  }

  /**
   * NICE 본인인증 결과 확인
   */
  async checkVerification(encData: string): Promise<VerificationResult> {
    try {
      // Decrypt response data
      const decData = this.decryptData(encData);
      
      if (!decData || !decData.requestId) {
        throw new Error('Invalid response data');
      }

      // Parse result
      const result = this.parseResult(decData);

      logger.info('NICE verification result', {
        requestId: decData.requestId,
        verified: result.verified,
        ci: result.ci ? result.ci.substring(0, 10) + '...' : null
      });

      return result;
    } catch (error) {
      logger.error('NICE verification check failed', error);
      return {
        success: false,
        verified: false,
        message: '본인인증 결과 확인에 실패했습니다.'
      };
    }
  }

  /**
   * 데이터 암호화
   */
  private encryptData(data: any): string {
    try {
      const key = Buffer.from(this.config.apiKey, 'hex');
      const iv = crypto.randomBytes(16);
      
      const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
      const jsonData = JSON.stringify(data);
      
      let encrypted = cipher.update(jsonData, 'utf8', 'base64');
      encrypted += cipher.final('base64');
      
      // Combine IV and encrypted data
      const combined = Buffer.concat([iv, Buffer.from(encrypted, 'base64')]);
      
      return combined.toString('base64');
    } catch (error) {
      logger.error('Data encryption failed', error);
      throw error;
    }
  }

  /**
   * 데이터 복호화
   */
  private decryptData(encData: string): any {
    try {
      const key = Buffer.from(this.config.apiKey, 'hex');
      const combined = Buffer.from(encData, 'base64');
      
      // Extract IV and encrypted data
      const iv = combined.slice(0, 16);
      const encrypted = combined.slice(16);
      
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      
      let decrypted = decipher.update(encrypted, null, 'utf8');
      decrypted += decipher.final('utf8');
      
      return JSON.parse(decrypted);
    } catch (error) {
      logger.error('Data decryption failed', error);
      throw error;
    }
  }

  /**
   * 요청 ID 생성
   */
  private generateRequestId(): string {
    const timestamp = Date.now().toString();
    const random = crypto.randomBytes(4).toString('hex');
    return `NICE_${timestamp}_${random}`;
  }

  /**
   * 인증 타입 매핑
   */
  private getAuthType(type: string): string {
    const typeMap: Record<string, string> = {
      'SIGNUP': 'M',      // 회원가입
      'LOGIN': 'L',       // 로그인
      'FIND_PASSWORD': 'F', // 비밀번호 찾기
      'PAYMENT': 'P',     // 결제
      'CHANGE_INFO': 'C'  // 정보변경
    };
    return typeMap[type] || 'M';
  }

  /**
   * 결과 파싱
   */
  private parseResult(data: any): VerificationResult {
    const success = data.resultCode === '0000';
    const verified = success && data.authResult === 'Y';

    return {
      success,
      verified,
      name: data.name,
      birthDate: data.birthDate,
      gender: data.gender === 'M' ? '남성' : '여성',
      nationalInfo: data.nationalInfo === 'L' ? '내국인' : '외국인',
      ci: data.connInfo,       // 연계정보
      di: data.dupInfo,        // 중복가입확인정보
      message: verified ? '본인인증이 완료되었습니다.' : '본인인증에 실패했습니다.'
    };
  }
}