import { BaseEntity } from '../../types/entities/base.entity';

export class CustomerEntity extends BaseEntity {
  email!: string;
  phone!: string;
  
  // Personal information
  firstName!: string;
  lastName!: string;
  koreanName?: string;
  dateOfBirth?: Date;
  gender?: 'male' | 'female' | 'other';
  
  // Account information
  isActive!: boolean;
  isVerified!: boolean;
  emailVerified!: boolean;
  phoneVerified!: boolean;
  
  // Tier and segmentation
  tierId?: string;
  segments!: string[];
  tags!: string[];
  
  // Marketing preferences
  marketingEmail!: boolean;
  marketingSms!: boolean;
  marketingPush!: boolean;
  marketingDirectMail!: boolean;
  marketingConsent!: boolean;
  personalInfoConsent!: boolean;
  thirdPartyConsent!: boolean;
  consentDate!: Date;
  consentIp?: string;
  
  // Preferences
  language!: string;
  timezone!: string;
  currency!: string;
  
  // Customer service
  notes!: string[];
  internalNotes!: string[];
  priority!: 'low' | 'normal' | 'high' | 'vip';
  
  // Metadata
  source!: string;
  referralCode?: string;
  referredBy?: string;
  lastLoginAt?: Date;

  // Statistics (computed fields)
  totalOrders!: number;
  totalSpent!: number;
  averageOrderValue!: number;
  lastOrderDate?: Date;
  firstOrderDate?: Date;
  lifetimeValue!: number;
  loyaltyPoints!: number;
  daysSinceLastOrder?: number;
  daysSinceRegistration!: number;

  constructor(data: Partial<CustomerEntity> = {}) {
    super();
    
    // Set defaults
    this.isActive = data.isActive ?? true;
    this.isVerified = data.isVerified ?? false;
    this.emailVerified = data.emailVerified ?? false;
    this.phoneVerified = data.phoneVerified ?? false;
    this.segments = data.segments ?? [];
    this.tags = data.tags ?? [];
    this.marketingEmail = data.marketingEmail ?? true;
    this.marketingSms = data.marketingSms ?? true;
    this.marketingPush = data.marketingPush ?? true;
    this.marketingDirectMail = data.marketingDirectMail ?? false;
    this.marketingConsent = data.marketingConsent ?? false;
    this.personalInfoConsent = data.personalInfoConsent ?? false;
    this.thirdPartyConsent = data.thirdPartyConsent ?? false;
    this.consentDate = data.consentDate ?? new Date();
    this.language = data.language ?? 'ko';
    this.timezone = data.timezone ?? 'Asia/Seoul';
    this.currency = data.currency ?? 'KRW';
    this.notes = data.notes ?? [];
    this.internalNotes = data.internalNotes ?? [];
    this.priority = data.priority ?? 'normal';
    this.source = data.source ?? 'website';
    this.totalOrders = data.totalOrders ?? 0;
    this.totalSpent = data.totalSpent ?? 0;
    this.averageOrderValue = data.averageOrderValue ?? 0;
    this.lifetimeValue = data.lifetimeValue ?? 0;
    this.loyaltyPoints = data.loyaltyPoints ?? 0;
    this.daysSinceRegistration = data.daysSinceRegistration ?? 0;
    
    Object.assign(this, data);
  }

