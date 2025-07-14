import { Request, Response } from 'express';
import { promotionService } from '../../services/promotionService';
import { AuthenticatedRequest } from '../../types/index';
import { CreatePromotionDto, UpdatePromotionDto } from '../../types/promotion';

class PromotionController {
  // 프로모션 생성 (관리자)
  async createPromotion(req: AuthenticatedRequest, res: Response) {
    try {
      if (req.user?.role !== 'ADMIN') {
        return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
      }

      const createPromotionDto: CreatePromotionDto = req.body;
      const promotion = await promotionService.createPromotion(createPromotionDto);

      res.status(201).json({
        success: true,
        data: promotion,
        message: '프로모션이 생성되었습니다.'
      });
    } catch (error: any) {
      console.error('Create promotion error:', error);
      res.status(500).json({ 
        error: error.message || '프로모션 생성 중 오류가 발생했습니다.' 
      });
    }
  }

  // 프로모션 수정 (관리자)
  async updatePromotion(req: AuthenticatedRequest, res: Response) {
    try {
      if (req.user?.role !== 'ADMIN') {
        return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
      }

      const promotionId = req.params.promotionId;
      const updateData: UpdatePromotionDto = req.body;
      
      const promotion = await promotionService.updatePromotion(promotionId, updateData);

      res.json({
        success: true,
        data: promotion,
        message: '프로모션이 수정되었습니다.'
      });
    } catch (error: any) {
      console.error('Update promotion error:', error);
      res.status(500).json({ 
        error: error.message || '프로모션 수정 중 오류가 발생했습니다.' 
      });
    }
  }

  // 프로모션 통계 조회 (관리자)
  async getPromotionStatistics(req: AuthenticatedRequest, res: Response) {
    try {
      if (req.user?.role !== 'ADMIN') {
        return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
      }

      const promotionId = req.params.promotionId;
      const statistics = await promotionService.getPromotionStatistics(promotionId);

      res.json({
        success: true,
        data: statistics
      });
    } catch (error: any) {
      console.error('Get promotion statistics error:', error);
      res.status(500).json({ 
        error: error.message || '통계 조회 중 오류가 발생했습니다.' 
      });
    }
  }

  // 플래시 세일 생성 (관리자)
  async createFlashSale(req: AuthenticatedRequest, res: Response) {
    try {
      if (req.user?.role !== 'ADMIN') {
        return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
      }

      const { name, products, discountPercentage, duration } = req.body;

      if (!name || !products || !discountPercentage || !duration) {
        return res.status(400).json({ 
          error: '필수 정보가 누락되었습니다.' 
        });
      }

      const flashSale = await promotionService.createFlashSale(
        name,
        products,
        discountPercentage,
        duration
      );

      res.status(201).json({
        success: true,
        data: flashSale,
        message: '플래시 세일이 생성되었습니다.'
      });
    } catch (error: any) {
      console.error('Create flash sale error:', error);
      res.status(500).json({ 
        error: error.message || '플래시 세일 생성 중 오류가 발생했습니다.' 
      });
    }
  }

  // BOGO 프로모션 생성 (관리자)
  async createBOGOPromotion(req: AuthenticatedRequest, res: Response) {
    try {
      if (req.user?.role !== 'ADMIN') {
        return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
      }

      const { name, buyProducts, getProducts, getQuantity } = req.body;

      if (!name || !buyProducts || !getProducts) {
        return res.status(400).json({ 
          error: '필수 정보가 누락되었습니다.' 
        });
      }

      const bogo = await promotionService.createBOGOPromotion(
        name,
        buyProducts,
        getProducts,
        getQuantity
      );

      res.status(201).json({
        success: true,
        data: bogo,
        message: 'BOGO 프로모션이 생성되었습니다.'
      });
    } catch (error: any) {
      console.error('Create BOGO promotion error:', error);
      res.status(500).json({ 
        error: error.message || 'BOGO 프로모션 생성 중 오류가 발생했습니다.' 
      });
    }
  }

  // 프로모션 삭제 (관리자)
  async deletePromotion(req: AuthenticatedRequest, res: Response) {
    try {
      if (req.user?.role !== 'ADMIN') {
        return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
      }

      const promotionId = req.params.promotionId;
      await promotionService.deletePromotion(promotionId);

      res.json({
        success: true,
        message: '프로모션이 삭제되었습니다.'
      });
    } catch (error: any) {
      console.error('Delete promotion error:', error);
      res.status(500).json({ 
        error: error.message || '프로모션 삭제 중 오류가 발생했습니다.' 
      });
    }
  }

  // 활성 프로모션 목록 (공개)
  async getActivePromotions(req: Request, res: Response) {
    try {
      const query = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
        type: req.query.type as any,
        targetCategory: req.query.categoryId as string,
        targetProduct: req.query.productId as string,
        isActive: true
      };

      const result = await promotionService.getPromotions(query);

      res.json({
        success: true,
        data: result
      });
    } catch (error: any) {
      console.error('Get active promotions error:', error);
      res.status(500).json({ 
        error: error.message || '프로모션 조회 중 오류가 발생했습니다.' 
      });
    }
  }

  // 프로모션 적용 시뮬레이션
  async simulatePromotion(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id || 'anonymous';
      const orderData = req.body;

      const result = await promotionService.evaluatePromotions(userId, orderData);

      res.json({
        success: true,
        data: result,
        message: '프로모션 시뮬레이션 결과입니다.'
      });
    } catch (error: any) {
      console.error('Simulate promotion error:', error);
      res.status(500).json({ 
        error: error.message || '프로모션 시뮬레이션 중 오류가 발생했습니다.' 
      });
    }
  }
}

export const promotionController = new PromotionController();