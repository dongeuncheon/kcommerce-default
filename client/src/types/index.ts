export interface Product {
  id: string
  name: string
  slug: string
  description?: string
  shortDescription?: string
  sku: string
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  type: 'SIMPLE' | 'VARIABLE' | 'DIGITAL' | 'GROUPED'
  
  // Pricing
  price: number
  comparePrice?: number
  costPrice?: number
  
  // Inventory
  trackQuantity: boolean
  quantity: number
  lowStockThreshold: number
  allowBackorders: boolean
  
  // Media
  images: ProductImage[]
  
  // Category
  categoryId?: string
  category?: Category
  
  // SEO
  metaTitle?: string
  metaDescription?: string
  metaKeywords?: string
  
  // Dates
  createdAt: string
  updatedAt: string
}

export interface ProductImage {
  id: string
  url: string
  alt?: string
  isPrimary: boolean
  sortOrder: number
}

export interface Category {
  id: string
  name: string
  slug: string
  description?: string
  image?: string
  parentId?: string
  parent?: Category
  children?: Category[]
  isActive: boolean
  sortOrder: number
}

export interface CartItem {
  id: string
  productId: string
  product: Product
  quantity: number
  price: number
  subtotal: number
  metadata?: Record<string, any>
  addedAt: string
}

export interface Cart {
  id: string
  sessionId?: string
  userId?: string
  items: CartItem[]
  subtotal: number
  shipping: number
  tax: number
  discount: number
  total: number
  couponCode?: string
  notes?: string
  expiresAt?: string
  createdAt: string
  updatedAt: string
}

export interface Order {
  id: string
  orderNumber: string
  userId?: string
  status: OrderStatus
  
  // Customer info
  customerEmail: string
  customerFirstName?: string
  customerLastName?: string
  customerPhone?: string
  
  // Items
  items: OrderItem[]
  
  // Amounts
  subtotal: number
  shipping: number
  tax: number
  discount: number
  total: number
  
  // Addresses
  shippingAddressId?: string
  billingAddressId?: string
  shippingAddress?: Address
  billingAddress?: Address
  
  // Payment
  paymentStatus: PaymentStatus
  paymentMethod?: string
  transactionId?: string
  
  // Fulfillment
  fulfillmentStatus: FulfillmentStatus
  trackingNumber?: string
  shippedAt?: string
  deliveredAt?: string
  
  // Other
  notes?: string
  metadata?: Record<string, any>
  createdAt: string
  updatedAt: string
}

export interface OrderItem {
  id: string
  productId: string
  product?: Product
  quantity: number
  price: number
  subtotal: number
  metadata?: Record<string, any>
}

export interface Address {
  id: string
  userId?: string
  type: 'SHIPPING' | 'BILLING' | 'BOTH'
  firstName: string
  lastName: string
  company?: string
  addressLine1: string
  addressLine2?: string
  city: string
  state?: string
  postalCode: string
  country: string
  phone?: string
  isDefault: boolean
}

export type OrderStatus = 
  | 'PENDING'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'REFUNDED'

export type PaymentStatus = 
  | 'PENDING'
  | 'PAID'
  | 'FAILED'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED'

export type FulfillmentStatus = 
  | 'PENDING'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'

export interface User {
  id: string
  email: string
  firstName?: string
  lastName?: string
  phone?: string
  role: 'CUSTOMER' | 'ADMIN' | 'SUPER_ADMIN'
  isActive: boolean
  isVerified: boolean
  createdAt: string
  updatedAt: string
}

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: any
  }
  pagination?: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface FilterOptions {
  search?: string
  category?: string
  minPrice?: number
  maxPrice?: number
  inStock?: boolean
  sortBy?: 'name' | 'price' | 'createdAt'
  sortOrder?: 'asc' | 'desc'
  page?: number
  limit?: number
}