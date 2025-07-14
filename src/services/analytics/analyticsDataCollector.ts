import { PrismaClient } from '@prisma/client';
import { Server as SocketServer } from 'socket.io';
import { cacheService } from '../cacheService';
import { logger } from '../../utils/logger';
import EventEmitter from 'events';

export interface AnalyticsEvent {
  type: string;
  userId?: string;
  sessionId?: string;
  data: Record<string, any>;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface DashboardMetrics {
  sales: {
    today: number;
    thisWeek: number;
    thisMonth: number;
    thisYear: number;
    growth: {
      daily: number;
      weekly: number;
      monthly: number;
    };
  };
  orders: {
    total: number;
    pending: number;
    processing: number;
    completed: number;
    cancelled: number;
    averageValue: number;
  };
  customers: {
    total: number;
    active: number;
    new: number;
    returning: number;
  };
  products: {
    total: number;
    lowStock: number;
    outOfStock: number;
    topSelling: Array<{
      id: string;
      name: string;
      sales: number;
      revenue: number;
    }>;
  };
  inventory: {
    totalValue: number;
    turnoverRate: number;
    alerts: number;
  };
}

/**
 * 실시간 분석 데이터 수집 서비스
 */
export class AnalyticsDataCollector extends EventEmitter {
  private prisma: PrismaClient;
  private io?: SocketServer;
  private metricsCache = new Map<string, any>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5분

  constructor() {
    super();
    this.prisma = new PrismaClient();
    this.startPeriodicUpdates();
  }

  /**
   * Socket.IO 서버 설정
   */
  setSocketServer(io: SocketServer) {
    this.io = io;
    this.setupSocketHandlers();
  }

  /**
   * Socket 핸들러 설정
   */
  private setupSocketHandlers() {
    if (!this.io) return;

    this.io.on('connection', (socket) => {
      // 대시보드 메트릭스 구독
      socket.on('subscribe:dashboard', async () => {
        const metrics = await this.getDashboardMetrics();
        socket.emit('dashboard:metrics', metrics);
        socket.join('dashboard');
      });

      // 실시간 주문 구독
      socket.on('subscribe:orders', () => {
        socket.join('orders');
      });

      // 실시간 재고 구독
      socket.on('subscribe:inventory', () => {
        socket.join('inventory');
      });
    });
  }

  /**
   * 이벤트 수집
   */
  async collectEvent(event: AnalyticsEvent): Promise<void> {
    try {
      // 이벤트 저장
      await this.storeEvent(event);

      // 실시간 메트릭스 업데이트
      await this.updateRealtimeMetrics(event);

      // 실시간 브로드캐스트
      this.broadcastEvent(event);

      this.emit('eventCollected', event);
    } catch (error) {
      logger.error('Failed to collect analytics event:', error);
    }
  }

  /**
   * 이벤트 저장
   */
  private async storeEvent(event: AnalyticsEvent): Promise<void> {
    // Redis에 실시간 이벤트 저장 (TTL: 1시간)
    const eventKey = `analytics:events:${Date.now()}:${Math.random()}`;
    await cacheService.set(eventKey, event, 3600);

    // 주요 이벤트는 데이터베이스에도 저장
    if (this.isImportantEvent(event.type)) {
      await this.prisma.analyticsEvent.create({
        data: {
          type: event.type,
          userId: event.userId,
          sessionId: event.sessionId,
          data: event.data,
          metadata: event.metadata,
          timestamp: event.timestamp
        }
      });
    }
  }

  /**
   * 중요 이벤트 판별
   */
  private isImportantEvent(eventType: string): boolean {
    const importantEvents = [
      'order_created',
      'order_completed',
      'order_cancelled',
      'payment_completed',
      'user_registered',
      'product_purchased'
    ];
    return importantEvents.includes(eventType);
  }

