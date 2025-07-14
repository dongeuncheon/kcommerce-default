import { api } from './api';

export interface RecommendationRequest {
  userId?: string;
  algorithm: string;
  limit?: number;
  offset?: number;
  categoryId?: string;
  excludeProductIds?: string[];
  context?: any;
}

export interface RecommendationResult {
  productId: string;
  score: number;
  reason?: string;
  algorithm: string;
  product?: any;
}

export interface TrackingData {
  productId: string;
  action: string;
  duration?: number;
  metadata?: any;
}

export interface ClickData {
  productId: string;
  algorithm: string;
  position: number;
  recommendationId?: string;
}

class RecommendationService {
  // 추천 상품 조회
  async getRecommendations(request: RecommendationRequest): Promise<{
    recommendations: RecommendationResult[];
    algorithm: string;
    count: number;
  }> {
    const params = new URLSearchParams();
    
    if (request.userId) params.append('userId', request.userId);
    params.append('algorithm', request.algorithm);
    if (request.limit) params.append('limit', request.limit.toString());
    if (request.offset) params.append('offset', request.offset.toString());
    if (request.categoryId) params.append('categoryId', request.categoryId);
    if (request.excludeProductIds?.length) {
      params.append('exclude', request.excludeProductIds.join(','));
    }
    
    const response = await api.get(`/recommendations?${params}`);
    return response.data.data;
  }

  // 홈페이지 추천
  async getHomeRecommendations(categoryId?: string): Promise<{
    sections: Array<{
      title: string;
      algorithm: string;
      products: RecommendationResult[];
    }>;
  }> {
    const params = categoryId ? `?categoryId=${categoryId}` : '';
    const response = await api.get(`/recommendations/home${params}`);
    return response.data.data;
  }

  // 상품별 추천
  async getProductRecommendations(productId: string): Promise<{
    similarProducts: RecommendationResult[];
    boughtTogether: RecommendationResult[];
  }> {
    const response = await api.get(`/recommendations/product/${productId}`);
    return response.data.data;
  }

  // 장바구니 추천
  async getCartRecommendations(cartItems: Array<{
    productId: string;
    price: number;
    quantity: number;
  }>): Promise<{
    title: string;
    recommendations: RecommendationResult[];
  }> {
    const response = await api.post('/recommendations/cart', { cartItems });
    return response.data.data;
  }

  // 사용자 행동 추적
  async trackBehavior(data: TrackingData): Promise<void> {
    const trackingData = {
      ...data,
      anonymousId: this.getAnonymousId()
    };
    
    await api.post('/recommendations/behavior', trackingData);
  }

  // 추천 클릭 추적
  async trackClick(data: ClickData): Promise<void> {
    const clickData = {
      ...data,
      anonymousId: this.getAnonymousId()
    };
    
    await api.post('/recommendations/click', clickData);
  }

  // 추천 성능 메트릭스 조회 (관리자)
  async getMetrics(params: {
    algorithm?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<any> {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) queryParams.append(key, value);
    });
    
    const response = await api.get(`/recommendations/metrics?${queryParams}`);
    return response.data.data;
  }

  // 익명 사용자 ID 관리
  private getAnonymousId(): string {
    let anonymousId = localStorage.getItem('anonymousId');
    if (!anonymousId) {
      anonymousId = `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('anonymousId', anonymousId);
    }
    return anonymousId;
  }

  // 실시간 추천 WebSocket 연결
  connectRealtimeRecommendations(userId: string, onRecommendation: (data: any) => void) {
    // Socket.IO 연결 로직
    const socket = (window as any).io?.('/recommendations', {
      auth: { userId }
    });

    if (socket) {
      socket.on('recommendations', onRecommendation);
      socket.on('instantRecommendations', onRecommendation);
      socket.on('cartRecommendations', onRecommendation);
      
      return () => {
        socket.disconnect();
      };
    }
  }

  // 페이지 뷰 추적 헬퍼
  async trackPageView(productId: string, duration?: number): Promise<void> {
    await this.trackBehavior({
      productId,
      action: 'VIEW',
      duration
    });
  }

  // 장바구니 추가 추적 헬퍼
  async trackAddToCart(productId: string, metadata?: any): Promise<void> {
    await this.trackBehavior({
      productId,
      action: 'ADD_TO_CART',
      metadata
    });
  }

  // 구매 추적 헬퍼
  async trackPurchase(productIds: string[], orderId: string): Promise<void> {
    for (const productId of productIds) {
      await this.trackBehavior({
        productId,
        action: 'PURCHASE',
        metadata: { orderId }
      });
    }
  }
}

export const recommendationService = new RecommendationService();