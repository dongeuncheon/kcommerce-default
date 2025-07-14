export interface AnalyticsEvent {
  id: string;
  type: AnalyticsEventType;
  userId?: string;
  sessionId: string;
  timestamp: Date;
  properties: Record<string, any>;
  metadata?: AnalyticsMetadata;
}

export enum AnalyticsEventType {
  // Sales Events - 매출 이벤트
  SALE_COMPLETED = 'sale_completed',
  SALE_CANCELLED = 'sale_cancelled',
  SALE_REFUNDED = 'sale_refunded',
  
  // Product Events - 상품 이벤트
  PRODUCT_VIEWED = 'product_viewed',
  PRODUCT_ADDED_TO_CART = 'product_added_to_cart',
  PRODUCT_REMOVED_FROM_CART = 'product_removed_from_cart',
  PRODUCT_PURCHASED = 'product_purchased',
  
  // Customer Events - 고객 이벤트
  CUSTOMER_REGISTERED = 'customer_registered',
  CUSTOMER_LOGIN = 'customer_login',
  CUSTOMER_LOGOUT = 'customer_logout',
  CUSTOMER_PROFILE_UPDATED = 'customer_profile_updated',
  
  // Order Events - 주문 이벤트
  ORDER_CREATED = 'order_created',
  ORDER_UPDATED = 'order_updated',
  ORDER_CANCELLED = 'order_cancelled',
  ORDER_SHIPPED = 'order_shipped',
  ORDER_DELIVERED = 'order_delivered',
  
  // Payment Events - 결제 이벤트
  PAYMENT_INITIATED = 'payment_initiated',
  PAYMENT_COMPLETED = 'payment_completed',
  PAYMENT_FAILED = 'payment_failed',
  PAYMENT_REFUNDED = 'payment_refunded',
  
  // Shipping Events - 배송 이벤트
  SHIPPING_CALCULATED = 'shipping_calculated',
  SHIPPING_LABEL_CREATED = 'shipping_label_created',
  SHIPPING_DISPATCHED = 'shipping_dispatched',
  SHIPPING_DELIVERED = 'shipping_delivered',
  
  // Marketing Events - 마케팅 이벤트
  EMAIL_OPENED = 'email_opened',
  EMAIL_CLICKED = 'email_clicked',
  PROMOTION_VIEWED = 'promotion_viewed',
  COUPON_USED = 'coupon_used',
  
  // Inventory Events - 재고 이벤트
  INVENTORY_LOW = 'inventory_low',
  INVENTORY_OUT_OF_STOCK = 'inventory_out_of_stock',
  INVENTORY_RESTOCKED = 'inventory_restocked'
}

export interface AnalyticsMetadata {
  source: string;
  version: string;
  userAgent?: string;
  ipAddress?: string;
  location?: GeolocationData;
  deviceInfo?: DeviceInfo;
}

export interface GeolocationData {
  country: string;
  region: string;
  city: string;
  latitude?: number;
  longitude?: number;
}

export interface DeviceInfo {
  type: 'mobile' | 'desktop' | 'tablet';
  os: string;
  browser: string;
  screen: {
    width: number;
    height: number;
  };
}

// Sales Analytics - 매출 통계
export interface SalesAnalytics {
  totalRevenue: number;
  revenueByPeriod: TimeSeriesData[];
  averageOrderValue: number;
  totalOrders: number;
  conversionRate: number;
  revenueByRegion: RegionalData[];
  revenueByPaymentMethod: PaymentMethodData[];
  revenueGrowthRate: number;
  seasonalTrends: SeasonalTrendData[];
  koreanHolidayImpact: HolidayImpactData[];
}

// Product Analytics - 상품 분석
export interface ProductAnalytics {
  topSellingProducts: ProductPerformanceData[];
  productViews: TimeSeriesData[];
  productConversionRates: ProductConversionData[];
  categoryPerformance: CategoryPerformanceData[];
  productReturns: ProductReturnData[];
  inventoryTurnover: InventoryTurnoverData[];
  priceElasticity: PriceElasticityData[];
  productLifecycle: ProductLifecycleData[];
}

// Customer Analytics - 고객 분석
export interface CustomerAnalytics {
  totalCustomers: number;
  newCustomers: TimeSeriesData[];
  customerLifetimeValue: number;
  customerSegments: CustomerSegmentData[];
  retentionRate: number;
  churnRate: number;
  customerAcquisitionCost: number;
  customersByRegion: RegionalData[];
  customerBehaviorPatterns: BehaviorPatternData[];
  loyaltyProgram: LoyaltyProgramData;
}

