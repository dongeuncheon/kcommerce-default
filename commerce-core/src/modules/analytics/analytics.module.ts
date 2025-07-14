import { BaseModule } from '../../core/module/base.module';
import { Container } from '../../core/di/container';
import { AnalyticsService } from './analytics.service';
import { AnalyticsRepository } from './analytics.repository';
import { AnalyticsController } from './analytics.controller';
import { DashboardService } from './dashboard.service';
import { ExportService } from './export.service';
import { AlertService } from './alert.service';
import { AnalyticsCacheService } from './cache.service';
import { DatabaseAdapter } from '../../adapters/database.adapter';
import { CacheService } from '../../core/services/cache.service';
import { LoggerService } from '../../core/services/logger.service';
import { Router } from 'express';

export class AnalyticsModule extends BaseModule {
  private analyticsController!: AnalyticsController;
  private analyticsService!: AnalyticsService;
  private dashboardService!: DashboardService;
  private exportService!: ExportService;
  private alertService!: AlertService;
  private analyticsCacheService!: AnalyticsCacheService;

  constructor(private container: Container) {
    super('AnalyticsModule', '1.0.0');
  }

  async initialize(): Promise<void> {
    try {
      await this.registerDependencies();
      await this.initializeServices();
      await this.setupDatabase();
      await this.registerRoutes();
      
      this.logger.info('Analytics module initialized successfully');
      
    } catch (error) {
      this.logger.error('Failed to initialize analytics module', { error });
      throw error;
    }
  }

  async destroy(): Promise<void> {
    try {
      // Cleanup resources
      await this.analyticsCacheService?.destroy();
      await this.alertService?.destroy();
      
      this.logger.info('Analytics module destroyed successfully');
      
    } catch (error) {
      this.logger.error('Failed to destroy analytics module', { error });
      throw error;
    }
  }

  getRouter(): Router {
    const router = Router();

    // Event tracking endpoints
    router.post('/events', this.analyticsController.trackEvent.bind(this.analyticsController));
    router.post('/events/batch', this.analyticsController.batchTrackEvents.bind(this.analyticsController));

    // Dashboard endpoints
    router.get('/dashboard', this.analyticsController.getDashboard.bind(this.analyticsController));
    router.get('/realtime', this.analyticsController.getRealTimeAnalytics.bind(this.analyticsController));

    // Core analytics endpoints
    router.get('/sales', this.analyticsController.getSalesAnalytics.bind(this.analyticsController));
    router.get('/products', this.analyticsController.getProductAnalytics.bind(this.analyticsController));
    router.get('/customers', this.analyticsController.getCustomerAnalytics.bind(this.analyticsController));
    router.get('/orders', this.analyticsController.getOrderAnalytics.bind(this.analyticsController));
    router.get('/payments', this.analyticsController.getPaymentAnalytics.bind(this.analyticsController));
    router.get('/shipping', this.analyticsController.getShippingAnalytics.bind(this.analyticsController));
    router.get('/inventory', this.analyticsController.getInventoryAnalytics.bind(this.analyticsController));
    router.get('/marketing', this.analyticsController.getMarketingAnalytics.bind(this.analyticsController));

    // Korean-specific endpoints
    router.get('/payments/korean', this.analyticsController.getKoreanPaymentAnalytics.bind(this.analyticsController));
    router.get('/korean-holidays', this.analyticsController.getKoreanHolidayAnalytics.bind(this.analyticsController));

    // Time-based analytics
    router.get('/time-based', this.analyticsController.getTimeBasedAnalytics.bind(this.analyticsController));

    // Reports endpoints
    router.get('/reports', this.analyticsController.getReports.bind(this.analyticsController));
    router.post('/reports/export', this.analyticsController.exportReport.bind(this.analyticsController));
    router.get('/reports/download/:reportId', this.analyticsController.downloadReport.bind(this.analyticsController));

    // Data processing endpoints
    router.post('/process', this.analyticsController.processAnalytics.bind(this.analyticsController));

    // Dashboard-specific endpoints
    router.get('/dashboard/widgets', this.getDashboardWidgets.bind(this));
    router.get('/dashboard/kpis', this.getDashboardKPIs.bind(this));
    router.post('/dashboard/alerts/acknowledge', this.acknowledgeAlert.bind(this));

    // Export endpoints
    router.post('/export/excel', this.exportExcel.bind(this));
    router.post('/export/pdf', this.exportPDF.bind(this));
    router.post('/export/csv', this.exportCSV.bind(this));

    // Alert management endpoints
    router.get('/alerts', this.getAlerts.bind(this));
    router.post('/alerts/config', this.configureAlert.bind(this));
    router.put('/alerts/config/:id', this.updateAlertConfig.bind(this));
    router.delete('/alerts/config/:id', this.deleteAlertConfig.bind(this));

    // Cache management endpoints
    router.post('/cache/clear', this.clearCache.bind(this));
    router.get('/cache/stats', this.getCacheStats.bind(this));
    router.post('/cache/warm', this.warmCache.bind(this));

    return router;
  }

