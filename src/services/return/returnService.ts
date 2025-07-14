import { PrismaClient } from '@prisma/client';
import { logger } from '../../utils/logger';
import {
  CreateReturnDto,
  UpdateReturnDto,
  ProcessRefundDto,
  ReturnSearchParams,
  ReturnStats,
  ReturnStatus,
  ReturnType,
  RefundMethod,
  ReturnReason
} from '../../types/return';
import { PaymentService } from '../paymentService';
import { NotificationService } from '../notificationService';
import { InventoryService } from '../inventoryService';
import { PointService } from '../points/pointService';

export class ReturnService {
  private prisma: PrismaClient;
  private paymentService: PaymentService;
  private notificationService: NotificationService;
  private inventoryService: InventoryService;
  private pointService: PointService;

  constructor() {
    this.prisma = new PrismaClient();
    this.paymentService = new PaymentService();
    this.notificationService = new NotificationService();
    this.inventoryService = new InventoryService();
    this.pointService = new PointService();
  }

  /**
   * 반품/교환 요청 생성
   */
  async createReturn(data: CreateReturnDto, userId?: string) {
    try {
      // 주문 확인
      const order = await this.prisma.order.findUnique({
        where: { id: data.orderId },
        include: {
          items: {
            include: { product: true }
          },
          payments: {
            where: { status: 'COMPLETED' }
          }
        }
      });

      if (!order) {
        throw new Error('주문을 찾을 수 없습니다.');
      }

      // 권한 확인
      if (userId && order.userId !== userId) {
        throw new Error('해당 주문에 대한 권한이 없습니다.');
      }

      // 반품 가능 기간 확인
      const policy = await this.getApplicablePolicy(order, data.orderItemIds);
      const daysSinceDelivery = await this.getDaysSinceDelivery(order.id);
      
      if (data.type === ReturnType.EXCHANGE && daysSinceDelivery > policy.exchangeWindow) {
        throw new Error(`교환 가능 기간(${policy.exchangeWindow}일)이 지났습니다.`);
      }
      
      if (data.type !== ReturnType.EXCHANGE && daysSinceDelivery > policy.returnWindow) {
        throw new Error(`반품 가능 기간(${policy.returnWindow}일)이 지났습니다.`);
      }

      // 환불 금액 계산
      const refundAmount = await this.calculateRefundAmount(order, data.orderItemIds, policy);

      // 자동 승인 여부 확인
      const autoApprove = await this.checkAutoApproval(data, policy, refundAmount);

      // 반품/교환 생성
      const returnRequest = await this.prisma.return.create({
        data: {
          orderId: data.orderId,
          orderItemIds: data.orderItemIds,
          userId: order.userId,
          type: data.type,
          status: autoApprove ? ReturnStatus.APPROVED : ReturnStatus.REQUESTED,
          reason: data.reason,
          reasonDetail: data.reasonDetail,
          attachments: data.attachments,
          refundAmount: data.type !== ReturnType.EXCHANGE ? refundAmount : undefined,
          autoApproved: autoApprove,
          approvedAt: autoApprove ? new Date() : undefined
        },
        include: {
          order: true,
          user: true
        }
      });

      // 로그 생성
      await this.createReturnLog(returnRequest.id, 'CREATED', null, returnRequest.status);

      // 자동 승인된 경우 다음 단계 진행
      if (autoApprove) {
        await this.processApprovedReturn(returnRequest);
      }

      // 알림 전송
      await this.notifyReturnCreated(returnRequest);

      logger.info('Return request created', { returnId: returnRequest.id });
      return returnRequest;
    } catch (error) {
      logger.error('Failed to create return', error);
      throw error;
    }
  }

  /**
   * 반품/교환 목록 조회
   */
  async getReturns(params: ReturnSearchParams) {
    try {
      const {
        userId,
        orderId,
        status,
        type,
        reason,
        startDate,
        endDate,
        page = 1,
        limit = 20,
        sortBy = 'requestedAt',
        sortOrder = 'desc'
      } = params;

      const where: any = {};

      if (userId) where.userId = userId;
      if (orderId) where.orderId = orderId;
      if (status) where.status = status;
      if (type) where.type = type;
      if (reason) where.reason = reason;

      if (startDate || endDate) {
        where.requestedAt = {};
        if (startDate) where.requestedAt.gte = startDate;
        if (endDate) where.requestedAt.lte = endDate;
      }

      const [returns, total] = await Promise.all([
        this.prisma.return.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { [sortBy]: sortOrder },
          include: {
            order: {
              include: {
                items: true
              }
            },
            user: true
          }
        }),
        this.prisma.return.count({ where })
      ]);

