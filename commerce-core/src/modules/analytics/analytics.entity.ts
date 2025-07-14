import { BaseEntity } from '../../types/entities/base.entity';

// Analytics Events Table
export interface AnalyticsEventEntity extends BaseEntity {
  id: string;
  type: string; // AnalyticsEventType enum value
  userId?: string;
  sessionId: string;
  timestamp: Date;
  properties: Record<string, any>; // JSON field
  metadata?: Record<string, any>; // JSON field for AnalyticsMetadata
  processed: boolean;
  processedAt?: Date;
}

// Sales Analytics Aggregation Table
export interface SalesAnalyticsEntity extends BaseEntity {
  id: string;
  date: Date;
  granularity: 'hour' | 'day' | 'week' | 'month' | 'year';
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  conversionRate: number;
  region?: string;
  paymentMethod?: string;
  deviceType?: string;
  metadata?: Record<string, any>;
}

// Product Analytics Aggregation Table
export interface ProductAnalyticsEntity extends BaseEntity {
  id: string;
  productId: string;
  date: Date;
  granularity: 'hour' | 'day' | 'week' | 'month' | 'year';
  views: number;
  sales: number;
  revenue: number;
  conversionRate: number;
  returns: number;
  returnRate: number;
  inventoryLevel: number;
  categoryId?: string;
  metadata?: Record<string, any>;
}

// Customer Analytics Aggregation Table
export interface CustomerAnalyticsEntity extends BaseEntity {
  id: string;
  customerId?: string; // null for aggregated data
  date: Date;
  granularity: 'hour' | 'day' | 'week' | 'month' | 'year';
  newCustomers: number;
  activeCustomers: number;
  totalLifetimeValue: number;
  averageLifetimeValue: number;
  retentionRate: number;
  churnRate: number;
  segment?: string;
  region?: string;
  metadata?: Record<string, any>;
}

// Order Analytics Aggregation Table
export interface OrderAnalyticsEntity extends BaseEntity {
  id: string;
  date: Date;
  granularity: 'hour' | 'day' | 'week' | 'month' | 'year';
  totalOrders: number;
  pendingOrders: number;
  shippedOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  returnedOrders: number;
  averageOrderValue: number;
  averageFulfillmentTime: number;
  cartAbandonmentRate: number;
  region?: string;
  metadata?: Record<string, any>;
}

// Payment Analytics Aggregation Table
export interface PaymentAnalyticsEntity extends BaseEntity {
  id: string;
  date: Date;
  granularity: 'hour' | 'day' | 'week' | 'month' | 'year';
  paymentMethod: string;
  totalTransactions: number;
  successfulTransactions: number;
  failedTransactions: number;
  totalAmount: number;
  averageAmount: number;
  successRate: number;
  averageProcessingTime: number;
  chargebacks: number;
  refunds: number;
  metadata?: Record<string, any>;
}

// Shipping Analytics Aggregation Table
export interface ShippingAnalyticsEntity extends BaseEntity {
  id: string;
  date: Date;
  granularity: 'hour' | 'day' | 'week' | 'month' | 'year';
  shippingProvider: string;
  totalShipments: number;
  deliveredOnTime: number;
  averageDeliveryTime: number;
  shippingCost: number;
  damages: number;
  returns: number;
  region?: string;
  shippingMethod?: string;
  metadata?: Record<string, any>;
}

// Marketing Analytics Aggregation Table
export interface MarketingAnalyticsEntity extends BaseEntity {
  id: string;
  campaignId?: string;
  date: Date;
  granularity: 'hour' | 'day' | 'week' | 'month' | 'year';
  channel: string; // email, social, seo, paid, etc.
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  revenue: number;
  clickThroughRate: number;
  conversionRate: number;
  returnOnAdSpend: number;
  costPerAcquisition: number;
  metadata?: Record<string, any>;
}

// Inventory Analytics Aggregation Table
export interface InventoryAnalyticsEntity extends BaseEntity {
  id: string;
  productId: string;
  warehouseId?: string;
  date: Date;
  granularity: 'hour' | 'day' | 'week' | 'month' | 'year';
  stockLevel: number;
  stockIn: number;
  stockOut: number;
  stockValue: number;
  turnoverRate: number;
  daysOfInventory: number;
  stockoutDuration: number;
  lostSales: number;
  optimalStockLevel: number;
  metadata?: Record<string, any>;
}

