import { Request, Response } from 'express';
import { PointService } from '../../services/points/pointService';
import { logger } from '../../utils/logger';

const pointService = new PointService();

/**
 * 포인트 잔액 조회
 */
export const getBalance = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id || req.params.userId;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: '사용자 ID가 필요합니다.'
      });
    }

    const balance = await pointService.getBalance(userId);
    
    res.json({
      success: true,
      balance
    });
  } catch (error) {
    logger.error('Get point balance error:', error);
    res.status(500).json({
      success: false,
      error: '포인트 잔액 조회에 실패했습니다.'
    });
  }
};

/**
 * 포인트 내역 조회
 */
export const getHistory = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id || req.params.userId;
    const { type, startDate, endDate, page = 1, limit = 20 } = req.query;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: '사용자 ID가 필요합니다.'
      });
    }

    const result = await pointService.getHistory({
      userId,
      type: type as string,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      page: Number(page),
      limit: Number(limit)
    });
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error('Get point history error:', error);
    res.status(500).json({
      success: false,
      error: '포인트 내역 조회에 실패했습니다.'
    });
  }
};

/**
 * 포인트 적립 (관리자용)
 */
export const earnPoints = async (req: Request, res: Response) => {
  try {
    const { userId, amount, reason, reasonCode, relatedId, relatedType } = req.body;
    
    if (!userId || !amount || !reason || !reasonCode) {
      return res.status(400).json({
        success: false,
        error: '필수 정보가 누락되었습니다.'
      });
    }

    const transaction = await pointService.earnPoints({
      userId,
      amount,
      reason,
      reasonCode,
      relatedId,
      relatedType
    });
    
    res.json({
      success: true,
      transaction
    });
  } catch (error) {
    logger.error('Earn points error:', error);
    res.status(500).json({
      success: false,
      error: '포인트 적립에 실패했습니다.'
    });
  }
};

/**
 * 포인트 사용
 */
export const usePoints = async (req: Request, res: Response) => {
  try {
    const { amount, orderId } = req.body;
    const userId = req.user?.id;
    
    if (!userId || !amount || !orderId) {
      return res.status(400).json({
        success: false,
        error: '필수 정보가 누락되었습니다.'
      });
    }

    const transaction = await pointService.usePoints({
      userId,
      amount,
      orderId
    });
    
    res.json({
      success: true,
      transaction
    });
  } catch (error: any) {
    logger.error('Use points error:', error);
    res.status(error.message.includes('부족') ? 400 : 500).json({
      success: false,
      error: error.message || '포인트 사용에 실패했습니다.'
    });
  }
};

/**
 * 포인트 조정 (관리자용)
 */
export const adjustPoints = async (req: Request, res: Response) => {
  try {
    const { userId, amount, reason } = req.body;
    const adminId = req.user?.id;
    
    if (!userId || amount === undefined || !reason || !adminId) {
      return res.status(400).json({
        success: false,
        error: '필수 정보가 누락되었습니다.'
      });
    }

    const transaction = await pointService.adjustPoints(
      userId,
      amount,
      reason,
      adminId
    );
    
    res.json({
      success: true,
      transaction
    });
  } catch (error: any) {
    logger.error('Adjust points error:', error);
    res.status(500).json({
      success: false,
      error: error.message || '포인트 조정에 실패했습니다.'
    });
  }
};

/**
 * 회원가입 보너스 지급
 */
export const grantSignupBonus = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id || req.body.userId;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: '사용자 ID가 필요합니다.'
      });
    }

    const transaction = await pointService.grantSignupBonus(userId);
    
    res.json({
      success: true,
      transaction
    });
  } catch (error) {
    logger.error('Grant signup bonus error:', error);
    res.status(500).json({
      success: false,
      error: '회원가입 보너스 지급에 실패했습니다.'
    });
  }
};

/**
 * 리뷰 작성 포인트 지급
 */
export const grantReviewPoints = async (req: Request, res: Response) => {
  try {
    const { userId, reviewId } = req.body;
    
    if (!userId || !reviewId) {
      return res.status(400).json({
        success: false,
        error: '필수 정보가 누락되었습니다.'
      });
    }

    const transaction = await pointService.grantReviewPoints(userId, reviewId);
    
    res.json({
      success: true,
      transaction
    });
  } catch (error) {
    logger.error('Grant review points error:', error);
    res.status(500).json({
      success: false,
      error: '리뷰 포인트 지급에 실패했습니다.'
    });
  }
};

/**
 * 주문 완료 포인트 적립
 */
export const earnOrderPoints = async (req: Request, res: Response) => {
  try {
    const { userId, orderId, orderAmount, membershipLevel } = req.body;
    
    if (!userId || !orderId || !orderAmount) {
      return res.status(400).json({
        success: false,
        error: '필수 정보가 누락되었습니다.'
      });
    }

    const transaction = await pointService.earnOrderPoints(
      userId,
      orderId,
      orderAmount,
      membershipLevel
    );
    
    res.json({
      success: true,
      transaction
    });
  } catch (error) {
    logger.error('Earn order points error:', error);
    res.status(500).json({
      success: false,
      error: '주문 포인트 적립에 실패했습니다.'
    });
  }
};

/**
 * 포인트 사용 가능 금액 계산
 */
export const calculateUsablePoints = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { orderAmount } = req.query;
    
    if (!userId || !orderAmount) {
      return res.status(400).json({
        success: false,
        error: '필수 정보가 누락되었습니다.'
      });
    }

    const balance = await pointService.getBalance(userId);
    const calculator = new (require('../../services/points/pointCalculator').PointCalculator)({});
    const maxUsable = calculator.calculateMaxUsablePoints(
      Number(orderAmount),
      balance.availablePoints
    );
    
    res.json({
      success: true,
      availablePoints: balance.availablePoints,
      maxUsablePoints: maxUsable
    });
  } catch (error) {
    logger.error('Calculate usable points error:', error);
    res.status(500).json({
      success: false,
      error: '사용 가능 포인트 계산에 실패했습니다.'
    });
  }
};