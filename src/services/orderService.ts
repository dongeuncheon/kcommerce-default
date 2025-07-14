import { Prisma, OrderStatus } from '@prisma/client'
import { prisma } from '../utils/database'
import { logger } from '../utils/logger'
import { AppError } from '../middleware/error'
import { cartService } from './cartService'
import {
  CreateOrderInput,
  UpdateOrderInput,
  OrderQueryInput,
  CancelOrderInput,
  RefundOrderInput,
  UpdateShippingInput,
  OrderTimelineEventInput,
  OrderWithDetails,
  OrderItemWithDetails,
  OrderTotals,
  OrderTimeline,
  OrderSummary,
  OrderAnalytics,
  OrderStatusCount,
  OrderAddress,
} from '../types/order'

export class OrderService {
  private readonly ORDER_NUMBER_PREFIX = 'ORD'
  private readonly MAX_REFUND_DAYS = 30

  // Generate unique order number
  private async generateOrderNumber(): Promise<string> {
    const date = new Date()
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')

    // Get today's order count
    const startOfDay = new Date(date.setHours(0, 0, 0, 0))
    const endOfDay = new Date(date.setHours(23, 59, 59, 999))

    const orderCount = await prisma.order.count({
      where: {
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    })

    const sequence = String(orderCount + 1).padStart(4, '0')
    return `${this.ORDER_NUMBER_PREFIX}-${year}${month}${day}-${sequence}`
  }

  // Create order from cart
  async createOrderFromCart(data: CreateOrderInput): Promise<OrderWithDetails> {
    try {
      // Get cart with details
      const cart = await cartService.getCartById(data.cartId)

      if (!cart || cart.items.length === 0) {
        throw new AppError('Cart is empty or not found', 400)
      }

      // Validate cart stock
      const stockValidation = await cartService.validateCartStock(data.cartId)
      if (!stockValidation.isValid) {
        throw new AppError('Some items in cart have insufficient stock', 400)
      }

      // Get addresses
      const [shippingAddress, billingAddress] = await Promise.all([
        prisma.address.findUnique({ where: { id: data.shippingAddressId } }),
        data.billingAddressId
          ? prisma.address.findUnique({ where: { id: data.billingAddressId } })
          : null,
      ])

      if (!shippingAddress) {
        throw new AppError('Shipping address not found', 404)
      }

      const order = await prisma.$transaction(async (tx) => {
        // Generate order number
        const orderNumber = await this.generateOrderNumber()

        // Create order
        const createdOrder = await tx.order.create({
          data: {
            orderNumber,
            userId: cart.userId!,
            status: 'PENDING',
            subtotal: cart.totals.subtotal,
            taxAmount: cart.totals.taxAmount,
            shippingCost: cart.totals.shippingCost,
            discountAmount: cart.totals.discountAmount,
            total: cart.totals.total,
            currency: cart.currency,
            notes: data.notes,
          },
        })

        // Create order items
        await Promise.all(
          cart.items.map(async (cartItem) => {
            const orderItem = await tx.orderItem.create({
              data: {
                orderId: createdOrder.id,
                productId: cartItem.productId,
                variantId: cartItem.variantId,
                quantity: cartItem.quantity,
                price: cartItem.unitPrice,
                total: cartItem.totalPrice,
                options: cartItem.options as Prisma.JsonObject,
              },
            })

            // Update product inventory
            if (cartItem.product.trackQuantity) {
              if (cartItem.variantId && cartItem.variant) {
                await tx.productVariant.update({
                  where: { id: cartItem.variantId },
                  data: {
                    quantity: {
                      decrement: cartItem.quantity,
                    },
                  },
                })
              } else {
                await tx.product.update({
                  where: { id: cartItem.productId },
                  data: {
                    quantity: {
                      decrement: cartItem.quantity,
                    },
                  },
                })
              }

              // Create inventory log
              await tx.inventoryLog.create({
                data: {
                  productId: cartItem.productId,
                  type: 'SALE',
                  quantity: -cartItem.quantity,
                  reason: `Order ${orderNumber}`,
                  reference: createdOrder.id,
                },
              })
            }

            return orderItem
          }),
        )

        // Create shipping address if not exists
        let shippingAddressRecord = null
        if (shippingAddress) {
          // For guest orders, we need to provide a userId. Create a guest user or use a placeholder
          const userIdToUse = cart.userId || 'guest-user-placeholder'
          shippingAddressRecord = await tx.address.create({
            data: {
              userId: userIdToUse,
              type: 'SHIPPING',
              firstName: shippingAddress.firstName,
              lastName: shippingAddress.lastName,
              company: shippingAddress.company,
              addressLine1: shippingAddress.addressLine1,
              addressLine2: shippingAddress.addressLine2,
              city: shippingAddress.city,
              state: shippingAddress.state,
              postalCode: shippingAddress.postalCode,
              country: shippingAddress.country,
              phone: shippingAddress.phone,
            },
          })
        }

        // Create billing address if not exists
        const billingAddressToUse = billingAddress || shippingAddress
        let billingAddressRecord = null
        if (billingAddressToUse) {
          // For guest orders, we need to provide a userId. Create a guest user or use a placeholder
          const userIdToUse = cart.userId || 'guest-user-placeholder'
          billingAddressRecord = await tx.address.create({
            data: {
              userId: userIdToUse,
              type: 'BILLING',
              firstName: billingAddressToUse.firstName,
              lastName: billingAddressToUse.lastName,
              company: billingAddressToUse.company,
              addressLine1: billingAddressToUse.addressLine1,
              addressLine2: billingAddressToUse.addressLine2,
              city: billingAddressToUse.city,
              state: billingAddressToUse.state,
              postalCode: billingAddressToUse.postalCode,
              country: billingAddressToUse.country,
              phone: billingAddressToUse.phone,
            },
          })
        }

        // Update order with address IDs
        await tx.order.update({
          where: { id: createdOrder.id },
          data: {
            shippingAddressId: shippingAddressRecord?.id,
            billingAddressId: billingAddressRecord?.id,
          },
        })

        // Apply coupons from cart to order
        if (cart.appliedCoupons.length > 0) {
          await Promise.all(
            cart.appliedCoupons.map(async (coupon) => {
              await tx.orderCoupon.create({
                data: {
                  orderId: createdOrder.id,
                  couponId: coupon.id,
                  discount: coupon.discountAmount,
                },
              })

              // Update coupon usage
              await tx.coupon.update({
                where: { id: coupon.id },
                data: {
                  usageCount: {
                    increment: 1,
                  },
                },
              })
            }),
          )
        }

        // Create order timeline event
        await this.createTimelineEvent(tx, createdOrder.id, {
          type: 'ORDER_CREATED',
          description: `Order ${orderNumber} created`,
          metadata: {
            itemCount: cart.items.length,
            total: cart.totals.total,
          },
        })

        // Delete the cart after successful order creation
        await tx.cart.delete({
          where: { id: data.cartId },
        })

        return createdOrder
      })

      logger.info(`Order created: ${order.orderNumber} from cart: ${data.cartId}`)
      return this.getOrderWithDetails(order.id)
    } catch (error) {
      logger.error('Error creating order from cart:', error)
      throw error
    }
  }

  // Get order by ID with all details
  async getOrderById(id: string): Promise<OrderWithDetails> {
    return this.getOrderWithDetails(id)
  }

  // Get order by order number
  async getOrderByNumber(orderNumber: string): Promise<OrderWithDetails> {
    const order = await prisma.order.findUnique({
      where: { orderNumber },
    })

    if (!order) {
      throw new AppError('Order not found', 404)
    }

    return this.getOrderWithDetails(order.id)
  }

  // Get user orders
  async getUserOrders(userId: string, query: OrderQueryInput): Promise<{
    orders: OrderWithDetails[]
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
    }
  }> {
    const { page, limit, status, sortBy, sortOrder } = query

    const where: Prisma.OrderWhereInput = {
      userId,
    }

    if (status) {
      where.status = status
    }

    if (query.fromDate || query.toDate) {
      where.createdAt = {}
      if (query.fromDate) {
        where.createdAt.gte = new Date(query.fromDate)
      }
      if (query.toDate) {
        where.createdAt.lte = new Date(query.toDate)
      }
    }

    const skip = (page - 1) * limit

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.order.count({ where }),
    ])

    const ordersWithDetails = await Promise.all(
      orders.map(order => this.getOrderWithDetails(order.id)),
    )

    return {
      orders: ordersWithDetails,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }
  }

  // Get all orders (admin)
  async getOrders(query: OrderQueryInput): Promise<{
    orders: OrderWithDetails[]
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
    }
  }> {
    const { page, limit, userId, status, orderNumber, fromDate, toDate, sortBy, sortOrder } = query

    const where: Prisma.OrderWhereInput = {}

    if (userId) {
      where.userId = userId
    }

    if (status) {
      where.status = status
    }

    if (orderNumber) {
      where.orderNumber = {
        contains: orderNumber,
        mode: 'insensitive',
      }
    }

    if (fromDate || toDate) {
      where.createdAt = {}
      if (fromDate) {
        where.createdAt.gte = new Date(fromDate)
      }
      if (toDate) {
        where.createdAt.lte = new Date(toDate)
      }
    }

    const skip = (page - 1) * limit

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.order.count({ where }),
    ])

    const ordersWithDetails = await Promise.all(
      orders.map(order => this.getOrderWithDetails(order.id)),
    )

    return {
      orders: ordersWithDetails,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }
  }

  // Update order
  async updateOrder(id: string, data: UpdateOrderInput): Promise<OrderWithDetails> {
    const existingOrder = await prisma.order.findUnique({
      where: { id },
    })

    if (!existingOrder) {
      throw new AppError('Order not found', 404)
    }

    // Validate status transition
    if (data.status) {
      this.validateStatusTransition(existingOrder.status as OrderStatus, data.status as OrderStatus)
    }

    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id },
        data: {
          ...data,
          updatedAt: new Date(),
        },
      })

      // Create timeline event for status change
      if (data.status && data.status !== existingOrder.status) {
        await this.createTimelineEvent(tx, id, {
          type: 'STATUS_CHANGED',
          description: `Order status changed from ${existingOrder.status} to ${data.status}`,
          metadata: {
            previousStatus: existingOrder.status,
            newStatus: data.status,
          },
        })
      }
    })

    logger.info(`Order updated: ${id}`)
    return this.getOrderWithDetails(id)
  }

  // Cancel order
  async cancelOrder(id: string, data: CancelOrderInput): Promise<OrderWithDetails> {
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: true,
            variant: true,
          },
        },
      },
    })

    if (!order) {
      throw new AppError('Order not found', 404)
    }

    if (!['PENDING', 'CONFIRMED', 'PROCESSING'].includes(order.status)) {
      throw new AppError('Order cannot be cancelled in current status', 400)
    }

    await prisma.$transaction(async (tx) => {
      // Update order status
      await tx.order.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          notes: `Cancelled: ${data.reason}${data.description ? ` - ${data.description}` : ''}`,
        },
      })

      // Restore inventory
      for (const item of order.items) {
        if (item.product.trackQuantity) {
          if (item.variantId && item.variant) {
            await tx.productVariant.update({
              where: { id: item.variantId },
              data: {
                quantity: {
                  increment: item.quantity,
                },
              },
            })
          } else {
            await tx.product.update({
              where: { id: item.productId },
              data: {
                quantity: {
                  increment: item.quantity,
                },
              },
            })
          }

          // Create inventory log
          await tx.inventoryLog.create({
            data: {
              productId: item.productId,
              type: 'RETURN',
              quantity: item.quantity,
              reason: `Order ${order.orderNumber} cancelled: ${data.reason}`,
              reference: order.id,
            },
          })
        }
      }

      // Create timeline event
      await this.createTimelineEvent(tx, id, {
        type: 'ORDER_CANCELLED',
        description: `Order cancelled: ${data.reason}`,
        metadata: {
          reason: data.reason,
          description: data.description,
        },
      })
    })

    logger.info(`Order cancelled: ${id}, reason: ${data.reason}`)
    return this.getOrderWithDetails(id)
  }

  // Process refund
  async processRefund(id: string, data: RefundOrderInput): Promise<OrderWithDetails> {
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        payments: true,
      },
    })

    if (!order) {
      throw new AppError('Order not found', 404)
    }

    if (!['DELIVERED', 'COMPLETED'].includes(order.status)) {
      throw new AppError('Order cannot be refunded in current status', 400)
    }

    // Check refund period
    const daysSinceDelivery = Math.floor(
      (Date.now() - new Date(order.updatedAt).getTime()) / (1000 * 60 * 60 * 24),
    )

    if (daysSinceDelivery > this.MAX_REFUND_DAYS) {
      throw new AppError(`Refund period of ${this.MAX_REFUND_DAYS} days has expired`, 400)
    }

    // Calculate total refunded amount from payments
    const totalRefunded = order.payments
      .filter(payment => payment.status === 'REFUNDED')
      .reduce((sum, payment) => sum + Number(payment.amount), 0)

    // Validate refund amount
    const maxRefundAmount = Number(order.total) - totalRefunded
    if (data.amount > maxRefundAmount) {
      throw new AppError(`Refund amount exceeds maximum refundable amount of ${maxRefundAmount}`, 400)
    }

    await prisma.$transaction(async (tx) => {
      const isFullRefund = data.amount === maxRefundAmount

      await tx.order.update({
        where: { id },
        data: {
          status: isFullRefund ? 'REFUNDED' : order.status,
          // Note: refundedAmount and metadata fields don't exist in current schema
          // TODO: Add these fields to Order model or track refunds separately
        },
      })

      // Create timeline event (TODO: implement createTimelineEvent)
      // await this.createTimelineEvent(tx, id, {
      //   type: isFullRefund ? 'ORDER_REFUNDED' : 'ORDER_PARTIAL_REFUND',
      //   description: isFullRefund
      //     ? `Order fully refunded: ${data.amount} ${order.currency}`
      //     : `Partial refund processed: ${data.amount} ${order.currency}`,
      //   metadata: {
      //     amount: data.amount,
      //     reason: data.reason,
      //     description: data.description,
      //     isFullRefund,
      //   },
      // })
    })

    logger.info(`Order refund processed: ${id}, amount: ${data.amount}`)
    return this.getOrderWithDetails(id)
  }

  // Update shipping information
  async updateShipping(id: string, data: UpdateShippingInput): Promise<OrderWithDetails> {
    const order = await prisma.order.findUnique({
      where: { id },
    })

    if (!order) {
      throw new AppError('Order not found', 404)
    }

    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id },
        data: {
          status: 'SHIPPED',
          notes: data.trackingNumber ? `Tracking: ${data.trackingNumber}` : undefined,
        },
      })

      // Create timeline event
      await this.createTimelineEvent(tx, id, {
        type: 'ORDER_SHIPPED',
        description: `Order shipped via ${data.carrier}`,
        metadata: {
          trackingNumber: data.trackingNumber,
          carrier: data.carrier,
          estimatedDeliveryDate: data.estimatedDeliveryDate,
        },
      })
    })

    logger.info(`Order shipping updated: ${id}`)
    return this.getOrderWithDetails(id)
  }

  // Mark order as delivered
  async markAsDelivered(id: string): Promise<OrderWithDetails> {
    const order = await prisma.order.findUnique({
      where: { id },
    })

    if (!order) {
      throw new AppError('Order not found', 404)
    }

    if (order.status !== 'SHIPPED') {
      throw new AppError('Only shipped orders can be marked as delivered', 400)
    }

    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id },
        data: {
          status: 'DELIVERED',
        },
      })

      // Create timeline event
      await this.createTimelineEvent(tx, id, {
        type: 'ORDER_DELIVERED',
        description: 'Order delivered successfully',
        metadata: {
          deliveredAt: new Date(),
        },
      })
    })

    logger.info(`Order marked as delivered: ${id}`)
    return this.getOrderWithDetails(id)
  }

  // Get order timeline
  async getOrderTimeline(orderId: string): Promise<OrderTimeline[]> {
    // Use order status history as timeline for now
    const timeline = await prisma.orderStatusHistory.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    })

    return timeline.map(event => ({
      id: event.id,
      orderId: event.orderId,
      type: 'STATUS_CHANGE', // Fixed type since we don't have a type field
      description: `Status changed to ${event.status}${event.notes ? ': ' + event.notes : ''}`,
      metadata: { status: event.status, notes: event.notes },
      createdAt: event.createdAt,
    }))
  }

  // Get order analytics
  async getOrderAnalytics(userId?: string): Promise<OrderAnalytics> {
    const where: Prisma.OrderWhereInput = userId ? { userId } : {}

    // Get total orders and revenue
    const [totalOrders, orderStats] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.aggregate({
        where,
        _sum: {
          total: true,
        },
        _avg: {
          total: true,
        },
      }),
    ])

    // Get status counts
    const statusCounts = await prisma.order.groupBy({
      by: ['status'],
      where,
      _count: {
        status: true,
      },
      _sum: {
        total: true,
      },
    })

    // Get recent orders
    const recentOrders = await prisma.order.findMany({
      where,
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        _count: {
          select: {
            items: true,
          },
        },
      },
    })

    const statusCountsFormatted: OrderStatusCount[] = statusCounts.map(sc => ({
      status: sc.status,
      count: sc._count.status,
      totalValue: sc._sum.total?.toNumber() || 0,
    }))

    const recentOrdersFormatted: OrderSummary[] = recentOrders.map(order => ({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      total: order.total.toNumber(),
      currency: order.currency,
      itemCount: order._count.items,
      createdAt: order.createdAt,
      customer: order.user ? {
        id: order.user.id,
        firstName: order.user.firstName || '',
        lastName: order.user.lastName || '',
        email: order.user.email,
      } : null,
    }))

    return {
      totalOrders,
      totalRevenue: orderStats._sum.total?.toNumber() || 0,
      averageOrderValue: orderStats._avg.total?.toNumber() || 0,
      statusCounts: statusCountsFormatted,
      recentOrders: recentOrdersFormatted,
    }
  }

  // Private helper methods
  private async getOrderWithDetails(orderId: string): Promise<any> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: {
              include: {
                images: {
                  orderBy: { sortOrder: 'asc' },
                },
              },
            },
            variant: true,
          },
        },
        shippingAddress: true,
        billingAddress: true,
        coupons: {
          include: {
            coupon: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    })

    if (!order) {
      throw new AppError('Order not found', 404)
    }

    // Format order items
    const itemsWithDetails: OrderItemWithDetails[] = order.items.map(item => ({
      id: item.id,
      orderId: item.orderId,
      productId: item.productId,
      variantId: item.variantId || undefined,
      quantity: item.quantity,
      unitPrice: item.price.toNumber(),
      totalPrice: item.total.toNumber(),
      discountAmount: 0, // TODO: Calculate from order discounts
      taxAmount: 0, // TODO: Calculate based on tax rules
      product: {
        id: item.product.id,
        name: item.product.name,
        slug: item.product.slug,
        sku: item.product.sku,
        images: item.product.images.map(img => ({
          id: img.id,
          url: img.url,
          alt: img.alt || undefined,
          isMain: img.isMain,
        })),
      },
      variant: item.variant ? {
        id: item.variant.id,
        name: item.variant.name,
        sku: item.variant.sku,
        attributes: item.variant.attributes as Record<string, any>,
      } : undefined,
      metadata: (item.options as Record<string, any>) || {},
      createdAt: item.createdAt,
      updatedAt: item.createdAt, // OrderItem doesn't have updatedAt, use createdAt
    }))

    // Format addresses
    const shippingAddress = order.shippingAddress
    const billingAddress = order.billingAddress

    const formatAddress = (addr: any): OrderAddress | undefined => {
      if (!addr) return undefined
      return ({
        id: addr.id,
        type: addr.type,
        firstName: addr.firstName,
        lastName: addr.lastName,
        company: addr.company || undefined,
        street1: addr.addressLine1,
        street2: addr.addressLine2 || undefined,
        city: addr.city,
        state: addr.state,
        postalCode: addr.postalCode,
        country: addr.country,
        phone: addr.phone || undefined,
      })
    }

    // Calculate totals
    const totals: OrderTotals = {
      subtotal: order.subtotal.toNumber(),
      taxAmount: order.taxAmount.toNumber(),
      shippingCost: order.shippingCost.toNumber(),
      discountAmount: order.discountAmount.toNumber(),
      total: order.total.toNumber(),
      refundedAmount: 0, // TODO: Calculate from payments
      netTotal: order.total.toNumber(),
      currency: order.currency,
    }

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      userId: order.userId || 'guest',
      status: order.status,
      items: itemsWithDetails,
      totals,
      shippingAddress: formatAddress(shippingAddress) || {
        id: 'default',
        type: 'SHIPPING' as const,
        firstName: 'Guest',
        lastName: 'User',
        street1: 'N/A',
        city: 'N/A',
        state: 'N/A',
        postalCode: 'N/A',
        country: 'N/A',
      },
      billingAddress: formatAddress(billingAddress) || {
        id: 'default',
        type: 'BILLING' as const,
        firstName: 'Guest',
        lastName: 'User',
        street1: 'N/A',
        city: 'N/A',
        state: 'N/A',
        postalCode: 'N/A',
        country: 'N/A',
      },
      paymentMethod: undefined, // Will be populated when payment is integrated
      notes: order.notes || undefined,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    }
  }

  private validateStatusTransition(currentStatus: OrderStatus, newStatus: OrderStatus): void {
    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      PENDING: ['CONFIRMED', 'CANCELLED'],
      CONFIRMED: ['PROCESSING', 'CANCELLED'],
      PROCESSING: ['SHIPPED', 'CANCELLED'],
      SHIPPED: ['DELIVERED', 'CANCELLED'],
      DELIVERED: ['REFUNDED'],
      CANCELLED: [],
      REFUNDED: [],
    }

    if (!validTransitions[currentStatus].includes(newStatus)) {
      throw new AppError(
        `Invalid status transition from ${currentStatus} to ${newStatus}`,
        400,
      )
    }
  }

  private async createTimelineEvent(
    tx: any,
    orderId: string,
    event: OrderTimelineEventInput,
  ): Promise<void> {
    await tx.orderTimeline.create({
      data: {
        orderId,
        type: event.type,
        description: event.description,
        metadata: event.metadata as Prisma.JsonObject,
      },
    })
  }
}

export const orderService = new OrderService()
