import { BaseRepository } from '../../core/repository/base.repository';
import { DatabaseAdapter } from '../../adapters/database.adapter';
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
import { 
  CustomerEntity, 
  CustomerAddressEntity, 
  CustomerLoyaltyPointsEntity,
  CustomerTierEntity,
  CustomerSegmentEntity
} from './customer.entity';

export class CustomerRepository extends BaseRepository<CustomerEntity> {
  constructor(adapter: DatabaseAdapter) {
    super(adapter, 'customers');
  }

  async create(data: CreateCustomerDto): Promise<Customer> {
    const customerData = {
      ...data,
      id: this.generateId(),
      marketingPreferences: {
        email: data.marketingPreferences?.email ?? true,
        sms: data.marketingPreferences?.sms ?? true,
        push: data.marketingPreferences?.push ?? true,
        directMail: data.marketingPreferences?.directMail ?? false,
        marketing: data.marketingPreferences?.marketing ?? false,
        personalInfoConsent: data.marketingPreferences?.personalInfoConsent ?? false,
        marketingConsent: data.marketingPreferences?.marketingConsent ?? false,
        thirdPartyConsent: data.marketingPreferences?.thirdPartyConsent ?? false,
        consentDate: new Date(),
        consentIp: undefined
      },
      segments: [],
      tags: [],
      statistics: {
        totalOrders: 0,
        totalSpent: 0,
        averageOrderValue: 0,
        lifetimeValue: 0,
        loyaltyPoints: 0,
        preferredCategories: [],
        returnRate: 0,
        cancelationRate: 0,
        daysSinceRegistration: 0
      },
      addresses: [],
      loyaltyPoints: [],
      notes: [],
      internalNotes: [],
      priority: 'normal' as const,
      isActive: true,
      isVerified: false,
      emailVerified: false,
      phoneVerified: false
    };

    const entity = new CustomerEntity(customerData);
    const result = await this.adapter.create(this.tableName, entity);
    return this.mapToCustomer(result);
  }

  async findById(id: string): Promise<Customer | null> {
    const result = await this.adapter.findById(this.tableName, id);
    if (!result) return null;
    
    const customer = this.mapToCustomer(result);
    
    // Load related data
    customer.addresses = await this.findAddressesByCustomerId(id);
    customer.loyaltyPoints = await this.findLoyaltyPointsByCustomerId(id);
    customer.tier = await this.findTierByCustomerId(id);
    customer.statistics = await this.calculateStatistics(id);
    
    return customer;
  }

  async findByEmail(email: string): Promise<Customer | null> {
    const results = await this.adapter.findBy(this.tableName, { email });
    if (results.length === 0) return null;
    return this.mapToCustomer(results[0]);
  }

  async findByPhone(phone: string): Promise<Customer | null> {
    const results = await this.adapter.findBy(this.tableName, { phone });
    if (results.length === 0) return null;
    return this.mapToCustomer(results[0]);
  }

  async update(id: string, data: UpdateCustomerDto): Promise<Customer | null> {
    const updateData: any = { ...data };
    
    // Handle marketing preferences update
    if (data.marketingPreferences) {
      Object.keys(data.marketingPreferences).forEach(key => {
        updateData[`marketing${key.charAt(0).toUpperCase() + key.slice(1)}`] = 
          data.marketingPreferences![key as keyof typeof data.marketingPreferences];
      });
      delete updateData.marketingPreferences;
    }

    const result = await this.adapter.update(this.tableName, id, updateData);
    if (!result) return null;
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    return this.adapter.delete(this.tableName, id);
  }

