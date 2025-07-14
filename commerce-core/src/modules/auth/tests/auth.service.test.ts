/**
 * Authentication Service Tests
 */

import { AuthService } from '../auth.service';
import { AuthRepository } from '../auth.repository';
import { LoggerService } from '../../../core/services/logger.service';
import { 
  RegisterData, 
  LoginCredentials, 
  AuthErrorCode, 
  AuthError,
  UserRole 
} from '../auth.types';
import { User } from '../auth.entity';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';

// Mock dependencies
jest.mock('../auth.repository');
jest.mock('../../../core/services/logger.service');
jest.mock('bcrypt');
jest.mock('jsonwebtoken');

describe('AuthService', () => {
  let authService: AuthService;
  let mockRepository: jest.Mocked<AuthRepository>;
  let mockLogger: jest.Mocked<LoggerService>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock instances
    mockRepository = new AuthRepository(null as any) as jest.Mocked<AuthRepository>;
    mockLogger = new LoggerService() as jest.Mocked<LoggerService>;

    // Create service instance
    authService = new AuthService(mockRepository, mockLogger);

    // Setup default mock implementations
    mockLogger.info = jest.fn();
    mockLogger.error = jest.fn();
    mockLogger.warn = jest.fn();
  });

  describe('register', () => {
    const validRegistrationData: RegisterData = {
      email: 'test@example.com',
      phoneNumber: '010-1234-5678',
      password: 'SecurePass123!',
      name: 'Test User',
      koreanName: '테스트',
      termsAccepted: true,
      privacyAccepted: true
    };

    it('should register a new user successfully', async () => {
      // Arrange
      const hashedPassword = 'hashed_password';
      const newUser: User = {
        id: 'user-123',
        email: validRegistrationData.email,
        phoneNumber: validRegistrationData.phoneNumber,
        password: hashedPassword,
        name: validRegistrationData.name,
        koreanName: validRegistrationData.koreanName,
        role: UserRole.CUSTOMER,
        isActive: true,
        isVerified: false,
        emailVerified: false,
        phoneVerified: false,
        twoFactorEnabled: false,
        failedLoginAttempts: 0,
        marketingConsent: false,
        termsAcceptedAt: new Date(),
        privacyAcceptedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockRepository.findByEmail.mockResolvedValue(null);
      mockRepository.findByPhoneNumber.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);
      mockRepository.create.mockResolvedValue(newUser);
      mockRepository.createSession.mockResolvedValue({
        id: 'session-123',
        userId: newUser.id,
        sessionToken: 'token',
        refreshToken: 'refresh',
        lastActivity: new Date(),
        expiresAt: new Date(),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      mockRepository.createVerificationCode.mockResolvedValue({} as any);
      mockRepository.createAuditLog.mockResolvedValue(undefined);
      (jwt.sign as jest.Mock).mockReturnValue('jwt_token');

      // Act
      const result = await authService.register(validRegistrationData);

      // Assert
      expect(result).toBeDefined();
      expect(result.user.email).toBe(validRegistrationData.email);
      expect(result.user.role).toBe(UserRole.CUSTOMER);
      expect(result.tokens).toBeDefined();
      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: validRegistrationData.email,
          phoneNumber: validRegistrationData.phoneNumber,
          password: hashedPassword,
          role: UserRole.CUSTOMER
        })
      );
    });

    it('should throw error if email already exists', async () => {
      // Arrange
      mockRepository.findByEmail.mockResolvedValue({ id: 'existing-user' } as User);

      // Act & Assert
      await expect(authService.register(validRegistrationData))
        .rejects
        .toThrow(new AuthError(AuthErrorCode.DUPLICATE_EMAIL, 'Email already registered'));
    });

    it('should throw error if phone number already exists', async () => {
      // Arrange
      mockRepository.findByEmail.mockResolvedValue(null);
      mockRepository.findByPhoneNumber.mockResolvedValue({ id: 'existing-user' } as User);

      // Act & Assert
      await expect(authService.register(validRegistrationData))
        .rejects
        .toThrow(new AuthError(AuthErrorCode.DUPLICATE_PHONE, 'Phone number already registered'));
    });

    it('should validate Korean phone number format', async () => {
      // Arrange
      const invalidData = {
        ...validRegistrationData,
        phoneNumber: '123-456-7890' // Invalid format
      };

      // Act & Assert
      await expect(authService.register(invalidData))
        .rejects
        .toThrow(new AuthError(AuthErrorCode.INVALID_PHONE_FORMAT, 'Invalid phone number format'));
    });

    it('should validate Korean name format', async () => {
      // Arrange
      const invalidData = {
        ...validRegistrationData,
        koreanName: 'abc123' // Invalid Korean name
      };

      // Act & Assert
      await expect(authService.register(invalidData))
        .rejects
        .toThrow(new AuthError(AuthErrorCode.INVALID_KOREAN_NAME, 'Invalid Korean name format'));
    });

    it('should validate password strength', async () => {
      // Arrange
      const weakPasswordData = {
        ...validRegistrationData,
        password: 'weak' // Too short
      };

      // Act & Assert
      await expect(authService.register(weakPasswordData))
        .rejects
        .toThrow(expect.objectContaining({
          code: AuthErrorCode.PASSWORD_TOO_WEAK
        }));
    });
  });

  describe('login', () => {
    const validCredentials: LoginCredentials = {
      email: 'test@example.com',
      password: 'SecurePass123!'
    };

    const mockUser: User = {
      id: 'user-123',
      email: validCredentials.email,
      phoneNumber: '010-1234-5678',
      password: 'hashed_password',
      name: 'Test User',
      role: UserRole.CUSTOMER,
      isActive: true,
      isVerified: true,
      emailVerified: true,
      phoneVerified: true,
      twoFactorEnabled: false,
      failedLoginAttempts: 0,
      marketingConsent: false,
      termsAcceptedAt: new Date(),
      privacyAcceptedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    it('should login successfully with email', async () => {
      // Arrange
      mockRepository.findByEmailOrPhone.mockResolvedValue(mockUser);
      mockRepository.getFailedLoginCount.mockResolvedValue(0);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockRepository.resetFailedAttempts.mockResolvedValue(undefined);
      mockRepository.updateLastLogin.mockResolvedValue(undefined);
      mockRepository.createSession.mockResolvedValue({} as any);
      mockRepository.recordLoginAttempt.mockResolvedValue(undefined);
      mockRepository.createAuditLog.mockResolvedValue(undefined);
      (jwt.sign as jest.Mock).mockReturnValue('jwt_token');

      // Act
      const result = await authService.login(validCredentials);

      // Assert
      expect(result).toBeDefined();
      expect(result.user.email).toBe(validCredentials.email);
      expect(result.tokens).toBeDefined();
      expect(mockRepository.resetFailedAttempts).toHaveBeenCalledWith(mockUser.id);
      expect(mockRepository.updateLastLogin).toHaveBeenCalledWith(mockUser.id);
    });

    it('should login successfully with phone number', async () => {
      // Arrange
      const phoneCredentials: LoginCredentials = {
        phoneNumber: '010-1234-5678',
        password: 'SecurePass123!'
      };

      mockRepository.findByEmailOrPhone.mockResolvedValue(mockUser);
      mockRepository.getFailedLoginCount.mockResolvedValue(0);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockRepository.resetFailedAttempts.mockResolvedValue(undefined);
      mockRepository.updateLastLogin.mockResolvedValue(undefined);
      mockRepository.createSession.mockResolvedValue({} as any);
      mockRepository.recordLoginAttempt.mockResolvedValue(undefined);
      mockRepository.createAuditLog.mockResolvedValue(undefined);
      (jwt.sign as jest.Mock).mockReturnValue('jwt_token');

      // Act
      const result = await authService.login(phoneCredentials);

      // Assert
      expect(result).toBeDefined();
      expect(mockRepository.findByEmailOrPhone).toHaveBeenCalledWith(phoneCredentials.phoneNumber);
    });

    it('should throw error for invalid credentials', async () => {
      // Arrange
      mockRepository.findByEmailOrPhone.mockResolvedValue(mockUser);
      mockRepository.getFailedLoginCount.mockResolvedValue(0);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      mockRepository.incrementFailedAttempts.mockResolvedValue(1);
      mockRepository.recordLoginAttempt.mockResolvedValue(undefined);

      // Act & Assert
      await expect(authService.login(validCredentials))
        .rejects
        .toThrow(new AuthError(AuthErrorCode.INVALID_CREDENTIALS, 'Invalid credentials'));
    });

    it('should lock account after max failed attempts', async () => {
      // Arrange
      mockRepository.findByEmailOrPhone.mockResolvedValue(mockUser);
      mockRepository.getFailedLoginCount.mockResolvedValue(0);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      mockRepository.incrementFailedAttempts.mockResolvedValue(5); // Max attempts
      mockRepository.lockAccount.mockResolvedValue(undefined);
      mockRepository.recordLoginAttempt.mockResolvedValue(undefined);
      mockRepository.createAuditLog.mockResolvedValue(undefined);

      // Act & Assert
      await expect(authService.login(validCredentials))
        .rejects
        .toThrow(new AuthError(AuthErrorCode.INVALID_CREDENTIALS, 'Invalid credentials'));
      
      expect(mockRepository.lockAccount).toHaveBeenCalled();
    });

    it('should throw error for inactive account', async () => {
      // Arrange
      const inactiveUser = { ...mockUser, isActive: false };
      mockRepository.findByEmailOrPhone.mockResolvedValue(inactiveUser);
      mockRepository.getFailedLoginCount.mockResolvedValue(0);
      mockRepository.recordLoginAttempt.mockResolvedValue(undefined);

      // Act & Assert
      await expect(authService.login(validCredentials))
        .rejects
        .toThrow(new AuthError(AuthErrorCode.USER_INACTIVE, 'Account is inactive'));
    });

    it('should throw error for locked account', async () => {
      // Arrange
      const lockedUser = { ...mockUser, lockedUntil: new Date(Date.now() + 3600000) };
      mockRepository.findByEmailOrPhone.mockResolvedValue(lockedUser);
      mockRepository.getFailedLoginCount.mockResolvedValue(0);
      mockRepository.recordLoginAttempt.mockResolvedValue(undefined);

      // Act & Assert
      await expect(authService.login(validCredentials))
        .rejects
        .toThrow(new AuthError(AuthErrorCode.USER_LOCKED, 'Account is locked'));
    });

    it('should require email/phone verification', async () => {
      // Arrange
      const unverifiedUser = { ...mockUser, emailVerified: false, phoneVerified: false };
      mockRepository.findByEmailOrPhone.mockResolvedValue(unverifiedUser);
      mockRepository.getFailedLoginCount.mockResolvedValue(0);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      // Act & Assert
      await expect(authService.login(validCredentials))
        .rejects
        .toThrow(new AuthError(
          AuthErrorCode.EMAIL_NOT_VERIFIED,
          'Please verify your email or phone number'
        ));
    });

    it('should handle rate limiting', async () => {
      // Arrange
      mockRepository.getFailedLoginCount.mockResolvedValue(6); // Exceeds rate limit

      // Act & Assert
      await expect(authService.login(validCredentials))
        .rejects
        .toThrow(new AuthError(
          AuthErrorCode.RATE_LIMIT_EXCEEDED,
          'Too many attempts. Please try again later.',
          429
        ));
    });
  });

  describe('refreshToken', () => {
    it('should refresh token successfully', async () => {
      // Arrange
      const refreshToken = 'valid_refresh_token';
      const session = {
        id: 'session-123',
        userId: 'user-123',
        sessionToken: 'old_token',
        refreshToken,
        lastActivity: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
        isActive: true
      };
      const user = { ...mockUser, id: 'user-123' };

      mockRepository.findSessionByRefreshToken.mockResolvedValue(session as any);
      mockRepository.findById.mockResolvedValue(user);
      mockRepository.updateSessionActivity.mockResolvedValue(undefined);
      (jwt.sign as jest.Mock).mockReturnValue('new_jwt_token');

      // Act
      const result = await authService.refreshToken(refreshToken);

      // Assert
      expect(result).toBeDefined();
      expect(result.accessToken).toBe('new_jwt_token');
      expect(mockRepository.updateSessionActivity).toHaveBeenCalledWith(session.id);
    });

    it('should throw error for invalid refresh token', async () => {
      // Arrange
      mockRepository.findSessionByRefreshToken.mockResolvedValue(null);

      // Act & Assert
      await expect(authService.refreshToken('invalid_token'))
        .rejects
        .toThrow(new AuthError(AuthErrorCode.TOKEN_INVALID, 'Invalid refresh token'));
    });
  });

  describe('verifyPhone', () => {
    it('should verify phone number successfully', async () => {
      // Arrange
      const request = {
        phoneNumber: '010-1234-5678',
        code: '123456'
      };
      const user = { ...mockUser, id: 'user-123' };
      const verificationCode = {
        id: 'code-123',
        userId: user.id,
        type: 'phone' as const,
        code: '123456',
        attempts: 0,
        maxAttempts: 3,
        verified: false
      };

      mockRepository.findByPhoneNumber.mockResolvedValue(user);
      mockRepository.findVerificationCode.mockResolvedValue(verificationCode as any);
      mockRepository.verifyCode.mockResolvedValue(undefined);
      mockRepository.update.mockResolvedValue(user);
      mockRepository.createAuditLog.mockResolvedValue(undefined);

      // Act
      await authService.verifyPhone(request);

      // Assert
      expect(mockRepository.verifyCode).toHaveBeenCalledWith(verificationCode.id);
      expect(mockRepository.update).toHaveBeenCalledWith(user.id, {
        phoneVerified: true,
        phoneVerifiedAt: expect.any(Date)
      });
    });

    it('should throw error for invalid verification code', async () => {
      // Arrange
      const request = {
        phoneNumber: '010-1234-5678',
        code: 'wrong_code'
      };
      const user = { ...mockUser, id: 'user-123' };

      mockRepository.findByPhoneNumber.mockResolvedValue(user);
      mockRepository.findVerificationCode.mockResolvedValue(null);

      // Act & Assert
      await expect(authService.verifyPhone(request))
        .rejects
        .toThrow(new AuthError(
          AuthErrorCode.VERIFICATION_CODE_INVALID,
          'Invalid verification code'
        ));
    });
  });

  describe('permissions', () => {
    it('should check single permission correctly', async () => {
      // Arrange
      const userId = 'user-123';
      const user = { ...mockUser, role: UserRole.MANAGER };
      mockRepository.findById.mockResolvedValue(user);

      // Act
      const hasPermission = await authService.hasPermission(userId, 'manage_products' as any);

      // Assert
      expect(hasPermission).toBe(true);
    });

    it('should check multiple permissions with hasAnyPermission', async () => {
      // Arrange
      const userId = 'user-123';
      const user = { ...mockUser, role: UserRole.CUSTOMER };
      mockRepository.findById.mockResolvedValue(user);

      // Act
      const hasPermission = await authService.hasAnyPermission(userId, [
        'view_own_orders' as any,
        'manage_users' as any
      ]);

      // Assert
      expect(hasPermission).toBe(true); // Customer has view_own_orders
    });

    it('should check multiple permissions with hasAllPermissions', async () => {
      // Arrange
      const userId = 'user-123';
      const user = { ...mockUser, role: UserRole.ADMIN };
      mockRepository.findById.mockResolvedValue(user);

      // Act
      const hasPermission = await authService.hasAllPermissions(userId, [
        'manage_users' as any,
        'manage_products' as any
      ]);

      // Assert
      expect(hasPermission).toBe(true); // Admin has both permissions
    });
  });
});