// Order Analytics - 주문 분석
export interface OrderAnalytics {
  totalOrders: number;
  ordersByStatus: OrderStatusData[];
  averageOrderValue: number;
  orderConversionRate: number;
  cartAbandonmentRate: number;
  ordersByHour: HourlyOrderData[];
  ordersByDay: DailyOrderData[];
  orderFulfillmentTime: FulfillmentTimeData[];
  returnOrders: ReturnOrderData[];
}

// Payment Analytics - 결제 분석
export interface PaymentAnalytics {
  paymentMethodUsage: PaymentMethodData[];
  paymentSuccessRate: number;
  paymentFailureReasons: PaymentFailureData[];
  averagePaymentTime: number;
  chargebackRate: number;
  refundRate: number;
  koreanPaymentMethods: KoreanPaymentMethodData[];
  mobilePay vs DesktopPay: DevicePaymentData[];
}

// Shipping Analytics - 배송 분석
export interface ShippingAnalytics {
  averageDeliveryTime: number;
  shippingCosts: ShippingCostData[];
  deliveryPerformance: DeliveryPerformanceData[];
  shippingProviders: ShippingProviderData[];
  regionalShipping: RegionalShippingData[];
  expeditedShipping: ExpressShippingData[];
  shippingDamages: ShippingDamageData[];
  koreanShippingZones: KoreanShippingZoneData[];
}

// Marketing Analytics - 마케팅 분석
export interface MarketingAnalytics {
  campaignPerformance: CampaignPerformanceData[];
  emailMarketingMetrics: EmailMarketingData;
  socialMediaMetrics: SocialMediaData[];
  seoPerformance: SEOPerformanceData;
  paidAdvertising: PaidAdvertisingData[];
  influencerMarketing: InfluencerMarketingData[];
  contentMarketing: ContentMarketingData[];
  affiliateMarketing: AffiliateMarketingData[];
}

// Inventory Analytics - 재고 분석
export interface InventoryAnalytics {
  stockLevels: StockLevelData[];
  inventoryTurnover: InventoryTurnoverData[];
  stockoutEvents: StockoutEventData[];
  inventoryValue: InventoryValueData[];
  seasonalInventory: SeasonalInventoryData[];
  warehousePerformance: WarehousePerformanceData[];
  supplierPerformance: SupplierPerformanceData[];
  deadStockAnalysis: DeadStockData[];
}

// Dashboard Metrics
export interface DashboardMetrics {
  realTimeSales: RealTimeSalesData;
  topProducts: TopProductData[];
  customerLifetimeValue: number;
  conversionRates: ConversionRateData;
  paymentMethodPerformance: PaymentMethodPerformanceData[];
  regionalSalesDistribution: RegionalSalesData[];
  mobileVsDesktopUsage: DeviceUsageData;
  returnRefundRates: ReturnRefundData;
  recentActivity: RecentActivityData[];
  alerts: AlertData[];
}

// Time-based Analytics
export interface TimeBasedAnalytics {
  dailyReports: DailyReportData[];
  weeklyReports: WeeklyReportData[];
  monthlyReports: MonthlyReportData[];
  yearOverYearComparison: YearOverYearData[];
  seasonalTrends: SeasonalAnalysisData[];
  peakHoursAnalysis: PeakHoursData[];
  koreanHolidayAnalysis: KoreanHolidayAnalysisData[];
  businessHoursAnalysis: BusinessHoursData[];
}

// Supporting Data Types
export interface TimeSeriesData {
  timestamp: Date;
  value: number;
  label?: string;
}

export interface RegionalData {
  region: string;
  value: number;
  percentage: number;
}

export interface PaymentMethodData {
  method: string;
  usage: number;
  successRate: number;
  averageAmount: number;
}

export interface ProductPerformanceData {
  productId: string;
  productName: string;
  sales: number;
  revenue: number;
  views: number;
  conversionRate: number;
  stock: number;
}

export interface CustomerSegmentData {
  segment: string;
  count: number;
  averageValue: number;
  retentionRate: number;
}

export interface OrderStatusData {
  status: string;
  count: number;
  percentage: number;
}

export interface CategoryPerformanceData {
  categoryId: string;
  categoryName: string;
  sales: number;
  revenue: number;
  margin: number;
  growthRate: number;
}

export interface RealTimeSalesData {
  currentHourSales: number;
  todaysSales: number;
  activeUsers: number;
  pendingOrders: number;
  lastUpdated: Date;
}

export interface ConversionRateData {
  overall: number;
  mobile: number;
  desktop: number;
  byChannel: ChannelConversionData[];
}

export interface ChannelConversionData {
  channel: string;
  rate: number;
  traffic: number;
}

export interface DeviceUsageData {
  mobile: {
    sessions: number;
    sales: number;
    conversionRate: number;
  };
  desktop: {
    sessions: number;
    sales: number;
    conversionRate: number;
  };
  tablet: {
    sessions: number;
    sales: number;
    conversionRate: number;
  };
}