  /**
   * 실시간 메트릭스 업데이트
   */
  private async updateRealtimeMetrics(event: AnalyticsEvent): Promise<void> {
    const today = new Date().toISOString().split('T')[0];

    switch (event.type) {
      case 'order_created':
        await this.incrementMetric(`orders:created:${today}`, 1);
        await this.incrementMetric('orders:created:total', 1);
        break;

      case 'order_completed':
        await this.incrementMetric(`orders:completed:${today}`, 1);
        if (event.data.total) {
          await this.incrementMetric(`sales:revenue:${today}`, event.data.total);
        }
        break;

      case 'payment_completed':
        if (event.data.amount) {
          await this.incrementMetric(`payments:amount:${today}`, event.data.amount);
        }
        break;

      case 'user_registered':
        await this.incrementMetric(`users:registered:${today}`, 1);
        break;

      case 'product_view':
        await this.incrementMetric(`products:views:${event.data.productId}:${today}`, 1);
        break;

      case 'cart_add':
        await this.incrementMetric(`products:cart_adds:${event.data.productId}:${today}`, 1);
        break;
    }
  }

  /**
   * 메트릭 증가
   */
  private async incrementMetric(key: string, value: number): Promise<void> {
    try {
      await cacheService.increment(key, value);
      // TTL 설정 (30일)
      await cacheService.expire(key, 30 * 24 * 3600);
    } catch (error) {
      logger.error(`Failed to increment metric ${key}:`, error);
    }
  }

  /**
   * 실시간 이벤트 브로드캐스트
   */
  private broadcastEvent(event: AnalyticsEvent): void {
    if (!this.io) return;

    switch (event.type) {
      case 'order_created':
        this.io.to('orders').emit('order:created', {
          orderId: event.data.orderId,
          amount: event.data.total,
          timestamp: event.timestamp
        });
        this.io.to('dashboard').emit('dashboard:newOrder', event.data);
        break;

      case 'order_completed':
        this.io.to('orders').emit('order:completed', event.data);
        this.io.to('dashboard').emit('dashboard:orderCompleted', event.data);
        break;

      case 'inventory_low':
        this.io.to('inventory').emit('inventory:lowStock', event.data);
        this.io.to('dashboard').emit('dashboard:inventoryAlert', event.data);
        break;

      case 'user_registered':
        this.io.to('dashboard').emit('dashboard:newUser', event.data);
        break;
    }
  }

  /**
   * 대시보드 메트릭스 조회
   */
  async getDashboardMetrics(): Promise<DashboardMetrics> {
    const cacheKey = 'dashboard:metrics';
    const cached = this.metricsCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data;
    }

    try {
      const metrics = await this.calculateDashboardMetrics();
      this.metricsCache.set(cacheKey, {
        data: metrics,
        timestamp: Date.now()
      });
      return metrics;
    } catch (error) {
      logger.error('Failed to get dashboard metrics:', error);
      throw error;
    }
  }

  /**
   * 대시보드 메트릭스 계산
   */
  private async calculateDashboardMetrics(): Promise<DashboardMetrics> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const weekStart = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    // 병렬로 데이터 조회
    const [
      salesData,
      ordersData,
      customersData,
      productsData,
      inventoryData
    ] = await Promise.all([
      this.getSalesMetrics(today, yesterday, weekStart, monthStart, yearStart),
      this.getOrdersMetrics(),
      this.getCustomersMetrics(today),
      this.getProductsMetrics(),
      this.getInventoryMetrics()
    ]);

