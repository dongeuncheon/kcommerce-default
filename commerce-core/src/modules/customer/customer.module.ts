import { BaseModule } from '../../core/module/base.module';
import { DatabaseAdapter } from '../../adapters/database.adapter';
import { CustomerRepository } from './customer.repository';
import { CustomerService } from './customer.service';
import { CustomerController } from './customer.controller';

export class CustomerModule extends BaseModule {
  name = 'customers';
  private customerRepository!: CustomerRepository;
  private customerService!: CustomerService;
  private customerController!: CustomerController;
  
  async initialize(): Promise<void> {
    // Initialize dependencies
    const databaseAdapter = this.container.get<DatabaseAdapter>('DatabaseAdapter');
    this.customerRepository = new CustomerRepository(databaseAdapter);
    this.customerService = new CustomerService(this.customerRepository);
    this.customerController = new CustomerController(this.customerService);

    // Register services in container
    this.container.register('CustomerRepository', this.customerRepository);
    this.container.register('CustomerService', this.customerService);
    this.container.register('CustomerController', this.customerController);

    // Define routes
    this.routes = [
      // Customer CRUD
      {
        method: 'GET',
        path: '/',
        handler: this.customerController.getCustomers.bind(this.customerController),
        schema: {
          querystring: {
            type: 'object',
            properties: {
              search: { type: 'string' },
              email: { type: 'string' },
              phone: { type: 'string' },
              isActive: { type: 'boolean' },
              isVerified: { type: 'boolean' },
              tierId: { type: 'string' },
              priority: { type: 'string', enum: ['low', 'normal', 'high', 'vip'] },
              source: { type: 'string' },
              language: { type: 'string' },
              city: { type: 'string' },
              district: { type: 'string' },
              minTotalSpent: { type: 'number' },
              maxTotalSpent: { type: 'number' },
              minOrderCount: { type: 'number' },
              maxOrderCount: { type: 'number' },
              registeredAfter: { type: 'string', format: 'date' },
              registeredBefore: { type: 'string', format: 'date' },
              segments: { type: 'array', items: { type: 'string' } },
              tags: { type: 'array', items: { type: 'string' } },
              sortBy: { type: 'string', default: 'createdAt' },
              sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
              page: { type: 'number', minimum: 1, default: 1 },
              limit: { type: 'number', minimum: 1, maximum: 100, default: 20 }
            }
          }
        }
      },
      {
        method: 'POST',
        path: '/',
        handler: this.customerController.createCustomer.bind(this.customerController),
        schema: {
          body: {
            type: 'object',
            required: ['email', 'phone', 'firstName', 'lastName'],
            properties: {
              email: { type: 'string', format: 'email' },
              phone: { type: 'string' },
              firstName: { type: 'string', minLength: 1 },
              lastName: { type: 'string', minLength: 1 },
              koreanName: { type: 'string' },
              dateOfBirth: { type: 'string', format: 'date' },
              gender: { type: 'string', enum: ['male', 'female', 'other'] },
              language: { type: 'string', default: 'ko' },
              timezone: { type: 'string', default: 'Asia/Seoul' },
              currency: { type: 'string', default: 'KRW' },
              source: { type: 'string' },
              referralCode: { type: 'string' },
              marketingPreferences: {
                type: 'object',
                properties: {
                  email: { type: 'boolean', default: true },
                  sms: { type: 'boolean', default: true },
                  push: { type: 'boolean', default: true },
                  directMail: { type: 'boolean', default: false },
                  marketing: { type: 'boolean', default: false },
                  personalInfoConsent: { type: 'boolean', default: false },
                  marketingConsent: { type: 'boolean', default: false },
                  thirdPartyConsent: { type: 'boolean', default: false }
                }
              }
            }
          }
        }
      },
      {
        method: 'GET',
        path: '/:id',
        handler: this.customerController.getCustomerById.bind(this.customerController),
        schema: {
          params: {
            type: 'object',
            required: ['id'],
            properties: {
              id: { type: 'string' }
            }
          }
        }
      },
      {
        method: 'PUT',
        path: '/:id',
        handler: this.customerController.updateCustomer.bind(this.customerController),
        schema: {
          params: {
            type: 'object',
            required: ['id'],
            properties: {
              id: { type: 'string' }
            }
          },
          body: {
            type: 'object',
            properties: {
              email: { type: 'string', format: 'email' },
              phone: { type: 'string' },
              firstName: { type: 'string' },
              lastName: { type: 'string' },
              koreanName: { type: 'string' },
              dateOfBirth: { type: 'string', format: 'date' },
              gender: { type: 'string', enum: ['male', 'female', 'other'] },
              language: { type: 'string' },
              timezone: { type: 'string' },
              currency: { type: 'string' },
              tags: { type: 'array', items: { type: 'string' } },
              priority: { type: 'string', enum: ['low', 'normal', 'high', 'vip'] },
              isActive: { type: 'boolean' },
              marketingPreferences: {
                type: 'object',
                properties: {
                  email: { type: 'boolean' },
                  sms: { type: 'boolean' },
                  push: { type: 'boolean' },
                  directMail: { type: 'boolean' },
                  marketing: { type: 'boolean' },
                  personalInfoConsent: { type: 'boolean' },
                  marketingConsent: { type: 'boolean' },
                  thirdPartyConsent: { type: 'boolean' }
                }
              }
            }
          }
        }
      },
      {
        method: 'DELETE',
        path: '/:id/deactivate',
        handler: this.customerController.deactivateCustomer.bind(this.customerController)
      },
      {
        method: 'DELETE',
        path: '/:id',
        handler: this.customerController.deleteCustomer.bind(this.customerController)
      },

      // Address management
      {
        method: 'POST',
        path: '/:id/addresses',
        handler: this.customerController.createAddress.bind(this.customerController),
        schema: {
          params: {
            type: 'object',
            required: ['id'],
            properties: {
              id: { type: 'string' }
            }
          },
          body: {
            type: 'object',
            required: ['type', 'zipCode', 'address1', 'city', 'district', 'recipientName', 'recipientPhone'],
            properties: {
              type: { type: 'string', enum: ['home', 'work', 'shipping', 'billing'] },
              isDefault: { type: 'boolean', default: false },
              zipCode: { type: 'string', pattern: '^\\d{5}$' },
              address1: { type: 'string', minLength: 1 },
              address2: { type: 'string' },
              city: { type: 'string', minLength: 1 },
              district: { type: 'string', minLength: 1 },
              neighborhood: { type: 'string' },
              recipientName: { type: 'string', minLength: 1 },
              recipientPhone: { type: 'string' },
              deliveryNote: { type: 'string' }
            }
          }
        }
      },
      {
        method: 'GET',
        path: '/:id/addresses',
        handler: this.customerController.getCustomerAddresses.bind(this.customerController)
      },
      {
        method: 'GET',
        path: '/:id/addresses/:addressId',
        handler: this.customerController.getAddressById.bind(this.customerController)
      },
      {
        method: 'PUT',
        path: '/:id/addresses/:addressId',
        handler: this.customerController.updateAddress.bind(this.customerController)
      },
      {
        method: 'DELETE',
        path: '/:id/addresses/:addressId',
        handler: this.customerController.deleteAddress.bind(this.customerController)
      },
      {
        method: 'PUT',
        path: '/:id/addresses/:addressId/default',
        handler: this.customerController.setDefaultAddress.bind(this.customerController)
      },

      // Loyalty points
      {
        method: 'POST',
        path: '/:id/points',
        handler: this.customerController.addLoyaltyPoints.bind(this.customerController),
        schema: {
          params: {
            type: 'object',
            required: ['id'],
            properties: {
              id: { type: 'string' }
            }
          },
          body: {
            type: 'object',
            required: ['points', 'transactionType', 'transactionAmount', 'description'],
            properties: {
              points: { type: 'number', minimum: 1 },
              transactionType: { type: 'string', enum: ['earned', 'redeemed', 'expired', 'adjusted'] },
              transactionAmount: { type: 'number' },
              orderId: { type: 'string' },
              description: { type: 'string', minLength: 1 },
              expiresAt: { type: 'string', format: 'date-time' }
            }
          }
        }
      },
      {
        method: 'GET',
        path: '/:id/points',
        handler: this.customerController.getCustomerLoyaltyPoints.bind(this.customerController)
      },
      {
        method: 'POST',
        path: '/:id/points/redeem',
        handler: this.customerController.redeemLoyaltyPoints.bind(this.customerController),
        schema: {
          body: {
            type: 'object',
            required: ['points', 'description'],
            properties: {
              points: { type: 'number', minimum: 1 },
              description: { type: 'string', minLength: 1 }
            }
          }
        }
      },

      // Analytics and insights
      {
        method: 'GET',
        path: '/:id/statistics',
        handler: this.customerController.getCustomerStatistics.bind(this.customerController)
      },
      {
        method: 'GET',
        path: '/:id/behavior',
        handler: this.customerController.getCustomerPurchaseBehavior.bind(this.customerController)
      },
      {
        method: 'GET',
        path: '/:id/churn-prediction',
        handler: this.customerController.predictCustomerChurn.bind(this.customerController)
      },
      {
        method: 'GET',
        path: '/:id/lifetime-value',
        handler: this.customerController.calculateLifetimeValue.bind(this.customerController)
      },

      // Customer service
      {
        method: 'POST',
        path: '/:id/notes',
        handler: this.customerController.addCustomerNote.bind(this.customerController),
        schema: {
          body: {
            type: 'object',
            required: ['note'],
            properties: {
              note: { type: 'string', minLength: 1 },
              isInternal: { type: 'boolean', default: false }
            }
          }
        }
      },
      {
        method: 'PUT',
        path: '/:id/priority',
        handler: this.customerController.updateCustomerPriority.bind(this.customerController),
        schema: {
          body: {
            type: 'object',
            required: ['priority'],
            properties: {
              priority: { type: 'string', enum: ['low', 'normal', 'high', 'vip'] }
            }
          }
        }
      },
      {
        method: 'POST',
        path: '/:id/tags',
        handler: this.customerController.addCustomerTags.bind(this.customerController),
        schema: {
          body: {
            type: 'object',
            required: ['tags'],
            properties: {
              tags: { type: 'array', items: { type: 'string' }, minItems: 1 }
            }
          }
        }
      },
      {
        method: 'DELETE',
        path: '/:id/tags',
        handler: this.customerController.removeCustomerTags.bind(this.customerController),
        schema: {
          body: {
            type: 'object',
            required: ['tags'],
            properties: {
              tags: { type: 'array', items: { type: 'string' }, minItems: 1 }
            }
          }
        }
      },

      // Analytics endpoints
      {
        method: 'GET',
        path: '/analytics/overview',
        handler: this.customerController.getCustomerAnalytics.bind(this.customerController)
      },

      // Marketing features
      {
        method: 'POST',
        path: '/marketing/eligible',
        handler: this.customerController.getMarketingEligibleCustomers.bind(this.customerController)
      },

      // Data management
      {
        method: 'GET',
        path: '/export',
        handler: this.customerController.exportCustomers.bind(this.customerController)
      },
      {
        method: 'POST',
        path: '/import',
        handler: this.customerController.importCustomers.bind(this.customerController),
        schema: {
          body: {
            type: 'object',
            required: ['customers'],
            properties: {
              customers: {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['email', 'phone', 'firstName', 'lastName'],
                  properties: {
                    email: { type: 'string', format: 'email' },
                    phone: { type: 'string' },
                    firstName: { type: 'string' },
                    lastName: { type: 'string' },
                    koreanName: { type: 'string' }
                  }
                }
              }
            }
          }
        }
      },

      // Utility endpoints
      {
        method: 'GET',
        path: '/tiers',
        handler: this.customerController.getTiers.bind(this.customerController)
      },
      {
        method: 'GET',
        path: '/segments',
        handler: this.customerController.getSegments.bind(this.customerController)
      }
    ];
  }

  async setupDatabase(): Promise<void> {
    // Create database tables if they don't exist
    const schemas = [
      'CustomerEntity',
      'CustomerAddressEntity', 
      'CustomerLoyaltyPointsEntity',
      'CustomerTierEntity',
      'CustomerSegmentEntity'
    ];

    for (const schema of schemas) {
      // This would be implemented by the database adapter
      // await this.databaseAdapter.createTable(schema);
    }
  }
}