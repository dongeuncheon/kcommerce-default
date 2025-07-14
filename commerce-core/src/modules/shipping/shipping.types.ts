/**
 * Shipping Module Type Definitions
 * Comprehensive type system for Korean and international shipping
 */

// Korean shipping provider types
export enum KoreanShippingProvider {
  CJ_LOGISTICS = 'cj_logistics',        // CJ대한통운
  HANJIN = 'hanjin',                    // 한진택배
  LOGEN = 'logen',                      // 로젠택배
  KOREA_POST = 'korea_post',            // 우체국택배
  LOTTE = 'lotte',                      // 롯데택배
  COUPANG_ROCKET = 'coupang_rocket',    // 쿠팡 로켓배송
  DAWN_DELIVERY = 'dawn_delivery'       // 새벽배송
}

// Shipping service types
export enum ShippingServiceType {
  STANDARD = 'standard',        // 일반배송
  EXPRESS = 'express',          // 당일배송
  DAWN = 'dawn',               // 새벽배송
  NEXT_DAY = 'next_day',       // 익일배송
  SAME_DAY = 'same_day'        // 당일배송
}

// Shipping status types
export enum ShippingStatus {
  PENDING = 'pending',
  READY_FOR_PICKUP = 'ready_for_pickup',
  PICKED_UP = 'picked_up',
  IN_TRANSIT = 'in_transit',
  OUT_FOR_DELIVERY = 'out_for_delivery',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  RETURNED = 'returned',
  CANCELLED = 'cancelled'
}

// Package size types
export enum PackageSize {
  SMALL = 'small',      // 소형
  MEDIUM = 'medium',    // 중형
  LARGE = 'large',      // 대형
  EXTRA_LARGE = 'extra_large', // 특대형
  CUSTOM = 'custom'     // 커스텀
}

