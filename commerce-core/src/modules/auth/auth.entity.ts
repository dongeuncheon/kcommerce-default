/**
 * Authentication Entities
 * Database entities for authentication and user management
 */

import { BaseEntity } from '../../types/entities/base.entity';
import { UserRole, Permission } from './auth.types';

/**
 * User Entity
 * Core user entity for authentication and authorization
 */
export interface User extends BaseEntity {
  // Basic Information
  email: string;
  phoneNumber: string;
  password: string; // Hashed
  
  // Profile Information
  name: string;
  koreanName?: string;
  profileImage?: string;
  birthDate?: Date;
  gender?: 'M' | 'F' | 'O';
  
  // Authentication
  role: UserRole;
  isActive: boolean;
  isVerified: boolean;
  emailVerified: boolean;
  emailVerifiedAt?: Date;
  phoneVerified: boolean;
  phoneVerifiedAt?: Date;
  
  // Security
  twoFactorEnabled: boolean;
  twoFactorSecret?: string;
  lastLogin?: Date;
  lastLoginIp?: string;
  passwordChangedAt?: Date;
  
  // Account Status
  lockedUntil?: Date;
  lockReason?: string;
  failedLoginAttempts: number;
  
  // Preferences
  marketingConsent: boolean;
  marketingConsentDate?: Date;
  termsAcceptedAt: Date;
  privacyAcceptedAt: Date;
  
  // Social Login
  socialAccounts?: SocialAccount[];
  
  // Metadata
  customerId?: string; // Link to customer entity
  metadata?: Record<string, any>;
}

/**
 * Social Account Entity
 * Linked social login accounts
 */
export interface SocialAccount extends BaseEntity {
  userId: string;
  provider: 'kakao' | 'naver' | 'google';
  providerId: string;
  email?: string;
  name?: string;
  profileImage?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
  lastUsed?: Date;
  isActive: boolean;
}

/**
 * Session Entity
 * Active user sessions
 */
export interface UserSession extends BaseEntity {
  userId: string;
  sessionToken: string;
  refreshToken: string;
  
  // Device Information
  userAgent?: string;
  ipAddress?: string;
  deviceId?: string;
  deviceType?: 'mobile' | 'tablet' | 'desktop';
  
  // Session Status
  lastActivity: Date;
  expiresAt: Date;
  isActive: boolean;
  revokedAt?: Date;
  revokeReason?: string;
}

/**
 * Verification Code Entity
 * Email, phone, and 2FA verification codes
 */
export interface VerificationCode extends BaseEntity {
  userId: string;
  type: 'email' | 'phone' | 'two_factor';
  code: string;
  identifier?: string; // email or phone number
  expiresAt: Date;
  attempts: number;
  maxAttempts: number;
  verified: boolean;
  verifiedAt?: Date;
  ipAddress?: string;
}

/**
 * Password Reset Token Entity
 */
export interface PasswordResetToken extends BaseEntity {
  userId: string;
  token: string;
  expiresAt: Date;
  used: boolean;
  usedAt?: Date;
  requestedIp?: string;
  usedIp?: string;
}

/**
 * Login Attempt Entity
 * Track login attempts for security
 */
export interface LoginAttempt extends BaseEntity {
  userId?: string;
  identifier: string; // email or phone
  ipAddress: string;
  userAgent?: string;
  success: boolean;
  failureReason?: string;
  attemptedAt: Date;
  location?: {
    country?: string;
    city?: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };
}

/**
 * Role Entity
 * Custom roles beyond predefined ones
 */
export interface Role extends BaseEntity {
  name: string;
  displayName: string;
  description?: string;
  permissions: Permission[];
  isSystem: boolean; // Cannot be modified/deleted
  isActive: boolean;
  priority: number; // For role hierarchy
}

/**
 * Permission Entity
 * Granular permissions
 */
export interface PermissionEntity extends BaseEntity {
  name: string;
  displayName: string;
  description?: string;
  resource: string;
  action: string;
  isActive: boolean;
}

/**
 * User Permission Override Entity
 * Direct permission assignments to users
 */
