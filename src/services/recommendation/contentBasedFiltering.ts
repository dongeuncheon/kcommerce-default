import { PrismaClient } from '@prisma/client';
import { RecommendationResult } from '../../types/recommendation';
import { cacheService } from '../cacheService';
import * as natural from 'natural';

export class ContentBasedFilteringService {
  private prisma: PrismaClient;
  private tfidf: natural.TfIdf;
  private readonly MIN_SIMILARITY = 0.2;
  private readonly FEATURE_WEIGHTS = {
    category: 0.3,
    tags: 0.2,
    attributes: 0.2,
    description: 0.15,
    price: 0.15
  };

  constructor() {
    this.prisma = new PrismaClient();
    this.tfidf = new natural.TfIdf();
  }

  /**
   * 콘텐츠 기반 상품 추천 생성
   */
  async generateContentBasedRecommendations(
    productId: string,
    limit: number = 10,
    excludeProductIds: string[] = []
  ): Promise<RecommendationResult[]> {
    const cacheKey = `content:${productId}:${limit}`;
    const cached = await cacheService.get(cacheKey);
    if (cached) return cached;

    try {
      // 1. 타겟 상품의 특성 추출
      const targetProduct = await this.getProductFeatures(productId);
      if (!targetProduct) return [];

      // 2. 유사한 상품 찾기
      const similarProducts = await this.findSimilarProducts(
        targetProduct,
        excludeProductIds.concat(productId)
      );

      // 3. 점수로 정렬하고 상위 N개 반환
      const recommendations = similarProducts
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(item => ({
          productId: item.productId,
          score: item.score,
          algorithm: 'CONTENT_BASED' as any,
          reason: item.reason
        }));

      // 캐시 저장 (4시간)
      await cacheService.set(cacheKey, recommendations, 14400);

      return recommendations;
    } catch (error) {
      console.error('Content-based filtering error:', error);
      return [];
    }
  }

  /**
   * 사용자의 선호도 기반 콘텐츠 추천
   */
  async generateUserContentRecommendations(
    userId: string,
    limit: number = 20,
    excludeProductIds: string[] = []
  ): Promise<RecommendationResult[]> {
    const cacheKey = `content:user:${userId}:${limit}`;
    const cached = await cacheService.get(cacheKey);
    if (cached) return cached;

    try {
      // 1. 사용자가 상호작용한 상품들의 특성 프로파일 생성
      const userProfile = await this.buildUserProfile(userId);
      if (!userProfile) return [];

      // 2. 프로파일과 유사한 상품 찾기
      const recommendations = await this.findProductsMatchingProfile(
        userProfile,
        excludeProductIds
      );

      // 3. 정렬 및 제한
      const topRecommendations = recommendations
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      // 캐시 저장 (2시간)
      await cacheService.set(cacheKey, topRecommendations, 7200);

      return topRecommendations;
    } catch (error) {
      console.error('User content-based filtering error:', error);
      return [];
    }
  }

