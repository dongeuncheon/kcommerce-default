// Analytics Module - Comprehensive Analytics and Dashboard API System
// Korean E-commerce Analytics Platform

// Core Analytics Components
export { AnalyticsModule } from './analytics.module';
export { AnalyticsService } from './analytics.service';
export { AnalyticsRepository } from './analytics.repository';
export { AnalyticsController } from './analytics.controller';

// Specialized Services
export { DashboardService } from './dashboard.service';
export { ExportService } from './export.service';
export { AlertService } from './alert.service';
export { AnalyticsCacheService } from './cache.service';

// Types and Interfaces
export * from './analytics.types';
export * from './analytics.entity';

// Dashboard Types
export type {
  DashboardWidget,
  DashboardKPI,
  DashboardConfig
} from './dashboard.service';

// Export Types
export type {
  ExportResult,
  ExcelWorksheet,
  PDFTemplate,
  PDFSection
} from './export.service';

// Alert Types
export type {
  AlertConfig,
  AlertCondition,
  AlertAction,
  AlertTrigger,
  AlertStats
} from './alert.service';

// Cache Types
export type {
  CacheStats,
  CacheWarmupConfig
} from './cache.service';

// Re-export commonly used enums
export {
  AnalyticsEventType,
  AlertType,
  AlertSeverity,
  ReportType,
  ExportFormat,
  FilterOperator,
  ScheduleFrequency
} from './analytics.types';

// Constants and Configurations
export const ANALYTICS_MODULE_INFO = {
  name: 'AnalyticsModule',
  version: '1.0.0',
  description: 'Comprehensive analytics and dashboard API system for Korean e-commerce',
  features: [
    'Real-time sales tracking',
    'Product performance analytics',
    'Customer behavior analysis',
    'Korean payment method insights',
    'Holiday impact analysis',
    'Mobile vs desktop usage',
    'Regional sales distribution',
    'Alert system with notifications',
    'Report generation (Excel, PDF, CSV)',
    'Advanced caching for performance',
    'Dashboard widgets and KPIs',
    'Scheduled report generation'
  ],
  koreanFeatures: [
    '카카오페이/네이버페이/토스페이 분석',
    '한국 공휴일 영향 분석',
    '점심시간/야간 쇼핑 패턴',
    '모바일 퍼스트 커머스 지표',
    '소셜 커머스 성과 추적',
    '라이브 쇼핑 매출 분석',
    '지역별 배송 성과',
    '한국 고객 행동 패턴'
  ]
} as const;

// Default Configuration
export const DEFAULT_ANALYTICS_CONFIG = {
  dashboard: {
    refreshInterval: 60000, // 1 minute
    theme: 'light',
    language: 'ko'
  },
  cache: {
    ttl: {
      dashboard: 60, // 1 minute
      sales: 300, // 5 minutes
      products: 600, // 10 minutes
      customers: 900, // 15 minutes
      reports: 3600 // 1 hour
    },
    warmup: {
      enabled: true,
      interval: 300000 // 5 minutes
    }
  },
  alerts: {
    monitoring: {
      enabled: true,
      interval: 60000 // 1 minute
    },
    cooldown: {
      default: 15, // minutes
      critical: 5,
      high: 10,
      medium: 15,
      low: 30
    }
  },
  exports: {
    retention: 24, // hours
    maxFileSize: 50 * 1024 * 1024, // 50MB
    formats: ['excel', 'pdf', 'csv', 'json']
  }
} as const;

// Korean Market Constants
export const KOREAN_MARKET_CONFIG = {
  paymentMethods: [
    { id: 'kakaopay', name: '카카오페이', marketShare: 0.35 },
    { id: 'naverpay', name: '네이버페이', marketShare: 0.28 },
    { id: 'tosspay', name: '토스페이', marketShare: 0.15 },
    { id: 'creditcard', name: '신용카드', marketShare: 0.12 },
    { id: 'banktransfer', name: '계좌이체', marketShare: 0.10 }
  ],
  shippingZones: [
    { id: 'seoul_gyeonggi', name: '서울/경기', deliveryTime: 1.5, popularity: 0.45 },
    { id: 'busan_gyeongnam', name: '부산/경남', deliveryTime: 2.0, popularity: 0.15 },
    { id: 'daegu_gyeongbuk', name: '대구/경북', deliveryTime: 2.2, popularity: 0.12 },
    { id: 'jeju', name: '제주도', deliveryTime: 3.5, popularity: 0.03 }
  ],
  shoppingPatterns: {
    lunchTimeBoost: 2.3, // 2.3x increase during lunch
    lateNightShopping: 1.8, // 1.8x increase 10PM-12AM
    weekendShopping: 1.4, // 1.4x increase on weekends
    holidayImpact: {
      chuseok: 2.0,
      seollal: 1.8,
      blackFriday: 2.8,
      peperoDay: 2.2
    }
  },
  demographics: {
    mobileUsage: 0.87, // 87% mobile usage
    socialCommerceAdoption: 0.45, // 45% social commerce
    liveShoppingParticipation: 0.25 // 25% live shopping
  }
} as const;

