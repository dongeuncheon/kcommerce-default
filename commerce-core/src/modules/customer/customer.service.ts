import { CustomerRepository } from './customer.repository';
import { 
  Customer, 
  CustomerFilter, 
  CustomerSort, 
  CustomerListResponse,
  CustomerAddress,
  CustomerLoyaltyPoints,
  CustomerTier,
  CustomerSegment,
  CustomerAnalytics,
  CustomerPurchaseBehavior,
  CreateCustomerDto,
  UpdateCustomerDto,
  CreateAddressDto,
  UpdateAddressDto,
  AddLoyaltyPointsDto
} from './customer.types';

export class CustomerService {
  constructor(private customerRepository: CustomerRepository) {}

  // Customer CRUD operations
  async createCustomer(data: CreateCustomerDto): Promise<Customer> {
    // Validate email uniqueness
    const existingByEmail = await this.customerRepository.findByEmail(data.email);
    if (existingByEmail) {
      throw new Error('이미 등록된 이메일입니다.');
    }

    // Validate phone uniqueness
    const existingByPhone = await this.customerRepository.findByPhone(data.phone);
    if (existingByPhone) {
      throw new Error('이미 등록된 전화번호입니다.');
    }

    // Validate Korean phone number format
    if (!this.isValidKoreanPhone(data.phone)) {
      throw new Error('올바른 한국 전화번호 형식이 아닙니다.');
    }

    // Create customer
    const customer = await this.customerRepository.create(data);

    // Generate welcome points
    await this.addLoyaltyPoints(customer.id, {
      points: 1000,
      transactionType: 'earned',
      transactionAmount: 0,
      description: '회원가입 축하 포인트'
    });

    return customer;
  }

  async getCustomerById(id: string): Promise<Customer | null> {
    return this.customerRepository.findById(id);
  }

  async getCustomerByEmail(email: string): Promise<Customer | null> {
    return this.customerRepository.findByEmail(email);
  }

  async getCustomerByPhone(phone: string): Promise<Customer | null> {
    return this.customerRepository.findByPhone(phone);
  }

  async updateCustomer(id: string, data: UpdateCustomerDto): Promise<Customer | null> {
    // Validate email uniqueness if email is being updated
    if (data.email) {
      const existingByEmail = await this.customerRepository.findByEmail(data.email);
      if (existingByEmail && existingByEmail.id !== id) {
        throw new Error('이미 등록된 이메일입니다.');
      }
    }

    // Validate phone uniqueness if phone is being updated
    if (data.phone) {
      if (!this.isValidKoreanPhone(data.phone)) {
        throw new Error('올바른 한국 전화번호 형식이 아닙니다.');
      }
      
      const existingByPhone = await this.customerRepository.findByPhone(data.phone);
      if (existingByPhone && existingByPhone.id !== id) {
        throw new Error('이미 등록된 전화번호입니다.');
      }
    }

    const customer = await this.customerRepository.update(id, data);
    
    if (customer) {
      // Update tier and segments after profile update
      await this.updateCustomerTierAndSegments(id);
    }

    return customer;
  }

  async deactivateCustomer(id: string): Promise<boolean> {
    const result = await this.customerRepository.update(id, { isActive: false });
    return !!result;
  }

  async deleteCustomer(id: string): Promise<boolean> {
    return this.customerRepository.delete(id);
  }

  async getCustomers(
    filter: CustomerFilter = {}, 
    sort: CustomerSort = { field: 'createdAt', direction: 'desc' },
    page: number = 1,
    limit: number = 20
  ): Promise<CustomerListResponse> {
    return this.customerRepository.findMany(filter, sort, page, limit);
  }

  // Address management
  async addAddress(customerId: string, data: CreateAddressDto): Promise<CustomerAddress> {
    // Validate customer exists
    const customer = await this.customerRepository.findById(customerId);
    if (!customer) {
      throw new Error('고객을 찾을 수 없습니다.');
    }

    // Validate Korean address format
    if (!this.isValidKoreanZipCode(data.zipCode)) {
      throw new Error('올바른 우편번호 형식이 아닙니다.');
    }

    if (!this.isValidKoreanPhone(data.recipientPhone)) {
      throw new Error('올바른 전화번호 형식이 아닙니다.');
    }

    return this.customerRepository.createAddress(customerId, data);
  }

