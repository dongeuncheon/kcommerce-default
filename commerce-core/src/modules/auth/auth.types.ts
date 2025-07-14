/**
 * Authentication and Authorization Types
 * Comprehensive type definitions for auth module
 */

import { BaseEntity } from '../../types/entities/base.entity';

// User Roles
export enum UserRole {
  CUSTOMER = 'customer', // 기본 고객
  VIP_CUSTOMER = 'vip_customer', // VIP 고객
  MANAGER = 'manager', // 매니저
  ADMIN = 'admin', // 관리자
  SUPER_ADMIN = 'super_admin' // 최고 관리자
}

// Permission Types
export enum Permission {
  // Customer permissions
  VIEW_OWN_PROFILE = 'view_own_profile',
  EDIT_OWN_PROFILE = 'edit_own_profile',
  VIEW_OWN_ORDERS = 'view_own_orders',
  CREATE_ORDER = 'create_order',
  CANCEL_OWN_ORDER = 'cancel_own_order',
  
  // VIP Customer additional permissions
  ACCESS_VIP_PRODUCTS = 'access_vip_products',
  ACCESS_VIP_DISCOUNTS = 'access_vip_discounts',
  PRIORITY_SUPPORT = 'priority_support',
  
  // Manager permissions
  VIEW_ALL_ORDERS = 'view_all_orders',
  UPDATE_ORDER_STATUS = 'update_order_status',
  VIEW_CUSTOMERS = 'view_customers',
  MANAGE_PRODUCTS = 'manage_products',
  MANAGE_INVENTORY = 'manage_inventory',
  VIEW_REPORTS = 'view_reports',
  
  // Admin permissions
  MANAGE_USERS = 'manage_users',
  MANAGE_ROLES = 'manage_roles',
  MANAGE_CATEGORIES = 'manage_categories',
  MANAGE_PAYMENTS = 'manage_payments',
  MANAGE_SHIPPING = 'manage_shipping',
  VIEW_ANALYTICS = 'view_analytics',
  
  // Super Admin permissions
  MANAGE_SYSTEM = 'manage_system',
  MANAGE_ADMINS = 'manage_admins',
  ACCESS_LOGS = 'access_logs',
  SYSTEM_CONFIG = 'system_config'
}

// Role-Permission Mapping
export const RolePermissions: Record<UserRole, Permission[]> = {
  [UserRole.CUSTOMER]: [
    Permission.VIEW_OWN_PROFILE,
    Permission.EDIT_OWN_PROFILE,
    Permission.VIEW_OWN_ORDERS,
    Permission.CREATE_ORDER,
    Permission.CANCEL_OWN_ORDER
  ],
  [UserRole.VIP_CUSTOMER]: [
    // Inherit all customer permissions
    Permission.VIEW_OWN_PROFILE,
    Permission.EDIT_OWN_PROFILE,
    Permission.VIEW_OWN_ORDERS,
    Permission.CREATE_ORDER,
    Permission.CANCEL_OWN_ORDER,
    // Additional VIP permissions
    Permission.ACCESS_VIP_PRODUCTS,
    Permission.ACCESS_VIP_DISCOUNTS,
    Permission.PRIORITY_SUPPORT
  ],
  [UserRole.MANAGER]: [
    // All customer permissions
    Permission.VIEW_OWN_PROFILE,
    Permission.EDIT_OWN_PROFILE,
    Permission.VIEW_OWN_ORDERS,
    Permission.CREATE_ORDER,
    Permission.CANCEL_OWN_ORDER,
    // Manager specific
    Permission.VIEW_ALL_ORDERS,
    Permission.UPDATE_ORDER_STATUS,
    Permission.VIEW_CUSTOMERS,
    Permission.MANAGE_PRODUCTS,
    Permission.MANAGE_INVENTORY,
    Permission.VIEW_REPORTS
  ],
  [UserRole.ADMIN]: [
    // All manager permissions
    Permission.VIEW_OWN_PROFILE,
    Permission.EDIT_OWN_PROFILE,
    Permission.VIEW_OWN_ORDERS,
    Permission.CREATE_ORDER,
    Permission.CANCEL_OWN_ORDER,
    Permission.VIEW_ALL_ORDERS,
    Permission.UPDATE_ORDER_STATUS,
    Permission.VIEW_CUSTOMERS,
    Permission.MANAGE_PRODUCTS,
    Permission.MANAGE_INVENTORY,
    Permission.VIEW_REPORTS,
    // Admin specific
    Permission.MANAGE_USERS,
    Permission.MANAGE_ROLES,
    Permission.MANAGE_CATEGORIES,
    Permission.MANAGE_PAYMENTS,
    Permission.MANAGE_SHIPPING,
    Permission.VIEW_ANALYTICS
  ],
  [UserRole.SUPER_ADMIN]: [
    // All permissions
    ...Object.values(Permission)
  ]
};

// Authentication Types
export interface LoginCredentials {
  email?: string;
  phoneNumber?: string;
  password: string;
}

export interface RegisterData {
  email: string;
  phoneNumber: string;
  password: string;
  name: string;
  koreanName?: string;
  birthDate?: string;
  gender?: 'M' | 'F' | 'O';
  marketingConsent?: boolean;
  termsAccepted: boolean;
  privacyAccepted: boolean;
}

