import { Request, Response } from 'express';
import { TrackingService } from '../../services/shipping/trackingService';
import { logger } from '../../utils/logger';
import { z } from 'zod';

const trackingService = new TrackingService();

// Validation schemas
const trackingQuerySchema = z.object({
  carrierId: z.string().min(1),
  trackingNumber: z.string().min(1).regex(/^[0-9\-]+$/)
});

const shipmentStatusUpdateSchema = z.object({
  shipmentId: z.string().min(1)
});

export const trackingController = {
  /**
   * 택배사 목록 조회
   */
  async getCarriers(req: Request, res: Response) {
    try {
      const { supported } = req.query;
      
      const carriers = supported === 'true' 
        ? trackingService.getSupportedCarriers()
        : trackingService.getAllCarriers();
      
      res.json({
        success: true,
        data: carriers
      });
    } catch (error) {
      logger.error('Failed to get carriers', error);
      res.status(500).json({
        success: false,
        error: '택배사 목록 조회에 실패했습니다.'
      });
    }
  },

  /**
   * 배송 조회
   */
  async trackShipment(req: Request, res: Response): Promise<Response> {
    try {
      const validatedData = trackingQuerySchema.parse(req.query);
      
      // 운송장 번호 유효성 검사
      const isValid = trackingService.validateTrackingNumber(
        validatedData.carrierId,
        validatedData.trackingNumber
      );
      
      if (!isValid) {
        return res.status(400).json({
          success: false,
          error: '유효하지 않은 운송장 번호입니다.'
        });
      }
      
      const result = await trackingService.trackShipment({
        carrierId: validatedData.carrierId,
        trackingNumber: validatedData.trackingNumber
      });
      
      if (!result.success) {
        return res.status(404).json(result);
      }
      
      return res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: '잘못된 요청입니다.',
          details: error.errors
        });
      }
      
      logger.error('Failed to track shipment', error);
      return res.status(500).json({
        success: false,
        error: '배송 조회에 실패했습니다.'
      });
    }
  },

  /**
   * 운송장 번호 유효성 검사
   */
  async validateTrackingNumber(req: Request, res: Response): Promise<Response> {
    try {
      const { carrierId, trackingNumber } = req.query;
      
      if (!carrierId || !trackingNumber) {
        return res.status(400).json({
          success: false,
          error: '택배사 ID와 운송장 번호를 입력해주세요.'
        });
      }
      
      const isValid = trackingService.validateTrackingNumber(
        carrierId as string,
        trackingNumber as string
      );
      
      return res.json({
        success: true,
        data: {
          valid: isValid
        }
      });
    } catch (error) {
      logger.error('Failed to validate tracking number', error);
      return res.status(500).json({
        success: false,
        error: '유효성 검사에 실패했습니다.'
      });
    }
  },

  /**
   * 배송 상태 업데이트 (내부용)
   */
  async updateShipmentStatus(req: Request, res: Response): Promise<Response> {
    try {
      const validatedData = shipmentStatusUpdateSchema.parse(req.body);
      
      await trackingService.updateShipmentStatus(validatedData.shipmentId);
      
      return res.json({
        success: true,
        message: '배송 상태가 업데이트되었습니다.'
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: '잘못된 요청입니다.',
          details: error.errors
        });
      }
      
      logger.error('Failed to update shipment status', error);
      return res.status(500).json({
        success: false,
        error: '배송 상태 업데이트에 실패했습니다.'
      });
    }
  },

  /**
   * 예상 배송일 계산
   */
  async calculateDeliveryTime(req: Request, res: Response): Promise<Response> {
    try {
      const { carrierId, from, to } = req.query;
      
      if (!carrierId || !from || !to) {
        return res.status(400).json({
          success: false,
          error: '필수 정보를 입력해주세요.'
        });
      }
      
      const estimatedDate = trackingService.calculateEstimatedDelivery(
        carrierId as string,
        from as string,
        to as string
      );
      
      return res.json({
        success: true,
        data: {
          estimatedDelivery: estimatedDate
        }
      });
    } catch (error) {
      logger.error('Failed to calculate delivery time', error);
      return res.status(500).json({
        success: false,
        error: '배송 예상일 계산에 실패했습니다.'
      });
    }
  }
};