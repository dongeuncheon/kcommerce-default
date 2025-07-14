import { Router } from 'express';
import { reviewController } from '../controllers/reviewController';
import { authMiddleware } from '../../middleware/auth';
import { upload } from '../../middleware/upload';
import { validateRequest } from '../../middleware/requestValidation';
import { body, param, query } from 'express-validator';

const router = Router();

// 리뷰 생성 (인증 필요)
router.post('/',
  authMiddleware,
  upload.fields([
    { name: 'images', maxCount: 5 },
    { name: 'videos', maxCount: 2 }
  ]),
  [
    body('productId').notEmpty().withMessage('상품 ID는 필수입니다.'),
    body('rating').isInt({ min: 1, max: 5 }).withMessage('평점은 1-5 사이여야 합니다.'),
    body('title').optional().isLength({ max: 100 }).withMessage('제목은 100자 이하여야 합니다.'),
    body('comment').optional().isLength({ max: 2000 }).withMessage('내용은 2000자 이하여야 합니다.'),
    body('pros').optional().isLength({ max: 500 }).withMessage('장점은 500자 이하여야 합니다.'),
    body('cons').optional().isLength({ max: 500 }).withMessage('단점은 500자 이하여야 합니다.'),
    body('qualityRating').optional().isInt({ min: 1, max: 5 }).withMessage('품질 평점은 1-5 사이여야 합니다.'),
    body('valueRating').optional().isInt({ min: 1, max: 5 }).withMessage('가성비 평점은 1-5 사이여야 합니다.'),
    body('deliveryRating').optional().isInt({ min: 1, max: 5 }).withMessage('배송 평점은 1-5 사이여야 합니다.')
  ],
  validateRequest,
  reviewController.createReview
);

// 상품별 리뷰 목록 조회
router.get('/product/:productId',
  [
    param('productId').notEmpty().withMessage('상품 ID는 필수입니다.'),
    query('page').optional().isInt({ min: 1 }).withMessage('페이지는 1 이상이어야 합니다.'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('limit은 1-50 사이여야 합니다.'),
    query('sortBy').optional().isIn(['latest', 'oldest', 'rating_high', 'rating_low', 'helpful']).withMessage('올바른 정렬 기준을 선택해주세요.'),
    query('rating').optional().isInt({ min: 1, max: 5 }).withMessage('평점은 1-5 사이여야 합니다.'),
    query('reviewType').optional().isIn(['GENERAL', 'PHOTO', 'VIDEO', 'EXPERIENCE']).withMessage('올바른 리뷰 타입을 선택해주세요.'),
    query('verified').optional().isBoolean().withMessage('verified는 boolean 값이어야 합니다.'),
    query('bestOnly').optional().isBoolean().withMessage('bestOnly는 boolean 값이어야 합니다.')
  ],
  validateRequest,
  reviewController.getProductReviews
);

// 상품별 리뷰 통계 조회
router.get('/product/:productId/statistics',
  [
    param('productId').notEmpty().withMessage('상품 ID는 필수입니다.')
  ],
  validateRequest,
  reviewController.getReviewStatistics
);

// 베스트 리뷰 선정 (관리자만)
router.post('/product/:productId/best',
  authMiddleware,
  [
    param('productId').notEmpty().withMessage('상품 ID는 필수입니다.'),
    body('minRating').optional().isInt({ min: 1, max: 5 }).withMessage('최소 평점은 1-5 사이여야 합니다.'),
    body('minHelpfulCount').optional().isInt({ min: 0 }).withMessage('최소 도움됨 수는 0 이상이어야 합니다.'),
    body('maxCount').optional().isInt({ min: 1, max: 10 }).withMessage('최대 개수는 1-10 사이여야 합니다.')
  ],
  validateRequest,
  reviewController.selectBestReviews
);

// 리뷰 투표 (도움됨/안됨)
router.post('/:reviewId/vote',
  authMiddleware,
  [
    param('reviewId').notEmpty().withMessage('리뷰 ID는 필수입니다.'),
    body('isHelpful').isBoolean().withMessage('isHelpful은 boolean 값이어야 합니다.')
  ],
  validateRequest,
  reviewController.voteReview
);

// 리뷰 수정 (작성자 또는 관리자)
router.put('/:reviewId',
  authMiddleware,
  upload.fields([
    { name: 'images', maxCount: 5 },
    { name: 'videos', maxCount: 2 }
  ]),
  [
    param('reviewId').notEmpty().withMessage('리뷰 ID는 필수입니다.'),
    body('rating').optional().isInt({ min: 1, max: 5 }).withMessage('평점은 1-5 사이여야 합니다.'),
    body('title').optional().isLength({ max: 100 }).withMessage('제목은 100자 이하여야 합니다.'),
    body('comment').optional().isLength({ max: 2000 }).withMessage('내용은 2000자 이하여야 합니다.'),
    body('pros').optional().isLength({ max: 500 }).withMessage('장점은 500자 이하여야 합니다.'),
    body('cons').optional().isLength({ max: 500 }).withMessage('단점은 500자 이하여야 합니다.')
  ],
  validateRequest,
  reviewController.updateReview
);

// 리뷰 삭제 (작성자 또는 관리자)
router.delete('/:reviewId',
  authMiddleware,
  [
    param('reviewId').notEmpty().withMessage('리뷰 ID는 필수입니다.')
  ],
  validateRequest,
  reviewController.deleteReview
);

// 리뷰 답글 작성 (판매자/관리자)
router.post('/:reviewId/reply',
  authMiddleware,
  [
    param('reviewId').notEmpty().withMessage('리뷰 ID는 필수입니다.'),
    body('content').notEmpty().isLength({ max: 1000 }).withMessage('답글 내용은 1000자 이하여야 합니다.')
  ],
  validateRequest,
  reviewController.createReply
);

// 내가 작성한 리뷰 조회
router.get('/my',
  authMiddleware,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('페이지는 1 이상이어야 합니다.'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('limit은 1-50 사이여야 합니다.')
  ],
  validateRequest,
  reviewController.getMyReviews
);

// 리뷰 신고
router.post('/:reviewId/report',
  authMiddleware,
  [
    param('reviewId').notEmpty().withMessage('리뷰 ID는 필수입니다.'),
    body('reason').notEmpty().isLength({ max: 500 }).withMessage('신고 사유는 필수이며 500자 이하여야 합니다.')
  ],
  validateRequest,
  reviewController.reportReview
);

export default router;