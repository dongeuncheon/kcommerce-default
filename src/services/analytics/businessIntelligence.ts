import { PrismaClient } from '@prisma/client';
import { cacheService } from '../cacheService';
import { logger } from '../../utils/logger';

export interface CustomerSegment {
  id: string;
  name: string;
  count: number;
  totalRevenue: number;
  averageOrderValue: number;
  orderFrequency: number;
  characteristics: string[];
}

export interface SalesAnalysis {
  revenue: {
    current: number;
    previous: number;
    growth: number;
    forecast: number;
  };
  orders: {
    current: number;
    previous: number;
    growth: number;
    conversionRate: number;
  };
  trends: Array<{
    period: string;
    revenue: number;
    orders: number;
    customers: number;
  }>;
  seasonality: {
    monthly: Record<string, number>;
    weekly: Record<string, number>;
    hourly: Record<string, number>;
  };
}

export interface ProductPerformance {
  topProducts: Array<{
    id: string;
    name: string;
    revenue: number;
    units: number;
    profit: number;
    profitMargin: number;
    growth: number;
  }>;
  categoryAnalysis: Array<{
    categoryId: string;
    categoryName: string;
    revenue: number;
    units: number;
    growth: number;
    marketShare: number;
  }>;
  inventoryAnalysis: {
    fastMoving: string[];
    slowMoving: string[];
    overstock: string[];
    understock: string[];
  };
}

export interface CustomerInsights {
  lifecycle: {
    new: number;
    active: number;
    atRisk: number;
    lost: number;
  };
  segments: CustomerSegment[];
  behavior: {
    averageSessionDuration: number;
    pagesPerSession: number;
    bounceRate: number;
    cartAbandonmentRate: number;
  };
  cohortAnalysis: Array<{
    cohort: string;
    size: number;
    retention: Record<string, number>;
    ltv: number;
  }>;
}

export interface MarketingInsights {
  channels: Array<{
    channel: string;
    revenue: number;
    customers: number;
    cost: number;
    roi: number;
    conversionRate: number;
  }>;
  campaigns: Array<{
    id: string;
    name: string;
    revenue: number;
    cost: number;
    roi: number;
    customers: number;
  }>;
  attribution: {
    firstTouch: Record<string, number>;
    lastTouch: Record<string, number>;
    multiTouch: Record<string, number>;
  };
}

/**
 * 비즈니스 인텔리전스 분석 엔진
 */
export class BusinessIntelligenceService {
  private prisma: PrismaClient;
  private readonly CACHE_DURATION = 60 * 60; // 1시간

  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * 매출 분석 및 예측
   */
  async getSalesAnalysis(
    startDate: Date,
    endDate: Date,
    comparison: 'previous_period' | 'previous_year' = 'previous_period'
  ): Promise<SalesAnalysis> {
    const cacheKey = `sales_analysis:${startDate.toISOString()}:${endDate.toISOString()}:${comparison}`;
    
    try {
      const cached = await cacheService.get(cacheKey);
      if (cached) return cached;

      const [currentPeriod, previousPeriod, trends, seasonality] = await Promise.all([
        this.getCurrentPeriodData(startDate, endDate),
        this.getPreviousPeriodData(startDate, endDate, comparison),
        this.getSalesTrends(startDate, endDate),
        this.getSeasonalityData(startDate, endDate)
      ]);

      const analysis: SalesAnalysis = {
        revenue: {
          current: currentPeriod.revenue,
          previous: previousPeriod.revenue,
          growth: this.calculateGrowth(currentPeriod.revenue, previousPeriod.revenue),
          forecast: await this.forecastRevenue(startDate, endDate)
        },
        orders: {
          current: currentPeriod.orders,
          previous: previousPeriod.orders,
          growth: this.calculateGrowth(currentPeriod.orders, previousPeriod.orders),
          conversionRate: await this.calculateConversionRate(startDate, endDate)
        },
        trends,
        seasonality
      };

      await cacheService.set(cacheKey, analysis, this.CACHE_DURATION);
      return analysis;
    } catch (error) {
      logger.error('Sales analysis error:', error);
      throw error;
    }
  }

