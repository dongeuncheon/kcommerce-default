import { Router } from 'express';
import { reportController } from '../controllers/reportController';
import { auth } from '../../middleware/auth';

const router = Router();

// 모든 리포트 라우트에 인증 적용 (관리자만 접근 가능)
router.use(auth(['ADMIN', 'SUPER_ADMIN']));

/**
 * @swagger
 * /api/v1/reports:
 *   post:
 *     tags: [Reports]
 *     summary: 리포트 생성
 *     description: 지정된 템플릿으로 리포트를 생성합니다
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - templateId
 *             properties:
 *               templateId:
 *                 type: string
 *                 description: 리포트 템플릿 ID
 *               format:
 *                 type: string
 *                 enum: [pdf, excel, csv, json]
 *                 default: pdf
 *                 description: 리포트 포맷
 *               startDate:
 *                 type: string
 *                 format: date
 *                 description: 시작 날짜 (선택사항)
 *               endDate:
 *                 type: string
 *                 format: date
 *                 description: 종료 날짜 (선택사항)
 *               options:
 *                 type: object
 *                 description: 추가 옵션
 *     responses:
 *       201:
 *         description: 리포트 생성 성공
 *       400:
 *         description: 잘못된 요청
 *       401:
 *         description: 인증 실패
 *       500:
 *         description: 서버 오류
 */
router.post('/', reportController.generateReport);

/**
 * @swagger
 * /api/v1/reports:
 *   get:
 *     tags: [Reports]
 *     summary: 리포트 목록 조회
 *     description: 생성된 리포트 목록을 페이지네이션과 함께 조회합니다
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: 페이지 번호
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *         description: 페이지당 항목 수
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [daily, weekly, monthly, quarterly, yearly, custom]
 *         description: 리포트 타입 필터
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [pdf, excel, csv, json]
 *         description: 리포트 포맷 필터
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: 생성일 시작 필터
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: 생성일 종료 필터
 *     responses:
 *       200:
 *         description: 리포트 목록 조회 성공
 *       401:
 *         description: 인증 실패
 *       500:
 *         description: 서버 오류
 */
router.get('/', reportController.getReports);

/**
 * @swagger
 * /api/v1/reports/dashboard:
 *   get:
 *     tags: [Reports]
 *     summary: 리포트 대시보드 요약
 *     description: 리포트 관련 대시보드 요약 정보를 조회합니다
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: integer
 *           default: 30
 *         description: 조회 기간 (일)
 *     responses:
 *       200:
 *         description: 대시보드 요약 조회 성공
 *       401:
 *         description: 인증 실패
 *       500:
 *         description: 서버 오류
 */
router.get('/dashboard', reportController.getDashboardSummary);

/**
 * @swagger
 * /api/v1/reports/{reportId}:
 *   get:
 *     tags: [Reports]
 *     summary: 리포트 상세 조회
 *     description: 특정 리포트의 상세 정보를 조회합니다
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reportId
 *         required: true
 *         schema:
 *           type: string
 *         description: 리포트 ID
 *     responses:
 *       200:
 *         description: 리포트 상세 조회 성공
 *       404:
 *         description: 리포트를 찾을 수 없음
 *       401:
 *         description: 인증 실패
 *       500:
 *         description: 서버 오류
 */
router.get('/:reportId', reportController.getReportById);

/**
 * @swagger
 * /api/v1/reports/{reportId}/download:
 *   get:
 *     tags: [Reports]
 *     summary: 리포트 다운로드
 *     description: 생성된 리포트 파일을 다운로드합니다
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reportId
 *         required: true
 *         schema:
 *           type: string
 *         description: 리포트 ID
 *     responses:
 *       200:
 *         description: 리포트 파일 다운로드
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 *           text/csv:
 *             schema:
 *               type: string
 *           application/json:
 *             schema:
 *               type: object
 *       404:
 *         description: 리포트를 찾을 수 없음
 *       401:
 *         description: 인증 실패
 *       500:
 *         description: 서버 오류
 */
router.get('/:reportId/download', reportController.downloadReport);

/**
 * @swagger
 * /api/v1/reports/{reportId}:
 *   delete:
 *     tags: [Reports]
 *     summary: 리포트 삭제
 *     description: 생성된 리포트를 삭제합니다
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reportId
 *         required: true
 *         schema:
 *           type: string
 *         description: 리포트 ID
 *     responses:
 *       200:
 *         description: 리포트 삭제 성공
 *       404:
 *         description: 리포트를 찾을 수 없음
 *       401:
 *         description: 인증 실패
 *       500:
 *         description: 서버 오류
 */
