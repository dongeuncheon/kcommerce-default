import { PrismaClient } from '@prisma/client';
import { Server as SocketServer } from 'socket.io';
import { RecommendationResult, UserActionType } from '../../types/recommendation';
import { recommendationService } from './recommendationService';
import { cacheService } from '../cacheService';
import EventEmitter from 'events';

export class RealtimeRecommendationService extends EventEmitter {
  private prisma: PrismaClient;
  private io?: SocketServer;
  private userSessions: Map<string, Set<string>> = new Map(); // userId -> sessionIds
  private sessionData: Map<string, any> = new Map(); // sessionId -> data
  
  constructor() {
    super();
    this.prisma = new PrismaClient();
    this.initializeEventHandlers();
  }

  /**
   * Socket.IO 서버 설정
   */
  setSocketServer(io: SocketServer) {
    this.io = io;
    this.setupSocketHandlers();
  }

  /**
   * 이벤트 핸들러 초기화
   */
  private initializeEventHandlers() {
    // 사용자 행동 이벤트 처리
    this.on('userAction', async (data) => {
      await this.handleUserAction(data);
    });

    // 장바구니 변경 이벤트
    this.on('cartUpdated', async (data) => {
      await this.handleCartUpdate(data);
    });

    // 구매 완료 이벤트
    this.on('purchaseCompleted', async (data) => {
      await this.handlePurchase(data);
    });
  }

  /**
   * Socket 핸들러 설정
   */
  private setupSocketHandlers() {
    if (!this.io) return;

    this.io.on('connection', (socket) => {
      const userId = socket.handshake.auth.userId;
      const sessionId = socket.id;

      // 사용자 세션 등록
      if (userId) {
        this.registerUserSession(userId, sessionId);
      }

      // 실시간 추천 요청
      socket.on('getRealtimeRecommendations', async (data) => {
        const recommendations = await this.getRealtimeRecommendations(
          userId || data.userId,
          data
        );
        socket.emit('recommendations', recommendations);
      });

      // 사용자 행동 추적
      socket.on('trackAction', async (data) => {
        this.emit('userAction', {
          userId: userId || data.userId,
          sessionId,
          ...data
        });
      });

      // 연결 해제
      socket.on('disconnect', () => {
        if (userId) {
          this.unregisterUserSession(userId, sessionId);
        }
        this.sessionData.delete(sessionId);
      });
    });
  }

  /**
   * 실시간 추천 생성
   */
  async getRealtimeRecommendations(
    userId: string,
    context: any
  ): Promise<any> {
    try {
      // 현재 세션 컨텍스트
      const sessionContext = this.getSessionContext(userId);
      
      // 실시간 트렌드 반영
      const trendingBoost = await this.getTrendingBoost();
      
      // 사용자의 최근 행동 분석
      const recentActions = await this.getRecentUserActions(userId, 10);
      const behaviorContext = this.analyzeBehaviorPattern(recentActions);

      // 추천 생성
      let recommendations = await recommendationService.getRecommendations({
        userId,
        algorithm: context.algorithm || 'HYBRID',
        limit: context.limit || 10,
        context: {
          ...context,
          ...sessionContext,
          ...behaviorContext,
          isRealtime: true
        }
      });

      // 실시간 부스팅 적용
      recommendations = this.applyRealtimeBoost(
        recommendations,
        trendingBoost,
        behaviorContext
      );

      return {
        recommendations,
        context: {
          timestamp: new Date(),
          sessionId: sessionContext.sessionId,
          algorithm: 'realtime',
          factors: {
            trending: trendingBoost.length,
            behavioral: behaviorContext.signals?.length || 0
          }
        }
      };
    } catch (error) {
      console.error('Realtime recommendation error:', error);
      return { recommendations: [], error: error.message };
    }
  }

  /**
   * 사용자 행동 처리
   */
  private async handleUserAction(data: any) {
    const { userId, sessionId, productId, action, metadata } = data;

    // 행동 기록
    await recommendationService.trackUserBehavior(
      userId,
      productId,
      action,
      sessionId,
      metadata?.duration,
      metadata
    );

    // 세션 데이터 업데이트
    this.updateSessionData(sessionId, {
      lastAction: action,
      lastProductId: productId,
      timestamp: new Date()
    });

    // 특정 행동에 대한 즉시 추천
    if (this.shouldTriggerInstantRecommendation(action)) {
      await this.sendInstantRecommendations(userId, productId, action);
    }

    // 행동 패턴 분석
    await this.analyzeAndUpdatePatterns(userId);
  }

  /**
   * 장바구니 업데이트 처리
   */
  private async handleCartUpdate(data: any) {
    const { userId, cartItems, action } = data;

    // 장바구니 기반 추천 생성
    const recommendations = await this.getCartBasedRecommendations(
      userId,
      cartItems
    );

    // 실시간 전송
    this.broadcastToUser(userId, 'cartRecommendations', {
      recommendations,
      trigger: 'cart_update',
      action
    });
  }

