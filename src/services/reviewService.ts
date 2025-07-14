import { PrismaClient, ReviewType, Review, ReviewVote } from '@prisma/client';
import { CreateReviewDto, UpdateReviewDto, ReviewQueryDto, ReviewStatistics, BestReviewCriteria } from '../types/review';
import { pointService } from './points/pointService';
import { auditLogService } from './auditLogService';
import { cacheService } from './cacheService';
import { notificationService } from './notificationService';

class ReviewService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  // 리뷰 생성
  async createReview(userId: string, createReviewDto: CreateReviewDto): Promise<Review> {
    const { productId, orderId, orderItemId, rating, title, comment, pros, cons, 
            qualityRating, valueRating, deliveryRating, images, videos } = createReviewDto;

    // 구매 확인
    let isVerified = false;
    if (orderId) {
      const order = await this.prisma.order.findFirst({
        where: {
          id: orderId,
          userId,
          status: 'DELIVERED'
        },
        include: {
          orderItems: orderItemId ? {
            where: { id: orderItemId, productId }
          } : undefined
        }
      });
      isVerified = !!order;
    }

    // 리뷰 타입 결정
    let reviewType = ReviewType.GENERAL;
    if (videos && videos.length > 0) reviewType = ReviewType.VIDEO;
    else if (images && images.length > 0) reviewType = ReviewType.PHOTO;

    // 리뷰 생성
    const review = await this.prisma.review.create({
      data: {
        productId,
        userId,
        orderId,
        orderItemId,
        rating,
        title,
        comment,
        pros,
        cons,
        qualityRating,
        valueRating,
        deliveryRating,
        reviewType,
        images: images ? JSON.stringify(images) : null,
        videos: videos ? JSON.stringify(videos) : null,
        isVerified,
        isApproved: isVerified // 구매 확인된 리뷰는 자동 승인
      },
      include: {
        user: {
          select: { id: true, nickname: true, profileImage: true }
        },
        product: {
          select: { id: true, name: true, images: true }
        }
      }
    });

    // 포인트 지급
    if (isVerified) {
      let points = 100; // 기본 리뷰 포인트
      if (reviewType === ReviewType.PHOTO) points += 200; // 포토리뷰 보너스
      if (reviewType === ReviewType.VIDEO) points += 500; // 비디오리뷰 보너스

      await pointService.addPoints(
        userId,
        points,
        'REVIEW',
        `상품 리뷰 작성 (${review.product.name})`
      );

      await this.prisma.review.update({
        where: { id: review.id },
        data: {
          pointsEarned: points,
          photoBonus: reviewType === ReviewType.PHOTO ? 200 : 
                     reviewType === ReviewType.VIDEO ? 500 : null
        }
      });
    }

    // 상품 평점 업데이트
    await this.updateProductRating(productId);

    // 감사 로그
    await auditLogService.log('review_created', userId, {
      reviewId: review.id,
      productId,
      rating,
      reviewType
    });

    // 캐시 무효화
    await cacheService.delete(`product:${productId}:reviews`);
    await cacheService.delete(`product:${productId}:rating`);

    return review;
  }

  // 리뷰 목록 조회
  async getReviews(productId: string, query: ReviewQueryDto) {
    const { 
      page = 1, 
      limit = 10, 
      sortBy = 'latest', 
      rating, 
      reviewType, 
      verified = null,
      bestOnly = false 
    } = query;

    const offset = (page - 1) * limit;
    const cacheKey = `product:${productId}:reviews:${JSON.stringify(query)}`;
    
    // 캐시 확인
    const cached = await cacheService.get(cacheKey);
    if (cached) return cached;

    // 필터 조건
    const where: any = {
      productId,
      isApproved: true
    };

    if (rating) where.rating = rating;
    if (reviewType) where.reviewType = reviewType;
    if (verified !== null) where.isVerified = verified;
    if (bestOnly) where.isBest = true;

    // 정렬 조건
    let orderBy: any = {};
    switch (sortBy) {
      case 'latest':
        orderBy = { createdAt: 'desc' };
        break;
      case 'oldest':
        orderBy = { createdAt: 'asc' };
        break;
      case 'rating_high':
        orderBy = { rating: 'desc' };
        break;
      case 'rating_low':
        orderBy = { rating: 'asc' };
        break;
      case 'helpful':
        orderBy = { helpfulCount: 'desc' };
        break;
    }

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        orderBy,
        skip: offset,
        take: limit,
        include: {
          user: {
            select: { id: true, nickname: true, profileImage: true }
          },
          replies: {
            include: {
              user: {
                select: { id: true, nickname: true, role: true }
              }
            }
          },
          _count: {
            select: { votes: true }
          }
        }
      }),
      this.prisma.review.count({ where })
    ]);

    // 이미지/비디오 파싱
    const parsedReviews = reviews.map(review => ({
      ...review,
      images: review.images ? JSON.parse(review.images as string) : [],
      videos: review.videos ? JSON.parse(review.videos as string) : []
    }));

    const result = {
      reviews: parsedReviews,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };

    // 캐시 저장 (5분)
    await cacheService.set(cacheKey, result, 300);
    
    return result;
  }

  // 리뷰 통계
  async getReviewStatistics(productId: string): Promise<ReviewStatistics> {
    const cacheKey = `product:${productId}:stats`;
    const cached = await cacheService.get(cacheKey);
    if (cached) return cached;

    const stats = await this.prisma.review.aggregate({
      where: { productId, isApproved: true },
      _avg: { rating: true },
      _count: { id: true }
    });

    const ratingDistribution = await this.prisma.review.groupBy({
      by: ['rating'],
      where: { productId, isApproved: true },
      _count: { rating: true }
    });

    const typeDistribution = await this.prisma.review.groupBy({
      by: ['reviewType'],
      where: { productId, isApproved: true },
      _count: { reviewType: true }
    });

    const result: ReviewStatistics = {
      averageRating: stats._avg.rating || 0,
      totalReviews: stats._count,
      ratingDistribution: ratingDistribution.reduce((acc, item) => {
        acc[item.rating] = item._count.rating;
        return acc;
      }, {} as Record<number, number>),
      typeDistribution: typeDistribution.reduce((acc, item) => {
        acc[item.reviewType] = item._count.reviewType;
        return acc;
      }, {} as Record<string, number>)
    };

    await cacheService.set(cacheKey, result, 300);
    return result;
  }

  // 베스트 리뷰 선정
  async selectBestReviews(productId: string, criteria: BestReviewCriteria = {}) {
    const { minRating = 4, minHelpfulCount = 5, maxCount = 3 } = criteria;

    // 기존 베스트 리뷰 해제
    await this.prisma.review.updateMany({
      where: { productId, isBest: true },
      data: { isBest: false }
    });

    // 새로운 베스트 리뷰 선정
    const bestReviews = await this.prisma.review.findMany({
      where: {
        productId,
        isApproved: true,
        rating: { gte: minRating },
        helpfulCount: { gte: minHelpfulCount }
      },
      orderBy: [
        { helpfulCount: 'desc' },
        { rating: 'desc' },
        { createdAt: 'desc' }
      ],
      take: maxCount
    });

    if (bestReviews.length > 0) {
      await this.prisma.review.updateMany({
        where: { id: { in: bestReviews.map(r => r.id) } },
        data: { isBest: true }
      });
    }

    // 캐시 무효화
    await cacheService.delete(`product:${productId}:reviews`);
    
    return bestReviews;
  }

  // 리뷰 도움됨/안됨 투표
  async voteReview(userId: string, reviewId: string, isHelpful: boolean) {
    // 기존 투표 확인
    const existingVote = await this.prisma.reviewVote.findUnique({
      where: { reviewId_userId: { reviewId, userId } }
    });

    if (existingVote) {
      if (existingVote.isHelpful === isHelpful) {
        // 같은 투표면 제거
        await this.prisma.reviewVote.delete({
          where: { id: existingVote.id }
        });
      } else {
        // 다른 투표면 업데이트
        await this.prisma.reviewVote.update({
          where: { id: existingVote.id },
          data: { isHelpful }
        });
      }
    } else {
      // 새 투표 생성
      await this.prisma.reviewVote.create({
        data: { reviewId, userId, isHelpful }
      });
    }

    // 리뷰의 도움됨 카운트 업데이트
    const votes = await this.prisma.reviewVote.groupBy({
      by: ['isHelpful'],
      where: { reviewId },
      _count: { isHelpful: true }
    });

    const helpfulCount = votes.find(v => v.isHelpful)?._count.isHelpful || 0;
    const notHelpfulCount = votes.find(v => !v.isHelpful)?._count.isHelpful || 0;

    await this.prisma.review.update({
      where: { id: reviewId },
      data: { helpfulCount, notHelpfulCount }
    });

    return { helpfulCount, notHelpfulCount };
  }

  // 상품 평점 업데이트
  private async updateProductRating(productId: string) {
    const stats = await this.prisma.review.aggregate({
      where: { productId, isApproved: true },
      _avg: { rating: true },
      _count: { id: true }
    });

    await this.prisma.product.update({
      where: { id: productId },
      data: {
        averageRating: stats._avg.rating || 0,
        reviewCount: stats._count
      }
    });
  }

  // 리뷰 삭제
  async deleteReview(reviewId: string, userId: string, isAdmin: boolean = false) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      include: { user: true }
    });

    if (!review) {
      throw new Error('리뷰를 찾을 수 없습니다.');
    }

    if (!isAdmin && review.userId !== userId) {
      throw new Error('삭제 권한이 없습니다.');
    }

    await this.prisma.review.delete({
      where: { id: reviewId }
    });

    // 상품 평점 재계산
    await this.updateProductRating(review.productId);

    // 캐시 무효화
    await cacheService.delete(`product:${review.productId}:reviews`);
    await cacheService.delete(`product:${review.productId}:rating`);
  }
}

export const reviewService = new ReviewService();