/**
 * Authentication Repository
 * Database operations for authentication entities
 */

import { BaseRepository } from '../../core/repository/base.repository';
import { DatabaseAdapter } from '../../adapters/database.adapter';
import {
  User,
  UserSession,
  VerificationCode,
  PasswordResetToken,
  LoginAttempt,
  SocialAccount,
  AuthAuditLog,
  TrustedDevice,
  ApiKey,
  AuthTableNames,
  AuthAction
} from './auth.entity';
import { UserRole, AuthErrorCode, AuthError } from './auth.types';

export class AuthRepository extends BaseRepository<User> {
  protected sessionsTable = AuthTableNames.USER_SESSIONS;
  protected verificationTable = AuthTableNames.VERIFICATION_CODES;
  protected passwordResetTable = AuthTableNames.PASSWORD_RESET_TOKENS;
  protected loginAttemptsTable = AuthTableNames.LOGIN_ATTEMPTS;
  protected socialAccountsTable = AuthTableNames.SOCIAL_ACCOUNTS;
  protected auditLogTable = AuthTableNames.AUTH_AUDIT_LOGS;
  protected trustedDevicesTable = AuthTableNames.TRUSTED_DEVICES;
  protected apiKeysTable = AuthTableNames.API_KEYS;

  constructor(adapter: DatabaseAdapter) {
    super(adapter, AuthTableNames.USERS);
  }

  /**
   * User Operations
   */
  async findByEmail(email: string): Promise<User | null> {
    const query = this.adapter
      .createQueryBuilder(this.tableName)
      .where('email', '=', email)
      .where('deleted_at', 'IS', null);
    
    const result = await this.adapter.execute(query.build());
    return result[0] || null;
  }

  async findByPhoneNumber(phoneNumber: string): Promise<User | null> {
    const query = this.adapter
      .createQueryBuilder(this.tableName)
      .where('phone_number', '=', phoneNumber)
      .where('deleted_at', 'IS', null);
    
    const result = await this.adapter.execute(query.build());
    return result[0] || null;
  }

  async findByEmailOrPhone(identifier: string): Promise<User | null> {
    const query = this.adapter
      .createQueryBuilder(this.tableName)
      .where((qb) => {
        qb.where('email', '=', identifier)
          .orWhere('phone_number', '=', identifier);
      })
      .where('deleted_at', 'IS', null);
    
    const result = await this.adapter.execute(query.build());
    return result[0] || null;
  }

  async updateLastLogin(userId: string, ipAddress?: string): Promise<void> {
    await this.update(userId, {
      lastLogin: new Date(),
      lastLoginIp: ipAddress
    });
  }

  async incrementFailedAttempts(userId: string): Promise<number> {
    const user = await this.findById(userId);
    if (!user) throw new AuthError(AuthErrorCode.USER_NOT_FOUND, 'User not found');
    
    const newCount = (user.failedLoginAttempts || 0) + 1;
    await this.update(userId, { failedLoginAttempts: newCount });
    return newCount;
  }

  async resetFailedAttempts(userId: string): Promise<void> {
    await this.update(userId, { failedLoginAttempts: 0 });
  }

  async lockAccount(userId: string, until: Date, reason: string): Promise<void> {
    await this.update(userId, {
      lockedUntil: until,
      lockReason: reason
    });
  }

  async unlockAccount(userId: string): Promise<void> {
    await this.update(userId, {
      lockedUntil: null,
      lockReason: null,
      failedLoginAttempts: 0
    });
  }

  /**
   * Session Operations
   */
  async createSession(session: UserSession): Promise<UserSession> {
    const query = this.adapter
      .createQueryBuilder(this.sessionsTable)
      .insert(session);
    
    const result = await this.adapter.execute(query.build());
    return { ...session, id: result.insertId };
  }

  async findSessionByToken(token: string): Promise<UserSession | null> {
    const query = this.adapter
      .createQueryBuilder(this.sessionsTable)
      .where('session_token', '=', token)
      .where('is_active', '=', true)
      .where('expires_at', '>', new Date());
    
    const result = await this.adapter.execute(query.build());
    return result[0] || null;
  }

