import { z } from 'zod'

// Order validation schemas
export const CreateOrderSchema = z.object({
  cartId: z.string().cuid('Invalid cart ID'),
  shippingAddressId: z.string().cuid('Invalid shipping address ID'),
  billingAddressId: z.string().cuid('Invalid billing address ID').optional(),
  paymentMethodId: z.string().cuid('Invalid payment method ID').optional(),
  notes: z.string().max(500).optional(),
  metadata: z.record(z.any()).optional(),
})

export const UpdateOrderSchema = z.object({
  status: z.enum([
    'PENDING',
    'CONFIRMED',
    'PROCESSING',
    'SHIPPED',
    'DELIVERED',
    'CANCELLED',
    'REFUNDED',
  ]).optional(),
  trackingNumber: z.string().optional(),
  trackingUrl: z.string().url().optional(),
  notes: z.string().max(500).optional(),
  metadata: z.record(z.any()).optional(),
})

export const OrderQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().min(1)).default('1'),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).default('10'),
  userId: z.string().cuid().optional(),
  status: z.enum([
    'PENDING',
    'CONFIRMED',
    'PROCESSING',
    'SHIPPED',
    'DELIVERED',
    'CANCELLED',
    'REFUNDED',
  ]).optional(),
  orderNumber: z.string().optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'total', 'status']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

export const OrderParamsSchema = z.object({
  id: z.string().cuid('Invalid order ID'),
})

export const OrderItemParamsSchema = z.object({
  orderId: z.string().cuid('Invalid order ID'),
  itemId: z.string().cuid('Invalid item ID'),
})

export const CancelOrderSchema = z.object({
  reason: z.enum([
    'CUSTOMER_REQUEST',
    'OUT_OF_STOCK',
    'PRICING_ERROR',
    'FRAUD_DETECTED',
    'OTHER',
  ]),
  description: z.string().max(500).optional(),
})

export const RefundOrderSchema = z.object({
  amount: z.number().positive('Refund amount must be positive'),
  reason: z.enum([
    'DAMAGED_PRODUCT',
    'WRONG_PRODUCT',
    'NOT_AS_DESCRIBED',
    'CUSTOMER_REQUEST',
    'OTHER',
  ]),
  description: z.string().max(500).optional(),
})

export const UpdateShippingSchema = z.object({
  trackingNumber: z.string().min(1, 'Tracking number is required'),
  trackingUrl: z.string().url('Invalid tracking URL').optional(),
  carrier: z.string().min(1, 'Carrier name is required'),
  estimatedDeliveryDate: z.string().datetime().optional(),
})

export const OrderTimelineEventSchema = z.object({
  type: z.enum([
    'ORDER_CREATED',
    'ORDER_CONFIRMED',
    'PAYMENT_PROCESSED',
    'ORDER_PROCESSING',
    'ORDER_SHIPPED',
    'ORDER_DELIVERED',
    'ORDER_CANCELLED',
    'ORDER_REFUNDED',
    'NOTE_ADDED',
    'STATUS_CHANGED',
  ]),
  description: z.string(),
  metadata: z.record(z.any()).optional(),
})

// Response type definitions
export type CreateOrderInput = z.infer<typeof CreateOrderSchema>
export type UpdateOrderInput = z.infer<typeof UpdateOrderSchema>
export type OrderQueryInput = z.infer<typeof OrderQuerySchema>
export type OrderParamsInput = z.infer<typeof OrderParamsSchema>
export type OrderItemParamsInput = z.infer<typeof OrderItemParamsSchema>
export type CancelOrderInput = z.infer<typeof CancelOrderSchema>
export type RefundOrderInput = z.infer<typeof RefundOrderSchema>
export type UpdateShippingInput = z.infer<typeof UpdateShippingSchema>
export type OrderTimelineEventInput = z.infer<typeof OrderTimelineEventSchema>

// Order interfaces
export interface OrderTotals {
  subtotal: number
  taxAmount: number
  shippingCost: number
  discountAmount: number
  total: number
  refundedAmount: number
  netTotal: number
  currency: string
}

export interface OrderItemWithDetails {
  id: string
  orderId: string
  productId: string
  variantId?: string
  quantity: number
  unitPrice: number
  totalPrice: number
  discountAmount: number
  taxAmount: number
  product: {
    id: string
    name: string
    slug: string
    sku: string
    images: Array<{
      id: string
      url: string
      alt?: string
      isMain: boolean
    }>
  }
  variant?: {
    id: string
    name: string
    sku: string
    attributes: Record<string, any>
  }
  metadata?: Record<string, any>
  createdAt: Date
  updatedAt: Date
}

export interface OrderAddress {
  id: string
  type: 'SHIPPING' | 'BILLING'
  firstName: string
  lastName: string
  company?: string
  street1: string
  street2?: string
  city: string
  state: string
  postalCode: string
  country: string
  phone?: string
  email?: string
}

export interface OrderWithDetails {
  id: string
  orderNumber: string
  userId: string
  status: string
  items: OrderItemWithDetails[]
  totals: OrderTotals
  shippingAddress: OrderAddress
  billingAddress: OrderAddress
  paymentMethod?: {
    id: string
    type: string
    last4?: string
    brand?: string
  }
  trackingNumber?: string
  trackingUrl?: string
  carrier?: string
  estimatedDeliveryDate?: Date
  actualDeliveryDate?: Date
  notes?: string
  metadata?: Record<string, any>
  createdAt: Date
  updatedAt: Date
}

export interface OrderTimeline {
  id: string
  orderId: string
  type: string
  description: string
  metadata?: Record<string, any>
  createdAt: Date
}

export interface OrderSummary {
  id: string
  orderNumber: string
  status: string
  total: number
  currency: string
  itemCount: number
  createdAt: Date
  customer: {
    id: string
    firstName: string
    lastName: string
    email: string
  } | null
}

export interface OrderStatusCount {
  status: string
  count: number
  totalValue: number
}

export interface OrderAnalytics {
  totalOrders: number
  totalRevenue: number
  averageOrderValue: number
  statusCounts: OrderStatusCount[]
  recentOrders: OrderSummary[]
}

// Order event types for WebSocket
export interface OrderEvent {
  type: 'ORDER_CREATED' | 'ORDER_UPDATED' | 'ORDER_CANCELLED' | 'ORDER_SHIPPED' | 'ORDER_DELIVERED' | 'ORDER_REFUNDED'
  orderId: string
  userId: string
  data: any
  timestamp: Date
}
