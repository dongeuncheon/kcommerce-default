/**
 * Shipping Module Controller
 * API endpoints for shipping operations
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { inject, injectable } from '../../core/di/decorators';
import { ShippingService } from './shipping.service';
import {
  ShippingCalculationRequest,
  ShippingCalculationResponse,
  TrackingResponse,
  ShippingEstimateRequest,
  ShippingEstimateResponse,
  KoreanAddress,
  AddressValidationResponse,
  ShippingStatus,
  ShippingWebhookPayload,
  BulkShippingRequest,
  Shipment,
  ShippingZone,
  ShippingProviderConfig,
  ReturnShipment
} from './shipping.types';
import { authMiddleware } from '../auth/auth.middleware';
import { 
  shippingCalculationSchema,
  shippingEstimateSchema,
  addressValidationSchema,
  createShipmentSchema,
  updateStatusSchema,
  webhookSchema,
  bulkShippingSchema
} from './shipping.schemas';

@injectable()
export class ShippingController {
  constructor(
    @inject('ShippingService') private shippingService: ShippingService
  ) {}

  /**
   * Register routes
   */
  async registerRoutes(fastify: FastifyInstance): Promise<void> {
    // Public routes
    fastify.post('/api/shipping/calculate', {
      schema: {
        body: shippingCalculationSchema,
        response: {
          200: {
            type: 'object',
            properties: {
              requestId: { type: 'string' },
              options: { type: 'array' },
              recommendedOption: { type: 'object' },
              freeShippingAvailable: { type: 'boolean' },
              freeShippingThreshold: { type: 'number' },
              calculatedAt: { type: 'string' }
            }
          }
        }
      },
      preHandler: [validateRequest(shippingCalculationSchema)]
    }, this.calculateShipping.bind(this));

    fastify.post('/api/shipping/estimate', {
      schema: {
        body: shippingEstimateSchema,
        response: {
          200: {
            type: 'object',
            properties: {
              standardShipping: {
                type: 'object',
                properties: {
                  price: { type: 'number' },
                  estimatedDays: { type: 'number' }
                }
              },
              expressShipping: {
                type: 'object',
                properties: {
                  price: { type: 'number' },
                  estimatedDays: { type: 'number' }
                }
              },
              dawnDelivery: {
                type: 'object',
                properties: {
                  price: { type: 'number' },
                  cutoffTime: { type: 'string' },
                  available: { type: 'boolean' }
                }
              }
            }
          }
        }
      },
      preHandler: [validateRequest(shippingEstimateSchema)]
    }, this.estimateShipping.bind(this));

    fastify.get('/api/shipping/providers', {
      schema: {
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                provider: { type: 'string' },
                displayName: { type: 'string' },
                supportedServices: { type: 'array', items: { type: 'string' } },
                features: { type: 'object' }
              }
            }
          }
        }
      }
    }, this.getProviders.bind(this));

    fastify.get('/api/shipping/zones', {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            region: { type: 'string' }
          }
        },
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                code: { type: 'string' },
                regions: { type: 'array', items: { type: 'string' } },
                baseShippingRate: { type: 'number' },
                additionalRatePerKg: { type: 'number' },
                estimatedDays: { type: 'number' }
              }
            }
          }
        }
      }
    }, this.getZones.bind(this));

    fastify.post('/api/shipping/track', {
      schema: {
        body: {
          type: 'object',
          required: ['trackingNumber'],
          properties: {
            trackingNumber: { type: 'string' }
          }
        }
      }
    }, this.trackShipment.bind(this));

    fastify.get('/api/shipping/track/:trackingNumber', {
      schema: {
        params: {
          type: 'object',
          required: ['trackingNumber'],
          properties: {
            trackingNumber: { type: 'string' }
          }
        }
      }
    }, this.getTracking.bind(this));

    fastify.get('/api/shipping/options', {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            region: { type: 'string' },
            weight: { type: 'number' },
            serviceType: { type: 'string' }
          }
        }
      }
    }, this.getShippingOptions.bind(this));

    fastify.post('/api/shipping/validate-address', {
      schema: {
        body: addressValidationSchema
      },
      preHandler: [validateRequest(addressValidationSchema)]
    }, this.validateAddress.bind(this));

    // Webhook endpoint
    fastify.post('/api/shipping/webhook/:provider', {
      schema: {
        params: {
          type: 'object',
          required: ['provider'],
          properties: {
            provider: { type: 'string' }
          }
        },
        body: webhookSchema
      }
    }, this.handleWebhook.bind(this));

    // Protected routes (require authentication)
    fastify.register(async (protectedRoutes) => {
      protectedRoutes.addHook('preHandler', authMiddleware);

      // Create shipment
      protectedRoutes.post('/api/shipping', {
        schema: {
          body: createShipmentSchema
        },
        preHandler: [validateRequest(createShipmentSchema)]
      }, this.createShipment.bind(this));

      // Update shipment status
      protectedRoutes.put('/api/shipping/:id/status', {
        schema: {
          params: {
            type: 'object',
            required: ['id'],
            properties: {
              id: { type: 'string' }
            }
          },
          body: updateStatusSchema
        },
        preHandler: [validateRequest(updateStatusSchema)]
      }, this.updateStatus.bind(this));

      // Get shipment by ID
      protectedRoutes.get('/api/shipping/:id', {
        schema: {
          params: {
            type: 'object',
            required: ['id'],
            properties: {
              id: { type: 'string' }
            }
          }
        }
      }, this.getShipment.bind(this));

      // Get shipments by order ID
      protectedRoutes.get('/api/shipping/order/:orderId', {
        schema: {
          params: {
            type: 'object',
            required: ['orderId'],
            properties: {
              orderId: { type: 'string' }
            }
          }
        }
      }, this.getShipmentsByOrder.bind(this));

      // Create return shipment
      protectedRoutes.post('/api/shipping/:id/return', {
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
            required: ['reason'],
            properties: {
              reason: { type: 'string' }
            }
          }
        }
      }, this.createReturn.bind(this));

      // Get shipping label
      protectedRoutes.get('/api/shipping/:id/label', {
        schema: {
          params: {
            type: 'object',
            required: ['id'],
            properties: {
              id: { type: 'string' }
            }
          }
        }
      }, this.getLabel.bind(this));

      // Bulk shipping operations
      protectedRoutes.post('/api/shipping/bulk', {
        schema: {
          body: bulkShippingSchema
        },
        preHandler: [validateRequest(bulkShippingSchema)]
      }, this.createBulkShipments.bind(this));

      // Customer addresses
      protectedRoutes.get('/api/shipping/addresses/:customerId', {
        schema: {
          params: {
            type: 'object',
            required: ['customerId'],
            properties: {
              customerId: { type: 'string' }
            }
          }
        }
      }, this.getCustomerAddresses.bind(this));

      protectedRoutes.post('/api/shipping/addresses', {
        schema: {
          body: addressValidationSchema
        },
        preHandler: [validateRequest(addressValidationSchema)]
      }, this.saveAddress.bind(this));

      // Analytics endpoints
      protectedRoutes.get('/api/shipping/analytics/stats', {
        schema: {
          querystring: {
            type: 'object',
            required: ['startDate', 'endDate'],
            properties: {
              startDate: { type: 'string', format: 'date' },
              endDate: { type: 'string', format: 'date' }
            }
          }
        }
      }, this.getShippingStats.bind(this));

      protectedRoutes.get('/api/shipping/analytics/volume', {
        schema: {
          querystring: {
            type: 'object',
            required: ['startDate', 'endDate'],
            properties: {
              startDate: { type: 'string', format: 'date' },
              endDate: { type: 'string', format: 'date' }
            }
          }
        }
      }, this.getShippingVolume.bind(this));
    });
  }

  /**
   * Calculate shipping options
   */
  private async calculateShipping(
    request: FastifyRequest<{ Body: ShippingCalculationRequest }>,
    reply: FastifyReply
  ): Promise<ShippingCalculationResponse> {
    try {
      const result = await this.shippingService.calculateShipping(request.body);
      return reply.send(result);
    } catch (error) {
      return reply.code(400).send({
        error: 'Failed to calculate shipping',
        message: error.message
      });
    }
  }

  /**
   * Estimate shipping cost
   */
  private async estimateShipping(
    request: FastifyRequest<{ Body: ShippingEstimateRequest }>,
    reply: FastifyReply
  ): Promise<ShippingEstimateResponse> {
    try {
      const result = await this.shippingService.estimateShipping(request.body);
      return reply.send(result);
    } catch (error) {
      return reply.code(400).send({
        error: 'Failed to estimate shipping',
        message: error.message
      });
    }
  }

  /**
   * Get shipping providers
   */
  private async getProviders(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<ShippingProviderConfig[]> {
    try {
      const providers = await this.shippingService.getShippingProviders();
      return reply.send(providers);
    } catch (error) {
      return reply.code(500).send({
        error: 'Failed to get shipping providers',
        message: error.message
      });
    }
  }

  /**
   * Get shipping zones
   */
  private async getZones(
    request: FastifyRequest<{ Querystring: { region?: string } }>,
    reply: FastifyReply
  ): Promise<ShippingZone[]> {
    try {
      const zones = await this.shippingService.getShippingZones(request.query.region);
      return reply.send(zones);
    } catch (error) {
      return reply.code(500).send({
        error: 'Failed to get shipping zones',
        message: error.message
      });
    }
  }

  /**
   * Track shipment (POST)
   */
  private async trackShipment(
    request: FastifyRequest<{ Body: { trackingNumber: string } }>,
    reply: FastifyReply
  ): Promise<TrackingResponse> {
    try {
      const result = await this.shippingService.trackShipment(request.body.trackingNumber);
      return reply.send(result);
    } catch (error) {
      return reply.code(404).send({
        error: 'Shipment not found',
        message: error.message
      });
    }
  }

  /**
   * Get tracking information (GET)
   */
  private async getTracking(
    request: FastifyRequest<{ Params: { trackingNumber: string } }>,
    reply: FastifyReply
  ): Promise<TrackingResponse> {
    try {
      const result = await this.shippingService.trackShipment(request.params.trackingNumber);
      return reply.send(result);
    } catch (error) {
      return reply.code(404).send({
        error: 'Shipment not found',
        message: error.message
      });
    }
  }

  /**
   * Get shipping options
   */
  private async getShippingOptions(
    request: FastifyRequest<{ 
      Querystring: { 
        region?: string;
        weight?: number;
        serviceType?: string;
      } 
    }>,
    reply: FastifyReply
  ): Promise<any> {
    try {
      // This would typically call a method to get filtered shipping options
      const options = await this.shippingService.getShippingOptions(request.query);
      return reply.send(options);
    } catch (error) {
      return reply.code(500).send({
        error: 'Failed to get shipping options',
        message: error.message
      });
    }
  }

  /**
   * Validate address
   */
  private async validateAddress(
    request: FastifyRequest<{ Body: KoreanAddress }>,
    reply: FastifyReply
  ): Promise<AddressValidationResponse> {
    try {
      const result = await this.shippingService.validateKoreanAddress(request.body);
      return reply.send(result);
    } catch (error) {
      return reply.code(400).send({
        error: 'Address validation failed',
        message: error.message
      });
    }
  }

  /**
   * Handle webhook from shipping provider
   */
  private async handleWebhook(
    request: FastifyRequest<{ 
      Params: { provider: string };
      Body: any;
    }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const payload: ShippingWebhookPayload = {
        event: request.body.event,
        shipmentId: request.body.shipmentId,
        trackingNumber: request.body.trackingNumber,
        provider: request.params.provider as any,
        timestamp: new Date(request.body.timestamp),
        data: request.body.data
      };

      await this.shippingService.handleWebhook(payload);
      return reply.code(200).send({ success: true });
    } catch (error) {
      return reply.code(500).send({
        error: 'Failed to process webhook',
        message: error.message
      });
    }
  }

  /**
   * Create shipment
   */
  private async createShipment(
    request: FastifyRequest<{ Body: any }>,
    reply: FastifyReply
  ): Promise<Shipment> {
    try {
      const shipment = await this.shippingService.createShipment({
        ...request.body,
        customerId: request.user.id
      });
      return reply.code(201).send(shipment);
    } catch (error) {
      return reply.code(400).send({
        error: 'Failed to create shipment',
        message: error.message
      });
    }
  }

  /**
   * Update shipment status
   */
  private async updateStatus(
    request: FastifyRequest<{ 
      Params: { id: string };
      Body: { status: ShippingStatus; actualDeliveryDate?: string };
    }>,
    reply: FastifyReply
  ): Promise<Shipment> {
    try {
      const actualDeliveryDate = request.body.actualDeliveryDate 
        ? new Date(request.body.actualDeliveryDate)
        : undefined;

      const shipment = await this.shippingService.updateShipmentStatus(
        request.params.id,
        request.body.status,
        actualDeliveryDate
      );
      return reply.send(shipment);
    } catch (error) {
      return reply.code(400).send({
        error: 'Failed to update shipment status',
        message: error.message
      });
    }
  }

  /**
   * Get shipment by ID
   */
  private async getShipment(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<Shipment> {
    try {
      const shipment = await this.shippingService.getShipmentById(request.params.id);
      if (!shipment) {
        return reply.code(404).send({
          error: 'Shipment not found'
        });
      }
      return reply.send(shipment);
    } catch (error) {
      return reply.code(500).send({
        error: 'Failed to get shipment',
        message: error.message
      });
    }
  }

  /**
   * Get shipments by order ID
   */
  private async getShipmentsByOrder(
    request: FastifyRequest<{ Params: { orderId: string } }>,
    reply: FastifyReply
  ): Promise<Shipment[]> {
    try {
      const shipments = await this.shippingService.getShipmentsByOrderId(request.params.orderId);
      return reply.send(shipments);
    } catch (error) {
      return reply.code(500).send({
        error: 'Failed to get shipments',
        message: error.message
      });
    }
  }

  /**
   * Create return shipment
   */
  private async createReturn(
    request: FastifyRequest<{ 
      Params: { id: string };
      Body: { reason: string };
    }>,
    reply: FastifyReply
  ): Promise<ReturnShipment> {
    try {
      const returnShipment = await this.shippingService.createReturnShipment(
        request.params.id,
        request.body.reason
      );
      return reply.code(201).send(returnShipment);
    } catch (error) {
      return reply.code(400).send({
        error: 'Failed to create return shipment',
        message: error.message
      });
    }
  }

  /**
   * Get shipping label
   */
  private async getLabel(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<any> {
    try {
      const label = await this.shippingService.getShippingLabel(request.params.id);
      if (!label) {
        return reply.code(404).send({
          error: 'Shipping label not found'
        });
      }
      return reply.send(label);
    } catch (error) {
      return reply.code(500).send({
        error: 'Failed to get shipping label',
        message: error.message
      });
    }
  }

  /**
   * Create bulk shipments
   */
  private async createBulkShipments(
    request: FastifyRequest<{ Body: BulkShippingRequest }>,
    reply: FastifyReply
  ): Promise<any> {
    try {
      const results = await this.shippingService.createBulkShipments(request.body);
      return reply.send({
        total: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results
      });
    } catch (error) {
      return reply.code(500).send({
        error: 'Failed to create bulk shipments',
        message: error.message
      });
    }
  }

  /**
   * Get customer addresses
   */
  private async getCustomerAddresses(
    request: FastifyRequest<{ Params: { customerId: string } }>,
    reply: FastifyReply
  ): Promise<any> {
    try {
      const addresses = await this.shippingService.getCustomerAddresses(request.params.customerId);
      return reply.send(addresses);
    } catch (error) {
      return reply.code(500).send({
        error: 'Failed to get customer addresses',
        message: error.message
      });
    }
  }

  /**
   * Save address
   */
  private async saveAddress(
    request: FastifyRequest<{ Body: KoreanAddress }>,
    reply: FastifyReply
  ): Promise<any> {
    try {
      const address = await this.shippingService.saveCustomerAddress({
        ...request.body,
        customerId: request.user.id
      });
      return reply.code(201).send(address);
    } catch (error) {
      return reply.code(400).send({
        error: 'Failed to save address',
        message: error.message
      });
    }
  }

  /**
   * Get shipping statistics
   */
  private async getShippingStats(
    request: FastifyRequest<{ 
      Querystring: { startDate: string; endDate: string };
    }>,
    reply: FastifyReply
  ): Promise<any> {
    try {
      const stats = await this.shippingService.getShippingStats(
        new Date(request.query.startDate),
        new Date(request.query.endDate)
      );
      return reply.send(stats);
    } catch (error) {
      return reply.code(500).send({
        error: 'Failed to get shipping statistics',
        message: error.message
      });
    }
  }

  /**
   * Get shipping volume by region
   */
  private async getShippingVolume(
    request: FastifyRequest<{ 
      Querystring: { startDate: string; endDate: string };
    }>,
    reply: FastifyReply
  ): Promise<any> {
    try {
      const volume = await this.shippingService.getShippingVolumeByRegion(
        new Date(request.query.startDate),
        new Date(request.query.endDate)
      );
      return reply.send(volume);
    } catch (error) {
      return reply.code(500).send({
        error: 'Failed to get shipping volume',
        message: error.message
      });
    }
  }
}

