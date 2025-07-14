import { PrismaClient } from '@prisma/client';
import { 
  RecommendationResult, 
  UserBehaviorData, 
  ACTION_WEIGHTS, 
  UserActionType,
  SimilarityMatrix 
} from '../../types/recommendation';
import { cacheService } from '../cacheService';

export class CollaborativeFilteringService {
  private prisma: PrismaClient;
  private readonly MIN_COMMON_ITEMS = 3;
  private readonly MIN_SIMILARITY = 0.1;
  private readonly MAX_NEIGHBORS = 50;
  
  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * 사용자 기반 협업 필터링으로 추천 생성
   */
  async generateUserBasedRecommendations(
    userId: string, 
    limit: number = 20,
    excludeProductIds: string[] = []
  ): Promise<RecommendationResult[]> {
    const cacheKey = `cf:user:${userId}:${limit}`;
    const cached = await cacheService.get(cacheKey);
    if (cached) return cached;

    try {
      // 1. 타겟 사용자의 행동 데이터 가져오기
      const userBehaviors = await this.getUserBehaviors(userId);
      const userProductScores = this.calculateProductScores(userBehaviors);
      
      // 2. 유사한 사용자 찾기
      const similarUsers = await this.findSimilarUsers(userId, userProductScores);
      
      // 3. 유사 사용자들의 선호 상품 가져오기
      const recommendations = await this.aggregateNeighborPreferences(
        userId,
        similarUsers,
        userProductScores,
        excludeProductIds
      );
      
      // 4. 점수로 정렬하고 상위 N개 반환
      const topRecommendations = recommendations
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
      
      // 캐시 저장 (1시간)
      await cacheService.set(cacheKey, topRecommendations, 3600);
      
      return topRecommendations;
    } catch (error) {
      console.error('User-based CF error:', error);
      return [];
    }
  }

  /**
   * 아이템 기반 협업 필터링으로 추천 생성
   */
  async generateItemBasedRecommendations(
    productId: string,
    limit: number = 10
  ): Promise<RecommendationResult[]> {
    const cacheKey = `cf:item:${productId}:${limit}`;
    const cached = await cacheService.get(cacheKey);
    if (cached) return cached;

    try {
      // 1. 유사한 상품 찾기
      const similarProducts = await this.prisma.productSimilarity.findMany({
        where: {
          productId,
          algorithm: 'collaborative',
          similarity: { gte: this.MIN_SIMILARITY }
        },
        orderBy: { similarity: 'desc' },
        take: limit,
        include: {
          similarProduct: {
            select: {
              id: true,
              name: true,
              status: true
            }
          }
        }
      });

      const recommendations: RecommendationResult[] = similarProducts
        .filter(sp => sp.similarProduct.status === 'PUBLISHED')
        .map(sp => ({
          productId: sp.similarProductId,
          score: sp.similarity,
          algorithm: 'COLLABORATIVE' as any,
          reason: `Similar to ${productId}`
        }));

      // 캐시 저장 (2시간)
      await cacheService.set(cacheKey, recommendations, 7200);
      
      return recommendations;
    } catch (error) {
      console.error('Item-based CF error:', error);
      return [];
    }
  }

