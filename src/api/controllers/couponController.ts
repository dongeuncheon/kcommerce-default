import { Request, Response } from 'express';
import { couponService } from '../../services/couponService';
import { promotionService } from '../../services/promotionService';
import { AuthenticatedRequest } from '../../types/index';
import { CreateCouponDto, UpdateCouponDto, ApplyCouponDto } from '../../types/coupon';

class CouponController {
  // 쿠폰 생성 (관리자)
  async createCoupon(req: AuthenticatedRequest, res: Response) {
    try {
      if (req.user?.role !== 'ADMIN') {
        return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
      }

      const createCouponDto: CreateCouponDto = req.body;
      const coupon = await couponService.createCoupon(createCouponDto);

      res.status(201).json({
        success: true,
        data: coupon,
        message: '쿠폰이 생성되었습니다.'
      });
    } catch (error: any) {
      console.error('Create coupon error:', error);
      res.status(500).json({ 
        error: error.message || '쿠폰 생성 중 오류가 발생했습니다.' 
      });
    }
  }

  // 쿠폰 수정 (관리자)
  async updateCoupon(req: AuthenticatedRequest, res: Response) {
    try {
      if (req.user?.role !== 'ADMIN') {
        return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
      }

      const couponId = req.params.couponId;
      const updateData: UpdateCouponDto = req.body;
      
      const coupon = await couponService.updateCoupon(couponId, updateData);

      res.json({
        success: true,
        data: coupon,
        message: '쿠폰이 수정되었습니다.'
      });
    } catch (error: any) {
      console.error('Update coupon error:', error);
      res.status(500).json({ 
        error: error.message || '쿠폰 수정 중 오류가 발생했습니다.' 
      });
    }
  }

  // 쿠폰 검증
  async validateCoupon(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: '인증이 필요합니다.' });
      }

      const applyCouponDto: ApplyCouponDto = req.body;
      const result = await couponService.validateCoupon(userId, applyCouponDto);

      res.json({
        success: true,
        data: result
      });
    } catch (error: any) {
      console.error('Validate coupon error:', error);
      res.status(500).json({ 
        error: error.message || '쿠폰 검증 중 오류가 발생했습니다.' 
      });
    }
  }

  // 사용자 쿠폰 목록
  async getUserCoupons(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: '인증이 필요합니다.' });
      }

      const query = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
        type: req.query.type as any,
        isActive: req.query.isActive !== 'false',
        isValid: req.query.isValid !== 'false'
      };

      const result = await couponService.getUserCoupons(userId, query);

      res.json({
        success: true,
        data: result
      });
    } catch (error: any) {
      console.error('Get user coupons error:', error);
      res.status(500).json({ 
        error: error.message || '쿠폰 조회 중 오류가 발생했습니다.' 
      });
    }
  }

  // 쿠폰 통계 조회 (관리자)
  async getCouponStatistics(req: AuthenticatedRequest, res: Response) {
    try {
      if (req.user?.role !== 'ADMIN') {
        return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
      }

      const couponId = req.params.couponId;
      const statistics = await couponService.getCouponStatistics(couponId);

      res.json({
        success: true,
        data: statistics
      });
    } catch (error: any) {
      console.error('Get coupon statistics error:', error);
      res.status(500).json({ 
        error: error.message || '통계 조회 중 오류가 발생했습니다.' 
      });
    }
  }

  // 대량 쿠폰 생성 (관리자)
  async createBulkCoupons(req: AuthenticatedRequest, res: Response) {
    try {
      if (req.user?.role !== 'ADMIN') {
        return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
      }

      const { template, count, prefix } = req.body;

      if (!template || !count || !prefix) {
        return res.status(400).json({ 
          error: '템플릿, 수량, 접두사는 필수입니다.' 
        });
      }

      const codes = await couponService.createBulkCoupons(template, count, prefix);

      res.json({
        success: true,
        data: {
          count: codes.length,
          codes
        },
        message: `${codes.length}개의 쿠폰이 생성되었습니다.`
      });
    } catch (error: any) {
      console.error('Create bulk coupons error:', error);
      res.status(500).json({ 
        error: error.message || '대량 쿠폰 생성 중 오류가 발생했습니다.' 
      });
    }
  }

  // 쿠폰 삭제 (관리자)
  async deleteCoupon(req: AuthenticatedRequest, res: Response) {
    try {
      if (req.user?.role !== 'ADMIN') {
        return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
      }

      const couponId = req.params.couponId;
      await couponService.deleteCoupon(couponId);

      res.json({
        success: true,
        message: '쿠폰이 삭제되었습니다.'
      });
    } catch (error: any) {
      console.error('Delete coupon error:', error);
      res.status(500).json({ 
        error: error.message || '쿠폰 삭제 중 오류가 발생했습니다.' 
      });
    }
  }

  // 프로모션 평가 (주문 시)
  async evaluatePromotions(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: '인증이 필요합니다.' });
      }

      const orderData = req.body;
      const result = await promotionService.evaluatePromotions(userId, orderData);

      res.json({
        success: true,
        data: result
      });
    } catch (error: any) {
      console.error('Evaluate promotions error:', error);
      res.status(500).json({ 
        error: error.message || '프로모션 평가 중 오류가 발생했습니다.' 
      });
    }
  }

  // 사용 가능한 프로모션 목록
  async getAvailablePromotions(req: Request, res: Response) {
    try {
      const query = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
        type: req.query.type as any,
        targetCategory: req.query.categoryId as string,
        targetProduct: req.query.productId as string
      };

      const result = await promotionService.getPromotions(query);

      res.json({
        success: true,
        data: result
      });
    } catch (error: any) {
      console.error('Get promotions error:', error);
      res.status(500).json({ 
        error: error.message || '프로모션 조회 중 오류가 발생했습니다.' 
      });
    }
  }

  // 웰컴 쿠폰 발급 (신규 가입 시)
  async issueWelcomeCoupon(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.body.userId || req.user?.id;
      if (!userId) {
        return res.status(400).json({ error: '사용자 ID가 필요합니다.' });
      }

      await couponService.issueWelcomeCoupon(userId);

      res.json({
        success: true,
        message: '웰컴 쿠폰이 발급되었습니다.'
      });
    } catch (error: any) {
      console.error('Issue welcome coupon error:', error);
      res.status(500).json({ 
        error: error.message || '웰컴 쿠폰 발급 중 오류가 발생했습니다.' 
      });
    }
  }
}

export const couponController = new CouponController();