  async findMany(
    filter: CustomerFilter = {}, 
    sort: CustomerSort = { field: 'createdAt', direction: 'desc' },
    page: number = 1,
    limit: number = 20
  ): Promise<CustomerListResponse> {
    const whereClause = this.buildWhereClause(filter);
    const orderClause = `ORDER BY ${sort.field} ${sort.direction.toUpperCase()}`;
    const limitClause = `LIMIT ${limit} OFFSET ${(page - 1) * limit}`;
    
    const query = `
      SELECT c.*, ct.name as tierName, ct.nameKo as tierNameKo
      FROM customers c
      LEFT JOIN customer_tiers ct ON c.tierId = ct.id
      ${whereClause}
      ${orderClause}
      ${limitClause}
    `;
    
    const countQuery = `
      SELECT COUNT(*) as total
      FROM customers c
      ${whereClause}
    `;
    
    const [results, countResult] = await Promise.all([
      this.adapter.query(query),
      this.adapter.query(countQuery)
    ]);
    
    const customers = results.map(row => this.mapToCustomer(row));
    const total = countResult[0].total;
    const totalPages = Math.ceil(total / limit);
    
    return {
      customers,
      total,
      page,
      limit,
      totalPages
    };
  }

  // Address management
  async createAddress(customerId: string, data: CreateAddressDto): Promise<CustomerAddress> {
    // If this is the first address or set as default, make it default
    if (data.isDefault) {
      await this.adapter.query(
        'UPDATE customer_addresses SET isDefault = false WHERE customerId = ?',
        [customerId]
      );
    }

    const addressData = {
      ...data,
      id: this.generateId(),
      customerId
    };

    const entity = new CustomerAddressEntity(addressData);
    const result = await this.adapter.create('customer_addresses', entity);
    return this.mapToAddress(result);
  }

  async findAddressesByCustomerId(customerId: string): Promise<CustomerAddress[]> {
    const results = await this.adapter.findBy('customer_addresses', { customerId });
    return results.map(row => this.mapToAddress(row));
  }

  async findAddressById(id: string): Promise<CustomerAddress | null> {
    const result = await this.adapter.findById('customer_addresses', id);
    if (!result) return null;
    return this.mapToAddress(result);
  }

  async updateAddress(id: string, data: UpdateAddressDto): Promise<CustomerAddress | null> {
    if (data.isDefault) {
      const address = await this.findAddressById(id);
      if (address) {
        await this.adapter.query(
          'UPDATE customer_addresses SET isDefault = false WHERE customerId = ? AND id != ?',
          [address.customerId, id]
        );
      }
    }

    const result = await this.adapter.update('customer_addresses', id, data);
    if (!result) return null;
    return this.mapToAddress(result);
  }

  async deleteAddress(id: string): Promise<boolean> {
    return this.adapter.delete('customer_addresses', id);
  }

  // Loyalty points management
  async addLoyaltyPoints(customerId: string, data: AddLoyaltyPointsDto): Promise<CustomerLoyaltyPoints> {
    const pointsData = {
      ...data,
      id: this.generateId(),
      customerId
    };

    const entity = new CustomerLoyaltyPointsEntity(pointsData);
    const result = await this.adapter.create('customer_loyalty_points', entity);
    
    // Update customer's total points
    await this.updateCustomerLoyaltyPoints(customerId);
    
    return this.mapToLoyaltyPoints(result);
  }

  async findLoyaltyPointsByCustomerId(customerId: string): Promise<CustomerLoyaltyPoints[]> {
    const results = await this.adapter.query(
      'SELECT * FROM customer_loyalty_points WHERE customerId = ? ORDER BY createdAt DESC',
      [customerId]
    );
    return results.map(row => this.mapToLoyaltyPoints(row));
  }

  private async updateCustomerLoyaltyPoints(customerId: string): Promise<void> {
    const result = await this.adapter.query(
      `SELECT SUM(CASE 
         WHEN transactionType = 'earned' THEN points
         WHEN transactionType = 'redeemed' THEN -points
         WHEN transactionType = 'expired' THEN -points
         WHEN transactionType = 'adjusted' THEN points
         ELSE 0 END) as totalPoints
       FROM customer_loyalty_points 
       WHERE customerId = ? AND (expiresAt IS NULL OR expiresAt > NOW())`,
      [customerId]
    );

    const totalPoints = result[0]?.totalPoints || 0;
    await this.adapter.update('customers', customerId, { loyaltyPoints: totalPoints });
  }

