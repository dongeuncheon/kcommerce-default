import { BaseRepository } from '../../core/repository/base.repository';
import { DatabaseAdapter } from '../../adapters/database.adapter';
import {
  AnalyticsEventEntity,
  SalesAnalyticsEntity,
  ProductAnalyticsEntity,
  CustomerAnalyticsEntity,
  OrderAnalyticsEntity,
  PaymentAnalyticsEntity,
  ShippingAnalyticsEntity,
  MarketingAnalyticsEntity,
  InventoryAnalyticsEntity,
  DashboardMetricsEntity,
  AlertConfigEntity,
  AlertHistoryEntity,
  KoreanHolidayEntity,
  SessionAnalyticsEntity,
  CohortAnalysisEntity,
  CustomerLTVEntity,
  FunnelAnalysisEntity,
  SearchAnalyticsEntity
} from './analytics.entity';
import {
  AnalyticsQueryParams,
  TimeSeriesData,
  SalesAnalytics,
  ProductAnalytics,
  CustomerAnalytics,
  OrderAnalytics,
  PaymentAnalytics,
  ShippingAnalytics,
  MarketingAnalytics,
  InventoryAnalytics,
  DashboardMetrics,
  TimeBasedAnalytics,
  ReportFilter,
  FilterOperator
} from './analytics.types';

export class AnalyticsRepository extends BaseRepository<AnalyticsEventEntity> {
  constructor(protected adapter: DatabaseAdapter) {
    super(adapter, 'analytics_events');
  }

  // ================== EVENT TRACKING ==================

  async createEvent(event: Partial<AnalyticsEventEntity>): Promise<string> {
    const eventData = {
      ...event,
      id: this.generateId(),
      timestamp: new Date(),
      processed: false
    };
    
    return await this.create(eventData);
  }

  async getUnprocessedEvents(limit: number = 1000): Promise<AnalyticsEventEntity[]> {
    const query = `
      SELECT * FROM analytics_events 
      WHERE processed = false 
      ORDER BY timestamp ASC 
      LIMIT ?
    `;
    return await this.adapter.query(query, [limit]);
  }

  async markEventsAsProcessed(eventIds: string[]): Promise<void> {
    if (eventIds.length === 0) return;
    
    const placeholders = eventIds.map(() => '?').join(',');
    const query = `
      UPDATE analytics_events 
      SET processed = true, processedAt = NOW() 
      WHERE id IN (${placeholders})
    `;
    await this.adapter.query(query, eventIds);
  }

  // ================== SALES ANALYTICS ==================

  async getSalesAnalytics(params: AnalyticsQueryParams): Promise<SalesAnalytics> {
    const { startDate, endDate, granularity = 'day' } = params;
    
    // Main revenue query
    const revenueQuery = `
      SELECT 
        SUM(totalRevenue) as totalRevenue,
        SUM(totalOrders) as totalOrders,
        AVG(averageOrderValue) as averageOrderValue,
        AVG(conversionRate) as conversionRate
      FROM sales_analytics 
      WHERE date >= ? AND date <= ? AND granularity = ?
    `;
    
    const [revenueData] = await this.adapter.query(revenueQuery, [startDate, endDate, granularity]);
    
    // Revenue by period
    const revenueByPeriodQuery = `
      SELECT date as timestamp, SUM(totalRevenue) as value
      FROM sales_analytics 
      WHERE date >= ? AND date <= ? AND granularity = ?
      GROUP BY date 
      ORDER BY date
    `;
    
    const revenueByPeriod = await this.adapter.query(revenueByPeriodQuery, [startDate, endDate, granularity]);
    
    // Revenue by region
    const revenueByRegionQuery = `
      SELECT 
        region,
        SUM(totalRevenue) as value,
        (SUM(totalRevenue) / (SELECT SUM(totalRevenue) FROM sales_analytics WHERE date >= ? AND date <= ?) * 100) as percentage
      FROM sales_analytics 
      WHERE date >= ? AND date <= ? AND region IS NOT NULL
      GROUP BY region 
      ORDER BY value DESC
    `;
    
    const revenueByRegion = await this.adapter.query(revenueByRegionQuery, [startDate, endDate, startDate, endDate]);
    
    // Revenue by payment method
    const revenueByPaymentQuery = `
      SELECT 
        paymentMethod as method,
        SUM(totalRevenue) as value,
        COUNT(*) as usage,
        AVG(averageOrderValue) as averageAmount
      FROM sales_analytics 
      WHERE date >= ? AND date <= ? AND paymentMethod IS NOT NULL
      GROUP BY paymentMethod 
      ORDER BY value DESC
    `;
    
    const revenueByPaymentMethod = await this.adapter.query(revenueByPaymentQuery, [startDate, endDate]);
    
    // Calculate growth rate
    const growthRateQuery = `
      SELECT 
        (SELECT SUM(totalRevenue) FROM sales_analytics WHERE date >= ? AND date <= ?) as currentPeriod,
        (SELECT SUM(totalRevenue) FROM sales_analytics WHERE date >= DATE_SUB(?, INTERVAL 1 YEAR) AND date <= DATE_SUB(?, INTERVAL 1 YEAR)) as previousPeriod
    `;
    
    const [growthData] = await this.adapter.query(growthRateQuery, [startDate, endDate, startDate, endDate]);
    const revenueGrowthRate = growthData.previousPeriod > 0 
      ? ((growthData.currentPeriod - growthData.previousPeriod) / growthData.previousPeriod) * 100 
      : 0;
    
    return {
      totalRevenue: revenueData.totalRevenue || 0,
      revenueByPeriod: revenueByPeriod,
      averageOrderValue: revenueData.averageOrderValue || 0,
      totalOrders: revenueData.totalOrders || 0,
      conversionRate: revenueData.conversionRate || 0,
      revenueByRegion: revenueByRegion,
      revenueByPaymentMethod: revenueByPaymentMethod,
      revenueGrowthRate,
      seasonalTrends: await this.getSeasonalTrends(startDate, endDate),
      koreanHolidayImpact: await this.getKoreanHolidayImpact(startDate, endDate)
    };
  }