// Real-time Dashboard Metrics Table
export interface DashboardMetricsEntity extends BaseEntity {
  id: string;
  timestamp: Date;
  currentHourSales: number;
  todaysSales: number;
  activeUsers: number;
  pendingOrders: number;
  conversionRate: number;
  cartAbandonmentRate: number;
  inventoryAlerts: number;
  paymentFailures: number;
  systemPerformance: Record<string, any>; // JSON field
  metadata?: Record<string, any>;
}

// Alert Configuration Table
export interface AlertConfigEntity extends BaseEntity {
  id: string;
  alertType: string; // AlertType enum value
  metric: string;
  threshold: number;
  operator: string; // 'gt', 'lt', 'eq', 'gte', 'lte'
  severity: string; // AlertSeverity enum value
  enabled: boolean;
  recipients: string[]; // JSON array
  cooldownPeriod: number; // minutes
  lastTriggered?: Date;
  metadata?: Record<string, any>;
}

// Alert History Table
export interface AlertHistoryEntity extends BaseEntity {
  id: string;
  alertConfigId: string;
  alertType: string;
  severity: string;
  message: string;
  triggeredAt: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  resolvedAt?: Date;
  resolvedBy?: string;
  value: number;
  threshold: number;
  metadata?: Record<string, any>;
}

// Report Configuration Table
export interface ReportConfigEntity extends BaseEntity {
  id: string;
  name: string;
  type: string; // ReportType enum value
  description?: string;
  configuration: Record<string, any>; // JSON field for ReportConfiguration
  createdBy: string;
  lastGenerated?: Date;
  nextScheduled?: Date;
  enabled: boolean;
  recipients: string[]; // JSON array
  metadata?: Record<string, any>;
}

// Report Execution History Table
export interface ReportExecutionEntity extends BaseEntity {
  id: string;
  reportConfigId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  duration?: number; // milliseconds
  recordCount?: number;
  filePath?: string;
  fileSize?: number;
  error?: string;
  metadata?: Record<string, any>;
}

// Performance Metrics Table
export interface PerformanceMetricsEntity extends BaseEntity {
  id: string;
  operation: string;
  timestamp: Date;
  executionTime: number; // milliseconds
  memoryUsage: number; // bytes
  cpuUsage: number; // percentage
  recordsProcessed: number;
  cacheHitRate: number;
  queryComplexity: number;
  metadata?: Record<string, any>;
}

// Cache Statistics Table
export interface CacheStatisticsEntity extends BaseEntity {
  id: string;
  cacheKey: string;
  timestamp: Date;
  hitCount: number;
  missCount: number;
  evictionCount: number;
  averageLoadTime: number;
  size: number; // bytes
  ttl: number; // seconds
  lastAccessed: Date;
  metadata?: Record<string, any>;
}

// Korean Holiday Impact Table
export interface KoreanHolidayEntity extends BaseEntity {
  id: string;
  holidayName: string;
  holidayDate: Date;
  holidayType: 'national' | 'traditional' | 'lunar' | 'commercial';
  isRecurring: boolean;
  salesImpact: number; // percentage change
  trafficImpact: number; // percentage change
  orderVolumeImpact: number; // percentage change
  year: number;
  metadata?: Record<string, any>;
}

// Session Analytics Table
export interface SessionAnalyticsEntity extends BaseEntity {
  id: string;
  sessionId: string;
  userId?: string;
  startTime: Date;
  endTime?: Date;
  duration?: number; // seconds
  pageViews: number;
  productsViewed: number;
  cartValue: number;
  deviceType: string;
  browserType: string;
  osType: string;
  country: string;
  region: string;
  city: string;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  converted: boolean;
  conversionValue: number;
  metadata?: Record<string, any>;
}

// Cohort Analysis Table
export interface CohortAnalysisEntity extends BaseEntity {
  id: string;
  cohortDate: Date; // The date customers first purchased
  period: number; // Weeks/months since first purchase
  customerCount: number;
  activeCustomers: number;
  retentionRate: number;
  revenue: number;
  averageOrderValue: number;
  orderFrequency: number;
  metadata?: Record<string, any>;
}

