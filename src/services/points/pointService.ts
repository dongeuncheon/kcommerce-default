import { PrismaClient } from '@prisma/client';
import { logger } from '../../utils/logger';
import {
  PointBalance,
  PointTransaction,
  PointPolicy,
  EarnPointsRequest,
  UsePointsRequest,
  PointHistoryQuery
} from '../../types/point';
import { PointCalculator } from './pointCalculator';
import { PointExpirationService } from './pointExpiration';

export class PointService {
  private prisma: PrismaClient;
  private calculator: PointCalculator;
  private expirationService: PointExpirationService;
  
  // 기본 포인트 정책
  private defaultPolicy: PointPolicy = {
    orderEarnRate: 1,              // 1% 적립
    reviewEarnPoints: 100,         // 리뷰 작성시 100P
    signupBonusPoints: 1000,       // 회원가입 1000P
    membershipRates: {
      BRONZE: 1,
      SILVER: 1.5,
      GOLD: 2,
      VIP: 3
    },
    minimumUseAmount: 1000,        // 최소 1000P부터 사용
    maximumUseRate: 50,            // 주문 금액의 50%까지 사용
    expirationDays: 365,           // 1년 후 만료
    expirationNotifyDays: 30       // 30일 전 알림
  };

  constructor(policy?: Partial<PointPolicy>) {
    this.prisma = new PrismaClient();
    this.defaultPolicy = { ...this.defaultPolicy, ...policy };
    this.calculator = new PointCalculator(this.defaultPolicy);
    this.expirationService = new PointExpirationService(this.prisma, this.defaultPolicy);
  }

  /**
   * 포인트 잔액 조회
   */
  async getBalance(userId: string): Promise<PointBalance> {
    try {
      let point = await this.prisma.point.findUnique({
        where: { userId }
      });

      if (!point) {
        // 포인트 계정이 없으면 생성
        point = await this.prisma.point.create({
          data: { userId }
        });
      }

      return {
        totalPoints: point.totalPoints,
        availablePoints: point.availablePoints,
        pendingPoints: point.pendingPoints,
        usedPoints: point.usedPoints,
        expiredPoints: point.expiredPoints
      };
    } catch (error) {
      logger.error('Failed to get point balance', error);
      throw new Error('포인트 잔액 조회에 실패했습니다.');
    }
  }

  /**
   * 포인트 적립
   */
  async earnPoints(request: EarnPointsRequest): Promise<PointTransaction> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // 포인트 계정 확인
        let point = await tx.point.findUnique({
          where: { userId: request.userId }
        });

        if (!point) {
          point = await tx.point.create({
            data: { userId: request.userId }
          });
        }

        // 만료일 계산
        const expiresAt = request.expiresAt || 
          new Date(Date.now() + this.defaultPolicy.expirationDays * 24 * 60 * 60 * 1000);

        // 새로운 잔액 계산
        const newBalance = point.availablePoints + request.amount;

        // 포인트 내역 생성
        const history = await tx.pointHistory.create({
          data: {
            userId: request.userId,
            pointId: point.id,
            type: 'EARNED',
            amount: request.amount,
            balance: newBalance,
            reason: request.reason,
            reasonCode: request.reasonCode,
            relatedId: request.relatedId,
            relatedType: request.relatedType,
            expiresAt
          }
        });

        // 포인트 잔액 업데이트
        await tx.point.update({
          where: { id: point.id },
          data: {
            totalPoints: { increment: request.amount },
            availablePoints: { increment: request.amount }
          }
        });

        logger.info('Points earned', {
          userId: request.userId,
          amount: request.amount,
          reason: request.reason,
          newBalance
        });

