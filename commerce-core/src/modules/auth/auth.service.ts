/**
 * Authentication Service
 * Core authentication and authorization logic
 */

import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import * as speakeasy from 'speakeasy';
import * as crypto from 'crypto';
import { AuthRepository } from './auth.repository';
import {
  User,
  UserSession,
  VerificationCode,
  PasswordResetToken,
  LoginAttempt,
  SocialAccount,
  AuthAuditLog,
  TrustedDevice,
  AuthAction,
  createUser,
  createSession
} from './auth.entity';
import {
  LoginCredentials,
  RegisterData,
  SocialLoginData,
  TokenPayload,
  TokenPair,
  AuthResponse,
  AuthUser,
  PhoneVerificationRequest,
  EmailVerificationRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  UpdateProfileRequest,
  ChangePasswordRequest,
  UserRole,
  Permission,
  RolePermissions,
  AuthErrorCode,
  AuthError,
  DefaultPasswordPolicy,
  KoreanValidationPatterns,
  AuthRateLimits
} from './auth.types';
import { LoggerService } from '../../core/services/logger.service';
import { Injectable } from '../../core/di/decorators';

@Injectable()
export class AuthService {
  private readonly jwtSecret: string;
  private readonly jwtExpiresIn: string;
  private readonly refreshTokenExpiresIn: string;
  private readonly bcryptRounds: number;
  private readonly verificationCodeLength: number;
  private readonly maxLoginAttempts: number;
  private readonly lockoutDuration: number;

  constructor(
    private repository: AuthRepository,
    private logger: LoggerService
  ) {
    // Load from config or environment
    this.jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '15m';
    this.refreshTokenExpiresIn = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';
    this.bcryptRounds = parseInt(process.env.BCRYPT_ROUNDS || '10');
    this.verificationCodeLength = 6;
    this.maxLoginAttempts = 5;
    this.lockoutDuration = 30 * 60 * 1000; // 30 minutes
  }