  // Service getters
  getAnalyticsService(): AnalyticsService {
    return this.analyticsService;
  }

  getDashboardService(): DashboardService {
    return this.dashboardService;
  }

  getExportService(): ExportService {
    return this.exportService;
  }

  getAlertService(): AlertService {
    return this.alertService;
  }

  getCacheService(): AnalyticsCacheService {
    return this.analyticsCacheService;
  }

  // Background processes
  async startBackgroundProcesses(): Promise<void> {
    try {
      // Start analytics data processing
      await this.startAnalyticsProcessor();
      
      // Start alert monitoring
      await this.startAlertMonitoring();
      
      // Start cache warming
      await this.startCacheWarming();
      
      this.logger.info('Analytics background processes started');
      
    } catch (error) {
      this.logger.error('Failed to start background processes', { error });
      throw error;
    }
  }

  async stopBackgroundProcesses(): Promise<void> {
    try {
      // Stop all background processes
      await this.alertService.stopMonitoring();
      await this.analyticsCacheService.stopWarming();
      
      this.logger.info('Analytics background processes stopped');
      
    } catch (error) {
      this.logger.error('Failed to stop background processes', { error });
    }
  }

  // Private methods
  private async registerDependencies(): Promise<void> {
    // Register core services if not already registered
    if (!this.container.has('DatabaseAdapter')) {
      throw new Error('DatabaseAdapter is required for AnalyticsModule');
    }

    if (!this.container.has('CacheService')) {
      throw new Error('CacheService is required for AnalyticsModule');
    }

    if (!this.container.has('LoggerService')) {
      throw new Error('LoggerService is required for AnalyticsModule');
    }
  }

  private async initializeServices(): Promise<void> {
    const databaseAdapter = this.container.get<DatabaseAdapter>('DatabaseAdapter');
    const cacheService = this.container.get<CacheService>('CacheService');
    const loggerService = this.container.get<LoggerService>('LoggerService');

    // Initialize repository
    const analyticsRepository = new AnalyticsRepository(databaseAdapter);

    // Initialize specialized services
    this.analyticsCacheService = new AnalyticsCacheService(cacheService, loggerService);
    this.alertService = new AlertService(analyticsRepository, loggerService);
    this.exportService = new ExportService(loggerService);
    this.dashboardService = new DashboardService(analyticsRepository, this.analyticsCacheService, loggerService);

    // Initialize main analytics service
    this.analyticsService = new AnalyticsService(
      analyticsRepository,
      cacheService,
      loggerService
    );

    // Initialize controller
    this.analyticsController = new AnalyticsController(
      this.analyticsService,
      loggerService
    );

    // Register services in container
    this.container.register('AnalyticsService', this.analyticsService);
    this.container.register('AnalyticsRepository', analyticsRepository);
    this.container.register('AnalyticsController', this.analyticsController);
    this.container.register('DashboardService', this.dashboardService);
    this.container.register('ExportService', this.exportService);
    this.container.register('AlertService', this.alertService);
    this.container.register('AnalyticsCacheService', this.analyticsCacheService);
  }

  private async setupDatabase(): Promise<void> {
    try {
      const databaseAdapter = this.container.get<DatabaseAdapter>('DatabaseAdapter');
      
      // Create analytics tables if they don't exist
      await this.createAnalyticsTables(databaseAdapter);
      
      // Create indexes for performance
      await this.createAnalyticsIndexes(databaseAdapter);
      
      // Initialize Korean holidays data
      await this.initializeKoreanHolidaysData(databaseAdapter);
      
      this.logger.info('Analytics database setup completed');
      
    } catch (error) {
      this.logger.error('Failed to setup analytics database', { error });
      throw error;
    }
  }

