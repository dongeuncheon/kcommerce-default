import { Router } from 'express';
import { recommendationController } from '../controllers/recommendationController';
import { authMiddleware } from '../../middleware/auth';
import { rateLimiter } from '../../middleware/rateLimiter';
import { validateRequest } from '../../middleware/requestValidation';
import { body, query, param } from 'express-validator';

const router = Router();

// 추천 조회 (인증 선택적)
router.get('/',
  rateLimiter({ windowMs: 60000, max: 100 }), // 분당 100회
  [
    query('algorithm').optional().isIn([
      'collaborative', 'content', 'hybrid', 'trending', 
      'personalized', 'similar_users', 'similar_products'
    ]).withMessage('올바른 알고리즘을 선택해주세요.'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit은 1-100 사이여야 합니다.'),
    query('offset').optional().isInt({ min: 0 }).withMessage('offset은 0 이상이어야 합니다.'),
    query('categoryId').optional().isString(),
    query('exclude').optional().isString(),
    query('minPrice').optional().isNumeric(),
    query('maxPrice').optional().isNumeric()
  ],
  validateRequest,
  recommendationController.getRecommendations
);

// 홈페이지 추천
router.get('/home',
  rateLimiter({ windowMs: 60000, max: 100 }),
  [
    query('categoryId').optional().isString()
  ],
  validateRequest,
  recommendationController.getHomeRecommendations
);

// 상품별 추천
router.get('/product/:productId',
  rateLimiter({ windowMs: 60000, max: 100 }),
  [
    param('productId').notEmpty().withMessage('상품 ID는 필수입니다.')
  ],
  validateRequest,
  recommendationController.getProductRecommendations
);

// 장바구니 추천
router.post('/cart',
  authMiddleware,
  rateLimiter({ windowMs: 60000, max: 50 }),
  [
    body('cartItems').isArray().withMessage('장바구니 아이템 배열이 필요합니다.'),
    body('cartItems.*.productId').notEmpty().withMessage('상품 ID는 필수입니다.'),
    body('cartItems.*.price').isNumeric().withMessage('가격은 숫자여야 합니다.'),
    body('cartItems.*.quantity').isInt({ min: 1 }).withMessage('수량은 1 이상이어야 합니다.')
  ],
  validateRequest,
  recommendationController.getCartRecommendations
);

// 사용자 행동 추적
router.post('/behavior',
  rateLimiter({ windowMs: 60000, max: 200 }),
  [
    body('productId').notEmpty().withMessage('상품 ID는 필수입니다.'),
    body('action').notEmpty().isIn([
      'VIEW', 'CLICK', 'ADD_TO_CART', 'REMOVE_FROM_CART', 
      'PURCHASE', 'REVIEW', 'WISHLIST_ADD', 'WISHLIST_REMOVE', 
      'SEARCH', 'SHARE'
    ]).withMessage('올바른 액션 타입을 선택해주세요.'),
    body('duration').optional().isInt({ min: 0 }).withMessage('지속 시간은 0 이상이어야 합니다.'),
    body('metadata').optional().isObject(),
    body('anonymousId').optional().isString()
  ],
  validateRequest,
  recommendationController.trackBehavior
);

// 추천 클릭 추적
router.post('/click',
  rateLimiter({ windowMs: 60000, max: 200 }),
  [
    body('productId').notEmpty().withMessage('상품 ID는 필수입니다.'),
    body('algorithm').notEmpty().withMessage('알고리즘은 필수입니다.'),
    body('position').isInt({ min: 0 }).withMessage('위치는 0 이상이어야 합니다.'),
    body('recommendationId').optional().isString(),
    body('anonymousId').optional().isString()
  ],
  validateRequest,
  recommendationController.trackRecommendationClick
);

// 추천 성능 메트릭스 (관리자 전용)
router.get('/metrics',
  authMiddleware,
  [
    query('algorithm').optional().isString(),
    query('startDate').optional().isISO8601().withMessage('올바른 날짜 형식이 아닙니다.'),
    query('endDate').optional().isISO8601().withMessage('올바른 날짜 형식이 아닙니다.')
  ],
  validateRequest,
  recommendationController.getRecommendationMetrics
);

export default router;