  /**
   * 사용자 행동 데이터 가져오기
   */
  private async getUserBehaviors(userId: string): Promise<UserBehaviorData[]> {
    const behaviors = await this.prisma.userBehavior.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 1000 // 최근 1000개 행동만
    });

    return behaviors.map(b => ({
      userId: b.userId,
      productId: b.productId,
      action: b.action as UserActionType,
      timestamp: b.createdAt,
      weight: ACTION_WEIGHTS[b.action as UserActionType] || 1,
      sessionId: b.sessionId || undefined,
      metadata: b.metadata
    }));
  }

  /**
   * 사용자의 상품별 점수 계산
   */
  private calculateProductScores(behaviors: UserBehaviorData[]): Map<string, number> {
    const scores = new Map<string, number>();
    const now = new Date();

    behaviors.forEach(behavior => {
      const currentScore = scores.get(behavior.productId) || 0;
      
      // 시간 감쇠 적용 (최근 행동일수록 가중치 높음)
      const daysSince = Math.floor((now.getTime() - behavior.timestamp.getTime()) / (1000 * 60 * 60 * 24));
      const timeDecay = Math.exp(-daysSince / 30); // 30일 반감기
      
      const weightedScore = behavior.weight * timeDecay;
      scores.set(behavior.productId, currentScore + weightedScore);
    });

    return scores;
  }

  /**
   * 유사한 사용자 찾기 (코사인 유사도)
   */
  private async findSimilarUsers(
    targetUserId: string,
    targetScores: Map<string, number>
  ): Promise<Array<{ userId: string; similarity: number }>> {
    // 캐시된 유사도 확인
    const cachedSimilarities = await this.prisma.userSimilarity.findMany({
      where: {
        userId: targetUserId,
        algorithm: 'collaborative'
      },
      orderBy: { similarity: 'desc' },
      take: this.MAX_NEIGHBORS
    });

    if (cachedSimilarities.length >= this.MIN_COMMON_ITEMS) {
      return cachedSimilarities.map(s => ({
        userId: s.similarUserId,
        similarity: s.similarity
      }));
    }

    // 실시간 계산
    const similarUsers: Array<{ userId: string; similarity: number }> = [];
    
    // 타겟 사용자와 같은 상품을 본 다른 사용자들 찾기
    const targetProductIds = Array.from(targetScores.keys());
    const potentialNeighbors = await this.prisma.userBehavior.findMany({
      where: {
        productId: { in: targetProductIds },
        userId: { not: targetUserId }
      },
      select: { userId: true },
      distinct: ['userId']
    });

    // 각 잠재 이웃과의 유사도 계산
    for (const neighbor of potentialNeighbors) {
      const neighborBehaviors = await this.getUserBehaviors(neighbor.userId);
      const neighborScores = this.calculateProductScores(neighborBehaviors);
      
      const similarity = this.calculateCosineSimilarity(targetScores, neighborScores);
      
      if (similarity >= this.MIN_SIMILARITY) {
        similarUsers.push({
          userId: neighbor.userId,
          similarity
        });

        // 유사도 캐시 저장
        await this.prisma.userSimilarity.upsert({
          where: {
            userId_similarUserId_algorithm: {
              userId: targetUserId,
              similarUserId: neighbor.userId,
              algorithm: 'collaborative'
            }
          },
          update: { similarity },
          create: {
            userId: targetUserId,
            similarUserId: neighbor.userId,
            similarity,
            algorithm: 'collaborative'
          }
        });
      }
    }

    return similarUsers
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, this.MAX_NEIGHBORS);
  }

  /**
   * 코사인 유사도 계산
   */
  private calculateCosineSimilarity(
    scoresA: Map<string, number>,
    scoresB: Map<string, number>
  ): number {
    const commonProducts = Array.from(scoresA.keys()).filter(p => scoresB.has(p));
    
    if (commonProducts.length < this.MIN_COMMON_ITEMS) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    commonProducts.forEach(productId => {
      const scoreA = scoresA.get(productId) || 0;
      const scoreB = scoresB.get(productId) || 0;
      
      dotProduct += scoreA * scoreB;
      normA += scoreA * scoreA;
      normB += scoreB * scoreB;
    });

    if (normA === 0 || normB === 0) return 0;
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * 이웃들의 선호도 집계
   */
  private async aggregateNeighborPreferences(
    targetUserId: string,
    neighbors: Array<{ userId: string; similarity: number }>,
    userScores: Map<string, number>,
    excludeProductIds: string[]
  ): Promise<RecommendationResult[]> {
    const productScores = new Map<string, number>();
    const productReasons = new Map<string, string[]>();

    for (const neighbor of neighbors) {
      const neighborBehaviors = await this.getUserBehaviors(neighbor.userId);
      const neighborScores = this.calculateProductScores(neighborBehaviors);

      neighborScores.forEach((score, productId) => {
        // 사용자가 이미 본 상품이나 제외 목록에 있는 상품은 스킵
        if (userScores.has(productId) || excludeProductIds.includes(productId)) {
          return;
        }

        const weightedScore = score * neighbor.similarity;
        const currentScore = productScores.get(productId) || 0;
        productScores.set(productId, currentScore + weightedScore);

        // 추천 이유 기록
        const reasons = productReasons.get(productId) || [];
        reasons.push(`유사 사용자 ${neighbor.userId.substring(0, 8)}의 선호`);
        productReasons.set(productId, reasons);
      });
    }

    // 결과 변환
    const recommendations: RecommendationResult[] = [];
    productScores.forEach((score, productId) => {
      recommendations.push({
        productId,
        score,
        algorithm: 'COLLABORATIVE' as any,
        reason: productReasons.get(productId)?.join(', ')
      });
    });

    return recommendations;
  }

  /**
   * 상품 간 유사도 계산 및 저장
   */
  async calculateItemSimilarities(minSupport: number = 5): Promise<void> {
    console.log('Calculating item similarities...');
    
    // 모든 상품 쌍에 대해 유사도 계산
    const products = await this.prisma.product.findMany({
      where: { status: 'PUBLISHED' },
      select: { id: true }
    });

    for (let i = 0; i < products.length; i++) {
      for (let j = i + 1; j < products.length; j++) {
        const productA = products[i].id;
        const productB = products[j].id;

        // 두 상품을 모두 본 사용자 찾기
        const usersA = await this.prisma.userBehavior.findMany({
          where: { productId: productA },
          select: { userId: true, action: true },
          distinct: ['userId']
        });

        const usersB = await this.prisma.userBehavior.findMany({
          where: { productId: productB },
          select: { userId: true, action: true },
          distinct: ['userId']
        });

        const userSetA = new Set(usersA.map(u => u.userId));
        const userSetB = new Set(usersB.map(u => u.userId));
        const commonUsers = Array.from(userSetA).filter(u => userSetB.has(u));

        if (commonUsers.length >= minSupport) {
          // Jaccard 유사도 계산
          const union = new Set([...userSetA, ...userSetB]);
          const similarity = commonUsers.length / union.size;

          if (similarity >= this.MIN_SIMILARITY) {
            // 양방향 저장
            await this.saveProductSimilarity(productA, productB, similarity);
            await this.saveProductSimilarity(productB, productA, similarity);
          }
        }
      }
    }

    console.log('Item similarities calculation completed');
  }

  /**
   * 상품 유사도 저장
   */
  private async saveProductSimilarity(
    productId: string,
    similarProductId: string,
    similarity: number
  ): Promise<void> {
    await this.prisma.productSimilarity.upsert({
      where: {
        productId_similarProductId_algorithm: {
          productId,
          similarProductId,
          algorithm: 'collaborative'
        }
      },
      update: { similarity },
      create: {
        productId,
        similarProductId,
        similarity,
        algorithm: 'collaborative'
      }
    });
  }
}

export const collaborativeFilteringService = new CollaborativeFilteringService();