      return {
        returns,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Failed to get returns', error);
      throw error;
    }
  }

  /**
   * 반품/교환 상세 조회
   */
  async getReturn(id: string) {
    try {
      const returnRequest = await this.prisma.return.findUnique({
        where: { id },
        include: {
          order: {
            include: {
              items: {
                include: {
                  product: true,
                  variant: true
                }
              },
              payments: true,
              shippingAddress: true
            }
          },
          user: true,
          processedByUser: true,
          logs: {
            orderBy: { createdAt: 'desc' },
            include: { user: true }
          }
        }
      });

      if (!returnRequest) {
        throw new Error('반품/교환 요청을 찾을 수 없습니다.');
      }

      return returnRequest;
    } catch (error) {
      logger.error('Failed to get return', error);
      throw error;
    }
  }

  /**
   * 반품/교환 상태 업데이트
   */
  async updateReturn(id: string, data: UpdateReturnDto, adminId?: string) {
    try {
      const returnRequest = await this.getReturn(id);
      const oldStatus = returnRequest.status;

      const updateData: any = {
        ...data,
        updatedAt: new Date()
      };

      // 상태별 추가 처리
      if (data.status === ReturnStatus.APPROVED) {
        updateData.approvedAt = new Date();
        updateData.processedBy = adminId;
      } else if (data.status === ReturnStatus.REJECTED) {
        updateData.rejectedAt = new Date();
        updateData.processedBy = adminId;
      } else if (data.status === ReturnStatus.COMPLETED) {
        updateData.completedAt = new Date();
      }

      const updated = await this.prisma.return.update({
        where: { id },
        data: updateData,
        include: {
          order: true,
          user: true
        }
      });

      // 로그 생성
      if (data.status && data.status !== oldStatus) {
        await this.createReturnLog(id, 'STATUS_CHANGED', oldStatus, data.status, adminId);
      }

      // 상태별 추가 작업
      if (data.status === ReturnStatus.APPROVED) {
        await this.processApprovedReturn(updated);
      } else if (data.status === ReturnStatus.RECEIVED) {
        await this.processReceivedReturn(updated);
      } else if (data.status === ReturnStatus.COMPLETED) {
        await this.completeReturn(updated);
      }

      // 알림 전송
      await this.notifyReturnUpdated(updated, oldStatus);

      logger.info('Return updated', { returnId: id, status: data.status });
      return updated;
    } catch (error) {
      logger.error('Failed to update return', error);
      throw error;
    }
  }

  /**
   * 환불 처리
   */
  async processRefund(returnId: string, data: ProcessRefundDto, adminId: string) {
    try {
      const returnRequest = await this.getReturn(returnId);

      if (returnRequest.type === ReturnType.EXCHANGE) {
        throw new Error('교환 요청은 환불 처리할 수 없습니다.');
      }

      if (returnRequest.status !== ReturnStatus.PROCESSING) {
        throw new Error('처리 중 상태에서만 환불 가능합니다.');
      }

      let refundTransactionId: string | undefined;

      // 환불 방법별 처리
      switch (data.refundMethod) {
        case RefundMethod.ORIGINAL_PAYMENT:
          // 원 결제수단으로 환불
          const payment = returnRequest.order.payments[0];
          if (payment) {
            const refundResult = await this.paymentService.refund(
              payment.id,
              data.refundAmount,
              `반품 환불 - ${returnId}`
            );
            refundTransactionId = refundResult.transactionId;
          }
          break;

        case RefundMethod.POINTS:
          // 포인트로 환불
          await this.pointService.earnPoints({
            userId: returnRequest.userId!,
            amount: data.refundAmount,
            type: 'REFUND',
            description: `반품 환불 - 주문번호: ${returnRequest.order.orderNumber}`,
            relatedId: returnId,
            relatedType: 'RETURN'
          });
          break;

        case RefundMethod.BANK_TRANSFER:
          // 계좌이체 (수동 처리 필요)
          // TODO: 계좌이체 요청 생성
          break;

        case RefundMethod.STORE_CREDIT:
          // 스토어 크레딧
          // TODO: 스토어 크레딧 시스템 구현
          break;
      }

      // 환불 정보 업데이트
      await this.prisma.return.update({
        where: { id: returnId },
        data: {
          refundAmount: data.refundAmount,
          refundMethod: data.refundMethod,
          refundProcessedAt: new Date(),
          refundTransactionId,
          status: ReturnStatus.COMPLETED,
          completedAt: new Date(),
          processedBy: adminId
        }
      });

      // 로그 생성
      await this.createReturnLog(
        returnId,
        'REFUND_PROCESSED',
        null,
        null,
        adminId,
        {
          amount: data.refundAmount,
          method: data.refundMethod,
          transactionId: refundTransactionId
        }
      );

      // 재고 복구
      await this.restoreInventory(returnRequest);

      logger.info('Refund processed', { returnId, amount: data.refundAmount });
    } catch (error) {
      logger.error('Failed to process refund', error);
      throw error;
    }
  }

  /**
   * 반품/교환 통계
   */
  async getReturnStats(startDate?: Date, endDate?: Date): Promise<ReturnStats> {
    try {
      const where: any = {};
      if (startDate || endDate) {
        where.requestedAt = {};
        if (startDate) where.requestedAt.gte = startDate;
        if (endDate) where.requestedAt.lte = endDate;
      }

      const [
        total,
        statusCounts,
        refundSum,
        reasonCounts,
        avgProcessingTime
      ] = await Promise.all([
        this.prisma.return.count({ where }),
        this.prisma.return.groupBy({
          by: ['status'],
          where,
          _count: true
        }),
        this.prisma.return.aggregate({
          where: {
            ...where,
            refundProcessedAt: { not: null }
          },
          _sum: { refundAmount: true }
        }),
        this.prisma.return.groupBy({
          by: ['reason'],
          where,
          _count: true
        }),
        this.calculateAvgProcessingTime(where)
      ]);

      const stats: ReturnStats = {
        total,
        requested: 0,
        approved: 0,
        rejected: 0,
        processing: 0,
        completed: 0,
        avgProcessingTime,
        totalRefundAmount: Number(refundSum._sum.refundAmount || 0),
        byReason: {}
      };

      // 상태별 카운트
      statusCounts.forEach(item => {
        switch (item.status) {
          case ReturnStatus.REQUESTED:
          case ReturnStatus.PENDING_REVIEW:
            stats.requested += item._count;
            break;
          case ReturnStatus.APPROVED:
            stats.approved += item._count;
            break;
          case ReturnStatus.REJECTED:
            stats.rejected += item._count;
            break;
          case ReturnStatus.PROCESSING:
          case ReturnStatus.PICKUP_SCHEDULED:
          case ReturnStatus.IN_TRANSIT:
          case ReturnStatus.RECEIVED:
          case ReturnStatus.INSPECTING:
            stats.processing += item._count;
            break;
          case ReturnStatus.COMPLETED:
            stats.completed += item._count;
            break;
        }
      });

      // 사유별 카운트
      reasonCounts.forEach(item => {
        stats.byReason[item.reason] = item._count;
      });

      return stats;
    } catch (error) {
      logger.error('Failed to get return stats', error);
      throw error;
    }
  }

  /**
   * Private methods
   */
  private async getApplicablePolicy(order: any, orderItemIds: string[]) {
    // TODO: 상품/카테고리별 정책 조회
    // 기본 정책 반환
    return {
      returnWindow: 7,
      exchangeWindow: 14,
      returnFee: 0,
      exchangeFee: 0,
      restockingFee: 0,
      autoApprove: true,
      autoApproveReasons: [
        ReturnReason.DEFECTIVE,
        ReturnReason.WRONG_ITEM,
        ReturnReason.DELIVERY_DAMAGE,
        ReturnReason.MISSING_PARTS
      ],
      maxAutoApproveAmount: 100000,
      requirePhotos: true,
      requireOriginalPackaging: true,
      allowPartialReturn: true
    };
  }

  private async getDaysSinceDelivery(orderId: string): Promise<number> {
    const shipment = await this.prisma.shipment.findFirst({
      where: {
        orderId,
        status: 'DELIVERED'
      },
      orderBy: { deliveredAt: 'desc' }
    });

    if (!shipment?.deliveredAt) {
      return 0;
    }

    const days = Math.floor(
      (Date.now() - shipment.deliveredAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    return days;
  }

  private async calculateRefundAmount(order: any, orderItemIds: string[], policy: any): Promise<number> {
    const itemsToReturn = order.items.filter((item: any) => 
      orderItemIds.includes(item.id)
    );

    let refundAmount = itemsToReturn.reduce((sum: number, item: any) => 
      sum + Number(item.total), 0
    );

    // 수수료 차감
    refundAmount -= policy.returnFee;
    
    // 재입고 수수료 차감 (퍼센트)
    if (policy.restockingFee > 0) {
      refundAmount -= refundAmount * (policy.restockingFee / 100);
    }

    return Math.max(0, refundAmount);
  }

  private async checkAutoApproval(
    data: CreateReturnDto,
    policy: any,
    refundAmount: number
  ): Promise<boolean> {
    if (!policy.autoApprove) {
      return false;
    }

    // 자동 승인 사유 확인
    if (!policy.autoApproveReasons.includes(data.reason)) {
      return false;
    }

    // 최대 자동 승인 금액 확인
    if (policy.maxAutoApproveAmount && refundAmount > policy.maxAutoApproveAmount) {
      return false;
    }

    return true;
  }

  private async processApprovedReturn(returnRequest: any) {
    // 수거 요청 생성 (필요한 경우)
    if (returnRequest.type !== ReturnType.EXCHANGE) {
      // TODO: 택배사 수거 API 연동
      await this.prisma.return.update({
        where: { id: returnRequest.id },
        data: {
          status: ReturnStatus.PICKUP_SCHEDULED,
          pickupRequested: true,
          pickupDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) // 2일 후
        }
      });
    }
  }

  private async processReceivedReturn(returnRequest: any) {
    // 검수 시작
    await this.prisma.return.update({
      where: { id: returnRequest.id },
      data: {
        status: ReturnStatus.INSPECTING
      }
    });

    // TODO: 자동 검수 로직 (이미지 분석 등)
  }

  private async completeReturn(returnRequest: any) {
    if (returnRequest.type === ReturnType.EXCHANGE) {
      // 교환 상품 발송
      // TODO: 새 배송 생성
    }

    // 주문 상태 업데이트
    const hasMoreItems = await this.prisma.orderItem.count({
      where: {
        orderId: returnRequest.orderId,
        id: { notIn: returnRequest.orderItemIds }
      }
    });

    if (hasMoreItems === 0) {
      // 전체 반품인 경우
      await this.prisma.order.update({
        where: { id: returnRequest.orderId },
        data: { status: 'REFUNDED' }
      });
    }
  }

  private async restoreInventory(returnRequest: any) {
    for (const itemId of returnRequest.orderItemIds) {
      const orderItem = returnRequest.order.items.find((item: any) => item.id === itemId);
      if (orderItem) {
        await this.inventoryService.adjustInventory(
          orderItem.productId,
          orderItem.quantity,
          'RETURN',
          `반품 재고 복구 - ${returnRequest.id}`
        );
      }
    }
  }

  private async createReturnLog(
    returnId: string,
    action: string,
    fromStatus?: string | null,
    toStatus?: string | null,
    performedBy?: string,
    details?: any
  ) {
    await this.prisma.returnLog.create({
      data: {
        returnId,
        action,
        fromStatus,
        toStatus,
        performedBy,
        details
      }
    });
  }

  private async calculateAvgProcessingTime(where: any): Promise<number> {
    const completedReturns = await this.prisma.return.findMany({
      where: {
        ...where,
        completedAt: { not: null }
      },
      select: {
        requestedAt: true,
        completedAt: true
      }
    });

    if (completedReturns.length === 0) return 0;

    const totalTime = completedReturns.reduce((sum, ret) => {
      const time = ret.completedAt!.getTime() - ret.requestedAt.getTime();
      return sum + time;
    }, 0);

    return Math.round(totalTime / completedReturns.length / (1000 * 60 * 60)); // hours
  }

  private async notifyReturnCreated(returnRequest: any) {
    if (returnRequest.user) {
      await this.notificationService.sendNotification({
        userId: returnRequest.user.id,
        type: 'RETURN_CREATED',
        title: '반품/교환 요청이 접수되었습니다',
        message: `주문번호 ${returnRequest.order.orderNumber}의 ${
          returnRequest.type === 'EXCHANGE' ? '교환' : '반품'
        } 요청이 접수되었습니다.`,
        data: { returnId: returnRequest.id }
      });
    }

    // 관리자 알림
    await this.notifyAdmins('NEW_RETURN', returnRequest);
  }

  private async notifyReturnUpdated(returnRequest: any, oldStatus: string) {
    if (returnRequest.user && returnRequest.status !== oldStatus) {
      const statusMessages: Record<string, string> = {
        APPROVED: '승인되었습니다',
        REJECTED: '거절되었습니다',
        PICKUP_SCHEDULED: '수거가 예정되었습니다',
        RECEIVED: '상품이 접수되었습니다',
        PROCESSING: '처리 중입니다',
        COMPLETED: '완료되었습니다'
      };

      await this.notificationService.sendNotification({
        userId: returnRequest.user.id,
        type: 'RETURN_STATUS_CHANGED',
        title: '반품/교환 상태 변경',
        message: `${returnRequest.type === 'EXCHANGE' ? '교환' : '반품'} 요청이 ${
          statusMessages[returnRequest.status] || '업데이트되었습니다'
        }.`,
        data: { returnId: returnRequest.id }
      });
    }
  }

  private async notifyAdmins(type: string, data: any) {
    const admins = await this.prisma.user.findMany({
      where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } }
    });

    for (const admin of admins) {
      await this.notificationService.sendNotification({
        userId: admin.id,
        type,
        title: type === 'NEW_RETURN' ? '새로운 반품/교환 요청' : '반품/교환 업데이트',
        message: `처리가 필요한 반품/교환 요청이 있습니다.`,
        data
      });
    }
  }
}