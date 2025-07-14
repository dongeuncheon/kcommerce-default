import { PrismaClient } from '@prisma/client';
import { realtimeInventoryService } from './realtimeInventoryService';
import { cacheService } from '../cacheService';
import { notificationService } from '../notificationService';
import { auditLogService } from '../auditLogService';

interface InventoryUpdateRequest {
  productId: string;
  variantId?: string;
  quantity: number;
  type: 'SET' | 'INCREMENT' | 'DECREMENT';
  reason?: string;
}

interface StockCheckRequest {
  items: Array<{
    productId: string;
    variantId?: string;
    quantity: number;
  }>;
}

interface InventorySettings {
  lowStockThreshold: number;
  criticalStockThreshold: number;
  reservationDuration: number;
  enableBackorders: boolean;
  enableReservations: boolean;
}

class InventoryService {
  private prisma: PrismaClient;
  private settings: InventorySettings = {
    lowStockThreshold: 10,
    criticalStockThreshold: 5,
    reservationDuration: 15,
    enableBackorders: false,
    enableReservations: true
  };

  constructor() {
    this.prisma = new PrismaClient();
    this.loadSettings();
  }

  /**
   * 설정 로드
   */
  private async loadSettings() {
    const settings = await this.prisma.setting.findUnique({
      where: { key: 'inventory_settings' }
    });

    if (settings) {
      this.settings = { ...this.settings, ...(settings.value as any) };
    }
  }

  /**
   * 재고 업데이트
   */
  async updateInventory(
    request: InventoryUpdateRequest,
    userId: string
  ): Promise<void> {
    const { productId, variantId, quantity, type, reason } = request;

    let adjustment = 0;
    let previousQuantity = 0;
    let newQuantity = 0;

    if (variantId) {
      const variant = await this.prisma.productVariant.findUnique({
        where: { id: variantId }
      });
      
      if (!variant) {
        throw new Error('상품 변형을 찾을 수 없습니다.');
      }

      previousQuantity = variant.quantity;
      
      switch (type) {
        case 'SET':
          newQuantity = quantity;
          adjustment = quantity - previousQuantity;
          break;
        case 'INCREMENT':
          newQuantity = previousQuantity + quantity;
          adjustment = quantity;
          break;
        case 'DECREMENT':
          newQuantity = previousQuantity - quantity;
          adjustment = -quantity;
          break;
      }

      await this.prisma.productVariant.update({
        where: { id: variantId },
        data: { quantity: newQuantity }
      });
    } else {
      const product = await this.prisma.product.findUnique({
        where: { id: productId }
      });
      
      if (!product) {
        throw new Error('상품을 찾을 수 없습니다.');
      }

      previousQuantity = product.quantity;
      
      switch (type) {
        case 'SET':
          newQuantity = quantity;
          adjustment = quantity - previousQuantity;
          break;
        case 'INCREMENT':
          newQuantity = previousQuantity + quantity;
          adjustment = quantity;
          break;
        case 'DECREMENT':
          newQuantity = previousQuantity - quantity;
          adjustment = -quantity;
          break;
      }

      await this.prisma.product.update({
        where: { id: productId },
        data: { quantity: newQuantity }
      });
    }

    // 재고 로그 기록
    await this.prisma.inventoryLog.create({
      data: {
        productId,
        type: 'ADJUSTMENT',
        quantity: adjustment,
        reason: reason || `${type} 작업`,
        reference: userId
      }
    });

    // 실시간 재고 서비스에 알림
    realtimeInventoryService.emit('inventoryUpdate', {
      productId,
      variantId,
      previousQuantity,
      newQuantity,
      adjustment
    });

    // 캐시 무효화
    await cacheService.delete(`inventory:${productId}:*`);

    // 재고 부족 알림
    if (newQuantity <= this.settings.criticalStockThreshold) {
      await notificationService.sendAdminNotification({
        type: 'CRITICAL_LOW_STOCK',
        title: '긴급 재고 부족',
        message: `상품 ID ${productId}의 재고가 ${newQuantity}개로 매우 부족합니다.`,
        data: { productId, quantity: newQuantity }
      });
    } else if (newQuantity <= this.settings.lowStockThreshold) {
      await notificationService.sendAdminNotification({
        type: 'LOW_STOCK',
        title: '재고 부족',
        message: `상품 ID ${productId}의 재고가 ${newQuantity}개로 부족합니다.`,
        data: { productId, quantity: newQuantity }
      });
    }

    // 감사 로그
    await auditLogService.log('inventory_updated', userId, {
      productId,
      variantId,
      type,
      previousQuantity,
      newQuantity,
      adjustment,
      reason
    });
  }