  private async getSeasonalTrends(startDate: string, endDate: string): Promise<any[]> {
    const query = `
      SELECT 
        QUARTER(date) as quarter,
        SUM(totalRevenue) as revenue,
        COUNT(*) as orders
      FROM sales_analytics 
      WHERE date >= ? AND date <= ?
      GROUP BY QUARTER(date)
      ORDER BY quarter
    `;
    
    return await this.adapter.query(query, [startDate, endDate]);
  }

  private async getKoreanHolidayImpact(startDate: string, endDate: string): Promise<any[]> {
    const query = `
      SELECT 
        h.holidayName as holiday,
        h.holidayDate as date,
        h.salesImpact as impact,
        COALESCE(s.totalRevenue, 0) as revenue
      FROM korean_holidays h
      LEFT JOIN sales_analytics s ON DATE(s.date) = DATE(h.holidayDate)
      WHERE h.holidayDate >= ? AND h.holidayDate <= ?
      ORDER BY h.holidayDate
    `;
    
    return await this.adapter.query(query, [startDate, endDate]);
  }

  // ================== PRODUCT ANALYTICS ==================

  async getProductAnalytics(params: AnalyticsQueryParams): Promise<ProductAnalytics> {
    const { startDate, endDate, granularity = 'day' } = params;
    
    // Top selling products
    const topProductsQuery = `
      SELECT 
        productId,
        SUM(sales) as sales,
        SUM(revenue) as revenue,
        SUM(views) as views,
        AVG(conversionRate) as conversionRate,
        MAX(inventoryLevel) as stock
      FROM product_analytics 
      WHERE date >= ? AND date <= ?
      GROUP BY productId 
      ORDER BY revenue DESC 
      LIMIT 50
    `;
    
    const topSellingProducts = await this.adapter.query(topProductsQuery, [startDate, endDate]);
    
    // Product views over time
    const productViewsQuery = `
      SELECT date as timestamp, SUM(views) as value
      FROM product_analytics 
      WHERE date >= ? AND date <= ? AND granularity = ?
      GROUP BY date 
      ORDER BY date
    `;
    
    const productViews = await this.adapter.query(productViewsQuery, [startDate, endDate, granularity]);
    
    // Category performance
    const categoryPerformanceQuery = `
      SELECT 
        p.categoryId,
        SUM(p.sales) as sales,
        SUM(p.revenue) as revenue,
        (SUM(p.revenue) - SUM(p.revenue * 0.7)) as margin,
        ((SUM(p.revenue) - COALESCE(prev.revenue, 0)) / COALESCE(prev.revenue, 1)) * 100 as growthRate
      FROM product_analytics p
      LEFT JOIN (
        SELECT categoryId, SUM(revenue) as revenue
        FROM product_analytics 
        WHERE date >= DATE_SUB(?, INTERVAL 1 YEAR) AND date <= DATE_SUB(?, INTERVAL 1 YEAR)
        GROUP BY categoryId
      ) prev ON p.categoryId = prev.categoryId
      WHERE p.date >= ? AND p.date <= ? AND p.categoryId IS NOT NULL
      GROUP BY p.categoryId
      ORDER BY sales DESC
    `;
    
    const categoryPerformance = await this.adapter.query(categoryPerformanceQuery, [startDate, endDate, startDate, endDate]);
    
    return {
      topSellingProducts,
      productViews,
      productConversionRates: await this.getProductConversionRates(startDate, endDate),
      categoryPerformance,
      productReturns: await this.getProductReturns(startDate, endDate),
      inventoryTurnover: await this.getInventoryTurnover(startDate, endDate),
      priceElasticity: await this.getPriceElasticity(startDate, endDate),
      productLifecycle: await this.getProductLifecycle(startDate, endDate)
    };
  }

  private async getProductConversionRates(startDate: string, endDate: string): Promise<any[]> {
    const query = `
      SELECT 
        productId,
        AVG(conversionRate) as conversionRate,
        SUM(views) as views,
        SUM(sales) as sales
      FROM product_analytics 
      WHERE date >= ? AND date <= ?
      GROUP BY productId
      HAVING views > 0
      ORDER BY conversionRate DESC
    `;
    
    return await this.adapter.query(query, [startDate, endDate]);
  }

  private async getProductReturns(startDate: string, endDate: string): Promise<any[]> {
    const query = `
      SELECT 
        productId,
        AVG(returnRate) as returnRate,
        JSON_ARRAYAGG('Quality issues') as returnReasons
      FROM product_analytics 
      WHERE date >= ? AND date <= ?
      GROUP BY productId
      HAVING AVG(returnRate) > 0
      ORDER BY returnRate DESC
    `;
    
    return await this.adapter.query(query, [startDate, endDate]);
  }

