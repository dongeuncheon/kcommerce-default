import { PrismaClient, ReservationType, ReservationStatus, AlertType, AlertLevel } from '@prisma/client';
import { Server as SocketServer } from 'socket.io';
import { cacheService } from '../cacheService';
import { notificationService } from '../notificationService';
import { auditLogService } from '../auditLogService';
import EventEmitter from 'events';

interface InventoryCheckResult {
  available: boolean;
  quantity: number;
  reserved: number;
  message?: string;
}

interface ReservationRequest {
  productId: string;
  variantId?: string;
  quantity: number;
  type: ReservationType;
  userId?: string;
  sessionId?: string;
  orderId?: string;
  cartId?: string;
  duration?: number; // minutes
}

export class RealtimeInventoryService extends EventEmitter {
  private prisma: PrismaClient;
  private io?: SocketServer;
  private readonly DEFAULT_RESERVATION_DURATION = 15; // 15분
  private readonly CHECKOUT_RESERVATION_DURATION = 30; // 30분
  private readonly LOW_STOCK_THRESHOLD = 0.2; // 20%
  private readonly CRITICAL_STOCK_THRESHOLD = 0.05; // 5%
  
  constructor() {
    super();
    this.prisma = new PrismaClient();
    this.initializeScheduledTasks();
  }

  /**
   * Socket.IO 서버 설정
   */
  setSocketServer(io: SocketServer) {
    this.io = io;
    this.setupSocketHandlers();
  }

  /**
   * 예약 시스템 초기화
   */
  private initializeScheduledTasks() {
    // 만료된 예약 정리 (5분마다)
    setInterval(() => this.cleanupExpiredReservations(), 5 * 60 * 1000);
    
    // 재고 스냅샷 생성 (1시간마다)
    setInterval(() => this.createInventorySnapshots(), 60 * 60 * 1000);
    
    // 재고 경고 확인 (10분마다)
    setInterval(() => this.checkInventoryAlerts(), 10 * 60 * 1000);
  }

  /**
   * Socket 핸들러 설정
   */
  private setupSocketHandlers() {
    if (!this.io) return;

    this.io.on('connection', (socket) => {
      // 실시간 재고 구독
      socket.on('subscribeInventory', (productIds: string[]) => {
        productIds.forEach(productId => {
          socket.join(`inventory:${productId}`);
        });
      });

      // 재고 확인
      socket.on('checkInventory', async (productId: string, variantId?: string) => {
        const result = await this.checkAvailability(productId, variantId);
        socket.emit('inventoryStatus', { productId, variantId, ...result });
      });
    });
  }

  /**
   * 재고 예약
   */
  async createReservation(request: ReservationRequest): Promise<string> {
    const { 
      productId, variantId, quantity, type, 
      userId, sessionId, orderId, cartId 
    } = request;

    // 재고 확인
    const availability = await this.checkAvailability(productId, variantId, quantity);
    if (!availability.available) {
      throw new Error(availability.message || '재고가 부족합니다.');
    }

    // 예약 기간 설정
    const duration = request.duration || 
      (type === ReservationType.CHECKOUT ? this.CHECKOUT_RESERVATION_DURATION : this.DEFAULT_RESERVATION_DURATION);
    
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + duration);

    // 예약 생성
    const reservation = await this.prisma.inventoryReservation.create({
      data: {
        productId,
        variantId,
        quantity,
        type,
        userId,
        sessionId,
        orderId,
        cartId,
        expiresAt
      }
    });

    // 재고 업데이트
    await this.updateProductQuantity(productId, variantId, -quantity);
    
    // 실시간 알림
    this.broadcastInventoryUpdate(productId, variantId);

    // 감사 로그
    await auditLogService.log('inventory_reserved', userId || 'system', {
      reservationId: reservation.id,
      productId,
      quantity,
      type
    });