// A/B Test Results Table
export interface ABTestResultsEntity extends BaseEntity {
  id: string;
  testId: string;
  testName: string;
  variant: string; // 'A', 'B', 'C', etc.
  startDate: Date;
  endDate?: Date;
  participants: number;
  conversions: number;
  conversionRate: number;
  confidence: number;
  statisticalSignificance: boolean;
  primaryMetric: string;
  primaryMetricValue: number;
  secondaryMetrics: Record<string, number>; // JSON field
  metadata?: Record<string, any>;
}

// Funnel Analysis Table
export interface FunnelAnalysisEntity extends BaseEntity {
  id: string;
  funnelName: string;
  step: number;
  stepName: string;
  date: Date;
  granularity: 'hour' | 'day' | 'week' | 'month';
  users: number;
  conversionRate: number;
  dropoffRate: number;
  averageTimeOnStep: number;
  deviceType?: string;
  userSegment?: string;
  metadata?: Record<string, any>;
}

// Customer Lifetime Value Table
export interface CustomerLTVEntity extends BaseEntity {
  id: string;
  customerId: string;
  calculationDate: Date;
  currentLTV: number;
  predictedLTV: number;
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  orderFrequency: number;
  customerAge: number; // days since first order
  lastOrderDate: Date;
  churnProbability: number;
  segment: string;
  metadata?: Record<string, any>;
}

// Product Recommendation Performance Table
export interface RecommendationPerformanceEntity extends BaseEntity {
  id: string;
  recommendationType: string; // 'related', 'trending', 'personalized', etc.
  productId: string;
  recommendedProductId: string;
  date: Date;
  impressions: number;
  clicks: number;
  clickThroughRate: number;
  conversions: number;
  conversionRate: number;
  revenue: number;
  position: number;
  metadata?: Record<string, any>;
}

// Search Analytics Table
export interface SearchAnalyticsEntity extends BaseEntity {
  id: string;
  searchTerm: string;
  date: Date;
  granularity: 'hour' | 'day' | 'week' | 'month';
  searchCount: number;
  resultCount: number;
  clickThroughRate: number;
  conversionRate: number;
  revenue: number;
  bounceRate: number;
  averagePosition: number;
  noResultsSearches: number;
  metadata?: Record<string, any>;
}

// Database Indexes for Performance
export const ANALYTICS_INDEXES = {
  analytics_events: [
    'CREATE INDEX idx_analytics_events_type_timestamp ON analytics_events(type, timestamp)',
    'CREATE INDEX idx_analytics_events_user_id ON analytics_events(userId)',
    'CREATE INDEX idx_analytics_events_session_id ON analytics_events(sessionId)',
    'CREATE INDEX idx_analytics_events_timestamp ON analytics_events(timestamp)',
    'CREATE INDEX idx_analytics_events_processed ON analytics_events(processed)'
  ],
  sales_analytics: [
    'CREATE INDEX idx_sales_analytics_date_granularity ON sales_analytics(date, granularity)',
    'CREATE INDEX idx_sales_analytics_region ON sales_analytics(region)',
    'CREATE INDEX idx_sales_analytics_payment_method ON sales_analytics(paymentMethod)'
  ],
  product_analytics: [
    'CREATE INDEX idx_product_analytics_product_date ON product_analytics(productId, date)',
    'CREATE INDEX idx_product_analytics_category ON product_analytics(categoryId)',
    'CREATE INDEX idx_product_analytics_date_granularity ON product_analytics(date, granularity)'
  ],
  customer_analytics: [
    'CREATE INDEX idx_customer_analytics_date_granularity ON customer_analytics(date, granularity)',
    'CREATE INDEX idx_customer_analytics_customer_id ON customer_analytics(customerId)',
    'CREATE INDEX idx_customer_analytics_segment ON customer_analytics(segment)'
  ],
  order_analytics: [
    'CREATE INDEX idx_order_analytics_date_granularity ON order_analytics(date, granularity)',
    'CREATE INDEX idx_order_analytics_region ON order_analytics(region)'
  ],
  payment_analytics: [
    'CREATE INDEX idx_payment_analytics_date_method ON payment_analytics(date, paymentMethod)',
    'CREATE INDEX idx_payment_analytics_granularity ON payment_analytics(granularity)'
  ],
  shipping_analytics: [
    'CREATE INDEX idx_shipping_analytics_date_provider ON shipping_analytics(date, shippingProvider)',
    'CREATE INDEX idx_shipping_analytics_region ON shipping_analytics(region)'
  ],
  marketing_analytics: [
    'CREATE INDEX idx_marketing_analytics_campaign_date ON marketing_analytics(campaignId, date)',
    'CREATE INDEX idx_marketing_analytics_channel ON marketing_analytics(channel)'
  ],
  inventory_analytics: [
    'CREATE INDEX idx_inventory_analytics_product_date ON inventory_analytics(productId, date)',
    'CREATE INDEX idx_inventory_analytics_warehouse ON inventory_analytics(warehouseId)'
  ],
  dashboard_metrics: [
    'CREATE INDEX idx_dashboard_metrics_timestamp ON dashboard_metrics(timestamp)'
  ],
  alert_history: [
    'CREATE INDEX idx_alert_history_triggered_at ON alert_history(triggeredAt)',
    'CREATE INDEX idx_alert_history_alert_type ON alert_history(alertType)',
    'CREATE INDEX idx_alert_history_severity ON alert_history(severity)'
  ],
  session_analytics: [
    'CREATE INDEX idx_session_analytics_user_id ON session_analytics(userId)',
    'CREATE INDEX idx_session_analytics_start_time ON session_analytics(startTime)',
    'CREATE INDEX idx_session_analytics_country_region ON session_analytics(country, region)'
  ],
  cohort_analysis: [
    'CREATE INDEX idx_cohort_analysis_cohort_date ON cohort_analysis(cohortDate)',
    'CREATE INDEX idx_cohort_analysis_period ON cohort_analysis(period)'
  ],
  funnel_analysis: [
    'CREATE INDEX idx_funnel_analysis_funnel_step ON funnel_analysis(funnelName, step)',
    'CREATE INDEX idx_funnel_analysis_date ON funnel_analysis(date)'
  ],
  customer_ltv: [
    'CREATE INDEX idx_customer_ltv_customer_id ON customer_ltv(customerId)',
    'CREATE INDEX idx_customer_ltv_calculation_date ON customer_ltv(calculationDate)',
    'CREATE INDEX idx_customer_ltv_segment ON customer_ltv(segment)'
  ],
  search_analytics: [
    'CREATE INDEX idx_search_analytics_term_date ON search_analytics(searchTerm, date)',
    'CREATE INDEX idx_search_analytics_date_granularity ON search_analytics(date, granularity)'
  ]
};