  async findSessionByRefreshToken(refreshToken: string): Promise<UserSession | null> {
    const query = this.adapter
      .createQueryBuilder(this.sessionsTable)
      .where('refresh_token', '=', refreshToken)
      .where('is_active', '=', true);
    
    const result = await this.adapter.execute(query.build());
    return result[0] || null;
  }

  async updateSessionActivity(sessionId: string): Promise<void> {
    const query = this.adapter
      .createQueryBuilder(this.sessionsTable)
      .update({ last_activity: new Date() })
      .where('id', '=', sessionId);
    
    await this.adapter.execute(query.build());
  }

  async revokeSession(sessionId: string, reason?: string): Promise<void> {
    const query = this.adapter
      .createQueryBuilder(this.sessionsTable)
      .update({
        is_active: false,
        revoked_at: new Date(),
        revoke_reason: reason
      })
      .where('id', '=', sessionId);
    
    await this.adapter.execute(query.build());
  }

  async revokeAllUserSessions(userId: string, exceptSessionId?: string): Promise<void> {
    const query = this.adapter
      .createQueryBuilder(this.sessionsTable)
      .update({
        is_active: false,
        revoked_at: new Date(),
        revoke_reason: 'Revoked all sessions'
      })
      .where('user_id', '=', userId)
      .where('is_active', '=', true);
    
    if (exceptSessionId) {
      query.where('id', '!=', exceptSessionId);
    }
    
    await this.adapter.execute(query.build());
  }

  async getActiveSessions(userId: string): Promise<UserSession[]> {
    const query = this.adapter
      .createQueryBuilder(this.sessionsTable)
      .where('user_id', '=', userId)
      .where('is_active', '=', true)
      .where('expires_at', '>', new Date())
      .orderBy('last_activity', 'DESC');
    
    return await this.adapter.execute(query.build());
  }

  /**
   * Verification Code Operations
   */
  async createVerificationCode(code: VerificationCode): Promise<VerificationCode> {
    // Invalidate existing codes
    await this.invalidateVerificationCodes(code.userId, code.type);
    
    const query = this.adapter
      .createQueryBuilder(this.verificationTable)
      .insert(code);
    
    const result = await this.adapter.execute(query.build());
    return { ...code, id: result.insertId };
  }

  async findVerificationCode(
    userId: string,
    type: 'email' | 'phone' | 'two_factor',
    code: string
  ): Promise<VerificationCode | null> {
    const query = this.adapter
      .createQueryBuilder(this.verificationTable)
      .where('user_id', '=', userId)
      .where('type', '=', type)
      .where('code', '=', code)
      .where('verified', '=', false)
      .where('expires_at', '>', new Date());
    
    const result = await this.adapter.execute(query.build());
    return result[0] || null;
  }

  async verifyCode(codeId: string): Promise<void> {
    const query = this.adapter
      .createQueryBuilder(this.verificationTable)
      .update({
        verified: true,
        verified_at: new Date()
      })
      .where('id', '=', codeId);
    
    await this.adapter.execute(query.build());
  }

  async incrementVerificationAttempts(codeId: string): Promise<number> {
    const query = this.adapter
      .createQueryBuilder(this.verificationTable)
      .select(['attempts'])
      .where('id', '=', codeId);
    
    const result = await this.adapter.execute(query.build());
    const currentAttempts = result[0]?.attempts || 0;
    const newAttempts = currentAttempts + 1;
    
    const updateQuery = this.adapter
      .createQueryBuilder(this.verificationTable)
      .update({ attempts: newAttempts })
      .where('id', '=', codeId);
    
    await this.adapter.execute(updateQuery.build());
    return newAttempts;
  }

  async invalidateVerificationCodes(
    userId: string,
    type: 'email' | 'phone' | 'two_factor'
  ): Promise<void> {
    const query = this.adapter
      .createQueryBuilder(this.verificationTable)
      .update({ verified: true })
      .where('user_id', '=', userId)
      .where('type', '=', type)
      .where('verified', '=', false);
    
    await this.adapter.execute(query.build());
  }

