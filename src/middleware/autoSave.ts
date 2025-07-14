import { Request, Response, NextFunction } from 'express'
import { logger } from '../utils/logger'
import { cartService } from '../services/cartService'
import { sessionService } from '../services/sessionService'

interface AutoSaveConfig {
  interval: number // Auto-save interval in seconds
  onlyOnChanges: boolean // Only save when cart changes are detected
  enablePeriodicSave: boolean // Enable background periodic saves
  maxRetries: number // Maximum retry attempts for failed saves
  enableRecovery: boolean // Enable cart recovery on session restore
}

interface CartSnapshot {
  items: Array<{
    productId: string
    variantId?: string
    quantity: number
    options?: Record<string, any>
  }>
  coupons: string[]
  timestamp: Date
  checksum: string
}

// Default configuration
const DEFAULT_CONFIG: AutoSaveConfig = {
  interval: 30, // 30 seconds
  onlyOnChanges: true,
  enablePeriodicSave: true,
  maxRetries: 3,
  enableRecovery: true,
}

// In-memory storage for cart snapshots (in production, use Redis)
const cartSnapshots = new Map<string, CartSnapshot>()
const saveTimers = new Map<string, ReturnType<typeof setTimeout>>()

/**
 * Auto-save middleware for cart operations
 * Automatically saves cart state at regular intervals and on changes
 */
export function autoSaveMiddleware(config: Partial<AutoSaveConfig> = {}) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config }

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Only apply auto-save to cart operations
      if (!isCartOperation(req)) {
        return next()
      }

      const sessionId = getSessionId(req)
      if (!sessionId) {
        return next()
      }

      // Set up auto-save for this session
      await setupAutoSave(sessionId, finalConfig)

      // Override response to trigger save after operation
      const originalJson = res.json
      res.json = function(data: any) {
        // Call original json method
        const result = originalJson.call(this, data)

        // Trigger auto-save after successful cart operation
        setImmediate(async () => {
          try {
            if (data.success && data.data?.id) {
              await performAutoSave(sessionId, data.data.id, finalConfig)
            }
          } catch (error) {
            logger.error('Error in auto-save after cart operation:', error)
          }
        })

        return result
      }

      next()
    } catch (error) {
      logger.error('Auto-save middleware error:', error)
      next() // Don't block request on auto-save errors
    }
  }
}

/**
 * Set up periodic auto-save for a session
 */
async function setupAutoSave(sessionId: string, config: AutoSaveConfig): Promise<void> {
  // Clear existing timer if any
  const existingTimer = saveTimers.get(sessionId)
  if (existingTimer) {
    clearInterval(existingTimer)
  }

  if (!config.enablePeriodicSave) {
    return
  }

  // Set up periodic save timer
  const timer = setInterval(async () => {
    try {
      await performPeriodicSave(sessionId, config)
    } catch (error) {
      logger.error(`Periodic auto-save error for session ${sessionId}:`, error)
    }
  }, config.interval * 1000)

  saveTimers.set(sessionId, timer)

  logger.debug(`Auto-save setup for session: ${sessionId}, interval: ${config.interval}s`)
}

/**
 * Perform auto-save for a specific cart
 */
async function performAutoSave(
  sessionId: string,
  cartId: string,
  config: AutoSaveConfig,
  retryCount: number = 0,
): Promise<void> {
  try {
    const cart = await cartService.getCartById(cartId)
    if (!cart) {
      logger.warn(`Cart not found for auto-save: ${cartId}`)
      return
    }

    // Create cart snapshot
    const snapshot = createCartSnapshot(cart)

    // Check if cart has changed (if configured to only save on changes)
    if (config.onlyOnChanges) {
      const previousSnapshot = cartSnapshots.get(sessionId)
      if (previousSnapshot && previousSnapshot.checksum === snapshot.checksum) {
        logger.debug(`No changes detected for cart ${cartId}, skipping auto-save`)
        return
      }
    }

    // Store snapshot
    cartSnapshots.set(sessionId, snapshot)

    // Update session activity
    await sessionService.updateSessionActivity(sessionId, {
      type: 'cart_action',
      data: {
        action: 'auto_save',
        cartId,
        itemCount: cart.items.length,
        timestamp: new Date(),
      },
    })

    logger.debug(`Auto-save completed for cart ${cartId}`, {
      sessionId,
      itemCount: cart.items.length,
      checksum: snapshot.checksum,
    })

  } catch (error) {
    logger.error(`Auto-save failed for cart ${cartId}:`, error)

    // Retry logic
    if (retryCount < config.maxRetries) {
      logger.info(`Retrying auto-save for cart ${cartId}, attempt ${retryCount + 1}`)
      setTimeout(() => {
        performAutoSave(sessionId, cartId, config, retryCount + 1)
      }, Math.pow(2, retryCount) * 1000) // Exponential backoff
    } else {
      logger.error(`Auto-save failed after ${config.maxRetries} attempts for cart ${cartId}`)
    }
  }
}

