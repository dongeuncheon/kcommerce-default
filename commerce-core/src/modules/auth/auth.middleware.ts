/**
 * Authentication Middleware
 * JWT verification and request authentication
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import * as jwt from 'jsonwebtoken';
import { TokenPayload, AuthErrorCode, Permission } from './auth.types';
import { AuthService } from './auth.service';
import { Container } from '../../core/di/container';

// Extend FastifyRequest to include user
declare module 'fastify' {
  interface FastifyRequest {
    user: TokenPayload;
  }
}

/**
 * Main authentication middleware
 * Verifies JWT tokens and attaches user to request
 */
export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const authHeader = request.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.code(401).send({
        error: AuthErrorCode.TOKEN_INVALID,
        message: 'No token provided'
      });
    }

    const token = authHeader.substring(7);
    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

    try {
      const payload = jwt.verify(token, jwtSecret) as TokenPayload;
      
      // Verify session is still active
      const authService = Container.get(AuthService);
      const session = await authService['repository'].findSessionByToken(token);
      
      if (!session || !session.isActive) {
        return reply.code(401).send({
          error: AuthErrorCode.SESSION_EXPIRED,
          message: 'Session expired or invalid'
        });
      }

      // Update session activity
      await authService['repository'].updateSessionActivity(session.id);
      
      // Attach user to request
      request.user = payload;
      
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return reply.code(401).send({
          error: AuthErrorCode.TOKEN_EXPIRED,
          message: 'Token expired'
        });
      } else if (error instanceof jwt.JsonWebTokenError) {
        return reply.code(401).send({
          error: AuthErrorCode.TOKEN_INVALID,
          message: 'Invalid token'
        });
      }
      throw error;
    }
  } catch (error) {
    reply.code(500).send({
      error: 'INTERNAL_ERROR',
      message: 'Authentication failed'
    });
  }
}

/**
 * Optional authentication middleware
 * Allows requests to proceed without authentication
 * but attaches user if token is valid
 */
export async function optionalAuthMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const authHeader = request.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return; // Continue without authentication
    }

    const token = authHeader.substring(7);
    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

    try {
      const payload = jwt.verify(token, jwtSecret) as TokenPayload;
      
      // Verify session is still active
      const authService = Container.get(AuthService);
      const session = await authService['repository'].findSessionByToken(token);
      
      if (session && session.isActive) {
        // Update session activity
        await authService['repository'].updateSessionActivity(session.id);
        
        // Attach user to request
        request.user = payload;
      }
    } catch {
      // Ignore errors for optional auth
    }
  } catch (error) {
    // Log error but don't fail the request
    console.error('Optional auth error:', error);
  }
}

/**
 * Permission-based middleware factory
 * Checks if user has required permissions
 */
export function requirePermission(...permissions: Permission[]) {
  return async function permissionMiddleware(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    if (!request.user) {
      return reply.code(401).send({
        error: AuthErrorCode.TOKEN_INVALID,
        message: 'Authentication required'
      });
    }

    const hasPermission = permissions.some(permission =>
      request.user.permissions.includes(permission)
    );

    if (!hasPermission) {
      return reply.code(403).send({
        error: AuthErrorCode.PERMISSION_DENIED,
        message: 'Insufficient permissions'
      });
    }
  };
}

/**
 * Role-based middleware factory
 * Checks if user has required role
 */
export function requireRole(...roles: string[]) {
  return async function roleMiddleware(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    if (!request.user) {
      return reply.code(401).send({
        error: AuthErrorCode.TOKEN_INVALID,
        message: 'Authentication required'
      });
    }

    if (!roles.includes(request.user.role)) {
      return reply.code(403).send({
        error: AuthErrorCode.PERMISSION_DENIED,
        message: 'Insufficient role privileges'
      });
    }
  };
}

/**
 * API Key authentication middleware
 * For programmatic access
 */
