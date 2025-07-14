import { Request, Response } from 'express';
import { PhoneVerificationService } from '../../services/verification/phoneVerificationService';
import { logger } from '../../utils/logger';
import { config } from '../../config/config';

// Initialize verification service
const phoneVerificationService = new PhoneVerificationService(
  {
    provider: config.verification?.provider || 'NICE',
    apiKey: config.verification?.apiKey || '',
    apiSecret: config.verification?.apiSecret || '',
    siteCode: config.verification?.siteCode,
    siteName: config.verification?.siteName || '커머스',
    returnUrl: config.verification?.returnUrl,
    errorUrl: config.verification?.errorUrl
  },
  {
    provider: config.sms?.provider || 'ALIGO',
    apiKey: config.sms?.apiKey || '',
    userId: config.sms?.userId || '',
    sender: config.sms?.sender || ''
  }
);

/**
 * 인증번호 발송
 */
export const sendVerificationCode = async (req: Request, res: Response) => {
  try {
    const { phone, type = 'SIGNUP', userId } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        error: '휴대폰 번호는 필수입니다.'
      });
    }

    // Validate phone format
    const phoneRegex = /^01[0-9]{8,9}$/;
    if (!phoneRegex.test(phone.replace(/-/g, ''))) {
      return res.status(400).json({
        success: false,
        error: '올바른 휴대폰 번호 형식이 아닙니다.'
      });
    }

    const result = await phoneVerificationService.sendVerificationCode({
      phone: phone.replace(/-/g, ''),
      type,
      userId: userId || req.user?.id,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json(result);
  } catch (error) {
    logger.error('Send verification code error:', error);
    res.status(500).json({
      success: false,
      error: '인증번호 발송에 실패했습니다.'
    });
  }
};

/**
 * 인증번호 확인
 */
export const verifyCode = async (req: Request, res: Response) => {
  try {
    const { phone, code } = req.body;

    if (!phone || !code) {
      return res.status(400).json({
        success: false,
        error: '휴대폰 번호와 인증번호는 필수입니다.'
      });
    }

    const result = await phoneVerificationService.verifyCode(
      phone.replace(/-/g, ''),
      code
    );

    res.json(result);
  } catch (error) {
    logger.error('Verify code error:', error);
    res.status(500).json({
      success: false,
      error: '인증 확인에 실패했습니다.'
    });
  }
};

/**
 * 본인인증 요청
 */
export const requestIdentityVerification = async (req: Request, res: Response) => {
  try {
    const { phone, type = 'SIGNUP', name, birthDate } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        error: '휴대폰 번호는 필수입니다.'
      });
    }

    const result = await phoneVerificationService.requestIdentityVerification({
      phone: phone.replace(/-/g, ''),
      type,
      name,
      birthDate,
      userId: req.user?.id
    });

    res.json(result);
  } catch (error) {
    logger.error('Request identity verification error:', error);
    res.status(500).json({
      success: false,
      error: '본인인증 요청에 실패했습니다.'
    });
  }
};

/**
 * 본인인증 결과 확인
 */
export const checkIdentityVerification = async (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;

    if (!requestId) {
      return res.status(400).json({
        success: false,
        error: '요청 ID는 필수입니다.'
      });
    }

    const result = await phoneVerificationService.checkIdentityVerification(requestId);

    res.json(result);
  } catch (error) {
    logger.error('Check identity verification error:', error);
    res.status(500).json({
      success: false,
      error: '본인인증 확인에 실패했습니다.'
    });
  }
};

/**
 * 본인인증 콜백 처리 (NICE 등에서 호출)
 */
export const verificationCallback = async (req: Request, res: Response) => {
  try {
    const { EncodeData } = req.body;

    if (!EncodeData) {
      return res.status(400).send('Invalid callback data');
    }

    // Process callback based on provider
    const provider = config.verification?.provider || 'NICE';
    
    if (provider === 'NICE') {
      const result = await phoneVerificationService.checkIdentityVerification(EncodeData);
      
      // Redirect to success or error page
      if (result.verified) {
        res.redirect(`${config.verification?.returnUrl}?verified=true&ci=${result.ci}`);
      } else {
        res.redirect(`${config.verification?.errorUrl}?error=${encodeURIComponent(result.message || '')}`);
      }
    } else {
      res.status(400).send('Unsupported provider');
    }
  } catch (error) {
    logger.error('Verification callback error:', error);
    res.redirect(`${config.verification?.errorUrl}?error=${encodeURIComponent('본인인증 처리 중 오류가 발생했습니다.')}`);
  }
};

/**
 * 휴대폰 인증 상태 확인
 */
export const checkPhoneVerificationStatus = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: '로그인이 필요합니다.'
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        phone: true,
        isPhoneVerified: true
      }
    });

    res.json({
      success: true,
      phone: user?.phone,
      isVerified: user?.isPhoneVerified || false
    });
  } catch (error) {
    logger.error('Check phone verification status error:', error);
    res.status(500).json({
      success: false,
      error: '상태 확인에 실패했습니다.'
    });
  }
};