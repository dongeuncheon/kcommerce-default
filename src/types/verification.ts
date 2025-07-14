export interface PhoneVerificationConfig {
  provider: 'NICE' | 'KMC' | 'LGU' | 'PASS';
  apiKey: string;
  apiSecret: string;
  siteCode?: string;
  siteName?: string;
  returnUrl?: string;
  errorUrl?: string;
}

export interface VerificationRequest {
  phone: string;
  type: 'SIGNUP' | 'LOGIN' | 'FIND_PASSWORD' | 'PAYMENT' | 'CHANGE_INFO';
  userId?: string;
  name?: string;
  birthDate?: string;
}

export interface VerificationResponse {
  success: boolean;
  requestId?: string;
  code?: string;
  message?: string;
  error?: string;
}

export interface VerificationResult {
  success: boolean;
  verified: boolean;
  name?: string;
  birthDate?: string;
  gender?: string;
  nationalInfo?: string;
  ci?: string; // 연계정보
  di?: string; // 중복가입확인정보
  message?: string;
}

export interface SMSConfig {
  provider: 'ALIGO' | 'CAFE24' | 'DIRECTSEND';
  apiKey: string;
  userId: string;
  sender: string;
}

export interface SMSRequest {
  phone: string;
  message: string;
  title?: string;
}

export interface SMSResponse {
  success: boolean;
  messageId?: string;
  remainingCount?: number;
  error?: string;
}