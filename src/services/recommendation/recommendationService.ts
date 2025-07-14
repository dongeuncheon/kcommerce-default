import { PrismaClient } from '@prisma/client';
import { 
  RecommendationRequest, 
  RecommendationResult, 
  RecommendationAlgorithm,
  UserActionType,
  ACTION_WEIGHTS 
} from '../../types/recommendation';
import { collaborativeFilteringService } from './collaborativeFiltering';
import { contentBasedFilteringService } from './contentBasedFiltering';
import { cacheService } from '../cacheService';
import { auditLogService } from '../auditLogService';

export class RecommendationService {
  private prisma: PrismaClient;
  
  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * 추천 생성 (통합 API)
   */
  async getRecommendations(request: RecommendationRequest): Promise<RecommendationResult[]> {
    const startTime = Date.now();
    
    try {
      let recommendations: RecommendationResult[] = [];

      switch (request.algorithm) {
        case RecommendationAlgorithm.COLLABORATIVE:
          recommendations = await collaborativeFilteringService.generateUserBasedRecommendations(
            request.userId,
            request.limit,
            request.excludeProductIds
          );
          break;

        case RecommendationAlgorithm.CONTENT_BASED:
          recommendations = await contentBasedFilteringService.generateUserContentRecommendations(
            request.userId,
            request.limit,
            request.excludeProductIds
          );
          break;

        case RecommendationAlgorithm.HYBRID:
          recommendations = await this.generateHybridRecommendations(request);
          break;

        case RecommendationAlgorithm.TRENDING:
          recommendations = await this.getTrendingProducts(request);
          break;

        case RecommendationAlgorithm.PERSONALIZED:
          recommendations = await this.getPersonalizedRecommendations(request);
          break;

        case RecommendationAlgorithm.SIMILAR_PRODUCTS:
          if (request.context?.productId) {
            recommendations = await this.getSimilarProducts(
              request.context.productId,
              request.limit
            );
          }
          break;

        case RecommendationAlgorithm.SIMILAR_USERS:
          recommendations = await this.getUserBasedRecommendations(request);
          break;
      }

      // 추천 결과 캐싱
      await this.cacheRecommendations(request.userId, request.algorithm, recommendations);

      // 성능 추적
      const duration = Date.now() - startTime;
      await this.trackPerformance(request.algorithm, duration, recommendations.length);

      return recommendations;
    } catch (error) {
      console.error('Recommendation service error:', error);
      return this.getFallbackRecommendations(request);
    }
  }