        return {
          id: history.id,
          type: 'EARNED',
          amount: request.amount,
          balance: newBalance,
          reason: request.reason,
          reasonCode: request.reasonCode,
          relatedId: request.relatedId,
          relatedType: request.relatedType,
          expiresAt,
          createdAt: history.createdAt
        };
      });
    } catch (error) {
      logger.error('Failed to earn points', error);
      throw new Error('포인트 적립에 실패했습니다.');
    }
  }

  /**
   * 포인트 사용
   */
  async usePoints(request: UsePointsRequest): Promise<PointTransaction> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const point = await tx.point.findUnique({
          where: { userId: request.userId }
        });

        if (!point) {
          throw new Error('포인트 계정이 없습니다.');
        }

        // 사용 가능 포인트 확인
        if (point.availablePoints < request.amount) {
          throw new Error('포인트가 부족합니다.');
        }

        // 최소 사용 포인트 확인
        if (request.amount < this.defaultPolicy.minimumUseAmount) {
          throw new Error(`최소 ${this.defaultPolicy.minimumUseAmount}포인트부터 사용 가능합니다.`);
        }

        // 새로운 잔액 계산
        const newBalance = point.availablePoints - request.amount;

        // 포인트 내역 생성
        const history = await tx.pointHistory.create({
          data: {
            userId: request.userId,
            pointId: point.id,
            type: 'USED',
            amount: -request.amount,
            balance: newBalance,
            reason: '주문 결제',
            reasonCode: 'ORDER_PAYMENT',
            relatedId: request.orderId,
            relatedType: 'ORDER'
          }
        });

        // 포인트 잔액 업데이트
        await tx.point.update({
          where: { id: point.id },
          data: {
            availablePoints: { decrement: request.amount },
            usedPoints: { increment: request.amount }
          }
        });

        logger.info('Points used', {
          userId: request.userId,
          amount: request.amount,
          orderId: request.orderId,
          newBalance
        });

        return {
          id: history.id,
          type: 'USED',
          amount: -request.amount,
          balance: newBalance,
          reason: '주문 결제',
          reasonCode: 'ORDER_PAYMENT',
          relatedId: request.orderId,
          relatedType: 'ORDER',
          createdAt: history.createdAt
        };
      });
    } catch (error) {
      logger.error('Failed to use points', error);
      throw error;
    }
  }

  /**
   * 포인트 취소 (주문 취소시)
   */
  async cancelPoints(orderId: string): Promise<PointTransaction | null> {
    try {
      // 해당 주문의 포인트 사용 내역 찾기
      const usedHistory = await this.prisma.pointHistory.findFirst({
        where: {
          relatedId: orderId,
          relatedType: 'ORDER',
          type: 'USED'
        }
      });

      if (!usedHistory) {
        return null;
      }

      const refundAmount = Math.abs(usedHistory.amount);

      return await this.prisma.$transaction(async (tx) => {
        const point = await tx.point.findUnique({
          where: { userId: usedHistory.userId }
        });

        if (!point) {
          throw new Error('포인트 계정이 없습니다.');
        }

        const newBalance = point.availablePoints + refundAmount;

        // 취소 내역 생성
        const history = await tx.pointHistory.create({
          data: {
            userId: usedHistory.userId,
            pointId: point.id,
            type: 'CANCELLED',
            amount: refundAmount,
            balance: newBalance,
            reason: '주문 취소로 인한 포인트 복구',
            reasonCode: 'ORDER_CANCEL_REFUND',
            relatedId: orderId,
            relatedType: 'ORDER'
          }
        });

        // 포인트 잔액 업데이트
        await tx.point.update({
          where: { id: point.id },
          data: {
            availablePoints: { increment: refundAmount },
            usedPoints: { decrement: refundAmount }
          }
        });

        logger.info('Points cancelled', {
          userId: usedHistory.userId,
          amount: refundAmount,
          orderId,
          newBalance
        });

        return {
          id: history.id,
          type: 'CANCELLED',
          amount: refundAmount,
          balance: newBalance,
          reason: '주문 취소로 인한 포인트 복구',
          reasonCode: 'ORDER_CANCEL_REFUND',
          relatedId: orderId,
          relatedType: 'ORDER',
          createdAt: history.createdAt
        };
      });
    } catch (error) {
      logger.error('Failed to cancel points', error);
      throw new Error('포인트 취소에 실패했습니다.');
    }
  }

  /**
   * 포인트 내역 조회
   */
  async getHistory(query: PointHistoryQuery): Promise<{
    transactions: PointTransaction[];
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      const page = query.page || 1;
      const limit = query.limit || 20;
      const skip = (page - 1) * limit;

      const where: any = { userId: query.userId };

      if (query.type) {
        where.type = query.type;
      }

      if (query.startDate || query.endDate) {
        where.createdAt = {};
        if (query.startDate) {
          where.createdAt.gte = query.startDate;
        }
        if (query.endDate) {
          where.createdAt.lte = query.endDate;
        }
      }

      const [histories, total] = await Promise.all([
        this.prisma.pointHistory.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit
        }),
        this.prisma.pointHistory.count({ where })
      ]);

      const transactions: PointTransaction[] = histories.map(h => ({
        id: h.id,
        type: h.type as any,
        amount: h.amount,
        balance: h.balance,
        reason: h.reason,
        reasonCode: h.reasonCode,
        relatedId: h.relatedId || undefined,
        relatedType: h.relatedType as any,
        expiresAt: h.expiresAt || undefined,
        createdAt: h.createdAt
      }));

      return {
        transactions,
        total,
        page,
        limit
      };
    } catch (error) {
      logger.error('Failed to get point history', error);
      throw new Error('포인트 내역 조회에 실패했습니다.');
    }
  }

  /**
   * 회원가입 보너스 포인트 지급
   */
  async grantSignupBonus(userId: string): Promise<PointTransaction> {
    return this.earnPoints({
      userId,
      amount: this.defaultPolicy.signupBonusPoints,
      reason: '회원가입 축하 포인트',
      reasonCode: 'SIGNUP',
      relatedType: 'EVENT'
    });
  }

  /**
   * 리뷰 작성 포인트 지급
   */
  async grantReviewPoints(userId: string, reviewId: string): Promise<PointTransaction> {
    return this.earnPoints({
      userId,
      amount: this.defaultPolicy.reviewEarnPoints,
      reason: '상품 리뷰 작성',
      reasonCode: 'REVIEW_WRITE',
      relatedId: reviewId,
      relatedType: 'REVIEW'
    });
  }

  /**
   * 주문 완료시 포인트 적립
   */
  async earnOrderPoints(userId: string, orderId: string, orderAmount: number, membershipLevel?: string): Promise<PointTransaction> {
    const earnRate = this.calculator.getEarnRate(membershipLevel);
    const earnAmount = this.calculator.calculateEarnPoints(orderAmount, earnRate);

    return this.earnPoints({
      userId,
      amount: earnAmount,
      reason: `구매 적립 (${earnRate}%)`,
      reasonCode: 'ORDER_COMPLETE',
      relatedId: orderId,
      relatedType: 'ORDER'
    });
  }

  /**
   * 관리자 포인트 지급/차감
   */
  async adjustPoints(userId: string, amount: number, reason: string, adminId: string): Promise<PointTransaction> {
    if (amount > 0) {
      return this.earnPoints({
        userId,
        amount,
        reason,
        reasonCode: 'ADMIN_GRANT',
        relatedId: adminId,
        relatedType: 'ADMIN'
      });
    } else {
      // 차감 로직
      return await this.prisma.$transaction(async (tx) => {
        const point = await tx.point.findUnique({
          where: { userId }
        });

        if (!point || point.availablePoints < Math.abs(amount)) {
          throw new Error('포인트가 부족합니다.');
        }

        const newBalance = point.availablePoints + amount;

        const history = await tx.pointHistory.create({
          data: {
            userId,
            pointId: point.id,
            type: 'ADJUSTED',
            amount,
            balance: newBalance,
            reason,
            reasonCode: 'ADMIN_DEDUCT',
            relatedId: adminId,
            relatedType: 'ADMIN'
          }
        });

        await tx.point.update({
          where: { id: point.id },
          data: {
            availablePoints: { increment: amount },
            totalPoints: amount < 0 ? { decrement: Math.abs(amount) } : undefined
          }
        });

        return {
          id: history.id,
          type: 'ADJUSTED',
          amount,
          balance: newBalance,
          reason,
          reasonCode: 'ADMIN_DEDUCT',
          relatedId: adminId,
          relatedType: 'ADMIN',
          createdAt: history.createdAt
        };
      });
    }
  }
}