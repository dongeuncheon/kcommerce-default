import { Router } from 'express';
import { trackingController } from '../controllers/trackingController';
import { authMiddleware } from '../../middleware/auth';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Tracking
 *   description: 배송 조회 API
 */

/**
 * @swagger
 * /api/v1/tracking/carriers:
 *   get:
 *     summary: 택배사 목록 조회
 *     tags: [Tracking]
 *     parameters:
 *       - in: query
 *         name: supported
 *         schema:
 *           type: string
 *           enum: [true, false]
 *         description: API 지원 택배사만 조회
 *     responses:
 *       200:
 *         description: 택배사 목록
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       tel:
 *                         type: string
 *                       homepage:
 *                         type: string
 *                       apiSupported:
 *                         type: boolean
 */
router.get('/carriers', trackingController.getCarriers);

/**
 * @swagger
 * /api/v1/tracking/track:
 *   get:
 *     summary: 배송 조회
 *     tags: [Tracking]
 *     parameters:
 *       - in: query
 *         name: carrierId
 *         required: true
 *         schema:
 *           type: string
 *         description: 택배사 ID
 *       - in: query
 *         name: trackingNumber
 *         required: true
 *         schema:
 *           type: string
 *         description: 운송장 번호
 *     responses:
 *       200:
 *         description: 배송 정보
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 carrier:
 *                   type: object
 *                 trackingInfo:
 *                   type: object
 *                 trackingEvents:
 *                   type: array
 *       400:
 *         description: 잘못된 요청
 *       404:
 *         description: 배송 정보를 찾을 수 없음
 */
router.get('/track', trackingController.trackShipment);

/**
 * @swagger
 * /api/v1/tracking/validate:
 *   get:
 *     summary: 운송장 번호 유효성 검사
 *     tags: [Tracking]
 *     parameters:
 *       - in: query
 *         name: carrierId
 *         required: true
 *         schema:
 *           type: string
 *         description: 택배사 ID
 *       - in: query
 *         name: trackingNumber
 *         required: true
 *         schema:
 *           type: string
 *         description: 운송장 번호
 *     responses:
 *       200:
 *         description: 유효성 검사 결과
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     valid:
 *                       type: boolean
 */
router.get('/validate', trackingController.validateTrackingNumber);

/**
 * @swagger
 * /api/v1/tracking/estimate:
 *   get:
 *     summary: 예상 배송일 계산
 *     tags: [Tracking]
 *     parameters:
 *       - in: query
 *         name: carrierId
 *         required: true
 *         schema:
 *           type: string
 *         description: 택배사 ID
 *       - in: query
 *         name: from
 *         required: true
 *         schema:
 *           type: string
 *         description: 출발지 주소
 *       - in: query
 *         name: to
 *         required: true
 *         schema:
 *           type: string
 *         description: 도착지 주소
 *     responses:
 *       200:
 *         description: 예상 배송일
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     estimatedDelivery:
 *                       type: string
 *                       format: date-time
 */
router.get('/estimate', trackingController.calculateDeliveryTime);

/**
 * @swagger
 * /api/v1/tracking/update-status:
 *   post:
 *     summary: 배송 상태 업데이트 (내부용)
 *     tags: [Tracking]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - shipmentId
 *             properties:
 *               shipmentId:
 *                 type: string
 *     responses:
 *       200:
 *         description: 업데이트 성공
 *       401:
 *         description: 인증 실패
 */
router.post('/update-status', authMiddleware, trackingController.updateShipmentStatus);

export default router;