  static getTableSchema() {
    return {
      tableName: 'customers',
      columns: {
        id: { type: 'VARCHAR(36)', primaryKey: true },
        email: { type: 'VARCHAR(255)', unique: true, notNull: true },
        phone: { type: 'VARCHAR(20)', unique: true, notNull: true },
        
        // Personal information
        firstName: { type: 'VARCHAR(100)', notNull: true },
        lastName: { type: 'VARCHAR(100)', notNull: true },
        koreanName: { type: 'VARCHAR(100)', nullable: true },
        dateOfBirth: { type: 'DATE', nullable: true },
        gender: { type: 'ENUM("male","female","other")', nullable: true },
        
        // Account information
        isActive: { type: 'BOOLEAN', notNull: true, default: true },
        isVerified: { type: 'BOOLEAN', notNull: true, default: false },
        emailVerified: { type: 'BOOLEAN', notNull: true, default: false },
        phoneVerified: { type: 'BOOLEAN', notNull: true, default: false },
        
        // Tier and segmentation
        tierId: { type: 'VARCHAR(36)', nullable: true },
        segments: { type: 'JSON', notNull: true, default: '[]' },
        tags: { type: 'JSON', notNull: true, default: '[]' },
        
        // Marketing preferences
        marketingEmail: { type: 'BOOLEAN', notNull: true, default: true },
        marketingSms: { type: 'BOOLEAN', notNull: true, default: true },
        marketingPush: { type: 'BOOLEAN', notNull: true, default: true },
        marketingDirectMail: { type: 'BOOLEAN', notNull: true, default: false },
        marketingConsent: { type: 'BOOLEAN', notNull: true, default: false },
        personalInfoConsent: { type: 'BOOLEAN', notNull: true, default: false },
        thirdPartyConsent: { type: 'BOOLEAN', notNull: true, default: false },
        consentDate: { type: 'DATETIME', notNull: true },
        consentIp: { type: 'VARCHAR(45)', nullable: true },
        
        // Preferences
        language: { type: 'VARCHAR(5)', notNull: true, default: 'ko' },
        timezone: { type: 'VARCHAR(50)', notNull: true, default: 'Asia/Seoul' },
        currency: { type: 'VARCHAR(3)', notNull: true, default: 'KRW' },
        
        // Customer service
        notes: { type: 'JSON', notNull: true, default: '[]' },
        internalNotes: { type: 'JSON', notNull: true, default: '[]' },
        priority: { type: 'ENUM("low","normal","high","vip")', notNull: true, default: 'normal' },
        
        // Metadata
        source: { type: 'VARCHAR(50)', notNull: true, default: 'website' },
        referralCode: { type: 'VARCHAR(50)', nullable: true },
        referredBy: { type: 'VARCHAR(36)', nullable: true },
        lastLoginAt: { type: 'DATETIME', nullable: true },
        
        // Statistics (computed fields - updated by triggers/jobs)
        totalOrders: { type: 'INT', notNull: true, default: 0 },
        totalSpent: { type: 'DECIMAL(15,2)', notNull: true, default: 0 },
        averageOrderValue: { type: 'DECIMAL(15,2)', notNull: true, default: 0 },
        lastOrderDate: { type: 'DATETIME', nullable: true },
        firstOrderDate: { type: 'DATETIME', nullable: true },
        lifetimeValue: { type: 'DECIMAL(15,2)', notNull: true, default: 0 },
        loyaltyPoints: { type: 'INT', notNull: true, default: 0 },
        daysSinceLastOrder: { type: 'INT', nullable: true },
        daysSinceRegistration: { type: 'INT', notNull: true, default: 0 },
        
        // Timestamps
        createdAt: { type: 'DATETIME', notNull: true, default: 'CURRENT_TIMESTAMP' },
        updatedAt: { type: 'DATETIME', notNull: true, default: 'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP' }
      },
      indexes: [
        { name: 'idx_customers_email', columns: ['email'] },
        { name: 'idx_customers_phone', columns: ['phone'] },
        { name: 'idx_customers_active', columns: ['isActive'] },
        { name: 'idx_customers_tier', columns: ['tierId'] },
        { name: 'idx_customers_source', columns: ['source'] },
        { name: 'idx_customers_created', columns: ['createdAt'] },
        { name: 'idx_customers_last_order', columns: ['lastOrderDate'] },
        { name: 'idx_customers_total_spent', columns: ['totalSpent'] },
        { name: 'idx_customers_priority', columns: ['priority'] },
        { name: 'idx_customers_korean_name', columns: ['koreanName'] },
        { name: 'idx_customers_referral', columns: ['referredBy'] }
      ],
      foreignKeys: [
        {
          name: 'fk_customers_tier',
          column: 'tierId',
          references: 'customer_tiers(id)',
          onDelete: 'SET NULL'
        },
        {
          name: 'fk_customers_referrer',
          column: 'referredBy',
          references: 'customers(id)',
          onDelete: 'SET NULL'
        }
      ]
    };
  }
}

