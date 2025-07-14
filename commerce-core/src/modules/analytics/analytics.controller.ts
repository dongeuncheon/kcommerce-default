import { Request, Response } from 'express';
import { AnalyticsService } from './analytics.service';
import { LoggerService } from '../../core/services/logger.service';
import {
  AnalyticsEvent,
  AnalyticsQueryParams,
  ReportConfiguration,
  ReportType,
  ExportFormat,
  DateRange,
  ReportFilter,
  FilterOperator
} from './analytics.types';

export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly logger: LoggerService
  ) {}

  // ================== EVENT TRACKING ==================

  /**
   * POST /api/analytics/events
   * Track a single analytics event
   */
  async trackEvent(req: Request, res: Response): Promise<void> {
    try {
      const eventData: Partial<AnalyticsEvent> = req.body;
      
      // Add request metadata
      eventData.metadata = {
        ...eventData.metadata,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        source: 'api'
      };
      
      const eventId = await this.analyticsService.trackEvent(eventData);
      
      res.status(201).json({
        success: true,
        data: { eventId },
        message: 'Event tracked successfully'
      });
      
    } catch (error) {
      this.logger.error('Failed to track event', { error, body: req.body });
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to track event'
      });
    }
  }

  /**
   * POST /api/analytics/events/batch
   * Track multiple analytics events in batch
   */
  async batchTrackEvents(req: Request, res: Response): Promise<void> {
    try {
      const events: Partial<AnalyticsEvent>[] = req.body.events || [];
      
      if (!Array.isArray(events) || events.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Events array is required and cannot be empty'
        });
        return;
      }
      
      // Add request metadata to all events
      const enrichedEvents = events.map(event => ({
        ...event,
        metadata: {
          ...event.metadata,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          source: 'api'
        }
      }));
      
      const eventIds = await this.analyticsService.batchTrackEvents(enrichedEvents);
      
      res.status(201).json({
        success: true,
        data: { eventIds, count: eventIds.length },
        message: `${eventIds.length} events tracked successfully`
      });
      
    } catch (error) {
      this.logger.error('Failed to batch track events', { error, eventCount: req.body.events?.length });
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to batch track events'
      });
    }
  }

  // ================== DASHBOARD ANALYTICS ==================

  /**
   * GET /api/analytics/dashboard
   * Get comprehensive dashboard metrics
   */
  async getDashboard(req: Request, res: Response): Promise<void> {
    try {
      const metrics = await this.analyticsService.getDashboardMetrics();
      
      res.json({
        success: true,
        data: metrics.data,
        metadata: metrics.metadata
      });
      
    } catch (error) {
      this.logger.error('Failed to get dashboard metrics', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve dashboard metrics'
      });
    }
  }

  // ================== SALES ANALYTICS ==================

  /**
   * GET /api/analytics/sales
   * Get comprehensive sales analytics
   */
  async getSalesAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const params = this.parseQueryParams(req);
      const analytics = await this.analyticsService.getSalesAnalytics(params);
      
      res.json({
        success: true,
        data: analytics.data,
        metadata: analytics.metadata
      });
      
    } catch (error) {
      this.logger.error('Failed to get sales analytics', { error, query: req.query });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve sales analytics'
      });
    }
  }

  // ================== PRODUCT ANALYTICS ==================

  /**
   * GET /api/analytics/products
   * Get comprehensive product analytics
   */
  async getProductAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const params = this.parseQueryParams(req);
      const analytics = await this.analyticsService.getProductAnalytics(params);
      
      res.json({
        success: true,
        data: analytics.data,
        metadata: analytics.metadata
      });
      
    } catch (error) {
      this.logger.error('Failed to get product analytics', { error, query: req.query });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve product analytics'
      });
    }
  }

  // ================== CUSTOMER ANALYTICS ==================

  /**
   * GET /api/analytics/customers
   * Get comprehensive customer analytics
   */
  async getCustomerAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const params = this.parseQueryParams(req);
      const analytics = await this.analyticsService.getCustomerAnalytics(params);
      
      res.json({
        success: true,
        data: analytics.data,
        metadata: analytics.metadata
      });
      
    } catch (error) {
      this.logger.error('Failed to get customer analytics', { error, query: req.query });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve customer analytics'
      });
    }
  }

  // ================== ORDER ANALYTICS ==================

  /**
   * GET /api/analytics/orders
   * Get comprehensive order analytics
   */
  async getOrderAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const params = this.parseQueryParams(req);
      const analytics = await this.analyticsService.getOrderAnalytics(params);
      
      res.json({
        success: true,
        data: analytics.data,
        metadata: analytics.metadata
      });
      
    } catch (error) {
      this.logger.error('Failed to get order analytics', { error, query: req.query });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve order analytics'
      });
    }
  }

  // ================== PAYMENT ANALYTICS ==================

  /**
   * GET /api/analytics/payments
   * Get comprehensive payment analytics including Korean payment methods
   */
  async getPaymentAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const params = this.parseQueryParams(req);
      const analytics = await this.analyticsService.getPaymentAnalytics(params);
      
      res.json({
        success: true,
        data: analytics.data,
        metadata: analytics.metadata
      });
      
    } catch (error) {
      this.logger.error('Failed to get payment analytics', { error, query: req.query });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve payment analytics'
      });
    }
  }

  /**
   * GET /api/analytics/payments/korean
   * Get Korean-specific payment method analytics
   */
  async getKoreanPaymentAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const params = this.parseQueryParams(req);
      const analytics = await this.analyticsService.getKoreanPaymentAnalytics(params);
      
      res.json({
        success: true,
        data: analytics,
        message: 'Korean payment analytics retrieved successfully'
      });
      
    } catch (error) {
      this.logger.error('Failed to get Korean payment analytics', { error, query: req.query });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve Korean payment analytics'
      });
    }
  }

  // ================== SHIPPING ANALYTICS ==================

  /**
   * GET /api/analytics/shipping
   * Get comprehensive shipping analytics
   */
  async getShippingAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const params = this.parseQueryParams(req);
      
      // For now, return mock shipping analytics
      // In a real implementation, this would call analyticsService.getShippingAnalytics(params)
      const mockShippingAnalytics = {
        averageDeliveryTime: 2.5,
        shippingCosts: [
          { method: 'standard', averageCost: 3000, usage: 60 },
          { method: 'express', averageCost: 5000, usage: 30 },
          { method: 'same_day', averageCost: 8000, usage: 10 }
        ],
        deliveryPerformance: [
          { provider: 'CJ대한통운', onTimeRate: 0.95, averageTime: 2.2, satisfaction: 4.2 },
          { provider: '한진택배', onTimeRate: 0.92, averageTime: 2.4, satisfaction: 4.0 },
          { provider: '롯데택배', onTimeRate: 0.90, averageTime: 2.6, satisfaction: 3.9 }
        ],
        koreanShippingZones: [
          { zone: '서울/경기', deliveryTime: 1.5, cost: 3000, popularity: 45, satisfaction: 4.3 },
          { zone: '부산/경남', deliveryTime: 2.0, cost: 3500, popularity: 15, satisfaction: 4.1 },
          { zone: '대구/경북', deliveryTime: 2.2, cost: 3500, popularity: 12, satisfaction: 4.0 },
          { zone: '제주도', deliveryTime: 3.5, cost: 5000, popularity: 3, satisfaction: 3.8 }
        ]
      };
      
      res.json({
        success: true,
        data: mockShippingAnalytics,
        metadata: {
          totalRecords: 1,
          processedAt: new Date(),
          cacheDuration: 300
        }
      });
      
    } catch (error) {
      this.logger.error('Failed to get shipping analytics', { error, query: req.query });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve shipping analytics'
      });
    }
  }

  // ================== INVENTORY ANALYTICS ==================

  /**
   * GET /api/analytics/inventory
   * Get comprehensive inventory analytics
   */
  async getInventoryAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const params = this.parseQueryParams(req);
      
      // Mock inventory analytics data
      const mockInventoryAnalytics = {
        stockLevels: [
          { productId: 'prod1', currentStock: 50, optimalStock: 100, status: 'low' },
          { productId: 'prod2', currentStock: 150, optimalStock: 120, status: 'overstocked' },
          { productId: 'prod3', currentStock: 95, optimalStock: 100, status: 'optimal' }
        ],
        inventoryTurnover: [
          { productId: 'prod1', turnoverRate: 12, daysOnHand: 30 },
          { productId: 'prod2', turnoverRate: 8, daysOnHand: 45 },
          { productId: 'prod3', turnoverRate: 15, daysOnHand: 24 }
        ],
        stockoutEvents: [
          { productId: 'prod4', duration: 3, lostSales: 25000, impact: 0.15 }
        ],
        inventoryValue: {
          totalValue: 15000000,
          byCategory: [
            { category: 'electronics', value: 8000000, turnover: 10 },
            { category: 'fashion', value: 4000000, turnover: 15 },
            { category: 'beauty', value: 3000000, turnover: 20 }
          ],
          deadStock: 500000
        },
        warehousePerformance: [
          { warehouseId: 'wh1', throughput: 1000, accuracy: 0.98, cost: 50000 },
          { warehouseId: 'wh2', throughput: 800, accuracy: 0.96, cost: 45000 }
        ]
      };
      
      res.json({
        success: true,
        data: mockInventoryAnalytics,
        metadata: {
          totalRecords: 1,
          processedAt: new Date(),
          cacheDuration: 300
        }
      });
      
    } catch (error) {
      this.logger.error('Failed to get inventory analytics', { error, query: req.query });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve inventory analytics'
      });
    }
  }

  // ================== MARKETING ANALYTICS ==================

  /**
   * GET /api/analytics/marketing
   * Get comprehensive marketing analytics
   */
  async getMarketingAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const params = this.parseQueryParams(req);
      
      // Mock marketing analytics data
      const mockMarketingAnalytics = {
        campaignPerformance: [
          { campaignId: 'camp1', name: '블랙프라이데이', reach: 100000, engagement: 5000, conversion: 500, roi: 3.2 },
          { campaignId: 'camp2', name: '추석 특가', reach: 80000, engagement: 4200, conversion: 420, roi: 2.8 },
          { campaignId: 'camp3', name: '신상품 런칭', reach: 50000, engagement: 3000, conversion: 300, roi: 2.1 }
        ],
        emailMarketingMetrics: {
          openRate: 0.25,
          clickRate: 0.08,
          unsubscribeRate: 0.02,
          conversionRate: 0.05
        },
        socialMediaMetrics: [
          { platform: '인스타그램', followers: 150000, engagement: 12000, traffic: 25000, sales: 5000000 },
          { platform: '네이버블로그', followers: 80000, engagement: 8000, traffic: 15000, sales: 3000000 },
          { platform: '유튜브', followers: 200000, engagement: 20000, traffic: 35000, sales: 7000000 }
        ],
        influencerMarketing: [
          { influencer: '뷰티인플루언서A', reach: 50000, engagement: 5000, sales: 2000000, roi: 4.0 },
          { influencer: '패션인플루언서B', reach: 80000, engagement: 6000, sales: 1500000, roi: 3.2 }
        ],
        seoPerformance: {
          organicTraffic: 45000,
          keywords: 1200,
          rankings: [
            { keyword: '한국 쇼핑몰', position: 3, traffic: 2000 },
            { keyword: '온라인 구매', position: 5, traffic: 1500 }
          ],
          conversionRate: 0.06
        }
      };
      
      res.json({
        success: true,
        data: mockMarketingAnalytics,
        metadata: {
          totalRecords: 1,
          processedAt: new Date(),
          cacheDuration: 300
        }
      });
      
    } catch (error) {
      this.logger.error('Failed to get marketing analytics', { error, query: req.query });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve marketing analytics'
      });
    }
  }

  // ================== TIME-BASED ANALYTICS ==================

  /**
   * GET /api/analytics/time-based
   * Get time-based analytics including Korean holiday analysis
   */
  async getTimeBasedAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const params = this.parseQueryParams(req);
      const analytics = await this.analyticsService.getTimeBasedAnalytics(params);
      
      res.json({
        success: true,
        data: analytics.data,
        metadata: analytics.metadata
      });
      
    } catch (error) {
      this.logger.error('Failed to get time-based analytics', { error, query: req.query });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve time-based analytics'
      });
    }
  }

  /**
   * GET /api/analytics/korean-holidays
   * Get Korean holiday impact analysis
   */
  async getKoreanHolidayAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const params = this.parseQueryParams(req);
      const analytics = await this.analyticsService.getKoreanHolidayImpact(params);
      
      res.json({
        success: true,
        data: analytics,
        message: 'Korean holiday analytics retrieved successfully'
      });
      
    } catch (error) {
      this.logger.error('Failed to get Korean holiday analytics', { error, query: req.query });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve Korean holiday analytics'
      });
    }
  }

  // ================== REPORTS ==================

  /**
   * GET /api/analytics/reports
   * Get available reports list
   */
  async getReports(req: Request, res: Response): Promise<void> {
    try {
      const reports = [
        {
          id: 'sales-summary',
          name: '매출 요약 보고서',
          type: ReportType.SALES,
          description: '전체 매출 현황 및 트렌드 분석',
          lastGenerated: new Date(),
          format: ['pdf', 'excel', 'csv']
        },
        {
          id: 'product-performance',
          name: '상품 성과 보고서',
          type: ReportType.PRODUCTS,
          description: '상품별 판매 성과 및 재고 현황',
          lastGenerated: new Date(),
          format: ['pdf', 'excel', 'csv']
        },
        {
          id: 'customer-insights',
          name: '고객 인사이트 보고서',
          type: ReportType.CUSTOMERS,
          description: '고객 행동 패턴 및 세그먼트 분석',
          lastGenerated: new Date(),
          format: ['pdf', 'excel']
        },
        {
          id: 'korean-market-analysis',
          name: '한국 시장 분석 보고서',
          type: ReportType.COMPREHENSIVE,
          description: '한국 이커머스 시장 트렌드 및 결제 패턴',
          lastGenerated: new Date(),
          format: ['pdf', 'excel']
        }
      ];
      
      res.json({
        success: true,
        data: reports,
        message: 'Available reports retrieved successfully'
      });
      
    } catch (error) {
      this.logger.error('Failed to get reports', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve reports'
      });
    }
  }

  /**
   * POST /api/analytics/reports/export
   * Export analytics report in specified format
   */
  async exportReport(req: Request, res: Response): Promise<void> {
    try {
      const config: ReportConfiguration = req.body;
      
      if (!config.type || !config.format) {
        res.status(400).json({
          success: false,
          error: 'Report type and format are required'
        });
        return;
      }
      
      // Validate date range
      if (!config.dateRange || !config.dateRange.start || !config.dateRange.end) {
        res.status(400).json({
          success: false,
          error: 'Date range with start and end dates is required'
        });
        return;
      }
      
      // Generate report (mock implementation)
      const reportId = `report_${Date.now()}`;
      const fileName = `${config.type}_${config.dateRange.start}_${config.dateRange.end}.${config.format}`;
      
      // In a real implementation, this would:
      // 1. Fetch data based on config
      // 2. Generate file in requested format
      // 3. Store file and return download link
      
      res.json({
        success: true,
        data: {
          reportId,
          fileName,
          downloadUrl: `/api/analytics/reports/download/${reportId}`,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
          fileSize: '2.5MB',
          status: 'ready'
        },
        message: 'Report generated successfully'
      });
      
    } catch (error) {
      this.logger.error('Failed to export report', { error, body: req.body });
      res.status(500).json({
        success: false,
        error: 'Failed to generate report'
      });
    }
  }

  /**
   * GET /api/analytics/reports/download/:reportId
   * Download generated report
   */
  async downloadReport(req: Request, res: Response): Promise<void> {
    try {
      const { reportId } = req.params;
      
      // In a real implementation, this would:
      // 1. Validate report ID
      // 2. Check if file exists
      // 3. Stream file to response
      
      res.json({
        success: false,
        error: 'Report download not implemented in this demo'
      });
      
    } catch (error) {
      this.logger.error('Failed to download report', { error, reportId: req.params.reportId });
      res.status(500).json({
        success: false,
        error: 'Failed to download report'
      });
    }
  }

  // ================== REAL-TIME ANALYTICS ==================

  /**
   * GET /api/analytics/realtime
   * Get real-time analytics data
   */
  async getRealTimeAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const realTimeData = {
        activeUsers: 1250,
        currentHourSales: 45000,
        todaysSales: 850000,
        conversionRate: 0.034,
        topSellingNow: [
          { productId: 'prod1', name: '인기 상품 1', sales: 25 },
          { productId: 'prod2', name: '인기 상품 2', sales: 18 },
          { productId: 'prod3', name: '인기 상품 3', sales: 15 }
        ],
        recentOrders: [
          { orderId: 'order1', amount: 95000, time: new Date() },
          { orderId: 'order2', amount: 67000, time: new Date(Date.now() - 300000) },
          { orderId: 'order3', amount: 120000, time: new Date(Date.now() - 600000) }
        ],
        systemStatus: {
          api: 'healthy',
          database: 'healthy',
          payments: 'healthy',
          inventory: 'warning'
        },
        alerts: [
          { type: 'inventory', message: '재고 부족 상품 3개', severity: 'medium' },
          { type: 'performance', message: 'API 응답 시간 증가', severity: 'low' }
        ]
      };
      
      res.json({
        success: true,
        data: realTimeData,
        timestamp: new Date(),
        nextUpdate: new Date(Date.now() + 60000) // Next update in 1 minute
      });
      
    } catch (error) {
      this.logger.error('Failed to get real-time analytics', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve real-time analytics'
      });
    }
  }

  // ================== DATA PROCESSING ==================

  /**
   * POST /api/analytics/process
   * Trigger analytics data processing
   */
  async processAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const { granularity = 'day' } = req.body;
      
      // Process unprocessed events
      await this.analyticsService.processUnprocessedEvents();
      
      // Aggregate analytics data
      await this.analyticsService.aggregateAnalytics(granularity);
      
      res.json({
        success: true,
        message: 'Analytics processing completed successfully',
        processedAt: new Date()
      });
      
    } catch (error) {
      this.logger.error('Failed to process analytics', { error, body: req.body });
      res.status(500).json({
        success: false,
        error: 'Failed to process analytics data'
      });
    }
  }

  // ================== HELPER METHODS ==================

  private parseQueryParams(req: Request): AnalyticsQueryParams {
    const {
      startDate,
      endDate,
      granularity = 'day',
      metrics,
      dimensions,
      filters,
      limit = '100',
      offset = '0'
    } = req.query;

    const params: AnalyticsQueryParams = {
      granularity: granularity as 'hour' | 'day' | 'week' | 'month',
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    };

    if (startDate) {
      params.startDate = startDate as string;
    }

    if (endDate) {
      params.endDate = endDate as string;
    }

    if (metrics) {
      params.metrics = Array.isArray(metrics) ? metrics as string[] : [metrics as string];
    }

    if (dimensions) {
      params.dimensions = Array.isArray(dimensions) ? dimensions as string[] : [dimensions as string];
    }

    if (filters) {
      try {
        params.filters = typeof filters === 'string' ? JSON.parse(filters) : filters as ReportFilter[];
      } catch (error) {
        this.logger.warn('Failed to parse filters', { filters, error });
      }
    }

    return params;
  }

  private validateDateRange(startDate?: string, endDate?: string): void {
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new Error('Invalid date format');
      }
      
      if (start > end) {
        throw new Error('Start date must be before end date');
      }
      
      const daysDiff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
      if (daysDiff > 365) {
        throw new Error('Date range cannot exceed 365 days');
      }
    }
  }

  private buildFilterCriteria(filters?: ReportFilter[]): Record<string, any> {
    if (!filters || filters.length === 0) {
      return {};
    }

    const criteria: Record<string, any> = {};

    filters.forEach(filter => {
      switch (filter.operator) {
        case FilterOperator.EQUALS:
          criteria[filter.field] = filter.value;
          break;
        case FilterOperator.IN:
          criteria[filter.field] = { $in: filter.value };
          break;
        case FilterOperator.GREATER_THAN:
          criteria[filter.field] = { $gt: filter.value };
          break;
        case FilterOperator.LESS_THAN:
          criteria[filter.field] = { $lt: filter.value };
          break;
        case FilterOperator.CONTAINS:
          criteria[filter.field] = { $regex: filter.value, $options: 'i' };
          break;
      }
    });

    return criteria;
  }
}