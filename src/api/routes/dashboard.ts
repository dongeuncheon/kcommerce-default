import { Router } from 'express';
import { dashboardController } from '../controllers/dashboardController';
import { auth } from '../../middleware/auth';

const router = Router();

// 모든 대시보드 라우트는 관리자 권한 필요
router.use(auth(['ADMIN', 'SUPER_ADMIN']));

// 메인 대시보드 메트릭스
router.get('/metrics', dashboardController.getDashboardMetrics);

// 시계열 데이터
router.get('/timeseries', dashboardController.getTimeSeriesData);

// 실시간 매출
router.get('/sales/realtime', dashboardController.getRealtimeSales);

// 주문 분석
router.get('/orders/analytics', dashboardController.getOrderAnalytics);

// 고객 분석
router.get('/customers/analytics', dashboardController.getCustomerAnalytics);

// 상품 성과 분석
router.get('/products/analytics', dashboardController.getProductAnalytics);

// 재고 분석
router.get('/inventory/analytics', dashboardController.getInventoryAnalytics);

// 이벤트 기록
router.post('/events', dashboardController.recordEvent);

export default router;