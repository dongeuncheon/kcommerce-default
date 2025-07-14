import { Request, Response, NextFunction } from 'express'
import { cartEventHandler } from '../socket/handlers/cartEventHandler'
import { CartEvent } from '../types/cart'
import { logger } from '../utils/logger'

// Enhanced request interface to include cart event data
export interface CartEventRequest extends Request {
  cartEvent?: Partial<CartEvent>
}

// Middleware to capture cart operations and trigger WebSocket events
export const cartWebSocketMiddleware = (eventType: CartEvent['type']) => {
  return async (req: CartEventRequest, res: Response, next: NextFunction) => {
    // Store original json method
    const originalJson = res.json

    // Override json method to capture response data
    res.json = function(data: any) {
      // Call original json method first
      const result = originalJson.call(this, data)

      // Process cart event if response was successful
      if (res.statusCode >= 200 && res.statusCode < 300 && data.success && data.data) {
        // Extract cart information from response
        const cartData = data.data

        // Create cart event
        const cartEvent: CartEvent = {
          type: eventType,
          cartId: cartData.id || req.params.id || req.params.cartId,
          userId: cartData.userId,
          sessionId: cartData.sessionId,
          data: {
            cart: cartData,
            ...(req.cartEvent || {}),
          },
          timestamp: new Date(),
        }

        // Handle the cart event asynchronously
        setImmediate(() => {
          cartEventHandler.handleCartUpdate(cartEvent)
            .catch(error => {
              logger.error('Failed to handle cart event:', error)
            })
        })

        // Also handle item count update for relevant events
        if (['ITEM_ADDED', 'ITEM_UPDATED', 'ITEM_REMOVED', 'CART_CLEARED'].includes(eventType)) {
          setImmediate(() => {
            cartEventHandler.handleCartItemCountUpdate(
              cartEvent.cartId,
              cartEvent.userId,
              cartEvent.sessionId,
            ).catch(error => {
              logger.error('Failed to handle cart item count update:', error)
            })
          })
        }
      }

      return result
    }

    next()
  }
}

// Middleware for specific cart operations
export const cartUpdatedMiddleware = cartWebSocketMiddleware('CART_UPDATED')
export const itemAddedMiddleware = cartWebSocketMiddleware('ITEM_ADDED')
export const itemUpdatedMiddleware = cartWebSocketMiddleware('ITEM_UPDATED')
export const itemRemovedMiddleware = cartWebSocketMiddleware('ITEM_REMOVED')
export const cartClearedMiddleware = cartWebSocketMiddleware('CART_CLEARED')
export const couponAppliedMiddleware = cartWebSocketMiddleware('COUPON_APPLIED')
export const couponRemovedMiddleware = cartWebSocketMiddleware('COUPON_REMOVED')

// Middleware to add additional event data to the request
export const addCartEventData = (data: Partial<CartEvent['data']>) => {
  return (req: CartEventRequest, _res: Response, next: NextFunction) => {
    req.cartEvent = { ...req.cartEvent, ...data }
    next()
  }
}

// Middleware to handle stock warnings
export const stockWarningMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  // Store original json method
  const originalJson = res.json

  // Override json method to capture stock validation errors
  res.json = function(data: any) {
    const result = originalJson.call(this, data)

    // Check for stock-related errors
    if (res.statusCode === 400 && data.error?.message?.includes('stock')) {
      const cartId = req.params.id || req.params.cartId
      const { productId, variantId } = req.body

      if (cartId && productId) {
        // Extract stock information from error message or request
        const stockWarningData = {
          cartId,
          productId,
          variantId,
          availableQuantity: 0, // Would need to extract from actual error
          requestedQuantity: req.body.quantity || 1,
        }

        // Handle stock warning asynchronously
        setImmediate(() => {
          cartEventHandler.handleStockWarning(stockWarningData)
            .catch(error => {
              logger.error('Failed to handle stock warning:', error)
            })
        })
      }
    }

    return result
  }

  next()
}

// Middleware to handle cart expiration
export const cartExpirationMiddleware = async (_req: Request, res: Response, next: NextFunction) => {
  // Store original json method
  const originalJson = res.json

  // Override json method to capture expiration errors
  res.json = function(data: any) {
    const result = originalJson.call(this, data)

    // Check for cart expiration errors
    if (res.statusCode === 410 && data.error?.message?.includes('expired')) {
      const cartId = _req.params.id || _req.params.cartId

      if (cartId) {
        // Handle cart expiration notification asynchronously
        setImmediate(() => {
          cartEventHandler.handleCartExpiration(cartId)
            .catch(error => {
              logger.error('Failed to handle cart expiration notification:', error)
            })
        })
      }
    }

    return result
  }

  next()
}
