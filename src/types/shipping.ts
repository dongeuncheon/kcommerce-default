import { z } from 'zod'

// Shipping validation schemas
export const CalculateRatesSchema = z.object({
  origin: z.object({
    street1: z.string().min(1, 'Origin street address is required'),
    street2: z.string().optional(),
    city: z.string().min(1, 'Origin city is required'),
    state: z.string().min(1, 'Origin state is required'),
    postalCode: z.string().min(1, 'Origin postal code is required'),
    country: z.string().min(2, 'Origin country code is required').max(2),
  }),
  destination: z.object({
    street1: z.string().min(1, 'Destination street address is required'),
    street2: z.string().optional(),
    city: z.string().min(1, 'Destination city is required'),
    state: z.string().min(1, 'Destination state is required'),
    postalCode: z.string().min(1, 'Destination postal code is required'),
    country: z.string().min(2, 'Destination country code is required').max(2),
  }),
  packages: z.array(z.object({
    weight: z.number().positive('Package weight must be positive'),
    weightUnit: z.enum(['lb', 'kg']).default('kg'),
    length: z.number().positive('Package length must be positive'),
    width: z.number().positive('Package width must be positive'),
    height: z.number().positive('Package height must be positive'),
    dimensionUnit: z.enum(['in', 'cm']).default('cm'),
    value: z.number().positive('Package value must be positive'),
    currency: z.string().length(3, 'Currency must be 3 characters').default('USD'),
  })).min(1, 'At least one package is required'),
  services: z.array(z.enum(['STANDARD', 'EXPRESS', 'OVERNIGHT', 'PICKUP', 'DIGITAL'])).optional(),
})

export const CreateShipmentSchema = z.object({
  orderId: z.string().cuid('Invalid order ID'),
  carrier: z.enum(['UPS', 'FEDEX', 'DHL', 'USPS', 'CUSTOM']),
  service: z.enum(['STANDARD', 'EXPRESS', 'OVERNIGHT', 'PICKUP', 'DIGITAL']),
  packageInfo: z.object({
    weight: z.number().positive('Package weight must be positive'),
    weightUnit: z.enum(['lb', 'kg']).default('kg'),
    length: z.number().positive('Package length must be positive'),
    width: z.number().positive('Package width must be positive'),
    height: z.number().positive('Package height must be positive'),
    dimensionUnit: z.enum(['in', 'cm']).default('cm'),
    value: z.number().positive('Package value must be positive'),
    currency: z.string().length(3, 'Currency must be 3 characters').default('USD'),
  }),
  labelFormat: z.enum(['PDF', 'PNG', 'ZPL']).default('PDF'),
  insurance: z.boolean().default(false),
  signature: z.boolean().default(false),
  saturdayDelivery: z.boolean().default(false),
  metadata: z.record(z.any()).optional(),
})

export const UpdateShipmentSchema = z.object({
  status: z.enum([
    'PENDING',
    'PROCESSING',
    'SHIPPED',
    'IN_TRANSIT',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'FAILED_DELIVERY',
    'RETURNED',
    'CANCELLED',
  ]).optional(),
  trackingNumber: z.string().optional(),
  trackingUrl: z.string().url().optional(),
  estimatedDelivery: z.string().datetime().optional(),
  actualDelivery: z.string().datetime().optional(),
  notes: z.string().max(500).optional(),
  metadata: z.record(z.any()).optional(),
})

export const TrackShipmentSchema = z.object({
  trackingNumber: z.string().min(1, 'Tracking number is required'),
  carrier: z.enum(['UPS', 'FEDEX', 'DHL', 'USPS', 'CUSTOM']).optional(),
})

export const ShipmentQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().min(1)).default('1'),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).default('10'),
  orderId: z.string().cuid().optional(),
  carrier: z.enum(['UPS', 'FEDEX', 'DHL', 'USPS', 'CUSTOM']).optional(),
  status: z.enum([
    'PENDING',
    'PROCESSING',
    'SHIPPED',
    'IN_TRANSIT',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'FAILED_DELIVERY',
    'RETURNED',
    'CANCELLED',
  ]).optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'cost', 'status']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

export const ShipmentParamsSchema = z.object({
  id: z.string().cuid('Invalid shipment ID'),
})

export const CarrierWebhookSchema = z.object({
  trackingNumber: z.string().min(1, 'Tracking number is required'),
  status: z.string().min(1, 'Status is required'),
  location: z.string().optional(),
  timestamp: z.string().datetime(),
  description: z.string().optional(),
  metadata: z.record(z.any()).optional(),
})

export const ShippingRuleSchema = z.object({
  name: z.string().min(1, 'Rule name is required'),
  conditions: z.object({
    minWeight: z.number().optional(),
    maxWeight: z.number().optional(),
    minValue: z.number().optional(),
    maxValue: z.number().optional(),
    regions: z.array(z.string()).optional(),
    productCategories: z.array(z.string()).optional(),
    excludeCategories: z.array(z.string()).optional(),
  }),
  actions: z.object({
    freeShipping: z.boolean().default(false),
    flatRate: z.number().optional(),
    percentageDiscount: z.number().min(0).max(100).optional(),
    fixedDiscount: z.number().optional(),
    excludeServices: z.array(z.enum(['STANDARD', 'EXPRESS', 'OVERNIGHT', 'PICKUP', 'DIGITAL'])).optional(),
  }),
  priority: z.number().int().min(1).default(1),
  isActive: z.boolean().default(true),
})