    return {
      sales: salesData,
      orders: ordersData,
      customers: customersData,
      products: productsData,
      inventory: inventoryData
    };
  }

  /**
   * 매출 메트릭스
   */
  private async getSalesMetrics(today: Date, yesterday: Date, weekStart: Date, monthStart: Date, yearStart: Date) {
    const [
      todaySales,
      yesterdaySales,
      weekSales,
      monthSales,
      yearSales
    ] = await Promise.all([
      this.prisma.order.aggregate({
        where: { createdAt: { gte: today }, status: 'COMPLETED' },
        _sum: { total: true }
      }),
      this.prisma.order.aggregate({
        where: { 
          createdAt: { gte: yesterday, lt: today }, 
          status: 'COMPLETED' 
        },
        _sum: { total: true }
      }),
      this.prisma.order.aggregate({
        where: { createdAt: { gte: weekStart }, status: 'COMPLETED' },
        _sum: { total: true }
      }),
      this.prisma.order.aggregate({
        where: { createdAt: { gte: monthStart }, status: 'COMPLETED' },
        _sum: { total: true }
      }),
      this.prisma.order.aggregate({
        where: { createdAt: { gte: yearStart }, status: 'COMPLETED' },
        _sum: { total: true }
      })
    ]);

    const todayTotal = Number(todaySales._sum.total || 0);
    const yesterdayTotal = Number(yesterdaySales._sum.total || 0);

    return {
      today: todayTotal,
      thisWeek: Number(weekSales._sum.total || 0),
      thisMonth: Number(monthSales._sum.total || 0),
      thisYear: Number(yearSales._sum.total || 0),
      growth: {
        daily: yesterdayTotal > 0 ? ((todayTotal - yesterdayTotal) / yesterdayTotal) * 100 : 0,
        weekly: 0, // 계산 로직 추가 필요
        monthly: 0 // 계산 로직 추가 필요
      }
    };
  }

  /**
   * 주문 메트릭스
   */
  private async getOrdersMetrics() {
    const [orderCounts, avgOrder] = await Promise.all([
      this.prisma.order.groupBy({
        by: ['status'],
        _count: true
      }),
      this.prisma.order.aggregate({
        where: { status: 'COMPLETED' },
        _avg: { total: true }
      })
    ]);

    const statusCounts = orderCounts.reduce((acc, item) => {
      acc[item.status.toLowerCase()] = item._count;
      return acc;
    }, {} as Record<string, number>);

    return {
      total: Object.values(statusCounts).reduce((sum, count) => sum + count, 0),
      pending: statusCounts.pending || 0,
      processing: statusCounts.processing || 0,
      completed: statusCounts.completed || 0,
      cancelled: statusCounts.cancelled || 0,
      averageValue: Number(avgOrder._avg.total || 0)
    };
  }

  /**
   * 고객 메트릭스
   */
  private async getCustomersMetrics(today: Date) {
    const [total, newToday, active] = await Promise.all([
      this.prisma.user.count({ where: { role: 'CUSTOMER' } }),
      this.prisma.user.count({
        where: {
          role: 'CUSTOMER',
          createdAt: { gte: today }
        }
      }),
      this.prisma.user.count({
        where: {
          role: 'CUSTOMER',
          lastLoginAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        }
      })
    ]);

    return {
      total,
      active,
      new: newToday,
      returning: total - newToday
    };
  }

  /**
   * 상품 메트릭스
   */
  private async getProductsMetrics() {
    const [
      total,
      lowStock,
      outOfStock,
      topSelling
    ] = await Promise.all([
      this.prisma.product.count({ where: { status: 'PUBLISHED' } }),
      this.prisma.product.count({
        where: {
          status: 'PUBLISHED',
          quantity: { lte: 10, gt: 0 }
        }
      }),
      this.prisma.product.count({
        where: {
          status: 'PUBLISHED',
          quantity: 0
        }
      }),
      this.prisma.product.findMany({
        where: { status: 'PUBLISHED' },
        select: {
          id: true,
          name: true,
          orderItems: {
            select: {
              quantity: true,
              total: true
            }
          }
        },
        take: 10
      })
    ]);

    const topSellingProcessed = topSelling.map(product => ({
      id: product.id,
      name: product.name,
      sales: product.orderItems.reduce((sum, item) => sum + item.quantity, 0),
      revenue: product.orderItems.reduce((sum, item) => sum + Number(item.total), 0)
    })).sort((a, b) => b.sales - a.sales);

    return {
      total,
      lowStock,
      outOfStock,
      topSelling: topSellingProcessed
    };
  }

  /**
   * 재고 메트릭스
   */
  private async getInventoryMetrics() {
    const [products, alerts] = await Promise.all([
      this.prisma.product.findMany({
        where: { status: 'PUBLISHED', trackQuantity: true },
        select: { quantity: true, price: true }
      }),
      this.prisma.inventoryAlert.count({
        where: { isResolved: false }
      })
    ]);

    const totalValue = products.reduce((sum, product) => 
      sum + (product.quantity * Number(product.price)), 0
    );

    return {
      totalValue,
      turnoverRate: 0, // 계산 로직 추가 필요
      alerts
    };
  }

  /**
   * 주기적 업데이트 시작
   */
  private startPeriodicUpdates(): void {
    // 1분마다 대시보드 메트릭스 업데이트
    setInterval(async () => {
      try {
        if (this.io) {
          const metrics = await this.getDashboardMetrics();
          this.io.to('dashboard').emit('dashboard:metrics', metrics);
        }
      } catch (error) {
        logger.error('Failed to update dashboard metrics:', error);
      }
    }, 60 * 1000);

    // 5분마다 캐시 정리
    setInterval(() => {
      const now = Date.now();
      for (const [key, value] of this.metricsCache.entries()) {
        if (now - value.timestamp > this.CACHE_DURATION) {
          this.metricsCache.delete(key);
        }
      }
    }, 5 * 60 * 1000);
  }

  /**
   * 특정 기간 데이터 조회
   */
  async getTimeSeriesData(
    metric: string,
    startDate: Date,
    endDate: Date,
    interval: 'hour' | 'day' | 'week' | 'month' = 'day'
  ): Promise<Array<{ timestamp: Date; value: number }>> {
    // 시계열 데이터 조회 로직
    const cacheKey = `timeseries:${metric}:${startDate.toISOString()}:${endDate.toISOString()}:${interval}`;
    
    try {
      const cached = await cacheService.get(cacheKey);
      if (cached) return cached;

      const data = await this.calculateTimeSeriesData(metric, startDate, endDate, interval);
      await cacheService.set(cacheKey, data, 300); // 5분 캐시
      
      return data;
    } catch (error) {
      logger.error('Failed to get time series data:', error);
      return [];
    }
  }

  /**
   * 시계열 데이터 계산
   */
  private async calculateTimeSeriesData(
    metric: string,
    startDate: Date,
    endDate: Date,
    interval: string
  ): Promise<Array<{ timestamp: Date; value: number }>> {
    // 메트릭 타입에 따른 계산 로직
    switch (metric) {
      case 'sales':
        return this.getSalesTimeSeries(startDate, endDate, interval);
      case 'orders':
        return this.getOrdersTimeSeries(startDate, endDate, interval);
      case 'users':
        return this.getUsersTimeSeries(startDate, endDate, interval);
      default:
        return [];
    }
  }

  /**
   * 매출 시계열 데이터
   */
  private async getSalesTimeSeries(
    startDate: Date,
    endDate: Date,
    interval: string
  ): Promise<Array<{ timestamp: Date; value: number }>> {
    // PostgreSQL의 date_trunc 함수 사용
    const rawData = await this.prisma.$queryRaw<Array<{ date: Date; total: number }>>`
      SELECT 
        DATE_TRUNC(${interval}, "createdAt") as date,
        SUM("total")::float as total
      FROM "orders"
      WHERE "createdAt" >= ${startDate}
        AND "createdAt" <= ${endDate}
        AND "status" = 'COMPLETED'
      GROUP BY DATE_TRUNC(${interval}, "createdAt")
      ORDER BY date
    `;

    return rawData.map(row => ({
      timestamp: row.date,
      value: row.total || 0
    }));
  }

  /**
   * 주문 시계열 데이터
   */
  private async getOrdersTimeSeries(
    startDate: Date,
    endDate: Date,
    interval: string
  ): Promise<Array<{ timestamp: Date; value: number }>> {
    const rawData = await this.prisma.$queryRaw<Array<{ date: Date; count: number }>>`
      SELECT 
        DATE_TRUNC(${interval}, "createdAt") as date,
        COUNT(*)::float as count
      FROM "orders"
      WHERE "createdAt" >= ${startDate}
        AND "createdAt" <= ${endDate}
      GROUP BY DATE_TRUNC(${interval}, "createdAt")
      ORDER BY date
    `;

    return rawData.map(row => ({
      timestamp: row.date,
      value: row.count || 0
    }));
  }

  /**
   * 사용자 시계열 데이터
   */
  private async getUsersTimeSeries(
    startDate: Date,
    endDate: Date,
    interval: string
  ): Promise<Array<{ timestamp: Date; value: number }>> {
    const rawData = await this.prisma.$queryRaw<Array<{ date: Date; count: number }>>`
      SELECT 
        DATE_TRUNC(${interval}, "createdAt") as date,
        COUNT(*)::float as count
      FROM "users"
      WHERE "createdAt" >= ${startDate}
        AND "createdAt" <= ${endDate}
        AND "role" = 'CUSTOMER'
      GROUP BY DATE_TRUNC(${interval}, "createdAt")
      ORDER BY date
    `;

    return rawData.map(row => ({
      timestamp: row.date,
      value: row.count || 0
    }));
  }
}

export const analyticsDataCollector = new AnalyticsDataCollector();