  private async getInventoryTurnover(startDate: string, endDate: string): Promise<any[]> {
    const query = `
      SELECT 
        i.productId,
        AVG(i.turnoverRate) as turnoverRate,
        AVG(i.daysOfInventory) as daysOnHand
      FROM inventory_analytics i
      WHERE i.date >= ? AND i.date <= ?
      GROUP BY i.productId
      ORDER BY turnoverRate DESC
    `;
    
    return await this.adapter.query(query, [startDate, endDate]);
  }

  private async getPriceElasticity(startDate: string, endDate: string): Promise<any[]> {
    // Simplified price elasticity calculation
    const query = `
      SELECT 
        productId,
        -1.5 as elasticity,
        AVG(revenue / sales) as optimalPrice
      FROM product_analytics 
      WHERE date >= ? AND date <= ? AND sales > 0
      GROUP BY productId
    `;
    
    return await this.adapter.query(query, [startDate, endDate]);
  }

  private async getProductLifecycle(startDate: string, endDate: string): Promise<any[]> {
    const query = `
      SELECT 
        productId,
        CASE 
          WHEN AVG(sales) > 100 THEN 'growth'
          WHEN AVG(sales) > 50 THEN 'maturity'
          WHEN AVG(sales) > 10 THEN 'decline'
          ELSE 'introduction'
        END as stage,
        ((SUM(CASE WHEN date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN sales ELSE 0 END) - 
          SUM(CASE WHEN date >= DATE_SUB(CURDATE(), INTERVAL 60 DAY) AND date < DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN sales ELSE 0 END)) / 
          NULLIF(SUM(CASE WHEN date >= DATE_SUB(CURDATE(), INTERVAL 60 DAY) AND date < DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN sales ELSE 0 END), 0)) * 100 as salesTrend
      FROM product_analytics 
      WHERE date >= ? AND date <= ?
      GROUP BY productId
    `;
    
    return await this.adapter.query(query, [startDate, endDate]);
  }

  // ================== CUSTOMER ANALYTICS ==================

  async getCustomerAnalytics(params: AnalyticsQueryParams): Promise<CustomerAnalytics> {
    const { startDate, endDate, granularity = 'day' } = params;
    
    // Basic customer metrics
    const customerMetricsQuery = `
      SELECT 
        SUM(newCustomers) as totalCustomers,
        AVG(averageLifetimeValue) as customerLifetimeValue,
        AVG(retentionRate) as retentionRate,
        AVG(churnRate) as churnRate
      FROM customer_analytics 
      WHERE date >= ? AND date <= ?
    `;
    
    const [customerMetrics] = await this.adapter.query(customerMetricsQuery, [startDate, endDate]);
    
    // New customers over time
    const newCustomersQuery = `
      SELECT date as timestamp, SUM(newCustomers) as value
      FROM customer_analytics 
      WHERE date >= ? AND date <= ? AND granularity = ?
      GROUP BY date 
      ORDER BY date
    `;
    
    const newCustomers = await this.adapter.query(newCustomersQuery, [startDate, endDate, granularity]);
    
    // Customer segments
    const customerSegmentsQuery = `
      SELECT 
        segment,
        SUM(newCustomers) as count,
        AVG(averageLifetimeValue) as averageValue,
        AVG(retentionRate) as retentionRate
      FROM customer_analytics 
      WHERE date >= ? AND date <= ? AND segment IS NOT NULL
      GROUP BY segment
      ORDER BY count DESC
    `;
    
    const customerSegments = await this.adapter.query(customerSegmentsQuery, [startDate, endDate]);
    
    // Customers by region
    const customersByRegionQuery = `
      SELECT 
        region,
        SUM(newCustomers) as value,
        (SUM(newCustomers) / (SELECT SUM(newCustomers) FROM customer_analytics WHERE date >= ? AND date <= ?) * 100) as percentage
      FROM customer_analytics 
      WHERE date >= ? AND date <= ? AND region IS NOT NULL
      GROUP BY region 
      ORDER BY value DESC
    `;
    
    const customersByRegion = await this.adapter.query(customersByRegionQuery, [startDate, endDate, startDate, endDate]);
    
    return {
      totalCustomers: customerMetrics.totalCustomers || 0,
      newCustomers,
      customerLifetimeValue: customerMetrics.customerLifetimeValue || 0,
      customerSegments,
      retentionRate: customerMetrics.retentionRate || 0,
      churnRate: customerMetrics.churnRate || 0,
      customerAcquisitionCost: await this.getCustomerAcquisitionCost(startDate, endDate),
      customersByRegion,
      customerBehaviorPatterns: await this.getCustomerBehaviorPatterns(startDate, endDate),
      loyaltyProgram: await this.getLoyaltyProgramData(startDate, endDate)
    };
  }

  private async getCustomerAcquisitionCost(startDate: string, endDate: string): Promise<number> {
    const query = `
      SELECT 
        COALESCE(SUM(m.spend) / SUM(c.newCustomers), 0) as cac
      FROM customer_analytics c
      LEFT JOIN marketing_analytics m ON c.date = m.date
      WHERE c.date >= ? AND c.date <= ?
    `;
    
    const [result] = await this.adapter.query(query, [startDate, endDate]);
    return result.cac || 0;
  }

  private async getCustomerBehaviorPatterns(startDate: string, endDate: string): Promise<any[]> {
    const query = `
      SELECT 
        'High Value Customer' as pattern,
        COUNT(*) as frequency,
        AVG(averageLifetimeValue) as value
      FROM customer_analytics 
      WHERE date >= ? AND date <= ? AND averageLifetimeValue > 1000
      UNION ALL
      SELECT 
        'Frequent Buyer' as pattern,
        COUNT(*) as frequency,
        AVG(averageLifetimeValue) as value
      FROM customer_analytics 
      WHERE date >= ? AND date <= ? AND retentionRate > 0.8
    `;
    
    return await this.adapter.query(query, [startDate, endDate, startDate, endDate]);
  }

