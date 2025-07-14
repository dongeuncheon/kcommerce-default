import { BaseModule } from '../../core/module/base.module';
import { ShippingController } from './shipping.controller';
import { ShippingService } from './shipping.service';
import { ShippingRepository } from './shipping.repository';
import { Container } from '../../core/di/container';
import { FastifyInstance } from 'fastify';

export class ShippingModule extends BaseModule {
  name = 'shipping';
  
  async initialize(): Promise<void> {
    // Register dependencies
    this.registerDependencies();
    
    // Initialize database schema
    await this.initializeDatabase();
    
    // Setup scheduled tasks
    this.setupScheduledTasks();
  }

  async registerRoutes(fastify: FastifyInstance): Promise<void> {
    const controller = Container.get<ShippingController>('ShippingController');
    await controller.registerRoutes(fastify);
  }

  private registerDependencies(): void {
    // Register repository
    Container.register('ShippingRepository', ShippingRepository, {
      singleton: true,
      dependencies: ['DatabaseAdapter']
    });

    // Register service
    Container.register('ShippingService', ShippingService, {
      singleton: true,
      dependencies: ['ShippingRepository', 'LoggerService', 'CacheService', 'NotificationService']
    });

    // Register controller
    Container.register('ShippingController', ShippingController, {
      singleton: true,
      dependencies: ['ShippingService']
    });
  }

  private async initializeDatabase(): Promise<void> {
    try {
      const adapter = Container.get<any>('DatabaseAdapter');
      
      // Create tables if they don't exist
      const { SHIPPING_SCHEMA_SQL } = await import('./shipping.entity');
      
      // Execute schema creation
      await adapter.query(SHIPPING_SCHEMA_SQL);
      
      // Seed initial data
      await this.seedInitialData();
      
      console.log('Shipping module database initialized successfully');
    } catch (error) {
      console.error('Failed to initialize shipping module database:', error);
      throw error;
    }
  }

