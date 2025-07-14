import { AnalyticsRepository } from './analytics.repository';
import { AnalyticsCacheService } from './cache.service';
import { LoggerService } from '../../core/services/logger.service';
import {
  DashboardMetrics,
  RealTimeSalesData,
  TopProductData,
  AlertData,
  RecentActivityData,
  ConversionRateData,
  DeviceUsageData,
  RegionalSalesData,
  PaymentMethodPerformanceData,
  ReturnRefundData
} from './analytics.types';

export interface DashboardWidget {
  id: string;
  type: 'metric' | 'chart' | 'table' | 'gauge' | 'map';
  title: string;
  description?: string;
  data: any;
  config: {
    size: 'small' | 'medium' | 'large';
    refreshInterval: number;
    position: { x: number; y: number; w: number; h: number };
  };
  lastUpdated: Date;
}

export interface DashboardKPI {
  id: string;
  name: string;
  value: number;
  previousValue: number;
  change: number;
  changePercent: number;
  trend: 'up' | 'down' | 'stable';
  format: 'number' | 'currency' | 'percentage';
  target?: number;
  unit?: string;
}

export interface DashboardConfig {
  id: string;
  name: string;
  userId: string;
  widgets: DashboardWidget[];
  layout: any;
  settings: {
    autoRefresh: boolean;
    refreshInterval: number;
    theme: 'light' | 'dark';
    language: 'ko' | 'en';
  };
  createdAt: Date;
  updatedAt: Date;
}

export class DashboardService {
  private readonly CACHE_TTL = 300; // 5 minutes
  private readonly REAL_TIME_TTL = 30; // 30 seconds

  constructor(
    private readonly repository: AnalyticsRepository,
    private readonly cacheService: AnalyticsCacheService,
    private readonly logger: LoggerService
  ) {}

  // ================== DASHBOARD WIDGETS ==================

  async getWidgets(userId?: string): Promise<DashboardWidget[]> {
    try {
      const cacheKey = `dashboard:widgets:${userId || 'default'}`;
      
      // Try cache first
      const cached = await this.cacheService.get<DashboardWidget[]>(cacheKey);
      if (cached) {
        return cached;
      }

      // Generate default widgets
      const widgets = await this.generateDefaultWidgets();
      
      // Cache widgets
      await this.cacheService.set(cacheKey, widgets, this.CACHE_TTL);
      
      return widgets;
      
    } catch (error) {
      this.logger.error('Failed to get dashboard widgets', { error, userId });
      throw error;
    }
  }

  async updateWidget(widgetId: string, updates: Partial<DashboardWidget>): Promise<void> {
    try {
      // Implementation for updating widget configuration
      this.logger.info('Widget updated', { widgetId, updates });
      
      // Clear related cache
      await this.cacheService.deletePattern('dashboard:widgets:*');
      
    } catch (error) {
      this.logger.error('Failed to update widget', { error, widgetId, updates });
      throw error;
    }
  }

  async addWidget(userId: string, widget: Omit<DashboardWidget, 'id' | 'lastUpdated'>): Promise<string> {
    try {
      const widgetId = this.generateId();
      const newWidget: DashboardWidget = {
        ...widget,
        id: widgetId,
        lastUpdated: new Date()
      };

      // Save widget (in real implementation, this would save to database)
      this.logger.info('Widget added', { userId, widgetId, widget: newWidget });
      
      // Clear cache
      await this.cacheService.deletePattern(`dashboard:widgets:${userId}`);
      
      return widgetId;
      
    } catch (error) {
      this.logger.error('Failed to add widget', { error, userId, widget });
      throw error;
    }
  }

  async removeWidget(userId: string, widgetId: string): Promise<void> {
    try {
      // Remove widget (in real implementation, this would remove from database)
      this.logger.info('Widget removed', { userId, widgetId });
      
      // Clear cache
      await this.cacheService.deletePattern(`dashboard:widgets:${userId}`);
      
    } catch (error) {
      this.logger.error('Failed to remove widget', { error, userId, widgetId });
      throw error;
    }
  }