  async getCustomerAddresses(customerId: string): Promise<CustomerAddress[]> {
    return this.customerRepository.findAddressesByCustomerId(customerId);
  }

  async getAddressById(id: string): Promise<CustomerAddress | null> {
    return this.customerRepository.findAddressById(id);
  }

  async updateAddress(id: string, data: UpdateAddressDto): Promise<CustomerAddress | null> {
    // Validate data if provided
    if (data.zipCode && !this.isValidKoreanZipCode(data.zipCode)) {
      throw new Error('올바른 우편번호 형식이 아닙니다.');
    }

    if (data.recipientPhone && !this.isValidKoreanPhone(data.recipientPhone)) {
      throw new Error('올바른 전화번호 형식이 아닙니다.');
    }

    return this.customerRepository.updateAddress(id, data);
  }

  async deleteAddress(id: string): Promise<boolean> {
    return this.customerRepository.deleteAddress(id);
  }

  async setDefaultAddress(customerId: string, addressId: string): Promise<CustomerAddress | null> {
    // Verify address belongs to customer
    const address = await this.customerRepository.findAddressById(addressId);
    if (!address || address.customerId !== customerId) {
      throw new Error('주소를 찾을 수 없거나 권한이 없습니다.');
    }

    return this.customerRepository.updateAddress(addressId, { isDefault: true });
  }

  // Loyalty points management
  async addLoyaltyPoints(customerId: string, data: AddLoyaltyPointsDto): Promise<CustomerLoyaltyPoints> {
    // Validate customer exists
    const customer = await this.customerRepository.findById(customerId);
    if (!customer) {
      throw new Error('고객을 찾을 수 없습니다.');
    }

    // Validate points amount
    if (data.points <= 0) {
      throw new Error('포인트는 0보다 커야 합니다.');
    }

    return this.customerRepository.addLoyaltyPoints(customerId, data);
  }

  async getCustomerLoyaltyPoints(customerId: string): Promise<CustomerLoyaltyPoints[]> {
    return this.customerRepository.findLoyaltyPointsByCustomerId(customerId);
  }

  async redeemLoyaltyPoints(customerId: string, points: number, description: string): Promise<CustomerLoyaltyPoints> {
    const customer = await this.customerRepository.findById(customerId);
    if (!customer) {
      throw new Error('고객을 찾을 수 없습니다.');
    }

    if (customer.statistics.loyaltyPoints < points) {
      throw new Error('보유 포인트가 부족합니다.');
    }

    return this.customerRepository.addLoyaltyPoints(customerId, {
      points,
      transactionType: 'redeemed',
      transactionAmount: points,
      description
    });
  }

  // Customer tier and segmentation
  async getTiers(): Promise<CustomerTier[]> {
    return this.customerRepository.findTiers();
  }

  async getSegments(): Promise<CustomerSegment[]> {
    return this.customerRepository.findSegments();
  }

  async updateCustomerTierAndSegments(customerId: string): Promise<void> {
    await Promise.all([
      this.customerRepository.updateCustomerTier(customerId),
      this.customerRepository.updateCustomerSegments(customerId)
    ]);
  }

  async bulkUpdateTiersAndSegments(): Promise<void> {
    const customers = await this.customerRepository.findMany({}, { field: 'id', direction: 'asc' }, 1, 1000);
    
    for (const customer of customers.customers) {
      await this.updateCustomerTierAndSegments(customer.id);
    }
  }

  // Analytics and insights
  async getCustomerAnalytics(): Promise<CustomerAnalytics> {
    return this.customerRepository.getAnalytics();
  }