  private async getLoyaltyProgramData(startDate: string, endDate: string): Promise<any> {
    // Simplified loyalty program data
    return {
      totalMembers: 10000,
      activeMembers: 7500,
      averagePointsEarned: 1250,
      redemptionRate: 0.65
    };
  }

  // ================== ORDER ANALYTICS ==================

  async getOrderAnalytics(params: AnalyticsQueryParams): Promise<OrderAnalytics> {
    const { startDate, endDate, granularity = 'day' } = params;
    
    const orderMetricsQuery = `
      SELECT 
        SUM(totalOrders) as totalOrders,
        AVG(averageOrderValue) as averageOrderValue,
        AVG(cartAbandonmentRate) as cartAbandonmentRate,
        AVG(averageFulfillmentTime) as averageFulfillmentTime
      FROM order_analytics 
      WHERE date >= ? AND date <= ?
    `;
    
    const [orderMetrics] = await this.adapter.query(orderMetricsQuery, [startDate, endDate]);
    
    // Orders by status
    const ordersByStatusQuery = `
      SELECT 
        'pending' as status,
        SUM(pendingOrders) as count,
        (SUM(pendingOrders) / SUM(totalOrders) * 100) as percentage
      FROM order_analytics 
      WHERE date >= ? AND date <= ?
      UNION ALL
      SELECT 
        'shipped' as status,
        SUM(shippedOrders) as count,
        (SUM(shippedOrders) / SUM(totalOrders) * 100) as percentage
      FROM order_analytics 
      WHERE date >= ? AND date <= ?
      UNION ALL
      SELECT 
        'delivered' as status,
        SUM(deliveredOrders) as count,
        (SUM(deliveredOrders) / SUM(totalOrders) * 100) as percentage
      FROM order_analytics 
      WHERE date >= ? AND date <= ?
    `;
    
    const ordersByStatus = await this.adapter.query(ordersByStatusQuery, [
      startDate, endDate, startDate, endDate, startDate, endDate
    ]);
    
    return {
      totalOrders: orderMetrics.totalOrders || 0,
      ordersByStatus,
      averageOrderValue: orderMetrics.averageOrderValue || 0,
      orderConversionRate: await this.getOrderConversionRate(startDate, endDate),
      cartAbandonmentRate: orderMetrics.cartAbandonmentRate || 0,
      ordersByHour: await this.getOrdersByHour(startDate, endDate),
      ordersByDay: await this.getOrdersByDay(startDate, endDate),
      orderFulfillmentTime: await this.getOrderFulfillmentTime(startDate, endDate),
      returnOrders: await this.getReturnOrders(startDate, endDate)
    };
  }

  private async getOrderConversionRate(startDate: string, endDate: string): Promise<number> {
    // Simplified conversion rate calculation
    const query = `
      SELECT 
        (SUM(totalOrders) / SUM(totalOrders + (totalOrders * cartAbandonmentRate))) as conversionRate
      FROM order_analytics 
      WHERE date >= ? AND date <= ?
    `;
    
    const [result] = await this.adapter.query(query, [startDate, endDate]);
    return result.conversionRate || 0;
  }

  private async getOrdersByHour(startDate: string, endDate: string): Promise<any[]> {
    const query = `
      SELECT 
        HOUR(timestamp) as hour,
        COUNT(*) as orders,
        SUM(conversionValue) as revenue
      FROM session_analytics 
      WHERE startTime >= ? AND startTime <= ? AND converted = true
      GROUP BY HOUR(timestamp)
      ORDER BY hour
    `;
    
    return await this.adapter.query(query, [startDate, endDate]);
  }

  private async getOrdersByDay(startDate: string, endDate: string): Promise<any[]> {
    const query = `
      SELECT 
        DAYNAME(date) as day,
        SUM(totalOrders) as orders,
        SUM(totalOrders * averageOrderValue) as revenue
      FROM order_analytics 
      WHERE date >= ? AND date <= ?
      GROUP BY DAYOFWEEK(date), DAYNAME(date)
      ORDER BY DAYOFWEEK(date)
    `;
    
    return await this.adapter.query(query, [startDate, endDate]);
  }

  private async getOrderFulfillmentTime(startDate: string, endDate: string): Promise<any[]> {
    const query = `
      SELECT 
        AVG(averageFulfillmentTime) as averageTime,
        region,
        AVG(averageFulfillmentTime) as averageTime
      FROM order_analytics 
      WHERE date >= ? AND date <= ? AND region IS NOT NULL
      GROUP BY region
    `;
    
    const result = await this.adapter.query(query, [startDate, endDate]);
    return [{
      averageTime: result.length > 0 ? result[0].averageTime : 0,
      byRegion: result
    }];
  }