  // ================== DASHBOARD KPIs ==================

  async getKPIs(): Promise<DashboardKPI[]> {
    try {
      const cacheKey = 'dashboard:kpis';
      
      // Try cache first
      const cached = await this.cacheService.get<DashboardKPI[]>(cacheKey);
      if (cached) {
        return cached;
      }

      // Calculate KPIs
      const kpis = await this.calculateKPIs();
      
      // Cache KPIs
      await this.cacheService.set(cacheKey, kpis, this.CACHE_TTL);
      
      return kpis;
      
    } catch (error) {
      this.logger.error('Failed to get dashboard KPIs', { error });
      throw error;
    }
  }

  // ================== REAL-TIME DATA ==================

  async getRealTimeMetrics(): Promise<RealTimeSalesData> {
    try {
      const cacheKey = 'dashboard:realtime';
      
      // Check for very recent cache
      const cached = await this.cacheService.get<RealTimeSalesData>(cacheKey);
      if (cached) {
        return cached;
      }

      // Get real-time data
      const metrics = await this.calculateRealTimeMetrics();
      
      // Cache with short TTL
      await this.cacheService.set(cacheKey, metrics, this.REAL_TIME_TTL);
      
      return metrics;
      
    } catch (error) {
      this.logger.error('Failed to get real-time metrics', { error });
      throw error;
    }
  }

  async getActiveAlerts(): Promise<AlertData[]> {
    try {
      const cacheKey = 'dashboard:alerts';
      
      const cached = await this.cacheService.get<AlertData[]>(cacheKey);
      if (cached) {
        return cached;
      }

      // Get active alerts
      const alerts = await this.getSystemAlerts();
      
      // Cache alerts
      await this.cacheService.set(cacheKey, alerts, 60); // 1 minute cache
      
      return alerts;
      
    } catch (error) {
      this.logger.error('Failed to get active alerts', { error });
      throw error;
    }
  }

  // ================== DASHBOARD CONFIGURATIONS ==================