  private async seedInitialData(): Promise<void> {
    const repository = Container.get<ShippingRepository>('ShippingRepository');
    
    // Check if initial data already exists
    const existingProviders = await repository.getAllProviderConfigs();
    if (existingProviders.length > 0) {
      return;
    }

    // Seed shipping zones
    const zones = [
      {
        name: '서울/경기',
        code: 'SEOUL_GYEONGGI',
        regions: ['서울특별시', '경기도'],
        baseShippingRate: 2500,
        additionalRatePerKg: 500,
        estimatedDays: 1,
        isActive: true
      },
      {
        name: '충청권',
        code: 'CHUNGCHEONG',
        regions: ['대전광역시', '세종특별자치시', '충청북도', '충청남도'],
        baseShippingRate: 3000,
        additionalRatePerKg: 600,
        estimatedDays: 2,
        isActive: true
      },
      {
        name: '영남권',
        code: 'YEONGNAM',
        regions: ['부산광역시', '대구광역시', '울산광역시', '경상북도', '경상남도'],
        baseShippingRate: 3500,
        additionalRatePerKg: 700,
        estimatedDays: 2,
        isActive: true
      },
      {
        name: '호남권',
        code: 'HONAM',
        regions: ['광주광역시', '전라북도', '전라남도'],
        baseShippingRate: 3500,
        additionalRatePerKg: 700,
        estimatedDays: 2,
        isActive: true
      },
      {
        name: '강원권',
        code: 'GANGWON',
        regions: ['강원도'],
        baseShippingRate: 3500,
        additionalRatePerKg: 700,
        estimatedDays: 2,
        isActive: true
      },
      {
        name: '제주권',
        code: 'JEJU',
        regions: ['제주특별자치도'],
        baseShippingRate: 5000,
        additionalRatePerKg: 1000,
        estimatedDays: 3,
        isActive: true
      }
    ];

    for (const zone of zones) {
      await repository.query(
        `INSERT INTO shipping_zones (name, code, regions, base_shipping_rate, additional_rate_per_kg, estimated_days, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (code) DO NOTHING`,
        [zone.name, zone.code, zone.regions, zone.baseShippingRate, zone.additionalRatePerKg, zone.estimatedDays, zone.isActive]
      );
    }

    // Seed provider configurations
    const providers = [
      {
        provider: 'cj_logistics',
        displayName: 'CJ대한통운',
        environment: 'production',
        supportedServices: ['standard', 'express'],
        features: {
          realTimeTracking: true,
          labelGeneration: true,
          pickupScheduling: true,
          returnShipping: true,
          insurance: true,
          cashOnDelivery: true
        },
        isActive: true
      },
      {
        provider: 'hanjin',
        displayName: '한진택배',
        environment: 'production',
        supportedServices: ['standard', 'express'],
        features: {
          realTimeTracking: true,
          labelGeneration: true,
          pickupScheduling: true,
          returnShipping: true,
          insurance: true,
          cashOnDelivery: false
        },
        isActive: true
      },
      {
        provider: 'logen',
        displayName: '로젠택배',
        environment: 'production',
        supportedServices: ['standard'],
        features: {
          realTimeTracking: true,
          labelGeneration: true,
          pickupScheduling: false,
          returnShipping: true,
          insurance: true,
          cashOnDelivery: false
        },
        isActive: true
      },
      {
        provider: 'korea_post',
        displayName: '우체국택배',
        environment: 'production',
        supportedServices: ['standard', 'express'],
        features: {
          realTimeTracking: true,
          labelGeneration: true,
          pickupScheduling: true,
          returnShipping: true,
          insurance: true,
          cashOnDelivery: true
        },
        isActive: true
      },
      {
        provider: 'lotte',
        displayName: '롯데택배',
        environment: 'production',
        supportedServices: ['standard', 'express'],
        features: {
          realTimeTracking: true,
          labelGeneration: true,
          pickupScheduling: true,
          returnShipping: true,
          insurance: true,
          cashOnDelivery: false
        },
        isActive: true
      },
      {
        provider: 'coupang_rocket',
        displayName: '쿠팡 로켓배송',
        environment: 'production',
        supportedServices: ['same_day', 'dawn'],
        features: {
          realTimeTracking: true,
          labelGeneration: true,
          pickupScheduling: false,
          returnShipping: true,
          insurance: false,
          cashOnDelivery: false
        },
        isActive: true
      },
      {
        provider: 'dawn_delivery',
        displayName: '새벽배송',
        environment: 'production',
        supportedServices: ['dawn'],
        features: {
          realTimeTracking: true,
          labelGeneration: true,
          pickupScheduling: false,
          returnShipping: false,
          insurance: false,
          cashOnDelivery: false
        },
        isActive: true
      }
    ];

    for (const provider of providers) {
      await repository.query(
        `INSERT INTO shipping_provider_configs 
         (provider, display_name, environment, supported_services, features, is_active)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (provider) DO NOTHING`,
        [
          provider.provider,
          provider.displayName,
          provider.environment,
          provider.supportedServices,
          JSON.stringify(provider.features),
          provider.isActive
        ]
      );
    }

    // Seed shipping rates
    const rates = [
      // CJ Logistics rates
      { provider: 'cj_logistics', serviceType: 'standard', packageSize: 'small', basePrice: 2500, pricePerKg: 500, minDays: 2, maxDays: 3 },
      { provider: 'cj_logistics', serviceType: 'standard', packageSize: 'medium', basePrice: 3000, pricePerKg: 600, minDays: 2, maxDays: 3 },
      { provider: 'cj_logistics', serviceType: 'standard', packageSize: 'large', basePrice: 4000, pricePerKg: 700, minDays: 2, maxDays: 3 },
      { provider: 'cj_logistics', serviceType: 'express', packageSize: 'small', basePrice: 4000, pricePerKg: 700, minDays: 1, maxDays: 2 },
      { provider: 'cj_logistics', serviceType: 'express', packageSize: 'medium', basePrice: 5000, pricePerKg: 800, minDays: 1, maxDays: 2 },
      
      // Hanjin rates
      { provider: 'hanjin', serviceType: 'standard', packageSize: 'small', basePrice: 2800, pricePerKg: 550, minDays: 2, maxDays: 3 },
      { provider: 'hanjin', serviceType: 'standard', packageSize: 'medium', basePrice: 3300, pricePerKg: 650, minDays: 2, maxDays: 3 },
      { provider: 'hanjin', serviceType: 'express', packageSize: 'small', basePrice: 4500, pricePerKg: 750, minDays: 1, maxDays: 2 },
      
      // Korea Post rates
      { provider: 'korea_post', serviceType: 'standard', packageSize: 'small', basePrice: 2000, pricePerKg: 400, minDays: 3, maxDays: 4 },
      { provider: 'korea_post', serviceType: 'standard', packageSize: 'medium', basePrice: 2500, pricePerKg: 500, minDays: 3, maxDays: 4 },
      { provider: 'korea_post', serviceType: 'express', packageSize: 'small', basePrice: 3500, pricePerKg: 600, minDays: 2, maxDays: 3 },
      
      // Coupang Rocket rates
      { provider: 'coupang_rocket', serviceType: 'same_day', packageSize: 'small', basePrice: 0, pricePerKg: 0, minDays: 0, maxDays: 1, cutoffTime: '11:00' },
      { provider: 'coupang_rocket', serviceType: 'dawn', packageSize: 'small', basePrice: 0, pricePerKg: 0, minDays: 1, maxDays: 1, cutoffTime: '23:00' },
      
      // Dawn Delivery rates
      { provider: 'dawn_delivery', serviceType: 'dawn', packageSize: 'small', basePrice: 4500, pricePerKg: 0, minDays: 1, maxDays: 1, cutoffTime: '22:00' },
      { provider: 'dawn_delivery', serviceType: 'dawn', packageSize: 'medium', basePrice: 5500, pricePerKg: 0, minDays: 1, maxDays: 1, cutoffTime: '22:00' }
    ];

    for (const rate of rates) {
      await repository.createShippingRate({
        provider: rate.provider as any,
        serviceType: rate.serviceType as any,
        packageSize: rate.packageSize as any,
        basePrice: rate.basePrice,
        pricePerKg: rate.pricePerKg,
        estimatedMinDays: rate.minDays,
        estimatedMaxDays: rate.maxDays,
        cutoffTime: rate.cutoffTime,
        availableRegions: [], // All regions
        isActive: true
      });
    }

    console.log('Shipping module initial data seeded successfully');
  }

  private setupScheduledTasks(): void {
    // Clear expired cache every hour
    setInterval(async () => {
      try {
        const repository = Container.get<ShippingRepository>('ShippingRepository');
        const cleared = await repository.clearExpiredCache();
        console.log(`Cleared ${cleared} expired shipping cache entries`);
      } catch (error) {
        console.error('Failed to clear expired shipping cache:', error);
      }
    }, 60 * 60 * 1000); // 1 hour
  }

  async shutdown(): Promise<void> {
    // Cleanup resources
    console.log('Shipping module shutting down');
  }
}