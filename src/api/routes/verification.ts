import { Router } from 'express';
import {
  sendVerificationCode,
  verifyCode,
  requestIdentityVerification,
  checkIdentityVerification,
  verificationCallback,
  checkPhoneVerificationStatus
} from '../controllers/verificationController';
import { authenticate } from '../../middleware/auth';
import { rateLimiter } from '../../middleware/rateLimiter';

const router = Router();

// SMS 인증번호 발송 (Rate limit: auth type)
router.post(
  '/send-code',
  rateLimiter('auth'),
  sendVerificationCode
);

// SMS 인증번호 확인 (Rate limit: auth type)
router.post(
  '/verify-code',
  rateLimiter('auth'),
  verifyCode
);

// 본인인증 요청
router.post(
  '/identity/request',
  rateLimiter('auth'),
  requestIdentityVerification
);

// 본인인증 결과 확인
router.get(
  '/identity/check/:requestId',
  checkIdentityVerification
);

// 본인인증 콜백 (인증 업체에서 호출)
router.post(
  '/callback',
  verificationCallback
);

// 휴대폰 인증 상태 확인 (로그인 필요)
router.get(
  '/status',
  authenticate,
  checkPhoneVerificationStatus
);

export default router;