  // Customer tiers
  async findTiers(): Promise<CustomerTier[]> {
    const results = await this.adapter.query(
      'SELECT * FROM customer_tiers ORDER BY priority DESC, minSpent ASC'
    );
    return results.map(row => this.mapToTier(row));
  }

  async findTierByCustomerId(id: string): Promise<CustomerTier | null> {
    const result = await this.adapter.query(
      `SELECT ct.* FROM customer_tiers ct
       INNER JOIN customers c ON c.tierId = ct.id
       WHERE c.id = ?`,
      [id]
    );
    
    if (result.length === 0) return null;
    return this.mapToTier(result[0]);
  }

  async updateCustomerTier(customerId: string): Promise<void> {
    const customer = await this.adapter.findById('customers', customerId);
    if (!customer) return;

    const tiers = await this.findTiers();
    const applicableTier = tiers.find(tier => 
      customer.totalSpent >= tier.minSpent && 
      (!tier.maxSpent || customer.totalSpent <= tier.maxSpent)
    );

    if (applicableTier && customer.tierId !== applicableTier.id) {
      await this.adapter.update('customers', customerId, { tierId: applicableTier.id });
    }
  }

  // Customer segments
  async findSegments(): Promise<CustomerSegment[]> {
    const results = await this.adapter.query('SELECT * FROM customer_segments ORDER BY name');
    return results.map(row => this.mapToSegment(row));
  }

  async updateCustomerSegments(customerId: string): Promise<void> {
    const customer = await this.findById(customerId);
    if (!customer) return;

    const segments = await this.findSegments();
    const applicableSegments: string[] = [];

    for (const segment of segments) {
      const { criteria } = segment;
      let matches = true;

      if (criteria.minOrderCount && customer.statistics.totalOrders < criteria.minOrderCount) {
        matches = false;
      }
      if (criteria.maxOrderCount && customer.statistics.totalOrders > criteria.maxOrderCount) {
        matches = false;
      }
      if (criteria.minTotalSpent && customer.statistics.totalSpent < criteria.minTotalSpent) {
        matches = false;
      }
      if (criteria.maxTotalSpent && customer.statistics.totalSpent > criteria.maxTotalSpent) {
        matches = false;
      }
      if (criteria.registeredDaysAgo && customer.statistics.daysSinceRegistration < criteria.registeredDaysAgo) {
        matches = false;
      }
      if (criteria.lastOrderDaysAgo && customer.statistics.daysSinceLastOrder && 
          customer.statistics.daysSinceLastOrder < criteria.lastOrderDaysAgo) {
        matches = false;
      }
      if (criteria.tags && !criteria.tags.some(tag => customer.tags.includes(tag))) {
        matches = false;
      }

      if (matches) {
        applicableSegments.push(segment.id);
      }
    }

    await this.adapter.update('customers', customerId, { segments: applicableSegments });
  }