export async function apiKeyMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const apiKey = request.headers['x-api-key'] as string;
    
    if (!apiKey) {
      return reply.code(401).send({
        error: AuthErrorCode.TOKEN_INVALID,
        message: 'No API key provided'
      });
    }

    // Extract key prefix (first 8 chars)
    const keyPrefix = apiKey.substring(0, 8);
    
    const authService = Container.get(AuthService);
    const apiKeyRecord = await authService['repository'].findApiKeyByPrefix(keyPrefix);
    
    if (!apiKeyRecord || !apiKeyRecord.isActive) {
      return reply.code(401).send({
        error: AuthErrorCode.TOKEN_INVALID,
        message: 'Invalid API key'
      });
    }

    // Verify full key
    const bcrypt = require('bcrypt');
    const isValid = await bcrypt.compare(apiKey, apiKeyRecord.key);
    
    if (!isValid) {
      return reply.code(401).send({
        error: AuthErrorCode.TOKEN_INVALID,
        message: 'Invalid API key'
      });
    }

    // Check expiration
    if (apiKeyRecord.expiresAt && apiKeyRecord.expiresAt < new Date()) {
      return reply.code(401).send({
        error: AuthErrorCode.TOKEN_EXPIRED,
        message: 'API key expired'
      });
    }

    // Check IP whitelist
    if (apiKeyRecord.ipWhitelist && apiKeyRecord.ipWhitelist.length > 0) {
      const clientIp = request.ip;
      if (!apiKeyRecord.ipWhitelist.includes(clientIp)) {
        return reply.code(403).send({
          error: AuthErrorCode.PERMISSION_DENIED,
          message: 'IP not whitelisted'
        });
      }
    }

    // Update last used
    await authService['repository'].updateApiKeyLastUsed(apiKeyRecord.id);
    
    // Get user
    const user = await authService['repository'].findById(apiKeyRecord.userId);
    if (!user || !user.isActive) {
      return reply.code(401).send({
        error: AuthErrorCode.USER_INACTIVE,
        message: 'User inactive'
      });
    }

    // Attach user to request with API key permissions
    request.user = {
      userId: user.id,
      email: user.email,
      role: user.role,
      permissions: apiKeyRecord.permissions,
      sessionId: `api-key-${apiKeyRecord.id}`
    };
    
  } catch (error) {
    reply.code(500).send({
      error: 'INTERNAL_ERROR',
      message: 'API key authentication failed'
    });
  }
}

/**
 * Rate limiting middleware factory
 * Limits requests per time window
 */
export function rateLimit(options: {
  windowMs: number;
  max: number;
  keyGenerator?: (request: FastifyRequest) => string;
}) {
  const requests = new Map<string, { count: number; resetTime: number }>();

  return async function rateLimitMiddleware(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    const key = options.keyGenerator
      ? options.keyGenerator(request)
      : request.ip;

    const now = Date.now();
    const record = requests.get(key);

    if (!record || record.resetTime < now) {
      requests.set(key, {
        count: 1,
        resetTime: now + options.windowMs
      });
    } else {
      record.count++;
      
      if (record.count > options.max) {
        const retryAfter = Math.ceil((record.resetTime - now) / 1000);
        
        return reply
          .code(429)
          .header('Retry-After', retryAfter.toString())
          .send({
            error: AuthErrorCode.RATE_LIMIT_EXCEEDED,
            message: 'Too many requests',
            retryAfter
          });
      }
    }

    // Clean up old entries periodically
    if (requests.size > 1000) {
      for (const [k, v] of requests.entries()) {
        if (v.resetTime < now) {
          requests.delete(k);
        }
      }
    }
  };
}

/**
 * CSRF protection middleware
 * Validates CSRF tokens for state-changing operations
 */
export async function csrfProtection(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    return; // Skip CSRF for safe methods
  }

  const csrfToken = request.headers['x-csrf-token'] as string;
  const sessionCsrfToken = request.session?.csrfToken;

  if (!csrfToken || csrfToken !== sessionCsrfToken) {
    return reply.code(403).send({
      error: 'CSRF_VALIDATION_FAILED',
      message: 'Invalid CSRF token'
    });
  }
}

/**
 * Two-factor authentication middleware
 * Requires 2FA verification for sensitive operations
 */
export async function require2FA(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (!request.user) {
    return reply.code(401).send({
      error: AuthErrorCode.TOKEN_INVALID,
      message: 'Authentication required'
    });
  }

  const authService = Container.get(AuthService);
  const user = await authService['repository'].findById(request.user.userId);

  if (!user) {
    return reply.code(401).send({
      error: AuthErrorCode.USER_NOT_FOUND,
      message: 'User not found'
    });
  }

  if (user.twoFactorEnabled) {
    // Check if 2FA was recently verified
    const twoFactorVerified = request.headers['x-2fa-verified'] as string;
    const verifiedTime = parseInt(twoFactorVerified || '0');
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;

    if (!verifiedTime || verifiedTime < fiveMinutesAgo) {
      return reply.code(403).send({
        error: AuthErrorCode.TWO_FACTOR_REQUIRED,
        message: 'Two-factor authentication required'
      });
    }
  }
}

/**
 * IP whitelist middleware factory
 * Restricts access to specific IPs
 */
export function ipWhitelist(allowedIPs: string[]) {
  return async function ipWhitelistMiddleware(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    const clientIP = request.ip;
    
    if (!allowedIPs.includes(clientIP)) {
      return reply.code(403).send({
        error: 'IP_NOT_ALLOWED',
        message: 'Access denied from this IP address'
      });
    }
  };
}

/**
 * Session validation middleware
 * Ensures session is valid and active
 */
export async function validateSession(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (!request.user) {
    return reply.code(401).send({
      error: AuthErrorCode.TOKEN_INVALID,
      message: 'Authentication required'
    });
  }

  const authService = Container.get(AuthService);
  const session = await authService['repository']['adapter']
    .createQueryBuilder('user_sessions')
    .where('id', '=', request.user.sessionId)
    .where('is_active', '=', true)
    .execute();

  if (!session || session.length === 0) {
    return reply.code(401).send({
      error: AuthErrorCode.SESSION_EXPIRED,
      message: 'Session invalid or expired'
    });
  }
}