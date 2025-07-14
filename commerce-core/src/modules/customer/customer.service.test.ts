import { CustomerService } from './customer.service';
import { CustomerRepository } from './customer.repository';
import { DatabaseAdapter } from '../../adapters/database.adapter';

// Mock implementations
class MockDatabaseAdapter implements Partial<DatabaseAdapter> {
  private data: Map<string, any[]> = new Map();

  async create(tableName: string, data: any): Promise<any> {
    if (!this.data.has(tableName)) {
      this.data.set(tableName, []);
    }
    const table = this.data.get(tableName)!;
    const newRecord = { ...data, id: data.id || `test_${Date.now()}` };
    table.push(newRecord);
    return newRecord;
  }

  async findById(tableName: string, id: string): Promise<any> {
    const table = this.data.get(tableName) || [];
    return table.find(record => record.id === id) || null;
  }

  async findBy(tableName: string, criteria: any): Promise<any[]> {
    const table = this.data.get(tableName) || [];
    return table.filter(record => {
      return Object.keys(criteria).every(key => record[key] === criteria[key]);
    });
  }

  async update(tableName: string, id: string, data: any): Promise<any> {
    const table = this.data.get(tableName) || [];
    const index = table.findIndex(record => record.id === id);
    if (index !== -1) {
      table[index] = { ...table[index], ...data, updatedAt: new Date() };
      return table[index];
    }
    return null;
  }

  async delete(tableName: string, id: string): Promise<boolean> {
    const table = this.data.get(tableName) || [];
    const index = table.findIndex(record => record.id === id);
    if (index !== -1) {
      table.splice(index, 1);
      return true;
    }
    return false;
  }

  async query(sql: string, params?: any[]): Promise<any[]> {
    // Mock query implementation
    return [];
  }
}