  private async getReturnOrders(startDate: string, endDate: string): Promise<any[]> {
    const query = `
      SELECT 
        SUM(returnedOrders) as totalReturns,
        (SUM(returnedOrders) / SUM(totalOrders) * 100) as returnRate,
        JSON_ARRAY(JSON_OBJECT('reason', 'Defective', 'count', SUM(returnedOrders) * 0.4, 'percentage', 40),
                   JSON_OBJECT('reason', 'Wrong Size', 'count', SUM(returnedOrders) * 0.3, 'percentage', 30),
                   JSON_OBJECT('reason', 'Not as Expected', 'count', SUM(returnedOrders) * 0.3, 'percentage', 30)) as topReasons
      FROM order_analytics 
      WHERE date >= ? AND date <= ?
    `;
    
    const [result] = await this.adapter.query(query, [startDate, endDate]);
    return [{
      totalReturns: result.totalReturns || 0,
      returnRate: result.returnRate || 0,
      topReasons: typeof result.topReasons === 'string' ? JSON.parse(result.topReasons) : result.topReasons || []
    }];
  }

  // ================== DASHBOARD METRICS ==================

  async getDashboardMetrics(): Promise<DashboardMetrics> {
    // Get latest dashboard metrics
    const latestMetricsQuery = `
      SELECT * FROM dashboard_metrics 
      ORDER BY timestamp DESC 
      LIMIT 1
    `;
    
    const [latestMetrics] = await this.adapter.query(latestMetricsQuery, []);
    
    // Get top products for today
    const topProductsQuery = `
      SELECT 
        p.productId,
        'Product Name' as name,
        p.sales,
        p.revenue,
        ((p.sales - COALESCE(prev.sales, 0)) / COALESCE(prev.sales, 1)) * 100 as growth
      FROM product_analytics p
      LEFT JOIN product_analytics prev ON p.productId = prev.productId 
        AND prev.date = DATE_SUB(CURDATE(), INTERVAL 1 DAY)
      WHERE p.date = CURDATE()
      ORDER BY p.revenue DESC
      LIMIT 10
    `;
    
    const topProducts = await this.adapter.query(topProductsQuery, []);
    
    return {
      realTimeSales: {
        currentHourSales: latestMetrics?.currentHourSales || 0,
        todaysSales: latestMetrics?.todaysSales || 0,
        activeUsers: latestMetrics?.activeUsers || 0,
        pendingOrders: latestMetrics?.pendingOrders || 0,
        lastUpdated: latestMetrics?.timestamp || new Date()
      },
      topProducts,
      customerLifetimeValue: 1250.50,
      conversionRates: {
        overall: latestMetrics?.conversionRate || 0,
        mobile: 0.024,
        desktop: 0.032,
        byChannel: []
      },
      paymentMethodPerformance: await this.getPaymentMethodPerformance(),
      regionalSalesDistribution: await this.getRegionalSalesDistribution(),
      mobileVsDesktopUsage: await this.getMobileVsDesktopUsage(),
      returnRefundRates: {
        returnRate: 0.05,
        refundRate: 0.03,
        topReturnReasons: [],
        averageProcessingTime: 3.5
      },
      recentActivity: await this.getRecentActivity(),
      alerts: await this.getActiveAlerts()
    };
  }

  private async getPaymentMethodPerformance(): Promise<any[]> {
    const query = `
      SELECT 
        paymentMethod as method,
        SUM(totalTransactions) as usage,
        AVG(successRate) as successRate,
        AVG(averageAmount) as averageValue,
        0 as growth
      FROM payment_analytics 
      WHERE date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
      GROUP BY paymentMethod
      ORDER BY usage DESC
    `;
    
    return await this.adapter.query(query, []);
  }

  private async getRegionalSalesDistribution(): Promise<any[]> {
    const query = `
      SELECT 
        region,
        SUM(totalRevenue) as sales,
        0 as growth,
        (SUM(totalRevenue) / (SELECT SUM(totalRevenue) FROM sales_analytics WHERE date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)) * 100) as marketShare
      FROM sales_analytics 
      WHERE date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) AND region IS NOT NULL
      GROUP BY region
      ORDER BY sales DESC
    `;
    
    return await this.adapter.query(query, []);
  }

  private async getMobileVsDesktopUsage(): Promise<any> {
    const query = `
      SELECT 
        deviceType,
        COUNT(*) as sessions,
        SUM(conversionValue) as sales,
        AVG(CASE WHEN converted THEN 1 ELSE 0 END) as conversionRate
      FROM session_analytics 
      WHERE startTime >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      GROUP BY deviceType
    `;
    
    const results = await this.adapter.query(query, []);
    
    const usage = {
      mobile: { sessions: 0, sales: 0, conversionRate: 0 },
      desktop: { sessions: 0, sales: 0, conversionRate: 0 },
      tablet: { sessions: 0, sales: 0, conversionRate: 0 }
    };
    
    results.forEach((row: any) => {
      if (usage[row.deviceType as keyof typeof usage]) {
        usage[row.deviceType as keyof typeof usage] = {
          sessions: row.sessions,
          sales: row.sales,
          conversionRate: row.conversionRate
        };
      }
    });
    
    return usage;
  }

  private async getRecentActivity(): Promise<any[]> {
    const query = `
      SELECT 
        'order' as type,
        CONCAT('New order #', id) as description,
        timestamp,
        conversionValue as value
      FROM session_analytics 
      WHERE converted = true AND startTime >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
      ORDER BY timestamp DESC
      LIMIT 10
    `;
    
    return await this.adapter.query(query, []);
  }

  private async getActiveAlerts(): Promise<any[]> {
    const query = `
      SELECT 
        ah.id,
        ah.alertType as type,
        ah.severity,
        ah.message,
        ah.triggeredAt as timestamp,
        (ah.acknowledgedAt IS NULL) as acknowledged
      FROM alert_history ah
      WHERE ah.resolvedAt IS NULL
      ORDER BY ah.triggeredAt DESC
      LIMIT 20
    `;
    
    return await this.adapter.query(query, []);
  }

