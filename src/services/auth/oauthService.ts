import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { logger } from '../../utils/logger';
import { config } from '../../config/config';

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface OAuthUserInfo {
  id: string;
  email?: string;
  name?: string;
  phone?: string;
  profileImage?: string;
  provider: 'naver' | 'kakao';
}

export class OAuthService {
  private prisma: PrismaClient;
  private naverConfig: OAuthConfig;
  private kakaoConfig: OAuthConfig;

  constructor() {
    this.prisma = new PrismaClient();
    
    this.naverConfig = {
      clientId: process.env.NAVER_CLIENT_ID || '',
      clientSecret: process.env.NAVER_CLIENT_SECRET || '',
      redirectUri: process.env.NAVER_REDIRECT_URI || 'http://localhost:3000/api/v1/auth/naver/callback'
    };

    this.kakaoConfig = {
      clientId: process.env.KAKAO_CLIENT_ID || '',
      clientSecret: process.env.KAKAO_CLIENT_SECRET || '',
      redirectUri: process.env.KAKAO_REDIRECT_URI || 'http://localhost:3000/api/v1/auth/kakao/callback'
    };
  }

  /**
   * 네이버 로그인 URL 생성
   */
  getNaverAuthUrl(state?: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.naverConfig.clientId,
      redirect_uri: this.naverConfig.redirectUri,
      state: state || Math.random().toString(36).substring(7)
    });

    return `https://nid.naver.com/oauth2.0/authorize?${params.toString()}`;
  }

  /**
   * 카카오 로그인 URL 생성
   */
  getKakaoAuthUrl(state?: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.kakaoConfig.clientId,
      redirect_uri: this.kakaoConfig.redirectUri,
      state: state || Math.random().toString(36).substring(7)
    });

    return `https://kauth.kakao.com/oauth/authorize?${params.toString()}`;
  }

  /**
   * 네이버 로그인 콜백 처리
   */
  async handleNaverCallback(code: string, state?: string): Promise<{ user: any; token: string }> {
    try {
      // 1. Access Token 획득
      const tokenResponse = await axios.post('https://nid.naver.com/oauth2.0/token', null, {
        params: {
          grant_type: 'authorization_code',
          client_id: this.naverConfig.clientId,
          client_secret: this.naverConfig.clientSecret,
          code,
          state
        }
      });

      const { access_token } = tokenResponse.data;

      // 2. 사용자 정보 조회
      const userResponse = await axios.get('https://openapi.naver.com/v1/nid/me', {
        headers: {
          Authorization: `Bearer ${access_token}`
        }
      });

      const naverUser = userResponse.data.response;
      
      const userInfo: OAuthUserInfo = {
        id: naverUser.id,
        email: naverUser.email,
        name: naverUser.name,
        phone: naverUser.mobile?.replace(/-/g, ''),
        profileImage: naverUser.profile_image,
        provider: 'naver'
      };

      // 3. 사용자 생성 또는 업데이트
      const user = await this.findOrCreateUser(userInfo);

      // 4. JWT 토큰 생성
      const token = this.generateToken(user);

      logger.info('Naver login successful', { userId: user.id });
      return { user, token };
    } catch (error) {
      logger.error('Naver login failed', error);
      throw new Error('네이버 로그인 처리 중 오류가 발생했습니다.');
    }
  }

  /**
   * 카카오 로그인 콜백 처리
   */
  async handleKakaoCallback(code: string): Promise<{ user: any; token: string }> {
    try {
      // 1. Access Token 획득
      const tokenResponse = await axios.post('https://kauth.kakao.com/oauth/token', null, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        params: {
          grant_type: 'authorization_code',
          client_id: this.kakaoConfig.clientId,
          client_secret: this.kakaoConfig.clientSecret,
          redirect_uri: this.kakaoConfig.redirectUri,
          code
        }
      });

      const { access_token } = tokenResponse.data;

      // 2. 사용자 정보 조회
      const userResponse = await axios.get('https://kapi.kakao.com/v2/user/me', {
        headers: {
          Authorization: `Bearer ${access_token}`
        }
      });

      const kakaoUser = userResponse.data;
      const kakaoAccount = kakaoUser.kakao_account;
      
      const userInfo: OAuthUserInfo = {
        id: kakaoUser.id.toString(),
        email: kakaoAccount.email,
        name: kakaoAccount.profile?.nickname,
        phone: kakaoAccount.phone_number?.replace(/^\+82/, '0').replace(/-/g, ''),
        profileImage: kakaoAccount.profile?.profile_image_url,
        provider: 'kakao'
      };

      // 3. 사용자 생성 또는 업데이트
      const user = await this.findOrCreateUser(userInfo);

      // 4. JWT 토큰 생성
      const token = this.generateToken(user);

      logger.info('Kakao login successful', { userId: user.id });
      return { user, token };
    } catch (error) {
      logger.error('Kakao login failed', error);
      throw new Error('카카오 로그인 처리 중 오류가 발생했습니다.');
    }
  }

  /**
   * 사용자 찾기 또는 생성
   */
  private async findOrCreateUser(oauthInfo: OAuthUserInfo) {
    try {
      // OAuth 계정 확인
      let oauthAccount = await this.prisma.oAuthAccount.findUnique({
        where: {
          provider_providerId: {
            provider: oauthInfo.provider,
            providerId: oauthInfo.id
          }
        },
        include: { user: true }
      });

      if (oauthAccount) {
        // 기존 사용자 정보 업데이트
        const updatedUser = await this.prisma.user.update({
          where: { id: oauthAccount.userId },
          data: {
            firstName: oauthInfo.name || oauthAccount.user.firstName,
            phone: oauthInfo.phone || oauthAccount.user.phone,
            lastLoginAt: new Date()
          }
        });

        // OAuth 계정 정보 업데이트
        await this.prisma.oAuthAccount.update({
          where: { id: oauthAccount.id },
          data: {
            accessToken: '', // 보안상 저장하지 않음
            profileData: {
              name: oauthInfo.name,
              email: oauthInfo.email,
              phone: oauthInfo.phone,
              profileImage: oauthInfo.profileImage
            }
          }
        });

        return updatedUser;
      }

      // 이메일로 기존 사용자 확인
      let user = null;
      if (oauthInfo.email) {
        user = await this.prisma.user.findUnique({
          where: { email: oauthInfo.email }
        });
      }

      if (!user) {
        // 새 사용자 생성
        const email = oauthInfo.email || `${oauthInfo.provider}_${oauthInfo.id}@oauth.local`;
        
        user = await this.prisma.user.create({
          data: {
            email,
            firstName: oauthInfo.name,
            phone: oauthInfo.phone,
            password: '', // OAuth 사용자는 비밀번호 없음
            isVerified: true, // SNS 인증된 사용자
            isPhoneVerified: !!oauthInfo.phone,
            lastLoginAt: new Date()
          }
        });
      }

      // OAuth 계정 연결
      await this.prisma.oAuthAccount.create({
        data: {
          userId: user.id,
          provider: oauthInfo.provider,
          providerId: oauthInfo.id,
          profileData: {
            name: oauthInfo.name,
            email: oauthInfo.email,
            phone: oauthInfo.phone,
            profileImage: oauthInfo.profileImage
          }
        }
      });

      return user;
    } catch (error) {
      logger.error('Failed to find or create user', error);
      throw error;
    }
  }

  /**
   * JWT 토큰 생성
   */
  private generateToken(user: any): string {
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role
      },
      config.jwt.secret,
      {
        expiresIn: config.jwt.expiresIn
      }
    );
  }

  /**
   * OAuth 계정 연결 해제
   */
  async unlinkOAuthAccount(userId: string, provider: 'naver' | 'kakao') {
    try {
      const oauthAccount = await this.prisma.oAuthAccount.findFirst({
        where: {
          userId,
          provider
        }
      });

      if (!oauthAccount) {
        throw new Error('연결된 계정을 찾을 수 없습니다.');
      }

      await this.prisma.oAuthAccount.delete({
        where: { id: oauthAccount.id }
      });

      logger.info('OAuth account unlinked', { userId, provider });
    } catch (error) {
      logger.error('Failed to unlink OAuth account', error);
      throw error;
    }
  }

  /**
   * 사용자의 연결된 OAuth 계정 목록 조회
   */
  async getLinkedAccounts(userId: string) {
    try {
      const accounts = await this.prisma.oAuthAccount.findMany({
        where: { userId },
        select: {
          provider: true,
          createdAt: true,
          profileData: true
        }
      });

      return accounts.map(account => ({
        provider: account.provider,
        connectedAt: account.createdAt,
        profile: account.profileData
      }));
    } catch (error) {
      logger.error('Failed to get linked accounts', error);
      throw error;
    }
  }
}