/**
 * Shipping Module Validation Schemas
 * JSON Schema definitions for request validation
 */

export const shippingCalculationSchema = {
  type: 'object',
  required: ['fromAddress', 'toAddress', 'items'],
  properties: {
    fromAddress: { type: 'object' },
    toAddress: { type: 'object' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        required: ['productId', 'productName', 'quantity', 'weight', 'value'],
        properties: {
          productId: { type: 'string' },
          productName: { type: 'string' },
          quantity: { type: 'number', minimum: 1 },
          weight: { type: 'number', minimum: 0 },
          dimensions: {
            type: 'object',
            properties: {
              length: { type: 'number', minimum: 0 },
              width: { type: 'number', minimum: 0 },
              height: { type: 'number', minimum: 0 }
            }
          },
          value: { type: 'number', minimum: 0 },
          isFragile: { type: 'boolean' },
          requiresColdChain: { type: 'boolean' },
          specialInstructions: { type: 'string', maxLength: 500 }
        }
      }
    },
    serviceType: { 
      type: 'string',
      enum: ['standard', 'express', 'dawn', 'next_day', 'same_day']
    },
    preferredProviders: {
      type: 'array',
      items: { 
        type: 'string',
        enum: ['cj_logistics', 'hanjin', 'logen', 'korea_post', 'lotte', 'coupang_rocket', 'dawn_delivery']
      }
    }
  }
};

export const shippingEstimateSchema = {
  type: 'object',
  properties: {
    postalCode: { 
      type: 'string',
      pattern: '^[0-9]{5}$'
    },
    region: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        required: ['weight', 'quantity'],
        properties: {
          weight: { type: 'number', minimum: 0 },
          quantity: { type: 'number', minimum: 1 }
        }
      }
    }
  }
};

export const addressValidationSchema = {
  type: 'object',
  required: ['postalCode', 'sido', 'sigungu', 'eupmyeondong', 'receiverName', 'receiverPhone'],
  properties: {
    postalCode: { 
      type: 'string', 
      pattern: '^[0-9]{5}$' 
    },
    sido: { 
      type: 'string',
      minLength: 1,
      maxLength: 50
    },
    sigungu: { 
      type: 'string',
      minLength: 1,
      maxLength: 50
    },
    eupmyeondong: { 
      type: 'string',
      minLength: 1,
      maxLength: 50
    },
    streetName: { 
      type: 'string',
      maxLength: 100
    },
    streetNumber: { 
      type: 'string',
      maxLength: 20
    },
    buildingName: { 
      type: 'string',
      maxLength: 100
    },
    apartmentName: { 
      type: 'string',
      maxLength: 100
    },
    dongNumber: { 
      type: 'string',
      maxLength: 10
    },
    hoNumber: { 
      type: 'string',
      maxLength: 10
    },
    detailAddress: { 
      type: 'string',
      maxLength: 200
    },
    receiverName: { 
      type: 'string',
      minLength: 1,
      maxLength: 100
    },
    receiverPhone: { 
      type: 'string',
      pattern: '^(01[016789]{1}|02|0[3-9]{1}[0-9]{1})-?[0-9]{3,4}-?[0-9]{4}$'
    },
    deliveryInstructions: { 
      type: 'string',
      maxLength: 500
    },
    isDefault: { type: 'boolean' }
  }
};

export const createShipmentSchema = {
  type: 'object',
  required: ['orderId', 'fromAddress', 'toAddress', 'items', 'provider', 'serviceType'],
  properties: {
    orderId: { 
      type: 'string',
      format: 'uuid'
    },
    fromAddress: { type: 'object' },
    toAddress: { type: 'object' },
    items: { 
      type: 'array',
      minItems: 1
    },
    provider: { 
      type: 'string',
      enum: ['cj_logistics', 'hanjin', 'logen', 'korea_post', 'lotte', 'coupang_rocket', 'dawn_delivery']
    },
    serviceType: { 
      type: 'string',
      enum: ['standard', 'express', 'dawn', 'next_day', 'same_day']
    }
  }
};

export const updateStatusSchema = {
  type: 'object',
  required: ['status'],
  properties: {
    status: { 
      type: 'string',
      enum: ['pending', 'ready_for_pickup', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'failed', 'returned', 'cancelled']
    },
    actualDeliveryDate: { 
      type: 'string', 
      format: 'date-time' 
    }
  }
};

export const webhookSchema = {
  type: 'object',
  required: ['event', 'shipmentId', 'trackingNumber', 'timestamp'],
  properties: {
    event: { 
      type: 'string',
      enum: ['status_update', 'delivery_completed', 'delivery_failed', 'return_requested']
    },
    shipmentId: { 
      type: 'string',
      format: 'uuid'
    },
    trackingNumber: { type: 'string' },
    timestamp: { type: 'string' },
    data: { type: 'object' }
  }
};

export const bulkShippingSchema = {
  type: 'object',
  required: ['shipments', 'provider'],
  properties: {
    shipments: {
      type: 'array',
      minItems: 1,
      maxItems: 100,
      items: {
        type: 'object',
        required: ['orderId', 'toAddress', 'items', 'serviceType'],
        properties: {
          orderId: { 
            type: 'string',
            format: 'uuid'
          },
          toAddress: { type: 'object' },
          items: { 
            type: 'array',
            minItems: 1
          },
          serviceType: { 
            type: 'string',
            enum: ['standard', 'express', 'dawn', 'next_day', 'same_day']
          }
        }
      }
    },
    provider: { 
      type: 'string',
      enum: ['cj_logistics', 'hanjin', 'logen', 'korea_post', 'lotte', 'coupang_rocket', 'dawn_delivery']
    }
  }
};