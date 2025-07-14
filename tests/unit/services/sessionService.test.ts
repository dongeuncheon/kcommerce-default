import { SessionService } from '../../../src/services/sessionService'
import { prisma } from '../../../src/utils/database'

// Mock dependencies
jest.mock('../../../src/utils/database')

const mockPrisma = prisma as jest.Mocked<typeof prisma>

describe('SessionService', () => {
  let sessionService: SessionService

  beforeEach(() => {
    jest.clearAllMocks()
    sessionService = new SessionService()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('generateSessionId', () => {
    test('should generate unique session ID', () => {
      const sessionId1 = sessionService.generateSessionId()
      const sessionId2 = sessionService.generateSessionId()

      expect(sessionId1).toMatch(/^guest_/)
      expect(sessionId2).toMatch(/^guest_/)
      expect(sessionId1).not.toBe(sessionId2)
      expect(sessionId1.length).toBeGreaterThan(20)
    })

    test('should generate session ID with expected format', () => {
      const sessionId = sessionService.generateSessionId()
      
      expect(sessionId).toMatch(/^guest_[a-z0-9]+_[a-z0-9]+_[a-z0-9]+$/)
    })
  })

  describe('getOrCreateGuestSession', () => {
    test('should create new session when no sessionId provided', async () => {
      const session = await sessionService.getOrCreateGuestSession(
        undefined,
        '192.168.1.1',
        'Mozilla/5.0 Test Browser'
      )

      expect(session).toHaveProperty('sessionId')
      expect(session).toHaveProperty('ipAddress', '192.168.1.1')
      expect(session).toHaveProperty('userAgent', 'Mozilla/5.0 Test Browser')
      expect(session).toHaveProperty('lastActivity')
      expect(session).toHaveProperty('expiresAt')
      expect(session.sessionId).toMatch(/^guest_/)
    })

    test('should return existing session when valid sessionId provided', async () => {
      const existingSessionId = 'guest_existing_session_123'
      
      // Mock existing cart
      const mockCart = {
        id: 'cart-1',
        sessionId: existingSessionId,
        userId: null,
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
        createdAt: new Date(),
        currency: 'USD'
      }

      mockPrisma.cart.findFirst.mockResolvedValue(mockCart as any)

      const session = await sessionService.getOrCreateGuestSession(
        existingSessionId,
        '192.168.1.1',
        'Mozilla/5.0 Test Browser'
      )

      expect(session.sessionId).toBe(existingSessionId)
      expect(session.cartId).toBe('cart-1')
    })

    test('should create new session when existing session is expired', async () => {
      const expiredSessionId = 'guest_expired_session_123'
      
      // Mock expired cart
      const mockExpiredCart = {
        id: 'cart-1',
        sessionId: expiredSessionId,
        userId: null,
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
        createdAt: new Date(),
        currency: 'USD'
      }

      mockPrisma.cart.findFirst.mockResolvedValue(mockExpiredCart as any)

      const session = await sessionService.getOrCreateGuestSession(
        expiredSessionId,
        '192.168.1.1',
        'Mozilla/5.0 Test Browser'
      )

      // Should create new session, not return expired one
      expect(session.sessionId).not.toBe(expiredSessionId)
      expect(session.sessionId).toMatch(/^guest_/)
    })
  })

  describe('getGuestSession', () => {
    test('should return session when cart exists', async () => {
      const sessionId = 'guest_test_session_123'
      
      const mockCart = {
        id: 'cart-1',
        sessionId: sessionId,
        userId: null,
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        currency: 'USD'
      }

      mockPrisma.cart.findFirst.mockResolvedValue(mockCart as any)

      const session = await sessionService.getGuestSession(sessionId)

      expect(session).toHaveProperty('sessionId', sessionId)
      expect(session).toHaveProperty('cartId', 'cart-1')
      expect(session).toHaveProperty('lastActivity')
      expect(session).toHaveProperty('expiresAt')
    })

    test('should return null when no cart exists', async () => {
      mockPrisma.cart.findFirst.mockResolvedValue(null)

      const session = await sessionService.getGuestSession('non-existent-session')

      expect(session).toBe(null)
    })
  })

  describe('updateSessionActivity', () => {
    test('should update cart updatedAt timestamp', async () => {
      const sessionId = 'guest_test_session_123'
      
      const mockCart = {
        id: 'cart-1',
        sessionId: sessionId,
        userId: null,
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        currency: 'USD'
      }

      mockPrisma.cart.findFirst.mockResolvedValue(mockCart as any)
      mockPrisma.cart.update.mockResolvedValue(mockCart as any)

      const session = await sessionService.updateSessionActivity(sessionId, {
        type: 'cart_action',
        data: { action: 'add_item' }
      })

      expect(mockPrisma.cart.update).toHaveBeenCalledWith({
        where: { id: 'cart-1' },
        data: { updatedAt: expect.any(Date) }
      })

      expect(session).toHaveProperty('sessionId', sessionId)
    })

    test('should handle missing cart gracefully', async () => {
      const sessionId = 'guest_missing_cart_123'
      
      mockPrisma.cart.findFirst.mockResolvedValue(null)

      const session = await sessionService.updateSessionActivity(sessionId, {
        type: 'page_view'
      })

      expect(session).toHaveProperty('sessionId', sessionId)
      expect(session).toHaveProperty('lastActivity')
    })
  })

  describe('isSessionExpired', () => {
    test('should return true for expired session', () => {
      const expiredSession = {
        id: 'session-1',
        sessionId: 'guest_expired_123',
        lastActivity: new Date(),
        expiresAt: new Date(Date.now() - 1000) // 1 second ago
      }

      const isExpired = sessionService.isSessionExpired(expiredSession)

      expect(isExpired).toBe(true)
    })

    test('should return false for valid session', () => {
      const validSession = {
        id: 'session-1',
        sessionId: 'guest_valid_123',
        lastActivity: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
      }

      const isExpired = sessionService.isSessionExpired(validSession)

      expect(isExpired).toBe(false)
    })
  })

  describe('extendSession', () => {
    test('should extend session expiry', async () => {
      const sessionId = 'guest_extend_test_123'
      
      const mockCart = {
        id: 'cart-1',
        sessionId: sessionId,
        userId: null,
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        currency: 'USD'
      }

      mockPrisma.cart.findFirst.mockResolvedValue(mockCart as any)
      mockPrisma.cart.update.mockResolvedValue({
        ...mockCart,
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000)
      } as any)

      const session = await sessionService.extendSession(sessionId, 24)

      expect(mockPrisma.cart.update).toHaveBeenCalledWith({
        where: { id: 'cart-1' },
        data: { expiresAt: expect.any(Date) }
      })
    })

    test('should return null for non-existent session', async () => {
      mockPrisma.cart.findFirst.mockResolvedValue(null)

      const session = await sessionService.extendSession('non-existent', 24)

      expect(session).toBe(null)
    })
  })

  describe('transferSessionToUser', () => {
    test('should transfer cart ownership when user has no cart', async () => {
      const sessionId = 'guest_transfer_test_123'
      const userId = 'user_123'
      
      const mockGuestCart = {
        id: 'guest-cart-1',
        sessionId: sessionId,
        userId: null,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      }

      mockPrisma.cart.findFirst
        .mockResolvedValueOnce(mockGuestCart as any) // Guest cart
        .mockResolvedValueOnce(null) // No user cart

      mockPrisma.cart.update.mockResolvedValue({
        ...mockGuestCart,
        userId: userId,
        sessionId: null,
        expiresAt: null
      } as any)

      const success = await sessionService.transferSessionToUser(sessionId, userId)

      expect(success).toBe(true)
      expect(mockPrisma.cart.update).toHaveBeenCalledWith({
        where: { id: 'guest-cart-1' },
        data: {
          userId: userId,
          sessionId: null,
          expiresAt: null
        }
      })
    })

    test('should merge carts when user already has a cart', async () => {
      const sessionId = 'guest_merge_test_123'
      const userId = 'user_123'
      
      const mockGuestCart = {
        id: 'guest-cart-1',
        sessionId: sessionId,
        userId: null
      }

      const mockUserCart = {
        id: 'user-cart-1',
        userId: userId,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      }

      mockPrisma.cart.findFirst
        .mockResolvedValueOnce(mockGuestCart as any) // Guest cart
        .mockResolvedValueOnce(mockUserCart as any) // Existing user cart

      mockPrisma.cartItem.updateMany.mockResolvedValue({ count: 2 } as any)
      mockPrisma.cartCoupon.updateMany.mockResolvedValue({ count: 1 } as any)
      mockPrisma.cart.delete.mockResolvedValue(mockGuestCart as any)

      const success = await sessionService.transferSessionToUser(sessionId, userId)

      expect(success).toBe(true)
      expect(mockPrisma.cartItem.updateMany).toHaveBeenCalledWith({
        where: { cartId: 'guest-cart-1' },
        data: { cartId: 'user-cart-1' }
      })
      expect(mockPrisma.cartCoupon.updateMany).toHaveBeenCalledWith({
        where: { cartId: 'guest-cart-1' },
        data: { cartId: 'user-cart-1' }
      })
      expect(mockPrisma.cart.delete).toHaveBeenCalledWith({
        where: { id: 'guest-cart-1' }
      })
    })

    test('should return false when guest cart not found', async () => {
      mockPrisma.cart.findFirst.mockResolvedValue(null)

      const success = await sessionService.transferSessionToUser('non-existent', 'user_123')

      expect(success).toBe(false)
    })
  })

  describe('cleanupExpiredSessions', () => {
    test('should delete expired guest carts', async () => {
      mockPrisma.cart.deleteMany.mockResolvedValue({ count: 5 } as any)

      const deletedCount = await sessionService.cleanupExpiredSessions()

      expect(deletedCount).toBe(5)
      expect(mockPrisma.cart.deleteMany).toHaveBeenCalledWith({
        where: {
          userId: null,
          expiresAt: {
            lt: expect.any(Date)
          }
        }
      })
    })
  })

  describe('getSessionStats', () => {
    test('should return session statistics', async () => {
      // Mock cart counts
      mockPrisma.cart.count
        .mockResolvedValueOnce(15) // activeGuestCarts
        .mockResolvedValueOnce(25) // totalGuestCarts
        .mockResolvedValueOnce(10) // newGuestCarts

      // Mock recent movements
      mockPrisma.inventoryLog.count.mockResolvedValue(50)

      // Mock session duration calculation
      const mockSessions = [
        {
          createdAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
          updatedAt: new Date(Date.now() - 30 * 60 * 1000)  // 30 minutes ago
        },
        {
          createdAt: new Date(Date.now() - 120 * 60 * 1000), // 2 hours ago
          updatedAt: new Date(Date.now() - 60 * 60 * 1000)   // 1 hour ago
        }
      ]

      mockPrisma.cart.findMany
        .mockResolvedValueOnce(mockSessions as any) // For average duration
        .mockResolvedValueOnce([
          { quantity: 10, price: 100 },
          { quantity: 5, price: 50 }
        ] as any) // For total value calculation

      const stats = await sessionService.getSessionStats(24)

      expect(stats).toEqual({
        activeGuestSessions: 15,
        activeCarts: 25,
        averageSessionDuration: 30, // Average of 30 and 60 minutes
        newSessionsInPeriod: 10
      })
    })
  })

  describe('getSessionInfo', () => {
    test('should return comprehensive session information', async () => {
      const sessionId = 'guest_info_test_123'
      
      const mockCart = {
        id: 'cart-1',
        sessionId: sessionId,
        userId: null,
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        currency: 'USD',
        items: [
          {
            id: 'item-1',
            product: { name: 'Test Product', price: 29.99 }
          },
          {
            id: 'item-2',
            product: { name: 'Another Product', price: 19.99 }
          }
        ]
      }

      mockPrisma.cart.findFirst.mockResolvedValue(mockCart as any)
      mockPrisma.cart.findUnique.mockResolvedValue(mockCart as any)

      const info = await sessionService.getSessionInfo(sessionId)

      expect(info).toHaveProperty('session')
      expect(info).toHaveProperty('cart')
      expect(info).toHaveProperty('itemCount', 2)
      expect(info).toHaveProperty('isExpired', false)
      expect(info).toHaveProperty('lastActivity')
      
      expect(info.session?.sessionId).toBe(sessionId)
      expect(info.cart?.id).toBe('cart-1')
    })

    test('should handle non-existent session', async () => {
      mockPrisma.cart.findFirst.mockResolvedValue(null)

      const info = await sessionService.getSessionInfo('non-existent')

      expect(info).toEqual({
        session: null,
        cart: null,
        itemCount: 0,
        isExpired: true,
        lastActivity: 'N/A'
      })
    })
  })
})