  /**
   * 상품 특성 추출
   */
  private async getProductFeatures(productId: string): Promise<any> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        category: true,
        tags: {
          include: { tag: true }
        },
        attributes: true,
        options: true
      }
    });

    if (!product) return null;

    return {
      id: product.id,
      name: product.name,
      description: product.description,
      category: product.category,
      categoryPath: await this.getCategoryPath(product.categoryId),
      tags: product.tags.map(pt => pt.tag.name),
      attributes: this.extractAttributes(product.attributes),
      price: product.salePrice || product.price,
      priceRange: this.getPriceRange(product.salePrice || product.price),
      features: this.extractTextFeatures(product)
    };
  }

  /**
   * 카테고리 경로 가져오기
   */
  private async getCategoryPath(categoryId: string | null): Promise<string[]> {
    if (!categoryId) return [];

    const path: string[] = [];
    let currentId = categoryId;

    while (currentId) {
      const category = await this.prisma.category.findUnique({
        where: { id: currentId },
        select: { name: true, parentId: true }
      });

      if (!category) break;
      
      path.unshift(category.name);
      currentId = category.parentId;
    }

    return path;
  }

  /**
   * 속성 추출
   */
  private extractAttributes(attributes: any[]): Record<string, any> {
    const result: Record<string, any> = {};
    
    attributes.forEach(attr => {
      result[attr.name] = attr.value;
    });

    return result;
  }

  /**
   * 가격 범위 결정
   */
  private getPriceRange(price: any): string {
    const priceNum = parseFloat(price?.toString() || '0');
    
    if (priceNum < 10000) return 'budget';
    if (priceNum < 50000) return 'mid-range';
    if (priceNum < 200000) return 'premium';
    return 'luxury';
  }

  /**
   * 텍스트 특성 추출 (TF-IDF)
   */
  private extractTextFeatures(product: any): number[] {
    const text = [
      product.name,
      product.description,
      product.shortDescription,
      ...(product.tags?.map((t: any) => t.tag.name) || [])
    ].filter(Boolean).join(' ');

    // 한국어 형태소 분석 (간단한 버전)
    const tokens = text.toLowerCase()
      .replace(/[^\w\s가-힣]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 1);

    this.tfidf.addDocument(tokens);
    
    return this.tfidf.listTerms(0).map(term => term.tfidf);
  }

  /**
   * 유사한 상품 찾기
   */
  private async findSimilarProducts(
    targetProduct: any,
    excludeProductIds: string[]
  ): Promise<Array<{ productId: string; score: number; reason: string }>> {
    // 같은 카테고리의 상품들 가져오기
    const candidateProducts = await this.prisma.product.findMany({
      where: {
        id: { notIn: excludeProductIds },
        status: 'PUBLISHED',
        OR: [
          { categoryId: targetProduct.category?.id },
          { categoryId: targetProduct.category?.parentId }
        ]
      },
      include: {
        category: true,
        tags: {
          include: { tag: true }
        },
        attributes: true
      },
      take: 200 // 성능을 위해 제한
    });

    const similarities: Array<{ productId: string; score: number; reason: string }> = [];

    for (const candidate of candidateProducts) {
      const candidateFeatures = await this.getProductFeatures(candidate.id);
      const similarity = this.calculateSimilarity(targetProduct, candidateFeatures);
      
      if (similarity >= this.MIN_SIMILARITY) {
        similarities.push({
          productId: candidate.id,
          score: similarity,
          reason: this.generateReason(targetProduct, candidateFeatures)
        });

        // 유사도 저장
        await this.saveProductSimilarity(
          targetProduct.id,
          candidate.id,
          similarity
        );
      }
    }

    return similarities;
  }

  /**
   * 두 상품 간 유사도 계산
   */
  private calculateSimilarity(productA: any, productB: any): number {
    let totalScore = 0;

    // 카테고리 유사도
    const categoryScore = this.calculateCategorySimilarity(
      productA.categoryPath,
      productB.categoryPath
    );
    totalScore += categoryScore * this.FEATURE_WEIGHTS.category;

    // 태그 유사도
    const tagScore = this.calculateJaccardSimilarity(
      new Set(productA.tags),
      new Set(productB.tags)
    );
    totalScore += tagScore * this.FEATURE_WEIGHTS.tags;

    // 속성 유사도
    const attributeScore = this.calculateAttributeSimilarity(
      productA.attributes,
      productB.attributes
    );
    totalScore += attributeScore * this.FEATURE_WEIGHTS.attributes;

    // 텍스트 유사도 (코사인 유사도)
    const textScore = this.calculateTextSimilarity(
      productA.features,
      productB.features
    );
    totalScore += textScore * this.FEATURE_WEIGHTS.description;

    // 가격 유사도
    const priceScore = productA.priceRange === productB.priceRange ? 1 : 0.5;
    totalScore += priceScore * this.FEATURE_WEIGHTS.price;

    return totalScore;
  }

  /**
   * 카테고리 경로 유사도 계산
   */
  private calculateCategorySimilarity(pathA: string[], pathB: string[]): number {
    const minLength = Math.min(pathA.length, pathB.length);
    let matchCount = 0;

    for (let i = 0; i < minLength; i++) {
      if (pathA[i] === pathB[i]) {
        matchCount++;
      } else {
        break;
      }
    }

    return matchCount / Math.max(pathA.length, pathB.length);
  }

  /**
   * Jaccard 유사도 계산
   */
  private calculateJaccardSimilarity(setA: Set<any>, setB: Set<any>): number {
    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * 속성 유사도 계산
   */
  private calculateAttributeSimilarity(
    attrA: Record<string, any>,
    attrB: Record<string, any>
  ): number {
    const allKeys = new Set([...Object.keys(attrA), ...Object.keys(attrB)]);
    let matchCount = 0;

    allKeys.forEach(key => {
      if (attrA[key] === attrB[key]) {
        matchCount++;
      }
    });

    return allKeys.size > 0 ? matchCount / allKeys.size : 0;
  }

  /**
   * 텍스트 유사도 계산 (코사인 유사도)
   */
  private calculateTextSimilarity(vectorA: number[], vectorB: number[]): number {
    if (!vectorA.length || !vectorB.length) return 0;

    const minLength = Math.min(vectorA.length, vectorB.length);
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < minLength; i++) {
      dotProduct += vectorA[i] * vectorB[i];
      normA += vectorA[i] * vectorA[i];
      normB += vectorB[i] * vectorB[i];
    }

    if (normA === 0 || normB === 0) return 0;

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * 사용자 프로파일 생성
   */
  private async buildUserProfile(userId: string): Promise<any> {
    // 사용자가 상호작용한 상품들
    const userBehaviors = await this.prisma.userBehavior.findMany({
      where: { 
        userId,
        action: { in: ['PURCHASE', 'ADD_TO_CART', 'WISHLIST_ADD', 'REVIEW'] }
      },
      include: {
        product: {
          include: {
            category: true,
            tags: {
              include: { tag: true }
            },
            attributes: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    if (!userBehaviors.length) return null;

    // 프로파일 집계
    const profile = {
      categories: new Map<string, number>(),
      tags: new Map<string, number>(),
      attributes: new Map<string, Map<string, number>>(),
      priceRanges: new Map<string, number>()
    };

    for (const behavior of userBehaviors) {
      const product = behavior.product;
      const weight = this.getActionWeight(behavior.action);

      // 카테고리
      if (product.categoryId) {
        const count = profile.categories.get(product.categoryId) || 0;
        profile.categories.set(product.categoryId, count + weight);
      }

      // 태그
      product.tags.forEach(pt => {
        const count = profile.tags.get(pt.tag.name) || 0;
        profile.tags.set(pt.tag.name, count + weight);
      });

      // 가격 범위
      const priceRange = this.getPriceRange(product.salePrice || product.price);
      const prCount = profile.priceRanges.get(priceRange) || 0;
      profile.priceRanges.set(priceRange, prCount + weight);
    }

    return profile;
  }

  /**
   * 행동 가중치
   */
  private getActionWeight(action: string): number {
    const weights: Record<string, number> = {
      PURCHASE: 5,
      REVIEW: 4,
      ADD_TO_CART: 3,
      WISHLIST_ADD: 2,
      VIEW: 1
    };
    return weights[action] || 1;
  }

  /**
   * 프로파일에 맞는 상품 찾기
   */
  private async findProductsMatchingProfile(
    profile: any,
    excludeProductIds: string[]
  ): Promise<RecommendationResult[]> {
    // 선호 카테고리의 상품들
    const topCategories = Array.from(profile.categories.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([categoryId]) => categoryId);

    const candidateProducts = await this.prisma.product.findMany({
      where: {
        id: { notIn: excludeProductIds },
        status: 'PUBLISHED',
        categoryId: { in: topCategories }
      },
      include: {
        tags: {
          include: { tag: true }
        }
      },
      take: 100
    });

    const recommendations: RecommendationResult[] = [];

    for (const product of candidateProducts) {
      let score = 0;

      // 카테고리 매칭 점수
      const categoryScore = profile.categories.get(product.categoryId!) || 0;
      score += categoryScore * 0.4;

      // 태그 매칭 점수
      let tagScore = 0;
      product.tags.forEach(pt => {
        tagScore += profile.tags.get(pt.tag.name) || 0;
      });
      score += tagScore * 0.3;

      // 가격 범위 매칭
      const priceRange = this.getPriceRange(product.salePrice || product.price);
      const priceScore = profile.priceRanges.get(priceRange) || 0;
      score += priceScore * 0.3;

      if (score > 0) {
        recommendations.push({
          productId: product.id,
          score: score / 10, // 정규화
          algorithm: 'CONTENT_BASED' as any,
          reason: '사용자 선호도 기반'
        });
      }
    }

    return recommendations;
  }

  /**
   * 추천 이유 생성
   */
  private generateReason(productA: any, productB: any): string {
    const reasons: string[] = [];

    if (productA.category?.id === productB.category?.id) {
      reasons.push(`같은 카테고리 (${productA.category.name})`);
    }

    const commonTags = productA.tags.filter((tag: string) => 
      productB.tags.includes(tag)
    );
    if (commonTags.length > 0) {
      reasons.push(`유사한 태그: ${commonTags.slice(0, 3).join(', ')}`);
    }

    if (productA.priceRange === productB.priceRange) {
      reasons.push('비슷한 가격대');
    }

    return reasons.join(', ') || '유사한 특성';
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
          algorithm: 'content'
        }
      },
      update: { similarity },
      create: {
        productId,
        similarProductId,
        similarity,
        algorithm: 'content'
      }
    });
  }
}

export const contentBasedFilteringService = new ContentBasedFilteringService();