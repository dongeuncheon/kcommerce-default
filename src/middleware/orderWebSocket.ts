import { Request, Response, NextFunction } from 'express'
import { orderEventHandler } from '../socket/handlers/orderEventHandler'
import { logger } from '../utils/logger'

// Enhanced request interface to include order event data
export interface OrderEventRequest extends Request {
  orderEvent?: {
    orderId?: string
    userId?: string
    previousStatus?: string
    newStatus?: string
    trackingInfo?: any
    refundAmount?: number
    isFullRefund?: boolean
  }
}

// Middleware to capture order creation and trigger WebSocket events
export const orderCreatedMiddleware = async (_req: OrderEventRequest, res: Response, next: NextFunction) => {
  // Store original json method
  const originalJson = res.json

  // Override json method to capture response data
  res.json = function(data: any) {
    // Call original json method first
    const result = originalJson.call(this, data)

    // Process order event if response was successful
    if (res.statusCode === 201 && data.success && data.data) {
      const orderData = data.data

      // Handle the order created event asynchronously
      setImmediate(() => {
        orderEventHandler.handleOrderCreated(orderData.id, orderData.userId)
          .catch(error => {
            logger.error('Failed to handle order created event:', error)
          })
      })
    }

    return result
  }

  next()
}

// Middleware to capture order status updates
export const orderUpdatedMiddleware = async (req: OrderEventRequest, res: Response, next: NextFunction) => {
  // Store original json method
  const originalJson = res.json

  // Override json method to capture response data
  res.json = function(data: any) {
    // Call original json method first
    const result = originalJson.call(this, data)

    // Process order event if response was successful
    if (res.statusCode >= 200 && res.statusCode < 300 && data.success && data.data) {
      const orderData = data.data

      // Check if status was updated
      if (req.orderEvent?.previousStatus && req.orderEvent?.newStatus) {
        // Handle the order status update event asynchronously
        setImmediate(() => {
          orderEventHandler.handleOrderStatusUpdate(
            orderData.id,
            req.orderEvent!.previousStatus!,
            req.orderEvent!.newStatus!,
          ).catch(error => {
            logger.error('Failed to handle order status update event:', error)
          })
        })
      }
    }

    return result
  }

  next()
}

// Middleware to capture order cancellation
export const orderCancelledMiddleware = async (req: OrderEventRequest, res: Response, next: NextFunction) => {
  // Store original json method
  const originalJson = res.json

  // Override json method to capture response data
  res.json = function(data: any) {
    // Call original json method first
    const result = originalJson.call(this, data)

    // Process order event if response was successful
    if (res.statusCode >= 200 && res.statusCode < 300 && data.success && data.data) {
      const orderData = data.data
      const reason = req.body.reason || 'Unknown reason'

      // Handle the order cancelled event asynchronously
      setImmediate(() => {
        orderEventHandler.handleOrderCancelled(orderData.id, reason)
          .catch(error => {
            logger.error('Failed to handle order cancelled event:', error)
          })
      })
    }

    return result
  }

  next()
}

// Middleware to capture order shipped
export const orderShippedMiddleware = async (_req: OrderEventRequest, res: Response, next: NextFunction) => {
  // Store original json method
  const originalJson = res.json

  // Override json method to capture response data
  res.json = function(data: any) {
    // Call original json method first
    const result = originalJson.call(this, data)

    // Process order event if response was successful
    if (res.statusCode >= 200 && res.statusCode < 300 && data.success && data.data) {
      const orderData = data.data
      const trackingInfo = {
        trackingNumber: orderData.trackingNumber,
        trackingUrl: orderData.trackingUrl,
        carrier: orderData.carrier,
        estimatedDeliveryDate: orderData.estimatedDeliveryDate,
      }

      // Handle the order shipped event asynchronously
      setImmediate(() => {
        orderEventHandler.handleOrderShipped(orderData.id, trackingInfo)
          .catch(error => {
            logger.error('Failed to handle order shipped event:', error)
          })
      })
    }

    return result
  }

  next()
}

// Middleware to capture order delivered
export const orderDeliveredMiddleware = async (_req: OrderEventRequest, res: Response, next: NextFunction) => {
  // Store original json method
  const originalJson = res.json

  // Override json method to capture response data
  res.json = function(data: any) {
    // Call original json method first
    const result = originalJson.call(this, data)

    // Process order event if response was successful
    if (res.statusCode >= 200 && res.statusCode < 300 && data.success && data.data) {
      const orderData = data.data

      // Handle the order delivered event asynchronously
      setImmediate(() => {
        orderEventHandler.handleOrderDelivered(orderData.id)
          .catch(error => {
            logger.error('Failed to handle order delivered event:', error)
          })
      })
    }

    return result
  }

  next()
}

// Middleware to capture order refund
export const orderRefundedMiddleware = async (req: OrderEventRequest, res: Response, next: NextFunction) => {
  // Store original json method
  const originalJson = res.json

  // Override json method to capture response data
  res.json = function(data: any) {
    // Call original json method first
    const result = originalJson.call(this, data)

    // Process order event if response was successful
    if (res.statusCode >= 200 && res.statusCode < 300 && data.success && data.data) {
      const orderData = data.data
      const refundAmount = req.body.amount || 0
      const isFullRefund = orderData.status === 'REFUNDED'

      // Handle the order refunded event asynchronously
      setImmediate(() => {
        orderEventHandler.handleOrderRefunded(orderData.id, refundAmount, isFullRefund)
          .catch(error => {
            logger.error('Failed to handle order refunded event:', error)
          })
      })
    }

    return result
  }

  next()
}

// Middleware to add order event data to the request
export const addOrderEventData = (data: Partial<OrderEventRequest['orderEvent']>) => {
  return (req: OrderEventRequest, _res: Response, next: NextFunction) => {
    req.orderEvent = { ...req.orderEvent, ...data }
    next()
  }
}

// Middleware to track status changes
export const trackStatusChange = async (req: OrderEventRequest, _res: Response, next: NextFunction) => {
  try {
    // Get current order status before update
    if (req.params.id && req.body.status) {
      const { orderService } = await import('../services/orderService')
      const currentOrder = await orderService.getOrderById(req.params.id)

      if (currentOrder && currentOrder.status !== req.body.status) {
        req.orderEvent = {
          ...req.orderEvent,
          previousStatus: currentOrder.status,
          newStatus: req.body.status,
        }
      }
    }
  } catch (error) {
    // Continue without tracking if error occurs
    logger.debug('Error tracking status change:', error)
  }

  next()
}
