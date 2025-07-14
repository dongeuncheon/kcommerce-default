import { FastifyRequest, FastifyReply } from 'fastify';
import { CustomerService } from './customer.service';
import { 
  CreateCustomerDto, 
  UpdateCustomerDto, 
  CreateAddressDto, 
  UpdateAddressDto, 
  AddLoyaltyPointsDto,
  CustomerFilter,
  CustomerSort
} from './customer.types';

export class CustomerController {
  constructor(private customerService: CustomerService) {}

  // Customer CRUD operations
  async createCustomer(request: FastifyRequest, reply: FastifyReply) {
    try {
      const data = request.body as CreateCustomerDto;
      const customer = await this.customerService.createCustomer(data);
      
      reply.status(201).send({
        success: true,
        data: customer,
        message: '고객이 성공적으로 생성되었습니다.'
      });
    } catch (error) {
      reply.status(400).send({
        success: false,
        error: error.message,
        message: '고객 생성에 실패했습니다.'
      });
    }
  }

  async getCustomers(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = request.query as any;
      
      // Build filter from query parameters
      const filter: CustomerFilter = {};
      if (query.search) filter.search = query.search;
      if (query.email) filter.email = query.email;
      if (query.phone) filter.phone = query.phone;
      if (query.isActive !== undefined) filter.isActive = query.isActive === 'true';
      if (query.isVerified !== undefined) filter.isVerified = query.isVerified === 'true';
      if (query.tierId) filter.tierId = query.tierId;
      if (query.priority) filter.priority = query.priority;
      if (query.source) filter.source = query.source;
      if (query.language) filter.language = query.language;
      if (query.city) filter.city = query.city;
      if (query.district) filter.district = query.district;
      if (query.minTotalSpent) filter.minTotalSpent = parseFloat(query.minTotalSpent);
      if (query.maxTotalSpent) filter.maxTotalSpent = parseFloat(query.maxTotalSpent);
      if (query.minOrderCount) filter.minOrderCount = parseInt(query.minOrderCount);
      if (query.maxOrderCount) filter.maxOrderCount = parseInt(query.maxOrderCount);
      if (query.registeredAfter) filter.registeredAfter = new Date(query.registeredAfter);
      if (query.registeredBefore) filter.registeredBefore = new Date(query.registeredBefore);
      if (query.segments) filter.segments = Array.isArray(query.segments) ? query.segments : [query.segments];
      if (query.tags) filter.tags = Array.isArray(query.tags) ? query.tags : [query.tags];

      // Build sort from query parameters
      const sort: CustomerSort = {
        field: query.sortBy || 'createdAt',
        direction: query.sortOrder === 'asc' ? 'asc' : 'desc'
      };

      const page = parseInt(query.page) || 1;
      const limit = Math.min(parseInt(query.limit) || 20, 100); // Max 100 per page

      const result = await this.customerService.getCustomers(filter, sort, page, limit);
      
      reply.send({
        success: true,
        data: result,
        message: '고객 목록을 성공적으로 조회했습니다.'
      });
    } catch (error) {
      reply.status(500).send({
        success: false,
        error: error.message,
        message: '고객 목록 조회에 실패했습니다.'
      });
    }
  }

  async getCustomerById(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const customer = await this.customerService.getCustomerById(id);
      
      if (!customer) {
        return reply.status(404).send({
          success: false,
          message: '고객을 찾을 수 없습니다.'
        });
      }

      reply.send({
        success: true,
        data: customer,
        message: '고객 정보를 성공적으로 조회했습니다.'
      });
    } catch (error) {
      reply.status(500).send({
        success: false,
        error: error.message,
        message: '고객 조회에 실패했습니다.'
      });
    }
  }

  async updateCustomer(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const data = request.body as UpdateCustomerDto;
      
      const customer = await this.customerService.updateCustomer(id, data);
      
      if (!customer) {
        return reply.status(404).send({
          success: false,
          message: '고객을 찾을 수 없습니다.'
        });
      }

      reply.send({
        success: true,
        data: customer,
        message: '고객 정보가 성공적으로 업데이트되었습니다.'
      });
    } catch (error) {
      reply.status(400).send({
        success: false,
        error: error.message,
        message: '고객 정보 업데이트에 실패했습니다.'
      });
    }
  }

  async deactivateCustomer(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const success = await this.customerService.deactivateCustomer(id);
      
      if (!success) {
        return reply.status(404).send({
          success: false,
          message: '고객을 찾을 수 없습니다.'
        });
      }

      reply.send({
        success: true,
        message: '고객이 성공적으로 비활성화되었습니다.'
      });
    } catch (error) {
      reply.status(500).send({
        success: false,
        error: error.message,
        message: '고객 비활성화에 실패했습니다.'
      });
    }
  }

  async deleteCustomer(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const success = await this.customerService.deleteCustomer(id);
      
      if (!success) {
        return reply.status(404).send({
          success: false,
          message: '고객을 찾을 수 없습니다.'
        });
      }

      reply.send({
        success: true,
        message: '고객이 성공적으로 삭제되었습니다.'
      });
    } catch (error) {
      reply.status(500).send({
        success: false,
        error: error.message,
        message: '고객 삭제에 실패했습니다.'
      });
    }
  }

  // Address management
  async createAddress(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id: customerId } = request.params as { id: string };
      const data = request.body as CreateAddressDto;
      
      const address = await this.customerService.addAddress(customerId, data);
      
      reply.status(201).send({
        success: true,
        data: address,
        message: '주소가 성공적으로 추가되었습니다.'
      });
    } catch (error) {
      reply.status(400).send({
        success: false,
        error: error.message,
        message: '주소 추가에 실패했습니다.'
      });
    }
  }

  async getCustomerAddresses(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id: customerId } = request.params as { id: string };
      const addresses = await this.customerService.getCustomerAddresses(customerId);
      
      reply.send({
        success: true,
        data: addresses,
        message: '주소 목록을 성공적으로 조회했습니다.'
      });
    } catch (error) {
      reply.status(500).send({
        success: false,
        error: error.message,
        message: '주소 조회에 실패했습니다.'
      });
    }
  }

  async getAddressById(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { addressId } = request.params as { addressId: string };
      const address = await this.customerService.getAddressById(addressId);
      
      if (!address) {
        return reply.status(404).send({
          success: false,
          message: '주소를 찾을 수 없습니다.'
        });
      }

      reply.send({
        success: true,
        data: address,
        message: '주소 정보를 성공적으로 조회했습니다.'
      });
    } catch (error) {
      reply.status(500).send({
        success: false,
        error: error.message,
        message: '주소 조회에 실패했습니다.'
      });
    }
  }

  async updateAddress(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { addressId } = request.params as { addressId: string };
      const data = request.body as UpdateAddressDto;
      
      const address = await this.customerService.updateAddress(addressId, data);
      
      if (!address) {
        return reply.status(404).send({
          success: false,
          message: '주소를 찾을 수 없습니다.'
        });
      }

      reply.send({
        success: true,
        data: address,
        message: '주소가 성공적으로 업데이트되었습니다.'
      });
    } catch (error) {
      reply.status(400).send({
        success: false,
        error: error.message,
        message: '주소 업데이트에 실패했습니다.'
      });
    }
  }

  async deleteAddress(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { addressId } = request.params as { addressId: string };
      const success = await this.customerService.deleteAddress(addressId);
      
      if (!success) {
        return reply.status(404).send({
          success: false,
          message: '주소를 찾을 수 없습니다.'
        });
      }

      reply.send({
        success: true,
        message: '주소가 성공적으로 삭제되었습니다.'
      });
    } catch (error) {
      reply.status(500).send({
        success: false,
        error: error.message,
        message: '주소 삭제에 실패했습니다.'
      });
    }
  }

  async setDefaultAddress(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id: customerId, addressId } = request.params as { id: string; addressId: string };
      const address = await this.customerService.setDefaultAddress(customerId, addressId);
      
      if (!address) {
        return reply.status(404).send({
          success: false,
          message: '주소를 찾을 수 없습니다.'
        });
      }

      reply.send({
        success: true,
        data: address,
        message: '기본 주소가 성공적으로 설정되었습니다.'
      });
    } catch (error) {
      reply.status(400).send({
        success: false,
        error: error.message,
        message: '기본 주소 설정에 실패했습니다.'
      });
    }
  }

  // Loyalty points management
  async addLoyaltyPoints(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id: customerId } = request.params as { id: string };
      const data = request.body as AddLoyaltyPointsDto;
      
      const loyaltyPoints = await this.customerService.addLoyaltyPoints(customerId, data);
      
      reply.status(201).send({
        success: true,
        data: loyaltyPoints,
        message: '포인트가 성공적으로 추가되었습니다.'
      });
    } catch (error) {
      reply.status(400).send({
        success: false,
        error: error.message,
        message: '포인트 추가에 실패했습니다.'
      });
    }
  }

  async getCustomerLoyaltyPoints(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id: customerId } = request.params as { id: string };
      const loyaltyPoints = await this.customerService.getCustomerLoyaltyPoints(customerId);
      
      reply.send({
        success: true,
        data: loyaltyPoints,
        message: '포인트 내역을 성공적으로 조회했습니다.'
      });
    } catch (error) {
      reply.status(500).send({
        success: false,
        error: error.message,
        message: '포인트 내역 조회에 실패했습니다.'
      });
    }
  }

  async redeemLoyaltyPoints(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id: customerId } = request.params as { id: string };
      const { points, description } = request.body as { points: number; description: string };
      
      const loyaltyPoints = await this.customerService.redeemLoyaltyPoints(customerId, points, description);
      
      reply.send({
        success: true,
        data: loyaltyPoints,
        message: '포인트가 성공적으로 사용되었습니다.'
      });
    } catch (error) {
      reply.status(400).send({
        success: false,
        error: error.message,
        message: '포인트 사용에 실패했습니다.'
      });
    }
  }

  // Customer analytics and insights
  async getCustomerStatistics(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id: customerId } = request.params as { id: string };
      const statistics = await this.customerService.getCustomerStatistics(customerId);
      
      reply.send({
        success: true,
        data: statistics,
        message: '고객 통계를 성공적으로 조회했습니다.'
      });
    } catch (error) {
      reply.status(500).send({
        success: false,
        error: error.message,
        message: '고객 통계 조회에 실패했습니다.'
      });
    }
  }

  async getCustomerAnalytics(request: FastifyRequest, reply: FastifyReply) {
    try {
      const analytics = await this.customerService.getCustomerAnalytics();
      
      reply.send({
        success: true,
        data: analytics,
        message: '고객 분석 데이터를 성공적으로 조회했습니다.'
      });
    } catch (error) {
      reply.status(500).send({
        success: false,
        error: error.message,
        message: '고객 분석 데이터 조회에 실패했습니다.'
      });
    }
  }

  async getCustomerPurchaseBehavior(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id: customerId } = request.params as { id: string };
      const behavior = await this.customerService.getCustomerPurchaseBehavior(customerId);
      
      if (!behavior) {
        return reply.status(404).send({
          success: false,
          message: '고객 구매 행동 데이터를 찾을 수 없습니다.'
        });
      }

      reply.send({
        success: true,
        data: behavior,
        message: '고객 구매 행동 분석을 성공적으로 조회했습니다.'
      });
    } catch (error) {
      reply.status(500).send({
        success: false,
        error: error.message,
        message: '고객 구매 행동 분석 조회에 실패했습니다.'
      });
    }
  }

  // Customer service features
  async addCustomerNote(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id: customerId } = request.params as { id: string };
      const { note, isInternal = false } = request.body as { note: string; isInternal?: boolean };
      
      const customer = await this.customerService.addCustomerNote(customerId, note, isInternal);
      
      if (!customer) {
        return reply.status(404).send({
          success: false,
          message: '고객을 찾을 수 없습니다.'
        });
      }

      reply.send({
        success: true,
        data: customer,
        message: '고객 메모가 성공적으로 추가되었습니다.'
      });
    } catch (error) {
      reply.status(400).send({
        success: false,
        error: error.message,
        message: '고객 메모 추가에 실패했습니다.'
      });
    }
  }

  async updateCustomerPriority(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id: customerId } = request.params as { id: string };
      const { priority } = request.body as { priority: 'low' | 'normal' | 'high' | 'vip' };
      
      const customer = await this.customerService.updateCustomerPriority(customerId, priority);
      
      if (!customer) {
        return reply.status(404).send({
          success: false,
          message: '고객을 찾을 수 없습니다.'
        });
      }

      reply.send({
        success: true,
        data: customer,
        message: '고객 우선순위가 성공적으로 업데이트되었습니다.'
      });
    } catch (error) {
      reply.status(400).send({
        success: false,
        error: error.message,
        message: '고객 우선순위 업데이트에 실패했습니다.'
      });
    }
  }

  async addCustomerTags(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id: customerId } = request.params as { id: string };
      const { tags } = request.body as { tags: string[] };
      
      const customer = await this.customerService.addCustomerTags(customerId, tags);
      
      if (!customer) {
        return reply.status(404).send({
          success: false,
          message: '고객을 찾을 수 없습니다.'
        });
      }

      reply.send({
        success: true,
        data: customer,
        message: '고객 태그가 성공적으로 추가되었습니다.'
      });
    } catch (error) {
      reply.status(400).send({
        success: false,
        error: error.message,
        message: '고객 태그 추가에 실패했습니다.'
      });
    }
  }

  async removeCustomerTags(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id: customerId } = request.params as { id: string };
      const { tags } = request.body as { tags: string[] };
      
      const customer = await this.customerService.removeCustomerTags(customerId, tags);
      
      if (!customer) {
        return reply.status(404).send({
          success: false,
          message: '고객을 찾을 수 없습니다.'
        });
      }

      reply.send({
        success: true,
        data: customer,
        message: '고객 태그가 성공적으로 제거되었습니다.'
      });
    } catch (error) {
      reply.status(400).send({
        success: false,
        error: error.message,
        message: '고객 태그 제거에 실패했습니다.'
      });
    }
  }

  // Data export and import
  async exportCustomers(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = request.query as any;
      
      // Build filter for export
      const filter: CustomerFilter = {};
      if (query.isActive !== undefined) filter.isActive = query.isActive === 'true';
      if (query.tierId) filter.tierId = query.tierId;
      if (query.segments) filter.segments = Array.isArray(query.segments) ? query.segments : [query.segments];
      if (query.registeredAfter) filter.registeredAfter = new Date(query.registeredAfter);
      if (query.registeredBefore) filter.registeredBefore = new Date(query.registeredBefore);

      const customers = await this.customerService.exportCustomers(filter);
      
      reply.header('Content-Type', 'application/json');
      reply.header('Content-Disposition', 'attachment; filename="customers.json"');
      reply.send(customers);
    } catch (error) {
      reply.status(500).send({
        success: false,
        error: error.message,
        message: '고객 데이터 내보내기에 실패했습니다.'
      });
    }
  }

  async importCustomers(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { customers } = request.body as { customers: CreateCustomerDto[] };
      
      if (!Array.isArray(customers)) {
        return reply.status(400).send({
          success: false,
          message: '올바른 고객 데이터 배열을 제공해주세요.'
        });
      }

      const result = await this.customerService.importCustomers(customers);
      
      reply.send({
        success: true,
        data: result,
        message: `${result.success}명의 고객이 성공적으로 가져와졌습니다.`
      });
    } catch (error) {
      reply.status(500).send({
        success: false,
        error: error.message,
        message: '고객 데이터 가져오기에 실패했습니다.'
      });
    }
  }

  // Marketing features
  async getMarketingEligibleCustomers(request: FastifyRequest, reply: FastifyReply) {
    try {
      const criteria = request.body as any;
      const customers = await this.customerService.getMarketingEligibleCustomers(criteria);
      
      reply.send({
        success: true,
        data: customers,
        message: '마케팅 대상 고객을 성공적으로 조회했습니다.'
      });
    } catch (error) {
      reply.status(500).send({
        success: false,
        error: error.message,
        message: '마케팅 대상 고객 조회에 실패했습니다.'
      });
    }
  }

  // Customer lifecycle management
  async predictCustomerChurn(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id: customerId } = request.params as { id: string };
      const prediction = await this.customerService.predictCustomerChurn(customerId);
      
      reply.send({
        success: true,
        data: prediction,
        message: '고객 이탈 예측을 성공적으로 분석했습니다.'
      });
    } catch (error) {
      reply.status(500).send({
        success: false,
        error: error.message,
        message: '고객 이탈 예측 분석에 실패했습니다.'
      });
    }
  }

  async calculateLifetimeValue(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id: customerId } = request.params as { id: string };
      const ltv = await this.customerService.calculateCustomerLifetimeValue(customerId);
      
      reply.send({
        success: true,
        data: { customerId, lifetimeValue: ltv },
        message: '고객 생애 가치를 성공적으로 계산했습니다.'
      });
    } catch (error) {
      reply.status(500).send({
        success: false,
        error: error.message,
        message: '고객 생애 가치 계산에 실패했습니다.'
      });
    }
  }

  // Utility endpoints
  async getTiers(request: FastifyRequest, reply: FastifyReply) {
    try {
      const tiers = await this.customerService.getTiers();
      
      reply.send({
        success: true,
        data: tiers,
        message: '고객 등급을 성공적으로 조회했습니다.'
      });
    } catch (error) {
      reply.status(500).send({
        success: false,
        error: error.message,
        message: '고객 등급 조회에 실패했습니다.'
      });
    }
  }

  async getSegments(request: FastifyRequest, reply: FastifyReply) {
    try {
      const segments = await this.customerService.getSegments();
      
      reply.send({
        success: true,
        data: segments,
        message: '고객 세그먼트를 성공적으로 조회했습니다.'
      });
    } catch (error) {
      reply.status(500).send({
        success: false,
        error: error.message,
        message: '고객 세그먼트 조회에 실패했습니다.'
      });
    }
  }
}