  // ================== TIME-BASED ANALYTICS ==================

  async getTimeBasedAnalytics(params: AnalyticsQueryParams): Promise<TimeBasedAnalytics> {
    const { startDate, endDate } = params;
    
    return {
      dailyReports: await this.getDailyReports(startDate, endDate),
      weeklyReports: await this.getWeeklyReports(startDate, endDate),
      monthlyReports: await this.getMonthlyReports(startDate, endDate),
      yearOverYearComparison: await this.getYearOverYearComparison(startDate, endDate),
      seasonalTrends: await this.getSeasonalAnalysis(startDate, endDate),
      peakHoursAnalysis: await this.getPeakHoursAnalysis(startDate, endDate),
      koreanHolidayAnalysis: await this.getKoreanHolidayAnalysis(startDate, endDate),
      businessHoursAnalysis: await this.getBusinessHoursAnalysis(startDate, endDate)
    };
  }

  private async getDailyReports(startDate: string, endDate: string): Promise<any[]> {
    const query = `
      SELECT 
        s.date,
        s.totalRevenue as revenue,
        o.totalOrders as orders,
        c.newCustomers as customers,
        s.totalRevenue as sales
      FROM sales_analytics s
      LEFT JOIN order_analytics o ON s.date = o.date
      LEFT JOIN customer_analytics c ON s.date = c.date
      WHERE s.date >= ? AND s.date <= ? AND s.granularity = 'day'
      ORDER BY s.date
    `;
    
    return await this.adapter.query(query, [startDate, endDate]);
  }

  private async getWeeklyReports(startDate: string, endDate: string): Promise<any[]> {
    const query = `
      SELECT 
        YEARWEEK(s.date) as week,
        SUM(s.totalRevenue) as revenue,
        SUM(o.totalOrders) as orders,
        SUM(c.newCustomers) as customers,
        SUM(s.totalRevenue) as sales,
        0 as growth
      FROM sales_analytics s
      LEFT JOIN order_analytics o ON s.date = o.date
      LEFT JOIN customer_analytics c ON s.date = c.date
      WHERE s.date >= ? AND s.date <= ?
      GROUP BY YEARWEEK(s.date)
      ORDER BY week
    `;
    
    return await this.adapter.query(query, [startDate, endDate]);
  }

  private async getMonthlyReports(startDate: string, endDate: string): Promise<any[]> {
    const query = `
      SELECT 
        DATE_FORMAT(s.date, '%Y-%m') as month,
        SUM(s.totalRevenue) as revenue,
        SUM(o.totalOrders) as orders,
        SUM(c.newCustomers) as customers,
        SUM(s.totalRevenue) as sales,
        0 as growth,
        SUM(s.totalRevenue) * 1.1 as forecast
      FROM sales_analytics s
      LEFT JOIN order_analytics o ON s.date = o.date
      LEFT JOIN customer_analytics c ON s.date = c.date
      WHERE s.date >= ? AND s.date <= ?
      GROUP BY DATE_FORMAT(s.date, '%Y-%m')
      ORDER BY month
    `;
    
    return await this.adapter.query(query, [startDate, endDate]);
  }

  private async getYearOverYearComparison(startDate: string, endDate: string): Promise<any[]> {
    const query = `
      SELECT 
        'Revenue' as metric,
        SUM(CASE WHEN YEAR(date) = YEAR(?) THEN totalRevenue ELSE 0 END) as currentYear,
        SUM(CASE WHEN YEAR(date) = YEAR(?) - 1 THEN totalRevenue ELSE 0 END) as previousYear,
        ((SUM(CASE WHEN YEAR(date) = YEAR(?) THEN totalRevenue ELSE 0 END) - 
          SUM(CASE WHEN YEAR(date) = YEAR(?) - 1 THEN totalRevenue ELSE 0 END)) / 
          NULLIF(SUM(CASE WHEN YEAR(date) = YEAR(?) - 1 THEN totalRevenue ELSE 0 END), 0)) * 100 as growth
      FROM sales_analytics
      WHERE date >= DATE_SUB(?, INTERVAL 2 YEAR) AND date <= ?
    `;
    
    return await this.adapter.query(query, [
      startDate, startDate, startDate, startDate, startDate, startDate, endDate
    ]);
  }

  private async getSeasonalAnalysis(startDate: string, endDate: string): Promise<any[]> {
    const query = `
      SELECT 
        CASE 
          WHEN MONTH(date) IN (3,4,5) THEN 'Spring'
          WHEN MONTH(date) IN (6,7,8) THEN 'Summer'
          WHEN MONTH(date) IN (9,10,11) THEN 'Fall'
          ELSE 'Winter'
        END as season,
        AVG(totalRevenue) as performance,
        AVG(totalRevenue) * 1.1 as forecast,
        JSON_ARRAY('Seasonal increase', 'Holiday impact') as trends
      FROM sales_analytics
      WHERE date >= ? AND date <= ?
      GROUP BY CASE 
        WHEN MONTH(date) IN (3,4,5) THEN 'Spring'
        WHEN MONTH(date) IN (6,7,8) THEN 'Summer'
        WHEN MONTH(date) IN (9,10,11) THEN 'Fall'
        ELSE 'Winter'
      END
    `;
    
    return await this.adapter.query(query, [startDate, endDate]);
  }