    return reservation.id;
  }

  /**
   * 예약 확정 (구매 완료)
   */
  async confirmReservation(reservationId: string): Promise<void> {
    const reservation = await this.prisma.inventoryReservation.findUnique({
      where: { id: reservationId }
    });

    if (!reservation) {
      throw new Error('예약을 찾을 수 없습니다.');
    }

    if (reservation.status !== ReservationStatus.ACTIVE) {
      throw new Error('활성 예약이 아닙니다.');
    }

    // 예약 상태 업데이트
    await this.prisma.inventoryReservation.update({
      where: { id: reservationId },
      data: { status: ReservationStatus.CONFIRMED }
    });

    // 재고 로그 기록
    await this.prisma.inventoryLog.create({
      data: {
        productId: reservation.productId,
        type: 'SALE',
        quantity: -reservation.quantity,
        reference: reservation.orderId || reservationId
      }
    });
  }

  /**
   * 예약 취소
   */
  async cancelReservation(reservationId: string): Promise<void> {
    const reservation = await this.prisma.inventoryReservation.findUnique({
      where: { id: reservationId }
    });

    if (!reservation || reservation.status !== ReservationStatus.ACTIVE) {
      return; // 이미 처리된 예약
    }

    // 예약 취소
    await this.prisma.inventoryReservation.update({
      where: { id: reservationId },
      data: { status: ReservationStatus.CANCELLED }
    });

    // 재고 복구
    await this.updateProductQuantity(
      reservation.productId, 
      reservation.variantId, 
      reservation.quantity
    );

    // 실시간 알림
    this.broadcastInventoryUpdate(reservation.productId, reservation.variantId);
  }

  /**
   * 재고 가용성 확인
   */
  async checkAvailability(
    productId: string, 
    variantId?: string,
    requestedQuantity?: number
  ): Promise<InventoryCheckResult> {
    const cacheKey = `inventory:${productId}:${variantId || 'main'}`;
    const cached = await cacheService.get(cacheKey);
    if (cached && !requestedQuantity) return cached;

    // 상품 정보 조회
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: {
        quantity: true,
        trackQuantity: true,
        allowBackorders: true
      }
    });

    if (!product) {
      return {
        available: false,
        quantity: 0,
        reserved: 0,
        message: '상품을 찾을 수 없습니다.'
      };
    }

    // 재고 추적하지 않는 상품
    if (!product.trackQuantity) {
      return {
        available: true,
        quantity: 999999,
        reserved: 0
      };
    }

    // 활성 예약 수량 계산
    const reservations = await this.prisma.inventoryReservation.aggregate({
      where: {
        productId,
        variantId,
        status: ReservationStatus.ACTIVE,
        expiresAt: { gt: new Date() }
      },
      _sum: { quantity: true }
    });

    const reservedQuantity = reservations._sum.quantity || 0;
    const availableQuantity = product.quantity - reservedQuantity;

    const result: InventoryCheckResult = {
      available: availableQuantity > 0 || product.allowBackorders,
      quantity: availableQuantity,
      reserved: reservedQuantity
    };

    if (requestedQuantity) {
      if (availableQuantity < requestedQuantity && !product.allowBackorders) {
        result.available = false;
        result.message = `재고가 부족합니다. (가용: ${availableQuantity}개)`;
      }
    }

    // 캐시 저장 (30초)
    await cacheService.set(cacheKey, result, 30);

    return result;
  }

  /**
   * 만료된 예약 정리
   */
  private async cleanupExpiredReservations(): Promise<void> {
    const expired = await this.prisma.inventoryReservation.findMany({
      where: {
        status: ReservationStatus.ACTIVE,
        expiresAt: { lt: new Date() }
      }
    });

    for (const reservation of expired) {
      try {
        // 예약 만료 처리
        await this.prisma.inventoryReservation.update({
          where: { id: reservation.id },
          data: { status: ReservationStatus.EXPIRED }
        });

        // 재고 복구
        await this.updateProductQuantity(
          reservation.productId,
          reservation.variantId,
          reservation.quantity
        );

        // 실시간 알림
        this.broadcastInventoryUpdate(reservation.productId, reservation.variantId);

        // 사용자에게 알림
        if (reservation.userId) {
          await notificationService.sendNotification(reservation.userId, {
            type: 'RESERVATION_EXPIRED',
            title: '장바구니 상품 예약 만료',
            message: '장바구니에 담긴 상품의 예약이 만료되었습니다.',
            data: { reservationId: reservation.id }
          });
        }
      } catch (error) {
        console.error(`Failed to cleanup reservation ${reservation.id}:`, error);
      }
    }

    console.log(`Cleaned up ${expired.length} expired reservations`);
  }

  /**
   * 재고 스냅샷 생성
   */
  private async createInventorySnapshots(): Promise<void> {
    const products = await this.prisma.product.findMany({
      where: { trackQuantity: true },
      include: {
        variants: true,
        inventoryReservations: {
          where: {
            status: ReservationStatus.ACTIVE,
            expiresAt: { gt: new Date() }
          }
        }
      }
    });

    for (const product of products) {
      // 메인 상품 스냅샷
      const mainReserved = product.inventoryReservations
        .filter(r => !r.variantId)
        .reduce((sum, r) => sum + r.quantity, 0);

      await this.prisma.inventorySnapshot.create({
        data: {
          productId: product.id,
          availableQuantity: product.quantity - mainReserved,
          reservedQuantity: mainReserved,
          totalQuantity: product.quantity,
          lowStockAlert: (product.quantity - mainReserved) <= product.lowStockThreshold,
          outOfStockAlert: (product.quantity - mainReserved) <= 0
        }
      });

      // 변형 상품 스냅샷
      for (const variant of product.variants) {
        const variantReserved = product.inventoryReservations
          .filter(r => r.variantId === variant.id)
          .reduce((sum, r) => sum + r.quantity, 0);

        await this.prisma.inventorySnapshot.create({
          data: {
            productId: product.id,
            variantId: variant.id,
            availableQuantity: variant.quantity - variantReserved,
            reservedQuantity: variantReserved,
            totalQuantity: variant.quantity,
            lowStockAlert: (variant.quantity - variantReserved) <= 5,
            outOfStockAlert: (variant.quantity - variantReserved) <= 0
          }
        });
      }
    }
  }

  /**
   * 재고 경고 확인
   */
  private async checkInventoryAlerts(): Promise<void> {
    const products = await this.prisma.product.findMany({
      where: { trackQuantity: true },
      include: {
        inventoryReservations: {
          where: {
            status: ReservationStatus.ACTIVE,
            expiresAt: { gt: new Date() }
          }
        }
      }
    });

    for (const product of products) {
      const reserved = product.inventoryReservations
        .reduce((sum, r) => sum + r.quantity, 0);
      const available = product.quantity - reserved;
      const totalQuantity = product.quantity;

      // 재고 부족 경고
      if (available <= product.lowStockThreshold && available > 0) {
        await this.createAlert(
          product.id,
          AlertType.LOW_STOCK,
          AlertLevel.WARNING,
          `재고 부족: ${available}개 남음`,
          available,
          product.lowStockThreshold
        );
      }

      // 품절 경고
      if (available <= 0) {
        await this.createAlert(
          product.id,
          AlertType.OUT_OF_STOCK,
          AlertLevel.CRITICAL,
          '품절',
          available,
          0
        );
      }

      // 과잉 재고 경고 (임계치의 5배 이상)
      if (totalQuantity > product.lowStockThreshold * 5) {
        await this.createAlert(
          product.id,
          AlertType.OVERSTOCK,
          AlertLevel.INFO,
          `과잉 재고: ${totalQuantity}개`,
          totalQuantity,
          product.lowStockThreshold * 5
        );
      }

      // 높은 예약률 경고 (80% 이상 예약)
      if (reserved > 0 && reserved / totalQuantity > 0.8) {
        await this.createAlert(
          product.id,
          AlertType.RESERVED_HIGH,
          AlertLevel.WARNING,
          `높은 예약률: ${Math.round(reserved / totalQuantity * 100)}%`,
          reserved,
          Math.round(totalQuantity * 0.8)
        );
      }
    }
  }

  /**
   * 재고 경고 생성
   */
  private async createAlert(
    productId: string,
    type: AlertType,
    level: AlertLevel,
    message: string,
    currentQuantity: number,
    thresholdQuantity?: number
  ): Promise<void> {
    // 기존 미해결 경고 확인
    const existing = await this.prisma.inventoryAlert.findFirst({
      where: {
        productId,
        type,
        isResolved: false
      }
    });

    if (existing) return;

    const alert = await this.prisma.inventoryAlert.create({
      data: {
        productId,
        type,
        level,
        message,
        currentQuantity,
        thresholdQuantity
      }
    });

    // 관리자에게 알림
    await notificationService.sendAdminNotification({
      type: 'INVENTORY_ALERT',
      title: `재고 경고: ${type}`,
      message,
      data: { alertId: alert.id, productId }
    });

    // 실시간 브로드캐스트
    this.io?.emit('inventoryAlert', alert);
  }

  /**
   * 상품 수량 업데이트
   */
  private async updateProductQuantity(
    productId: string,
    variantId: string | null,
    quantityChange: number
  ): Promise<void> {
    if (variantId) {
      await this.prisma.productVariant.update({
        where: { id: variantId },
        data: {
          quantity: { increment: quantityChange }
        }
      });
    } else {
      await this.prisma.product.update({
        where: { id: productId },
        data: {
          quantity: { increment: quantityChange }
        }
      });
    }

    // 캐시 무효화
    await cacheService.delete(`inventory:${productId}:*`);
  }

  /**
   * 재고 업데이트 브로드캐스트
   */
  private async broadcastInventoryUpdate(productId: string, variantId?: string) {
    const availability = await this.checkAvailability(productId, variantId);
    
    const update = {
      productId,
      variantId,
      ...availability,
      timestamp: new Date()
    };

    // Socket.IO 브로드캐스트
    if (this.io) {
      this.io.to(`inventory:${productId}`).emit('inventoryUpdate', update);
    }

    // 이벤트 발행
    this.emit('inventoryUpdate', update);
  }

  /**
   * 재고 조정
   */
  async adjustInventory(
    productId: string,
    variantId: string | null,
    adjustment: number,
    reason: string,
    userId: string
  ): Promise<void> {
    // 재고 조정
    await this.updateProductQuantity(productId, variantId, adjustment);

    // 로그 기록
    await this.prisma.inventoryLog.create({
      data: {
        productId,
        type: 'ADJUSTMENT',
        quantity: adjustment,
        reason,
        reference: userId
      }
    });

    // 감사 로그
    await auditLogService.log('inventory_adjusted', userId, {
      productId,
      variantId,
      adjustment,
      reason
    });

    // 실시간 알림
    this.broadcastInventoryUpdate(productId, variantId);
  }

  /**
   * 재고 이동
   */
  async transferInventory(
    fromProductId: string,
    toProductId: string,
    quantity: number,
    reason: string,
    userId: string
  ): Promise<void> {
    // 출발지 재고 확인
    const availability = await this.checkAvailability(fromProductId, undefined, quantity);
    if (!availability.available) {
      throw new Error('이동할 재고가 부족합니다.');
    }

    // 재고 이동
    await this.updateProductQuantity(fromProductId, null, -quantity);
    await this.updateProductQuantity(toProductId, null, quantity);

    // 로그 기록
    await Promise.all([
      this.prisma.inventoryLog.create({
        data: {
          productId: fromProductId,
          type: 'TRANSFER',
          quantity: -quantity,
          reason: `${toProductId}로 이동: ${reason}`,
          reference: userId
        }
      }),
      this.prisma.inventoryLog.create({
        data: {
          productId: toProductId,
          type: 'TRANSFER',
          quantity,
          reason: `${fromProductId}에서 이동: ${reason}`,
          reference: userId
        }
      })
    ]);

    // 실시간 알림
    this.broadcastInventoryUpdate(fromProductId);
    this.broadcastInventoryUpdate(toProductId);
  }

  /**
   * 대량 재고 업데이트
   */
  async bulkUpdateInventory(
    updates: Array<{
      productId: string;
      variantId?: string;
      quantity: number;
    }>,
    reason: string,
    userId: string
  ): Promise<void> {
    for (const update of updates) {
      try {
        await this.adjustInventory(
          update.productId,
          update.variantId || null,
          update.quantity,
          reason,
          userId
        );
      } catch (error) {
        console.error(`Failed to update inventory for ${update.productId}:`, error);
      }
    }
  }

  /**
   * 재고 보고서 생성
   */
  async generateInventoryReport(options: {
    startDate?: Date;
    endDate?: Date;
    productIds?: string[];
  }) {
    const { startDate, endDate, productIds } = options;

    const where: any = {};
    if (startDate && endDate) {
      where.createdAt = { gte: startDate, lte: endDate };
    }
    if (productIds?.length) {
      where.productId = { in: productIds };
    }

    const [logs, snapshots, alerts] = await Promise.all([
      this.prisma.inventoryLog.findMany({ where }),
      this.prisma.inventorySnapshot.findMany({ where }),
      this.prisma.inventoryAlert.findMany({ 
        where: { ...where, isResolved: false } 
      })
    ]);

    return {
      period: { startDate, endDate },
      summary: {
        totalMovements: logs.length,
        totalAlerts: alerts.length,
        criticalAlerts: alerts.filter(a => a.level === AlertLevel.CRITICAL).length
      },
      logs,
      snapshots,
      alerts
    };
  }
}

export const realtimeInventoryService = new RealtimeInventoryService();