  /**
   * Password Reset Operations
   */
  async createPasswordResetToken(token: PasswordResetToken): Promise<PasswordResetToken> {
    // Invalidate existing tokens
    await this.invalidatePasswordResetTokens(token.userId);
    
    const query = this.adapter
      .createQueryBuilder(this.passwordResetTable)
      .insert(token);
    
    const result = await this.adapter.execute(query.build());
    return { ...token, id: result.insertId };
  }

  async findPasswordResetToken(token: string): Promise<PasswordResetToken | null> {
    const query = this.adapter
      .createQueryBuilder(this.passwordResetTable)
      .where('token', '=', token)
      .where('used', '=', false)
      .where('expires_at', '>', new Date());
    
    const result = await this.adapter.execute(query.build());
    return result[0] || null;
  }

  async usePasswordResetToken(tokenId: string, usedIp?: string): Promise<void> {
    const query = this.adapter
      .createQueryBuilder(this.passwordResetTable)
      .update({
        used: true,
        used_at: new Date(),
        used_ip: usedIp
      })
      .where('id', '=', tokenId);
    
    await this.adapter.execute(query.build());
  }

  async invalidatePasswordResetTokens(userId: string): Promise<void> {
    const query = this.adapter
      .createQueryBuilder(this.passwordResetTable)
      .update({ used: true })
      .where('user_id', '=', userId)
      .where('used', '=', false);
    
    await this.adapter.execute(query.build());
  }

  /**
   * Login Attempt Operations
   */
  async recordLoginAttempt(attempt: LoginAttempt): Promise<void> {
    const query = this.adapter
      .createQueryBuilder(this.loginAttemptsTable)
      .insert(attempt);
    
    await this.adapter.execute(query.build());
  }

  async getRecentLoginAttempts(
    identifier: string,
    minutes: number = 15
  ): Promise<LoginAttempt[]> {
    const since = new Date(Date.now() - minutes * 60 * 1000);
    
    const query = this.adapter
      .createQueryBuilder(this.loginAttemptsTable)
      .where('identifier', '=', identifier)
      .where('attempted_at', '>', since)
      .orderBy('attempted_at', 'DESC');
    
    return await this.adapter.execute(query.build());
  }

  async getFailedLoginCount(
    identifier: string,
    minutes: number = 15
  ): Promise<number> {
    const attempts = await this.getRecentLoginAttempts(identifier, minutes);
    return attempts.filter(a => !a.success).length;
  }

  /**
   * Social Account Operations
   */
  async findSocialAccount(
    provider: string,
    providerId: string
  ): Promise<SocialAccount | null> {
    const query = this.adapter
      .createQueryBuilder(this.socialAccountsTable)
      .where('provider', '=', provider)
      .where('provider_id', '=', providerId)
      .where('is_active', '=', true);
    
    const result = await this.adapter.execute(query.build());
    return result[0] || null;
  }

  async createSocialAccount(account: SocialAccount): Promise<SocialAccount> {
    const query = this.adapter
      .createQueryBuilder(this.socialAccountsTable)
      .insert(account);
    
    const result = await this.adapter.execute(query.build());
    return { ...account, id: result.insertId };
  }

  async updateSocialAccount(
    accountId: string,
    updates: Partial<SocialAccount>
  ): Promise<void> {
    const query = this.adapter
      .createQueryBuilder(this.socialAccountsTable)
      .update({
        ...updates,
        updated_at: new Date()
      })
      .where('id', '=', accountId);
    
    await this.adapter.execute(query.build());
  }

  async getUserSocialAccounts(userId: string): Promise<SocialAccount[]> {
    const query = this.adapter
      .createQueryBuilder(this.socialAccountsTable)
      .where('user_id', '=', userId)
      .where('is_active', '=', true);
    
    return await this.adapter.execute(query.build());
  }

  /**
   * Audit Log Operations
   */
  async createAuditLog(log: AuthAuditLog): Promise<void> {
    const query = this.adapter
      .createQueryBuilder(this.auditLogTable)
      .insert(log);
    
    await this.adapter.execute(query.build());
  }

