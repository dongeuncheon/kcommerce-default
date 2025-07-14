export interface CreatePromotionDto {
  name: string;
  description?: string;
  type: PromotionType;
  priority?: number;
  conditions: PromotionConditions;
  actions: PromotionActions;
  targetCustomerGroups?: string[];
  targetCategories?: string[];
  targetProducts?: string[];
  startDate: Date;
  endDate: Date;
  isActive?: boolean;
  isExclusive?: boolean;
  metadata?: any;
}

export interface UpdatePromotionDto {
  name?: string;
  description?: string;
  priority?: number;
  conditions?: PromotionConditions;
  actions?: PromotionActions;
  targetCustomerGroups?: string[];
  targetCategories?: string[];
  targetProducts?: string[];
  startDate?: Date;
  endDate?: Date;
  isActive?: boolean;
  isExclusive?: boolean;
  metadata?: any;
}

export enum PromotionType {
  DISCOUNT = 'DISCOUNT',
  BUNDLE = 'BUNDLE',
  BOGO = 'BOGO',
  FREE_GIFT = 'FREE_GIFT',
  TIERED_DISCOUNT = 'TIERED_DISCOUNT',
  FLASH_SALE = 'FLASH_SALE',
  MEMBER_ONLY = 'MEMBER_ONLY'
}

export interface PromotionConditions {
  minOrderAmount?: number;
  minQuantity?: number;
  maxQuantity?: number;
  customerGroups?: string[];
  productIds?: string[];
  categoryIds?: string[];
  paymentMethods?: string[];
  timeSlots?: Array<{
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  }>;
  customRules?: Array<{
    field: string;
    operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains';
    value: any;
  }>;
}

export interface PromotionActions {
  discountType?: 'percentage' | 'fixed' | 'tiered';
  discountValue?: number;
  discountTiers?: Array<{
    minAmount: number;
    discountValue: number;
  }>;
  bundleProducts?: Array<{
    productId: string;
    quantity: number;
    discountPercentage: number;
  }>;
  freeProducts?: Array<{
    productId: string;
    quantity: number;
  }>;
  freeShipping?: boolean;
  pointMultiplier?: number;
  customActions?: any;
}

export interface PromotionEvaluationResult {
  applicable: boolean;
  promotions: Array<{
    id: string;
    name: string;
    type: PromotionType;
    discountAmount: number;
    freeProducts?: any[];
    message?: string;
  }>;
  totalDiscount: number;
  finalAmount: number;
}

export interface PromotionQueryDto {
  page?: number;
  limit?: number;
  type?: PromotionType;
  isActive?: boolean;
  targetCustomerGroup?: string;
  targetCategory?: string;
  targetProduct?: string;
}

export interface PromotionStatistics {
  promotionId: string;
  usageCount: number;
  totalDiscountAmount: number;
  averageOrderValue: number;
  conversionRate: number;
  revenue: number;
  roi: number;
}