  /**
   * 구매 완료 처리
   */
  private async handlePurchase(data: any) {
    const { userId, orderId, items } = data;

    // 구매 패턴 업데이트
    await this.updatePurchasePatterns(userId, items);

    // 구매 후 추천
    const postPurchaseRecs = await this.getPostPurchaseRecommendations(
      userId,
      items
    );

    this.broadcastToUser(userId, 'postPurchaseRecommendations', {
      recommendations: postPurchaseRecs,
      orderId
    });
  }

  /**
   * 즉시 추천이 필요한지 판단
   */
  private shouldTriggerInstantRecommendation(action: string): boolean {
    const triggerActions = [
      UserActionType.ADD_TO_CART,
      UserActionType.WISHLIST_ADD,
      UserActionType.PURCHASE,
      UserActionType.REMOVE_FROM_CART
    ];
    return triggerActions.includes(action as UserActionType);
  }

  /**
   * 즉시 추천 전송
   */
  private async sendInstantRecommendations(
    userId: string,
    productId: string,
    action: string
  ) {
    const recommendations = await recommendationService.getRecommendations({
      userId,
      algorithm: 'SIMILAR_PRODUCTS',
      limit: 5,
      context: { 
        productId,
        trigger: action,
        instant: true
      }
    });

    this.broadcastToUser(userId, 'instantRecommendations', {
      recommendations,
      trigger: action,
      relatedProduct: productId
    });
  }

