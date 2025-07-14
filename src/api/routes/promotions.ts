import { Router } from 'express';
import { promotionController } from '../controllers/promotionController';
import { authMiddleware } from '../../middleware/auth';
import { validateRequest } from '../../middleware/requestValidation';
import { body, param, query } from 'express-validator';

const router = Router();

// 프로모션 생성 (관리자)
router.post('/',
  authMiddleware,
  [
    body('name').notEmpty().withMessage('프로모션 이름은 필수입니다.'),
    body('type').isIn(['DISCOUNT', 'BUNDLE', 'BOGO', 'FREE_GIFT', 'TIERED_DISCOUNT', 'FLASH_SALE', 'MEMBER_ONLY']).withMessage('올바른 프로모션 타입을 선택해주세요.'),
    body('priority').optional().isInt({ min: 0 }).withMessage('우선순위는 0 이상이어야 합니다.'),
    body('conditions').isObject().withMessage('조건은 객체여야 합니다.'),
    body('actions').isObject().withMessage('액션은 객체여야 합니다.'),
    body('startDate').isISO8601().withMessage('시작일은 올바른 날짜 형식이어야 합니다.'),
    body('endDate').isISO8601().withMessage('종료일은 올바른 날짜 형식이어야 합니다.'),
    body('isActive').optional().isBoolean().withMessage('활성 상태는 boolean 값이어야 합니다.'),
    body('isExclusive').optional().isBoolean().withMessage('독점 여부는 boolean 값이어야 합니다.')
  ],
  validateRequest,
  promotionController.createPromotion
);

// 프로모션 수정 (관리자)
router.put('/:promotionId',
  authMiddleware,
  [
    param('promotionId').notEmpty().withMessage('프로모션 ID는 필수입니다.'),
    body('name').optional().notEmpty().withMessage('프로모션 이름은 비워둘 수 없습니다.'),
    body('priority').optional().isInt({ min: 0 }).withMessage('우선순위는 0 이상이어야 합니다.'),
    body('startDate').optional().isISO8601().withMessage('시작일은 올바른 날짜 형식이어야 합니다.'),
    body('endDate').optional().isISO8601().withMessage('종료일은 올바른 날짜 형식이어야 합니다.')
  ],
  validateRequest,
  promotionController.updatePromotion
);

// 프로모션 통계 조회 (관리자)
router.get('/:promotionId/statistics',
  authMiddleware,
  [
    param('promotionId').notEmpty().withMessage('프로모션 ID는 필수입니다.')
  ],
  validateRequest,
  promotionController.getPromotionStatistics
);

// 플래시 세일 생성 (관리자)
router.post('/flash-sale',
  authMiddleware,
  [
    body('name').notEmpty().withMessage('플래시 세일 이름은 필수입니다.'),
    body('products').isArray({ min: 1 }).withMessage('상품 목록은 필수입니다.'),
    body('products.*').isString().withMessage('상품 ID는 문자열이어야 합니다.'),
    body('discountPercentage').isInt({ min: 1, max: 99 }).withMessage('할인율은 1-99% 사이여야 합니다.'),
    body('duration').isInt({ min: 1, max: 72 }).withMessage('기간은 1-72시간 사이여야 합니다.')
  ],
  validateRequest,
  promotionController.createFlashSale
);

// BOGO 프로모션 생성 (관리자)
router.post('/bogo',
  authMiddleware,
  [
    body('name').notEmpty().withMessage('BOGO 프로모션 이름은 필수입니다.'),
    body('buyProducts').isArray({ min: 1 }).withMessage('구매 상품 목록은 필수입니다.'),
    body('buyProducts.*').isString().withMessage('구매 상품 ID는 문자열이어야 합니다.'),
    body('getProducts').isArray({ min: 1 }).withMessage('증정 상품 목록은 필수입니다.'),
    body('getProducts.*').isString().withMessage('증정 상품 ID는 문자열이어야 합니다.'),
    body('getQuantity').optional().isInt({ min: 1 }).withMessage('증정 수량은 1 이상이어야 합니다.')
  ],
  validateRequest,
  promotionController.createBOGOPromotion
);

// 프로모션 삭제 (관리자)
router.delete('/:promotionId',
  authMiddleware,
  [
    param('promotionId').notEmpty().withMessage('프로모션 ID는 필수입니다.')
  ],
  validateRequest,
  promotionController.deletePromotion
);

// 활성 프로모션 목록 (공개)
router.get('/',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('페이지는 1 이상이어야 합니다.'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit은 1-100 사이여야 합니다.'),
    query('type').optional().isIn(['DISCOUNT', 'BUNDLE', 'BOGO', 'FREE_GIFT', 'TIERED_DISCOUNT', 'FLASH_SALE', 'MEMBER_ONLY']).withMessage('올바른 프로모션 타입을 선택해주세요.'),
    query('categoryId').optional().isString(),
    query('productId').optional().isString()
  ],
  validateRequest,
  promotionController.getActivePromotions
);

// 프로모션 시뮬레이션
router.post('/simulate',
  [
    body('amount').isNumeric().withMessage('주문 금액은 숫자여야 합니다.'),
    body('items').isArray().withMessage('상품 목록은 배열이어야 합니다.'),
    body('items.*.productId').notEmpty().withMessage('상품 ID는 필수입니다.'),
    body('items.*.categoryId').notEmpty().withMessage('카테고리 ID는 필수입니다.'),
    body('items.*.price').isNumeric().withMessage('가격은 숫자여야 합니다.'),
    body('items.*.quantity').isInt({ min: 1 }).withMessage('수량은 1 이상이어야 합니다.'),
    body('paymentMethod').optional().isString()
  ],
  validateRequest,
  promotionController.simulatePromotion
);

export default router;