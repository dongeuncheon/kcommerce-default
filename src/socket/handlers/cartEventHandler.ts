// import { Socket } from 'socket.io'
import { cartService } from '../../services/cartService'
import { logger } from '../../utils/logger'
import { AuthenticatedSocket } from '../middleware/auth'
import { CartEvent } from '../../types/cart'

export class CartEventHandler {
  // Handle cart sync request from client
  async handleSyncRequest(socket: AuthenticatedSocket, data: { cartId: string; lastSyncAt?: string }) {
    try {
      const { cartId, lastSyncAt } = data

      // Verify the socket has access to this cart
      const hasAccess = await this.verifyCartAccess(socket, cartId)
      if (!hasAccess) {
        socket.emit('cart-sync-error', {
          error: 'Access denied to cart',
          cartId
        })
        return
      }

      // Get current cart data
      const cart = await cartService.getCartById(cartId)

      // Check if cart has been updated since last sync
      const lastSync = lastSyncAt ? new Date(lastSyncAt) : new Date(0)
      const isOutdated = cart.updatedAt > lastSync

      if (isOutdated) {
        // Send full cart data if outdated
        socket.emit('cart-sync-response', {
          type: 'FULL_SYNC',
          cartId,
          cart,
          syncAt: new Date(),
          message: 'Cart data synchronized'
        })
        
        logger.debug(`Full cart sync sent to socket ${socket.id} for cart ${cartId}`)
      } else {
        // Send acknowledgment if up to date
        socket.emit('cart-sync-response', {
          type: 'UP_TO_DATE',
          cartId,
          syncAt: new Date(),
          message: 'Cart is up to date'
        })
        
        logger.debug(`Cart up-to-date response sent to socket ${socket.id} for cart ${cartId}`)
      }
    } catch (error) {
      logger.error('Cart sync error:', error)
      socket.emit('cart-sync-error', {
        error: 'Failed to sync cart',
        cartId: data.cartId
      })
    }
  }

  // Handle cart update events
  async handleCartUpdate(event: CartEvent) {
    try {
      const { type, cartId, userId, sessionId, data, timestamp } = event

      // Get updated cart data
      const cart = await cartService.getCartById(cartId)

      // Create broadcast event
      const broadcastEvent = {
        type,
        cartId,
        userId,
        sessionId,
        data: {
          ...data,
          cart,
          totals: cart.totals,
          itemCount: cart.totals.itemCount
        },
        timestamp
      }

      // Import socketServer here to avoid circular dependency
      const { socketServer } = await import('../socketServer')
      
      if (socketServer) {
        socketServer.broadcastCartUpdate(broadcastEvent)
      }

      logger.debug(`Cart update event processed: ${type} for cart ${cartId}`)
    } catch (error) {
      logger.error('Cart update event error:', error)
    }
  }

  // Handle cart item count updates
  async handleCartItemCountUpdate(cartId: string, userId?: string, sessionId?: string) {
    try {
      const cart = await cartService.getCartById(cartId)
      
      // Import socketServer here to avoid circular dependency
      const { socketServer } = await import('../socketServer')
      
      if (socketServer) {
        socketServer.broadcastCartItemCount({
          cartId,
          userId,
          sessionId,
          itemCount: cart.totals.itemCount
        })
      }

      logger.debug(`Cart item count update processed for cart ${cartId}: ${cart.totals.itemCount} items`)
    } catch (error) {
      logger.error('Cart item count update error:', error)
    }
  }

  // Handle stock validation warnings
  async handleStockWarning(data: {
    cartId: string
    userId?: string
    sessionId?: string
    productId: string
    variantId?: string
    availableQuantity: number
    requestedQuantity: number
  }) {
    try {
      // Import socketServer here to avoid circular dependency
      const { socketServer } = await import('../socketServer')
      
      if (socketServer) {
        socketServer.broadcastStockWarning(data)
      }

      logger.warn(`Stock warning processed for cart ${data.cartId}: product ${data.productId}`)
    } catch (error) {
      logger.error('Stock warning error:', error)
    }
  }

  // Verify if socket has access to cart
  private async verifyCartAccess(socket: AuthenticatedSocket, cartId: string): Promise<boolean> {
    try {
      const cart = await cartService.getCartById(cartId)
      
      // Check if user owns the cart
      if (socket.userId && cart.userId === socket.userId) {
        return true
      }

      // Check if session matches
      if (socket.sessionId && cart.sessionId === socket.sessionId) {
        return true
      }

      // For temporary anonymous sessions, allow access if no specific owner
      if (!cart.userId && !cart.sessionId && socket.sessionId?.startsWith('temp_')) {
        return true
      }

      return false
    } catch (error) {
      logger.error('Cart access verification error:', error)
      return false
    }
  }

  // Handle cart expiration notification
  async handleCartExpiration(cartId: string, userId?: string, sessionId?: string) {
    try {
      // Import socketServer here to avoid circular dependency
      const { socketServer } = await import('../socketServer')
      
      if (socketServer) {
        const expirationEvent = {
          type: 'CART_EXPIRED',
          cartId,
          userId,
          sessionId,
          data: {
            message: 'Your cart has expired. Please refresh to continue shopping.',
            cartId
          },
          timestamp: new Date()
        }

        socketServer.broadcastCartUpdate(expirationEvent)
      }

      logger.info(`Cart expiration notification sent for cart ${cartId}`)
    } catch (error) {
      logger.error('Cart expiration notification error:', error)
    }
  }

  // Handle cart merge notification
  async handleCartMerge(data: {
    sourceCartId: string
    targetCartId: string
    userId?: string
    sessionId?: string
  }) {
    try {
      // Import socketServer here to avoid circular dependency
      const { socketServer } = await import('../socketServer')
      
      if (socketServer) {
        const mergeEvent = {
          type: 'CART_MERGED',
          cartId: data.targetCartId,
          userId: data.userId,
          sessionId: data.sessionId,
          data: {
            sourceCartId: data.sourceCartId,
            targetCartId: data.targetCartId,
            message: 'Your carts have been merged successfully'
          },
          timestamp: new Date()
        }

        socketServer.broadcastCartUpdate(mergeEvent)
      }

      logger.info(`Cart merge notification sent: ${data.sourceCartId} -> ${data.targetCartId}`)
    } catch (error) {
      logger.error('Cart merge notification error:', error)
    }
  }
}

export const cartEventHandler = new CartEventHandler()