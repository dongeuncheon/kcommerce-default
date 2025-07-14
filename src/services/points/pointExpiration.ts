import { PrismaClient } from '@prisma/client';
import { logger } from '../../utils/logger';
import { PointPolicy } from '../../types/point';

export class PointExpirationService {
  constructor(
    private prisma: PrismaClient,
    private policy: PointPolicy
  ) {}

  /**
   * 만료된 포인트 처리
   */
  async processExpiredPoints(): Promise<number> {
    try {
      const now = new Date();
      let totalExpired = 0;

      // 만료 대상 포인트 조회
      const expiredHistories = await this.prisma.pointHistory.findMany({
        where: {
          type: 'EARNED',
          expiresAt: { lte: now },
          expiredAt: null
        },
        include: {
          point: true
        }
      });

      // 사용자별로 그룹화
      const userExpiredPoints = new Map<string, number>();
      
      for (const history of expiredHistories) {
        const userId = history.userId;
        const currentAmount = userExpiredPoints.get(userId) || 0;
        userExpiredPoints.set(userId, currentAmount + history.amount);
      }

      // 트랜잭션으로 만료 처리
      for (const [userId, expiredAmount] of userExpiredPoints) {
        await this.prisma.$transaction(async (tx) => {
          const point = await tx.point.findUnique({
            where: { userId }
          });

          if (!point || point.availablePoints < expiredAmount) {
            logger.warn('Invalid point balance for expiration', { userId, expiredAmount });
            return;
          }

          // 만료 내역 생성
          await tx.pointHistory.create({
            data: {
              userId,
              pointId: point.id,
              type: 'EXPIRED',
              amount: -expiredAmount,
              balance: point.availablePoints - expiredAmount,
              reason: '유효기간 만료',
              reasonCode: 'AUTO_EXPIRATION'
            }
          });

          // 포인트 잔액 업데이트
          await tx.point.update({
            where: { id: point.id },
            data: {
              availablePoints: { decrement: expiredAmount },
              expiredPoints: { increment: expiredAmount }
            }
          });

          // 만료된 포인트 내역들 업데이트
          await tx.pointHistory.updateMany({
            where: {
              userId,
              type: 'EARNED',
              expiresAt: { lte: now },
              expiredAt: null
            },
            data: {
              expiredAt: now
            }
          });

          totalExpired += expiredAmount;
          
          logger.info('Points expired', {
            userId,
            amount: expiredAmount
          });
        });
      }

      return totalExpired;
    } catch (error) {
      logger.error('Failed to process expired points', error);
      throw error;
    }
  }

  /**
   * 만료 예정 포인트 알림 대상 조회
   */
  async getExpiringPointsUsers(): Promise<Array<{
    userId: string;
    amount: number;
    expiresAt: Date;
  }>> {
    try {
      const notifyDate = new Date();
      notifyDate.setDate(notifyDate.getDate() + this.policy.expirationNotifyDays);

      const expiringHistories = await this.prisma.pointHistory.findMany({
        where: {
          type: 'EARNED',
          expiresAt: {
            gte: new Date(),
            lte: notifyDate
          },
          expiredAt: null
        },
        select: {
          userId: true,
          amount: true,
          expiresAt: true
        }
      });

      // 사용자별로 집계
      const userExpiringMap = new Map<string, { amount: number; expiresAt: Date }>();
      
      for (const history of expiringHistories) {
        if (!history.expiresAt) continue;
        
        const existing = userExpiringMap.get(history.userId);
        if (!existing || history.expiresAt < existing.expiresAt) {
          userExpiringMap.set(history.userId, {
            amount: (existing?.amount || 0) + history.amount,
            expiresAt: history.expiresAt
          });
        }
      }

      return Array.from(userExpiringMap.entries()).map(([userId, data]) => ({
        userId,
        amount: data.amount,
        expiresAt: data.expiresAt
      }));
    } catch (error) {
      logger.error('Failed to get expiring points users', error);
      return [];
    }
  }

  /**
   * 포인트 만료 스케줄러 (매일 실행)
   */
  async runDailyExpirationJob(): Promise<void> {
    try {
      logger.info('Starting daily point expiration job');
      
      // 만료 처리
      const expiredAmount = await this.processExpiredPoints();
      logger.info(`Expired ${expiredAmount} points`);
      
      // 만료 예정 알림 대상 조회
      const expiringUsers = await this.getExpiringPointsUsers();
      
      // TODO: 알림 발송 로직 추가
      for (const user of expiringUsers) {
        logger.info('User has expiring points', {
          userId: user.userId,
          amount: user.amount,
          expiresAt: user.expiresAt
        });
      }
      
      logger.info('Daily point expiration job completed');
    } catch (error) {
      logger.error('Daily point expiration job failed', error);
    }
  }
}