  async getCustomerPurchaseBehavior(customerId: string): Promise<CustomerPurchaseBehavior | null> {
    return this.customerRepository.getPurchaseBehavior(customerId);
  }

  async getCustomerStatistics(customerId: string): Promise<any> {
    const customer = await this.customerRepository.findById(customerId);
    if (!customer) {
      throw new Error('고객을 찾을 수 없습니다.');
    }

    return customer.statistics;
  }

  // Customer service features
  async addCustomerNote(customerId: string, note: string, isInternal: boolean = false): Promise<Customer | null> {
    const customer = await this.customerRepository.findById(customerId);
    if (!customer) {
      throw new Error('고객을 찾을 수 없습니다.');
    }

    const noteWithTimestamp = `${new Date().toISOString()}: ${note}`;
    
    if (isInternal) {
      customer.internalNotes.push(noteWithTimestamp);
      return this.customerRepository.update(customerId, { internalNotes: customer.internalNotes });
    } else {
      customer.notes.push(noteWithTimestamp);
      return this.customerRepository.update(customerId, { notes: customer.notes });
    }
  }

  async updateCustomerPriority(customerId: string, priority: 'low' | 'normal' | 'high' | 'vip'): Promise<Customer | null> {
    return this.customerRepository.update(customerId, { priority });
  }

  async addCustomerTags(customerId: string, tags: string[]): Promise<Customer | null> {
    const customer = await this.customerRepository.findById(customerId);
    if (!customer) {
      throw new Error('고객을 찾을 수 없습니다.');
    }

    const newTags = [...new Set([...customer.tags, ...tags])];
    return this.customerRepository.update(customerId, { tags: newTags });
  }

  async removeCustomerTags(customerId: string, tags: string[]): Promise<Customer | null> {
    const customer = await this.customerRepository.findById(customerId);
    if (!customer) {
      throw new Error('고객을 찾을 수 없습니다.');
    }

    const newTags = customer.tags.filter(tag => !tags.includes(tag));
    return this.customerRepository.update(customerId, { tags: newTags });
  }

  // Marketing features
  async updateMarketingPreferences(customerId: string, preferences: any): Promise<Customer | null> {
    return this.customerRepository.update(customerId, { marketingPreferences: preferences });
  }

  async getMarketingEligibleCustomers(criteria: any): Promise<Customer[]> {
    const filter: CustomerFilter = {
      isActive: true
    };

    if (criteria.segments) {
      filter.segments = criteria.segments;
    }
    if (criteria.tags) {
      filter.tags = criteria.tags;
    }
    if (criteria.tier) {
      filter.tierId = criteria.tier;
    }
    if (criteria.minSpent) {
      filter.minTotalSpent = criteria.minSpent;
    }
    if (criteria.maxSpent) {
      filter.maxTotalSpent = criteria.maxSpent;
    }

    const result = await this.customerRepository.findMany(filter, { field: 'createdAt', direction: 'desc' }, 1, 10000);
    
    // Filter by marketing consent
    return result.customers.filter(customer => {
      if (criteria.channel === 'email') return customer.marketingPreferences.email;
      if (criteria.channel === 'sms') return customer.marketingPreferences.sms;
      if (criteria.channel === 'push') return customer.marketingPreferences.push;
      return customer.marketingPreferences.marketing;
    });
  }

  // Validation helpers
  private isValidKoreanPhone(phone: string): boolean {
    // Korean phone number patterns
    const patterns = [
      /^01[016789]-?\d{3,4}-?\d{4}$/, // Mobile
      /^02-?\d{3,4}-?\d{4}$/, // Seoul landline
      /^0[3-6]\d-?\d{3,4}-?\d{4}$/, // Other area landlines
      /^070-?\d{4}-?\d{4}$/, // VoIP
      /^1588-?\d{4}$/, // Customer service
      /^080-?\d{3}-?\d{4}$/ // Toll-free
    ];

    return patterns.some(pattern => pattern.test(phone.replace(/\s/g, '')));
  }

