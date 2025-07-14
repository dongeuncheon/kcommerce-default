/**
 * Shipping Module Database Entities
 * Database schema definitions for shipping system
 */

import { BaseEntity } from '../../types/common';
import {
  KoreanShippingProvider,
  ShippingServiceType,
  ShippingStatus,
  PackageSize,
  KoreanAddress,
  InternationalAddress
} from './shipping.types';

/**
 * Korean Address Entity
 */
export interface KoreanAddressEntity extends BaseEntity {
  customerId?: string;
  postalCode: string;
  sido: string;
  sigungu: string;
  eupmyeondong: string;
  streetName?: string;
  streetNumber?: string;
  buildingName?: string;
  apartmentName?: string;
  dongNumber?: string;
  hoNumber?: string;
  detailAddress?: string;
  receiverName: string;
  receiverPhone: string;
  deliveryInstructions?: string;
  isDefault: boolean;
}

/**
 * International Address Entity
 */
export interface InternationalAddressEntity extends BaseEntity {
  customerId?: string;
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
}

/**
 * Shipping Zone Entity
 */
export interface ShippingZoneEntity extends BaseEntity {
  name: string;
  code: string;
  regions: string[];
  baseShippingRate: number;
  additionalRatePerKg: number;
  estimatedDays: number;
  isActive: boolean;
}

/**
 * Shipping Rate Entity
 */
export interface ShippingRateEntity extends BaseEntity {
  provider: KoreanShippingProvider;
  serviceType: ShippingServiceType;
  packageSize: PackageSize;
  zoneId?: string;
  basePrice: number;
  pricePerKg: number;
  estimatedMinDays: number;
  estimatedMaxDays: number;
  cutoffTime?: string;
  availableRegions: string[];
  minWeight?: number;
  maxWeight?: number;
  isActive: boolean;
}

/**
 * Shipment Entity
 */
export interface ShipmentEntity extends BaseEntity {
  orderId: string;
  customerId: string;
  provider: KoreanShippingProvider;
  serviceType: ShippingServiceType;
  trackingNumber: string;
  status: ShippingStatus;
  
  // Address IDs
  fromAddressId: string;
  fromAddressType: 'korean' | 'international';
  toAddressId: string;
  toAddressType: 'korean' | 'international';
  
  // Package details
  packageWeight: number;
  packageLength?: number;
  packageWidth?: number;
  packageHeight?: number;
  packageCount: number;
  packageSize: PackageSize;
  
  // Pricing
  basePrice: number;
  additionalCharges?: number;
  insuranceAmount?: number;
  totalPrice: number;
  
  // Dates
  shippedAt?: Date;
  estimatedDeliveryDate: Date;
  actualDeliveryDate?: Date;
  
  // URLs
  labelUrl?: string;
  invoiceUrl?: string;
  
  // Return shipment
  returnShipmentId?: string;
  isReturn: boolean;
  originalShipmentId?: string;
  
  // Additional data
  metadata?: Record<string, any>;
}

/**
 * Shipment Item Entity
 */
export interface ShipmentItemEntity extends BaseEntity {
  shipmentId: string;
  productId: string;
  productName: string;
  quantity: number;
  weight: number;
  length?: number;
  width?: number;
  height?: number;
  value: number;
  isFragile: boolean;
  requiresColdChain: boolean;
  specialInstructions?: string;
}

/**
 * Tracking Event Entity
 */
export interface TrackingEventEntity extends BaseEntity {
  shipmentId: string;
  trackingNumber: string;
  status: ShippingStatus;
  location: string;
  description: string;
  eventTimestamp: Date;
  details?: Record<string, any>;
}

/**
 * Shipping Label Entity
 */
export interface ShippingLabelEntity extends BaseEntity {
  shipmentId: string;
  trackingNumber: string;
  provider: KoreanShippingProvider;
  labelFormat: 'PDF' | 'PNG' | 'ZPL';
  labelUrl: string;
  labelData?: string;
  expiresAt?: Date;
}

/**
 * Free Shipping Rule Entity
 */
export interface FreeShippingRuleEntity extends BaseEntity {
  name: string;
  description?: string;
  minimumOrderAmount: number;
  applicableRegions?: string[];
  applicableProviders?: KoreanShippingProvider[];
  excludedCategories?: string[];
  excludedProducts?: string[];
  startDate?: Date;
  endDate?: Date;
  priority: number;
  isActive: boolean;
}