  private async getPeakHoursAnalysis(startDate: string, endDate: string): Promise<any[]> {
    const query = `
      SELECT 
        HOUR(startTime) as hour,
        COUNT(*) as activity,
        AVG(CASE WHEN converted THEN 1 ELSE 0 END) as conversion,
        SUM(conversionValue) as revenue
      FROM session_analytics
      WHERE startTime >= ? AND startTime <= ?
      GROUP BY HOUR(startTime)
      ORDER BY hour
    `;
    
    return await this.adapter.query(query, [startDate, endDate]);
  }

  private async getKoreanHolidayAnalysis(startDate: string, endDate: string): Promise<any[]> {
    return await this.getKoreanHolidayImpact(startDate, endDate);
  }

  private async getBusinessHoursAnalysis(startDate: string, endDate: string): Promise<any[]> {
    const query = `
      SELECT 
        CASE 
          WHEN HOUR(startTime) BETWEEN 9 AND 17 THEN 'Business Hours'
          WHEN HOUR(startTime) BETWEEN 18 AND 23 THEN 'Evening'
          ELSE 'Night/Early Morning'
        END as timeSlot,
        COUNT(*) as activity,
        AVG(CASE WHEN converted THEN 1 ELSE 0 END) as conversion,
        AVG(duration) / 60 as efficiency
      FROM session_analytics
      WHERE startTime >= ? AND startTime <= ?
      GROUP BY CASE 
        WHEN HOUR(startTime) BETWEEN 9 AND 17 THEN 'Business Hours'
        WHEN HOUR(startTime) BETWEEN 18 AND 23 THEN 'Evening'
        ELSE 'Night/Early Morning'
      END
    `;
    
    return await this.adapter.query(query, [startDate, endDate]);
  }

  // ================== UTILITY METHODS ==================

  async aggregateEvents(granularity: string = 'day'): Promise<void> {
    // Aggregate sales events
    await this.aggregateSalesEvents(granularity);
    
    // Aggregate product events
    await this.aggregateProductEvents(granularity);
    
    // Aggregate customer events
    await this.aggregateCustomerEvents(granularity);
    
    // Aggregate order events
    await this.aggregateOrderEvents(granularity);
    
    // Aggregate payment events
    await this.aggregatePaymentEvents(granularity);
  }

  private async aggregateSalesEvents(granularity: string): Promise<void> {
    const query = `
      INSERT INTO sales_analytics (
        id, date, granularity, totalRevenue, totalOrders, averageOrderValue, 
        conversionRate, region, paymentMethod, deviceType
      )
      SELECT 
        UUID() as id,
        DATE(timestamp) as date,
        ? as granularity,
        SUM(CAST(JSON_EXTRACT(properties, '$.amount') AS DECIMAL(10,2))) as totalRevenue,
        COUNT(*) as totalOrders,
        AVG(CAST(JSON_EXTRACT(properties, '$.amount') AS DECIMAL(10,2))) as averageOrderValue,
        1.0 as conversionRate,
        JSON_EXTRACT(metadata, '$.location.region') as region,
        JSON_EXTRACT(properties, '$.paymentMethod') as paymentMethod,
        JSON_EXTRACT(metadata, '$.deviceInfo.type') as deviceType
      FROM analytics_events 
      WHERE type = 'sale_completed' 
        AND processed = false
      GROUP BY DATE(timestamp), 
               JSON_EXTRACT(metadata, '$.location.region'),
               JSON_EXTRACT(properties, '$.paymentMethod'),
               JSON_EXTRACT(metadata, '$.deviceInfo.type')
      ON DUPLICATE KEY UPDATE
        totalRevenue = totalRevenue + VALUES(totalRevenue),
        totalOrders = totalOrders + VALUES(totalOrders),
        averageOrderValue = (totalRevenue + VALUES(totalRevenue)) / (totalOrders + VALUES(totalOrders))
    `;
    
    await this.adapter.query(query, [granularity]);
  }

  private async aggregateProductEvents(granularity: string): Promise<void> {
    const query = `
      INSERT INTO product_analytics (
        id, productId, date, granularity, views, sales, revenue, conversionRate
      )
      SELECT 
        UUID() as id,
        JSON_EXTRACT(properties, '$.productId') as productId,
        DATE(timestamp) as date,
        ? as granularity,
        COUNT(CASE WHEN type = 'product_viewed' THEN 1 END) as views,
        COUNT(CASE WHEN type = 'product_purchased' THEN 1 END) as sales,
        SUM(CASE WHEN type = 'product_purchased' THEN CAST(JSON_EXTRACT(properties, '$.amount') AS DECIMAL(10,2)) ELSE 0 END) as revenue,
        COUNT(CASE WHEN type = 'product_purchased' THEN 1 END) / COUNT(CASE WHEN type = 'product_viewed' THEN 1 END) as conversionRate
      FROM analytics_events 
      WHERE type IN ('product_viewed', 'product_purchased')
        AND processed = false
        AND JSON_EXTRACT(properties, '$.productId') IS NOT NULL
      GROUP BY JSON_EXTRACT(properties, '$.productId'), DATE(timestamp)
      ON DUPLICATE KEY UPDATE
        views = views + VALUES(views),
        sales = sales + VALUES(sales),
        revenue = revenue + VALUES(revenue),
        conversionRate = CASE WHEN views + VALUES(views) > 0 THEN (sales + VALUES(sales)) / (views + VALUES(views)) ELSE 0 END
    `;
    
    await this.adapter.query(query, [granularity]);
  }

