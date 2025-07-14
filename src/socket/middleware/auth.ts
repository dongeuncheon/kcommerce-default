import { Socket } from 'socket.io'
import { ExtendedError } from 'socket.io/dist/namespace'
import jwt from 'jsonwebtoken'
import { logger } from '../../utils/logger'

interface AuthenticatedSocket extends Socket {
  userId?: string
  sessionId?: string
  isAuthenticated: boolean
}

export const authMiddleware = (socket: AuthenticatedSocket, next: (err?: ExtendedError) => void) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '')
    const sessionId = socket.handshake.auth.sessionId || socket.handshake.headers['x-session-id']

    // Initialize socket properties
    socket.isAuthenticated = false
    socket.userId = undefined
    socket.sessionId = sessionId || undefined

    // If token is provided, try to authenticate
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as any
        socket.userId = decoded.userId || decoded.id
        socket.isAuthenticated = true
        
        logger.debug(`Socket authenticated for user: ${socket.userId}`)
      } catch (jwtError) {
        logger.warn(`Invalid JWT token for socket ${socket.id}:`, jwtError)
        // Continue without authentication - allow anonymous users
      }
    }

    // If no token but sessionId is provided, allow anonymous access
    if (!socket.isAuthenticated && sessionId) {
      socket.sessionId = sessionId
      logger.debug(`Socket connected with session: ${sessionId}`)
    }

    // Allow connection even without authentication (for anonymous users)
    if (!socket.isAuthenticated && !sessionId) {
      // Generate a temporary session ID for truly anonymous users
      socket.sessionId = `temp_${socket.id}_${Date.now()}`
      logger.debug(`Socket connected anonymously with temp session: ${socket.sessionId}`)
    }

    next()
  } catch (error) {
    logger.error('Socket auth middleware error:', error)
    next(new Error('Authentication failed'))
  }
}

export type { AuthenticatedSocket }