export interface SocialLoginData {
  provider: 'kakao' | 'naver' | 'google';
  accessToken: string;
  refreshToken?: string;
  profile?: {
    id: string;
    email?: string;
    name?: string;
    phoneNumber?: string;
    profileImage?: string;
  };
}

// Token Types
export interface TokenPayload {
  userId: string;
  email: string;
  role: UserRole;
  permissions: Permission[];
  sessionId: string;
  iat?: number;
  exp?: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// Session Types
export interface Session {
  id: string;
  userId: string;
  refreshToken: string;
  userAgent?: string;
  ipAddress?: string;
  lastActivity: Date;
  expiresAt: Date;
  isActive: boolean;
}

// Verification Types
export interface VerificationCode {
  id: string;
  userId: string;
  type: 'email' | 'phone' | 'two_factor';
  code: string;
  expiresAt: Date;
  attempts: number;
  verified: boolean;
}

// Two-Factor Authentication
export interface TwoFactorAuth {
  userId: string;
  secret: string;
  enabled: boolean;
  backupCodes: string[];
  lastUsed?: Date;
}

// Password Reset
export interface PasswordResetToken {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  used: boolean;
}

// Auth Response Types
export interface AuthResponse {
  user: AuthUser;
  tokens: TokenPair;
  message?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  phoneNumber: string;
  name: string;
  koreanName?: string;
  role: UserRole;
  permissions: Permission[];
  isActive: boolean;
  isVerified: boolean;
  emailVerified: boolean;
  phoneVerified: boolean;
  twoFactorEnabled: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Request Types
export interface PhoneVerificationRequest {
  phoneNumber: string;
  code?: string;
}

export interface EmailVerificationRequest {
  email: string;
  code?: string;
}

export interface ForgotPasswordRequest {
  email?: string;
  phoneNumber?: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
  confirmPassword: string;
}

export interface UpdateProfileRequest {
  name?: string;
  koreanName?: string;
  phoneNumber?: string;
  birthDate?: string;
  gender?: 'M' | 'F' | 'O';
  marketingConsent?: boolean;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

// Security Types
export interface LoginAttempt {
  id: string;
  identifier: string; // email or phone
  ipAddress: string;
  userAgent?: string;
  success: boolean;
  reason?: string;
  attemptedAt: Date;
}

export interface AccountLockout {
  userId: string;
  reason: string;
  lockedAt: Date;
  unlockAt?: Date;
  attemptCount: number;
}

// Validation Types
export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  preventCommonPasswords: boolean;
  preventUserInfo: boolean;
}

export const DefaultPasswordPolicy: PasswordPolicy = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  preventCommonPasswords: true,
  preventUserInfo: true
};

// Korean-specific validation patterns
export const KoreanValidationPatterns = {
  phoneNumber: /^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$/,
  koreanName: /^[가-힣]{2,5}$/,
  businessNumber: /^[0-9]{3}-[0-9]{2}-[0-9]{5}$/
};

// Rate Limiting
export interface RateLimitConfig {
  windowMs: number;
  maxAttempts: number;
  blockDuration: number;
}

export const AuthRateLimits: Record<string, RateLimitConfig> = {
  login: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxAttempts: 5,
    blockDuration: 30 * 60 * 1000 // 30 minutes
  },
  register: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxAttempts: 3,
    blockDuration: 24 * 60 * 60 * 1000 // 24 hours
  },
  passwordReset: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxAttempts: 3,
    blockDuration: 6 * 60 * 60 * 1000 // 6 hours
  },
  verification: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxAttempts: 3,
    blockDuration: 15 * 60 * 1000 // 15 minutes
  }
};

// Error Types
export enum AuthErrorCode {
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  USER_INACTIVE = 'USER_INACTIVE',
  USER_LOCKED = 'USER_LOCKED',
  EMAIL_NOT_VERIFIED = 'EMAIL_NOT_VERIFIED',
  PHONE_NOT_VERIFIED = 'PHONE_NOT_VERIFIED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  TWO_FACTOR_REQUIRED = 'TWO_FACTOR_REQUIRED',
  TWO_FACTOR_INVALID = 'TWO_FACTOR_INVALID',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  PASSWORD_TOO_WEAK = 'PASSWORD_TOO_WEAK',
  DUPLICATE_EMAIL = 'DUPLICATE_EMAIL',
  DUPLICATE_PHONE = 'DUPLICATE_PHONE',
  INVALID_PHONE_FORMAT = 'INVALID_PHONE_FORMAT',
  INVALID_KOREAN_NAME = 'INVALID_KOREAN_NAME',
  VERIFICATION_CODE_INVALID = 'VERIFICATION_CODE_INVALID',
  VERIFICATION_CODE_EXPIRED = 'VERIFICATION_CODE_EXPIRED',
  SOCIAL_LOGIN_FAILED = 'SOCIAL_LOGIN_FAILED',
  PERMISSION_DENIED = 'PERMISSION_DENIED'
}

export class AuthError extends Error {
  constructor(
    public code: AuthErrorCode,
    message: string,
    public statusCode: number = 401
  ) {
    super(message);
    this.name = 'AuthError';
  }
}