import { Router } from 'express';
import { inquiryController } from '../controllers/inquiryController';
import { authMiddleware, optionalAuth } from '../../middleware/auth';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Inquiries
 *   description: 1:1 문의 API
 */

/**
 * @swagger
 * /api/v1/inquiries:
 *   post:
 *     summary: 문의 생성
 *     tags: [Inquiries]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - category
 *               - title
 *               - content
 *             properties:
 *               guestName:
 *                 type: string
 *               guestEmail:
 *                 type: string
 *               guestPhone:
 *                 type: string
 *               guestPassword:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [GENERAL, ORDER, PRODUCT, EXCHANGE_RETURN, PAYMENT, MEMBERSHIP, OTHER]
 *               category:
 *                 type: string
 *                 enum: [BEFORE_ORDER, ORDER_PAYMENT, DELIVERY, RETURN_EXCHANGE, PRODUCT_INFO, SITE_USAGE, MEMBERSHIP, EVENT, OTHER]
 *               orderId:
 *                 type: string
 *               productId:
 *                 type: string
 *               title:
 *                 type: string
 *               content:
 *                 type: string
 *               isPrivate:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: 문의 생성 성공
 */
router.post('/', optionalAuth, inquiryController.createInquiry);

/**
 * @swagger
 * /api/v1/inquiries:
 *   get:
 *     summary: 문의 목록 조회
 *     tags: [Inquiries]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, IN_PROGRESS, ANSWERED, CLOSED, HOLD]
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *       - in: query
 *         name: keyword
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 문의 목록
 */
router.get('/', optionalAuth, inquiryController.getInquiries);

/**
 * @swagger
 * /api/v1/inquiries/stats:
 *   get:
 *     summary: 문의 통계 조회
 *     tags: [Inquiries]
 *     responses:
 *       200:
 *         description: 문의 통계
 */
router.get('/stats', optionalAuth, inquiryController.getInquiryStats);

/**
 * @swagger
 * /api/v1/inquiries/templates:
 *   get:
 *     summary: 자동 응답 템플릿 조회
 *     tags: [Inquiries]
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 템플릿 목록
 */
router.get('/templates', inquiryController.getTemplates);

/**
 * @swagger
 * /api/v1/inquiries/{id}:
 *   get:
 *     summary: 문의 상세 조회
 *     tags: [Inquiries]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: password
 *         schema:
 *           type: string
 *         description: 비회원 문의 비밀번호
 *     responses:
 *       200:
 *         description: 문의 상세 정보
 */
router.get('/:id', optionalAuth, inquiryController.getInquiry);

/**
 * @swagger
 * /api/v1/inquiries/{id}:
 *   put:
 *     summary: 문의 수정
 *     tags: [Inquiries]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               content:
 *                 type: string
 *               status:
 *                 type: string
 *               priority:
 *                 type: string
 *               assignedToId:
 *                 type: string
 *     responses:
 *       200:
 *         description: 수정된 문의
 */
router.put('/:id', authMiddleware, inquiryController.updateInquiry);

/**
 * @swagger
 * /api/v1/inquiries/{id}/replies:
 *   post:
 *     summary: 문의 답변 작성
 *     tags: [Inquiries]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *               isInternal:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: 답변 생성 성공
 */
router.post('/:id/replies', authMiddleware, inquiryController.createReply);

/**
 * @swagger
 * /api/v1/inquiries/{id}/satisfaction:
 *   post:
 *     summary: 만족도 평가
 *     tags: [Inquiries]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - rating
 *             properties:
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *               note:
 *                 type: string
 *     responses:
 *       200:
 *         description: 평가 완료
 */
router.post('/:id/satisfaction', optionalAuth, inquiryController.rateSatisfaction);

export default router;