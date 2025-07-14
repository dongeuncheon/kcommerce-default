import { Router } from 'express';
import {
  getBalance,
  getHistory,
  earnPoints,
  usePoints,
  adjustPoints,
  grantSignupBonus,
  grantReviewPoints,
  earnOrderPoints,
  calculateUsablePoints
} from '../controllers/pointController';
import { authenticate, authorize } from '../../middleware/auth';

const router = Router();

// 사용자 포인트 조회
router.get('/balance', authenticate, getBalance);
router.get('/history', authenticate, getHistory);
router.get('/usable', authenticate, calculateUsablePoints);

// 포인트 사용
router.post('/use', authenticate, usePoints);

// 관리자용 포인트 관리
router.get('/balance/:userId', authenticate, authorize(['ADMIN']), getBalance);
router.get('/history/:userId', authenticate, authorize(['ADMIN']), getHistory);
router.post('/earn', authenticate, authorize(['ADMIN']), earnPoints);
router.post('/adjust', authenticate, authorize(['ADMIN']), adjustPoints);

// 시스템 자동 포인트 지급 (내부 API)
router.post('/grant/signup', grantSignupBonus);
router.post('/grant/review', grantReviewPoints);
router.post('/grant/order', earnOrderPoints);

export default router;