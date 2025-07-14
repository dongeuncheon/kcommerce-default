export interface CustomerAddress {
  id: string;
  customerId: string;
  type: 'home' | 'work' | 'shipping' | 'billing';
  isDefault: boolean;
  
  // Korean address fields
  zipCode: string;
  address1: string; // 기본 주소
  address2?: string; // 상세 주소
  city: string; // 시/도
  district: string; // 시/군/구
  neighborhood?: string; // 동/읍/면
  
  // Additional fields
  recipientName: string;
  recipientPhone: string;
  deliveryNote?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomerLoyaltyPoints {
  id: string;
  customerId: string;
  points: number;
  transactionType: 'earned' | 'redeemed' | 'expired' | 'adjusted';
  transactionAmount: number;
  orderId?: string;
  description: string;
  expiresAt?: Date;
  createdAt: Date;
}

export interface CustomerTier {
  id: string;
  name: string;
  nameKo: string;
  minSpent: number;
  maxSpent?: number;
  benefits: string[];
  discountPercentage: number;
  pointsMultiplier: number;
  color: string;
  priority: number;
}

export interface CustomerSegment {
  id: string;
  name: string;
  nameKo: string;
  description: string;
  criteria: {
    minOrderCount?: number;
    maxOrderCount?: number;
    minTotalSpent?: number;
    maxTotalSpent?: number;
    registeredDaysAgo?: number;
    lastOrderDaysAgo?: number;
    categories?: string[];
    tags?: string[];
  };
  color: string;
}

export interface CustomerMarketingPreferences {
  email: boolean;
  sms: boolean;
  push: boolean;
  directMail: boolean;
  marketing: boolean;
  
  // Korean privacy compliance
  personalInfoConsent: boolean;
  marketingConsent: boolean;
  thirdPartyConsent: boolean;
  consentDate: Date;
  consentIp?: string;
}

export interface CustomerStatistics {
  totalOrders: number;
  totalSpent: number;
  averageOrderValue: number;
  lastOrderDate?: Date;
  firstOrderDate?: Date;
  lifetimeValue: number;
  loyaltyPoints: number;
  preferredCategories: string[];
  returnRate: number;
  cancelationRate: number;
  daysSinceLastOrder?: number;
  daysSinceRegistration: number;
}

export interface Customer {
  id: string;
  email: string;
  phone: string;
  
  // Personal information
  firstName: string;
  lastName: string;
  koreanName?: string; // 한글명
  dateOfBirth?: Date;
  gender?: 'male' | 'female' | 'other';
  
  // Account information
  isActive: boolean;
  isVerified: boolean;
  emailVerified: boolean;
  phoneVerified: boolean;
  
  // Tier and segmentation
  tierId?: string;
  tier?: CustomerTier;
  segments: string[];
  tags: string[];
  
  // Marketing and preferences
  marketingPreferences: CustomerMarketingPreferences;
  language: string;
  timezone: string;
  currency: string;
  
  // Customer service
  notes: string[];
  internalNotes: string[];
  priority: 'low' | 'normal' | 'high' | 'vip';
  
  // Relationships
  addresses: CustomerAddress[];
  loyaltyPoints: CustomerLoyaltyPoints[];
  statistics: CustomerStatistics;
  
  // Metadata
  source: string; // 가입 경로
  referralCode?: string;
  referredBy?: string;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCustomerDto {
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  koreanName?: string;
  dateOfBirth?: Date;
  gender?: 'male' | 'female' | 'other';
  language?: string;
  timezone?: string;
  currency?: string;
  source?: string;
  referralCode?: string;
  marketingPreferences?: Partial<CustomerMarketingPreferences>;
}

export interface UpdateCustomerDto {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  koreanName?: string;
  dateOfBirth?: Date;
  gender?: 'male' | 'female' | 'other';
  language?: string;
  timezone?: string;
  currency?: string;
  tags?: string[];
  priority?: 'low' | 'normal' | 'high' | 'vip';
  isActive?: boolean;
  marketingPreferences?: Partial<CustomerMarketingPreferences>;
}

export interface CreateAddressDto {
  type: 'home' | 'work' | 'shipping' | 'billing';
  isDefault?: boolean;
  zipCode: string;
  address1: string;
  address2?: string;
  city: string;
  district: string;
  neighborhood?: string;
  recipientName: string;
  recipientPhone: string;
  deliveryNote?: string;
}

export interface UpdateAddressDto extends Partial<CreateAddressDto> {}

export interface AddLoyaltyPointsDto {
  points: number;
  transactionType: 'earned' | 'redeemed' | 'expired' | 'adjusted';
  transactionAmount: number;
  orderId?: string;
  description: string;
  expiresAt?: Date;
}

export interface CustomerFilter {
  search?: string;
  email?: string;
  phone?: string;
  isActive?: boolean;
  isVerified?: boolean;
  tierId?: string;
  segments?: string[];
  tags?: string[];
  priority?: 'low' | 'normal' | 'high' | 'vip';
  registeredAfter?: Date;
  registeredBefore?: Date;
  lastOrderAfter?: Date;
  lastOrderBefore?: Date;
  minTotalSpent?: number;
  maxTotalSpent?: number;
  minOrderCount?: number;
  maxOrderCount?: number;
  hasEmail?: boolean;
  hasPhone?: boolean;
  source?: string;
  language?: string;
  city?: string;
  district?: string;
}

export interface CustomerSort {
  field: 'createdAt' | 'updatedAt' | 'lastOrderDate' | 'totalSpent' | 'totalOrders' | 'firstName' | 'lastName' | 'email';
  direction: 'asc' | 'desc';
}

export interface CustomerListResponse {
  customers: Customer[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CustomerAnalytics {
  totalCustomers: number;
  activeCustomers: number;
  newCustomersThisMonth: number;
  newCustomersLastMonth: number;
  averageLifetimeValue: number;
  averageOrderValue: number;
  topSegments: Array<{
    segmentId: string;
    name: string;
    count: number;
    percentage: number;
  }>;
  tierDistribution: Array<{
    tierId: string;
    name: string;
    count: number;
    percentage: number;
  }>;
  geographicDistribution: Array<{
    city: string;
    district: string;
    count: number;
    percentage: number;
  }>;
  acquisitionSources: Array<{
    source: string;
    count: number;
    percentage: number;
  }>;
  monthlyRegistrations: Array<{
    month: string;
    count: number;
  }>;
  retentionRates: {
    oneMonth: number;
    threeMonths: number;
    sixMonths: number;
    oneYear: number;
  };
}

export interface CustomerPurchaseBehavior {
  customerId: string;
  favoriteCategories: Array<{
    categoryId: string;
    categoryName: string;
    orderCount: number;
    totalSpent: number;
    percentage: number;
  }>;
  purchasePatterns: {
    averageDaysBetweenOrders: number;
    mostActiveDay: string;
    mostActiveHour: number;
    seasonalPreferences: Array<{
      season: string;
      orderCount: number;
      totalSpent: number;
    }>;
  };
  pricePreferences: {
    averageOrderValue: number;
    preferredPriceRange: {
      min: number;
      max: number;
    };
    discountSensitivity: number;
  };
  loyaltyIndicators: {
    repeatPurchaseRate: number;
    brandLoyaltyScore: number;
    churnRisk: 'low' | 'medium' | 'high';
    nextOrderPrediction: Date | null;
  };
}

export interface CustomerServiceTicket {
  id: string;
  customerId: string;
  subject: string;
  description: string;
  status: 'open' | 'pending' | 'resolved' | 'closed';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  category: string;
  assignedTo?: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
}

export interface MarketingCampaignTracking {
  customerId: string;
  campaignId: string;
  campaignName: string;
  channel: 'email' | 'sms' | 'push' | 'direct_mail';
  sentAt: Date;
  openedAt?: Date;
  clickedAt?: Date;
  convertedAt?: Date;
  orderId?: string;
  revenue?: number;
}