router.delete('/:reportId', reportController.deleteReport);

// === 템플릿 관리 라우트 ===

/**
 * @swagger
 * /api/v1/reports/templates:
 *   get:
 *     tags: [Report Templates]
 *     summary: 리포트 템플릿 목록 조회
 *     description: 사용 가능한 모든 리포트 템플릿을 조회합니다
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 템플릿 목록 조회 성공
 *       401:
 *         description: 인증 실패
 *       500:
 *         description: 서버 오류
 */
router.get('/templates', reportController.getTemplates);

/**
 * @swagger
 * /api/v1/reports/templates:
 *   post:
 *     tags: [Report Templates]
 *     summary: 리포트 템플릿 생성
 *     description: 새로운 리포트 템플릿을 생성합니다
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - type
 *               - sections
 *             properties:
 *               name:
 *                 type: string
 *                 description: 템플릿 이름
 *               description:
 *                 type: string
 *                 description: 템플릿 설명
 *               type:
 *                 type: string
 *                 enum: [daily, weekly, monthly, quarterly, yearly, custom]
 *                 description: 리포트 타입
 *               sections:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     title:
 *                       type: string
 *                     type:
 *                       type: string
 *                       enum: [chart, table, text, metrics]
 *                     dataSource:
 *                       type: string
 *                     configuration:
 *                       type: object
 *                 description: 리포트 섹션 구성
 *               filters:
 *                 type: object
 *                 description: 필터 설정
 *               recipients:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: 이메일 수신자 목록
 *               schedule:
 *                 type: string
 *                 description: Cron 표현식 (스케줄 설정)
 *               isActive:
 *                 type: boolean
 *                 default: true
 *                 description: 활성화 여부
 *     responses:
 *       201:
 *         description: 템플릿 생성 성공
 *       400:
 *         description: 잘못된 요청
 *       401:
 *         description: 인증 실패
 *       500:
 *         description: 서버 오류
 */
router.post('/templates', reportController.createTemplate);

/**
 * @swagger
 * /api/v1/reports/templates/{templateId}:
 *   put:
 *     tags: [Report Templates]
 *     summary: 리포트 템플릿 수정
 *     description: 기존 리포트 템플릿을 수정합니다
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: templateId
 *         required: true
 *         schema:
 *           type: string
 *         description: 템플릿 ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               sections:
 *                 type: array
 *                 items:
 *                   type: object
 *               filters:
 *                 type: object
 *               recipients:
 *                 type: array
 *                 items:
 *                   type: string
 *               schedule:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: 템플릿 수정 성공
 *       404:
 *         description: 템플릿을 찾을 수 없음
 *       401:
 *         description: 인증 실패
 *       500:
 *         description: 서버 오류
 */
router.put('/templates/:templateId', reportController.updateTemplate);

/**
 * @swagger
 * /api/v1/reports/templates/{templateId}:
 *   delete:
 *     tags: [Report Templates]
 *     summary: 리포트 템플릿 삭제
 *     description: 리포트 템플릿을 삭제합니다
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: templateId
 *         required: true
 *         schema:
 *           type: string
 *         description: 템플릿 ID
 *     responses:
 *       200:
 *         description: 템플릿 삭제 성공
 *       404:
 *         description: 템플릿을 찾을 수 없음
 *       401:
 *         description: 인증 실패
 *       500:
 *         description: 서버 오류
 */
router.delete('/templates/:templateId', reportController.deleteTemplate);

/**
 * @swagger
 * /api/v1/reports/templates/{templateId}/preview:
 *   get:
 *     tags: [Report Templates]
 *     summary: 리포트 미리보기
 *     description: 템플릿을 사용하여 리포트를 미리보기합니다 (JSON 형태)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: templateId
 *         required: true
 *         schema:
 *           type: string
 *         description: 템플릿 ID
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: 시작 날짜 (선택사항)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: 종료 날짜 (선택사항)
 *     responses:
 *       200:
 *         description: 리포트 미리보기 성공
 *       404:
 *         description: 템플릿을 찾을 수 없음
 *       401:
 *         description: 인증 실패
 *       500:
 *         description: 서버 오류
 */
router.get('/templates/:templateId/preview', reportController.previewReport);

export default router;