  async getDashboardConfig(userId: string): Promise<DashboardConfig | null> {
    try {
      // In real implementation, this would fetch from database
      const defaultConfig: DashboardConfig = {
        id: `dashboard_${userId}`,
        name: '메인 대시보드',
        userId,
        widgets: await this.getWidgets(userId),
        layout: this.getDefaultLayout(),
        settings: {
          autoRefresh: true,
          refreshInterval: 60000, // 1 minute
          theme: 'light',
          language: 'ko'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      return defaultConfig;
      
    } catch (error) {
      this.logger.error('Failed to get dashboard config', { error, userId });
      throw error;
    }
  }

  async updateDashboardConfig(userId: string, config: Partial<DashboardConfig>): Promise<void> {
    try {
      // Update dashboard configuration
      this.logger.info('Dashboard config updated', { userId, config });
      
      // Clear related cache
      await this.cacheService.deletePattern(`dashboard:widgets:${userId}`);
      
    } catch (error) {
      this.logger.error('Failed to update dashboard config', { error, userId, config });
      throw error;
    }
  }

  // ================== KOREAN E-COMMERCE SPECIFIC ==================

  async getKoreanEcommerceMetrics(): Promise<any> {
    try {
      const cacheKey = 'dashboard:korean_metrics';
      
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        return cached;
      }

      const metrics = {
        mobileCommerceRate: 0.87, // 87% mobile usage in Korea
        socialCommerceSales: {
          instagram: 2500000,
          naver: 1800000,
          kakao: 1200000,
          youtube: 900000
        },
        liveShoppingSales: {
          total: 5400000,
          growthRate: 0.45, // 45% growth
          topPlatforms: [
            { platform: '네이버 쇼핑라이브', sales: 2000000 },
            { platform: '인스타그램 라이브', sales: 1500000 },
            { platform: '유튜브 라이브', sales: 1200000 },
            { platform: '카카오 라이브', sales: 700000 }
          ]
        },
        koreanPaymentPreferences: {
          kakaopay: 0.35,
          naverpay: 0.28,
          tosspay: 0.15,
          creditCard: 0.12,
          bankTransfer: 0.10
        },
        deliveryPreferences: {
          sameDay: 0.25,
          nextDay: 0.45,
          standard: 0.30
        },
        shoppingPatterns: {
          lunchTimeBoost: 2.3, // 2.3x increase during lunch
          lateNightShopping: 1.8, // 1.8x increase 10PM-12AM
          weekendShopping: 1.4 // 1.4x increase on weekends
        }
      };

      await this.cacheService.set(cacheKey, metrics, this.CACHE_TTL);
      
      return metrics;
      
    } catch (error) {
      this.logger.error('Failed to get Korean e-commerce metrics', { error });
      throw error;
    }
  }

  // ================== PRIVATE METHODS ==================

  private async generateDefaultWidgets(): Promise<DashboardWidget[]> {
    const widgets: DashboardWidget[] = [
      {
        id: 'real_time_sales',
        type: 'metric',
        title: '실시간 매출',
        description: '현재 시간 매출 현황',
        data: await this.getRealTimeMetrics(),
        config: {
          size: 'medium',
          refreshInterval: 30000,
          position: { x: 0, y: 0, w: 6, h: 4 }
        },
        lastUpdated: new Date()
      },
      {
        id: 'top_products',
        type: 'table',
        title: '인기 상품',
        description: '오늘의 베스트셀러',
        data: await this.getTopProducts(),
        config: {
          size: 'medium',
          refreshInterval: 300000,
          position: { x: 6, y: 0, w: 6, h: 4 }
        },
        lastUpdated: new Date()
      },
      {
        id: 'sales_chart',
        type: 'chart',
        title: '매출 추이',
        description: '최근 7일간 매출 현황',
        data: await this.getSalesChart(),
        config: {
          size: 'large',
          refreshInterval: 600000,
          position: { x: 0, y: 4, w: 12, h: 6 }
        },
        lastUpdated: new Date()
      },
      {
        id: 'conversion_rate',
        type: 'gauge',
        title: '전환율',
        description: '방문자 대비 구매 전환율',
        data: await this.getConversionRateData(),
        config: {
          size: 'small',
          refreshInterval: 300000,
          position: { x: 0, y: 10, w: 3, h: 3 }
        },
        lastUpdated: new Date()
      },
      {
        id: 'device_usage',
        type: 'chart',
        title: '디바이스별 사용현황',
        description: '모바일 vs 데스크톱 사용비율',
        data: await this.getDeviceUsageData(),
        config: {
          size: 'small',
          refreshInterval: 600000,
          position: { x: 3, y: 10, w: 3, h: 3 }
        },
        lastUpdated: new Date()
      },
      {
        id: 'regional_sales',
        type: 'map',
        title: '지역별 매출',
        description: '전국 지역별 매출 분포',
        data: await this.getRegionalSalesData(),
        config: {
          size: 'medium',
          refreshInterval: 600000,
          position: { x: 6, y: 10, w: 6, h: 6 }
        },
        lastUpdated: new Date()
      },
      {
        id: 'korean_payments',
        type: 'chart',
        title: '한국 결제수단 현황',
        description: '카카오페이, 네이버페이 등 결제수단별 사용률',
        data: await this.getKoreanPaymentData(),
        config: {
          size: 'medium',
          refreshInterval: 600000,
          position: { x: 0, y: 16, w: 6, h: 4 }
        },
        lastUpdated: new Date()
      },
      {
        id: 'alerts_panel',
        type: 'table',
        title: '알림',
        description: '시스템 알림 및 경고',
        data: await this.getActiveAlerts(),
        config: {
          size: 'medium',
          refreshInterval: 60000,
          position: { x: 6, y: 16, w: 6, h: 4 }
        },
        lastUpdated: new Date()
      }
    ];

    return widgets;
  }

  private async calculateKPIs(): Promise<DashboardKPI[]> {
    const kpis: DashboardKPI[] = [
      {
        id: 'total_revenue',
        name: '총 매출',
        value: 15750000,
        previousValue: 14200000,
        change: 1550000,
        changePercent: 10.9,
        trend: 'up',
        format: 'currency',
        unit: 'KRW'
      },
      {
        id: 'order_count',
        name: '주문 수',
        value: 1247,
        previousValue: 1156,
        change: 91,
        changePercent: 7.9,
        trend: 'up',
        format: 'number'
      },
      {
        id: 'conversion_rate',
        name: '전환율',
        value: 3.4,
        previousValue: 3.1,
        change: 0.3,
        changePercent: 9.7,
        trend: 'up',
        format: 'percentage',
        target: 4.0
      },
      {
        id: 'avg_order_value',
        name: '평균 주문가',
        value: 126000,
        previousValue: 123000,
        change: 3000,
        changePercent: 2.4,
        trend: 'up',
        format: 'currency',
        unit: 'KRW'
      },
      {
        id: 'customer_lifetime_value',
        name: '고객 생애가치',
        value: 285000,
        previousValue: 270000,
        change: 15000,
        changePercent: 5.6,
        trend: 'up',
        format: 'currency',
        unit: 'KRW'
      },
      {
        id: 'cart_abandonment_rate',
        name: '장바구니 이탈률',
        value: 68.5,
        previousValue: 71.2,
        change: -2.7,
        changePercent: -3.8,
        trend: 'up', // Down is good for abandonment rate
        format: 'percentage'
      }
    ];

    return kpis;
  }

  private async calculateRealTimeMetrics(): Promise<RealTimeSalesData> {
    // Mock real-time calculations
    const currentHour = new Date().getHours();
    const baseHourlyRate = 45000;
    const hourlyMultiplier = this.getHourlyMultiplier(currentHour);
    
    return {
      currentHourSales: Math.round(baseHourlyRate * hourlyMultiplier),
      todaysSales: 850000 + Math.round(Math.random() * 50000),
      activeUsers: 1250 + Math.round(Math.random() * 200),
      pendingOrders: 23 + Math.round(Math.random() * 10),
      lastUpdated: new Date()
    };
  }

  private getHourlyMultiplier(hour: number): number {
    // Korean shopping patterns
    if (hour >= 12 && hour <= 13) return 2.3; // Lunch time boost
    if (hour >= 22 && hour <= 23) return 1.8; // Late night shopping
    if (hour >= 19 && hour <= 21) return 1.5; // Evening shopping
    if (hour >= 9 && hour <= 18) return 1.2; // Business hours
    return 0.8; // Other times
  }

  private async getSystemAlerts(): Promise<AlertData[]> {
    return [
      {
        id: 'alert_1',
        type: 'low_inventory' as any,
        severity: 'medium' as any,
        message: '재고 부족 상품 5개 발견',
        timestamp: new Date(Date.now() - 300000),
        acknowledged: false
      },
      {
        id: 'alert_2',
        type: 'high_cart_abandonment' as any,
        severity: 'high' as any,
        message: '장바구니 이탈률 75% 초과',
        timestamp: new Date(Date.now() - 600000),
        acknowledged: false
      },
      {
        id: 'alert_3',
        type: 'payment_failures' as any,
        severity: 'low' as any,
        message: '결제 실패율 일시적 증가',
        timestamp: new Date(Date.now() - 900000),
        acknowledged: true
      }
    ];
  }

  private async getTopProducts(): Promise<TopProductData[]> {
    return [
      { productId: 'prod_1', name: '인기 스킨케어 세트', sales: 45, revenue: 2250000, growth: 15.2 },
      { productId: 'prod_2', name: '무선 이어폰', sales: 38, revenue: 1900000, growth: 8.7 },
      { productId: 'prod_3', name: '겨울 패딩', sales: 32, revenue: 3200000, growth: 12.1 },
      { productId: 'prod_4', name: '비타민 세트', sales: 28, revenue: 840000, growth: -2.3 },
      { productId: 'prod_5', name: '블루투스 스피커', sales: 25, revenue: 1250000, growth: 5.8 }
    ];
  }

  private async getSalesChart(): Promise<any> {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      return {
        date: date.toISOString().split('T')[0],
        sales: Math.round(800000 + Math.random() * 400000),
        orders: Math.round(1000 + Math.random() * 500)
      };
    });

