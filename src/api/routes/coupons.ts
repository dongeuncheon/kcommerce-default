import { Router } from 'express';
import { couponController } from '../controllers/couponController';
import { authMiddleware } from '../../middleware/auth';
import { validateRequest } from '../../middleware/requestValidation';
import { body, param, query } from 'express-validator';

const router = Router();

// 쿠폰 생성 (관리자)
router.post('/',
  authMiddleware,
  [
    body('code').notEmpty().isLength({ min: 4, max: 50 }).withMessage('쿠폰 코드는 4-50자여야 합니다.'),
    body('name').notEmpty().withMessage('쿠폰 이름은 필수입니다.'),
    body('type').isIn(['PUBLIC', 'PRIVATE', 'WELCOME', 'BIRTHDAY', 'REWARD', 'EVENT']).withMessage('올바른 쿠폰 타입을 선택해주세요.'),
    body('discountType').isIn(['PERCENTAGE', 'FIXED', 'FREE_SHIPPING']).withMessage('올바른 할인 타입을 선택해주세요.'),
    body('discountValue').isNumeric().withMessage('할인 값은 숫자여야 합니다.'),
    body('minOrderAmount').optional().isNumeric().withMessage('최소 주문 금액은 숫자여야 합니다.'),
    body('maxDiscount').optional().isNumeric().withMessage('최대 할인 금액은 숫자여야 합니다.'),
    body('usageLimit').optional().isInt({ min: 1 }).withMessage('사용 한도는 1 이상이어야 합니다.'),
    body('perUserLimit').optional().isInt({ min: 1 }).withMessage('사용자별 한도는 1 이상이어야 합니다.'),
    body('validFrom').isISO8601().withMessage('유효 시작일은 올바른 날짜 형식이어야 합니다.'),
    body('validUntil').isISO8601().withMessage('유효 종료일은 올바른 날짜 형식이어야 합니다.')
  ],
  validateRequest,
  couponController.createCoupon
);

// 쿠폰 수정 (관리자)
router.put('/:couponId',
  authMiddleware,
  [
    param('couponId').notEmpty().withMessage('쿠폰 ID는 필수입니다.'),
    body('name').optional().notEmpty().withMessage('쿠폰 이름은 비워둘 수 없습니다.'),
    body('minOrderAmount').optional().isNumeric().withMessage('최소 주문 금액은 숫자여야 합니다.'),
    body('maxDiscount').optional().isNumeric().withMessage('최대 할인 금액은 숫자여야 합니다.'),
    body('validFrom').optional().isISO8601().withMessage('유효 시작일은 올바른 날짜 형식이어야 합니다.'),
    body('validUntil').optional().isISO8601().withMessage('유효 종료일은 올바른 날짜 형식이어야 합니다.')
  ],
  validateRequest,
  couponController.updateCoupon
);

// 쿠폰 검증
router.post('/validate',
  authMiddleware,
  [
    body('couponCode').notEmpty().withMessage('쿠폰 코드는 필수입니다.'),
    body('orderAmount').isNumeric().withMessage('주문 금액은 숫자여야 합니다.'),
    body('shippingFee').optional().isNumeric().withMessage('배송비는 숫자여야 합니다.'),
    body('items').optional().isArray().withMessage('상품 목록은 배열이어야 합니다.'),
    body('items.*.productId').optional().notEmpty().withMessage('상품 ID는 필수입니다.'),
    body('items.*.categoryId').optional().notEmpty().withMessage('카테고리 ID는 필수입니다.'),
    body('items.*.price').optional().isNumeric().withMessage('가격은 숫자여야 합니다.'),
    body('items.*.quantity').optional().isInt({ min: 1 }).withMessage('수량은 1 이상이어야 합니다.')
  ],
  validateRequest,
  couponController.validateCoupon
);

// 사용자 쿠폰 목록
router.get('/my',
  authMiddleware,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('페이지는 1 이상이어야 합니다.'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit은 1-100 사이여야 합니다.'),
    query('type').optional().isIn(['PUBLIC', 'PRIVATE', 'WELCOME', 'BIRTHDAY', 'REWARD', 'EVENT']).withMessage('올바른 쿠폰 타입을 선택해주세요.'),
    query('isActive').optional().isBoolean().withMessage('isActive는 boolean 값이어야 합니다.'),
    query('isValid').optional().isBoolean().withMessage('isValid는 boolean 값이어야 합니다.')
  ],
  validateRequest,
  couponController.getUserCoupons
);

// 쿠폰 통계 조회 (관리자)
router.get('/:couponId/statistics',
  authMiddleware,
  [
    param('couponId').notEmpty().withMessage('쿠폰 ID는 필수입니다.')
  ],
  validateRequest,
  couponController.getCouponStatistics
);

// 대량 쿠폰 생성 (관리자)
router.post('/bulk',
  authMiddleware,
  [
    body('template').isObject().withMessage('쿠폰 템플릿은 필수입니다.'),
    body('count').isInt({ min: 1, max: 1000 }).withMessage('생성 수량은 1-1000 사이여야 합니다.'),
    body('prefix').notEmpty().isLength({ min: 2, max: 20 }).withMessage('접두사는 2-20자여야 합니다.')
  ],
  validateRequest,
  couponController.createBulkCoupons
);

// 쿠폰 삭제 (관리자)
router.delete('/:couponId',
  authMiddleware,
  [
    param('couponId').notEmpty().withMessage('쿠폰 ID는 필수입니다.')
  ],
  validateRequest,
  couponController.deleteCoupon
);

// 웰컴 쿠폰 발급
router.post('/welcome',
  [
    body('userId').notEmpty().withMessage('사용자 ID는 필수입니다.')
  ],
  validateRequest,
  couponController.issueWelcomeCoupon
);

// 프로모션 평가
router.post('/promotions/evaluate',
  authMiddleware,
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
  couponController.evaluatePromotions
);

// 활성 프로모션 목록
router.get('/promotions',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('페이지는 1 이상이어야 합니다.'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit은 1-100 사이여야 합니다.'),
    query('type').optional().isIn(['DISCOUNT', 'BUNDLE', 'BOGO', 'FREE_GIFT', 'TIERED_DISCOUNT', 'FLASH_SALE', 'MEMBER_ONLY']).withMessage('올바른 프로모션 타입을 선택해주세요.'),
    query('categoryId').optional().isString(),
    query('productId').optional().isString()
  ],
  validateRequest,
  couponController.getAvailablePromotions
);

export default router;