  // Analytics
  async getAnalytics(): Promise<CustomerAnalytics> {
    const [
      totalStats,
      newCustomersThisMonth,
      newCustomersLastMonth,
      tierDistribution,
      topSegments,
      geographicDistribution,
      acquisitionSources,
      monthlyRegistrations
    ] = await Promise.all([
      this.adapter.query(`
        SELECT 
          COUNT(*) as totalCustomers,
          SUM(CASE WHEN isActive = 1 THEN 1 ELSE 0 END) as activeCustomers,
          AVG(lifetimeValue) as averageLifetimeValue,
          AVG(averageOrderValue) as averageOrderValue
        FROM customers
      `),
      this.adapter.query(`
        SELECT COUNT(*) as count
        FROM customers 
        WHERE createdAt >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH)
      `),
      this.adapter.query(`
        SELECT COUNT(*) as count
        FROM customers 
        WHERE createdAt >= DATE_SUB(CURDATE(), INTERVAL 2 MONTH)
        AND createdAt < DATE_SUB(CURDATE(), INTERVAL 1 MONTH)
      `),
      this.adapter.query(`
        SELECT ct.id as tierId, ct.name, COUNT(*) as count
        FROM customers c
        LEFT JOIN customer_tiers ct ON c.tierId = ct.id
        GROUP BY ct.id, ct.name
      `),
      this.adapter.query(`
        SELECT cs.id as segmentId, cs.name, COUNT(*) as count
        FROM customers c
        JOIN JSON_TABLE(c.segments, '$[*]' COLUMNS (segmentId VARCHAR(36) PATH '$')) jt
        JOIN customer_segments cs ON cs.id = jt.segmentId
        GROUP BY cs.id, cs.name
        ORDER BY count DESC
        LIMIT 10
      `),
      this.adapter.query(`
        SELECT city, district, COUNT(*) as count
        FROM customer_addresses
        WHERE isDefault = 1
        GROUP BY city, district
        ORDER BY count DESC
        LIMIT 10
      `),
      this.adapter.query(`
        SELECT source, COUNT(*) as count
        FROM customers
        GROUP BY source
        ORDER BY count DESC
      `),
      this.adapter.query(`
        SELECT 
          DATE_FORMAT(createdAt, '%Y-%m') as month,
          COUNT(*) as count
        FROM customers
        WHERE createdAt >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
        GROUP BY DATE_FORMAT(createdAt, '%Y-%m')
        ORDER BY month
      `)
    ]);

    const totalCustomersCount = totalStats[0].totalCustomers;

    return {
      totalCustomers: totalCustomersCount,
      activeCustomers: totalStats[0].activeCustomers,
      newCustomersThisMonth: newCustomersThisMonth[0].count,
      newCustomersLastMonth: newCustomersLastMonth[0].count,
      averageLifetimeValue: totalStats[0].averageLifetimeValue || 0,
      averageOrderValue: totalStats[0].averageOrderValue || 0,
      topSegments: topSegments.map(row => ({
        segmentId: row.segmentId,
        name: row.name,
        count: row.count,
        percentage: totalCustomersCount > 0 ? (row.count / totalCustomersCount) * 100 : 0
      })),
      tierDistribution: tierDistribution.map(row => ({
        tierId: row.tierId,
        name: row.name || 'No Tier',
        count: row.count,
        percentage: totalCustomersCount > 0 ? (row.count / totalCustomersCount) * 100 : 0
      })),
      geographicDistribution: geographicDistribution.map(row => ({
        city: row.city,
        district: row.district,
        count: row.count,
        percentage: totalCustomersCount > 0 ? (row.count / totalCustomersCount) * 100 : 0
      })),
      acquisitionSources: acquisitionSources.map(row => ({
        source: row.source,
        count: row.count,
        percentage: totalCustomersCount > 0 ? (row.count / totalCustomersCount) * 100 : 0
      })),
      monthlyRegistrations: monthlyRegistrations.map(row => ({
        month: row.month,
        count: row.count
      })),
      retentionRates: {
        oneMonth: 0, // TODO: Calculate retention rates
        threeMonths: 0,
        sixMonths: 0,
        oneYear: 0
      }
    };
  }

  async getPurchaseBehavior(customerId: string): Promise<CustomerPurchaseBehavior | null> {
    // This would require integration with order data
    // For now, return a placeholder structure
    return {
      customerId,
      favoriteCategories: [],
      purchasePatterns: {
        averageDaysBetweenOrders: 0,
        mostActiveDay: 'Monday',
        mostActiveHour: 14,
        seasonalPreferences: []
      },
      pricePreferences: {
        averageOrderValue: 0,
        preferredPriceRange: { min: 0, max: 0 },
        discountSensitivity: 0
      },
      loyaltyIndicators: {
        repeatPurchaseRate: 0,
        brandLoyaltyScore: 0,
        churnRisk: 'low',
        nextOrderPrediction: null
      }
    };
  }

