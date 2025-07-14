import { Request, Response } from 'express';
import { businessIntelligenceService } from '../../services/analytics/businessIntelligence';
import { logger } from '../../utils/logger';

export class BusinessIntelligenceController {
  /**
   * 매출 분석 및 예측
   */
  async getSalesAnalysis(req: Request, res: Response) {
    try {
      const { startDate, endDate, comparison = 'previous_period' } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          error: 'startDate와 endDate는 필수 파라미터입니다.'
        });
      }

      const start = new Date(startDate as string);
      const end = new Date(endDate as string);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({
          success: false,
          error: '올바른 날짜 형식이 아닙니다.'
        });
      }

      const analysis = await businessIntelligenceService.getSalesAnalysis(
        start,
        end,
        comparison as 'previous_period' | 'previous_year'
      );

      res.json({
        success: true,
        data: analysis
      });
    } catch (error: any) {
      logger.error('Sales analysis error:', error);
      res.status(500).json({
        success: false,
        error: '매출 분석 중 오류가 발생했습니다.'
      });
    }
  }

  /**
   * 상품 성과 분석
   */
  async getProductPerformance(req: Request, res: Response) {
    try {
      const { startDate, endDate, limit = '50' } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          error: 'startDate와 endDate는 필수 파라미터입니다.'
        });
      }

      const start = new Date(startDate as string);
      const end = new Date(endDate as string);
      const limitNum = parseInt(limit as string);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({
          success: false,
          error: '올바른 날짜 형식이 아닙니다.'
        });
      }

      const performance = await businessIntelligenceService.getProductPerformance(
        start,
        end,
        limitNum
      );

      res.json({
        success: true,
        data: performance
      });
    } catch (error: any) {
      logger.error('Product performance analysis error:', error);
      res.status(500).json({
        success: false,
        error: '상품 성과 분석 중 오류가 발생했습니다.'
      });
    }
  }

  /**
   * 고객 인사이트 분석
   */
  async getCustomerInsights(req: Request, res: Response) {
    try {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          error: 'startDate와 endDate는 필수 파라미터입니다.'
        });
      }

      const start = new Date(startDate as string);
      const end = new Date(endDate as string);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({
          success: false,
          error: '올바른 날짜 형식이 아닙니다.'
        });
      }

      const insights = await businessIntelligenceService.getCustomerInsights(start, end);

      res.json({
        success: true,
        data: insights
      });
    } catch (error: any) {
      logger.error('Customer insights analysis error:', error);
      res.status(500).json({
        success: false,
        error: '고객 인사이트 분석 중 오류가 발생했습니다.'
      });
    }
  }

  /**
   * 마케팅 효과 분석
   */
  async getMarketingInsights(req: Request, res: Response) {
    try {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          error: 'startDate와 endDate는 필수 파라미터입니다.'
        });
      }

      const start = new Date(startDate as string);
      const end = new Date(endDate as string);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({
          success: false,
          error: '올바른 날짜 형식이 아닙니다.'
        });
      }

      const insights = await businessIntelligenceService.getMarketingInsights(start, end);

      res.json({
        success: true,
        data: insights
      });
    } catch (error: any) {
      logger.error('Marketing insights analysis error:', error);
      res.status(500).json({
        success: false,
        error: '마케팅 인사이트 분석 중 오류가 발생했습니다.'
      });
    }
  }

  /**
   * 고객 세그먼트 상세 분석
   */
  async getCustomerSegmentDetails(req: Request, res: Response) {
    try {
      const { segmentId, startDate, endDate } = req.query;

      if (!segmentId || !startDate || !endDate) {
        return res.status(400).json({
          success: false,
          error: 'segmentId, startDate, endDate는 필수 파라미터입니다.'
        });
      }

      const start = new Date(startDate as string);
      const end = new Date(endDate as string);

      // 세그먼트별 상세 분석 로직
      const segmentDetails = await this.analyzeCustomerSegment(
        segmentId as string,
        start,
        end
      );

      res.json({
        success: true,
        data: segmentDetails
      });
    } catch (error: any) {
      logger.error('Customer segment analysis error:', error);
      res.status(500).json({
        success: false,
        error: '고객 세그먼트 분석 중 오류가 발생했습니다.'
      });
    }
  }

  /**
   * 수익성 분석
   */
  async getProfitabilityAnalysis(req: Request, res: Response) {
    try {
      const { startDate, endDate, breakdown = 'product' } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          error: 'startDate와 endDate는 필수 파라미터입니다.'
        });
      }

      const start = new Date(startDate as string);
      const end = new Date(endDate as string);

      const profitability = await this.calculateProfitability(
        start,
        end,
        breakdown as string
      );

      res.json({
        success: true,
        data: profitability
      });
    } catch (error: any) {
      logger.error('Profitability analysis error:', error);
      res.status(500).json({
        success: false,
        error: '수익성 분석 중 오류가 발생했습니다.'
      });
    }
  }

  /**
   * 예측 분석
   */
  async getForecastAnalysis(req: Request, res: Response) {
    try {
      const { metric, period = '30', method = 'linear' } = req.query;

      if (!metric) {
        return res.status(400).json({
          success: false,
          error: 'metric은 필수 파라미터입니다.'
        });
      }

      const forecast = await this.generateForecast(
        metric as string,
        parseInt(period as string),
        method as string
      );

      res.json({
        success: true,
        data: forecast
      });
    } catch (error: any) {
      logger.error('Forecast analysis error:', error);
      res.status(500).json({
        success: false,
        error: '예측 분석 중 오류가 발생했습니다.'
      });
    }
  }

  /**
   * 비즈니스 KPI 대시보드
   */
  async getKPIDashboard(req: Request, res: Response) {
    try {
      const { period = '30' } = req.query;
      const days = parseInt(period as string);
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

      const [
        salesAnalysis,
        customerInsights,
        productPerformance,
        marketingInsights
      ] = await Promise.all([
        businessIntelligenceService.getSalesAnalysis(startDate, endDate),
        businessIntelligenceService.getCustomerInsights(startDate, endDate),
        businessIntelligenceService.getProductPerformance(startDate, endDate),
        businessIntelligenceService.getMarketingInsights(startDate, endDate)
      ]);

      const kpis = {
        revenue: {
          current: salesAnalysis.revenue.current,
          growth: salesAnalysis.revenue.growth,
          forecast: salesAnalysis.revenue.forecast
        },
        customers: {
          total: customerInsights.lifecycle.active + customerInsights.lifecycle.new,
          new: customerInsights.lifecycle.new,
          retention: this.calculateRetentionRate(customerInsights),
          ltv: this.calculateAverageLTV(customerInsights)
        },
        products: {
          topPerformers: productPerformance.topProducts.slice(0, 5),
          categories: productPerformance.categoryAnalysis.slice(0, 3)
        },
        marketing: {
          channels: marketingInsights.channels,
          roi: this.calculateOverallROI(marketingInsights.channels)
        },
        operations: {
          conversionRate: salesAnalysis.orders.conversionRate,
          averageOrderValue: salesAnalysis.revenue.current / salesAnalysis.orders.current,
          orderGrowth: salesAnalysis.orders.growth
        }
      };

      res.json({
        success: true,
        data: kpis
      });
    } catch (error: any) {
      logger.error('KPI dashboard error:', error);
      res.status(500).json({
        success: false,
        error: 'KPI 대시보드 조회 중 오류가 발생했습니다.'
      });
    }
  }

  // 헬퍼 메서드들
  private async analyzeCustomerSegment(segmentId: string, startDate: Date, endDate: Date) {
    // 세그먼트별 상세 분석 로직
    return {
      segmentId,
      name: '세그먼트 이름',
      size: 0,
      characteristics: [],
      behavior: {},
      recommendations: []
    };
  }

  private async calculateProfitability(startDate: Date, endDate: Date, breakdown: string) {
    // 수익성 분석 로직
    return {
      totalRevenue: 0,
      totalCost: 0,
      grossProfit: 0,
      profitMargin: 0,
      breakdown: []
    };
  }

  private async generateForecast(metric: string, period: number, method: string) {
    // 예측 분석 로직
    return {
      metric,
      method,
      period,
      forecast: [],
      confidence: 0.8,
      accuracy: 0.85
    };
  }

  private calculateRetentionRate(insights: any): number {
    const cohorts = insights.cohortAnalysis;
    if (cohorts.length === 0) return 0;
    
    const avgRetention = cohorts.reduce((sum: number, cohort: any) => 
      sum + cohort.retention.month1, 0) / cohorts.length;
    
    return avgRetention;
  }

  private calculateAverageLTV(insights: any): number {
    const segments = insights.segments;
    if (segments.length === 0) return 0;
    
    const totalCustomers = segments.reduce((sum: number, segment: any) => sum + segment.count, 0);
    const totalRevenue = segments.reduce((sum: number, segment: any) => sum + segment.totalRevenue, 0);
    
    return totalCustomers > 0 ? totalRevenue / totalCustomers : 0;
  }

  private calculateOverallROI(channels: any[]): number {
    const totalRevenue = channels.reduce((sum, channel) => sum + channel.revenue, 0);
    const totalCost = channels.reduce((sum, channel) => sum + channel.cost, 0);
    
    return totalCost > 0 ? ((totalRevenue - totalCost) / totalCost) * 100 : 0;
  }
}

export const businessIntelligenceController = new BusinessIntelligenceController();