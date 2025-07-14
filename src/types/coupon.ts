export interface CreateCouponDto {
  code: string;
  name: string;
  description?: string;
  type: CouponType;
  discountType: DiscountType;
  discountValue: number;
  minOrderAmount?: number;
  maxDiscount?: number;
  applicableCategories?: string[];
  applicableProducts?: string[];
  excludedProducts?: string[];
  usageLimit?: number;
  perUserLimit?: number;
  validFrom: Date;
  validUntil: Date;
  isActive?: boolean;
  metadata?: any;
}

export interface UpdateCouponDto {
  name?: string;
  description?: string;
  minOrderAmount?: number;
  maxDiscount?: number;
  applicableCategories?: string[];
  applicableProducts?: string[];
  excludedProducts?: string[];
  usageLimit?: number;
  perUserLimit?: number;
  validFrom?: Date;
  validUntil?: Date;
  isActive?: boolean;
  metadata?: any;
}

export enum CouponType {
  PUBLIC = 'PUBLIC',
  PRIVATE = 'PRIVATE',
  WELCOME = 'WELCOME',
  BIRTHDAY = 'BIRTHDAY',
  REWARD = 'REWARD',
  EVENT = 'EVENT'
}

export enum DiscountType {
  PERCENTAGE = 'PERCENTAGE',
  FIXED = 'FIXED',
  FREE_SHIPPING = 'FREE_SHIPPING'
}

export interface CouponValidationResult {
  isValid: boolean;
  message?: string;
  discountAmount?: number;
  finalAmount?: number;
}

export interface ApplyCouponDto {
  couponCode: string;
  orderAmount: number;
  shippingFee?: number;
  items?: Array<{
    productId: string;
    categoryId: string;
    price: number;
    quantity: number;
  }>;
}

export interface CouponQueryDto {
  page?: number;
  limit?: number;
  type?: CouponType;
  isActive?: boolean;
  isValid?: boolean;
  userId?: string;
}

export interface UserCoupon {
  coupon: any;
  usageCount: number;
  remainingUses: number;
  isEligible: boolean;
  expiresIn?: number;
}