/**
 * Perform periodic auto-save for all items in a session's cart
 */
async function performPeriodicSave(sessionId: string, config: AutoSaveConfig): Promise<void> {
  try {
    const session = await sessionService.getGuestSession(sessionId)
    if (!session?.cartId) {
      // No cart to save, clean up timer
      const timer = saveTimers.get(sessionId)
      if (timer) {
        clearInterval(timer)
        saveTimers.delete(sessionId)
      }
      return
    }

    await performAutoSave(sessionId, session.cartId, config)
  } catch (error) {
    logger.error(`Periodic save error for session ${sessionId}:`, error)
  }
}

/**
 * Recover cart state from snapshot
 */
export async function recoverCartFromSnapshot(sessionId: string): Promise<boolean> {
  try {
    const snapshot = cartSnapshots.get(sessionId)
    if (!snapshot) {
      logger.debug(`No snapshot found for session ${sessionId}`)
      return false
    }

    // Check if snapshot is recent (within last hour)
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000)
    if (snapshot.timestamp < hourAgo) {
      logger.debug(`Snapshot too old for session ${sessionId}`)
      cartSnapshots.delete(sessionId)
      return false
    }

    // Get or create cart for recovery
    let cart = await cartService.getCartByUserOrSession(undefined, sessionId)

    if (!cart) {
      // Create new cart
      cart = await cartService.createCart({
        sessionId,
        currency: 'USD',
      })
    }

    // Clear existing items
    if (cart.items.length > 0) {
      await cartService.clearCart(cart.id)
    }

    // Restore items from snapshot
    for (const item of snapshot.items) {
      try {
        await cartService.addItemToCart(cart.id, {
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          options: item.options,
        })
      } catch (error) {
        logger.warn('Failed to restore cart item during recovery:', error)
        // Continue with other items
      }
    }

    logger.info(`Cart recovered from snapshot for session ${sessionId}`, {
      itemCount: snapshot.items.length,
      snapshotAge: Date.now() - snapshot.timestamp.getTime(),
    })

    return true
  } catch (error) {
    logger.error(`Cart recovery failed for session ${sessionId}:`, error)
    return false
  }
}

/**
 * Clean up auto-save resources for a session
 */
export function cleanupAutoSave(sessionId: string): void {
  // Clear timer
  const timer = saveTimers.get(sessionId)
  if (timer) {
    clearInterval(timer)
    saveTimers.delete(sessionId)
  }

  // Clear snapshot
  cartSnapshots.delete(sessionId)

  logger.debug(`Auto-save cleanup completed for session: ${sessionId}`)
}

/**
 * Get auto-save statistics
 */
export function getAutoSaveStats(): {
  activeSessions: number
  snapshotsCount: number
  timersCount: number
  oldestSnapshot?: Date
  newestSnapshot?: Date
  } {
  const snapshots = Array.from(cartSnapshots.values())

  return {
    activeSessions: cartSnapshots.size,
    snapshotsCount: snapshots.length,
    timersCount: saveTimers.size,
    oldestSnapshot: snapshots.length > 0
      ? new Date(Math.min(...snapshots.map(s => s.timestamp.getTime())))
      : undefined,
    newestSnapshot: snapshots.length > 0
      ? new Date(Math.max(...snapshots.map(s => s.timestamp.getTime())))
      : undefined,
  }
}

// Helper functions

function isCartOperation(req: Request): boolean {
  return req.path.includes('/cart') || req.path.includes('/carts')
}

function getSessionId(req: Request): string | null {
  return req.guestSession?.sessionId ||
         req.headers['x-session-id'] as string ||
         req.query.sessionId as string ||
         req.body?.sessionId ||
         null
}

function createCartSnapshot(cart: any): CartSnapshot {
  const items = cart.items.map((item: any) => ({
    productId: item.productId,
    variantId: item.variantId,
    quantity: item.quantity,
    options: item.options,
  }))

  const coupons = cart.appliedCoupons?.map((coupon: any) => coupon.code) || []

  // Create simple checksum for change detection
  const dataString = JSON.stringify({ items, coupons })
  const checksum = Buffer.from(dataString).toString('base64').slice(0, 16)

  return {
    items,
    coupons,
    timestamp: new Date(),
    checksum,
  }
}

// Cleanup function for graceful shutdown
export function shutdownAutoSave(): void {
  logger.info('Shutting down auto-save system...')

  // Clear all timers
  for (const timer of saveTimers.values()) {
    clearInterval(timer)
  }
  saveTimers.clear()

  // Clear all snapshots
  cartSnapshots.clear()

  logger.info('Auto-save system shutdown complete')
}

// Export configuration for external use
export { AutoSaveConfig, CartSnapshot }