  /**
   * 최근 사용자 행동 조회
   */
  private async getRecentUserActions(userId: string, limit: number) {
    return await this.prisma.userBehavior.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            categoryId: true,
            price: true
          }
        }
      }
    });
  }

  /**
   * 행동 패턴 분석
   */
  private analyzeBehaviorPattern(actions: any[]): any {
    const patterns = {
      categories: new Map<string, number>(),
      priceRanges: new Map<string, number>(),
      actionSequence: [],
      signals: []
    };

    actions.forEach((action, index) => {
      // 카테고리 패턴
      if (action.product.categoryId) {
        const count = patterns.categories.get(action.product.categoryId) || 0;
        patterns.categories.set(action.product.categoryId, count + 1);
      }

      // 가격대 패턴
      const priceRange = this.getPriceRangeKey(action.product.price);
      const prCount = patterns.priceRanges.get(priceRange) || 0;
      patterns.priceRanges.set(priceRange, prCount + 1);

      // 행동 시퀀스
      patterns.actionSequence.push(action.action);

      // 특별 신호 감지
      if (index === 0 && action.action === 'ADD_TO_CART') {
        patterns.signals.push('ready_to_buy');
      }
    });

    // 반복 조회 감지
    const viewCounts = actions.filter(a => a.action === 'VIEW').length;
    if (viewCounts >= 3) {
      patterns.signals.push('high_interest');
    }

    return patterns;
  }

  /**
   * 실시간 트렌드 부스트
   */
  private async getTrendingBoost(): Promise<any[]> {
    const cacheKey = 'trending:boost:realtime';
    const cached = await cacheService.get(cacheKey);
    if (cached) return cached;

    // 최근 1시간 동안 급상승 상품
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);

    const trending = await this.prisma.userBehavior.groupBy({
      by: ['productId'],
      where: {
        createdAt: { gte: oneHourAgo },
        action: { in: ['VIEW', 'ADD_TO_CART'] }
      },
      _count: { productId: true },
      having: {
        productId: { _count: { gt: 10 } }
      },
      orderBy: { _count: { productId: 'desc' } },
      take: 20
    });

    await cacheService.set(cacheKey, trending, 300); // 5분 캐시
    return trending;
  }

  /**
   * 실시간 부스팅 적용
   */
  private applyRealtimeBoost(
    recommendations: RecommendationResult[],
    trendingBoost: any[],
    behaviorContext: any
  ): RecommendationResult[] {
    const boostedRecs = recommendations.map(rec => {
      let boostFactor = 1.0;

      // 트렌딩 부스트
      const trendingItem = trendingBoost.find(t => t.productId === rec.productId);
      if (trendingItem) {
        boostFactor *= 1.2;
        rec.reason = (rec.reason || '') + ' (지금 인기!)';
      }

      // 행동 컨텍스트 부스트
      if (behaviorContext.signals?.includes('ready_to_buy')) {
        boostFactor *= 1.1;
      }

      return {
        ...rec,
        score: rec.score * boostFactor
      };
    });

    return boostedRecs.sort((a, b) => b.score - a.score);
  }

  /**
   * 장바구니 기반 추천
   */
  private async getCartBasedRecommendations(
    userId: string,
    cartItems: any[]
  ): Promise<RecommendationResult[]> {
    // 장바구니 상품들의 카테고리 분석
    const categories = new Set(cartItems.map(item => item.categoryId).filter(Boolean));
    const totalAmount = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // 보완 상품 추천
    const complementaryProducts = await this.findComplementaryProducts(
      cartItems.map(item => item.productId),
      Array.from(categories),
      totalAmount
    );

    return complementaryProducts;
  }

  /**
   * 보완 상품 찾기
   */
  private async findComplementaryProducts(
    productIds: string[],
    categories: string[],
    cartTotal: number
  ): Promise<RecommendationResult[]> {
    // 함께 구매된 상품 분석
    const frequentlyBoughtTogether = await this.prisma.$queryRaw`
      SELECT oi2.product_id, COUNT(*) as co_occurrence
      FROM order_items oi1
      JOIN order_items oi2 ON oi1.order_id = oi2.order_id
      WHERE oi1.product_id IN (${productIds})
        AND oi2.product_id NOT IN (${productIds})
      GROUP BY oi2.product_id
      ORDER BY co_occurrence DESC
      LIMIT 10
    `;

    return []; // 실제 구현은 더 복잡
  }

  /**
   * 구매 후 추천
   */
  private async getPostPurchaseRecommendations(
    userId: string,
    purchasedItems: any[]
  ): Promise<RecommendationResult[]> {
    // 구매한 상품의 액세서리/관련 상품
    const accessories = [];
    
    for (const item of purchasedItems) {
      const related = await contentBasedFilteringService
        .generateContentBasedRecommendations(item.productId, 3);
      accessories.push(...related);
    }

    // 재구매 가능 상품
    const repurchasable = await this.findRepurchasableProducts(userId);

    return [...accessories, ...repurchasable];
  }

  /**
   * 재구매 가능 상품 찾기
   */
  private async findRepurchasableProducts(
    userId: string
  ): Promise<RecommendationResult[]> {
    // 소모품 카테고리 등 재구매 주기가 있는 상품
    const lastPurchases = await this.prisma.order.findMany({
      where: {
        userId,
        status: 'DELIVERED',
        createdAt: {
          gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) // 90일 이내
        }
      },
      include: {
        orderItems: {
          include: {
            product: {
              include: { category: true }
            }
          }
        }
      }
    });

    // 재구매 주기 분석 로직
    return [];
  }

  /**
   * 사용자 세션 등록
   */
  private registerUserSession(userId: string, sessionId: string) {
    const sessions = this.userSessions.get(userId) || new Set();
    sessions.add(sessionId);
    this.userSessions.set(userId, sessions);
  }

  /**
   * 사용자 세션 해제
   */
  private unregisterUserSession(userId: string, sessionId: string) {
    const sessions = this.userSessions.get(userId);
    if (sessions) {
      sessions.delete(sessionId);
      if (sessions.size === 0) {
        this.userSessions.delete(userId);
      }
    }
  }

  /**
   * 세션 컨텍스트 가져오기
   */
  private getSessionContext(userId: string): any {
    const sessions = this.userSessions.get(userId);
    if (!sessions || sessions.size === 0) return {};

    const sessionId = Array.from(sessions)[0];
    return {
      sessionId,
      sessionCount: sessions.size,
      ...this.sessionData.get(sessionId)
    };
  }

  /**
   * 세션 데이터 업데이트
   */
  private updateSessionData(sessionId: string, data: any) {
    const existing = this.sessionData.get(sessionId) || {};
    this.sessionData.set(sessionId, { ...existing, ...data });
  }

  /**
   * 사용자에게 브로드캐스트
   */
  private broadcastToUser(userId: string, event: string, data: any) {
    if (!this.io) return;

    const sessions = this.userSessions.get(userId);
    if (sessions) {
      sessions.forEach(sessionId => {
        this.io!.to(sessionId).emit(event, data);
      });
    }
  }

  /**
   * 가격대 키 생성
   */
  private getPriceRangeKey(price: any): string {
    const priceNum = parseFloat(price?.toString() || '0');
    if (priceNum < 10000) return 'under_10k';
    if (priceNum < 50000) return '10k_50k';
    if (priceNum < 100000) return '50k_100k';
    if (priceNum < 500000) return '100k_500k';
    return 'over_500k';
  }

  /**
   * 패턴 분석 및 업데이트
   */
  private async analyzeAndUpdatePatterns(userId: string) {
    // 백그라운드에서 실행
    setImmediate(async () => {
      try {
        const patterns = await this.detectUserPatterns(userId);
        if (patterns.length > 0) {
          this.broadcastToUser(userId, 'patternsDetected', { patterns });
        }
      } catch (error) {
        console.error('Pattern analysis error:', error);
      }
    });
  }

  /**
   * 사용자 패턴 감지
   */
  private async detectUserPatterns(userId: string): Promise<string[]> {
    const patterns: string[] = [];
    
    // 최근 24시간 행동 분석
    const dayAgo = new Date();
    dayAgo.setDate(dayAgo.getDate() - 1);
    
    const recentBehaviors = await this.prisma.userBehavior.count({
      where: {
        userId,
        createdAt: { gte: dayAgo }
      }
    });

    if (recentBehaviors > 50) {
      patterns.push('highly_active');
    }

    // 더 많은 패턴 감지 로직...
    
    return patterns;
  }

  /**
   * 구매 패턴 업데이트
   */
  private async updatePurchasePatterns(userId: string, items: any[]) {
    // 구매 패턴 저장 로직
    console.log(`Updating purchase patterns for user ${userId}`);
  }
}

export const realtimeRecommendationService = new RealtimeRecommendationService();