  /**
   * 하이브리드 추천 (협업 + 콘텐츠 기반)
   */
  private async generateHybridRecommendations(
    request: RecommendationRequest
  ): Promise<RecommendationResult[]> {
    const [collaborative, contentBased] = await Promise.all([
      collaborativeFilteringService.generateUserBasedRecommendations(
        request.userId,
        request.limit * 2,
        request.excludeProductIds
      ),
      contentBasedFilteringService.generateUserContentRecommendations(
        request.userId,
        request.limit * 2,
        request.excludeProductIds
      )
    ]);

    // 점수 병합 (가중 평균)
    const scoreMap = new Map<string, { score: number; reasons: string[] }>();
    const collaborativeWeight = 0.6;
    const contentWeight = 0.4;

    collaborative.forEach(rec => {
      const existing = scoreMap.get(rec.productId) || { score: 0, reasons: [] };
      existing.score += rec.score * collaborativeWeight;
      existing.reasons.push('협업 필터링');
      scoreMap.set(rec.productId, existing);
    });

    contentBased.forEach(rec => {
      const existing = scoreMap.get(rec.productId) || { score: 0, reasons: [] };
      existing.score += rec.score * contentWeight;
      existing.reasons.push('콘텐츠 유사성');
      scoreMap.set(rec.productId, existing);
    });

    // 결과 변환 및 정렬
    const results: RecommendationResult[] = Array.from(scoreMap.entries())
      .map(([productId, data]) => ({
        productId,
        score: data.score,
        algorithm: RecommendationAlgorithm.HYBRID,
        reason: data.reasons.join(' + ')
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, request.limit || 20);

    return results;
  }

  /**
   * 트렌딩 상품 추천
   */
  private async getTrendingProducts(
    request: RecommendationRequest
  ): Promise<RecommendationResult[]> {
    const timeWindow = 7; // 최근 7일
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - timeWindow);

    // 최근 인기 상품 집계
    const trendingProducts = await this.prisma.userBehavior.groupBy({
      by: ['productId'],
      where: {
        createdAt: { gte: startDate },
        action: { in: ['VIEW', 'ADD_TO_CART', 'PURCHASE'] }
      },
      _count: { productId: true },
      orderBy: { _count: { productId: 'desc' } },
      take: request.limit || 20
    });

    // 상품 정보와 점수 계산
    const results: RecommendationResult[] = [];
    
    for (const item of trendingProducts) {
      const product = await this.prisma.product.findUnique({
        where: { id: item.productId },
        select: { id: true, status: true }
      });

      if (product?.status === 'PUBLISHED') {
        results.push({
          productId: item.productId,
          score: item._count.productId / 100, // 정규화
          algorithm: RecommendationAlgorithm.TRENDING,
          reason: `최근 ${timeWindow}일간 인기 상품`
        });
      }
    }

    return results;
  }

  /**
   * 개인화된 추천 (ML 모델 기반)
   */
  private async getPersonalizedRecommendations(
    request: RecommendationRequest
  ): Promise<RecommendationResult[]> {
    // 사용자 특성 추출
    const userFeatures = await this.extractUserFeatures(request.userId);
    
    // 컨텍스트 정보 포함
    const contextFeatures = this.extractContextFeatures(request.context);
    
    // ML 모델 예측 (실제로는 TensorFlow.js 또는 외부 API 호출)
    const predictions = await this.predictWithMLModel(
      userFeatures,
      contextFeatures
    );

    return predictions
      .filter(pred => !request.excludeProductIds?.includes(pred.productId))
      .slice(0, request.limit || 20);
  }

  /**
   * 유사 상품 추천
   */
  private async getSimilarProducts(
    productId: string,
    limit: number = 10
  ): Promise<RecommendationResult[]> {
    // 캐시된 유사도 확인
    const similarities = await this.prisma.productSimilarity.findMany({
      where: {
        productId,
        similarity: { gte: 0.3 }
      },
      orderBy: { similarity: 'desc' },
      take: limit * 2,
      include: {
        similarProduct: {
          select: { id: true, status: true }
        }
      }
    });

    const results: RecommendationResult[] = similarities
      .filter(sim => sim.similarProduct.status === 'PUBLISHED')
      .slice(0, limit)
      .map(sim => ({
        productId: sim.similarProductId,
        score: sim.similarity,
        algorithm: RecommendationAlgorithm.SIMILAR_PRODUCTS,
        reason: `${productId}와 유사한 상품`
      }));

    // 부족하면 콘텐츠 기반으로 보충
    if (results.length < limit) {
      const contentBased = await contentBasedFilteringService
        .generateContentBasedRecommendations(
          productId,
          limit - results.length,
          results.map(r => r.productId)
        );
      
      results.push(...contentBased);
    }

    return results;
  }

  /**
   * 사용자 기반 추천
   */
  private async getUserBasedRecommendations(
    request: RecommendationRequest
  ): Promise<RecommendationResult[]> {
    // 유사한 사용자 찾기
    const similarUsers = await this.prisma.userSimilarity.findMany({
      where: {
        userId: request.userId,
        similarity: { gte: 0.5 }
      },
      orderBy: { similarity: 'desc' },
      take: 10
    });

    if (similarUsers.length === 0) {
      return [];
    }

    // 유사 사용자들이 좋아한 상품
    const recommendations = new Map<string, number>();
    
    for (const simUser of similarUsers) {
      const userProducts = await this.prisma.userBehavior.findMany({
        where: {
          userId: simUser.similarUserId,
          action: { in: ['PURCHASE', 'ADD_TO_CART', 'REVIEW'] }
        },
        select: { productId: true, action: true },
        take: 20
      });

      userProducts.forEach(behavior => {
        const weight = ACTION_WEIGHTS[behavior.action as UserActionType] || 1;
        const score = weight * simUser.similarity;
        const current = recommendations.get(behavior.productId) || 0;
        recommendations.set(behavior.productId, current + score);
      });
    }

    // 결과 변환
    const results: RecommendationResult[] = Array.from(recommendations.entries())
      .filter(([productId]) => !request.excludeProductIds?.includes(productId))
      .map(([productId, score]) => ({
        productId,
        score: score / 10, // 정규화
        algorithm: RecommendationAlgorithm.SIMILAR_USERS,
        reason: '유사한 사용자들이 선호하는 상품'
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, request.limit || 20);

    return results;
  }

  /**
   * 사용자 특성 추출
   */
  private async extractUserFeatures(userId: string): Promise<any> {
    const features: any = {
      purchaseCount: 0,
      avgOrderValue: 0,
      preferredCategories: [],
      preferredPriceRange: [],
      activityLevel: 0,
      lastActivityDays: 0
    };

    // 구매 이력
    const orders = await this.prisma.order.findMany({
      where: { userId },
      select: { totalAmount: true, createdAt: true }
    });

    if (orders.length > 0) {
      features.purchaseCount = orders.length;
      features.avgOrderValue = orders.reduce((sum, o) => 
        sum + parseFloat(o.totalAmount.toString()), 0
      ) / orders.length;
    }

    // 활동 수준
    const behaviors = await this.prisma.userBehavior.count({
      where: { userId }
    });
    features.activityLevel = Math.min(behaviors / 100, 1); // 정규화

    // 마지막 활동일
    const lastBehavior = await this.prisma.userBehavior.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true }
    });

    if (lastBehavior) {
      const daysSince = Math.floor(
        (Date.now() - lastBehavior.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      );
      features.lastActivityDays = daysSince;
    }

    return features;
  }

  /**
   * 컨텍스트 특성 추출
   */
  private extractContextFeatures(context?: any): any {
    const features: any = {
      timeOfDay: new Date().getHours(),
      dayOfWeek: new Date().getDay(),
      isMobile: context?.deviceType === 'mobile',
      hasLocation: !!context?.location,
      hasPriceFilter: !!context?.priceRange,
      season: this.getCurrentSeason()
    };

    return features;
  }

  /**
   * 현재 계절 판단
   */
  private getCurrentSeason(): string {
    const month = new Date().getMonth() + 1;
    if (month >= 3 && month <= 5) return 'spring';
    if (month >= 6 && month <= 8) return 'summer';
    if (month >= 9 && month <= 11) return 'autumn';
    return 'winter';
  }

  /**
   * ML 모델 예측 (시뮬레이션)
   */
  private async predictWithMLModel(
    userFeatures: any,
    contextFeatures: any
  ): Promise<RecommendationResult[]> {
    // 실제로는 TensorFlow.js 또는 외부 ML API 호출
    // 여기서는 시뮬레이션

    const products = await this.prisma.product.findMany({
      where: { status: 'PUBLISHED' },
      take: 100,
      orderBy: { createdAt: 'desc' }
    });

    return products.map(product => ({
      productId: product.id,
      score: Math.random(), // 실제로는 ML 모델의 예측값
      algorithm: RecommendationAlgorithm.PERSONALIZED,
      reason: 'AI 기반 개인화 추천'
    })).sort((a, b) => b.score - a.score);
  }

  /**
   * 사용자 행동 추적
   */
  async trackUserBehavior(
    userId: string,
    productId: string,
    action: UserActionType,
    sessionId?: string,
    duration?: number,
    metadata?: any
  ): Promise<void> {
    await this.prisma.userBehavior.create({
      data: {
        userId,
        productId,
        action,
        sessionId,
        duration,
        metadata
      }
    });

    // 캐시 무효화
    await cacheService.delete(`cf:user:${userId}:*`);
    await cacheService.delete(`content:user:${userId}:*`);
  }

  /**
   * 추천 클릭 추적
   */
  async trackRecommendationClick(
    userId: string,
    productId: string,
    algorithm: string,
    position: number,
    recommendationId?: string,
    sessionId?: string
  ): Promise<void> {
    await this.prisma.recommendationClick.create({
      data: {
        userId,
        productId,
        algorithm,
        position,
        recommendationId,
        sessionId
      }
    });

    // 클릭률 계산을 위한 이벤트 발행
    await this.calculateCTR(algorithm);
  }

  /**
   * 추천 결과 캐싱
   */
  private async cacheRecommendations(
    userId: string,
    algorithm: string,
    recommendations: RecommendationResult[]
  ): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24시간 후 만료

    await this.prisma.recommendationCache.upsert({
      where: {
        userId_algorithm: { userId, algorithm }
      },
      update: {
        productIds: recommendations.map(r => r.productId),
        scores: recommendations.map(r => r.score),
        expiresAt
      },
      create: {
        userId,
        algorithm,
        productIds: recommendations.map(r => r.productId),
        scores: recommendations.map(r => r.score),
        expiresAt
      }
    });
  }

