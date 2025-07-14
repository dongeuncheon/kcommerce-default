import { Request, Response } from 'express';
import { OAuthService } from '../../services/auth/oauthService';
import { logger } from '../../utils/logger';

const oauthService = new OAuthService();

export const oauthController = {
  /**
   * 네이버 로그인 시작
   */
  async naverLogin(req: Request, res: Response) {
    try {
      const state = req.query.state as string;
      const authUrl = oauthService.getNaverAuthUrl(state);
      res.redirect(authUrl);
    } catch (error) {
      logger.error('Naver login initiation failed', error);
      res.redirect('/login?error=oauth_failed');
    }
  },

  /**
   * 네이버 로그인 콜백
   */
  async naverCallback(req: Request, res: Response) {
    try {
      const { code, state, error: oauthError } = req.query;

      if (oauthError) {
        logger.error('Naver OAuth error', { error: oauthError });
        return res.redirect('/login?error=oauth_denied');
      }

      if (!code) {
        return res.redirect('/login?error=oauth_failed');
      }

      const { user, token } = await oauthService.handleNaverCallback(
        code as string, 
        state as string
      );

      // 프론트엔드로 리다이렉트 (토큰 포함)
      const redirectUrl = new URL(process.env.FRONTEND_URL || 'http://localhost:5173');
      redirectUrl.pathname = '/auth/callback';
      redirectUrl.searchParams.set('token', token);
      redirectUrl.searchParams.set('provider', 'naver');
      
      res.redirect(redirectUrl.toString());
    } catch (error: any) {
      logger.error('Naver callback failed', error);
      res.redirect('/login?error=oauth_failed&message=' + encodeURIComponent(error.message));
    }
  },

  /**
   * 카카오 로그인 시작
   */
  async kakaoLogin(req: Request, res: Response) {
    try {
      const state = req.query.state as string;
      const authUrl = oauthService.getKakaoAuthUrl(state);
      res.redirect(authUrl);
    } catch (error) {
      logger.error('Kakao login initiation failed', error);
      res.redirect('/login?error=oauth_failed');
    }
  },

  /**
   * 카카오 로그인 콜백
   */
  async kakaoCallback(req: Request, res: Response) {
    try {
      const { code, error: oauthError } = req.query;

      if (oauthError) {
        logger.error('Kakao OAuth error', { error: oauthError });
        return res.redirect('/login?error=oauth_denied');
      }

      if (!code) {
        return res.redirect('/login?error=oauth_failed');
      }

      const { user, token } = await oauthService.handleKakaoCallback(code as string);

      // 프론트엔드로 리다이렉트 (토큰 포함)
      const redirectUrl = new URL(process.env.FRONTEND_URL || 'http://localhost:5173');
      redirectUrl.pathname = '/auth/callback';
      redirectUrl.searchParams.set('token', token);
      redirectUrl.searchParams.set('provider', 'kakao');
      
      res.redirect(redirectUrl.toString());
    } catch (error: any) {
      logger.error('Kakao callback failed', error);
      res.redirect('/login?error=oauth_failed&message=' + encodeURIComponent(error.message));
    }
  },

  /**
   * OAuth 계정 연결 해제
   */
  async unlinkAccount(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const { provider } = req.params;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: '인증이 필요합니다.'
        });
      }

      if (!['naver', 'kakao'].includes(provider)) {
        return res.status(400).json({
          success: false,
          error: '지원하지 않는 제공자입니다.'
        });
      }

      await oauthService.unlinkOAuthAccount(userId, provider as 'naver' | 'kakao');

      res.json({
        success: true,
        message: `${provider} 계정 연결이 해제되었습니다.`
      });
    } catch (error: any) {
      logger.error('Failed to unlink account', error);
      res.status(500).json({
        success: false,
        error: error.message || '계정 연결 해제에 실패했습니다.'
      });
    }
  },

  /**
   * 연결된 OAuth 계정 목록 조회
   */
  async getLinkedAccounts(req: Request, res: Response) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: '인증이 필요합니다.'
        });
      }

      const accounts = await oauthService.getLinkedAccounts(userId);

      res.json({
        success: true,
        data: accounts
      });
    } catch (error) {
      logger.error('Failed to get linked accounts', error);
      res.status(500).json({
        success: false,
        error: '연결된 계정 조회에 실패했습니다.'
      });
    }
  }
};