// Database Schema Creation SQL
export const ANALYTICS_SCHEMA_SQL = `
-- Analytics Events Table
CREATE TABLE IF NOT EXISTS analytics_events (
  id VARCHAR(36) PRIMARY KEY,
  type VARCHAR(50) NOT NULL,
  userId VARCHAR(36),
  sessionId VARCHAR(255) NOT NULL,
  timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  properties JSON,
  metadata JSON,
  processed BOOLEAN DEFAULT FALSE,
  processedAt TIMESTAMP NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Sales Analytics Aggregation Table
CREATE TABLE IF NOT EXISTS sales_analytics (
  id VARCHAR(36) PRIMARY KEY,
  date DATE NOT NULL,
  granularity ENUM('hour', 'day', 'week', 'month', 'year') NOT NULL,
  totalRevenue DECIMAL(15,2) DEFAULT 0,
  totalOrders INT DEFAULT 0,
  averageOrderValue DECIMAL(10,2) DEFAULT 0,
  conversionRate DECIMAL(5,4) DEFAULT 0,
  region VARCHAR(100),
  paymentMethod VARCHAR(50),
  deviceType VARCHAR(20),
  metadata JSON,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_sales_aggregation (date, granularity, region, paymentMethod, deviceType)
);

-- Product Analytics Aggregation Table
CREATE TABLE IF NOT EXISTS product_analytics (
  id VARCHAR(36) PRIMARY KEY,
  productId VARCHAR(36) NOT NULL,
  date DATE NOT NULL,
  granularity ENUM('hour', 'day', 'week', 'month', 'year') NOT NULL,
  views INT DEFAULT 0,
  sales INT DEFAULT 0,
  revenue DECIMAL(15,2) DEFAULT 0,
  conversionRate DECIMAL(5,4) DEFAULT 0,
  returns INT DEFAULT 0,
  returnRate DECIMAL(5,4) DEFAULT 0,
  inventoryLevel INT DEFAULT 0,
  categoryId VARCHAR(36),
  metadata JSON,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_product_aggregation (productId, date, granularity)
);

-- Customer Analytics Aggregation Table
CREATE TABLE IF NOT EXISTS customer_analytics (
  id VARCHAR(36) PRIMARY KEY,
  customerId VARCHAR(36),
  date DATE NOT NULL,
  granularity ENUM('hour', 'day', 'week', 'month', 'year') NOT NULL,
  newCustomers INT DEFAULT 0,
  activeCustomers INT DEFAULT 0,
  totalLifetimeValue DECIMAL(15,2) DEFAULT 0,
  averageLifetimeValue DECIMAL(10,2) DEFAULT 0,
  retentionRate DECIMAL(5,4) DEFAULT 0,
  churnRate DECIMAL(5,4) DEFAULT 0,
  segment VARCHAR(50),
  region VARCHAR(100),
  metadata JSON,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Order Analytics Aggregation Table
CREATE TABLE IF NOT EXISTS order_analytics (
  id VARCHAR(36) PRIMARY KEY,
  date DATE NOT NULL,
  granularity ENUM('hour', 'day', 'week', 'month', 'year') NOT NULL,
  totalOrders INT DEFAULT 0,
  pendingOrders INT DEFAULT 0,
  shippedOrders INT DEFAULT 0,
  deliveredOrders INT DEFAULT 0,
  cancelledOrders INT DEFAULT 0,
  returnedOrders INT DEFAULT 0,
  averageOrderValue DECIMAL(10,2) DEFAULT 0,
  averageFulfillmentTime INT DEFAULT 0,
  cartAbandonmentRate DECIMAL(5,4) DEFAULT 0,
  region VARCHAR(100),
  metadata JSON,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Payment Analytics Aggregation Table
CREATE TABLE IF NOT EXISTS payment_analytics (
  id VARCHAR(36) PRIMARY KEY,
  date DATE NOT NULL,
  granularity ENUM('hour', 'day', 'week', 'month', 'year') NOT NULL,
  paymentMethod VARCHAR(50) NOT NULL,
  totalTransactions INT DEFAULT 0,
  successfulTransactions INT DEFAULT 0,
  failedTransactions INT DEFAULT 0,
  totalAmount DECIMAL(15,2) DEFAULT 0,
  averageAmount DECIMAL(10,2) DEFAULT 0,
  successRate DECIMAL(5,4) DEFAULT 0,
  averageProcessingTime INT DEFAULT 0,
  chargebacks INT DEFAULT 0,
  refunds INT DEFAULT 0,
  metadata JSON,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Dashboard Metrics Table
CREATE TABLE IF NOT EXISTS dashboard_metrics (
  id VARCHAR(36) PRIMARY KEY,
  timestamp TIMESTAMP NOT NULL,
  currentHourSales DECIMAL(15,2) DEFAULT 0,
  todaysSales DECIMAL(15,2) DEFAULT 0,
  activeUsers INT DEFAULT 0,
  pendingOrders INT DEFAULT 0,
  conversionRate DECIMAL(5,4) DEFAULT 0,
  cartAbandonmentRate DECIMAL(5,4) DEFAULT 0,
  inventoryAlerts INT DEFAULT 0,
  paymentFailures INT DEFAULT 0,
  systemPerformance JSON,
  metadata JSON,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Alert Configuration Table
CREATE TABLE IF NOT EXISTS alert_config (
  id VARCHAR(36) PRIMARY KEY,
  alertType VARCHAR(50) NOT NULL,
  metric VARCHAR(100) NOT NULL,
  threshold DECIMAL(15,4) NOT NULL,
  operator ENUM('gt', 'lt', 'eq', 'gte', 'lte') NOT NULL,
  severity ENUM('low', 'medium', 'high', 'critical') NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  recipients JSON,
  cooldownPeriod INT DEFAULT 60,
  lastTriggered TIMESTAMP NULL,
  metadata JSON,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Korean Holiday Impact Table
CREATE TABLE IF NOT EXISTS korean_holidays (
  id VARCHAR(36) PRIMARY KEY,
  holidayName VARCHAR(100) NOT NULL,
  holidayDate DATE NOT NULL,
  holidayType ENUM('national', 'traditional', 'lunar', 'commercial') NOT NULL,
  isRecurring BOOLEAN DEFAULT FALSE,
  salesImpact DECIMAL(6,3) DEFAULT 0,
  trafficImpact DECIMAL(6,3) DEFAULT 0,
  orderVolumeImpact DECIMAL(6,3) DEFAULT 0,
  year INT NOT NULL,
  metadata JSON,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
`;