export class CustomerAddressEntity extends BaseEntity {
  customerId!: string;
  type!: 'home' | 'work' | 'shipping' | 'billing';
  isDefault!: boolean;
  
  // Korean address fields
  zipCode!: string;
  address1!: string;
  address2?: string;
  city!: string;
  district!: string;
  neighborhood?: string;
  
  // Additional fields
  recipientName!: string;
  recipientPhone!: string;
  deliveryNote?: string;

  constructor(data: Partial<CustomerAddressEntity> = {}) {
    super();
    this.isDefault = data.isDefault ?? false;
    Object.assign(this, data);
  }

  static getTableSchema() {
    return {
      tableName: 'customer_addresses',
      columns: {
        id: { type: 'VARCHAR(36)', primaryKey: true },
        customerId: { type: 'VARCHAR(36)', notNull: true },
        type: { type: 'ENUM("home","work","shipping","billing")', notNull: true },
        isDefault: { type: 'BOOLEAN', notNull: true, default: false },
        
        zipCode: { type: 'VARCHAR(10)', notNull: true },
        address1: { type: 'VARCHAR(255)', notNull: true },
        address2: { type: 'VARCHAR(255)', nullable: true },
        city: { type: 'VARCHAR(50)', notNull: true },
        district: { type: 'VARCHAR(50)', notNull: true },
        neighborhood: { type: 'VARCHAR(50)', nullable: true },
        
        recipientName: { type: 'VARCHAR(100)', notNull: true },
        recipientPhone: { type: 'VARCHAR(20)', notNull: true },
        deliveryNote: { type: 'TEXT', nullable: true },
        
        createdAt: { type: 'DATETIME', notNull: true, default: 'CURRENT_TIMESTAMP' },
        updatedAt: { type: 'DATETIME', notNull: true, default: 'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP' }
      },
      indexes: [
        { name: 'idx_addresses_customer', columns: ['customerId'] },
        { name: 'idx_addresses_type', columns: ['type'] },
        { name: 'idx_addresses_default', columns: ['isDefault'] },
        { name: 'idx_addresses_city', columns: ['city'] },
        { name: 'idx_addresses_district', columns: ['district'] },
        { name: 'idx_addresses_zipcode', columns: ['zipCode'] }
      ],
      foreignKeys: [
        {
          name: 'fk_addresses_customer',
          column: 'customerId',
          references: 'customers(id)',
          onDelete: 'CASCADE'
        }
      ]
    };
  }
}

export class CustomerLoyaltyPointsEntity extends BaseEntity {
  customerId!: string;
  points!: number;
  transactionType!: 'earned' | 'redeemed' | 'expired' | 'adjusted';
  transactionAmount!: number;
  orderId?: string;
  description!: string;
  expiresAt?: Date;

  constructor(data: Partial<CustomerLoyaltyPointsEntity> = {}) {
    super();
    Object.assign(this, data);
  }

  static getTableSchema() {
    return {
      tableName: 'customer_loyalty_points',
      columns: {
        id: { type: 'VARCHAR(36)', primaryKey: true },
        customerId: { type: 'VARCHAR(36)', notNull: true },
        points: { type: 'INT', notNull: true },
        transactionType: { type: 'ENUM("earned","redeemed","expired","adjusted")', notNull: true },
        transactionAmount: { type: 'DECIMAL(15,2)', notNull: true },
        orderId: { type: 'VARCHAR(36)', nullable: true },
        description: { type: 'TEXT', notNull: true },
        expiresAt: { type: 'DATETIME', nullable: true },
        
        createdAt: { type: 'DATETIME', notNull: true, default: 'CURRENT_TIMESTAMP' },
        updatedAt: { type: 'DATETIME', notNull: true, default: 'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP' }
      },
      indexes: [
        { name: 'idx_loyalty_customer', columns: ['customerId'] },
        { name: 'idx_loyalty_type', columns: ['transactionType'] },
        { name: 'idx_loyalty_order', columns: ['orderId'] },
        { name: 'idx_loyalty_expires', columns: ['expiresAt'] },
        { name: 'idx_loyalty_created', columns: ['createdAt'] }
      ],
      foreignKeys: [
        {
          name: 'fk_loyalty_customer',
          column: 'customerId',
          references: 'customers(id)',
          onDelete: 'CASCADE'
        }
      ]
    };
  }
}