  /**
   * 재고 확인 (주문 전)
   */
  async checkStock(request: StockCheckRequest): Promise<{
    available: boolean;
    items: Array<{
      productId: string;
      variantId?: string;
      requested: number;
      available: number;
      reserved: number;
      canBackorder: boolean;
    }>;
  }> {
    const results = [];
    let allAvailable = true;

    for (const item of request.items) {
      const availability = await realtimeInventoryService.checkAvailability(
        item.productId,
        item.variantId,
        item.quantity
      );

      const product = await this.prisma.product.findUnique({
        where: { id: item.productId },
        select: { allowBackorders: true }
      });

      const itemResult = {
        productId: item.productId,
        variantId: item.variantId,
        requested: item.quantity,
        available: availability.quantity,
        reserved: availability.reserved,
        canBackorder: product?.allowBackorders || false
      };

      results.push(itemResult);

      if (!availability.available && !itemResult.canBackorder) {
        allAvailable = false;
      }
    }

    return {
      available: allAvailable,
      items: results
    };
  }

  /**
   * 재고 예약 (장바구니/주문)
   */
  async reserveStock(
    items: Array<{
      productId: string;
      variantId?: string;
      quantity: number;
    }>,
    userId?: string,
    sessionId?: string,
    type: 'CART' | 'CHECKOUT' | 'PAYMENT' = 'CART'
  ): Promise<string[]> {
    if (!this.settings.enableReservations) {
      return [];
    }

    const reservationIds: string[] = [];

    for (const item of items) {
      try {
        const reservationId = await realtimeInventoryService.createReservation({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          type: type as any,
          userId,
          sessionId,
          duration: this.settings.reservationDuration
        });

        reservationIds.push(reservationId);
      } catch (error) {
        // 일부 실패 시 전체 롤백
        for (const id of reservationIds) {
          await realtimeInventoryService.cancelReservation(id);
        }
        throw error;
      }
    }

    return reservationIds;
  }

  /**
   * 재고 예약 확정 (결제 완료)
   */
  async confirmReservations(reservationIds: string[]): Promise<void> {
    for (const id of reservationIds) {
      await realtimeInventoryService.confirmReservation(id);
    }
  }

  /**
   * 재고 예약 취소
   */
  async cancelReservations(reservationIds: string[]): Promise<void> {
    for (const id of reservationIds) {
      await realtimeInventoryService.cancelReservation(id);
    }
  }

  /**
   * 재고 반환 (주문 취소/반품)
   */
  async returnStock(
    orderId: string,
    items: Array<{
      productId: string;
      variantId?: string;
      quantity: number;
    }>,
    reason: string
  ): Promise<void> {
    for (const item of items) {
      // 재고 복구
      await this.updateInventory({
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
        type: 'INCREMENT',
        reason: `반품/취소: ${reason}`
      }, 'system');

      // 재고 로그
      await this.prisma.inventoryLog.create({
        data: {
          productId: item.productId,
          type: 'RETURN',
          quantity: item.quantity,
          reason,
          reference: orderId
        }
      });
    }
  }

  /**
   * 재고 이력 조회
   */
  async getInventoryHistory(
    productId: string,
    options: {
      startDate?: Date;
      endDate?: Date;
      type?: string;
      page?: number;
      limit?: number;
    } = {}
  ) {
    const { 
      startDate, 
      endDate, 
      type, 
      page = 1, 
      limit = 50 
    } = options;

    const where: any = { productId };
    
    if (startDate && endDate) {
      where.createdAt = { gte: startDate, lte: endDate };
    }
    
    if (type) {
      where.type = type;
    }

    const [logs, total] = await Promise.all([
      this.prisma.inventoryLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      this.prisma.inventoryLog.count({ where })
    ]);

    return {
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * 재고 현황 대시보드
   */
  async getInventoryDashboard() {
    const [
      totalProducts,
      lowStockProducts,
      outOfStockProducts,
      activeReservations,
      recentMovements
    ] = await Promise.all([
      this.prisma.product.count({
        where: { trackQuantity: true }
      }),
      this.prisma.product.count({
        where: {
          trackQuantity: true,
          quantity: { lte: this.settings.lowStockThreshold, gt: 0 }
        }
      }),
      this.prisma.product.count({
        where: {
          trackQuantity: true,
          quantity: 0
        }
      }),
      this.prisma.inventoryReservation.count({
        where: {
          status: 'ACTIVE',
          expiresAt: { gt: new Date() }
        }
      }),
      this.prisma.inventoryLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          product: {
            select: { name: true }
          }
        }
      })
    ]);