/**
 * Shipping Provider Configuration Entity
 */
export interface ShippingProviderConfigEntity extends BaseEntity {
  provider: KoreanShippingProvider;
  displayName: string;
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
  apiEndpoints?: {
    tracking?: string;
    shipping?: string;
    label?: string;
  };
  isActive: boolean;
}

/**
 * Delivery Proof Entity
 */
export interface DeliveryProofEntity extends BaseEntity {
  shipmentId: string;
  trackingNumber: string;
  deliveredAt: Date;
  signature?: string;
  signatureUrl?: string;
  photoUrl?: string;
  receivedBy?: string;
  deliveryLocation?: string;
  notes?: string;
}

/**
 * Shipping Cache Entity (for performance)
 */
export interface ShippingCacheEntity extends BaseEntity {
  cacheKey: string;
  cacheType: 'rate' | 'zone' | 'tracking' | 'estimate';
  data: Record<string, any>;
  expiresAt: Date;
}

/**
 * Database schema SQL definitions
 */
export const SHIPPING_SCHEMA_SQL = `
-- Korean addresses table
CREATE TABLE IF NOT EXISTS korean_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  postal_code VARCHAR(5) NOT NULL,
  sido VARCHAR(50) NOT NULL,
  sigungu VARCHAR(50) NOT NULL,
  eupmyeondong VARCHAR(50) NOT NULL,
  street_name VARCHAR(100),
  street_number VARCHAR(20),
  building_name VARCHAR(100),
  apartment_name VARCHAR(100),
  dong_number VARCHAR(10),
  ho_number VARCHAR(10),
  detail_address VARCHAR(200),
  receiver_name VARCHAR(100) NOT NULL,
  receiver_phone VARCHAR(20) NOT NULL,
  delivery_instructions TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

-- International addresses table
CREATE TABLE IF NOT EXISTS international_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  address_line1 VARCHAR(200) NOT NULL,
  address_line2 VARCHAR(200),
  city VARCHAR(100) NOT NULL,
  state_province VARCHAR(100),
  postal_code VARCHAR(20) NOT NULL,
  country VARCHAR(100) NOT NULL,
  country_code VARCHAR(2) NOT NULL,
  receiver_name VARCHAR(100) NOT NULL,
  receiver_phone VARCHAR(50) NOT NULL,
  receiver_email VARCHAR(100),
  delivery_instructions TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

-- Shipping zones table
CREATE TABLE IF NOT EXISTS shipping_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  code VARCHAR(20) UNIQUE NOT NULL,
  regions TEXT[] NOT NULL,
  base_shipping_rate DECIMAL(10,2) NOT NULL,
  additional_rate_per_kg DECIMAL(10,2) NOT NULL,
  estimated_days INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Shipping rates table
CREATE TABLE IF NOT EXISTS shipping_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(50) NOT NULL,
  service_type VARCHAR(20) NOT NULL,
  package_size VARCHAR(20) NOT NULL,
  zone_id UUID REFERENCES shipping_zones(id),
  base_price DECIMAL(10,2) NOT NULL,
  price_per_kg DECIMAL(10,2) NOT NULL,
  estimated_min_days INTEGER NOT NULL,
  estimated_max_days INTEGER NOT NULL,
  cutoff_time TIME,
  available_regions TEXT[],
  min_weight DECIMAL(10,3),
  max_weight DECIMAL(10,3),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Shipments table
CREATE TABLE IF NOT EXISTS shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  provider VARCHAR(50) NOT NULL,
  service_type VARCHAR(20) NOT NULL,
  tracking_number VARCHAR(100) UNIQUE NOT NULL,
  status VARCHAR(20) NOT NULL,
  from_address_id UUID NOT NULL,
  from_address_type VARCHAR(20) NOT NULL,
  to_address_id UUID NOT NULL,
  to_address_type VARCHAR(20) NOT NULL,
  package_weight DECIMAL(10,3) NOT NULL,
  package_length DECIMAL(10,2),
  package_width DECIMAL(10,2),
  package_height DECIMAL(10,2),
  package_count INTEGER NOT NULL DEFAULT 1,
  package_size VARCHAR(20) NOT NULL,
  base_price DECIMAL(10,2) NOT NULL,
  additional_charges DECIMAL(10,2),
  insurance_amount DECIMAL(10,2),
  total_price DECIMAL(10,2) NOT NULL,
  shipped_at TIMESTAMP,
  estimated_delivery_date TIMESTAMP NOT NULL,
  actual_delivery_date TIMESTAMP,
  label_url TEXT,
  invoice_url TEXT,
  return_shipment_id UUID REFERENCES shipments(id),
  is_return BOOLEAN DEFAULT false,
  original_shipment_id UUID REFERENCES shipments(id),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Shipment items table
CREATE TABLE IF NOT EXISTS shipment_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES shipments(id),
  product_id UUID NOT NULL,
  product_name VARCHAR(200) NOT NULL,
  quantity INTEGER NOT NULL,
  weight DECIMAL(10,3) NOT NULL,
  length DECIMAL(10,2),
  width DECIMAL(10,2),
  height DECIMAL(10,2),
  value DECIMAL(10,2) NOT NULL,
  is_fragile BOOLEAN DEFAULT false,
  requires_cold_chain BOOLEAN DEFAULT false,
  special_instructions TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tracking events table
CREATE TABLE IF NOT EXISTS tracking_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES shipments(id),
  tracking_number VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL,
  location VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  event_timestamp TIMESTAMP NOT NULL,
  details JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Shipping labels table
CREATE TABLE IF NOT EXISTS shipping_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES shipments(id),
  tracking_number VARCHAR(100) NOT NULL,
  provider VARCHAR(50) NOT NULL,
  label_format VARCHAR(10) NOT NULL,
  label_url TEXT NOT NULL,
  label_data TEXT,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Free shipping rules table
CREATE TABLE IF NOT EXISTS free_shipping_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  minimum_order_amount DECIMAL(10,2) NOT NULL,
  applicable_regions TEXT[],
  applicable_providers VARCHAR(50)[],
  excluded_categories UUID[],
  excluded_products UUID[],
  start_date TIMESTAMP,
  end_date TIMESTAMP,
  priority INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Shipping provider configurations table
CREATE TABLE IF NOT EXISTS shipping_provider_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(50) UNIQUE NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  api_key VARCHAR(200),
  api_secret VARCHAR(200),
  account_number VARCHAR(100),
  environment VARCHAR(20) NOT NULL DEFAULT 'sandbox',
  webhook_url TEXT,
  supported_services VARCHAR(20)[],
  features JSONB NOT NULL,
  api_endpoints JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Delivery proofs table
CREATE TABLE IF NOT EXISTS delivery_proofs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES shipments(id),
  tracking_number VARCHAR(100) NOT NULL,
  delivered_at TIMESTAMP NOT NULL,
  signature TEXT,
  signature_url TEXT,
  photo_url TEXT,
  received_by VARCHAR(100),
  delivery_location VARCHAR(200),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Shipping cache table (for performance)
CREATE TABLE IF NOT EXISTS shipping_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key VARCHAR(200) UNIQUE NOT NULL,
  cache_type VARCHAR(20) NOT NULL,
  data JSONB NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_korean_addresses_customer ON korean_addresses(customer_id);
CREATE INDEX idx_korean_addresses_postal ON korean_addresses(postal_code);
CREATE INDEX idx_international_addresses_customer ON international_addresses(customer_id);
CREATE INDEX idx_shipments_order ON shipments(order_id);
CREATE INDEX idx_shipments_customer ON shipments(customer_id);
CREATE INDEX idx_shipments_tracking ON shipments(tracking_number);
CREATE INDEX idx_shipments_status ON shipments(status);
CREATE INDEX idx_tracking_events_shipment ON tracking_events(shipment_id);
CREATE INDEX idx_tracking_events_tracking ON tracking_events(tracking_number);
CREATE INDEX idx_shipping_cache_key ON shipping_cache(cache_key);
CREATE INDEX idx_shipping_cache_expires ON shipping_cache(expires_at);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_korean_addresses_updated_at BEFORE UPDATE ON korean_addresses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_international_addresses_updated_at BEFORE UPDATE ON international_addresses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shipping_zones_updated_at BEFORE UPDATE ON shipping_zones
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shipping_rates_updated_at BEFORE UPDATE ON shipping_rates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shipments_updated_at BEFORE UPDATE ON shipments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
`;