import { Router } from 'express';
import { oauthController } from '../controllers/oauthController';
import { authMiddleware } from '../../middleware/auth';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: OAuth
 *   description: SNS 로그인 API
 */

/**
 * @swagger
 * /api/v1/auth/naver:
 *   get:
 *     summary: 네이버 로그인 시작
 *     tags: [OAuth]
 *     parameters:
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *         description: CSRF 방지용 상태값
 *     responses:
 *       302:
 *         description: 네이버 로그인 페이지로 리다이렉트
 */
router.get('/naver', oauthController.naverLogin);

/**
 * @swagger
 * /api/v1/auth/naver/callback:
 *   get:
 *     summary: 네이버 로그인 콜백
 *     tags: [OAuth]
 *     parameters:
 *       - in: query
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *       - in: query
 *         name: error
 *         schema:
 *           type: string
 *     responses:
 *       302:
 *         description: 프론트엔드로 리다이렉트 (토큰 포함)
 */
router.get('/naver/callback', oauthController.naverCallback);

/**
 * @swagger
 * /api/v1/auth/kakao:
 *   get:
 *     summary: 카카오 로그인 시작
 *     tags: [OAuth]
 *     parameters:
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *         description: CSRF 방지용 상태값
 *     responses:
 *       302:
 *         description: 카카오 로그인 페이지로 리다이렉트
 */
router.get('/kakao', oauthController.kakaoLogin);

/**
 * @swagger
 * /api/v1/auth/kakao/callback:
 *   get:
 *     summary: 카카오 로그인 콜백
 *     tags: [OAuth]
 *     parameters:
 *       - in: query
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: error
 *         schema:
 *           type: string
 *     responses:
 *       302:
 *         description: 프론트엔드로 리다이렉트 (토큰 포함)
 */
router.get('/kakao/callback', oauthController.kakaoCallback);

/**
 * @swagger
 * /api/v1/auth/accounts:
 *   get:
 *     summary: 연결된 SNS 계정 목록 조회
 *     tags: [OAuth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 연결된 계정 목록
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
 *                       provider:
 *                         type: string
 *                       connectedAt:
 *                         type: string
 *                         format: date-time
 *                       profile:
 *                         type: object
 */
router.get('/accounts', authMiddleware, oauthController.getLinkedAccounts);

/**
 * @swagger
 * /api/v1/auth/accounts/{provider}:
 *   delete:
 *     summary: SNS 계정 연결 해제
 *     tags: [OAuth]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: provider
 *         required: true
 *         schema:
 *           type: string
 *           enum: [naver, kakao]
 *     responses:
 *       200:
 *         description: 연결 해제 성공
 *       400:
 *         description: 잘못된 요청
 *       401:
 *         description: 인증 필요
 */
router.delete('/accounts/:provider', authMiddleware, oauthController.unlinkAccount);

export default router;