// Response type definitions
export type CalculateRatesInput = z.infer<typeof CalculateRatesSchema>
export type CreateShipmentInput = z.infer<typeof CreateShipmentSchema>
export type UpdateShipmentInput = z.infer<typeof UpdateShipmentSchema>
export type TrackShipmentInput = z.infer<typeof TrackShipmentSchema>
export type ShipmentQueryInput = z.infer<typeof ShipmentQuerySchema>
export type ShipmentParamsInput = z.infer<typeof ShipmentParamsSchema>
export type CarrierWebhookInput = z.infer<typeof CarrierWebhookSchema>
export type ShippingRuleInput = z.infer<typeof ShippingRuleSchema>

// Shipping interfaces
export interface ShippingAddress {
  street1: string
  street2?: string
  city: string
  state: string
  postalCode: string
  country: string
  company?: string
  contact?: {
    name: string
    phone?: string
    email?: string
  }
}

export interface PackageInfo {
  weight: number
  weightUnit: 'lb' | 'kg'
  length: number
  width: number
  height: number
  dimensionUnit: 'in' | 'cm'
  value: number
  currency: string
  description?: string
  contents?: string[]
}

export interface ShippingRate {
  carrier: string
  service: 'STANDARD' | 'EXPRESS' | 'OVERNIGHT' | 'PICKUP' | 'DIGITAL'
  serviceName: string
  cost: number
  currency: string
  estimatedDays: number
  estimatedDelivery?: Date
  guaranteed: boolean
  insurance?: {
    available: boolean
    cost?: number
  }
  signature?: {
    available: boolean
    cost?: number
  }
  saturdayDelivery?: {
    available: boolean
    cost?: number
  }
  metadata?: Record<string, any>
}

export interface ShipmentWithDetails {
  id: string
  orderId: string
  trackingNumber?: string
  trackingUrl?: string
  carrier: string
  service: string
  serviceName: string
  status: string
  cost: number
  currency: string
  estimatedDelivery?: Date
  actualDelivery?: Date
  packageInfo: PackageInfo
  labelUrl?: string
  labelFormat?: string
  insurance: boolean
  signature: boolean
  saturdayDelivery: boolean
  notes?: string
  metadata?: Record<string, any>
  createdAt: Date
  updatedAt: Date
  order: {
    id: string
    orderNumber: string
    status: string
  }
}

export interface TrackingEvent {
  id: string
  shipmentId: string
  status: string
  location?: string
  description?: string
  timestamp: Date
  metadata?: Record<string, any>
  createdAt: Date
}

export interface ShipmentTracking {
  trackingNumber: string
  carrier: string
  status: string
  estimatedDelivery?: Date
  actualDelivery?: Date
  events: TrackingEvent[]
  lastUpdated: Date
}

export interface ShippingZone {
  id: string
  name: string
  description?: string
  countries: string[]
  states?: string[]
  postalCodes?: string[]
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface ShippingCarrier {
  id: string
  code: string
  name: string
  logoUrl?: string
  trackingUrlPattern?: string
  apiConfig?: {
    endpoint: string
    apiKey?: string
    accountNumber?: string
    meterNumber?: string
  }
  services: Array<{
    code: string
    name: string
    estimatedDays: number
    maxWeight?: number
    maxDimensions?: {
      length: number
      width: number
      height: number
    }
  }>
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface ShippingRule {
  id: string
  name: string
  description?: string
  conditions: {
    minWeight?: number
    maxWeight?: number
    minValue?: number
    maxValue?: number
    regions?: string[]
    productCategories?: string[]
    excludeCategories?: string[]
  }
  actions: {
    freeShipping: boolean
    flatRate?: number
    percentageDiscount?: number
    fixedDiscount?: number
    excludeServices?: string[]
  }
  priority: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface ShippingSummary {
  id: string
  orderId: string
  orderNumber: string
  trackingNumber?: string
  carrier: string
  service: string
  status: string
  cost: number
  currency: string
  estimatedDelivery?: Date
  createdAt: Date
}

export interface ShippingAnalytics {
  totalShipments: number
  totalCost: number
  averageCost: number
  statusCounts: Array<{
    status: string
    count: number
    totalCost: number
  }>
  carrierCounts: Array<{
    carrier: string
    count: number
    totalCost: number
    averageCost: number
  }>
  recentShipments: ShippingSummary[]
}

// Shipping event types for WebSocket
export interface ShippingEvent {
  type: 'SHIPMENT_CREATED' | 'SHIPMENT_UPDATED' | 'TRACKING_UPDATED' | 'DELIVERY_ATTEMPTED' | 'DELIVERED' | 'EXCEPTION'
  shipmentId: string
  orderId: string
  trackingNumber?: string
  data: any
  timestamp: Date
}

// Error types
export interface ShippingError {
  code: string
  message: string
  details?: Record<string, any>
}

export interface CarrierApiError extends ShippingError {
  carrier: string
  apiResponse?: any
}
