import { z } from 'zod'

// Cart validation schemas
export const CreateCartSchema = z.object({
  userId: z.string().cuid().optional(),
  sessionId: z.string().min(1).optional(),
  currency: z.string().length(3).default('USD'),
  items: z.array(z.object({
    productId: z.string().cuid(),
    variantId: z.string().cuid().optional(),
    quantity: z.number().int().min(1),
  })).optional(),
})

export const UpdateCartSchema = z.object({
  currency: z.string().length(3).optional(),
})

export const AddCartItemSchema = z.object({
  productId: z.string().cuid('Invalid product ID'),
  variantId: z.string().cuid().optional(),
  quantity: z.number().int().min(1, 'Quantity must be at least 1').max(999, 'Quantity cannot exceed 999'),
  options: z.record(z.any()).optional(),
})

export const UpdateCartItemSchema = z.object({
  quantity: z.number().int().min(1, 'Quantity must be at least 1').max(999, 'Quantity cannot exceed 999'),
  options: z.record(z.any()).optional(),
})

export const CartQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().min(1)).default('1'),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).default('10'),
  userId: z.string().cuid().optional(),
  sessionId: z.string().optional(),
  includeExpired: z.string().transform(val => val === 'true').default('false'),
})

export const CartParamsSchema = z.object({
  id: z.string().cuid('Invalid cart ID'),
})

export const CartItemParamsSchema = z.object({
  cartId: z.string().cuid('Invalid cart ID'),
  itemId: z.string().cuid('Invalid item ID'),
})

export const ApplyCouponSchema = z.object({
  couponCode: z.string().min(1, 'Coupon code is required'),
})

export const RemoveCouponSchema = z.object({
  couponId: z.string().cuid('Invalid coupon ID'),
})

export const MergeCartsSchema = z.object({
  sourceCartId: z.string().cuid('Invalid source cart ID'),
  targetCartId: z.string().cuid('Invalid target cart ID'),
})

export const TransferCartSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
  userId: z.string().cuid('Invalid user ID'),
})

// Cart item options schema for flexible product configuration
export const CartItemOptionsSchema = z.object({
  color: z.string().optional(),
  size: z.string().optional(),
  material: z.string().optional(),
  customization: z.string().optional(),
  giftWrap: z.boolean().optional(),
  giftMessage: z.string().optional(),
})

// Cart summary calculation schema
export const CartCalculationSchema = z.object({
  cartId: z.string().cuid(),
  shippingAddress: z.object({
    country: z.string().length(2),
    state: z.string().optional(),
    city: z.string().optional(),
    postalCode: z.string().optional(),
  }).optional(),
  shippingMethod: z.string().optional(),
  taxCalculation: z.boolean().default(true),
})

// Cart item validation for stock check
export const CartItemStockSchema = z.object({
  productId: z.string().cuid(),
  variantId: z.string().cuid().optional(),
  requestedQuantity: z.number().int().min(1),
})

// WebSocket event schemas
export const CartEventSchema = z.object({
  type: z.enum([
    'CART_UPDATED',
    'ITEM_ADDED',
    'ITEM_UPDATED',
    'ITEM_REMOVED',
    'CART_CLEARED',
    'COUPON_APPLIED',
    'COUPON_REMOVED',
  ]),
  cartId: z.string().cuid(),
  userId: z.string().cuid().optional(),
  sessionId: z.string().optional(),
  data: z.any(),
  timestamp: z.date().default(() => new Date()),
})

export const CartSyncSchema = z.object({
  cartId: z.string().cuid(),
  lastSyncAt: z.date().optional(),
  forceSync: z.boolean().default(false),
})

// Response type definitions
export type CreateCartInput = z.infer<typeof CreateCartSchema>
export type UpdateCartInput = z.infer<typeof UpdateCartSchema>
export type AddCartItemInput = z.infer<typeof AddCartItemSchema>
export type UpdateCartItemInput = z.infer<typeof UpdateCartItemSchema>
export type CartQueryInput = z.infer<typeof CartQuerySchema>
export type CartParamsInput = z.infer<typeof CartParamsSchema>
export type CartItemParamsInput = z.infer<typeof CartItemParamsSchema>
export type ApplyCouponInput = z.infer<typeof ApplyCouponSchema>
export type RemoveCouponInput = z.infer<typeof RemoveCouponSchema>
export type MergeCartsInput = z.infer<typeof MergeCartsSchema>
export type TransferCartInput = z.infer<typeof TransferCartSchema>
export type CartItemOptionsInput = z.infer<typeof CartItemOptionsSchema>
export type CartCalculationInput = z.infer<typeof CartCalculationSchema>
export type CartItemStockInput = z.infer<typeof CartItemStockSchema>
export type CartEventInput = z.infer<typeof CartEventSchema>
export type CartSyncInput = z.infer<typeof CartSyncSchema>

// Cart totals interface
export interface CartTotals {
  subtotal: number
  taxAmount: number
  shippingCost: number
  discountAmount: number
  total: number
  itemCount: number
  currency: string
}

// Cart item with calculated fields
export interface CartItemWithDetails {
  id: string
  cartId: string
  productId: string
  variantId?: string
  quantity: number
  unitPrice: number
  totalPrice: number
  product: {
    id: string
    name: string
    slug: string
    sku: string
    price: number
    images: Array<{
      id: string
      url: string
      alt?: string
      isMain: boolean
    }>
    status: string
    trackQuantity: boolean
    quantity: number
  }
  variant?: {
    id: string
    name: string
    sku: string
    price: number
    attributes: Record<string, any>
  }
  options?: Record<string, any>
  isAvailable: boolean
  stockStatus: 'in_stock' | 'low_stock' | 'out_of_stock'
  createdAt: Date
  updatedAt: Date
}

// Complete cart with all relations and calculations
export interface CartWithDetails {
  id: string
  userId?: string
  sessionId?: string
  currency: string
  items: CartItemWithDetails[]
  totals: CartTotals
  appliedCoupons: Array<{
    id: string
    code: string
    name: string
    type: string
    value: number
    discountAmount: number
  }>
  expiresAt?: Date
  isExpired: boolean
  lastActivity: Date
  createdAt: Date
  updatedAt: Date
}

// Stock validation result
export interface StockValidationResult {
  isValid: boolean
  issues: Array<{
    productId: string
    variantId?: string
    requestedQuantity: number
    availableQuantity: number
    message: string
  }>
}

// Cart event for WebSocket
export interface CartEvent {
  type: 'CART_UPDATED' | 'ITEM_ADDED' | 'ITEM_UPDATED' | 'ITEM_REMOVED' | 'CART_CLEARED' | 'COUPON_APPLIED' | 'COUPON_REMOVED'
  cartId: string
  userId?: string
  sessionId?: string
  data: any
  timestamp: Date
}