export class CustomerTierEntity extends BaseEntity {
  name!: string;
  nameKo!: string;
  minSpent!: number;
  maxSpent?: number;
  benefits!: string[];
  discountPercentage!: number;
  pointsMultiplier!: number;
  color!: string;
  priority!: number;

  constructor(data: Partial<CustomerTierEntity> = {}) {
    super();
    this.benefits = data.benefits ?? [];
    this.discountPercentage = data.discountPercentage ?? 0;
    this.pointsMultiplier = data.pointsMultiplier ?? 1;
    this.color = data.color ?? '#6B7280';
    this.priority = data.priority ?? 0;
    Object.assign(this, data);
  }

  static getTableSchema() {
    return {
      tableName: 'customer_tiers',
      columns: {
        id: { type: 'VARCHAR(36)', primaryKey: true },
        name: { type: 'VARCHAR(100)', notNull: true },
        nameKo: { type: 'VARCHAR(100)', notNull: true },
        minSpent: { type: 'DECIMAL(15,2)', notNull: true },
        maxSpent: { type: 'DECIMAL(15,2)', nullable: true },
        benefits: { type: 'JSON', notNull: true, default: '[]' },
        discountPercentage: { type: 'DECIMAL(5,2)', notNull: true, default: 0 },
        pointsMultiplier: { type: 'DECIMAL(3,2)', notNull: true, default: 1 },
        color: { type: 'VARCHAR(7)', notNull: true, default: '#6B7280' },
        priority: { type: 'INT', notNull: true, default: 0 },
        
        createdAt: { type: 'DATETIME', notNull: true, default: 'CURRENT_TIMESTAMP' },
        updatedAt: { type: 'DATETIME', notNull: true, default: 'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP' }
      },
      indexes: [
        { name: 'idx_tiers_priority', columns: ['priority'] },
        { name: 'idx_tiers_min_spent', columns: ['minSpent'] },
        { name: 'idx_tiers_max_spent', columns: ['maxSpent'] }
      ]
    };
  }
}

export class CustomerSegmentEntity extends BaseEntity {
  name!: string;
  nameKo!: string;
  description!: string;
  criteria!: {
    minOrderCount?: number;
    maxOrderCount?: number;
    minTotalSpent?: number;
    maxTotalSpent?: number;
    registeredDaysAgo?: number;
    lastOrderDaysAgo?: number;
    categories?: string[];
    tags?: string[];
  };
  color!: string;

  constructor(data: Partial<CustomerSegmentEntity> = {}) {
    super();
    this.criteria = data.criteria ?? {};
    this.color = data.color ?? '#6B7280';
    Object.assign(this, data);
  }

  static getTableSchema() {
    return {
      tableName: 'customer_segments',
      columns: {
        id: { type: 'VARCHAR(36)', primaryKey: true },
        name: { type: 'VARCHAR(100)', notNull: true },
        nameKo: { type: 'VARCHAR(100)', notNull: true },
        description: { type: 'TEXT', notNull: true },
        criteria: { type: 'JSON', notNull: true },
        color: { type: 'VARCHAR(7)', notNull: true, default: '#6B7280' },
        
        createdAt: { type: 'DATETIME', notNull: true, default: 'CURRENT_TIMESTAMP' },
        updatedAt: { type: 'DATETIME', notNull: true, default: 'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP' }
      },
      indexes: [
        { name: 'idx_segments_name', columns: ['name'] }
      ]
    };
  }
}