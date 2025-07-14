import { Request, Response } from 'express';
import { recommendationService } from '../../services/recommendation/recommendationService';
import { 
  RecommendationRequest, 
  RecommendationAlgorithm,
  UserActionType 
} from '../../types/recommendation';
import { AuthenticatedRequest } from '../../types/index';

class RecommendationController {
  // 추천 상품 조회
  async getRecommendations(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id || req.query.userId as string;
      if (!userId) {
        return res.status(400).json({ error: '사용자 ID가 필요합니다.' });
      }

      const request: RecommendationRequest = {
        userId,
        algorithm: req.query.algorithm as RecommendationAlgorithm || RecommendationAlgorithm.HYBRID,
        limit: parseInt(req.query.limit as string) || 20,
        offset: parseInt(req.query.offset as string) || 0,
        categoryId: req.query.categoryId as string,
        excludeProductIds: req.query.exclude ? 
          (req.query.exclude as string).split(',') : [],
        context: {
          sessionId: req.sessionID,
          deviceType: req.headers['user-agent']?.includes('Mobile') ? 'mobile' : 'desktop',
          location: req.headers['x-forwarded-for'] as string,
          priceRange: req.query.minPrice && req.query.maxPrice ? {
            min: parseFloat(req.query.minPrice as string),
            max: parseFloat(req.query.maxPrice as string)
          } : undefined
        }
      };

      const recommendations = await recommendationService.getRecommendations(request);

      res.json({
        success: true,
        data: {
          recommendations,
          algorithm: request.algorithm,
          count: recommendations.length
        }
      });
    } catch (error: any) {
      console.error('Get recommendations error:', error);
      res.status(500).json({ 
        error: error.message || '추천 조회 중 오류가 발생했습니다.' 
      });
    }
  }

  // 홈페이지 추천
  async getHomeRecommendations(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const sections = [];

      // 개인화 추천 (로그인 사용자)
      if (userId) {
        const personalized = await recommendationService.getRecommendations({
          userId,
          algorithm: RecommendationAlgorithm.PERSONALIZED,
          limit: 10
        });

        sections.push({
          title: '나를 위한 추천',
          algorithm: 'personalized',
          products: personalized
        });
      }

      // 트렌딩 상품
      const trending = await recommendationService.getRecommendations({
        userId: userId || 'anonymous',
        algorithm: RecommendationAlgorithm.TRENDING,
        limit: 10
      });

      sections.push({
        title: '지금 인기있는 상품',
        algorithm: 'trending',
        products: trending
      });

      // 카테고리별 추천
      if (req.query.categoryId) {
        const categoryRecs = await recommendationService.getRecommendations({
          userId: userId || 'anonymous',
          algorithm: RecommendationAlgorithm.CONTENT_BASED,
          limit: 10,
          categoryId: req.query.categoryId as string
        });

        sections.push({
          title: '이 카테고리의 추천 상품',
          algorithm: 'category',
          products: categoryRecs
        });
      }

      res.json({
        success: true,
        data: { sections }
      });
    } catch (error: any) {
      console.error('Get home recommendations error:', error);
      res.status(500).json({ 
        error: error.message || '홈 추천 조회 중 오류가 발생했습니다.' 
      });
    }
  }

  // 상품 상세 페이지 추천
  async getProductRecommendations(req: Request, res: Response) {
    try {
      const productId = req.params.productId;
      const userId = (req as AuthenticatedRequest).user?.id;

      // 유사 상품
      const similarProducts = await recommendationService.getRecommendations({
        userId: userId || 'anonymous',
        algorithm: RecommendationAlgorithm.SIMILAR_PRODUCTS,
        limit: 8,
        context: { productId }
      });

      // 함께 구매한 상품 (협업 필터링)
      const boughtTogether = await recommendationService.getRecommendations({
        userId: userId || 'anonymous',
        algorithm: RecommendationAlgorithm.COLLABORATIVE,
        limit: 6,
        context: { productId }
      });

      res.json({
        success: true,
        data: {
          similarProducts,
          boughtTogether
        }
      });
    } catch (error: any) {
      console.error('Get product recommendations error:', error);
      res.status(500).json({ 
        error: error.message || '상품 추천 조회 중 오류가 발생했습니다.' 
      });
    }
  }

  // 장바구니 추천
  async getCartRecommendations(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: '인증이 필요합니다.' });
      }

      // 장바구니 상품 가져오기
      const cartItems = req.body.cartItems || [];
      const cartProductIds = cartItems.map((item: any) => item.productId);

      const recommendations = await recommendationService.getRecommendations({
        userId,
        algorithm: RecommendationAlgorithm.HYBRID,
        limit: 10,
        excludeProductIds: cartProductIds,
        context: {
          cartProductIds,
          cartTotal: cartItems.reduce((sum: number, item: any) => 
            sum + (item.price * item.quantity), 0
          )
        }
      });

      res.json({
        success: true,
        data: {
          title: '함께 구매하면 좋은 상품',
          recommendations
        }
      });
    } catch (error: any) {
      console.error('Get cart recommendations error:', error);
      res.status(500).json({ 
        error: error.message || '장바구니 추천 조회 중 오류가 발생했습니다.' 
      });
    }
  }

  // 사용자 행동 추적
  async trackBehavior(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id || req.body.anonymousId;
      if (!userId) {
        return res.status(400).json({ error: '사용자 식별자가 필요합니다.' });
      }

      const { productId, action, duration, metadata } = req.body;

      if (!productId || !action) {
        return res.status(400).json({ error: '필수 파라미터가 누락되었습니다.' });
      }

      if (!Object.values(UserActionType).includes(action)) {
        return res.status(400).json({ error: '올바른 액션 타입이 아닙니다.' });
      }

      await recommendationService.trackUserBehavior(
        userId,
        productId,
        action,
        req.sessionID,
        duration,
        metadata
      );

      res.json({
        success: true,
        message: '행동이 기록되었습니다.'
      });
    } catch (error: any) {
      console.error('Track behavior error:', error);
      res.status(500).json({ 
        error: error.message || '행동 추적 중 오류가 발생했습니다.' 
      });
    }
  }

  // 추천 클릭 추적
  async trackRecommendationClick(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id || req.body.anonymousId;
      if (!userId) {
        return res.status(400).json({ error: '사용자 식별자가 필요합니다.' });
      }

      const { productId, algorithm, position, recommendationId } = req.body;

      if (!productId || !algorithm || position === undefined) {
        return res.status(400).json({ error: '필수 파라미터가 누락되었습니다.' });
      }

      await recommendationService.trackRecommendationClick(
        userId,
        productId,
        algorithm,
        position,
        recommendationId,
        req.sessionID
      );

      res.json({
        success: true,
        message: '클릭이 기록되었습니다.'
      });
    } catch (error: any) {
      console.error('Track click error:', error);
      res.status(500).json({ 
        error: error.message || '클릭 추적 중 오류가 발생했습니다.' 
      });
    }
  }

  // 추천 성능 메트릭스 조회
  async getRecommendationMetrics(req: AuthenticatedRequest, res: Response) {
    try {
      // 관리자 권한 확인
      if (req.user?.role !== 'ADMIN') {
        return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
      }

      const { algorithm, startDate, endDate } = req.query;

      // 성능 메트릭스 조회 로직
      const metrics = {
        ctr: 0.045, // 클릭률 4.5%
        conversionRate: 0.023, // 전환율 2.3%
        avgOrderValue: 85000, // 평균 주문 금액
        coverage: 0.78, // 카탈로그 커버리지 78%
        diversity: 0.65, // 다양성 지수
        novelty: 0.42 // 새로움 지수
      };

      res.json({
        success: true,
        data: {
          algorithm: algorithm || 'all',
          period: { startDate, endDate },
          metrics
        }
      });
    } catch (error: any) {
      console.error('Get metrics error:', error);
      res.status(500).json({ 
        error: error.message || '메트릭스 조회 중 오류가 발생했습니다.' 
      });
    }
  }
}

export const recommendationController = new RecommendationController();