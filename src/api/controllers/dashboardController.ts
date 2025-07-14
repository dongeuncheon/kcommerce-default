import { Request, Response } from 'express';
import { analyticsDataCollector } from '../../services/analytics/analyticsDataCollector';
import { logger } from '../../utils/logger';

export class DashboardController {
  /**
   * 대시보드 메인 메트릭스 조회
   */
  async getDashboardMetrics(req: Request, res: Response) {
    try {
      const metrics = await analyticsDataCollector.getDashboardMetrics();
      
      res.json({
        success: true,
        data: metrics
      });
    } catch (error: any) {
      logger.error('Dashboard metrics error:', error);
      res.status(500).json({
        success: false,
        error: '대시보드 메트릭스 조회 중 오류가 발생했습니다.'
      });
    }
  }

  /**
   * 시계열 데이터 조회
   */
  async getTimeSeriesData(req: Request, res: Response) {
    try {
      const { metric, startDate, endDate, interval } = req.query;

      if (!metric || !startDate || !endDate) {
        return res.status(400).json({
          success: false,
          error: 'metric, startDate, endDate는 필수 파라미터입니다.'
        });
      }

      const start = new Date(startDate as string);
      const end = new Date(endDate as string);
      const intervalType = (interval as string) || 'day';

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({
          success: false,
          error: '올바른 날짜 형식이 아닙니다.'
        });
      }

      const data = await analyticsDataCollector.getTimeSeriesData(
        metric as string,
        start,
        end,
        intervalType as any
      );

      res.json({
        success: true,
        data: {
          metric,
          interval: intervalType,
          startDate: start,
          endDate: end,
          values: data
        }
      });
    } catch (error: any) {
      logger.error('Time series data error:', error);
      res.status(500).json({
        success: false,
        error: '시계열 데이터 조회 중 오류가 발생했습니다.'
      });
    }
  }

  /**
   * 실시간 매출 현황
   */
  async getRealtimeSales(req: Request, res: Response) {
    try {
      const period = req.query.period as string || 'today';
      
      let startDate: Date;
      const now = new Date();

      switch (period) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      }

      const salesData = await analyticsDataCollector.getTimeSeriesData(
        'sales',
        startDate,
        now,
        period === 'today' ? 'hour' : 'day'
      );

      res.json({
        success: true,
        data: {
          period,
          startDate,
          endDate: now,
          sales: salesData
        }
      });
    } catch (error: any) {
      logger.error('Realtime sales error:', error);
      res.status(500).json({
        success: false,
        error: '실시간 매출 데이터 조회 중 오류가 발생했습니다.'
      });
    }
  }

  /**
   * 주문 현황 분석
   */
  async getOrderAnalytics(req: Request, res: Response) {
    try {
      const { startDate, endDate } = req.query;
      
      const start = startDate ? new Date(startDate as string) : 
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 기본 30일
      const end = endDate ? new Date(endDate as string) : new Date();

      const [orderTimeSeries, ordersByStatus] = await Promise.all([
        analyticsDataCollector.getTimeSeriesData('orders', start, end, 'day'),
        this.getOrdersByStatus(start, end)
      ]);

      res.json({
        success: true,
        data: {
          period: { startDate: start, endDate: end },
          timeSeries: orderTimeSeries,
          statusBreakdown: ordersByStatus
        }
      });
    } catch (error: any) {
      logger.error('Order analytics error:', error);
      res.status(500).json({
        success: false,
        error: '주문 분석 데이터 조회 중 오류가 발생했습니다.'
      });
    }
  }

  /**
   * 고객 분석
   */
  async getCustomerAnalytics(req: Request, res: Response) {
    try {
      const { startDate, endDate } = req.query;
      
      const start = startDate ? new Date(startDate as string) : 
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate as string) : new Date();

      const [newCustomers, customerSegments, topCustomers] = await Promise.all([
        analyticsDataCollector.getTimeSeriesData('users', start, end, 'day'),
        this.getCustomerSegments(),
        this.getTopCustomers(10)
      ]);

      res.json({
        success: true,
        data: {
          period: { startDate: start, endDate: end },
          newCustomers,
          segments: customerSegments,
          topCustomers
        }
      });
    } catch (error: any) {
      logger.error('Customer analytics error:', error);
      res.status(500).json({
        success: false,
        error: '고객 분석 데이터 조회 중 오류가 발생했습니다.'
      });
    }
  }

  /**
   * 상품 성과 분석
   */
  async getProductAnalytics(req: Request, res: Response) {
    try {
      const { period, limit } = req.query;
      const limitNum = parseInt(limit as string) || 20;
      
      let startDate: Date;
      const now = new Date();

      switch (period) {
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'quarter':
          startDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
          break;
        default:
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }

      const [topProducts, lowPerformingProducts, categoryPerformance] = await Promise.all([
        this.getTopPerformingProducts(startDate, now, limitNum),
        this.getLowPerformingProducts(startDate, now, limitNum),
        this.getCategoryPerformance(startDate, now)
      ]);

      res.json({
        success: true,
        data: {
          period: { startDate, endDate: now },
          topProducts,
          lowPerformingProducts,
          categoryPerformance
        }
      });
    } catch (error: any) {
      logger.error('Product analytics error:', error);
      res.status(500).json({
        success: false,
        error: '상품 성과 분석 데이터 조회 중 오류가 발생했습니다.'
      });
    }
  }

  /**
   * 재고 분석
   */
  async getInventoryAnalytics(req: Request, res: Response) {
    try {
      const [
        stockLevels,
        lowStockProducts,
        inventoryTurnover,
        stockMovements
      ] = await Promise.all([
        this.getStockLevelDistribution(),
        this.getLowStockProducts(),
        this.getInventoryTurnoverRates(),
        this.getRecentStockMovements()
      ]);

      res.json({
        success: true,
        data: {
          stockLevels,
          lowStockProducts,
          inventoryTurnover,
          recentMovements: stockMovements
        }
      });
    } catch (error: any) {
      logger.error('Inventory analytics error:', error);
      res.status(500).json({
        success: false,
        error: '재고 분석 데이터 조회 중 오류가 발생했습니다.'
      });
    }
  }

  /**
   * 이벤트 기록
   */
  async recordEvent(req: Request, res: Response) {
    try {
      const { type, data, userId, sessionId } = req.body;

      if (!type) {
        return res.status(400).json({
          success: false,
          error: 'event type은 필수입니다.'
        });
      }

      await analyticsDataCollector.collectEvent({
        type,
        userId,
        sessionId,
        data: data || {},
        timestamp: new Date()
      });

      res.json({
        success: true,
        message: '이벤트가 기록되었습니다.'
      });
    } catch (error: any) {
      logger.error('Record event error:', error);
      res.status(500).json({
        success: false,
        error: '이벤트 기록 중 오류가 발생했습니다.'
      });
    }
  }

  // 헬퍼 메서드들
  private async getOrdersByStatus(startDate: Date, endDate: Date) {
    // 구현 예정
    return {
      pending: 0,
      processing: 0,
      completed: 0,
      cancelled: 0
    };
  }

  private async getCustomerSegments() {
    // 구현 예정
    return {
      new: 0,
      returning: 0,
      vip: 0
    };
  }

  private async getTopCustomers(limit: number) {
    // 구현 예정
    return [];
  }

  private async getTopPerformingProducts(startDate: Date, endDate: Date, limit: number) {
    // 구현 예정
    return [];
  }

  private async getLowPerformingProducts(startDate: Date, endDate: Date, limit: number) {
    // 구현 예정
    return [];
  }

  private async getCategoryPerformance(startDate: Date, endDate: Date) {
    // 구현 예정
    return [];
  }

  private async getStockLevelDistribution() {
    // 구현 예정
    return {
      inStock: 0,
      lowStock: 0,
      outOfStock: 0
    };
  }

  private async getLowStockProducts() {
    // 구현 예정
    return [];
  }

  private async getInventoryTurnoverRates() {
    // 구현 예정
    return [];
  }

  private async getRecentStockMovements() {
    // 구현 예정
    return [];
  }
}

export const dashboardController = new DashboardController();