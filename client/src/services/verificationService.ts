import { api } from './api';

interface SendCodeRequest {
  phone: string;
  type: 'SIGNUP' | 'LOGIN' | 'FIND_PASSWORD' | 'PAYMENT' | 'CHANGE_INFO';
  userId?: string;
}

interface VerifyCodeRequest {
  phone: string;
  code: string;
}

interface VerificationResponse {
  success: boolean;
  requestId?: string;
  message?: string;
  error?: string;
}

interface VerificationResult {
  success: boolean;
  verified: boolean;
  message?: string;
}

export const verificationService = {
  /**
   * 인증번호 발송
   */
  sendCode: async (data: SendCodeRequest): Promise<VerificationResponse> => {
    try {
      const response = await api.post('/api/v1/verification/send-code', data);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || '인증번호 발송에 실패했습니다.'
      };
    }
  },

  /**
   * 인증번호 확인
   */
  verifyCode: async (data: VerifyCodeRequest): Promise<VerificationResult> => {
    try {
      const response = await api.post('/api/v1/verification/verify-code', data);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        verified: false,
        message: error.response?.data?.error || '인증 확인에 실패했습니다.'
      };
    }
  },

  /**
   * 휴대폰 인증 상태 확인
   */
  checkStatus: async (): Promise<{
    success: boolean;
    phone?: string;
    isVerified: boolean;
  }> => {
    try {
      const response = await api.get('/api/v1/verification/status');
      return response.data;
    } catch (error) {
      return {
        success: false,
        isVerified: false
      };
    }
  }
};