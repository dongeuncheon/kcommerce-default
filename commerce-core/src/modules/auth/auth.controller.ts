/**
 * Authentication Controller
 * REST API endpoints for authentication and authorization
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AuthService } from './auth.service';
import {
  LoginCredentials,
  RegisterData,
  SocialLoginData,
  PhoneVerificationRequest,
  EmailVerificationRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  UpdateProfileRequest,
  ChangePasswordRequest,
  AuthError,
  AuthErrorCode
} from './auth.types';
import { authMiddleware } from './auth.middleware';
import { Injectable } from '../../core/di/decorators';

@Injectable()
export class AuthController {
  constructor(private authService: AuthService) {}

  async register(server: FastifyInstance) {
    // Public routes
    server.post('/api/auth/register', {
      schema: {
        body: {
          type: 'object',
          required: ['email', 'phoneNumber', 'password', 'name', 'termsAccepted', 'privacyAccepted'],
          properties: {
            email: { type: 'string', format: 'email' },
            phoneNumber: { type: 'string', pattern: '^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$' },
            password: { type: 'string', minLength: 8 },
            name: { type: 'string', minLength: 2 },
            koreanName: { type: 'string', pattern: '^[가-힣]{2,5}$' },
            birthDate: { type: 'string', format: 'date' },
            gender: { type: 'string', enum: ['M', 'F', 'O'] },
            marketingConsent: { type: 'boolean' },
            termsAccepted: { type: 'boolean' },
            privacyAccepted: { type: 'boolean' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              user: { $ref: '#/definitions/AuthUser' },
              tokens: { $ref: '#/definitions/TokenPair' }
            }
          }
        }
      }
    }, async (request: FastifyRequest<{ Body: RegisterData }>, reply: FastifyReply) => {
      try {
        const result = await this.authService.register(request.body);
        reply.send(result);
      } catch (error) {
        this.handleError(error, reply);
      }
    });

    server.post('/api/auth/login', {
      schema: {
        body: {
          type: 'object',
          required: ['password'],
          properties: {
            email: { type: 'string', format: 'email' },
            phoneNumber: { type: 'string' },
            password: { type: 'string' }
          },
          oneOf: [
            { required: ['email', 'password'] },
            { required: ['phoneNumber', 'password'] }
          ]
        }
      }
    }, async (request: FastifyRequest<{ Body: LoginCredentials }>, reply: FastifyReply) => {
      try {
        const result = await this.authService.login(request.body);
        reply.send(result);
      } catch (error) {
        this.handleError(error, reply);
      }
    });

    server.post('/api/auth/social-login', {
      schema: {
        body: {
          type: 'object',
          required: ['provider', 'accessToken'],
          properties: {
            provider: { type: 'string', enum: ['kakao', 'naver', 'google'] },
            accessToken: { type: 'string' },
            refreshToken: { type: 'string' },
            profile: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                email: { type: 'string' },
                name: { type: 'string' },
                phoneNumber: { type: 'string' },
                profileImage: { type: 'string' }
              }
            }
          }
        }
      }
    }, async (request: FastifyRequest<{ Body: SocialLoginData }>, reply: FastifyReply) => {
      try {
        const result = await this.authService.socialLogin(request.body);
        reply.send(result);
      } catch (error) {
        this.handleError(error, reply);
      }
    });

    server.post('/api/auth/refresh', {
      schema: {
        body: {
          type: 'object',
          required: ['refreshToken'],
          properties: {
            refreshToken: { type: 'string' }
          }
        }
      }
    }, async (request: FastifyRequest<{ Body: { refreshToken: string } }>, reply: FastifyReply) => {
      try {
        const result = await this.authService.refreshToken(request.body.refreshToken);
        reply.send(result);
      } catch (error) {
        this.handleError(error, reply);
      }
    });

    server.post('/api/auth/verify-phone', {
      schema: {
        body: {
          type: 'object',
          required: ['phoneNumber'],
          properties: {
            phoneNumber: { type: 'string' },
            code: { type: 'string', minLength: 6, maxLength: 6 }
          }
        }
      }
    }, async (request: FastifyRequest<{ Body: PhoneVerificationRequest }>, reply: FastifyReply) => {
      try {
        const { phoneNumber, code } = request.body;
        
        if (code) {
          // Verify code
          await this.authService.verifyPhone(request.body);
          reply.send({ message: 'Phone verified successfully' });
        } else {
          // Send code
          const user = await this.authService['repository'].findByPhoneNumber(phoneNumber);
          if (!user) {
            throw new AuthError(AuthErrorCode.USER_NOT_FOUND, 'User not found');
          }
          await this.authService.sendPhoneVerificationCode(user.id, phoneNumber);
          reply.send({ message: 'Verification code sent' });
        }
      } catch (error) {
        this.handleError(error, reply);
      }
    });

    server.post('/api/auth/verify-email', {
      schema: {
        body: {
          type: 'object',
          required: ['email'],
          properties: {
            email: { type: 'string', format: 'email' },
            code: { type: 'string', minLength: 6, maxLength: 6 }
          }
        }
      }
    }, async (request: FastifyRequest<{ Body: EmailVerificationRequest }>, reply: FastifyReply) => {
      try {
        const { email, code } = request.body;
        
        if (code) {
          // Verify code
          await this.authService.verifyEmail(request.body);
          reply.send({ message: 'Email verified successfully' });
        } else {
          // Send code
          const user = await this.authService['repository'].findByEmail(email);
          if (!user) {
            throw new AuthError(AuthErrorCode.USER_NOT_FOUND, 'User not found');
          }
          await this.authService.sendEmailVerificationCode(user.id, email);
          reply.send({ message: 'Verification code sent' });
        }
      } catch (error) {
        this.handleError(error, reply);
      }
    });

    server.post('/api/auth/forgot-password', {
      schema: {
        body: {
          type: 'object',
          properties: {
            email: { type: 'string', format: 'email' },
            phoneNumber: { type: 'string' }
          },
          oneOf: [
            { required: ['email'] },
            { required: ['phoneNumber'] }
          ]
        }
      }
    }, async (request: FastifyRequest<{ Body: ForgotPasswordRequest }>, reply: FastifyReply) => {
      try {
        await this.authService.forgotPassword(request.body);
        reply.send({ message: 'Password reset instructions sent' });
      } catch (error) {
        this.handleError(error, reply);
      }
    });

    server.post('/api/auth/reset-password', {
      schema: {
        body: {
          type: 'object',
          required: ['token', 'newPassword', 'confirmPassword'],
          properties: {
            token: { type: 'string' },
            newPassword: { type: 'string', minLength: 8 },
            confirmPassword: { type: 'string', minLength: 8 }
          }
        }
      }
    }, async (request: FastifyRequest<{ Body: ResetPasswordRequest }>, reply: FastifyReply) => {
      try {
        await this.authService.resetPassword(request.body);
        reply.send({ message: 'Password reset successfully' });
      } catch (error) {
        this.handleError(error, reply);
      }
    });

    // Protected routes
    server.register(async (protectedServer) => {
      // Apply auth middleware to all routes in this context
      protectedServer.addHook('preHandler', authMiddleware);

      protectedServer.post('/api/auth/logout', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
          const token = request.headers.authorization?.replace('Bearer ', '') || '';
          await this.authService.logout(token);
          reply.send({ message: 'Logged out successfully' });
        } catch (error) {
          this.handleError(error, reply);
        }
      });

      protectedServer.get('/api/auth/me', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
          const user = await this.authService.getProfile(request.user.userId);
          reply.send(user);
        } catch (error) {
          this.handleError(error, reply);
        }
      });

      protectedServer.put('/api/auth/profile', {
        schema: {
          body: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              koreanName: { type: 'string', pattern: '^[가-힣]{2,5}$' },
              phoneNumber: { type: 'string', pattern: '^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$' },
              birthDate: { type: 'string', format: 'date' },
              gender: { type: 'string', enum: ['M', 'F', 'O'] },
              marketingConsent: { type: 'boolean' }
            }
          }
        }
      }, async (request: FastifyRequest<{ Body: UpdateProfileRequest }>, reply: FastifyReply) => {
        try {
          const user = await this.authService.updateProfile(request.user.userId, request.body);
          reply.send(user);
        } catch (error) {
          this.handleError(error, reply);
        }
      });

      protectedServer.post('/api/auth/change-password', {
        schema: {
          body: {
            type: 'object',
            required: ['currentPassword', 'newPassword', 'confirmPassword'],
            properties: {
              currentPassword: { type: 'string' },
              newPassword: { type: 'string', minLength: 8 },
              confirmPassword: { type: 'string', minLength: 8 }
            }
          }
        }
      }, async (request: FastifyRequest<{ Body: ChangePasswordRequest }>, reply: FastifyReply) => {
        try {
          await this.authService.changePassword(request.user.userId, request.body);
          reply.send({ message: 'Password changed successfully' });
        } catch (error) {
          this.handleError(error, reply);
        }
      });

      protectedServer.get('/api/auth/sessions', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
          const sessions = await this.authService['repository'].getActiveSessions(request.user.userId);
          reply.send(sessions.map(session => ({
            id: session.id,
            userAgent: session.userAgent,
            ipAddress: session.ipAddress,
            lastActivity: session.lastActivity,
            isCurrent: session.sessionToken === request.headers.authorization?.replace('Bearer ', '')
          })));
        } catch (error) {
          this.handleError(error, reply);
        }
      });

      protectedServer.delete('/api/auth/sessions/:sessionId', async (
        request: FastifyRequest<{ Params: { sessionId: string } }>,
        reply: FastifyReply
      ) => {
        try {
          await this.authService['repository'].revokeSession(request.params.sessionId, 'User requested');
          reply.send({ message: 'Session revoked' });
        } catch (error) {
          this.handleError(error, reply);
        }
      });

      protectedServer.post('/api/auth/sessions/revoke-all', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
          const currentToken = request.headers.authorization?.replace('Bearer ', '') || '';
          const currentSession = await this.authService['repository'].findSessionByToken(currentToken);
          
          await this.authService['repository'].revokeAllUserSessions(
            request.user.userId,
            currentSession?.id
          );
          
          reply.send({ message: 'All sessions revoked' });
        } catch (error) {
          this.handleError(error, reply);
        }
      });

      // Two-Factor Authentication
      protectedServer.post('/api/auth/2fa/enable', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
          const result = await this.authService.enableTwoFactor(request.user.userId);
          reply.send(result);
        } catch (error) {
          this.handleError(error, reply);
        }
      });

      protectedServer.post('/api/auth/2fa/verify', {
        schema: {
          body: {
            type: 'object',
            required: ['code'],
            properties: {
              code: { type: 'string', minLength: 6, maxLength: 6 }
            }
          }
        }
      }, async (request: FastifyRequest<{ Body: { code: string } }>, reply: FastifyReply) => {
        try {
          const verified = await this.authService.verifyTwoFactor(request.user.userId, request.body.code);
          reply.send({ verified });
        } catch (error) {
          this.handleError(error, reply);
        }
      });

      protectedServer.post('/api/auth/2fa/disable', {
        schema: {
          body: {
            type: 'object',
            required: ['password'],
            properties: {
              password: { type: 'string' }
            }
          }
        }
      }, async (request: FastifyRequest<{ Body: { password: string } }>, reply: FastifyReply) => {
        try {
          // Verify password first
          const user = await this.authService['repository'].findById(request.user.userId);
          if (!user) {
            throw new AuthError(AuthErrorCode.USER_NOT_FOUND, 'User not found');
          }

          const bcrypt = require('bcrypt');
          const isValid = await bcrypt.compare(request.body.password, user.password);
          if (!isValid) {
            throw new AuthError(AuthErrorCode.INVALID_CREDENTIALS, 'Invalid password');
          }

          await this.authService['repository'].update(request.user.userId, {
            twoFactorEnabled: false,
            twoFactorSecret: null
          });

          reply.send({ message: 'Two-factor authentication disabled' });
        } catch (error) {
          this.handleError(error, reply);
        }
      });

      // Trusted Devices
      protectedServer.get('/api/auth/trusted-devices', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
          const devices = await this.authService['repository']['adapter']
            .createQueryBuilder('trusted_devices')
            .where('user_id', '=', request.user.userId)
            .where('is_active', '=', true)
            .execute();
          
          reply.send(devices);
        } catch (error) {
          this.handleError(error, reply);
        }
      });

      protectedServer.delete('/api/auth/trusted-devices/:deviceId', async (
        request: FastifyRequest<{ Params: { deviceId: string } }>,
        reply: FastifyReply
      ) => {
        try {
          await this.authService['repository'].revokeTrustedDevice(request.params.deviceId);
          reply.send({ message: 'Device removed' });
        } catch (error) {
          this.handleError(error, reply);
        }
      });

      // Audit Logs
      protectedServer.get('/api/auth/audit-logs', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
          const logs = await this.authService['repository'].getUserAuditLogs(request.user.userId);
          reply.send(logs);
        } catch (error) {
          this.handleError(error, reply);
        }
      });
    });

    // Health check
    server.get('/api/auth/health', async (request: FastifyRequest, reply: FastifyReply) => {
      reply.send({ status: 'healthy', timestamp: new Date().toISOString() });
    });
  }

  private handleError(error: any, reply: FastifyReply) {
    if (error instanceof AuthError) {
      reply.code(error.statusCode).send({
        error: error.code,
        message: error.message
      });
    } else {
      reply.code(500).send({
        error: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred'
      });
    }
  }
}

// Schema definitions for Fastify
declare module 'fastify' {
  interface FastifyInstance {
    addSchema(schema: any): void;
  }
}

// Add schema definitions
export function addAuthSchemas(server: FastifyInstance) {
  server.addSchema({
    $id: '#/definitions/AuthUser',
    type: 'object',
    properties: {
      id: { type: 'string' },
      email: { type: 'string' },
      phoneNumber: { type: 'string' },
      name: { type: 'string' },
      koreanName: { type: 'string' },
      role: { type: 'string' },
      permissions: { type: 'array', items: { type: 'string' } },
      isActive: { type: 'boolean' },
      isVerified: { type: 'boolean' },
      emailVerified: { type: 'boolean' },
      phoneVerified: { type: 'boolean' },
      twoFactorEnabled: { type: 'boolean' },
      lastLogin: { type: 'string', format: 'date-time' },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' }
    }
  });

  server.addSchema({
    $id: '#/definitions/TokenPair',
    type: 'object',
    properties: {
      accessToken: { type: 'string' },
      refreshToken: { type: 'string' },
      expiresIn: { type: 'number' }
    }
  });
}