  /**
   * 상품 성과 분석
   */
  async getProductPerformance(
    startDate: Date,
    endDate: Date,
    limit: number = 50
  ): Promise<ProductPerformance> {
    const cacheKey = `product_performance:${startDate.toISOString()}:${endDate.toISOString()}:${limit}`;
    
    try {
      const cached = await cacheService.get(cacheKey);
      if (cached) return cached;

      const [topProducts, categoryAnalysis, inventoryAnalysis] = await Promise.all([
        this.getTopPerformingProducts(startDate, endDate, limit),
        this.getCategoryPerformance(startDate, endDate),
        this.getInventoryAnalysis()
      ]);

      const performance: ProductPerformance = {
        topProducts,
        categoryAnalysis,
        inventoryAnalysis
      };

      await cacheService.set(cacheKey, performance, this.CACHE_DURATION);
      return performance;
    } catch (error) {
      logger.error('Product performance analysis error:', error);
      throw error;
    }
  }

  /**
   * 고객 인사이트 분석
   */
  async getCustomerInsights(
    startDate: Date,
    endDate: Date
  ): Promise<CustomerInsights> {
    const cacheKey = `customer_insights:${startDate.toISOString()}:${endDate.toISOString()}`;
    
    try {
      const cached = await cacheService.get(cacheKey);
      if (cached) return cached;

      const [lifecycle, segments, behavior, cohortAnalysis] = await Promise.all([
        this.getCustomerLifecycle(startDate, endDate),
        this.getCustomerSegments(startDate, endDate),
        this.getCustomerBehavior(startDate, endDate),
        this.getCohortAnalysis(startDate, endDate)
      ]);

      const insights: CustomerInsights = {
        lifecycle,
        segments,
        behavior,
        cohortAnalysis
      };

      await cacheService.set(cacheKey, insights, this.CACHE_DURATION);
      return insights;
    } catch (error) {
      logger.error('Customer insights analysis error:', error);
      throw error;
    }
  }

  /**
   * 마케팅 효과 분석
   */
  async getMarketingInsights(
    startDate: Date,
    endDate: Date
  ): Promise<MarketingInsights> {
    const cacheKey = `marketing_insights:${startDate.toISOString()}:${endDate.toISOString()}`;
    
    try {
      const cached = await cacheService.get(cacheKey);
      if (cached) return cached;

      const [channels, campaigns, attribution] = await Promise.all([
        this.getChannelPerformance(startDate, endDate),
        this.getCampaignPerformance(startDate, endDate),
        this.getAttributionAnalysis(startDate, endDate)
      ]);

      const insights: MarketingInsights = {
        channels,
        campaigns,
        attribution
      };

      await cacheService.set(cacheKey, insights, this.CACHE_DURATION);
      return insights;
    } catch (error) {
      logger.error('Marketing insights analysis error:', error);
      throw error;
    }
  }

  /**
   * 현재 기간 데이터 조회
   */
  private async getCurrentPeriodData(startDate: Date, endDate: Date) {
    const orders = await this.prisma.order.findMany({
      where: {
        createdAt: { gte: startDate, lte: endDate },
        status: 'COMPLETED'
      },
      select: { total: true }
    });

    return {
      revenue: orders.reduce((sum, order) => sum + Number(order.total), 0),
      orders: orders.length
    };
  }

  /**
   * 이전 기간 데이터 조회
   */
  private async getPreviousPeriodData(
    startDate: Date,
    endDate: Date,
    comparison: 'previous_period' | 'previous_year'
  ) {
    const periodLength = endDate.getTime() - startDate.getTime();
    let prevStart: Date, prevEnd: Date;

    if (comparison === 'previous_year') {
      prevStart = new Date(startDate.getFullYear() - 1, startDate.getMonth(), startDate.getDate());
      prevEnd = new Date(endDate.getFullYear() - 1, endDate.getMonth(), endDate.getDate());
    } else {
      prevEnd = new Date(startDate.getTime() - 1);
      prevStart = new Date(prevEnd.getTime() - periodLength);
    }

    const orders = await this.prisma.order.findMany({
      where: {
        createdAt: { gte: prevStart, lte: prevEnd },
        status: 'COMPLETED'
      },
      select: { total: true }
    });

    return {
      revenue: orders.reduce((sum, order) => sum + Number(order.total), 0),
      orders: orders.length
    };
  }

