import { Router } from 'express';
import { authController } from '../controllers/authController';
import { authMiddleware } from '../../middleware/auth';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: 인증 관련 API
 */

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: 이메일 로그인
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: 로그인 성공
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
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                     token:
 *                       type: string
 */
router.post('/login', authController.login);

/**
 * @swagger
 * /api/v1/auth/register:
 *   post:
 *     summary: 회원가입
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - firstName
 *               - lastName
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 */
router.post('/register', authController.register);

/**
 * @swagger
 * /api/v1/auth/logout:
 *   post:
 *     summary: 로그아웃
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 로그아웃 성공
 */
router.post('/logout', authMiddleware, authController.logout);

/**
 * @swagger
 * /api/v1/auth/refresh:
 *   post:
 *     summary: 토큰 갱신
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 토큰 갱신 성공
 */
router.post('/refresh', authMiddleware, authController.refresh);

/**
 * @swagger
 * /api/v1/auth/verify:
 *   get:
 *     summary: 토큰 검증
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 토큰 유효
 */
router.get('/verify', authMiddleware, authController.verify);

/**
 * @swagger
 * /api/v1/auth/profile:
 *   get:
 *     summary: 프로필 조회
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 프로필 정보
 */
router.get('/profile', authMiddleware, authController.getProfile);

/**
 * @swagger
 * /api/v1/auth/profile:
 *   put:
 *     summary: 프로필 수정
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *     responses:
 *       200:
 *         description: 프로필 수정 성공
 */
router.put('/profile', authMiddleware, authController.updateProfile);

export default router;