import { PrismaClient } from '@prisma/client';
import { 
  CreatePromotionDto, 
  UpdatePromotionDto,
  PromotionEvaluationResult,
  PromotionQueryDto,
  PromotionStatistics,
  PromotionType,
  PromotionConditions,
  PromotionActions
} from '../types/promotion';
import { cacheService } from './cacheService';
import { auditLogService } from './auditLogService';

class PromotionService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  // 프로모션 생성
  async createPromotion(createPromotionDto: CreatePromotionDto) {
    const promotion = await this.prisma.promotion.create({
      data: createPromotionDto
    });

    await auditLogService.log('promotion_created', 'admin', {
      promotionId: promotion.id,
      name: promotion.name,
      type: promotion.type
    });

    return promotion;
  }

  // 프로모션 수정
  async updatePromotion(promotionId: string, updateData: UpdatePromotionDto) {
    const promotion = await this.prisma.promotion.update({
      where: { id: promotionId },
      data: updateData
    });

    // 캐시 무효화
    await this.invalidatePromotionCache();

    await auditLogService.log('promotion_updated', 'admin', {
      promotionId,
      changes: updateData
    });

    return promotion;
  }

  // 프로모션 평가 (주문에 적용 가능한 프로모션 찾기)
  async evaluatePromotions(
    userId: string,
    orderData: {
      amount: number;
      items: Array<{
        productId: string;
        categoryId: string;
        price: number;
        quantity: number;
      }>;
      paymentMethod?: string;
    }
  ): Promise<PromotionEvaluationResult> {
    const cacheKey = `promotion:eval:${userId}:${JSON.stringify(orderData)}`;
    const cached = await cacheService.get(cacheKey);
    if (cached) return cached;

    // 활성 프로모션 조회
    const now = new Date();
    const activePromotions = await this.prisma.promotion.findMany({
      where: {
        isActive: true,
        startDate: { lte: now },
        endDate: { gte: now }
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    // 사용자 정보 조회
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        orders: {
          where: { status: { in: ['DELIVERED', 'COMPLETED'] } }
        }
      }
    });

    const applicablePromotions = [];
    let totalDiscount = 0;

    for (const promotion of activePromotions) {
      const conditions = promotion.conditions as PromotionConditions;
      const actions = promotion.actions as PromotionActions;

      // 조건 확인
      if (!this.checkConditions(conditions, orderData, user)) {
        continue;
      }

      // 액션 적용
      const result = this.applyActions(actions, orderData);
      
      if (result.discountAmount > 0 || result.freeProducts?.length > 0) {
        applicablePromotions.push({
          id: promotion.id,
          name: promotion.name,
          type: promotion.type,
          discountAmount: result.discountAmount,
          freeProducts: result.freeProducts,
          message: result.message
        });

        totalDiscount += result.discountAmount;

        // 독점 프로모션인 경우 다른 프로모션 적용 중단
        if (promotion.isExclusive) {
          break;
        }
      }
    }

    const finalAmount = orderData.amount - totalDiscount;

    const result = {
      applicable: applicablePromotions.length > 0,
      promotions: applicablePromotions,
      totalDiscount,
      finalAmount
    };

    // 캐시 저장 (5분)
    await cacheService.set(cacheKey, result, 300);

    return result;
  }

  // 프로모션 조건 확인
  private checkConditions(
    conditions: PromotionConditions,
    orderData: any,
    user: any
  ): boolean {
    // 최소 주문 금액
    if (conditions.minOrderAmount && orderData.amount < conditions.minOrderAmount) {
      return false;
    }

    // 상품 수량
    const totalQuantity = orderData.items.reduce((sum: number, item: any) => sum + item.quantity, 0);
    if (conditions.minQuantity && totalQuantity < conditions.minQuantity) {
      return false;
    }
    if (conditions.maxQuantity && totalQuantity > conditions.maxQuantity) {
      return false;
    }

    // 고객 그룹
    if (conditions.customerGroups?.length > 0) {
      // 고객 그룹 확인 로직
      // 예: VIP, 신규, 휴면 등
      const userGroup = this.getUserGroup(user);
      if (!conditions.customerGroups.includes(userGroup)) {
        return false;
      }
    }

    // 상품/카테고리 조건
    if (conditions.productIds?.length > 0 || conditions.categoryIds?.length > 0) {
      const hasMatchingItem = orderData.items.some((item: any) => 
        conditions.productIds?.includes(item.productId) ||
        conditions.categoryIds?.includes(item.categoryId)
      );
      if (!hasMatchingItem) {
        return false;
      }
    }

    // 결제 수단
    if (conditions.paymentMethods?.length > 0 && orderData.paymentMethod) {
      if (!conditions.paymentMethods.includes(orderData.paymentMethod)) {
        return false;
      }
    }

    // 시간대 조건
    if (conditions.timeSlots?.length > 0) {
      const now = new Date();
      const dayOfWeek = now.getDay();
      const currentTime = `${now.getHours()}:${now.getMinutes()}`;
      
      const inTimeSlot = conditions.timeSlots.some(slot => 
        slot.dayOfWeek === dayOfWeek &&
        currentTime >= slot.startTime &&
        currentTime <= slot.endTime
      );
      
      if (!inTimeSlot) {
        return false;
      }
    }

    // 커스텀 규칙
    if (conditions.customRules?.length > 0) {
      for (const rule of conditions.customRules) {
        if (!this.evaluateCustomRule(rule, orderData, user)) {
          return false;
        }
      }
    }

    return true;
  }

  // 프로모션 액션 적용
  private applyActions(
    actions: PromotionActions,
    orderData: any
  ): {
    discountAmount: number;
    freeProducts?: any[];
    message?: string;
  } {
    let discountAmount = 0;
    const freeProducts = [];
    let message = '';

    // 할인 적용
    if (actions.discountType) {
      switch (actions.discountType) {
        case 'percentage':
          discountAmount = orderData.amount * (actions.discountValue! / 100);
          message = `${actions.discountValue}% 할인`;
          break;

        case 'fixed':
          discountAmount = actions.discountValue!;
          message = `${actions.discountValue.toLocaleString()}원 할인`;
          break;

        case 'tiered':
          if (actions.discountTiers) {
            for (const tier of actions.discountTiers.sort((a, b) => b.minAmount - a.minAmount)) {
              if (orderData.amount >= tier.minAmount) {
                discountAmount = orderData.amount * (tier.discountValue / 100);
                message = `${tier.discountValue}% 할인 (${tier.minAmount.toLocaleString()}원 이상)`;
                break;
              }
            }
          }
          break;
      }
    }

    // 번들 할인
    if (actions.bundleProducts?.length > 0) {
      // 번들 상품 할인 로직
      const bundleDiscount = this.calculateBundleDiscount(actions.bundleProducts, orderData.items);
      if (bundleDiscount > 0) {
        discountAmount += bundleDiscount;
        message += message ? ', ' : '';
        message += '번들 할인 적용';
      }
    }

    // 무료 증정
    if (actions.freeProducts?.length > 0) {
      freeProducts.push(...actions.freeProducts);
      message += message ? ', ' : '';
      message += '사은품 증정';
    }

    // 무료 배송
    if (actions.freeShipping) {
      message += message ? ', ' : '';
      message += '무료 배송';
    }

    // 포인트 배율
    if (actions.pointMultiplier) {
      message += message ? ', ' : '';
      message += `포인트 ${actions.pointMultiplier}배 적립`;
    }

    return { discountAmount, freeProducts, message };
  }

  // 프로모션 적용 (주문 시)
  async applyPromotions(
    userId: string,
    orderId: string,
    promotions: Array<{
      promotionId: string;
      discountAmount: number;
      details?: any;
    }>
  ) {
    for (const promo of promotions) {
      await this.prisma.promotionApplication.create({
        data: {
          promotionId: promo.promotionId,
          orderId,
          userId,
          discountAmount: promo.discountAmount,
          details: promo.details
        }
      });

      // 사용 횟수 증가
      await this.prisma.promotion.update({
        where: { id: promo.promotionId },
        data: {
          usageCount: { increment: 1 }
        }
      });
    }

    await auditLogService.log('promotions_applied', userId, {
      orderId,
      promotions: promotions.map(p => p.promotionId)
    });
  }

  // 프로모션 목록 조회
  async getPromotions(query: PromotionQueryDto) {
    const { 
      page = 1, 
      limit = 20, 
      type, 
      isActive = true,
      targetCustomerGroup,
      targetCategory,
      targetProduct
    } = query;
    
    const offset = (page - 1) * limit;
    const now = new Date();

    const where: any = {
      isActive
    };

    if (type) where.type = type;

    // 유효 기간 내 프로모션만
    where.startDate = { lte: now };
    where.endDate = { gte: now };

    const [promotions, total] = await Promise.all([
      this.prisma.promotion.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'desc' }
        ]
      }),
      this.prisma.promotion.count({ where })
    ]);

    // 타겟 필터링
    let filteredPromotions = promotions;

    if (targetCustomerGroup) {
      filteredPromotions = filteredPromotions.filter(p => {
        const groups = p.targetCustomerGroups as string[] || [];
        return groups.length === 0 || groups.includes(targetCustomerGroup);
      });
    }

    if (targetCategory) {
      filteredPromotions = filteredPromotions.filter(p => {
        const categories = p.targetCategories as string[] || [];
        return categories.length === 0 || categories.includes(targetCategory);
      });
    }

    if (targetProduct) {
      filteredPromotions = filteredPromotions.filter(p => {
        const products = p.targetProducts as string[] || [];
        return products.length === 0 || products.includes(targetProduct);
      });
    }

    return {
      promotions: filteredPromotions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  // 프로모션 통계
  async getPromotionStatistics(promotionId: string): Promise<PromotionStatistics> {
    const [promotion, applications] = await Promise.all([
      this.prisma.promotion.findUnique({
        where: { id: promotionId }
      }),
      this.prisma.promotionApplication.findMany({
        where: { promotionId },
        include: {
          order: {
            select: {
              totalAmount: true,
              status: true
            }
          }
        }
      })
    ]);

    if (!promotion) {
      throw new Error('프로모션을 찾을 수 없습니다.');
    }

    const totalDiscountAmount = applications.reduce((sum, app) => 
      sum + parseFloat(app.discountAmount.toString()), 0
    );

    const completedOrders = applications.filter(app => 
      ['DELIVERED', 'COMPLETED'].includes(app.order.status)
    );

    const revenue = completedOrders.reduce((sum, app) => 
      sum + parseFloat(app.order.totalAmount.toString()), 0
    );

    const avgOrderValue = completedOrders.length > 0 
      ? revenue / completedOrders.length 
      : 0;

    // ROI 계산 (수익 / 할인 금액)
    const roi = totalDiscountAmount > 0 
      ? ((revenue - totalDiscountAmount) / totalDiscountAmount) * 100 
      : 0;

    return {
      promotionId,
      usageCount: applications.length,
      totalDiscountAmount,
      averageOrderValue: avgOrderValue,
      conversionRate: promotion.usageCount > 0 
        ? completedOrders.length / promotion.usageCount 
        : 0,
      revenue,
      roi
    };
  }

  // 플래시 세일 생성
  async createFlashSale(
    name: string,
    products: string[],
    discountPercentage: number,
    duration: number // 시간 단위
  ) {
    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + duration * 60 * 60 * 1000);

    return await this.createPromotion({
      name,
      description: `${duration}시간 한정 플래시 세일`,
      type: PromotionType.FLASH_SALE,
      priority: 100, // 높은 우선순위
      conditions: {
        productIds: products
      },
      actions: {
        discountType: 'percentage',
        discountValue: discountPercentage
      },
      targetProducts: products,
      startDate,
      endDate,
      isActive: true,
      isExclusive: true
    });
  }

  // BOGO 프로모션 생성
  async createBOGOPromotion(
    name: string,
    buyProducts: string[],
    getProducts: string[],
    getQuantity: number = 1
  ) {
    return await this.createPromotion({
      name,
      type: PromotionType.BOGO,
      conditions: {
        productIds: buyProducts,
        minQuantity: 1
      },
      actions: {
        freeProducts: getProducts.map(productId => ({
          productId,
          quantity: getQuantity
        }))
      },
      targetProducts: buyProducts,
      startDate: new Date(),
      endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1년
      isActive: true
    });
  }

  // 사용자 그룹 판단
  private getUserGroup(user: any): string {
    const orderCount = user.orders?.length || 0;
    const lastOrderDate = user.orders?.[0]?.createdAt;
    
    if (orderCount === 0) return 'NEW';
    if (orderCount >= 10) return 'VIP';
    
    if (lastOrderDate) {
      const daysSinceLastOrder = Math.floor(
        (Date.now() - lastOrderDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSinceLastOrder > 180) return 'DORMANT';
    }
    
    return 'REGULAR';
  }

  // 커스텀 규칙 평가
  private evaluateCustomRule(rule: any, orderData: any, user: any): boolean {
    const { field, operator, value } = rule;
    let fieldValue: any;

    // 필드 값 추출
    switch (field) {
      case 'order.amount':
        fieldValue = orderData.amount;
        break;
      case 'user.orderCount':
        fieldValue = user.orders?.length || 0;
        break;
      // 더 많은 필드 추가 가능
      default:
        return false;
    }

    // 연산자 적용
    switch (operator) {
      case 'eq':
        return fieldValue === value;
      case 'ne':
        return fieldValue !== value;
      case 'gt':
        return fieldValue > value;
      case 'gte':
        return fieldValue >= value;
      case 'lt':
        return fieldValue < value;
      case 'lte':
        return fieldValue <= value;
      case 'in':
        return Array.isArray(value) && value.includes(fieldValue);
      case 'contains':
        return String(fieldValue).includes(value);
      default:
        return false;
    }
  }

  // 번들 할인 계산
  private calculateBundleDiscount(bundleProducts: any[], orderItems: any[]): number {
    let discount = 0;

    for (const bundle of bundleProducts) {
      const item = orderItems.find(i => i.productId === bundle.productId);
      if (item && item.quantity >= bundle.quantity) {
        const bundleSets = Math.floor(item.quantity / bundle.quantity);
        discount += item.price * bundle.quantity * bundleSets * (bundle.discountPercentage / 100);
      }
    }

    return discount;
  }

  // 캐시 무효화
  private async invalidatePromotionCache() {
    await cacheService.delete('promotion:*');
  }

  // 프로모션 삭제
  async deletePromotion(promotionId: string) {
    const promotion = await this.prisma.promotion.findUnique({
      where: { id: promotionId },
      include: { applications: true }
    });

    if (!promotion) {
      throw new Error('프로모션을 찾을 수 없습니다.');
    }

    if (promotion.applications.length > 0) {
      throw new Error('사용 이력이 있는 프로모션은 삭제할 수 없습니다.');
    }

    await this.prisma.promotion.delete({
      where: { id: promotionId }
    });

    await this.invalidatePromotionCache();

    await auditLogService.log('promotion_deleted', 'admin', {
      promotionId,
      name: promotion.name
    });
  }
}

export const promotionService = new PromotionService();