export interface ReturnRefundData {
  returnRate: number;
  refundRate: number;
  topReturnReasons: ReturnReasonData[];
  averageProcessingTime: number;
}

export interface ReturnReasonData {
  reason: string;
  count: number;
  percentage: number;
}

export interface AlertData {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  timestamp: Date;
  acknowledged: boolean;
}

export enum AlertType {
  LOW_INVENTORY = 'low_inventory',
  HIGH_CART_ABANDONMENT = 'high_cart_abandonment',
  PAYMENT_FAILURES = 'payment_failures',
  UNUSUAL_ACTIVITY = 'unusual_activity',
  PERFORMANCE_ISSUE = 'performance_issue'
}

export enum AlertSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Korean-specific Data Types
export interface KoreanPaymentMethodData {
  method: 'kakaopay' | 'naverpay' | 'tosspay' | 'bankTransfer' | 'creditCard';
  usage: number;
  successRate: number;
  averageAmount: number;
  marketShare: number;
}

export interface KoreanHolidayAnalysisData {
  holiday: string;
  date: Date;
  salesImpact: number;
  trafficImpact: number;
  comparisonToPrevious: number;
}

export interface KoreanShippingZoneData {
  zone: string;
  deliveryTime: number;
  cost: number;
  popularity: number;
  satisfaction: number;
}

// Report and Export Types
export interface ReportConfiguration {
  type: ReportType;
  dateRange: DateRange;
  metrics: string[];
  filters: ReportFilter[];
  format: ExportFormat;
  schedule?: ReportSchedule;
}

export enum ReportType {
  SALES = 'sales',
  PRODUCTS = 'products',
  CUSTOMERS = 'customers',
  ORDERS = 'orders',
  PAYMENTS = 'payments',
  SHIPPING = 'shipping',
  MARKETING = 'marketing',
  INVENTORY = 'inventory',
  COMPREHENSIVE = 'comprehensive'
}

export interface DateRange {
  start: Date;
  end: Date;
  timezone?: string;
}

export interface ReportFilter {
  field: string;
  operator: FilterOperator;
  value: any;
}

export enum FilterOperator {
  EQUALS = 'equals',
  NOT_EQUALS = 'not_equals',
  GREATER_THAN = 'greater_than',
  LESS_THAN = 'less_than',
  CONTAINS = 'contains',
  IN = 'in',
  NOT_IN = 'not_in'
}

export enum ExportFormat {
  PDF = 'pdf',
  EXCEL = 'excel',
  CSV = 'csv',
  JSON = 'json'
}

export interface ReportSchedule {
  frequency: ScheduleFrequency;
  time: string;
  recipients: string[];
  enabled: boolean;
}

export enum ScheduleFrequency {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly'
}

// API Request/Response Types
export interface AnalyticsQueryParams {
  startDate?: string;
  endDate?: string;
  granularity?: 'hour' | 'day' | 'week' | 'month';
  metrics?: string[];
  dimensions?: string[];
  filters?: ReportFilter[];
  limit?: number;
  offset?: number;
}

export interface AnalyticsResponse<T> {
  data: T;
  metadata: {
    totalRecords: number;
    processedAt: Date;
    cacheDuration: number;
    nextUpdate?: Date;
  };
}

// Cache and Performance Types
export interface AnalyticsCacheConfig {
  ttl: number;
  key: string;
  invalidationTriggers: string[];
}

export interface PerformanceMetrics {
  queryExecutionTime: number;
  dataProcessingTime: number;
  cacheHitRate: number;
  memoryUsage: number;
}

// Additional supporting types
export interface HolidayImpactData {
  holiday: string;
  impact: number;
  comparison: number;
}

export interface SeasonalTrendData {
  season: string;
  trend: number;
  forecast: number;
}

export interface ProductConversionData {
  productId: string;
  conversionRate: number;
  views: number;
  sales: number;
}

export interface ProductReturnData {
  productId: string;
  returnRate: number;
  returnReasons: string[];
}

export interface InventoryTurnoverData {
  productId: string;
  turnoverRate: number;
  daysOnHand: number;
}

export interface PriceElasticityData {
  productId: string;
  elasticity: number;
  optimalPrice: number;
}

export interface ProductLifecycleData {
  productId: string;
  stage: 'introduction' | 'growth' | 'maturity' | 'decline';
  salesTrend: number;
}

export interface BehaviorPatternData {
  pattern: string;
  frequency: number;
  value: number;
}

export interface LoyaltyProgramData {
  totalMembers: number;
  activeMembers: number;
  averagePointsEarned: number;
  redemptionRate: number;
}

export interface HourlyOrderData {
  hour: number;
  orders: number;
  revenue: number;
}

