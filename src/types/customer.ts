import { z } from 'zod'

// Customer preferences schema
export const CustomerPreferencesSchema = z.object({
  language: z.string().default('en'),
  currency: z.string().default('USD'),
  emailNotifications: z.boolean().default(true),
  smsNotifications: z.boolean().default(false),
  marketingEmails: z.boolean().default(false),
  orderUpdates: z.boolean().default(true),
  newsletter: z.boolean().default(false),
  theme: z.enum(['light', 'dark', 'auto']).default('auto'),
})

// Customer profile schema
export const CustomerProfileSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number').optional(),
  dateOfBirth: z.string().datetime().optional(),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional(),
  avatarUrl: z.string().url().optional(),
})

export const UpdateCustomerProfileSchema = CustomerProfileSchema.partial()

// Address schemas
export const CustomerAddressSchema = z.object({
  type: z.enum(['SHIPPING', 'BILLING', 'BOTH']),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  company: z.string().optional(),
  addressLine1: z.string().min(1, 'Address is required'),
  addressLine2: z.string().optional(),
  city: z.string().min(1, 'City is required'),
  state: z.string().optional(),
  postalCode: z.string().min(1, 'Postal code is required'),
  country: z.string().min(2).max(2, 'Country must be 2-letter ISO code'),
  phone: z.string().optional(),
  isDefault: z.boolean().default(false),
})

export const UpdateCustomerAddressSchema = CustomerAddressSchema.partial().extend({
  id: z.string().cuid(),
})

// Payment method schemas
export const CustomerPaymentMethodSchema = z.object({
  type: z.enum([
    'CREDIT_CARD',
    'DEBIT_CARD',
    'PAYPAL',
    'BANK_TRANSFER',
    'APPLE_PAY',
    'GOOGLE_PAY',
    'CRYPTOCURRENCY',
  ]),
  provider: z.string().min(1, 'Payment provider is required'),
  last4: z.string().length(4).optional(),
  expiryMonth: z.number().int().min(1).max(12).optional(),
  expiryYear: z.number().int().min(new Date().getFullYear()).optional(),
  brand: z.string().optional(),
  isDefault: z.boolean().default(false),
  billingAddressId: z.string().cuid().optional(),
})

export const UpdatePaymentMethodSchema = z.object({
  id: z.string().cuid(),
  isDefault: z.boolean().optional(),
  billingAddressId: z.string().cuid().optional(),
})

// Wishlist schemas
export const AddToWishlistSchema = z.object({
  productId: z.string().cuid('Invalid product ID'),
  notifyOnPriceChange: z.boolean().default(false),
  notifyOnBackInStock: z.boolean().default(false),
})

export const WishlistQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().min(1)).default('1'),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).default('10'),
  sortBy: z.enum(['addedAt', 'productName', 'price']).default('addedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

// Customer activity schemas
export const CustomerActivityQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().min(1)).default('1'),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).default('10'),
  type: z.enum(['order', 'review', 'wishlist', 'cart', 'profile']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
})

// Customer analytics schemas (for admin)
export const CustomerAnalyticsQuerySchema = z.object({
  customerId: z.string().cuid(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
})

// Customer search schema (for admin)
export const CustomerSearchSchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().min(1)).default('1'),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).default('10'),
  search: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  status: z.enum(['active', 'inactive', 'suspended']).optional(),
  role: z.enum(['CUSTOMER', 'ADMIN', 'SUPER_ADMIN']).optional(),
  sortBy: z.enum(['createdAt', 'lastLoginAt', 'totalOrders', 'totalSpent']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  hasOrders: z.string().transform(val => val === 'true').optional(),
  createdAfter: z.string().datetime().optional(),
  createdBefore: z.string().datetime().optional(),
})

// Export types
export type CustomerPreferences = z.infer<typeof CustomerPreferencesSchema>
export type CustomerProfile = z.infer<typeof CustomerProfileSchema>
export type UpdateCustomerProfile = z.infer<typeof UpdateCustomerProfileSchema>
export type CustomerAddress = z.infer<typeof CustomerAddressSchema>
export type UpdateCustomerAddress = z.infer<typeof UpdateCustomerAddressSchema>
export type CustomerPaymentMethod = z.infer<typeof CustomerPaymentMethodSchema>
export type UpdatePaymentMethod = z.infer<typeof UpdatePaymentMethodSchema>
export type AddToWishlist = z.infer<typeof AddToWishlistSchema>
export type WishlistQuery = z.infer<typeof WishlistQuerySchema>
export type CustomerActivityQuery = z.infer<typeof CustomerActivityQuerySchema>
export type CustomerAnalyticsQuery = z.infer<typeof CustomerAnalyticsQuerySchema>
export type CustomerSearch = z.infer<typeof CustomerSearchSchema>

// Customer activity types
export interface CustomerActivity {
  id: string
  type: 'order' | 'review' | 'wishlist' | 'cart' | 'profile'
  action: string
  details: Record<string, any>
  timestamp: Date
  metadata?: Record<string, any>
}

// Customer analytics response
export interface CustomerAnalytics {
  overview: {
    totalOrders: number
    totalSpent: number
    averageOrderValue: number
    lastOrderDate?: Date
    customerSince: Date
    lifetimeValue: number
  }
  orders: {
    count: number
    statuses: Record<string, number>
    monthlySpend: Array<{
      month: string
      amount: number
      orderCount: number
    }>
  }
  products: {
    topCategories: Array<{
      categoryId: string
      categoryName: string
      orderCount: number
      totalSpent: number
    }>
    topProducts: Array<{
      productId: string
      productName: string
      quantity: number
      totalSpent: number
    }>
    recentlyViewed: Array<{
      productId: string
      productName: string
      viewedAt: Date
    }>
  }
  engagement: {
    reviewCount: number
    averageRating: number
    wishlistCount: number
    lastLoginAt?: Date
    loginCount: number
  }
}
