import { Request, Response } from 'express';
import { InquiryService } from '../../services/inquiry/inquiryService';
import { logger } from '../../utils/logger';
import { z } from 'zod';
import { 
  InquiryType, 
  InquiryCategory, 
  InquiryStatus,
  InquiryPriority 
} from '../../types/inquiry';

const inquiryService = new InquiryService();

// Validation schemas
const createInquirySchema = z.object({
  guestName: z.string().optional(),
  guestEmail: z.string().email().optional(),
  guestPhone: z.string().optional(),
  guestPassword: z.string().min(4).optional(),
  type: z.nativeEnum(InquiryType),
  category: z.nativeEnum(InquiryCategory),
  orderId: z.string().optional(),
  productId: z.string().optional(),
  title: z.string().min(1).max(200),
  content: z.string().min(10).max(5000),
  isPrivate: z.boolean().optional(),
  attachments: z.array(z.object({
    filename: z.string(),
    originalName: z.string(),
    mimeType: z.string(),
    size: z.number(),
    url: z.string()
  })).optional()
});

const updateInquirySchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(10).max(5000).optional(),
  status: z.nativeEnum(InquiryStatus).optional(),
  priority: z.nativeEnum(InquiryPriority).optional(),
  assignedToId: z.string().optional()
});

const createReplySchema = z.object({
  content: z.string().min(1).max(5000),
  isInternal: z.boolean().optional(),
  attachments: z.array(z.object({
    filename: z.string(),
    originalName: z.string(),
    mimeType: z.string(),
    size: z.number(),
    url: z.string()
  })).optional()
});

export const inquiryController = {
  /**
   * 문의 생성
   */
  async createInquiry(req: Request, res: Response) {
    try {
      const validatedData = createInquirySchema.parse(req.body);
      const userId = req.user?.id;

      // 비회원 문의 시 필수 정보 확인
      if (!userId && (!validatedData.guestEmail || !validatedData.guestPassword)) {
        return res.status(400).json({
          success: false,
          error: '비회원 문의 시 이메일과 비밀번호는 필수입니다.'
        });
      }

      const inquiry = await inquiryService.createInquiry(validatedData, userId);

      res.status(201).json({
        success: true,
        data: inquiry
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: '입력 정보가 올바르지 않습니다.',
          details: error.errors
        });
      }

      logger.error('Failed to create inquiry', error);
      res.status(500).json({
        success: false,
        error: '문의 등록에 실패했습니다.'
      });
    }
  },

  /**
   * 문의 목록 조회
   */
  async getInquiries(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const isAdmin = req.user?.role === 'ADMIN' || req.user?.role === 'SUPER_ADMIN';

      // 일반 사용자는 본인 문의만 조회 가능
      const searchParams = {
        ...req.query,
        userId: isAdmin ? req.query.userId : userId,
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20
      };

      const result = await inquiryService.getInquiries(searchParams);

      res.json({
        success: true,
        data: result.inquiries,
        pagination: result.pagination
      });
    } catch (error) {
      logger.error('Failed to get inquiries', error);
      res.status(500).json({
        success: false,
        error: '문의 목록 조회에 실패했습니다.'
      });
    }
  },

  /**
   * 문의 상세 조회
   */
  async getInquiry(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const { password } = req.query; // 비회원 문의 비밀번호

      const inquiry = await inquiryService.getInquiry(
        id, 
        userId, 
        password as string
      );

      res.json({
        success: true,
        data: inquiry
      });
    } catch (error: any) {
      logger.error('Failed to get inquiry', error);
      
      if (error.message.includes('권한')) {
        return res.status(403).json({
          success: false,
          error: error.message
        });
      }

      if (error.message.includes('찾을 수 없습니다')) {
        return res.status(404).json({
          success: false,
          error: error.message
        });
      }

      res.status(500).json({
        success: false,
        error: '문의 조회에 실패했습니다.'
      });
    }
  },

  /**
   * 문의 수정
   */
  async updateInquiry(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const validatedData = updateInquirySchema.parse(req.body);

      const inquiry = await inquiryService.updateInquiry(id, validatedData, userId);

      res.json({
        success: true,
        data: inquiry
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: '입력 정보가 올바르지 않습니다.',
          details: error.errors
        });
      }

      logger.error('Failed to update inquiry', error);

      if (error.message.includes('권한')) {
        return res.status(403).json({
          success: false,
          error: error.message
        });
      }

      res.status(500).json({
        success: false,
        error: '문의 수정에 실패했습니다.'
      });
    }
  },

  /**
   * 문의 답변 작성
   */
  async createReply(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const validatedData = createReplySchema.parse(req.body);

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: '로그인이 필요합니다.'
        });
      }

      const reply = await inquiryService.createReply(id, validatedData, userId);

      res.status(201).json({
        success: true,
        data: reply
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: '입력 정보가 올바르지 않습니다.',
          details: error.errors
        });
      }

      logger.error('Failed to create reply', error);

      if (error.message.includes('권한')) {
        return res.status(403).json({
          success: false,
          error: error.message
        });
      }

      res.status(500).json({
        success: false,
        error: '답변 등록에 실패했습니다.'
      });
    }
  },

  /**
   * 문의 통계
   */
  async getInquiryStats(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const isAdmin = req.user?.role === 'ADMIN' || req.user?.role === 'SUPER_ADMIN';

      // 관리자는 전체 통계, 일반 사용자는 본인 통계만
      const stats = await inquiryService.getInquiryStats(
        isAdmin ? undefined : userId
      );

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('Failed to get inquiry stats', error);
      res.status(500).json({
        success: false,
        error: '통계 조회에 실패했습니다.'
      });
    }
  },

  /**
   * 자동 응답 템플릿 조회
   */
  async getTemplates(req: Request, res: Response) {
    try {
      const { category } = req.query;
      const templates = await inquiryService.getTemplates(category as string);

      res.json({
        success: true,
        data: templates
      });
    } catch (error) {
      logger.error('Failed to get templates', error);
      res.status(500).json({
        success: false,
        error: '템플릿 조회에 실패했습니다.'
      });
    }
  },

  /**
   * 만족도 평가
   */
  async rateSatisfaction(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { rating, note } = req.body;

      if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({
          success: false,
          error: '만족도는 1-5 사이의 값이어야 합니다.'
        });
      }

      const inquiry = await inquiryService.rateSatisfaction(id, rating, note);

      res.json({
        success: true,
        data: inquiry
      });
    } catch (error) {
      logger.error('Failed to rate satisfaction', error);
      res.status(500).json({
        success: false,
        error: '만족도 평가에 실패했습니다.'
      });
    }
  }
};