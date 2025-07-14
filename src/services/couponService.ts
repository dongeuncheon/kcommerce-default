import { PrismaClient } from '@prisma/client';
import { 
  CreateCouponDto, 
  UpdateCouponDto, 
  CouponValidationResult,
  ApplyCouponDto,
  CouponQueryDto,
  UserCoupon,
  CouponType,
  DiscountType
} from '../types/coupon';
import { cacheService } from './cacheService';
import { auditLogService } from './auditLogService';
import { notificationService } from './notificationService';

class CouponService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  // 쿠폰 생성
  async createCoupon(createCouponDto: CreateCouponDto) {
    const { 
      code, name, description, type, discountType, discountValue,
      minOrderAmount, maxDiscount, applicableCategories, applicableProducts,
      excludedProducts, usageLimit, perUserLimit, validFrom, validUntil,
      isActive, metadata
    } = createCouponDto;

    // 쿠폰 코드 중복 확인
    const existing = await this.prisma.coupon.findUnique({
      where: { code }
    });

    if (existing) {
      throw new Error('이미 존재하는 쿠폰 코드입니다.');
    }

    const coupon = await this.prisma.coupon.create({
      data: {
        code,
        name,
        description,
        type,
        discountType,
        discountValue,
        minOrderAmount,
        maxDiscount,
        applicableCategories,
        applicableProducts,
        excludedProducts,
        usageLimit,
        perUserLimit,
        validFrom,
        validUntil,
        isActive: isActive ?? true,
        metadata
      }
    });

    await auditLogService.log('coupon_created', 'admin', {
      couponId: coupon.id,
      code: coupon.code
    });

    return coupon;
  }

  // 쿠폰 수정
  async updateCoupon(couponId: string, updateData: UpdateCouponDto) {
    const coupon = await this.prisma.coupon.update({
      where: { id: couponId },
      data: updateData
    });

    // 캐시 무효화
    await this.invalidateCouponCache(coupon.code);

    await auditLogService.log('coupon_updated', 'admin', {
      couponId,
      changes: updateData
    });

    return coupon;
  }

  // 쿠폰 검증
  async validateCoupon(
    userId: string, 
    applyCouponDto: ApplyCouponDto
  ): Promise<CouponValidationResult> {
    const { couponCode, orderAmount, shippingFee = 0, items = [] } = applyCouponDto;

    // 쿠폰 조회
    const coupon = await this.prisma.coupon.findUnique({
      where: { code: couponCode },
      include: {
        usages: {
          where: { userId }
        }
      }
    });

    if (!coupon) {
      return {
        isValid: false,
        message: '존재하지 않는 쿠폰입니다.'
      };
    }

    // 활성화 상태 확인
    if (!coupon.isActive) {
      return {
        isValid: false,
        message: '사용할 수 없는 쿠폰입니다.'
      };
    }

    // 유효 기간 확인
    const now = new Date();
    if (now < coupon.validFrom || now > coupon.validUntil) {
      return {
        isValid: false,
        message: '쿠폰 유효 기간이 아닙니다.'
      };
    }

    // 사용 한도 확인
    if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
      return {
        isValid: false,
        message: '쿠폰 사용 한도를 초과했습니다.'
      };
    }

    // 사용자별 사용 한도 확인
    const userUsageCount = coupon.usages.length;
    if (userUsageCount >= coupon.perUserLimit) {
      return {
        isValid: false,
        message: '이미 사용한 쿠폰입니다.'
      };
    }

    // 최소 주문 금액 확인
    if (coupon.minOrderAmount && orderAmount < parseFloat(coupon.minOrderAmount.toString())) {
      return {
        isValid: false,
        message: `최소 주문 금액 ${coupon.minOrderAmount.toLocaleString()}원 이상에서 사용 가능합니다.`
      };
    }

    // 적용 가능 카테고리/상품 확인
    if (!this.checkApplicableItems(coupon, items)) {
      return {
        isValid: false,
        message: '해당 상품에는 사용할 수 없는 쿠폰입니다.'
      };
    }

    // 할인 금액 계산
    const { discountAmount, finalAmount } = this.calculateDiscount(
      coupon, 
      orderAmount, 
      shippingFee
    );

    return {
      isValid: true,
      discountAmount,
      finalAmount,
      message: '쿠폰이 적용되었습니다.'
    };
  }

  // 쿠폰 사용
  async useCoupon(
    userId: string, 
    orderId: string, 
    couponCode: string,
    discountAmount: number
  ) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { code: couponCode }
    });

    if (!coupon) {
      throw new Error('쿠폰을 찾을 수 없습니다.');
    }

    // 쿠폰 사용 기록
    await this.prisma.couponUsage.create({
      data: {
        couponId: coupon.id,
        userId,
        orderId,
        discountAmount
      }
    });

    // 사용 횟수 증가
    await this.prisma.coupon.update({
      where: { id: coupon.id },
      data: {
        usageCount: { increment: 1 }
      }
    });

    // 캐시 무효화
    await this.invalidateCouponCache(couponCode);

    await auditLogService.log('coupon_used', userId, {
      couponId: coupon.id,
      orderId,
      discountAmount
    });
  }

  // 사용자 쿠폰 목록
  async getUserCoupons(userId: string, query: CouponQueryDto): Promise<{
    coupons: UserCoupon[];
    pagination: any;
  }> {
    const { page = 1, limit = 20, type, isActive = true, isValid = true } = query;
    const offset = (page - 1) * limit;

    // 기본 쿠폰 조건
    const where: any = {
      isActive
    };

    if (type) where.type = type;

    if (isValid) {
      const now = new Date();
      where.validFrom = { lte: now };
      where.validUntil = { gte: now };
    }

    // 사용자가 사용 가능한 쿠폰 조회
    const [coupons, total] = await Promise.all([
      this.prisma.coupon.findMany({
        where: {
          ...where,
          OR: [
            { type: CouponType.PUBLIC },
            { 
              type: CouponType.PRIVATE,
              usages: {
                none: { userId }
              }
            }
          ]
        },
        include: {
          usages: {
            where: { userId }
          }
        },
        skip: offset,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.coupon.count({ where })
    ]);

    // 사용자별 쿠폰 정보 가공
    const userCoupons: UserCoupon[] = coupons.map(coupon => {
      const usageCount = coupon.usages.length;
      const remainingUses = coupon.perUserLimit - usageCount;
      const now = new Date();
      const expiresIn = Math.floor((coupon.validUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      return {
        coupon,
        usageCount,
        remainingUses,
        isEligible: remainingUses > 0 && (!coupon.usageLimit || coupon.usageCount < coupon.usageLimit),
        expiresIn: expiresIn > 0 ? expiresIn : 0
      };
    });

    return {
      coupons: userCoupons,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  // 신규 가입 쿠폰 발급
  async issueWelcomeCoupon(userId: string) {
    // 웰컴 쿠폰 템플릿 조회
    const welcomeCoupons = await this.prisma.coupon.findMany({
      where: {
        type: CouponType.WELCOME,
        isActive: true,
        validFrom: { lte: new Date() },
        validUntil: { gte: new Date() }
      }
    });

    for (const template of welcomeCoupons) {
      // 개인 쿠폰 생성
      const personalCode = `${template.code}_${userId.substring(0, 8)}_${Date.now()}`;
      
      await this.createCoupon({
        ...template,
        code: personalCode,
        type: CouponType.PRIVATE,
        name: `[신규가입] ${template.name}`,
        perUserLimit: 1,
        metadata: {
          ...template.metadata,
          issuedTo: userId,
          templateId: template.id
        }
      });

      // 알림 발송
      await notificationService.sendNotification(userId, {
        type: 'COUPON_ISSUED',
        title: '신규 가입 쿠폰이 발급되었습니다!',
        message: `${template.name} 쿠폰을 확인해보세요.`,
        data: { couponCode: personalCode }
      });
    }
  }

  // 생일 쿠폰 발급
  async issueBirthdayCoupons() {
    const today = new Date();
    const month = today.getMonth() + 1;
    const day = today.getDate();

    // 오늘이 생일인 사용자 조회
    const birthdayUsers = await this.prisma.user.findMany({
      where: {
        birthDate: {
          not: null
        }
      }
    });

    const todayBirthdayUsers = birthdayUsers.filter(user => {
      const birthDate = new Date(user.birthDate!);
      return birthDate.getMonth() + 1 === month && birthDate.getDate() === day;
    });

    // 생일 쿠폰 템플릿
    const birthdayTemplate = await this.prisma.coupon.findFirst({
      where: {
        type: CouponType.BIRTHDAY,
        isActive: true
      }
    });

    if (!birthdayTemplate) return;

    for (const user of todayBirthdayUsers) {
      const personalCode = `BIRTHDAY_${user.id.substring(0, 8)}_${today.getFullYear()}`;
      
      try {
        await this.createCoupon({
          ...birthdayTemplate,
          code: personalCode,
          type: CouponType.PRIVATE,
          name: `[생일축하] ${birthdayTemplate.name}`,
          validFrom: today,
          validUntil: new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000), // 30일
          perUserLimit: 1,
          metadata: {
            ...birthdayTemplate.metadata,
            issuedTo: user.id,
            birthdayYear: today.getFullYear()
          }
        });

        await notificationService.sendNotification(user.id, {
          type: 'COUPON_ISSUED',
          title: '🎂 생일 축하 쿠폰이 도착했습니다!',
          message: '특별한 날을 위한 쿠폰을 확인해보세요.',
          data: { couponCode: personalCode }
        });
      } catch (error) {
        console.error(`Birthday coupon issue failed for user ${user.id}:`, error);
      }
    }
  }

  // 쿠폰 통계
  async getCouponStatistics(couponId: string) {
    const [coupon, usages] = await Promise.all([
      this.prisma.coupon.findUnique({
        where: { id: couponId }
      }),
      this.prisma.couponUsage.findMany({
        where: { couponId },
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

    if (!coupon) {
      throw new Error('쿠폰을 찾을 수 없습니다.');
    }

    const totalDiscountAmount = usages.reduce((sum, usage) => 
      sum + parseFloat(usage.discountAmount.toString()), 0
    );

    const completedOrders = usages.filter(u => 
      u.order.status === 'DELIVERED' || u.order.status === 'COMPLETED'
    );

    const totalRevenue = completedOrders.reduce((sum, usage) => 
      sum + parseFloat(usage.order.totalAmount.toString()), 0
    );

    return {
      coupon,
      statistics: {
        totalUsageCount: usages.length,
        uniqueUserCount: new Set(usages.map(u => u.userId)).size,
        totalDiscountAmount,
        averageDiscountAmount: usages.length > 0 ? totalDiscountAmount / usages.length : 0,
        totalRevenue,
        conversionRate: coupon.usageCount > 0 ? completedOrders.length / coupon.usageCount : 0,
        remainingUses: coupon.usageLimit ? coupon.usageLimit - coupon.usageCount : null
      }
    };
  }

  // 적용 가능 상품 확인
  private checkApplicableItems(coupon: any, items: any[]): boolean {
    const applicableCategories = coupon.applicableCategories as string[] || [];
    const applicableProducts = coupon.applicableProducts as string[] || [];
    const excludedProducts = coupon.excludedProducts as string[] || [];

    // 제외 상품 확인
    if (excludedProducts.length > 0) {
      const hasExcluded = items.some(item => excludedProducts.includes(item.productId));
      if (hasExcluded) return false;
    }

    // 적용 가능 상품/카테고리가 지정된 경우
    if (applicableProducts.length > 0 || applicableCategories.length > 0) {
      return items.some(item => 
        applicableProducts.includes(item.productId) ||
        applicableCategories.includes(item.categoryId)
      );
    }

    return true;
  }

  // 할인 금액 계산
  private calculateDiscount(
    coupon: any, 
    orderAmount: number, 
    shippingFee: number
  ): { discountAmount: number; finalAmount: number } {
    let discountAmount = 0;

    switch (coupon.discountType) {
      case DiscountType.PERCENTAGE:
        discountAmount = orderAmount * (parseFloat(coupon.discountValue.toString()) / 100);
        if (coupon.maxDiscount) {
          discountAmount = Math.min(discountAmount, parseFloat(coupon.maxDiscount.toString()));
        }
        break;

      case DiscountType.FIXED:
        discountAmount = parseFloat(coupon.discountValue.toString());
        break;

      case DiscountType.FREE_SHIPPING:
        discountAmount = shippingFee;
        break;
    }

    discountAmount = Math.min(discountAmount, orderAmount + shippingFee);
    const finalAmount = orderAmount + shippingFee - discountAmount;

    return { discountAmount, finalAmount };
  }

  // 캐시 무효화
  private async invalidateCouponCache(couponCode: string) {
    await cacheService.delete(`coupon:${couponCode}`);
    await cacheService.delete(`coupon:list:*`);
  }

  // 쿠폰 삭제
  async deleteCoupon(couponId: string) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { id: couponId },
      include: { usages: true }
    });

    if (!coupon) {
      throw new Error('쿠폰을 찾을 수 없습니다.');
    }

    if (coupon.usages.length > 0) {
      throw new Error('사용 이력이 있는 쿠폰은 삭제할 수 없습니다.');
    }

    await this.prisma.coupon.delete({
      where: { id: couponId }
    });

    await this.invalidateCouponCache(coupon.code);

    await auditLogService.log('coupon_deleted', 'admin', {
      couponId,
      code: coupon.code
    });
  }

  // 대량 쿠폰 생성
  async createBulkCoupons(
    template: CreateCouponDto, 
    count: number, 
    prefix: string
  ): Promise<string[]> {
    const codes: string[] = [];

    for (let i = 0; i < count; i++) {
      const code = `${prefix}_${this.generateRandomCode(8)}`;
      
      try {
        const coupon = await this.createCoupon({
          ...template,
          code,
          type: CouponType.PRIVATE
        });
        
        codes.push(coupon.code);
      } catch (error) {
        console.error(`Failed to create coupon ${code}:`, error);
      }
    }

    return codes;
  }

  // 랜덤 코드 생성
  private generateRandomCode(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return result;
  }
}

export const couponService = new CouponService();