  /**
   * 매출 트렌드 분석
   */
  private async getSalesTrends(startDate: Date, endDate: Date) {
    const rawData = await this.prisma.$queryRaw<Array<{
      date: Date;
      revenue: number;
      orders: number;
      customers: number;
    }>>`
      SELECT 
        DATE_TRUNC('day', o."createdAt") as date,
        SUM(o."total")::float as revenue,
        COUNT(o.id)::float as orders,
        COUNT(DISTINCT o."userId")::float as customers
      FROM "orders" o
      WHERE o."createdAt" >= ${startDate}
        AND o."createdAt" <= ${endDate}
        AND o."status" = 'COMPLETED'
      GROUP BY DATE_TRUNC('day', o."createdAt")
      ORDER BY date
    `;

    return rawData.map(row => ({
      period: row.date.toISOString().split('T')[0],
      revenue: row.revenue || 0,
      orders: row.orders || 0,
      customers: row.customers || 0
    }));
  }

  /**
   * 계절성 분석
   */
  private async getSeasonalityData(startDate: Date, endDate: Date) {
    const [monthlyData, weeklyData, hourlyData] = await Promise.all([
      this.getMonthlySeasonality(startDate, endDate),
      this.getWeeklySeasonality(startDate, endDate),
      this.getHourlySeasonality(startDate, endDate)
    ]);

    return {
      monthly: monthlyData,
      weekly: weeklyData,
      hourly: hourlyData
    };
  }

  private async getMonthlySeasonality(startDate: Date, endDate: Date) {
    const data = await this.prisma.$queryRaw<Array<{ month: number; revenue: number }>>`
      SELECT 
        EXTRACT(MONTH FROM "createdAt") as month,
        SUM("total")::float as revenue
      FROM "orders"
      WHERE "createdAt" >= ${startDate}
        AND "createdAt" <= ${endDate}
        AND "status" = 'COMPLETED'
      GROUP BY EXTRACT(MONTH FROM "createdAt")
      ORDER BY month
    `;

    const months = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
    const result: Record<string, number> = {};
    
    data.forEach(row => {
      result[months[row.month - 1]] = row.revenue || 0;
    });

    return result;
  }

  private async getWeeklySeasonality(startDate: Date, endDate: Date) {
    const data = await this.prisma.$queryRaw<Array<{ dow: number; revenue: number }>>`
      SELECT 
        EXTRACT(DOW FROM "createdAt") as dow,
        SUM("total")::float as revenue
      FROM "orders"
      WHERE "createdAt" >= ${startDate}
        AND "createdAt" <= ${endDate}
        AND "status" = 'COMPLETED'
      GROUP BY EXTRACT(DOW FROM "createdAt")
      ORDER BY dow
    `;

    const days = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
    const result: Record<string, number> = {};
    
    data.forEach(row => {
      result[days[row.dow]] = row.revenue || 0;
    });

    return result;
  }

  private async getHourlySeasonality(startDate: Date, endDate: Date) {
    const data = await this.prisma.$queryRaw<Array<{ hour: number; revenue: number }>>`
      SELECT 
        EXTRACT(HOUR FROM "createdAt") as hour,
        SUM("total")::float as revenue
      FROM "orders"
      WHERE "createdAt" >= ${startDate}
        AND "createdAt" <= ${endDate}
        AND "status" = 'COMPLETED'
      GROUP BY EXTRACT(HOUR FROM "createdAt")
      ORDER BY hour
    `;

    const result: Record<string, number> = {};
    
    data.forEach(row => {
      result[`${row.hour}시`] = row.revenue || 0;
    });

    return result;
  }

  /**
   * 매출 예측 (단순 선형 회귀)
   */
  private async forecastRevenue(startDate: Date, endDate: Date): Promise<number> {
    const trends = await this.getSalesTrends(startDate, endDate);
    
    if (trends.length < 2) return 0;

    // 단순 선형 회귀로 다음 기간 예측
    const x = trends.map((_, i) => i);
    const y = trends.map(t => t.revenue);
    
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    return slope * n + intercept;
  }