export interface UserPermission extends BaseEntity {
  userId: string;
  permission: Permission;
  granted: boolean; // Can revoke specific permissions
  grantedBy?: string;
  reason?: string;
  expiresAt?: Date;
}

/**
 * Audit Log Entity
 * Track authentication events
 */
export interface AuthAuditLog extends BaseEntity {
  userId?: string;
  action: AuthAction;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  details?: Record<string, any>;
  error?: string;
  performedAt: Date;
}

export enum AuthAction {
  LOGIN = 'login',
  LOGOUT = 'logout',
  REGISTER = 'register',
  PASSWORD_CHANGE = 'password_change',
  PASSWORD_RESET_REQUEST = 'password_reset_request',
  PASSWORD_RESET_COMPLETE = 'password_reset_complete',
  EMAIL_VERIFICATION = 'email_verification',
  PHONE_VERIFICATION = 'phone_verification',
  TWO_FACTOR_ENABLE = 'two_factor_enable',
  TWO_FACTOR_DISABLE = 'two_factor_disable',
  TWO_FACTOR_VERIFY = 'two_factor_verify',
  PROFILE_UPDATE = 'profile_update',
  ACCOUNT_LOCK = 'account_lock',
  ACCOUNT_UNLOCK = 'account_unlock',
  SOCIAL_LINK = 'social_link',
  SOCIAL_UNLINK = 'social_unlink',
  SESSION_REVOKE = 'session_revoke',
  ROLE_CHANGE = 'role_change',
  PERMISSION_GRANT = 'permission_grant',
  PERMISSION_REVOKE = 'permission_revoke'
}

/**
 * Two-Factor Backup Codes
 */
export interface TwoFactorBackupCode extends BaseEntity {
  userId: string;
  code: string;
  used: boolean;
  usedAt?: Date;
}

/**
 * Device Trust Entity
 * Trusted devices for 2FA
 */
export interface TrustedDevice extends BaseEntity {
  userId: string;
  deviceId: string;
  deviceName?: string;
  deviceType: 'mobile' | 'tablet' | 'desktop';
  userAgent: string;
  trustToken: string;
  lastUsed: Date;
  expiresAt: Date;
  isActive: boolean;
  ipAddress?: string;
}

/**
 * API Key Entity
 * For programmatic access
 */
export interface ApiKey extends BaseEntity {
  userId: string;
  name: string;
  key: string; // Hashed
  keyPrefix: string; // First 8 chars for identification
  permissions: Permission[];
  lastUsed?: Date;
  expiresAt?: Date;
  isActive: boolean;
  ipWhitelist?: string[];
  rateLimit?: number;
}

/**
 * Security Question Entity
 * Additional security for Korean users
 */
export interface SecurityQuestion extends BaseEntity {
  userId: string;
  question: string;
  answerHash: string;
  isActive: boolean;
  lastVerified?: Date;
}

// Database table names
export const AuthTableNames = {
  USERS: 'users',
  SOCIAL_ACCOUNTS: 'social_accounts',
  USER_SESSIONS: 'user_sessions',
  VERIFICATION_CODES: 'verification_codes',
  PASSWORD_RESET_TOKENS: 'password_reset_tokens',
  LOGIN_ATTEMPTS: 'login_attempts',
  ROLES: 'roles',
  PERMISSIONS: 'permissions',
  USER_PERMISSIONS: 'user_permissions',
  AUTH_AUDIT_LOGS: 'auth_audit_logs',
  TWO_FACTOR_BACKUP_CODES: 'two_factor_backup_codes',
  TRUSTED_DEVICES: 'trusted_devices',
  API_KEYS: 'api_keys',
  SECURITY_QUESTIONS: 'security_questions'
};

// Entity creation helpers
export const createUser = (data: Partial<User>): User => ({
  id: '',
  email: '',
  phoneNumber: '',
  password: '',
  name: '',
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
  updatedAt: new Date(),
  ...data
});

export const createSession = (userId: string, data: Partial<UserSession>): UserSession => ({
  id: '',
  userId,
  sessionToken: '',
  refreshToken: '',
  lastActivity: new Date(),
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...data
});