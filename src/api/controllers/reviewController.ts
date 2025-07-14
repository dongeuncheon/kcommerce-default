import { Request, Response } from 'express';
import { reviewService } from '../../services/reviewService';
import { CreateReviewDto, UpdateReviewDto, ReviewQueryDto } from '../../types/review';
import { AuthenticatedRequest } from '../../types/index';

class ReviewController {
  // 리뷰 생성
  async createReview(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: '인증이 필요합니다.' });
      }

      const createReviewDto: CreateReviewDto = req.body;
      
      // 유효성 검증
      if (!createReviewDto.productId || !createReviewDto.rating) {
        return res.status(400).json({ error: '상품 ID와 평점은 필수입니다.' });
      }

      if (createReviewDto.rating < 1 || createReviewDto.rating > 5) {
        return res.status(400).json({ error: '평점은 1-5 사이여야 합니다.' });
      }

      const review = await reviewService.createReview(userId, createReviewDto);
      
      res.status(201).json({
        success: true,
        data: review,
        message: '리뷰가 성공적으로 작성되었습니다.'
      });
    } catch (error: any) {
      console.error('Create review error:', error);
      res.status(500).json({ 
        error: error.message || '리뷰 작성 중 오류가 발생했습니다.' 
      });
    }
  }

  // 상품의 리뷰 목록 조회
  async getProductReviews(req: Request, res: Response) {
    try {
      const productId = req.params.productId;
      const query: ReviewQueryDto = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 10,
        sortBy: req.query.sortBy as any || 'latest',
        rating: req.query.rating ? parseInt(req.query.rating as string) : undefined,
        reviewType: req.query.reviewType as any,
        verified: req.query.verified === 'true' ? true : 
                 req.query.verified === 'false' ? false : null,
        bestOnly: req.query.bestOnly === 'true'
      };

      const result = await reviewService.getReviews(productId, query);
      
      res.json({
        success: true,
        data: result
      });
    } catch (error: any) {
      console.error('Get reviews error:', error);
      res.status(500).json({ 
        error: error.message || '리뷰 조회 중 오류가 발생했습니다.' 
      });
    }
  }

  // 리뷰 통계 조회
  async getReviewStatistics(req: Request, res: Response) {
    try {
      const productId = req.params.productId;
      const statistics = await reviewService.getReviewStatistics(productId);
      
      res.json({
        success: true,
        data: statistics
      });
    } catch (error: any) {
      console.error('Get review statistics error:', error);
      res.status(500).json({ 
        error: error.message || '리뷰 통계 조회 중 오류가 발생했습니다.' 
      });
    }
  }

  // 베스트 리뷰 선정
  async selectBestReviews(req: AuthenticatedRequest, res: Response) {
    try {
      const productId = req.params.productId;
      const criteria = req.body;
      
      // 관리자 권한 확인
      if (req.user?.role !== 'ADMIN') {
        return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
      }

      const bestReviews = await reviewService.selectBestReviews(productId, criteria);
      
      res.json({
        success: true,
        data: bestReviews,
        message: '베스트 리뷰가 선정되었습니다.'
      });
    } catch (error: any) {
      console.error('Select best reviews error:', error);
      res.status(500).json({ 
        error: error.message || '베스트 리뷰 선정 중 오류가 발생했습니다.' 
      });
    }
  }

  // 리뷰 투표 (도움됨/안됨)
  async voteReview(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: '인증이 필요합니다.' });
      }

      const reviewId = req.params.reviewId;
      const { isHelpful } = req.body;

      if (typeof isHelpful !== 'boolean') {
        return res.status(400).json({ error: 'isHelpful은 boolean 값이어야 합니다.' });
      }

      const result = await reviewService.voteReview(userId, reviewId, isHelpful);
      
      res.json({
        success: true,
        data: result,
        message: '투표가 완료되었습니다.'
      });
    } catch (error: any) {
      console.error('Vote review error:', error);
      res.status(500).json({ 
        error: error.message || '리뷰 투표 중 오류가 발생했습니다.' 
      });
    }
  }

  // 리뷰 수정
  async updateReview(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: '인증이 필요합니다.' });
      }

      const reviewId = req.params.reviewId;
      const updateData: UpdateReviewDto = req.body;

      // 리뷰 소유자 확인
      const review = await reviewService.getReviewById(reviewId);
      if (!review) {
        return res.status(404).json({ error: '리뷰를 찾을 수 없습니다.' });
      }

      if (review.userId !== userId && req.user?.role !== 'ADMIN') {
        return res.status(403).json({ error: '수정 권한이 없습니다.' });
      }

      const updatedReview = await reviewService.updateReview(reviewId, updateData);
      
      res.json({
        success: true,
        data: updatedReview,
        message: '리뷰가 수정되었습니다.'
      });
    } catch (error: any) {
      console.error('Update review error:', error);
      res.status(500).json({ 
        error: error.message || '리뷰 수정 중 오류가 발생했습니다.' 
      });
    }
  }

  // 리뷰 삭제
  async deleteReview(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: '인증이 필요합니다.' });
      }

      const reviewId = req.params.reviewId;
      const isAdmin = req.user?.role === 'ADMIN';

      await reviewService.deleteReview(reviewId, userId, isAdmin);
      
      res.json({
        success: true,
        message: '리뷰가 삭제되었습니다.'
      });
    } catch (error: any) {
      console.error('Delete review error:', error);
      res.status(500).json({ 
        error: error.message || '리뷰 삭제 중 오류가 발생했습니다.' 
      });
    }
  }

  // 리뷰 답글 작성 (판매자/관리자)
  async createReply(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: '인증이 필요합니다.' });
      }

      // 판매자 또는 관리자 권한 확인
      if (!['ADMIN', 'SELLER'].includes(req.user?.role || '')) {
        return res.status(403).json({ error: '답글 작성 권한이 없습니다.' });
      }

      const reviewId = req.params.reviewId;
      const { content } = req.body;

      if (!content || content.trim().length === 0) {
        return res.status(400).json({ error: '답글 내용을 입력해주세요.' });
      }

      const reply = await reviewService.createReply(reviewId, userId, content);
      
      res.status(201).json({
        success: true,
        data: reply,
        message: '답글이 작성되었습니다.'
      });
    } catch (error: any) {
      console.error('Create reply error:', error);
      res.status(500).json({ 
        error: error.message || '답글 작성 중 오류가 발생했습니다.' 
      });
    }
  }

  // 내가 작성한 리뷰 조회
  async getMyReviews(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: '인증이 필요합니다.' });
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      const result = await reviewService.getUserReviews(userId, { page, limit });
      
      res.json({
        success: true,
        data: result
      });
    } catch (error: any) {
      console.error('Get my reviews error:', error);
      res.status(500).json({ 
        error: error.message || '리뷰 조회 중 오류가 발생했습니다.' 
      });
    }
  }

  // 리뷰 신고
  async reportReview(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: '인증이 필요합니다.' });
      }

      const reviewId = req.params.reviewId;
      const { reason } = req.body;

      if (!reason) {
        return res.status(400).json({ error: '신고 사유를 입력해주세요.' });
      }

      await reviewService.reportReview(reviewId, userId, reason);
      
      res.json({
        success: true,
        message: '리뷰 신고가 접수되었습니다.'
      });
    } catch (error: any) {
      console.error('Report review error:', error);
      res.status(500).json({ 
        error: error.message || '리뷰 신고 중 오류가 발생했습니다.' 
      });
    }
  }
}

export const reviewController = new ReviewController();