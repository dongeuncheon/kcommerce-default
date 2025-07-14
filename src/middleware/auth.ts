import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { config } from '../config/config'
import { AppError } from './error'
import { mockAuthService } from '../services/mockAuth'
import { SecurityUtils } from '../utils/security'
import { logger } from '../utils/logger'

// Auth middleware that accepts roles
export const auth = (roles?: string[]) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await authenticate(req, res, () => {
        if (roles && roles.length > 0 && req.user) {
          if (!roles.includes(req.user.role)) {
            throw new AppError('Insufficient permissions', 403)
          }
        }
        next()
      })
    } catch (error) {
      next(error)
    }
  }
}

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string
    email: string
    role: string
  }
  session?: {
    id: string
    token: string
    csrfToken?: string
  }
}

// Verify JWT token and attach user to request
export const authenticate = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')

    if (!token) {
      throw new AppError('Authentication token required', 401)
    }

    // Verify JWT token
    const decoded = jwt.verify(token, config.jwt.secret) as any

    // Get user from mock service
    const user = await mockAuthService.verifyToken(token)

    if (!user || !user.isActive || !user.isVerified) {
      throw new AppError('Invalid or inactive user', 401)
    }

    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
    }

    next()
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw new AppError('Invalid token', 401)
    }
    throw error
  }
}

// Authorization middleware to check user roles
export const authorize = (allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new AppError('Authentication required', 401)
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw new AppError('Insufficient permissions', 403)
    }

    next()
  }
}

// Optional authentication (user can be null)
export const optionalAuth = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')

    if (token) {
      const decoded = jwt.verify(token, config.jwt.secret) as any

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true,
          isVerified: true,
        },
      })

      if (user && user.isActive && user.isVerified) {
        req.user = {
          id: user.id,
          email: user.email,
          role: user.role,
        }
      }
    }

    next()
  } catch (error) {
    // Ignore auth errors for optional auth
    next()
  }
}

// CSRF Protection
export const csrfProtection = (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
) => {
  // Skip CSRF for GET requests and API calls
  if (req.method === 'GET' || req.path.startsWith('/api/')) {
    return next()
  }

  const csrfToken = req.headers['x-csrf-token'] || req.body._token
  const sessionCsrfToken = req.session?.csrfToken

  if (!csrfToken || csrfToken !== sessionCsrfToken) {
    throw new AppError('Invalid CSRF token', 403)
  }

  next()
}

// Session-based authentication
export const sessionAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const sessionToken = req.cookies?.sessionToken || req.headers['x-session-token']

    if (!sessionToken) {
      return next() // Allow anonymous sessions
    }

    // Find session in database
    const session = await prisma.session.findUnique({
      where: { token: sessionToken },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            isActive: true,
            isVerified: true,
          },
        },
      },
    })

    if (!session || session.expiresAt < new Date()) {
      // Clear invalid session cookie
      res.clearCookie('sessionToken')
      return next()
    }

    // Update session last activity
    await prisma.session.update({
      where: { id: session.id },
      data: { lastActivityAt: new Date() },
    })

    // Attach user and session to request
    if (session.user && session.user.isActive && session.user.isVerified) {
      req.user = {
        id: session.user.id,
        email: session.user.email,
        role: session.user.role,
      }
    }

    req.session = {
      id: session.id,
      token: session.token,
      csrfToken: session.csrfToken || undefined,
    }

    next()
  } catch (error) {
    logger.error('Session authentication error', error)
    next()
  }
}

// API Key authentication
export const apiKeyAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  try {
    const apiKey = req.headers['x-api-key'] as string

    if (!apiKey) {
      throw new AppError('API key required', 401)
    }

    if (!SecurityUtils.isValidAPIKey(apiKey)) {
      throw new AppError('Invalid API key format', 401)
    }

    // Verify API key in database
    const hashedKey = SecurityUtils.hashData(apiKey)
    const apiClient = await prisma.apiClient.findFirst({
      where: {
        hashedKey,
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
    })

    if (!apiClient) {
      logger.warn('Invalid API key attempt', {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      })
      throw new AppError('Invalid API key', 401)
    }

    // Rate limit check
    await prisma.apiClient.update({
      where: { id: apiClient.id },
      data: {
        lastUsedAt: new Date(),
        requestCount: { increment: 1 },
      },
    })

    // Attach client info to request
    const authReq = req as any
    authReq.apiClient = {
      id: apiClient.id,
      name: apiClient.name,
      permissions: apiClient.permissions as string[],
    }

    next()
  } catch (error) {
    next(error)
  }
}

// Alias for backward compatibility
export const authMiddleware = authenticate