  /**
   * User Registration
   */
  async register(data: RegisterData): Promise<AuthResponse> {
    try {
      // Validate input
      await this.validateRegistrationData(data);

      // Check for existing user
      const existingEmail = await this.repository.findByEmail(data.email);
      if (existingEmail) {
        throw new AuthError(AuthErrorCode.DUPLICATE_EMAIL, 'Email already registered');
      }

      const existingPhone = await this.repository.findByPhoneNumber(data.phoneNumber);
      if (existingPhone) {
        throw new AuthError(AuthErrorCode.DUPLICATE_PHONE, 'Phone number already registered');
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(data.password, this.bcryptRounds);

      // Create user
      const user = await this.repository.create({
        ...data,
        password: hashedPassword,
        role: UserRole.CUSTOMER,
        isActive: true,
        isVerified: false,
        emailVerified: false,
        phoneVerified: false,
        twoFactorEnabled: false,
        failedLoginAttempts: 0,
        termsAcceptedAt: new Date(),
        privacyAcceptedAt: new Date()
      });

      // Send verification codes
      await this.sendEmailVerificationCode(user.id, user.email);
      await this.sendPhoneVerificationCode(user.id, user.phoneNumber);

      // Create session
      const tokens = await this.createUserSession(user);

      // Audit log
      await this.createAuditLog(user.id, AuthAction.REGISTER, true);

      return {
        user: this.sanitizeUser(user),
        tokens
      };
    } catch (error) {
      this.logger.error('Registration failed', error);
      throw error;
    }
  }

  /**
   * User Login
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      const { email, phoneNumber, password } = credentials;
      const identifier = email || phoneNumber || '';

      // Check rate limiting
      await this.checkRateLimit(identifier, 'login');

      // Find user
      const user = await this.repository.findByEmailOrPhone(identifier);
      if (!user) {
        await this.recordFailedLogin(identifier, 'User not found');
        throw new AuthError(AuthErrorCode.INVALID_CREDENTIALS, 'Invalid credentials');
      }

      // Check account status
      if (!user.isActive) {
        await this.recordFailedLogin(identifier, 'Account inactive', user.id);
        throw new AuthError(AuthErrorCode.USER_INACTIVE, 'Account is inactive');
      }

      // Check lockout
      if (user.lockedUntil && user.lockedUntil > new Date()) {
        await this.recordFailedLogin(identifier, 'Account locked', user.id);
        throw new AuthError(AuthErrorCode.USER_LOCKED, 'Account is locked');
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        await this.handleFailedLogin(user);
        throw new AuthError(AuthErrorCode.INVALID_CREDENTIALS, 'Invalid credentials');
      }

      // Check if email/phone verification required
      if (!user.emailVerified && !user.phoneVerified) {
        throw new AuthError(
          AuthErrorCode.EMAIL_NOT_VERIFIED,
          'Please verify your email or phone number'
        );
      }

      // Check 2FA if enabled
      if (user.twoFactorEnabled) {
        // Return partial response for 2FA
        return {
          user: { id: user.id } as AuthUser,
          tokens: { accessToken: '', refreshToken: '', expiresIn: 0 },
          message: 'Two-factor authentication required'
        };
      }

      // Successful login
      await this.repository.resetFailedAttempts(user.id);
      await this.repository.updateLastLogin(user.id);
      
      const tokens = await this.createUserSession(user);
      await this.recordSuccessfulLogin(user.id, identifier);
      await this.createAuditLog(user.id, AuthAction.LOGIN, true);

      return {
        user: this.sanitizeUser(user),
        tokens
      };
    } catch (error) {
      this.logger.error('Login failed', error);
      throw error;
    }
  }

  /**
   * Social Login
   */
  async socialLogin(data: SocialLoginData): Promise<AuthResponse> {
    try {
      const { provider, accessToken, profile } = data;

      // Verify social token with provider
      const verifiedProfile = await this.verifySocialToken(provider, accessToken);
      if (!verifiedProfile) {
        throw new AuthError(AuthErrorCode.SOCIAL_LOGIN_FAILED, 'Invalid social token');
      }

      // Find existing social account
      let socialAccount = await this.repository.findSocialAccount(
        provider,
        verifiedProfile.id
      );

      let user: User;

      if (socialAccount) {
        // Existing social account - get user
        user = await this.repository.findById(socialAccount.userId);
        if (!user) {
          throw new AuthError(AuthErrorCode.USER_NOT_FOUND, 'User not found');
        }

        // Update social account
        await this.repository.updateSocialAccount(socialAccount.id, {
          accessToken,
          refreshToken: data.refreshToken,
          lastUsed: new Date()
        });
      } else {
        // New social account - check if user exists with email
        if (verifiedProfile.email) {
          user = await this.repository.findByEmail(verifiedProfile.email);
        }

        if (user) {
          // Link social account to existing user
          socialAccount = await this.repository.createSocialAccount({
            id: '',
            userId: user.id,
            provider,
            providerId: verifiedProfile.id,
            email: verifiedProfile.email,
            name: verifiedProfile.name,
            profileImage: verifiedProfile.profileImage,
            accessToken,
            refreshToken: data.refreshToken,
            lastUsed: new Date(),
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
          });
        } else {
          // Create new user from social profile
          user = await this.repository.create({
            email: verifiedProfile.email || `${provider}_${verifiedProfile.id}@social.local`,
            phoneNumber: verifiedProfile.phoneNumber || '',
            password: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), this.bcryptRounds),
            name: verifiedProfile.name || 'Social User',
            profileImage: verifiedProfile.profileImage,
            role: UserRole.CUSTOMER,
            isActive: true,
            isVerified: true,
            emailVerified: !!verifiedProfile.email,
            phoneVerified: !!verifiedProfile.phoneNumber,
            twoFactorEnabled: false,
            failedLoginAttempts: 0,
            marketingConsent: false,
            termsAcceptedAt: new Date(),
            privacyAcceptedAt: new Date()
          });

          // Create social account
          socialAccount = await this.repository.createSocialAccount({
            id: '',
            userId: user.id,
            provider,
            providerId: verifiedProfile.id,
            email: verifiedProfile.email,
            name: verifiedProfile.name,
            profileImage: verifiedProfile.profileImage,
            accessToken,
            refreshToken: data.refreshToken,
            lastUsed: new Date(),
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
          });
        }
      }

      // Check account status
      if (!user.isActive) {
        throw new AuthError(AuthErrorCode.USER_INACTIVE, 'Account is inactive');
      }

      // Create session
      const tokens = await this.createUserSession(user);
      await this.createAuditLog(user.id, AuthAction.LOGIN, true, { provider });

      return {
        user: this.sanitizeUser(user),
        tokens
      };
    } catch (error) {
      this.logger.error('Social login failed', error);
      throw error;
    }
  }

  /**
   * Logout
   */
  async logout(sessionToken: string): Promise<void> {
    try {
      const session = await this.repository.findSessionByToken(sessionToken);
      if (session) {
        await this.repository.revokeSession(session.id, 'User logout');
        await this.createAuditLog(session.userId, AuthAction.LOGOUT, true);
      }
    } catch (error) {
      this.logger.error('Logout failed', error);
      throw error;
    }
  }

  /**
   * Refresh Token
   */
  async refreshToken(refreshToken: string): Promise<TokenPair> {
    try {
      const session = await this.repository.findSessionByRefreshToken(refreshToken);
      if (!session) {
        throw new AuthError(AuthErrorCode.TOKEN_INVALID, 'Invalid refresh token');
      }

      const user = await this.repository.findById(session.userId);
      if (!user || !user.isActive) {
        throw new AuthError(AuthErrorCode.USER_INACTIVE, 'User inactive');
      }

      // Generate new tokens
      const tokens = await this.generateTokenPair(user, session.id);

      // Update session
      await this.repository.updateSessionActivity(session.id);

      return tokens;
    } catch (error) {
      this.logger.error('Token refresh failed', error);
      throw error;
    }
  }

  /**
   * Phone Verification
   */
  async sendPhoneVerificationCode(userId: string, phoneNumber: string): Promise<void> {
    try {
      // Validate phone format
      if (!KoreanValidationPatterns.phoneNumber.test(phoneNumber)) {
        throw new AuthError(AuthErrorCode.INVALID_PHONE_FORMAT, 'Invalid phone number format');
      }

      const code = this.generateVerificationCode();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

      await this.repository.createVerificationCode({
        id: '',
        userId,
        type: 'phone',
        code,
        identifier: phoneNumber,
        expiresAt,
        attempts: 0,
        maxAttempts: 3,
        verified: false,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Send SMS (implement SMS provider integration)
      await this.sendSMS(phoneNumber, `Your verification code is: ${code}`);
    } catch (error) {
      this.logger.error('Phone verification failed', error);
      throw error;
    }
  }

  async verifyPhone(request: PhoneVerificationRequest): Promise<void> {
    try {
      const { phoneNumber, code } = request;
      
      const user = await this.repository.findByPhoneNumber(phoneNumber);
      if (!user) {
        throw new AuthError(AuthErrorCode.USER_NOT_FOUND, 'User not found');
      }

      const verificationCode = await this.repository.findVerificationCode(
        user.id,
        'phone',
        code!
      );

      if (!verificationCode) {
        throw new AuthError(
          AuthErrorCode.VERIFICATION_CODE_INVALID,
          'Invalid verification code'
        );
      }

      // Check attempts
      if (verificationCode.attempts >= verificationCode.maxAttempts) {
        throw new AuthError(
          AuthErrorCode.VERIFICATION_CODE_INVALID,
          'Too many attempts'
        );
      }

      // Verify code
      await this.repository.verifyCode(verificationCode.id);
      await this.repository.update(user.id, {
        phoneVerified: true,
        phoneVerifiedAt: new Date()
      });

      await this.createAuditLog(user.id, AuthAction.PHONE_VERIFICATION, true);
    } catch (error) {
      this.logger.error('Phone verification failed', error);
      throw error;
    }
  }

  /**
   * Email Verification
   */
  async sendEmailVerificationCode(userId: string, email: string): Promise<void> {
    try {
      const code = this.generateVerificationCode();
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

      await this.repository.createVerificationCode({
        id: '',
        userId,
        type: 'email',
        code,
        identifier: email,
        expiresAt,
        attempts: 0,
        maxAttempts: 3,
        verified: false,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Send email (implement email provider integration)
      await this.sendEmail(email, 'Verification Code', `Your verification code is: ${code}`);
    } catch (error) {
      this.logger.error('Email verification failed', error);
      throw error;
    }
  }

  async verifyEmail(request: EmailVerificationRequest): Promise<void> {
    try {
      const { email, code } = request;
      
      const user = await this.repository.findByEmail(email);
      if (!user) {
        throw new AuthError(AuthErrorCode.USER_NOT_FOUND, 'User not found');
      }

      const verificationCode = await this.repository.findVerificationCode(
        user.id,
        'email',
        code!
      );

      if (!verificationCode) {
        throw new AuthError(
          AuthErrorCode.VERIFICATION_CODE_INVALID,
          'Invalid verification code'
        );
      }

      // Verify code
      await this.repository.verifyCode(verificationCode.id);
      await this.repository.update(user.id, {
        emailVerified: true,
        emailVerifiedAt: new Date()
      });

      await this.createAuditLog(user.id, AuthAction.EMAIL_VERIFICATION, true);
    } catch (error) {
      this.logger.error('Email verification failed', error);
      throw error;
    }
  }

  /**
   * Password Management
   */
  async forgotPassword(request: ForgotPasswordRequest): Promise<void> {
    try {
      const { email, phoneNumber } = request;
      const identifier = email || phoneNumber || '';

      const user = await this.repository.findByEmailOrPhone(identifier);
      if (!user) {
        // Don't reveal if user exists
        return;
      }

      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await this.repository.createPasswordResetToken({
        id: '',
        userId: user.id,
        token,
        expiresAt,
        used: false,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Send reset link
      const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
      
      if (email) {
        await this.sendEmail(
          email,
          'Password Reset',
          `Click here to reset your password: ${resetLink}`
        );
      } else if (phoneNumber) {
        await this.sendSMS(
          phoneNumber,
          `Password reset link: ${resetLink}`
        );
      }

      await this.createAuditLog(user.id, AuthAction.PASSWORD_RESET_REQUEST, true);
    } catch (error) {
      this.logger.error('Forgot password failed', error);
      throw error;
    }
  }

  async resetPassword(request: ResetPasswordRequest): Promise<void> {
    try {
      const { token, newPassword, confirmPassword } = request;

      if (newPassword !== confirmPassword) {
        throw new AuthError(
          AuthErrorCode.PASSWORD_TOO_WEAK,
          'Passwords do not match'
        );
      }

      const resetToken = await this.repository.findPasswordResetToken(token);
      if (!resetToken) {
        throw new AuthError(
          AuthErrorCode.TOKEN_INVALID,
          'Invalid or expired token'
        );
      }

      const user = await this.repository.findById(resetToken.userId);
      if (!user) {
        throw new AuthError(AuthErrorCode.USER_NOT_FOUND, 'User not found');
      }

      // Validate password
      this.validatePassword(newPassword, user);

      // Hash and update password
      const hashedPassword = await bcrypt.hash(newPassword, this.bcryptRounds);
      await this.repository.update(user.id, {
        password: hashedPassword,
        passwordChangedAt: new Date()
      });

      // Mark token as used
      await this.repository.usePasswordResetToken(resetToken.id);

      // Revoke all sessions
      await this.repository.revokeAllUserSessions(user.id);

      await this.createAuditLog(user.id, AuthAction.PASSWORD_RESET_COMPLETE, true);
    } catch (error) {
      this.logger.error('Password reset failed', error);
      throw error;
    }
  }

  async changePassword(userId: string, request: ChangePasswordRequest): Promise<void> {
    try {
      const { currentPassword, newPassword, confirmPassword } = request;

      if (newPassword !== confirmPassword) {
        throw new AuthError(
          AuthErrorCode.PASSWORD_TOO_WEAK,
          'Passwords do not match'
        );
      }

      const user = await this.repository.findById(userId);
      if (!user) {
        throw new AuthError(AuthErrorCode.USER_NOT_FOUND, 'User not found');
      }

      // Verify current password
      const isValid = await bcrypt.compare(currentPassword, user.password);
      if (!isValid) {
        throw new AuthError(
          AuthErrorCode.INVALID_CREDENTIALS,
          'Current password is incorrect'
        );
      }

      // Validate new password
      this.validatePassword(newPassword, user);

      // Update password
      const hashedPassword = await bcrypt.hash(newPassword, this.bcryptRounds);
      await this.repository.update(user.id, {
        password: hashedPassword,
        passwordChangedAt: new Date()
      });

      await this.createAuditLog(user.id, AuthAction.PASSWORD_CHANGE, true);
    } catch (error) {
      this.logger.error('Password change failed', error);
      throw error;
    }
  }

  /**
   * Profile Management
   */
  async getProfile(userId: string): Promise<AuthUser> {
    const user = await this.repository.findById(userId);
    if (!user) {
      throw new AuthError(AuthErrorCode.USER_NOT_FOUND, 'User not found');
    }
    return this.sanitizeUser(user);
  }

  async updateProfile(userId: string, data: UpdateProfileRequest): Promise<AuthUser> {
    try {
      // Validate Korean name if provided
      if (data.koreanName && !KoreanValidationPatterns.koreanName.test(data.koreanName)) {
        throw new AuthError(
          AuthErrorCode.INVALID_KOREAN_NAME,
          'Invalid Korean name format'
        );
      }

      // Validate phone if changed
      if (data.phoneNumber && data.phoneNumber !== (await this.repository.findById(userId))?.phoneNumber) {
        if (!KoreanValidationPatterns.phoneNumber.test(data.phoneNumber)) {
          throw new AuthError(
            AuthErrorCode.INVALID_PHONE_FORMAT,
            'Invalid phone number format'
          );
        }

        // Check if phone is already used
        const existingPhone = await this.repository.findByPhoneNumber(data.phoneNumber);
        if (existingPhone && existingPhone.id !== userId) {
          throw new AuthError(
            AuthErrorCode.DUPLICATE_PHONE,
            'Phone number already in use'
          );
        }
      }

      const updated = await this.repository.update(userId, data);
      await this.createAuditLog(userId, AuthAction.PROFILE_UPDATE, true);
      
      return this.sanitizeUser(updated);
    } catch (error) {
      this.logger.error('Profile update failed', error);
      throw error;
    }
  }

  /**
   * Two-Factor Authentication
   */
  async enableTwoFactor(userId: string): Promise<{ secret: string; qrCode: string }> {
    try {
      const user = await this.repository.findById(userId);
      if (!user) {
        throw new AuthError(AuthErrorCode.USER_NOT_FOUND, 'User not found');
      }

      const secret = speakeasy.generateSecret({
        name: `YourApp (${user.email})`,
        issuer: 'YourApp'
      });

      await this.repository.update(userId, {
        twoFactorSecret: secret.base32
      });

      await this.createAuditLog(userId, AuthAction.TWO_FACTOR_ENABLE, true);

      return {
        secret: secret.base32,
        qrCode: secret.otpauth_url || ''
      };
    } catch (error) {
      this.logger.error('Enable 2FA failed', error);
      throw error;
    }
  }

  async verifyTwoFactor(userId: string, code: string): Promise<boolean> {
    try {
      const user = await this.repository.findById(userId);
      if (!user || !user.twoFactorSecret) {
        throw new AuthError(AuthErrorCode.USER_NOT_FOUND, 'User not found');
      }

      const verified = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token: code,
        window: 2
      });

      if (verified) {
        if (!user.twoFactorEnabled) {
          await this.repository.update(userId, { twoFactorEnabled: true });
        }
        await this.createAuditLog(userId, AuthAction.TWO_FACTOR_VERIFY, true);
      }

      return verified;
    } catch (error) {
      this.logger.error('Verify 2FA failed', error);
      throw error;
    }
  }

  /**
   * Authorization
   */
  async hasPermission(userId: string, permission: Permission): Promise<boolean> {
    const user = await this.repository.findById(userId);
    if (!user) return false;

    const rolePermissions = RolePermissions[user.role] || [];
    return rolePermissions.includes(permission);
  }

  async hasAnyPermission(userId: string, permissions: Permission[]): Promise<boolean> {
    const user = await this.repository.findById(userId);
    if (!user) return false;

    const rolePermissions = RolePermissions[user.role] || [];
    return permissions.some(p => rolePermissions.includes(p));
  }

  async hasAllPermissions(userId: string, permissions: Permission[]): Promise<boolean> {
    const user = await this.repository.findById(userId);
    if (!user) return false;

    const rolePermissions = RolePermissions[user.role] || [];
    return permissions.every(p => rolePermissions.includes(p));
  }

  /**
   * Helper Methods
   */
  private async validateRegistrationData(data: RegisterData): Promise<void> {
    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      throw new AuthError(AuthErrorCode.INVALID_CREDENTIALS, 'Invalid email format');
    }

    // Validate phone
    if (!KoreanValidationPatterns.phoneNumber.test(data.phoneNumber)) {
      throw new AuthError(AuthErrorCode.INVALID_PHONE_FORMAT, 'Invalid phone number format');
    }

    // Validate Korean name if provided
    if (data.koreanName && !KoreanValidationPatterns.koreanName.test(data.koreanName)) {
      throw new AuthError(AuthErrorCode.INVALID_KOREAN_NAME, 'Invalid Korean name format');
    }

    // Validate password
    this.validatePassword(data.password);

    // Validate required consents
    if (!data.termsAccepted || !data.privacyAccepted) {
      throw new AuthError(AuthErrorCode.INVALID_CREDENTIALS, 'Required consents not accepted');
    }
  }

  private validatePassword(password: string, user?: User): void {
    const policy = DefaultPasswordPolicy;

    if (password.length < policy.minLength) {
      throw new AuthError(
        AuthErrorCode.PASSWORD_TOO_WEAK,
        `Password must be at least ${policy.minLength} characters`
      );
    }

    if (policy.requireUppercase && !/[A-Z]/.test(password)) {
      throw new AuthError(
        AuthErrorCode.PASSWORD_TOO_WEAK,
        'Password must contain uppercase letters'
      );
    }

    if (policy.requireLowercase && !/[a-z]/.test(password)) {
      throw new AuthError(
        AuthErrorCode.PASSWORD_TOO_WEAK,
        'Password must contain lowercase letters'
      );
    }

    if (policy.requireNumbers && !/\d/.test(password)) {
      throw new AuthError(
        AuthErrorCode.PASSWORD_TOO_WEAK,
        'Password must contain numbers'
      );
    }

    if (policy.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      throw new AuthError(
        AuthErrorCode.PASSWORD_TOO_WEAK,
        'Password must contain special characters'
      );
    }

    // Check if password contains user info
    if (policy.preventUserInfo && user) {
      const lowerPassword = password.toLowerCase();
      if (
        lowerPassword.includes(user.email.toLowerCase()) ||
        lowerPassword.includes(user.name.toLowerCase())
      ) {
        throw new AuthError(
          AuthErrorCode.PASSWORD_TOO_WEAK,
          'Password cannot contain personal information'
        );
      }
    }
  }

  private async createUserSession(user: User): Promise<TokenPair> {
    const sessionId = crypto.randomUUID();
    const tokens = await this.generateTokenPair(user, sessionId);

    const session = createSession(user.id, {
      sessionToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      userAgent: '', // Get from request
      ipAddress: '', // Get from request
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    });

    await this.repository.createSession(session);

    return tokens;
  }

  private async generateTokenPair(user: User, sessionId: string): Promise<TokenPair> {
    const permissions = RolePermissions[user.role] || [];
    
    const payload: TokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      permissions,
      sessionId
    };

    const accessToken = jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.jwtExpiresIn
    });

    const refreshToken = jwt.sign(
      { userId: user.id, sessionId, type: 'refresh' },
      this.jwtSecret,
      { expiresIn: this.refreshTokenExpiresIn }
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: 900 // 15 minutes in seconds
    };
  }

  private sanitizeUser(user: User): AuthUser {
    const permissions = RolePermissions[user.role] || [];
    
    return {
      id: user.id,
      email: user.email,
      phoneNumber: user.phoneNumber,
      name: user.name,
      koreanName: user.koreanName,
      role: user.role,
      permissions,
      isActive: user.isActive,
      isVerified: user.isVerified,
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified,
      twoFactorEnabled: user.twoFactorEnabled,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
  }

  private generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private async handleFailedLogin(user: User): Promise<void> {
    const attempts = await this.repository.incrementFailedAttempts(user.id);
    
    if (attempts >= this.maxLoginAttempts) {
      const lockUntil = new Date(Date.now() + this.lockoutDuration);
      await this.repository.lockAccount(user.id, lockUntil, 'Too many failed login attempts');
      await this.createAuditLog(user.id, AuthAction.ACCOUNT_LOCK, true);
    }
    
    await this.recordFailedLogin(user.email, 'Invalid password', user.id);
  }

  private async recordFailedLogin(
    identifier: string,
    reason: string,
    userId?: string
  ): Promise<void> {
    await this.repository.recordLoginAttempt({
      id: '',
      userId,
      identifier,
      ipAddress: '', // Get from request
      userAgent: '', // Get from request
      success: false,
      failureReason: reason,
      attemptedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  private async recordSuccessfulLogin(userId: string, identifier: string): Promise<void> {
    await this.repository.recordLoginAttempt({
      id: '',
      userId,
      identifier,
      ipAddress: '', // Get from request
      userAgent: '', // Get from request
      success: true,
      attemptedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  private async createAuditLog(
    userId: string | undefined,
    action: AuthAction,
    success: boolean,
    details?: any
  ): Promise<void> {
    await this.repository.createAuditLog({
      id: '',
      userId,
      action,
      ipAddress: '', // Get from request
      userAgent: '', // Get from request
      success,
      details,
      performedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  private async checkRateLimit(identifier: string, action: keyof typeof AuthRateLimits): Promise<void> {
    const config = AuthRateLimits[action];
    const attempts = await this.repository.getFailedLoginCount(
      identifier,
      config.windowMs / 60000
    );

    if (attempts >= config.maxAttempts) {
      throw new AuthError(
        AuthErrorCode.RATE_LIMIT_EXCEEDED,
        'Too many attempts. Please try again later.',
        429
      );
    }
  }

  private async verifySocialToken(
    provider: string,
    token: string
  ): Promise<any> {
    // Implement provider-specific token verification
    // This is a placeholder - implement actual provider APIs
    switch (provider) {
      case 'kakao':
        return this.verifyKakaoToken(token);
      case 'naver':
        return this.verifyNaverToken(token);
      case 'google':
        return this.verifyGoogleToken(token);
      default:
        throw new AuthError(AuthErrorCode.SOCIAL_LOGIN_FAILED, 'Unknown provider');
    }
  }

  private async verifyKakaoToken(token: string): Promise<any> {
    // Implement Kakao API verification
    // https://developers.kakao.com/docs/latest/ko/kakaologin/rest-api
    return null;
  }

  private async verifyNaverToken(token: string): Promise<any> {
    // Implement Naver API verification
    // https://developers.naver.com/docs/login/api/
    return null;
  }

  private async verifyGoogleToken(token: string): Promise<any> {
    // Implement Google API verification
    // https://developers.google.com/identity/protocols/oauth2
    return null;
  }

  private async sendSMS(phoneNumber: string, message: string): Promise<void> {
    // Implement SMS provider integration
    // Popular Korean SMS providers: Aligo, Popbill, etc.
    this.logger.info(`SMS to ${phoneNumber}: ${message}`);
  }

  private async sendEmail(to: string, subject: string, body: string): Promise<void> {
    // Implement email provider integration
    // Popular providers: SendGrid, AWS SES, etc.
    this.logger.info(`Email to ${to}: ${subject}`);
  }
}