import { v4 as uuidv4 } from 'uuid'
import { prisma } from '../utils/database'
import { logger } from '../utils/logger'

export interface GuestSession {
  id: string
  sessionId: string
  ipAddress?: string
  userAgent?: string
  cartId?: string
  lastActivity: Date
  expiresAt: Date
  metadata?: Record<string, any>
}

export interface SessionActivity {
  type: 'page_view' | 'cart_action' | 'product_view' | 'search' | 'checkout_start' | 'other'
  data?: Record<string, any>
}

export class SessionService {
  private readonly SESSION_EXPIRY_HOURS = 24 * 7 // 7 days for session tracking
  // private readonly CART_EXPIRY_HOURS = 72 // 3 days for cart

  // Generate a new session ID
  generateSessionId(): string {
    const timestamp = Date.now().toString(36)
    const randomPart = Math.random().toString(36).substr(2, 12)
    const uuid = uuidv4().replace(/-/g, '').substr(0, 8)

    return `guest_${timestamp}_${randomPart}_${uuid}`
  }

  // Create or get existing guest session
  async getOrCreateGuestSession(
    sessionId?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<GuestSession> {
    try {
      // If sessionId provided, try to find existing session
      if (sessionId) {
        const existingSession = await this.getGuestSession(sessionId)
        if (existingSession && !this.isSessionExpired(existingSession)) {
          // Update last activity
          return this.updateSessionActivity(sessionId, { type: 'other' })
        }
      }

      // Create new session
      const newSessionId = this.generateSessionId()
      const expiresAt = new Date()
      expiresAt.setHours(expiresAt.getHours() + this.SESSION_EXPIRY_HOURS)

      const session: GuestSession = {
        id: newSessionId,
        sessionId: newSessionId,
        ipAddress,
        userAgent,
        lastActivity: new Date(),
        expiresAt,
        metadata: {
          createdAt: new Date(),
          source: 'guest_session',
          isActive: true,
        },
      }

      logger.info(`Created new guest session: ${newSessionId}`, {
        ipAddress,
        userAgent: userAgent?.substring(0, 100), // Truncate for logging
      })

      return session
    } catch (error) {
      logger.error('Error creating guest session:', error)
      throw error
    }
  }

  // Get guest session by sessionId
  async getGuestSession(sessionId: string): Promise<GuestSession | null> {
    try {
      // For now, we'll use a simple in-memory approach
      // In production, you might want to use Redis or database storage

      // Since we don't have a dedicated session table, we'll work with cart sessions
      const cart = await prisma.cart.findFirst({
        where: {
          sessionId,
          userId: null, // Only guest carts
        },
        orderBy: { updatedAt: 'desc' },
      })

      if (!cart) {
        return null
      }

      return {
        id: cart.sessionId || sessionId,
        sessionId: cart.sessionId || sessionId,
        cartId: cart.id,
        lastActivity: cart.updatedAt,
        expiresAt: cart.expiresAt || new Date(Date.now() + this.SESSION_EXPIRY_HOURS * 60 * 60 * 1000),
        metadata: {
          cartCreatedAt: cart.createdAt,
          cartCurrency: cart.currency,
        },
      }
    } catch (error) {
      logger.error('Error getting guest session:', error)
      return null
    }
  }

  // Update session activity
  async updateSessionActivity(
    sessionId: string,
    activity: SessionActivity,
  ): Promise<GuestSession> {
    try {
      // Update cart's updatedAt timestamp to track activity
      const cart = await prisma.cart.findFirst({
        where: {
          sessionId,
          userId: null,
        },
        orderBy: { updatedAt: 'desc' },
      })

      if (cart) {
        await prisma.cart.update({
          where: { id: cart.id },
          data: { updatedAt: new Date() },
        })
      }

      logger.debug(`Updated session activity: ${sessionId}`, { activity })

      // Return updated session
      const session = await this.getGuestSession(sessionId)
      return session || {
        id: sessionId,
        sessionId,
        lastActivity: new Date(),
        expiresAt: new Date(Date.now() + this.SESSION_EXPIRY_HOURS * 60 * 60 * 1000),
      }
    } catch (error) {
      logger.error('Error updating session activity:', error)
      throw error
    }
  }

  // Check if session is expired
  isSessionExpired(session: GuestSession): boolean {
    return new Date() > session.expiresAt
  }

  // Extend session expiry
  async extendSession(sessionId: string, additionalHours: number = 24): Promise<GuestSession | null> {
    try {
      const session = await this.getGuestSession(sessionId)
      if (!session) {
        return null
      }

      // Extend cart expiry if cart exists
      if (session.cartId) {
        const newExpiresAt = new Date()
        newExpiresAt.setHours(newExpiresAt.getHours() + additionalHours)

        await prisma.cart.update({
          where: { id: session.cartId },
          data: { expiresAt: newExpiresAt },
        })

        logger.info(`Extended session: ${sessionId} by ${additionalHours} hours`)
      }

      return this.getGuestSession(sessionId)
    } catch (error) {
      logger.error('Error extending session:', error)
      throw error
    }
  }

  // Transfer guest session to authenticated user
  async transferSessionToUser(sessionId: string, userId: string): Promise<boolean> {
    try {
      // Find guest cart for this session
      const guestCart = await prisma.cart.findFirst({
        where: {
          sessionId,
          userId: null,
        },
      })

      if (!guestCart) {
        logger.warn(`No guest cart found for session: ${sessionId}`)
        return false
      }

      // Check if user already has a cart
      const userCart = await prisma.cart.findFirst({
        where: {
          userId,
          expiresAt: { gt: new Date() },
        },
        orderBy: { updatedAt: 'desc' },
      })

      if (userCart) {
        // User has existing cart - merge guest cart into user cart
        logger.info(`Merging guest cart ${guestCart.id} into user cart ${userCart.id}`)

        // Move all items from guest cart to user cart
        await prisma.cartItem.updateMany({
          where: { cartId: guestCart.id },
          data: { cartId: userCart.id },
        })

        // Move coupons
        await prisma.cartCoupon.updateMany({
          where: { cartId: guestCart.id },
          data: { cartId: userCart.id },
        })

        // Delete guest cart
        await prisma.cart.delete({
          where: { id: guestCart.id },
        })
      } else {
        // User has no cart - transfer ownership
        logger.info(`Transferring guest cart ${guestCart.id} to user ${userId}`)

        await prisma.cart.update({
          where: { id: guestCart.id },
          data: {
            userId,
            sessionId: null, // Clear session ID
            expiresAt: null, // Remove expiry for authenticated user
          },
        })
      }

      logger.info(`Successfully transferred session ${sessionId} to user ${userId}`)
      return true
    } catch (error) {
      logger.error('Error transferring session to user:', error)
      throw error
    }
  }

  // Clean up expired sessions
  async cleanupExpiredSessions(): Promise<number> {
    try {
      // Clean up expired guest carts (sessions)
      const result = await prisma.cart.deleteMany({
        where: {
          userId: null, // Guest carts only
          expiresAt: {
            lt: new Date(), // Expired
          },
        },
      })

      logger.info(`Cleaned up ${result.count} expired guest sessions`)
      return result.count
    } catch (error) {
      logger.error('Error cleaning up expired sessions:', error)
      throw error
    }
  }

  // Get session statistics
  async getSessionStats(hours: number = 24): Promise<{
    activeGuestSessions: number
    activeCarts: number
    averageSessionDuration: number
    newSessionsInPeriod: number
  }> {
    try {
      const hoursAgo = new Date()
      hoursAgo.setHours(hoursAgo.getHours() - hours)

      const activeGuestCarts = await prisma.cart.count({
        where: {
          userId: null,
          expiresAt: { gt: new Date() },
          updatedAt: { gt: hoursAgo },
        },
      })

      const totalGuestCarts = await prisma.cart.count({
        where: {
          userId: null,
          expiresAt: { gt: new Date() },
        },
      })

      const newGuestCarts = await prisma.cart.count({
        where: {
          userId: null,
          createdAt: { gt: hoursAgo },
        },
      })

      // Calculate average session duration (simplified)
      const sessions = await prisma.cart.findMany({
        where: {
          userId: null,
          createdAt: { gt: hoursAgo },
        },
        select: {
          createdAt: true,
          updatedAt: true,
        },
      })

      const averageSessionDuration = sessions.length > 0
        ? sessions.reduce((acc, session) => {
          const duration = session.updatedAt.getTime() - session.createdAt.getTime()
          return acc + duration
        }, 0) / sessions.length / (1000 * 60) // Convert to minutes
        : 0

      return {
        activeGuestSessions: activeGuestCarts,
        activeCarts: totalGuestCarts,
        averageSessionDuration: Math.round(averageSessionDuration),
        newSessionsInPeriod: newGuestCarts,
      }
    } catch (error) {
      logger.error('Error getting session stats:', error)
      throw error
    }
  }

  // Associate cart with session
  async associateCartWithSession(sessionId: string, cartId: string): Promise<void> {
    try {
      await prisma.cart.update({
        where: { id: cartId },
        data: { sessionId },
      })

      logger.debug(`Associated cart ${cartId} with session ${sessionId}`)
    } catch (error) {
      logger.error('Error associating cart with session:', error)
      throw error
    }
  }

  // Get session info for debugging
  async getSessionInfo(sessionId: string): Promise<{
    session: GuestSession | null
    cart: any
    itemCount: number
    isExpired: boolean
    lastActivity: string
  }> {
    try {
      const session = await this.getGuestSession(sessionId)

      let cart = null
      let itemCount = 0

      if (session?.cartId) {
        cart = await prisma.cart.findUnique({
          where: { id: session.cartId },
          include: {
            items: {
              include: {
                product: {
                  select: { name: true, price: true },
                },
              },
            },
          },
        })
        itemCount = cart?.items?.length || 0
      }

      return {
        session,
        cart,
        itemCount,
        isExpired: session ? this.isSessionExpired(session) : true,
        lastActivity: session?.lastActivity.toISOString() || 'N/A',
      }
    } catch (error) {
      logger.error('Error getting session info:', error)
      throw error
    }
  }
}

export const sessionService = new SessionService()