  private isValidKoreanZipCode(zipCode: string): boolean {
    // Korean zip code format: 5 digits (new format since 2015)
    return /^\d{5}$/.test(zipCode);
  }

  // Data export and import
  async exportCustomers(filter: CustomerFilter = {}): Promise<any[]> {
    const result = await this.customerRepository.findMany(filter, { field: 'createdAt', direction: 'desc' }, 1, 10000);
    
    return result.customers.map(customer => ({
      id: customer.id,
      email: customer.email,
      phone: customer.phone,
      name: `${customer.firstName} ${customer.lastName}`,
      koreanName: customer.koreanName,
      tier: customer.tier?.name,
      totalSpent: customer.statistics.totalSpent,
      totalOrders: customer.statistics.totalOrders,
      loyaltyPoints: customer.statistics.loyaltyPoints,
      isActive: customer.isActive,
      createdAt: customer.createdAt,
      lastOrderDate: customer.statistics.lastOrderDate
    }));
  }

  async importCustomers(customers: CreateCustomerDto[]): Promise<{ success: number; errors: string[] }> {
    let success = 0;
    const errors: string[] = [];

    for (const customerData of customers) {
      try {
        await this.createCustomer(customerData);
        success++;
      } catch (error) {
        errors.push(`${customerData.email}: ${error.message}`);
      }
    }

    return { success, errors };
  }

  // Customer lifecycle management
  async markCustomerAsChurned(customerId: string): Promise<Customer | null> {
    return this.addCustomerTags(customerId, ['churned']);
  }

  async reactivateCustomer(customerId: string): Promise<Customer | null> {
    const customer = await this.customerRepository.update(customerId, { isActive: true });
    if (customer) {
      await this.removeCustomerTags(customerId, ['churned']);
      await this.addLoyaltyPoints(customerId, {
        points: 500,
        transactionType: 'earned',
        transactionAmount: 0,
        description: '재가입 축하 포인트'
      });
    }
    return customer;
  }

  async calculateCustomerLifetimeValue(customerId: string): Promise<number> {
    const customer = await this.customerRepository.findById(customerId);
    if (!customer) return 0;

    // Basic LTV calculation: average order value * order frequency * customer lifespan
    const averageOrderValue = customer.statistics.averageOrderValue;
    const totalOrders = customer.statistics.totalOrders;
    const daysSinceRegistration = customer.statistics.daysSinceRegistration;
    
    if (totalOrders === 0 || daysSinceRegistration === 0) return 0;

    const orderFrequency = totalOrders / (daysSinceRegistration / 30); // Orders per month
    const estimatedLifespan = 24; // Assume 24 months average lifespan

    return averageOrderValue * orderFrequency * estimatedLifespan;
  }

  async predictCustomerChurn(customerId: string): Promise<{ risk: 'low' | 'medium' | 'high'; factors: string[] }> {
    const customer = await this.customerRepository.findById(customerId);
    if (!customer) {
      return { risk: 'low', factors: [] };
    }

    const factors: string[] = [];
    let riskScore = 0;

    // Days since last order
    if (customer.statistics.daysSinceLastOrder) {
      if (customer.statistics.daysSinceLastOrder > 90) {
        factors.push('장기간 주문 없음');
        riskScore += 3;
      } else if (customer.statistics.daysSinceLastOrder > 60) {
        factors.push('최근 주문 감소');
        riskScore += 2;
      }
    }

    // Order frequency decline
    if (customer.statistics.totalOrders < 2) {
      factors.push('낮은 주문 빈도');
      riskScore += 2;
    }

    // Low engagement
    if (!customer.marketingPreferences.email && !customer.marketingPreferences.sms) {
      factors.push('마케팅 수신 거부');
      riskScore += 1;
    }

    // No loyalty points usage
    if (customer.statistics.loyaltyPoints > 1000) {
      factors.push('포인트 미사용');
      riskScore += 1;
    }

    const risk = riskScore >= 5 ? 'high' : riskScore >= 3 ? 'medium' : 'low';
    return { risk, factors };
  }
}