import { orderService } from '../../services/orderService'
import { logger } from '../../utils/logger'
import { OrderEvent } from '../../types/order'

export class OrderEventHandler {
  // Handle order creation event
  async handleOrderCreated(orderId: string, userId: string) {
    try {
      const order = await orderService.getOrderById(orderId)
      
      const orderEvent: OrderEvent = {
        type: 'ORDER_CREATED',
        orderId,
        userId,
        data: {
          order,
          message: `Your order ${order.orderNumber} has been created successfully`,
        },
        timestamp: new Date(),
      }

      // Import socketServer here to avoid circular dependency
      const { socketServer } = await import('../socketServer')
      
      if (socketServer) {
        // Broadcast to user
        socketServer.sendToUser(userId, 'order-created', orderEvent)
        
        // Broadcast to admin users
        this.broadcastToAdmins('order-created', orderEvent)
      }

      logger.debug(`Order created event processed: ${orderId}`)
    } catch (error) {
      logger.error('Order created event error:', error)
    }
  }

  // Handle order status update
  async handleOrderStatusUpdate(orderId: string, previousStatus: string, newStatus: string) {
    try {
      const order = await orderService.getOrderById(orderId)
      
      const orderEvent: OrderEvent = {
        type: 'ORDER_UPDATED',
        orderId,
        userId: order.userId,
        data: {
          order,
          previousStatus,
          newStatus,
          message: this.getStatusUpdateMessage(newStatus, order.orderNumber),
        },
        timestamp: new Date(),
      }

      // Import socketServer here to avoid circular dependency
      const { socketServer } = await import('../socketServer')
      
      if (socketServer) {
        // Broadcast to user
        socketServer.sendToUser(order.userId, 'order-updated', orderEvent)
        
        // Broadcast to admin users
        this.broadcastToAdmins('order-updated', orderEvent)
      }

      logger.debug(`Order status update event processed: ${orderId} - ${previousStatus} -> ${newStatus}`)
    } catch (error) {
      logger.error('Order status update event error:', error)
    }
  }

  // Handle order cancellation
  async handleOrderCancelled(orderId: string, reason: string) {
    try {
      const order = await orderService.getOrderById(orderId)
      
      const orderEvent: OrderEvent = {
        type: 'ORDER_CANCELLED',
        orderId,
        userId: order.userId,
        data: {
          order,
          reason,
          message: `Your order ${order.orderNumber} has been cancelled`,
        },
        timestamp: new Date(),
      }

      // Import socketServer here to avoid circular dependency
      const { socketServer } = await import('../socketServer')
      
      if (socketServer) {
        // Broadcast to user
        socketServer.sendToUser(order.userId, 'order-cancelled', orderEvent)
        
        // Broadcast to admin users
        this.broadcastToAdmins('order-cancelled', orderEvent)
      }

      logger.debug(`Order cancelled event processed: ${orderId}`)
    } catch (error) {
      logger.error('Order cancelled event error:', error)
    }
  }

  // Handle order shipped
  async handleOrderShipped(orderId: string, trackingInfo: any) {
    try {
      const order = await orderService.getOrderById(orderId)
      
      const orderEvent: OrderEvent = {
        type: 'ORDER_SHIPPED',
        orderId,
        userId: order.userId,
        data: {
          order,
          trackingInfo,
          message: `Your order ${order.orderNumber} has been shipped! Track your package: ${trackingInfo.trackingNumber}`,
        },
        timestamp: new Date(),
      }

      // Import socketServer here to avoid circular dependency
      const { socketServer } = await import('../socketServer')
      
      if (socketServer) {
        // Broadcast to user
        socketServer.sendToUser(order.userId, 'order-shipped', orderEvent)
        
        // Broadcast to admin users
        this.broadcastToAdmins('order-shipped', orderEvent)
      }

      logger.debug(`Order shipped event processed: ${orderId}`)
    } catch (error) {
      logger.error('Order shipped event error:', error)
    }
  }

  // Handle order delivered
  async handleOrderDelivered(orderId: string) {
    try {
      const order = await orderService.getOrderById(orderId)
      
      const orderEvent: OrderEvent = {
        type: 'ORDER_DELIVERED',
        orderId,
        userId: order.userId,
        data: {
          order,
          message: `Your order ${order.orderNumber} has been delivered successfully!`,
        },
        timestamp: new Date(),
      }

      // Import socketServer here to avoid circular dependency
      const { socketServer } = await import('../socketServer')
      
      if (socketServer) {
        // Broadcast to user
        socketServer.sendToUser(order.userId, 'order-delivered', orderEvent)
        
        // Broadcast to admin users
        this.broadcastToAdmins('order-delivered', orderEvent)
      }

      logger.debug(`Order delivered event processed: ${orderId}`)
    } catch (error) {
      logger.error('Order delivered event error:', error)
    }
  }

  // Handle order refund
  async handleOrderRefunded(orderId: string, refundAmount: number, isFullRefund: boolean) {
    try {
      const order = await orderService.getOrderById(orderId)
      
      const orderEvent: OrderEvent = {
        type: 'ORDER_REFUNDED',
        orderId,
        userId: order.userId,
        data: {
          order,
          refundAmount,
          isFullRefund,
          message: isFullRefund 
            ? `Your order ${order.orderNumber} has been fully refunded`
            : `A partial refund of ${refundAmount} ${order.totals.currency} has been processed for order ${order.orderNumber}`,
        },
        timestamp: new Date(),
      }

      // Import socketServer here to avoid circular dependency
      const { socketServer } = await import('../socketServer')
      
      if (socketServer) {
        // Broadcast to user
        socketServer.sendToUser(order.userId, 'order-refunded', orderEvent)
        
        // Broadcast to admin users
        this.broadcastToAdmins('order-refunded', orderEvent)
      }

      logger.debug(`Order refunded event processed: ${orderId}`)
    } catch (error) {
      logger.error('Order refunded event error:', error)
    }
  }

  // Broadcast to admin users
  private async broadcastToAdmins(event: string, data: any) {
    try {
      // Get all admin users
      const { prisma } = await import('../../utils/database')
      const adminUsers = await prisma.user.findMany({
        where: {
          role: {
            in: ['ADMIN', 'SUPER_ADMIN'],
          },
          isActive: true,
        },
        select: {
          id: true,
        },
      })

      const { socketServer } = await import('../socketServer')
      
      if (socketServer) {
        // Broadcast to each admin
        adminUsers.forEach(admin => {
          socketServer.sendToUser(admin.id, `admin-${event}`, data)
        })
      }
    } catch (error) {
      logger.error('Error broadcasting to admins:', error)
    }
  }

  // Get status update message
  private getStatusUpdateMessage(status: string, orderNumber: string): string {
    const messages: Record<string, string> = {
      CONFIRMED: `Your order ${orderNumber} has been confirmed`,
      PROCESSING: `Your order ${orderNumber} is being processed`,
      SHIPPED: `Your order ${orderNumber} has been shipped`,
      DELIVERED: `Your order ${orderNumber} has been delivered`,
      CANCELLED: `Your order ${orderNumber} has been cancelled`,
      REFUNDED: `Your order ${orderNumber} has been refunded`,
    }

    return messages[status] || `Your order ${orderNumber} status has been updated to ${status}`
  }
}

export const orderEventHandler = new OrderEventHandler()