describe('CustomerService', () => {
  let customerService: CustomerService;
  let customerRepository: CustomerRepository;
  let mockAdapter: MockDatabaseAdapter;

  beforeEach(() => {
    mockAdapter = new MockDatabaseAdapter();
    customerRepository = new CustomerRepository(mockAdapter as DatabaseAdapter);
    customerService = new CustomerService(customerRepository);
  });

  describe('Customer Creation', () => {
    it('should create a new customer with valid Korean data', async () => {
      const customerData = {
        email: 'hong@naver.com',
        phone: '010-1234-5678',
        firstName: '길동',
        lastName: '홍',
        koreanName: '홍길동',
        language: 'ko',
        timezone: 'Asia/Seoul',
        currency: 'KRW'
      };

      const customer = await customerService.createCustomer(customerData);

      expect(customer).toBeDefined();
      expect(customer.email).toBe(customerData.email);
      expect(customer.koreanName).toBe(customerData.koreanName);
      expect(customer.language).toBe('ko');
      expect(customer.currency).toBe('KRW');
      expect(customer.statistics.loyaltyPoints).toBe(1000); // Welcome points
    });

    it('should validate Korean phone number format', async () => {
      const customerData = {
        email: 'test@test.com',
        phone: '123-456-7890', // Invalid Korean phone
        firstName: 'Test',
        lastName: 'User'
      };

      await expect(customerService.createCustomer(customerData))
        .rejects.toThrow('올바른 한국 전화번호 형식이 아닙니다.');
    });

    it('should prevent duplicate email registration', async () => {
      const customerData = {
        email: 'duplicate@test.com',
        phone: '010-1111-2222',
        firstName: 'First',
        lastName: 'User'
      };

      await customerService.createCustomer(customerData);

      const duplicateData = {
        email: 'duplicate@test.com',
        phone: '010-3333-4444',
        firstName: 'Second',
        lastName: 'User'
      };

      await expect(customerService.createCustomer(duplicateData))
        .rejects.toThrow('이미 등록된 이메일입니다.');
    });

    it('should prevent duplicate phone registration', async () => {
      const customerData = {
        email: 'first@test.com',
        phone: '010-1111-2222',
        firstName: 'First',
        lastName: 'User'
      };

      await customerService.createCustomer(customerData);

      const duplicateData = {
        email: 'second@test.com',
        phone: '010-1111-2222',
        firstName: 'Second',
        lastName: 'User'
      };

      await expect(customerService.createCustomer(duplicateData))
        .rejects.toThrow('이미 등록된 전화번호입니다.');
    });
  });

  describe('Address Management', () => {
    let customerId: string;

    beforeEach(async () => {
      const customer = await customerService.createCustomer({
        email: 'test@test.com',
        phone: '010-1234-5678',
        firstName: 'Test',
        lastName: 'User'
      });
      customerId = customer.id;
    });

    it('should add Korean address with proper validation', async () => {
      const addressData = {
        type: 'home' as const,
        zipCode: '12345',
        address1: '서울특별시 강남구 테헤란로 123',
        address2: '456호',
        city: '서울특별시',
        district: '강남구',
        neighborhood: '역삼동',
        recipientName: '홍길동',
        recipientPhone: '010-1234-5678'
      };

      const address = await customerService.addAddress(customerId, addressData);

      expect(address).toBeDefined();
      expect(address.zipCode).toBe('12345');
      expect(address.city).toBe('서울특별시');
      expect(address.district).toBe('강남구');
      expect(address.recipientName).toBe('홍길동');
    });

    it('should validate Korean zip code format', async () => {
      const addressData = {
        type: 'home' as const,
        zipCode: '123', // Invalid format
        address1: '서울특별시 강남구 테헤란로 123',
        city: '서울특별시',
        district: '강남구',
        recipientName: '홍길동',
        recipientPhone: '010-1234-5678'
      };

      await expect(customerService.addAddress(customerId, addressData))
        .rejects.toThrow('올바른 우편번호 형식이 아닙니다.');
    });

    it('should validate recipient phone number', async () => {
      const addressData = {
        type: 'home' as const,
        zipCode: '12345',
        address1: '서울특별시 강남구 테헤란로 123',
        city: '서울특별시',
        district: '강남구',
        recipientName: '홍길동',
        recipientPhone: '123-456-7890' // Invalid Korean phone
      };

      await expect(customerService.addAddress(customerId, addressData))
        .rejects.toThrow('올바른 전화번호 형식이 아닙니다.');
    });
  });

  describe('Loyalty Points Management', () => {
    let customerId: string;

    beforeEach(async () => {
      const customer = await customerService.createCustomer({
        email: 'test@test.com',
        phone: '010-1234-5678',
        firstName: 'Test',
        lastName: 'User'
      });
      customerId = customer.id;
    });

    it('should add loyalty points correctly', async () => {
      const pointsData = {
        points: 500,
        transactionType: 'earned' as const,
        transactionAmount: 50000,
        description: '구매 적립'
      };

      const loyaltyPoints = await customerService.addLoyaltyPoints(customerId, pointsData);

      expect(loyaltyPoints).toBeDefined();
      expect(loyaltyPoints.points).toBe(500);
      expect(loyaltyPoints.transactionType).toBe('earned');
      expect(loyaltyPoints.description).toBe('구매 적립');
    });

    it('should validate points amount', async () => {
      const pointsData = {
        points: 0, // Invalid amount
        transactionType: 'earned' as const,
        transactionAmount: 0,
        description: '테스트'
      };

      await expect(customerService.addLoyaltyPoints(customerId, pointsData))
        .rejects.toThrow('포인트는 0보다 커야 합니다.');
    });

    it('should redeem points correctly', async () => {
      // First, add some points
      await customerService.addLoyaltyPoints(customerId, {
        points: 1000,
        transactionType: 'earned',
        transactionAmount: 100000,
        description: '구매 적립'
      });

      // Mock the customer's current points
      jest.spyOn(customerRepository, 'findById').mockResolvedValueOnce({
        id: customerId,
        statistics: { loyaltyPoints: 2000 } // 1000 welcome + 1000 earned
      } as any);

      const redemption = await customerService.redeemLoyaltyPoints(customerId, 500, '할인 사용');

      expect(redemption.points).toBe(500);
      expect(redemption.transactionType).toBe('redeemed');
      expect(redemption.description).toBe('할인 사용');
    });

    it('should prevent redeeming more points than available', async () => {
      // Mock customer with limited points
      jest.spyOn(customerRepository, 'findById').mockResolvedValueOnce({
        id: customerId,
        statistics: { loyaltyPoints: 100 }
      } as any);

      await expect(customerService.redeemLoyaltyPoints(customerId, 500, '할인 사용'))
        .rejects.toThrow('보유 포인트가 부족합니다.');
    });
  });

  describe('Customer Service Features', () => {
    let customerId: string;

    beforeEach(async () => {
      const customer = await customerService.createCustomer({
        email: 'test@test.com',
        phone: '010-1234-5678',
        firstName: 'Test',
        lastName: 'User'
      });
      customerId = customer.id;
    });

    it('should add customer notes', async () => {
      const note = '고객이 배송 시간 변경을 요청함';
      
      // Mock findById to return a customer
      jest.spyOn(customerRepository, 'findById').mockResolvedValueOnce({
        id: customerId,
        notes: [],
        internalNotes: []
      } as any);

      // Mock update to return updated customer
      jest.spyOn(customerRepository, 'update').mockResolvedValueOnce({
        id: customerId,
        notes: [expect.stringContaining(note)]
      } as any);

      const result = await customerService.addCustomerNote(customerId, note, false);

      expect(result).toBeDefined();
      expect(customerRepository.update).toHaveBeenCalledWith(
        customerId,
        expect.objectContaining({
          notes: expect.arrayContaining([expect.stringContaining(note)])
        })
      );
    });

    it('should add internal notes separately', async () => {
      const internalNote = '이 고객은 VIP 대우 필요';
      
      jest.spyOn(customerRepository, 'findById').mockResolvedValueOnce({
        id: customerId,
        notes: [],
        internalNotes: []
      } as any);

      jest.spyOn(customerRepository, 'update').mockResolvedValueOnce({
        id: customerId,
        internalNotes: [expect.stringContaining(internalNote)]
      } as any);

      const result = await customerService.addCustomerNote(customerId, internalNote, true);

      expect(result).toBeDefined();
      expect(customerRepository.update).toHaveBeenCalledWith(
        customerId,
        expect.objectContaining({
          internalNotes: expect.arrayContaining([expect.stringContaining(internalNote)])
        })
      );
    });

    it('should update customer priority', async () => {
      jest.spyOn(customerRepository, 'update').mockResolvedValueOnce({
        id: customerId,
        priority: 'vip'
      } as any);

      const result = await customerService.updateCustomerPriority(customerId, 'vip');

      expect(result).toBeDefined();
      expect(customerRepository.update).toHaveBeenCalledWith(customerId, { priority: 'vip' });
    });

    it('should add and remove customer tags', async () => {
      const tags = ['VIP', '대량구매고객'];
      
      jest.spyOn(customerRepository, 'findById').mockResolvedValueOnce({
        id: customerId,
        tags: []
      } as any);

      jest.spyOn(customerRepository, 'update').mockResolvedValueOnce({
        id: customerId,
        tags: tags
      } as any);

      const result = await customerService.addCustomerTags(customerId, tags);

      expect(result).toBeDefined();
      expect(customerRepository.update).toHaveBeenCalledWith(customerId, { tags });
    });
  });

  describe('Korean Validation Features', () => {
    it('should validate Korean phone numbers correctly', () => {
      const validPhones = [
        '010-1234-5678',
        '02-1234-5678',
        '031-123-4567',
        '070-1234-5678'
      ];

      const invalidPhones = [
        '123-456-7890',
        '555-1234',
        '010-12345'
      ];

      validPhones.forEach(phone => {
        expect(() => customerService['isValidKoreanPhone'](phone)).not.toThrow();
      });

      invalidPhones.forEach(phone => {
        expect(customerService['isValidKoreanPhone'](phone)).toBe(false);
      });
    });

    it('should validate Korean zip codes correctly', () => {
      const validZipCodes = ['12345', '06234', '00001'];
      const invalidZipCodes = ['123', '123456', 'ABCDE'];

      validZipCodes.forEach(zipCode => {
        expect(customerService['isValidKoreanZipCode'](zipCode)).toBe(true);
      });

      invalidZipCodes.forEach(zipCode => {
        expect(customerService['isValidKoreanZipCode'](zipCode)).toBe(false);
      });
    });
  });

  describe('Customer Analytics', () => {
    it('should calculate customer lifetime value', async () => {
      const customerId = 'test_customer';
      
      jest.spyOn(customerRepository, 'findById').mockResolvedValueOnce({
        id: customerId,
        statistics: {
          averageOrderValue: 50000,
          totalOrders: 10,
          daysSinceRegistration: 365
        }
      } as any);

      const ltv = await customerService.calculateCustomerLifetimeValue(customerId);

      expect(ltv).toBeGreaterThan(0);
      expect(typeof ltv).toBe('number');
    });

    it('should predict customer churn risk', async () => {
      const customerId = 'test_customer';
      
      jest.spyOn(customerRepository, 'findById').mockResolvedValueOnce({
        id: customerId,
        statistics: {
          daysSinceLastOrder: 95,
          totalOrders: 1,
          loyaltyPoints: 1500
        },
        marketingPreferences: {
          email: false,
          sms: false
        }
      } as any);

      const prediction = await customerService.predictCustomerChurn(customerId);

      expect(prediction.risk).toBe('high');
      expect(prediction.factors).toContain('장기간 주문 없음');
      expect(prediction.factors).toContain('낮은 주문 빈도');
      expect(prediction.factors).toContain('마케팅 수신 거부');
      expect(prediction.factors).toContain('포인트 미사용');
    });
  });

  describe('Marketing Features', () => {
    it('should get marketing eligible customers based on criteria', async () => {
      const criteria = {
        channel: 'email',
        segments: ['active'],
        minSpent: 100000
      };

      // Mock repository method
      jest.spyOn(customerRepository, 'findMany').mockResolvedValueOnce({
        customers: [
          {
            id: 'customer1',
            marketingPreferences: { email: true, marketing: true },
            segments: ['active'],
            statistics: { totalSpent: 150000 }
          },
          {
            id: 'customer2',
            marketingPreferences: { email: false, marketing: true },
            segments: ['active'],
            statistics: { totalSpent: 200000 }
          }
        ]
      } as any);

      const eligibleCustomers = await customerService.getMarketingEligibleCustomers(criteria);

      expect(eligibleCustomers).toHaveLength(1);
      expect(eligibleCustomers[0].id).toBe('customer1');
    });
  });
});

// Test utilities
export const createTestCustomer = (overrides: any = {}) => ({
  email: 'test@example.com',
  phone: '010-1234-5678',
  firstName: 'Test',
  lastName: 'User',
  koreanName: '테스트',
  language: 'ko',
  timezone: 'Asia/Seoul',
  currency: 'KRW',
  ...overrides
});

export const createTestAddress = (overrides: any = {}) => ({
  type: 'home',
  zipCode: '12345',
  address1: '서울특별시 강남구 테헤란로 123',
  city: '서울특별시',
  district: '강남구',
  recipientName: '홍길동',
  recipientPhone: '010-1234-5678',
  ...overrides
});