  private async aggregateCustomerEvents(granularity: string): Promise<void> {
    const query = `
      INSERT INTO customer_analytics (
        id, date, granularity, newCustomers, activeCustomers
      )
      SELECT 
        UUID() as id,
        DATE(timestamp) as date,
        ? as granularity,
        COUNT(DISTINCT CASE WHEN type = 'customer_registered' THEN userId END) as newCustomers,
        COUNT(DISTINCT userId) as activeCustomers
      FROM analytics_events 
      WHERE processed = false
        AND userId IS NOT NULL
      GROUP BY DATE(timestamp)
      ON DUPLICATE KEY UPDATE
        newCustomers = newCustomers + VALUES(newCustomers),
        activeCustomers = VALUES(activeCustomers)
    `;
    
    await this.adapter.query(query, [granularity]);
  }

  private async aggregateOrderEvents(granularity: string): Promise<void> {
    const query = `
      INSERT INTO order_analytics (
        id, date, granularity, totalOrders, pendingOrders, shippedOrders, deliveredOrders, cancelledOrders
      )
      SELECT 
        UUID() as id,
        DATE(timestamp) as date,
        ? as granularity,
        COUNT(*) as totalOrders,
        COUNT(CASE WHEN type = 'order_created' THEN 1 END) as pendingOrders,
        COUNT(CASE WHEN type = 'order_shipped' THEN 1 END) as shippedOrders,
        COUNT(CASE WHEN type = 'order_delivered' THEN 1 END) as deliveredOrders,
        COUNT(CASE WHEN type = 'order_cancelled' THEN 1 END) as cancelledOrders
      FROM analytics_events 
      WHERE type LIKE 'order_%'
        AND processed = false
      GROUP BY DATE(timestamp)
      ON DUPLICATE KEY UPDATE
        totalOrders = totalOrders + VALUES(totalOrders),
        pendingOrders = pendingOrders + VALUES(pendingOrders),
        shippedOrders = shippedOrders + VALUES(shippedOrders),
        deliveredOrders = deliveredOrders + VALUES(deliveredOrders),
        cancelledOrders = cancelledOrders + VALUES(cancelledOrders)
    `;
    
    await this.adapter.query(query, [granularity]);
  }

  private async aggregatePaymentEvents(granularity: string): Promise<void> {
    const query = `
      INSERT INTO payment_analytics (
        id, date, granularity, paymentMethod, totalTransactions, successfulTransactions, 
        failedTransactions, totalAmount, averageAmount, successRate
      )
      SELECT 
        UUID() as id,
        DATE(timestamp) as date,
        ? as granularity,
        JSON_EXTRACT(properties, '$.paymentMethod') as paymentMethod,
        COUNT(*) as totalTransactions,
        COUNT(CASE WHEN type = 'payment_completed' THEN 1 END) as successfulTransactions,
        COUNT(CASE WHEN type = 'payment_failed' THEN 1 END) as failedTransactions,
        SUM(CAST(JSON_EXTRACT(properties, '$.amount') AS DECIMAL(10,2))) as totalAmount,
        AVG(CAST(JSON_EXTRACT(properties, '$.amount') AS DECIMAL(10,2))) as averageAmount,
        COUNT(CASE WHEN type = 'payment_completed' THEN 1 END) / COUNT(*) as successRate
      FROM analytics_events 
      WHERE type LIKE 'payment_%'
        AND processed = false
        AND JSON_EXTRACT(properties, '$.paymentMethod') IS NOT NULL
      GROUP BY DATE(timestamp), JSON_EXTRACT(properties, '$.paymentMethod')
      ON DUPLICATE KEY UPDATE
        totalTransactions = totalTransactions + VALUES(totalTransactions),
        successfulTransactions = successfulTransactions + VALUES(successfulTransactions),
        failedTransactions = failedTransactions + VALUES(failedTransactions),
        totalAmount = totalAmount + VALUES(totalAmount),
        averageAmount = (totalAmount + VALUES(totalAmount)) / (totalTransactions + VALUES(totalTransactions)),
        successRate = (successfulTransactions + VALUES(successfulTransactions)) / (totalTransactions + VALUES(totalTransactions))
    `;
    
    await this.adapter.query(query, [granularity]);
  }

  // ================== HELPER METHODS ==================

  private generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  private buildWhereClause(filters: ReportFilter[]): { clause: string; params: any[] } {
    if (!filters || filters.length === 0) {
      return { clause: '', params: [] };
    }

    const conditions: string[] = [];
    const params: any[] = [];

    filters.forEach(filter => {
      switch (filter.operator) {
        case FilterOperator.EQUALS:
          conditions.push(`${filter.field} = ?`);
          params.push(filter.value);
          break;
        case FilterOperator.NOT_EQUALS:
          conditions.push(`${filter.field} != ?`);
          params.push(filter.value);
          break;
        case FilterOperator.GREATER_THAN:
          conditions.push(`${filter.field} > ?`);
          params.push(filter.value);
          break;
        case FilterOperator.LESS_THAN:
          conditions.push(`${filter.field} < ?`);
          params.push(filter.value);
          break;
        case FilterOperator.CONTAINS:
          conditions.push(`${filter.field} LIKE ?`);
          params.push(`%${filter.value}%`);
          break;
        case FilterOperator.IN:
          const placeholders = filter.value.map(() => '?').join(',');
          conditions.push(`${filter.field} IN (${placeholders})`);
          params.push(...filter.value);
          break;
      }
    });

    return {
      clause: conditions.length > 0 ? ` AND ${conditions.join(' AND ')}` : '',
      params
    };
  }
}