  /**
   * 전환율 계산
   */
  private async calculateConversionRate(startDate: Date, endDate: Date): Promise<number> {
    // 실제로는 웹사이트 방문자 수 대비 주문 수로 계산
    // 여기서는 간단히 세션 대비 주문으로 계산
    const [orders, sessions] = await Promise.all([
      this.prisma.order.count({
        where: {
          createdAt: { gte: startDate, lte: endDate },
          status: 'COMPLETED'
        }
      }),
      this.prisma.session.count({
        where: {
          createdAt: { gte: startDate, lte: endDate }
        }
      })
    ]);

    return sessions > 0 ? (orders / sessions) * 100 : 0;
  }

  /**
   * 인기 상품 분석
   */
  private async getTopPerformingProducts(startDate: Date, endDate: Date, limit: number) {
    const data = await this.prisma.$queryRaw<Array<{
      id: string;
      name: string;
      revenue: number;
      units: number;
      cost: number;
    }>>`
      SELECT 
        p.id,
        p.name,
        SUM(oi."total")::float as revenue,
        SUM(oi."quantity")::float as units,
        SUM(oi."quantity" * p."costPrice")::float as cost
      FROM "order_items" oi
      JOIN "orders" o ON oi."orderId" = o.id
      JOIN "products" p ON oi."productId" = p.id
      WHERE o."createdAt" >= ${startDate}
        AND o."createdAt" <= ${endDate}
        AND o."status" = 'COMPLETED'
      GROUP BY p.id, p.name
      ORDER BY revenue DESC
      LIMIT ${limit}
    `;

    return data.map(item => ({
      id: item.id,
      name: item.name,
      revenue: item.revenue || 0,
      units: item.units || 0,
      profit: (item.revenue || 0) - (item.cost || 0),
      profitMargin: item.revenue > 0 ? ((item.revenue - (item.cost || 0)) / item.revenue) * 100 : 0,
      growth: 0 // 이전 기간과 비교 필요
    }));
  }

  /**
   * 카테고리 성과 분석
   */
  private async getCategoryPerformance(startDate: Date, endDate: Date) {
    const data = await this.prisma.$queryRaw<Array<{
      categoryId: string;
      categoryName: string;
      revenue: number;
      units: number;
    }>>`
      SELECT 
        c.id as "categoryId",
        c.name as "categoryName",
        SUM(oi."total")::float as revenue,
        SUM(oi."quantity")::float as units
      FROM "order_items" oi
      JOIN "orders" o ON oi."orderId" = o.id
      JOIN "products" p ON oi."productId" = p.id
      JOIN "categories" c ON p."categoryId" = c.id
      WHERE o."createdAt" >= ${startDate}
        AND o."createdAt" <= ${endDate}
        AND o."status" = 'COMPLETED'
      GROUP BY c.id, c.name
      ORDER BY revenue DESC
    `;

    const totalRevenue = data.reduce((sum, item) => sum + (item.revenue || 0), 0);

    return data.map(item => ({
      categoryId: item.categoryId,
      categoryName: item.categoryName,
      revenue: item.revenue || 0,
      units: item.units || 0,
      growth: 0, // 이전 기간과 비교 필요
      marketShare: totalRevenue > 0 ? ((item.revenue || 0) / totalRevenue) * 100 : 0
    }));
  }

  /**
   * 재고 분석
   */
  private async getInventoryAnalysis() {
    // 회전율 기반 분석
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const products = await this.prisma.product.findMany({
      where: {
        status: 'PUBLISHED',
        trackQuantity: true
      },
      include: {
        orderItems: {
          where: {
            order: {
              createdAt: { gte: thirtyDaysAgo },
              status: 'COMPLETED'
            }
          }
        }
      }
    });

    const fastMoving: string[] = [];
    const slowMoving: string[] = [];
    const overstock: string[] = [];
    const understock: string[] = [];

    products.forEach(product => {
      const soldQuantity = product.orderItems.reduce((sum, item) => sum + item.quantity, 0);
      const turnoverRate = product.quantity > 0 ? soldQuantity / product.quantity : 0;

      if (turnoverRate > 2) {
        fastMoving.push(product.id);
      } else if (turnoverRate < 0.1) {
        slowMoving.push(product.id);
      }

      if (product.quantity > product.lowStockThreshold * 5) {
        overstock.push(product.id);
      } else if (product.quantity <= product.lowStockThreshold) {
        understock.push(product.id);
      }
    });

    return {
      fastMoving,
      slowMoving,
      overstock,
      understock
    };
  }