  /**
   * 성능 추적
   */
  private async trackPerformance(
    algorithm: string,
    duration: number,
    resultCount: number
  ): Promise<void> {
    await auditLogService.log('recommendation_generated', 'system', {
      algorithm,
      duration,
      resultCount
    });
  }

  /**
   * 클릭률 계산
   */
  private async calculateCTR(algorithm: string): Promise<void> {
    const lastHour = new Date();
    lastHour.setHours(lastHour.getHours() - 1);

    const stats = await this.prisma.recommendationClick.groupBy({
      by: ['algorithm'],
      where: {
        algorithm,
        createdAt: { gte: lastHour }
      },
      _count: { id: true }
    });

    // 결과를 모니터링 시스템으로 전송
    console.log(`CTR stats for ${algorithm}:`, stats);
  }

  /**
   * 폴백 추천 (에러 시)
   */
  private async getFallbackRecommendations(
    request: RecommendationRequest
  ): Promise<RecommendationResult[]> {
    // 인기 상품으로 폴백
    const popularProducts = await this.prisma.product.findMany({
      where: {
        status: 'PUBLISHED',
        id: { notIn: request.excludeProductIds || [] }
      },
      orderBy: [
        { reviewCount: 'desc' },
        { averageRating: 'desc' }
      ],
      take: request.limit || 20
    });

    return popularProducts.map((product, index) => ({
      productId: product.id,
      score: 1 - (index * 0.05), // 순위에 따른 점수
      algorithm: RecommendationAlgorithm.TRENDING,
      reason: '인기 상품'
    }));
  }
}

export const recommendationService = new RecommendationService();