  private async calculateStatistics(customerId: string): Promise<any> {
    // This would require integration with order data
    // For now, return basic statistics from customer record
    const customer = await this.adapter.findById('customers', customerId);
    if (!customer) return {};

    const daysSinceRegistration = Math.floor(
      (Date.now() - new Date(customer.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    );

    const daysSinceLastOrder = customer.lastOrderDate
      ? Math.floor((Date.now() - new Date(customer.lastOrderDate).getTime()) / (1000 * 60 * 60 * 24))
      : undefined;

    return {
      totalOrders: customer.totalOrders || 0,
      totalSpent: customer.totalSpent || 0,
      averageOrderValue: customer.averageOrderValue || 0,
      lastOrderDate: customer.lastOrderDate,
      firstOrderDate: customer.firstOrderDate,
      lifetimeValue: customer.lifetimeValue || 0,
      loyaltyPoints: customer.loyaltyPoints || 0,
      preferredCategories: [],
      returnRate: 0,
      cancelationRate: 0,
      daysSinceLastOrder,
      daysSinceRegistration
    };
  }

  private buildWhereClause(filter: CustomerFilter): string {
    const conditions: string[] = [];
    
    if (filter.search) {
      conditions.push(`(
        c.firstName LIKE '%${filter.search}%' OR 
        c.lastName LIKE '%${filter.search}%' OR 
        c.koreanName LIKE '%${filter.search}%' OR
        c.email LIKE '%${filter.search}%' OR
        c.phone LIKE '%${filter.search}%'
      )`);
    }
    
    if (filter.email) conditions.push(`c.email LIKE '%${filter.email}%'`);
    if (filter.phone) conditions.push(`c.phone LIKE '%${filter.phone}%'`);
    if (filter.isActive !== undefined) conditions.push(`c.isActive = ${filter.isActive ? 1 : 0}`);
    if (filter.isVerified !== undefined) conditions.push(`c.isVerified = ${filter.isVerified ? 1 : 0}`);
    if (filter.tierId) conditions.push(`c.tierId = '${filter.tierId}'`);
    if (filter.priority) conditions.push(`c.priority = '${filter.priority}'`);
    if (filter.source) conditions.push(`c.source = '${filter.source}'`);
    if (filter.language) conditions.push(`c.language = '${filter.language}'`);
    
    if (filter.registeredAfter) {
      conditions.push(`c.createdAt >= '${filter.registeredAfter.toISOString()}'`);
    }
    if (filter.registeredBefore) {
      conditions.push(`c.createdAt <= '${filter.registeredBefore.toISOString()}'`);
    }
    
    if (filter.minTotalSpent) conditions.push(`c.totalSpent >= ${filter.minTotalSpent}`);
    if (filter.maxTotalSpent) conditions.push(`c.totalSpent <= ${filter.maxTotalSpent}`);
    if (filter.minOrderCount) conditions.push(`c.totalOrders >= ${filter.minOrderCount}`);
    if (filter.maxOrderCount) conditions.push(`c.totalOrders <= ${filter.maxOrderCount}`);
    
    return conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  }

  private mapToCustomer(row: any): Customer {
    return {
      id: row.id,
      email: row.email,
      phone: row.phone,
      firstName: row.firstName,
      lastName: row.lastName,
      koreanName: row.koreanName,
      dateOfBirth: row.dateOfBirth,
      gender: row.gender,
      isActive: Boolean(row.isActive),
      isVerified: Boolean(row.isVerified),
      emailVerified: Boolean(row.emailVerified),
      phoneVerified: Boolean(row.phoneVerified),
      tierId: row.tierId,
      tier: row.tierName ? {
        id: row.tierId,
        name: row.tierName,
        nameKo: row.tierNameKo,
        minSpent: 0,
        benefits: [],
        discountPercentage: 0,
        pointsMultiplier: 1,
        color: '#6B7280',
        priority: 0
      } : undefined,
      segments: Array.isArray(row.segments) ? row.segments : JSON.parse(row.segments || '[]'),
      tags: Array.isArray(row.tags) ? row.tags : JSON.parse(row.tags || '[]'),
      marketingPreferences: {
        email: Boolean(row.marketingEmail),
        sms: Boolean(row.marketingSms),
        push: Boolean(row.marketingPush),
        directMail: Boolean(row.marketingDirectMail),
        marketing: Boolean(row.marketingConsent),
        personalInfoConsent: Boolean(row.personalInfoConsent),
        marketingConsent: Boolean(row.marketingConsent),
        thirdPartyConsent: Boolean(row.thirdPartyConsent),
        consentDate: new Date(row.consentDate),
        consentIp: row.consentIp
      },
      language: row.language,
      timezone: row.timezone,
      currency: row.currency,
      notes: Array.isArray(row.notes) ? row.notes : JSON.parse(row.notes || '[]'),
      internalNotes: Array.isArray(row.internalNotes) ? row.internalNotes : JSON.parse(row.internalNotes || '[]'),
      priority: row.priority,
      source: row.source,
      referralCode: row.referralCode,
      referredBy: row.referredBy,
      lastLoginAt: row.lastLoginAt ? new Date(row.lastLoginAt) : undefined,
      addresses: [],
      loyaltyPoints: [],
      statistics: {
        totalOrders: row.totalOrders || 0,
        totalSpent: parseFloat(row.totalSpent) || 0,
        averageOrderValue: parseFloat(row.averageOrderValue) || 0,
        lastOrderDate: row.lastOrderDate ? new Date(row.lastOrderDate) : undefined,
        firstOrderDate: row.firstOrderDate ? new Date(row.firstOrderDate) : undefined,
        lifetimeValue: parseFloat(row.lifetimeValue) || 0,
        loyaltyPoints: row.loyaltyPoints || 0,
        preferredCategories: [],
        returnRate: 0,
        cancelationRate: 0,
        daysSinceLastOrder: row.daysSinceLastOrder,
        daysSinceRegistration: row.daysSinceRegistration || 0
      },
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt)
    };
  }

  private mapToAddress(row: any): CustomerAddress {
    return {
      id: row.id,
      customerId: row.customerId,
      type: row.type,
      isDefault: Boolean(row.isDefault),
      zipCode: row.zipCode,
      address1: row.address1,
      address2: row.address2,
      city: row.city,
      district: row.district,
      neighborhood: row.neighborhood,
      recipientName: row.recipientName,
      recipientPhone: row.recipientPhone,
      deliveryNote: row.deliveryNote,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt)
    };
  }