  /**
   * 고객 생명주기 분석
   */
  private async getCustomerLifecycle(startDate: Date, endDate: Date) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const [newCustomers, activeCustomers, atRiskCustomers, lostCustomers] = await Promise.all([
      this.prisma.user.count({
        where: {
          role: 'CUSTOMER',
          createdAt: { gte: startDate, lte: endDate }
        }
      }),
      this.prisma.user.count({
        where: {
          role: 'CUSTOMER',
          orders: {
            some: {
              createdAt: { gte: thirtyDaysAgo }
            }
          }
        }
      }),
      this.prisma.user.count({
        where: {
          role: 'CUSTOMER',
          orders: {
            some: {
              createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo }
            }
          },
          NOT: {
            orders: {
              some: {
                createdAt: { gte: thirtyDaysAgo }
              }
            }
          }
        }
      }),
      this.prisma.user.count({
        where: {
          role: 'CUSTOMER',
          orders: {
            some: {
              createdAt: { lt: ninetyDaysAgo }
            }
          },
          NOT: {
            orders: {
              some: {
                createdAt: { gte: ninetyDaysAgo }
              }
            }
          }
        }
      })
    ]);

    return {
      new: newCustomers,
      active: activeCustomers,
      atRisk: atRiskCustomers,
      lost: lostCustomers
    };
  }

  /**
   * 고객 세그먼트 분석
   */
  private async getCustomerSegments(startDate: Date, endDate: Date): Promise<CustomerSegment[]> {
    // RFM 분석 기반 세그먼테이션
    const customers = await this.prisma.$queryRaw<Array<{
      userId: string;
      recency: number;
      frequency: number;
      monetary: number;
    }>>`
      SELECT 
        u.id as "userId",
        EXTRACT(DAYS FROM NOW() - MAX(o."createdAt")) as recency,
        COUNT(o.id) as frequency,
        SUM(o."total")::float as monetary
      FROM "users" u
      JOIN "orders" o ON u.id = o."userId"
      WHERE u.role = 'CUSTOMER'
        AND o."status" = 'COMPLETED'
        AND o."createdAt" >= ${startDate}
        AND o."createdAt" <= ${endDate}
      GROUP BY u.id
      HAVING COUNT(o.id) > 0
    `;

    // 세그먼트 분류 로직
    const segments: Record<string, CustomerSegment> = {
      champions: {
        id: 'champions',
        name: '챔피언',
        count: 0,
        totalRevenue: 0,
        averageOrderValue: 0,
        orderFrequency: 0,
        characteristics: ['높은 구매빈도', '높은 구매금액', '최근 구매']
      },
      loyal: {
        id: 'loyal',
        name: '충성고객',
        count: 0,
        totalRevenue: 0,
        averageOrderValue: 0,
        orderFrequency: 0,
        characteristics: ['정기적 구매', '높은 구매금액']
      },
      potential: {
        id: 'potential',
        name: '잠재고객',
        count: 0,
        totalRevenue: 0,
        averageOrderValue: 0,
        orderFrequency: 0,
        characteristics: ['최근 구매', '낮은 구매빈도']
      },
      atRisk: {
        id: 'atRisk',
        name: '위험고객',
        count: 0,
        totalRevenue: 0,
        averageOrderValue: 0,
        orderFrequency: 0,
        characteristics: ['과거 좋은 고객', '최근 비활성']
      }
    };

    customers.forEach(customer => {
      let segment: string;
      
      if (customer.recency <= 30 && customer.frequency >= 5 && customer.monetary >= 100000) {
        segment = 'champions';
      } else if (customer.frequency >= 3 && customer.monetary >= 50000) {
        segment = 'loyal';
      } else if (customer.recency <= 60 && customer.frequency < 3) {
        segment = 'potential';
      } else {
        segment = 'atRisk';
      }

      segments[segment].count++;
      segments[segment].totalRevenue += customer.monetary;
      segments[segment].orderFrequency += customer.frequency;
    });

    Object.values(segments).forEach(segment => {
      if (segment.count > 0) {
        segment.averageOrderValue = segment.totalRevenue / segment.count;
        segment.orderFrequency = segment.orderFrequency / segment.count;
      }
    });

    return Object.values(segments);
  }

  /**
   * 고객 행동 분석
   */
  private async getCustomerBehavior(startDate: Date, endDate: Date) {
    // 실제로는 웹 분석 도구에서 가져올 데이터
    return {
      averageSessionDuration: 180, // 초
      pagesPerSession: 5.2,
      bounceRate: 45.8,
      cartAbandonmentRate: 68.5
    };
  }

  /**
   * 코호트 분석
   */
  private async getCohortAnalysis(startDate: Date, endDate: Date) {
    // 월별 코호트 분석
    const cohorts = await this.prisma.$queryRaw<Array<{
      cohort: string;
      size: number;
      month1: number;
      month2: number;
      month3: number;
    }>>`
      WITH monthly_cohorts AS (
        SELECT 
          DATE_TRUNC('month', u."createdAt") as cohort_month,
          u.id as user_id,
          u."createdAt" as first_order_date
        FROM "users" u
        WHERE u.role = 'CUSTOMER'
          AND u."createdAt" >= ${startDate}
          AND u."createdAt" <= ${endDate}
      )
      SELECT 
        TO_CHAR(cohort_month, 'YYYY-MM') as cohort,
        COUNT(DISTINCT user_id) as size,
        COUNT(DISTINCT CASE WHEN o."createdAt" <= cohort_month + INTERVAL '1 month' THEN u.id END) as month1,
        COUNT(DISTINCT CASE WHEN o."createdAt" <= cohort_month + INTERVAL '2 months' THEN u.id END) as month2,
        COUNT(DISTINCT CASE WHEN o."createdAt" <= cohort_month + INTERVAL '3 months' THEN u.id END) as month3
      FROM monthly_cohorts mc
      JOIN "users" u ON mc.user_id = u.id
      LEFT JOIN "orders" o ON u.id = o."userId" AND o."status" = 'COMPLETED'
      GROUP BY cohort_month
      ORDER BY cohort_month
    `;

    return cohorts.map(cohort => ({
      cohort: cohort.cohort,
      size: cohort.size,
      retention: {
        month1: cohort.size > 0 ? (cohort.month1 / cohort.size) * 100 : 0,
        month2: cohort.size > 0 ? (cohort.month2 / cohort.size) * 100 : 0,
        month3: cohort.size > 0 ? (cohort.month3 / cohort.size) * 100 : 0
      },
      ltv: 0 // 고객 생애 가치 계산 필요
    }));
  }

  /**
   * 채널 성과 분석
   */
  private async getChannelPerformance(startDate: Date, endDate: Date) {
    // 실제로는 UTM 파라미터나 리퍼러 데이터로 분석
    return [
      {
        channel: '직접 방문',
        revenue: 1500000,
        customers: 250,
        cost: 0,
        roi: 0,
        conversionRate: 3.2
      },
      {
        channel: '검색 엔진',
        revenue: 1200000,
        customers: 180,
        cost: 200000,
        roi: 500,
        conversionRate: 2.8
      },
      {
        channel: '소셜 미디어',
        revenue: 800000,
        customers: 120,
        cost: 150000,
        roi: 433,
        conversionRate: 2.1
      }
    ];
  }

  /**
   * 캠페인 성과 분석
   */
  private async getCampaignPerformance(startDate: Date, endDate: Date) {
    // 실제로는 캠페인 태그나 쿠폰 코드로 추적
    return [];
  }

  /**
   * 어트리뷰션 분석
   */
  private async getAttributionAnalysis(startDate: Date, endDate: Date) {
    return {
      firstTouch: {
        '검색엔진': 40,
        '소셜미디어': 25,
        '직접방문': 20,
        '이메일': 15
      },
      lastTouch: {
        '직접방문': 45,
        '검색엔진': 30,
        '소셜미디어': 15,
        '이메일': 10
      },
      multiTouch: {
        '검색엔진': 35,
        '직접방문': 30,
        '소셜미디어': 20,
        '이메일': 15
      }
    };
  }

  /**
   * 성장률 계산
   */
  private calculateGrowth(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  }
}

export const businessIntelligenceService = new BusinessIntelligenceService();