    return {
      summary: {
        totalProducts,
        lowStockProducts,
        outOfStockProducts,
        activeReservations
      },
      alerts: {
        lowStock: lowStockProducts > 0,
        outOfStock: outOfStockProducts > 0,
        highReservation: activeReservations > 100
      },
      recentMovements
    };
  }

  /**
   * 재고 최적화 제안
   */
  async getOptimizationSuggestions(productId?: string) {
    const where = productId ? { productId } : {};
    
    // 최근 30일 판매 데이터
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const salesData = await this.prisma.inventoryLog.groupBy({
      by: ['productId'],
      where: {
        ...where,
        type: 'SALE',
        createdAt: { gte: thirtyDaysAgo }
      },
      _sum: { quantity: true },
      _count: true
    });

    const suggestions = [];

    for (const data of salesData) {
      const product = await this.prisma.product.findUnique({
        where: { id: data.productId },
        select: { name: true, quantity: true, lowStockThreshold: true }
      });

      if (!product) continue;

      const avgDailySales = Math.abs(data._sum.quantity || 0) / 30;
      const daysOfStock = product.quantity / avgDailySales;

      if (daysOfStock < 7) {
        suggestions.push({
          productId: data.productId,
          productName: product.name,
          type: 'RESTOCK_URGENT',
          message: `긴급 재입고 필요 (${Math.floor(daysOfStock)}일분 재고)`,
          recommendedQuantity: Math.ceil(avgDailySales * 30)
        });
      } else if (daysOfStock < 14) {
        suggestions.push({
          productId: data.productId,
          productName: product.name,
          type: 'RESTOCK_SOON',
          message: `재입고 준비 필요 (${Math.floor(daysOfStock)}일분 재고)`,
          recommendedQuantity: Math.ceil(avgDailySales * 30)
        });
      } else if (daysOfStock > 90) {
        suggestions.push({
          productId: data.productId,
          productName: product.name,
          type: 'OVERSTOCK',
          message: `과잉 재고 (${Math.floor(daysOfStock)}일분 재고)`,
          recommendedAction: '프로모션 또는 할인 판매 고려'
        });
      }

      // 임계값 조정 제안
      const optimalThreshold = Math.ceil(avgDailySales * 7);
      if (Math.abs(product.lowStockThreshold - optimalThreshold) > 5) {
        suggestions.push({
          productId: data.productId,
          productName: product.name,
          type: 'THRESHOLD_ADJUSTMENT',
          message: `재고 임계값 조정 권장`,
          currentThreshold: product.lowStockThreshold,
          recommendedThreshold: optimalThreshold
        });
      }
    }

    return suggestions;
  }

  /**
   * 재고 설정 업데이트
   */
  async updateSettings(settings: Partial<InventorySettings>, userId: string) {
    this.settings = { ...this.settings, ...settings };

    await this.prisma.setting.upsert({
      where: { key: 'inventory_settings' },
      update: { value: this.settings },
      create: {
        key: 'inventory_settings',
        value: this.settings,
        category: 'inventory'
      }
    });

    await auditLogService.log('inventory_settings_updated', userId, {
      settings: this.settings
    });
  }

  /**
   * 재고 CSV 내보내기
   */
  async exportInventory(options: {
    productIds?: string[];
    includeVariants?: boolean;
  }) {
    const where = options.productIds ? { id: { in: options.productIds } } : {};
    
    const products = await this.prisma.product.findMany({
      where,
      include: {
        variants: options.includeVariants,
        category: true
      }
    });

    const data = [];

    for (const product of products) {
      data.push({
        상품ID: product.id,
        상품명: product.name,
        카테고리: product.category?.name || '',
        SKU: product.sku,
        현재재고: product.quantity,
        재고추적: product.trackQuantity ? 'Y' : 'N',
        품절임계값: product.lowStockThreshold,
        재주문허용: product.allowBackorders ? 'Y' : 'N'
      });

      if (options.includeVariants && product.variants) {
        for (const variant of product.variants) {
          data.push({
            상품ID: product.id,
            상품명: `${product.name} - ${variant.name}`,
            카테고리: product.category?.name || '',
            SKU: variant.sku,
            현재재고: variant.quantity,
            재고추적: product.trackQuantity ? 'Y' : 'N',
            품절임계값: 5,
            재주문허용: product.allowBackorders ? 'Y' : 'N'
          });
        }
      }
    }

    return data;
  }

  /**
   * 재고 CSV 가져오기
   */
  async importInventory(
    data: Array<{
      sku: string;
      quantity: number;
    }>,
    userId: string
  ): Promise<{
    success: number;
    failed: number;
    errors: string[];
  }> {
    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const item of data) {
      try {
        // SKU로 상품 찾기
        const product = await this.prisma.product.findFirst({
          where: { sku: item.sku }
        });

        if (!product) {
          const variant = await this.prisma.productVariant.findFirst({
            where: { sku: item.sku }
          });

          if (!variant) {
            errors.push(`SKU ${item.sku}를 찾을 수 없습니다.`);
            failed++;
            continue;
          }

          await this.updateInventory({
            productId: variant.productId,
            variantId: variant.id,
            quantity: item.quantity,
            type: 'SET',
            reason: 'CSV 가져오기'
          }, userId);
        } else {
          await this.updateInventory({
            productId: product.id,
            quantity: item.quantity,
            type: 'SET',
            reason: 'CSV 가져오기'
          }, userId);
        }

        success++;
      } catch (error: any) {
        errors.push(`SKU ${item.sku}: ${error.message}`);
        failed++;
      }
    }

    return { success, failed, errors };
  }
}

export const inventoryService = new InventoryService();