  private mapToLoyaltyPoints(row: any): CustomerLoyaltyPoints {
    return {
      id: row.id,
      customerId: row.customerId,
      points: row.points,
      transactionType: row.transactionType,
      transactionAmount: parseFloat(row.transactionAmount),
      orderId: row.orderId,
      description: row.description,
      expiresAt: row.expiresAt ? new Date(row.expiresAt) : undefined,
      createdAt: new Date(row.createdAt)
    };
  }

  private mapToTier(row: any): CustomerTier {
    return {
      id: row.id,
      name: row.name,
      nameKo: row.nameKo,
      minSpent: parseFloat(row.minSpent),
      maxSpent: row.maxSpent ? parseFloat(row.maxSpent) : undefined,
      benefits: Array.isArray(row.benefits) ? row.benefits : JSON.parse(row.benefits || '[]'),
      discountPercentage: parseFloat(row.discountPercentage),
      pointsMultiplier: parseFloat(row.pointsMultiplier),
      color: row.color,
      priority: row.priority
    };
  }

  private mapToSegment(row: any): CustomerSegment {
    return {
      id: row.id,
      name: row.name,
      nameKo: row.nameKo,
      description: row.description,
      criteria: typeof row.criteria === 'string' ? JSON.parse(row.criteria) : row.criteria,
      color: row.color
    };
  }

  private generateId(): string {
    return 'cust_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
}