    return {
      type: 'line',
      data: last7Days,
      config: {
        xAxis: 'date',
        yAxis: ['sales', 'orders'],
        colors: ['#4F46E5', '#059669']
      }
    };
  }

  private async getConversionRateData(): Promise<ConversionRateData> {
    return {
      overall: 3.4,
      mobile: 3.1,
      desktop: 4.2,
      byChannel: [
        { channel: 'organic', rate: 4.1, traffic: 45000 },
        { channel: 'paid', rate: 2.8, traffic: 25000 },
        { channel: 'social', rate: 3.2, traffic: 15000 },
        { channel: 'direct', rate: 5.1, traffic: 12000 }
      ]
    };
  }

  private async getDeviceUsageData(): Promise<DeviceUsageData> {
    return {
      mobile: {
        sessions: 8750,
        sales: 7400000,
        conversionRate: 3.1
      },
      desktop: {
        sessions: 1250,
        sales: 1600000,
        conversionRate: 4.2
      },
      tablet: {
        sessions: 300,
        sales: 200000,
        conversionRate: 2.8
      }
    };
  }

  private async getRegionalSalesData(): Promise<RegionalSalesData[]> {
    return [
      { region: '서울', sales: 3500000, growth: 12.5, marketShare: 35 },
      { region: '경기', sales: 2800000, growth: 8.2, marketShare: 28 },
      { region: '부산', sales: 1200000, growth: 6.7, marketShare: 12 },
      { region: '대구', sales: 800000, growth: 4.3, marketShare: 8 },
      { region: '인천', sales: 700000, growth: 9.1, marketShare: 7 },
      { region: '기타', sales: 1000000, growth: 5.8, marketShare: 10 }
    ];
  }

  private async getKoreanPaymentData(): Promise<any> {
    return {
      type: 'pie',
      data: [
        { method: '카카오페이', usage: 35, amount: 3500000 },
        { method: '네이버페이', usage: 28, amount: 2800000 },
        { method: '토스페이', usage: 15, amount: 1500000 },
        { method: '신용카드', usage: 12, amount: 1200000 },
        { method: '계좌이체', usage: 10, amount: 1000000 }
      ],
      config: {
        colors: ['#FEE500', '#03C75A', '#3182F6', '#6366F1', '#8B5CF6']
      }
    };
  }

  private getDefaultLayout(): any {
    return {
      lg: [
        { i: 'real_time_sales', x: 0, y: 0, w: 6, h: 4 },
        { i: 'top_products', x: 6, y: 0, w: 6, h: 4 },
        { i: 'sales_chart', x: 0, y: 4, w: 12, h: 6 },
        { i: 'conversion_rate', x: 0, y: 10, w: 3, h: 3 },
        { i: 'device_usage', x: 3, y: 10, w: 3, h: 3 },
        { i: 'regional_sales', x: 6, y: 10, w: 6, h: 6 },
        { i: 'korean_payments', x: 0, y: 16, w: 6, h: 4 },
        { i: 'alerts_panel', x: 6, y: 16, w: 6, h: 4 }
      ]
    };
  }

  private generateId(): string {
    return `widget_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}