export interface DailyOrderData {
  day: string;
  orders: number;
  revenue: number;
}

export interface FulfillmentTimeData {
  averageTime: number;
  byRegion: RegionalFulfillmentData[];
}

export interface RegionalFulfillmentData {
  region: string;
  averageTime: number;
}

export interface ReturnOrderData {
  totalReturns: number;
  returnRate: number;
  topReasons: ReturnReasonData[];
}

export interface PaymentFailureData {
  reason: string;
  count: number;
  percentage: number;
}

export interface DevicePaymentData {
  device: 'mobile' | 'desktop';
  usage: number;
  successRate: number;
}

export interface ShippingCostData {
  method: string;
  averageCost: number;
  usage: number;
}

export interface DeliveryPerformanceData {
  provider: string;
  onTimeRate: number;
  averageTime: number;
  satisfaction: number;
}

export interface ShippingProviderData {
  provider: string;
  usage: number;
  performance: number;
  cost: number;
}

export interface RegionalShippingData {
  region: string;
  averageTime: number;
  cost: number;
  satisfaction: number;
}

export interface ExpressShippingData {
  usage: number;
  premiumCharge: number;
  satisfaction: number;
}

export interface ShippingDamageData {
  damageRate: number;
  topCauses: string[];
  costImpact: number;
}

export interface CampaignPerformanceData {
  campaignId: string;
  name: string;
  reach: number;
  engagement: number;
  conversion: number;
  roi: number;
}

export interface EmailMarketingData {
  openRate: number;
  clickRate: number;
  unsubscribeRate: number;
  conversionRate: number;
}

export interface SocialMediaData {
  platform: string;
  followers: number;
  engagement: number;
  traffic: number;
  sales: number;
}

export interface SEOPerformanceData {
  organicTraffic: number;
  keywords: number;
  rankings: KeywordRankingData[];
  conversionRate: number;
}

export interface KeywordRankingData {
  keyword: string;
  position: number;
  traffic: number;
}

export interface PaidAdvertisingData {
  platform: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  roi: number;
}

export interface InfluencerMarketingData {
  influencer: string;
  reach: number;
  engagement: number;
  sales: number;
  roi: number;
}

export interface ContentMarketingData {
  contentType: string;
  views: number;
  engagement: number;
  leads: number;
  sales: number;
}

export interface AffiliateMarketingData {
  affiliate: string;
  sales: number;
  commission: number;
  conversionRate: number;
}

export interface StockLevelData {
  productId: string;
  currentStock: number;
  optimalStock: number;
  status: 'low' | 'optimal' | 'overstocked';
}

export interface StockoutEventData {
  productId: string;
  duration: number;
  lostSales: number;
  impact: number;
}

export interface InventoryValueData {
  totalValue: number;
  byCategory: CategoryValueData[];
  deadStock: number;
}

export interface CategoryValueData {
  category: string;
  value: number;
  turnover: number;
}

export interface SeasonalInventoryData {
  season: string;
  demand: number;
  stockLevel: number;
  forecast: number;
}

export interface WarehousePerformanceData {
  warehouseId: string;
  throughput: number;
  accuracy: number;
  cost: number;
}

export interface SupplierPerformanceData {
  supplierId: string;
  deliveryTime: number;
  quality: number;
  cost: number;
  reliability: number;
}

export interface DeadStockData {
  productId: string;
  value: number;
  daysStagnant: number;
  recommendation: string;
}

export interface TopProductData {
  productId: string;
  name: string;
  sales: number;
  revenue: number;
  growth: number;
}

export interface PaymentMethodPerformanceData {
  method: string;
  usage: number;
  successRate: number;
  averageValue: number;
  growth: number;
}

export interface RegionalSalesData {
  region: string;
  sales: number;
  growth: number;
  marketShare: number;
}

export interface RecentActivityData {
  type: string;
  description: string;
  timestamp: Date;
  value?: number;
}

export interface DailyReportData {
  date: Date;
  sales: number;
  orders: number;
  customers: number;
  revenue: number;
}

export interface WeeklyReportData {
  week: string;
  sales: number;
  orders: number;
  customers: number;
  revenue: number;
  growth: number;
}

export interface MonthlyReportData {
  month: string;
  sales: number;
  orders: number;
  customers: number;
  revenue: number;
  growth: number;
  forecast: number;
}

export interface YearOverYearData {
  metric: string;
  currentYear: number;
  previousYear: number;
  growth: number;
}

export interface SeasonalAnalysisData {
  season: string;
  performance: number;
  forecast: number;
  trends: string[];
}

export interface PeakHoursData {
  hour: number;
  activity: number;
  conversion: number;
  revenue: number;
}

export interface BusinessHoursData {
  timeSlot: string;
  activity: number;
  conversion: number;
  efficiency: number;
}