  private async createAnalyticsTables(adapter: DatabaseAdapter): Promise<void> {
    const { ANALYTICS_SCHEMA_SQL } = await import('./analytics.entity');
    
    // Execute schema creation SQL
    const statements = ANALYTICS_SCHEMA_SQL.split(';').filter(sql => sql.trim());
    
    for (const statement of statements) {
      if (statement.trim()) {
        await adapter.query(statement, []);
      }
    }
  }

  private async createAnalyticsIndexes(adapter: DatabaseAdapter): Promise<void> {
    const { ANALYTICS_INDEXES } = await import('./analytics.entity');
    
    for (const [tableName, indexes] of Object.entries(ANALYTICS_INDEXES)) {
      for (const indexSQL of indexes) {
        try {
          await adapter.query(indexSQL, []);
        } catch (error) {
          // Index might already exist, log but don't fail
          this.logger.warn('Failed to create index', { tableName, indexSQL, error });
        }
      }
    }
  }

  private async initializeKoreanHolidaysData(adapter: DatabaseAdapter): Promise<void> {
    const koreanHolidays = [
      { name: '신정', date: '2024-01-01', type: 'national', impact: 1.2 },
      { name: '설날', date: '2024-02-10', type: 'traditional', impact: 1.8 },
      { name: '삼일절', date: '2024-03-01', type: 'national', impact: 1.1 },
      { name: '어린이날', date: '2024-05-05', type: 'national', impact: 1.4 },
      { name: '부처님오신날', date: '2024-05-15', type: 'traditional', impact: 1.1 },
      { name: '현충일', date: '2024-06-06', type: 'national', impact: 1.0 },
      { name: '광복절', date: '2024-08-15', type: 'national', impact: 1.1 },
      { name: '추석', date: '2024-09-17', type: 'traditional', impact: 2.0 },
      { name: '개천절', date: '2024-10-03', type: 'national', impact: 1.0 },
      { name: '한글날', date: '2024-10-09', type: 'national', impact: 1.0 },
      { name: '크리스마스', date: '2024-12-25', type: 'national', impact: 1.5 },
      { name: '빼빼로데이', date: '2024-11-11', type: 'commercial', impact: 2.2 },
      { name: '블랙프라이데이', date: '2024-11-29', type: 'commercial', impact: 2.8 }
    ];

    const insertSQL = `
      INSERT IGNORE INTO korean_holidays 
      (id, holidayName, holidayDate, holidayType, isRecurring, salesImpact, year) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    for (const holiday of koreanHolidays) {
      const id = `holiday_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await adapter.query(insertSQL, [
        id,
        holiday.name,
        holiday.date,
        holiday.type,
        true,
        holiday.impact,
        2024
      ]);
    }
  }

  private async registerRoutes(): Promise<void> {
    // Routes are registered via getRouter() method
    this.logger.info('Analytics routes registered');
  }

  private async startAnalyticsProcessor(): Promise<void> {
    // Start periodic processing of analytics events
    setInterval(async () => {
      try {
        await this.analyticsService.processUnprocessedEvents();
      } catch (error) {
        this.logger.error('Analytics processing error', { error });
      }
    }, 60000); // Process every minute

    // Start hourly aggregation
    setInterval(async () => {
      try {
        await this.analyticsService.aggregateAnalytics('hour');
      } catch (error) {
        this.logger.error('Analytics aggregation error', { error });
      }
    }, 3600000); // Aggregate every hour
  }

  private async startAlertMonitoring(): Promise<void> {
    await this.alertService.startMonitoring();
  }

  private async startCacheWarming(): Promise<void> {
    await this.analyticsCacheService.startWarming();
  }

  // Additional endpoint handlers
  private async getDashboardWidgets(req: any, res: any): Promise<void> {
    try {
      const widgets = await this.dashboardService.getWidgets();
      res.json({ success: true, data: widgets });
    } catch (error) {
      this.logger.error('Failed to get dashboard widgets', { error });
      res.status(500).json({ success: false, error: 'Failed to get dashboard widgets' });
    }
  }

  private async getDashboardKPIs(req: any, res: any): Promise<void> {
    try {
      const kpis = await this.dashboardService.getKPIs();
      res.json({ success: true, data: kpis });
    } catch (error) {
      this.logger.error('Failed to get dashboard KPIs', { error });
      res.status(500).json({ success: false, error: 'Failed to get dashboard KPIs' });
    }
  }

  private async acknowledgeAlert(req: any, res: any): Promise<void> {
    try {
      const { alertId } = req.body;
      await this.alertService.acknowledgeAlert(alertId, req.user?.id);
      res.json({ success: true, message: 'Alert acknowledged' });
    } catch (error) {
      this.logger.error('Failed to acknowledge alert', { error });
      res.status(500).json({ success: false, error: 'Failed to acknowledge alert' });
    }
  }

  private async exportExcel(req: any, res: any): Promise<void> {
    try {
      const { data, filename } = req.body;
      const buffer = await this.exportService.exportToExcel(data, filename);
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
      res.send(buffer);
    } catch (error) {
      this.logger.error('Failed to export Excel', { error });
      res.status(500).json({ success: false, error: 'Failed to export Excel' });
    }
  }

  private async exportPDF(req: any, res: any): Promise<void> {
    try {
      const { data, template } = req.body;
      const buffer = await this.exportService.exportToPDF(data, template);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="report.pdf"`);
      res.send(buffer);
    } catch (error) {
      this.logger.error('Failed to export PDF', { error });
      res.status(500).json({ success: false, error: 'Failed to export PDF' });
    }
  }

  private async exportCSV(req: any, res: any): Promise<void> {
    try {
      const { data, filename } = req.body;
      const csv = await this.exportService.exportToCSV(data);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      res.send(csv);
    } catch (error) {
      this.logger.error('Failed to export CSV', { error });
      res.status(500).json({ success: false, error: 'Failed to export CSV' });
    }
  }

  private async getAlerts(req: any, res: any): Promise<void> {
    try {
      const alerts = await this.alertService.getActiveAlerts();
      res.json({ success: true, data: alerts });
    } catch (error) {
      this.logger.error('Failed to get alerts', { error });
      res.status(500).json({ success: false, error: 'Failed to get alerts' });
    }
  }

  private async configureAlert(req: any, res: any): Promise<void> {
    try {
      const config = req.body;
      const alertId = await this.alertService.configureAlert(config);
      res.json({ success: true, data: { alertId } });
    } catch (error) {
      this.logger.error('Failed to configure alert', { error });
      res.status(500).json({ success: false, error: 'Failed to configure alert' });
    }
  }

  private async updateAlertConfig(req: any, res: any): Promise<void> {
    try {
      const { id } = req.params;
      const config = req.body;
      await this.alertService.updateAlertConfig(id, config);
      res.json({ success: true, message: 'Alert config updated' });
    } catch (error) {
      this.logger.error('Failed to update alert config', { error });
      res.status(500).json({ success: false, error: 'Failed to update alert config' });
    }
  }

  private async deleteAlertConfig(req: any, res: any): Promise<void> {
    try {
      const { id } = req.params;
      await this.alertService.deleteAlertConfig(id);
      res.json({ success: true, message: 'Alert config deleted' });
    } catch (error) {
      this.logger.error('Failed to delete alert config', { error });
      res.status(500).json({ success: false, error: 'Failed to delete alert config' });
    }
  }

  private async clearCache(req: any, res: any): Promise<void> {
    try {
      await this.analyticsCacheService.clearAllCache();
      res.json({ success: true, message: 'Cache cleared' });
    } catch (error) {
      this.logger.error('Failed to clear cache', { error });
      res.status(500).json({ success: false, error: 'Failed to clear cache' });
    }
  }

  private async getCacheStats(req: any, res: any): Promise<void> {
    try {
      const stats = await this.analyticsCacheService.getStats();
      res.json({ success: true, data: stats });
    } catch (error) {
      this.logger.error('Failed to get cache stats', { error });
      res.status(500).json({ success: false, error: 'Failed to get cache stats' });
    }
  }

  private async warmCache(req: any, res: any): Promise<void> {
    try {
      await this.analyticsCacheService.warmCache();
      res.json({ success: true, message: 'Cache warming started' });
    } catch (error) {
      this.logger.error('Failed to warm cache', { error });
      res.status(500).json({ success: false, error: 'Failed to warm cache' });
    }
  }
}