// Korean address interface
export interface KoreanAddress {
  id?: string;
  postalCode: string;          // 우편번호 (5-digit)
  sido: string;                // 시/도
  sigungu: string;             // 시/군/구
  eupmyeondong: string;        // 읍/면/동
  streetName?: string;         // 도로명
  streetNumber?: string;       // 도로명번호
  buildingName?: string;       // 건물명
  apartmentName?: string;      // 아파트명
  dongNumber?: string;         // 동
  hoNumber?: string;           // 호
  detailAddress?: string;      // 상세주소
  receiverName: string;        // 수령인명
  receiverPhone: string;       // 수령인 전화번호
  deliveryInstructions?: string; // 배송 요청사항
  isDefault?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

// International address interface
export interface InternationalAddress {
  id?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  stateProvince?: string;
  postalCode: string;
  country: string;
  countryCode: string;
  receiverName: string;
  receiverPhone: string;
  receiverEmail?: string;
  deliveryInstructions?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// Shipping zone interface
export interface ShippingZone {
  id: string;
  name: string;
  code: string;
  regions: string[];           // List of regions (시/도)
  baseShippingRate: number;
  additionalRatePerKg: number;
  estimatedDays: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Shipping rate interface
export interface ShippingRate {
  id?: string;
  provider: KoreanShippingProvider;
  serviceType: ShippingServiceType;
  packageSize: PackageSize;
  basePrice: number;
  pricePerKg: number;
  estimatedDays: number;
  cutoffTime?: string;         // 마감시간 (for same-day/dawn delivery)
  availableRegions?: string[]; // Available regions
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

// Shipping calculation request
export interface ShippingCalculationRequest {
  fromAddress: KoreanAddress | InternationalAddress;
  toAddress: KoreanAddress | InternationalAddress;
  items: ShippingItem[];
  serviceType?: ShippingServiceType;
  preferredProviders?: KoreanShippingProvider[];
}

// Shipping item interface
export interface ShippingItem {
  productId: string;
  productName: string;
  quantity: number;
  weight: number;              // in kg
  dimensions?: {
    length: number;            // in cm
    width: number;             // in cm
    height: number;            // in cm
  };
  value: number;               // for insurance
  isFragile?: boolean;
  requiresColdChain?: boolean;
  specialInstructions?: string;
}

// Shipping option interface
export interface ShippingOption {
  id: string;
  provider: KoreanShippingProvider;
  providerName: string;
  serviceType: ShippingServiceType;
  serviceName: string;
  price: number;
  estimatedDeliveryDate: Date;
  cutoffTime?: string;
  trackingAvailable: boolean;
  insuranceAvailable: boolean;
  insurancePrice?: number;
  freeShippingThreshold?: number;
  restrictions?: string[];
}

// Shipping calculation response
export interface ShippingCalculationResponse {
  requestId: string;
  options: ShippingOption[];
  recommendedOption?: ShippingOption;
  freeShippingAvailable: boolean;
  freeShippingThreshold?: number;
  calculatedAt: Date;
}

// Shipment interface
export interface Shipment {
  id: string;
  orderId: string;
  customerId: string;
  provider: KoreanShippingProvider;
  serviceType: ShippingServiceType;
  trackingNumber: string;
  status: ShippingStatus;
  fromAddress: KoreanAddress | InternationalAddress;
  toAddress: KoreanAddress | InternationalAddress;
  items: ShippingItem[];
  packageDetails: {
    weight: number;
    dimensions?: {
      length: number;
      width: number;
      height: number;
    };
    packageCount: number;
  };
  pricing: {
    basePrice: number;
    additionalCharges?: number;
    insurance?: number;
    totalPrice: number;
  };
  dates: {
    createdAt: Date;
    shippedAt?: Date;
    estimatedDeliveryDate: Date;
    actualDeliveryDate?: Date;
  };
  labelUrl?: string;
  invoiceUrl?: string;
  returnShipmentId?: string;
  metadata?: Record<string, any>;
}

// Tracking event interface
export interface TrackingEvent {
  id: string;
  shipmentId: string;
  trackingNumber: string;
  status: ShippingStatus;
  location: string;
  description: string;
  timestamp: Date;
  details?: Record<string, any>;
}

// Tracking response interface
export interface TrackingResponse {
  trackingNumber: string;
  currentStatus: ShippingStatus;
  provider: KoreanShippingProvider;
  shipmentDetails: {
    sender: string;
    receiver: string;
    packageCount: number;
    weight: number;
  };
  events: TrackingEvent[];
  estimatedDeliveryDate?: Date;
  actualDeliveryDate?: Date;
  deliveryProof?: {
    signature?: string;
    photoUrl?: string;
    receivedBy?: string;
    timestamp?: Date;
  };
}

// Shipping label interface
export interface ShippingLabel {
  id: string;
  shipmentId: string;
  trackingNumber: string;
  provider: KoreanShippingProvider;
  labelFormat: 'PDF' | 'PNG' | 'ZPL';
  labelUrl: string;
  labelData?: string;          // Base64 encoded
  createdAt: Date;
  expiresAt?: Date;
}

// Return shipment interface
export interface ReturnShipment {
  id: string;
  originalShipmentId: string;
  returnReason: string;
  status: ShippingStatus;
  trackingNumber: string;
  provider: KoreanShippingProvider;
  fromAddress: KoreanAddress | InternationalAddress;
  toAddress: KoreanAddress | InternationalAddress;
  items: ShippingItem[];
  labelUrl?: string;
  refundAmount?: number;
  createdAt: Date;
  completedAt?: Date;
}

// Shipping provider configuration
export interface ShippingProviderConfig {
  provider: KoreanShippingProvider;
  apiKey?: string;
  apiSecret?: string;
  accountNumber?: string;
  environment: 'production' | 'sandbox';
  webhookUrl?: string;
  supportedServices: ShippingServiceType[];
  features: {
    realTimeTracking: boolean;
    labelGeneration: boolean;
    pickupScheduling: boolean;
    returnShipping: boolean;
    insurance: boolean;
    cashOnDelivery: boolean;
  };
}

// Free shipping rule interface
export interface FreeShippingRule {
  id: string;
  name: string;
  minimumOrderAmount: number;
  applicableRegions?: string[];
  applicableProviders?: KoreanShippingProvider[];
  excludedCategories?: string[];
  startDate?: Date;
  endDate?: Date;
  isActive: boolean;
}

// Shipping estimate request
export interface ShippingEstimateRequest {
  postalCode?: string;
  region?: string;
  items: {
    weight: number;
    quantity: number;
  }[];
}

// Shipping estimate response
export interface ShippingEstimateResponse {
  standardShipping: {
    price: number;
    estimatedDays: number;
  };
  expressShipping?: {
    price: number;
    estimatedDays: number;
  };
  dawnDelivery?: {
    price: number;
    cutoffTime: string;
    available: boolean;
  };
}

// Webhook payload interface
export interface ShippingWebhookPayload {
  event: 'status_update' | 'delivery_completed' | 'delivery_failed' | 'return_requested';
  shipmentId: string;
  trackingNumber: string;
  provider: KoreanShippingProvider;
  timestamp: Date;
  data: Record<string, any>;
}

// Address validation response
export interface AddressValidationResponse {
  isValid: boolean;
  normalizedAddress?: KoreanAddress;
  suggestions?: KoreanAddress[];
  errors?: string[];
}

// Bulk shipping interface
export interface BulkShippingRequest {
  shipments: Array<{
    orderId: string;
    toAddress: KoreanAddress | InternationalAddress;
    items: ShippingItem[];
    serviceType: ShippingServiceType;
  }>;
  provider: KoreanShippingProvider;
}

// Export all types
export * from './shipping.types';