// Utility Functions
export const analyticsUtils = {
  /**
   * Generate cache key for analytics data
   */
  generateCacheKey: (type: string, params: Record<string, any>): string => {
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((result, key) => {
        result[key] = params[key];
        return result;
      }, {} as Record<string, any>);
    
    const paramString = Object.keys(sortedParams).length > 0 
      ? `:${Buffer.from(JSON.stringify(sortedParams)).toString('base64')}`
      : '';
    
    return `analytics:${type}${paramString}`;
  },

  /**
   * Format Korean currency
   */
  formatKoreanCurrency: (amount: number): string => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW'
    }).format(amount);
  },

  /**
   * Format percentage for Korean locale
   */
  formatPercentage: (value: number, decimals: number = 1): string => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'percent',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(value);
  },

  /**
   * Get Korean day name
   */
  getKoreanDayName: (date: Date): string => {
    const days = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
    return days[date.getDay()];
  },

  /**
   * Check if date is Korean holiday
   */
  isKoreanHoliday: (date: Date): boolean => {
    const holidays = [
      '01-01', // 신정
      '03-01', // 삼일절
      '05-05', // 어린이날
      '06-06', // 현충일
      '08-15', // 광복절
      '10-03', // 개천절
      '10-09', // 한글날
      '12-25'  // 크리스마스
    ];
    
    const monthDay = date.toISOString().slice(5, 10);
    return holidays.includes(monthDay);
  },

  /**
   * Calculate shopping pattern multiplier
   */
  getShoppingPatternMultiplier: (date: Date): number => {
    const hour = date.getHours();
    const day = date.getDay();
    
    // Weekend boost
    if (day === 0 || day === 6) {
      return KOREAN_MARKET_CONFIG.shoppingPatterns.weekendShopping;
    }
    
    // Lunch time boost (12-13)
    if (hour >= 12 && hour <= 13) {
      return KOREAN_MARKET_CONFIG.shoppingPatterns.lunchTimeBoost;
    }
    
    // Late night shopping (22-24)
    if (hour >= 22) {
      return KOREAN_MARKET_CONFIG.shoppingPatterns.lateNightShopping;
    }
    
    return 1.0;
  }
};

// Example Usage Documentation
export const USAGE_EXAMPLES = {
  basicSetup: `
// Basic Analytics Module Setup
import { AnalyticsModule, AnalyticsService } from './modules/analytics';
import { Container } from './core/di/container';

const container = new Container();
const analyticsModule = new AnalyticsModule(container);
await analyticsModule.initialize();

// Get analytics service
const analyticsService = analyticsModule.getAnalyticsService();
`,

  trackingEvents: `
// Event Tracking
await analyticsService.trackEvent({
  type: AnalyticsEventType.PRODUCT_PURCHASED,
  userId: 'user123',
  sessionId: 'session456',
  properties: {
    productId: 'prod789',
    amount: 89000,
    paymentMethod: 'kakaopay'
  },
  metadata: {
    deviceInfo: { type: 'mobile' },
    location: { region: '서울' }
  }
});
`,

  gettingAnalytics: `
// Get Sales Analytics
const salesAnalytics = await analyticsService.getSalesAnalytics({
  startDate: '2024-01-01',
  endDate: '2024-01-31',
  granularity: 'day'
});

// Get Korean Payment Analytics
const koreanPayments = await analyticsService.getKoreanPaymentAnalytics({
  startDate: '2024-01-01',
  endDate: '2024-01-31'
});
`,

  dashboardUsage: `
// Dashboard Service
const dashboardService = analyticsModule.getDashboardService();

// Get dashboard widgets
const widgets = await dashboardService.getWidgets('user123');

// Get real-time metrics
const realTime = await dashboardService.getRealTimeMetrics();

// Get KPIs
const kpis = await dashboardService.getKPIs();
`,

  exportReports: `
// Export Service
const exportService = analyticsModule.getExportService();

// Generate Excel report
const excelBuffer = await exportService.exportToExcel(salesData, 'sales_report');

// Generate PDF report
const pdfBuffer = await exportService.exportToPDF(dashboardData, pdfTemplate);

// Export to CSV
const csvContent = await exportService.exportToCSV(analyticsData);
`,

  alertConfiguration: `
// Alert Service
const alertService = analyticsModule.getAlertService();

// Configure alert
await alertService.configureAlert({
  alertType: AlertType.LOW_INVENTORY,
  metric: 'inventory_level',
  threshold: 10,
  operator: 'lt',
  severity: AlertSeverity.HIGH,
  enabled: true,
  recipients: ['admin@example.com'],
  cooldownPeriod: 30
});

// Start monitoring
await alertService.startMonitoring();
`
} as const;