import { Request, Response, NextFunction } from 'express'
import { sessionService } from '../services/sessionService'
import { logger } from '../utils/logger'
import { recoverCartFromSnapshot } from './autoSave'

// Extend Express Request interface to include session info
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace, @typescript-eslint/no-unused-vars
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    interface Request {
      guestSession?: {
        sessionId: string
        isGuest: boolean
        isAuthenticated: boolean
        userId?: string
        cartId?: string
        expiresAt: Date
        lastActivity: Date
      }
    }
  }
}

export interface SessionOptions {
  cookieName?: string
  headerName?: string
  autoCreate?: boolean
  trackActivity?: boolean
  extendOnActivity?: boolean
}

const DEFAULT_OPTIONS: Required<SessionOptions> = {
  cookieName: 'guest_session_id',
  headerName: 'X-Session-ID',
  autoCreate: true,
  trackActivity: true,
  extendOnActivity: false,
}

/**
 * Session middleware for handling guest sessions
 * Automatically creates and manages guest sessions for non-authenticated users
 */
export function sessionMiddleware(options: SessionOptions = {}) {
  const config = { ...DEFAULT_OPTIONS, ...options }

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Skip session handling for certain paths
      if (shouldSkipSession(req.path)) {
        return next()
      }

      // Check if user is authenticated (has userId in JWT or similar)
      const isAuthenticated = !!(req as any).user?.id || !!(req as any).userId
      const userId = (req as any).user?.id || (req as any).userId

      if (isAuthenticated) {
        // User is authenticated, set session info
        req.guestSession = {
          sessionId: userId,
          isGuest: false,
          isAuthenticated: true,
          userId,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          lastActivity: new Date(),
        }
        return next()
      }

      // Handle guest session
      let sessionId = getSessionIdFromRequest(req, config)

      if (!sessionId && config.autoCreate) {
        // Create new guest session
        const guestSession = await sessionService.getOrCreateGuestSession(
          undefined,
          getClientIP(req),
          req.headers['user-agent'],
        )
        sessionId = guestSession.sessionId

        // Set session ID in response cookie
        setSessionCookie(res, sessionId, config.cookieName)

        logger.debug(`Created new guest session: ${sessionId}`)
      } else if (sessionId) {
        // Validate existing session
        const existingSession = await sessionService.getGuestSession(sessionId)

        if (!existingSession || sessionService.isSessionExpired(existingSession)) {
          // Try to recover cart from auto-save snapshot before creating new session
          const recoveryAttempted = await recoverCartFromSnapshot(sessionId)
          if (recoveryAttempted) {
            logger.info(`Cart recovery attempted for expired session: ${sessionId}`)
          }

          // Session expired or invalid, create new one
          const newSession = await sessionService.getOrCreateGuestSession(
            undefined,
            getClientIP(req),
            req.headers['user-agent'],
          )
          sessionId = newSession.sessionId
          setSessionCookie(res, sessionId, config.cookieName)

          logger.debug(`Recreated expired guest session: ${sessionId}`)
        } else {
          // Update activity if enabled
          if (config.trackActivity) {
            await sessionService.updateSessionActivity(sessionId, {
              type: getActivityType(req),
              data: {
                path: req.path,
                method: req.method,
                timestamp: new Date(),
              },
            })
          }

          // Extend session if enabled
          if (config.extendOnActivity) {
            await sessionService.extendSession(sessionId, 24)
          }
        }
      }

      // Set session info on request
      if (sessionId) {
        const session = await sessionService.getGuestSession(sessionId)
        req.guestSession = {
          sessionId,
          isGuest: true,
          isAuthenticated: false,
          cartId: session?.cartId,
          expiresAt: session?.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          lastActivity: session?.lastActivity || new Date(),
        }
      }

      next()
    } catch (error) {
      logger.error('Session middleware error:', error)
      // Don't block request on session errors
      next()
    }
  }
}

/**
 * Middleware specifically for cart operations
 * Ensures session ID is available for cart operations
 */
export function cartSessionMiddleware() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // If no session exists, create one for cart operations
      if (!req.guestSession?.sessionId) {
        const guestSession = await sessionService.getOrCreateGuestSession(
          undefined,
          getClientIP(req),
          req.headers['user-agent'],
        )

        req.guestSession = {
          sessionId: guestSession.sessionId,
          isGuest: true,
          isAuthenticated: false,
          expiresAt: guestSession.expiresAt,
          lastActivity: guestSession.lastActivity,
        }

        // Set cookie for future requests
        setSessionCookie(res, guestSession.sessionId, 'guest_session_id')
      }

      // Add sessionId to request body/query for cart operations
      if (req.guestSession.isGuest) {
        // For POST/PUT requests, add to body
        if (req.method === 'POST' || req.method === 'PUT') {
          req.body = req.body || {}
          if (!req.body.sessionId && !req.body.userId) {
            req.body.sessionId = req.guestSession.sessionId
          }
        }

        // For GET requests, add to query
        if (req.method === 'GET') {
          req.query = req.query || {}
          if (!req.query.sessionId && !req.query.userId) {
            req.query.sessionId = req.guestSession.sessionId
          }
        }
      }

      next()
    } catch (error) {
      logger.error('Cart session middleware error:', error)
      next(error)
    }
  }
}

/**
 * Helper function to transfer guest cart to user on authentication
 */
export async function transferGuestToUser(sessionId: string, userId: string): Promise<boolean> {
  try {
    return await sessionService.transferSessionToUser(sessionId, userId)
  } catch (error) {
    logger.error('Error transferring guest to user:', error)
    return false
  }
}

// Helper functions

function shouldSkipSession(path: string): boolean {
  const skipPaths = [
    '/health',
    '/api/v1/security',
    '/api-docs',
    '/metrics',
    '/favicon.ico',
  ]

  return skipPaths.some(skipPath => path.startsWith(skipPath))
}

function getSessionIdFromRequest(req: Request, config: Required<SessionOptions>): string | null {
  // Try to get session ID from header first
  let sessionId = req.headers[config.headerName.toLowerCase()] as string

  if (!sessionId) {
    // Try to get from cookie
    sessionId = req.cookies?.[config.cookieName]
  }

  if (!sessionId) {
    // Try to get from query parameter
    sessionId = req.query.sessionId as string
  }

  if (!sessionId) {
    // Try to get from body
    sessionId = req.body?.sessionId
  }

  return sessionId || null
}

function setSessionCookie(res: Response, sessionId: string, cookieName: string): void {
  res.cookie(cookieName, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
  })
}

function getClientIP(req: Request): string {
  return (
    req.headers['x-forwarded-for'] as string ||
    req.headers['x-real-ip'] as string ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    'unknown'
  ).split(',')[0].trim()
}

function getActivityType(req: Request): 'page_view' | 'cart_action' | 'product_view' | 'search' | 'checkout_start' | 'other' {
  const path = req.path.toLowerCase()

  if (path.includes('/cart')) return 'cart_action'
  if (path.includes('/product')) return 'product_view'
  if (path.includes('/search')) return 'search'
  if (path.includes('/checkout')) return 'checkout_start'

  return 'other'
}

// Export session service for direct access
export { sessionService }