  async getUserAuditLogs(
    userId: string,
    limit: number = 50
  ): Promise<AuthAuditLog[]> {
    const query = this.adapter
      .createQueryBuilder(this.auditLogTable)
      .where('user_id', '=', userId)
      .orderBy('performed_at', 'DESC')
      .limit(limit);
    
    return await this.adapter.execute(query.build());
  }

  /**
   * Trusted Device Operations
   */
  async createTrustedDevice(device: TrustedDevice): Promise<TrustedDevice> {
    const query = this.adapter
      .createQueryBuilder(this.trustedDevicesTable)
      .insert(device);
    
    const result = await this.adapter.execute(query.build());
    return { ...device, id: result.insertId };
  }

  async findTrustedDevice(
    userId: string,
    deviceId: string
  ): Promise<TrustedDevice | null> {
    const query = this.adapter
      .createQueryBuilder(this.trustedDevicesTable)
      .where('user_id', '=', userId)
      .where('device_id', '=', deviceId)
      .where('is_active', '=', true)
      .where('expires_at', '>', new Date());
    
    const result = await this.adapter.execute(query.build());
    return result[0] || null;
  }

  async updateTrustedDeviceLastUsed(deviceId: string): Promise<void> {
    const query = this.adapter
      .createQueryBuilder(this.trustedDevicesTable)
      .update({ last_used: new Date() })
      .where('id', '=', deviceId);
    
    await this.adapter.execute(query.build());
  }

  async revokeTrustedDevice(deviceId: string): Promise<void> {
    const query = this.adapter
      .createQueryBuilder(this.trustedDevicesTable)
      .update({ is_active: false })
      .where('id', '=', deviceId);
    
    await this.adapter.execute(query.build());
  }

  /**
   * API Key Operations
   */
  async createApiKey(apiKey: ApiKey): Promise<ApiKey> {
    const query = this.adapter
      .createQueryBuilder(this.apiKeysTable)
      .insert(apiKey);
    
    const result = await this.adapter.execute(query.build());
    return { ...apiKey, id: result.insertId };
  }

  async findApiKeyByPrefix(keyPrefix: string): Promise<ApiKey | null> {
    const query = this.adapter
      .createQueryBuilder(this.apiKeysTable)
      .where('key_prefix', '=', keyPrefix)
      .where('is_active', '=', true);
    
    const result = await this.adapter.execute(query.build());
    return result[0] || null;
  }

  async updateApiKeyLastUsed(keyId: string): Promise<void> {
    const query = this.adapter
      .createQueryBuilder(this.apiKeysTable)
      .update({ last_used: new Date() })
      .where('id', '=', keyId);
    
    await this.adapter.execute(query.build());
  }

  /**
   * User Statistics
   */
  async getUserStatsByRole(): Promise<Record<UserRole, number>> {
    const query = this.adapter
      .createQueryBuilder(this.tableName)
      .select(['role', 'COUNT(*) as count'])
      .where('deleted_at', 'IS', null)
      .where('is_active', '=', true)
      .groupBy('role');
    
    const result = await this.adapter.execute(query.build());
    
    const stats: Record<UserRole, number> = {
      [UserRole.CUSTOMER]: 0,
      [UserRole.VIP_CUSTOMER]: 0,
      [UserRole.MANAGER]: 0,
      [UserRole.ADMIN]: 0,
      [UserRole.SUPER_ADMIN]: 0
    };
    
    result.forEach((row: any) => {
      stats[row.role as UserRole] = parseInt(row.count);
    });
    
    return stats;
  }

  async getActiveUsersCount(days: number = 30): Promise<number> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    const query = this.adapter
      .createQueryBuilder(this.tableName)
      .select(['COUNT(DISTINCT id) as count'])
      .where('last_login', '>', since)
      .where('is_active', '=', true);
    
    const result = await this.adapter.execute(query.build());
    return parseInt(result[0]?.count || 0);
  }
}