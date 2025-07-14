import { prismaMock } from '../../../jest.setup'
import { ShippingService } from '../../../src/services/shippingService'
import { AppError } from '../../../src/middleware/error'
import { CalculateRatesInput, CreateShipmentInput, UpdateShipmentInput } from '../../../src/types/shipping'

// Mock the logger
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}))

describe('ShippingService', () => {
  let shippingService: ShippingService

  beforeEach(() => {
    shippingService = new ShippingService()
    jest.clearAllMocks()
  })

  describe('calculateRates', () => {
    const mockRateData: CalculateRatesInput = {
      origin: {
        street1: '123 Warehouse St',
        city: 'Seoul',
        state: 'Seoul',
        postalCode: '12345',
        country: 'KR',
      },
      destination: {
        street1: '456 Customer Ave',
        city: 'Los Angeles',
        state: 'CA',
        postalCode: '90210',
        country: 'US',
      },
      packages: [
        {
          weight: 1.5,
          weightUnit: 'kg',
          length: 10,
          width: 8,
          height: 6,
          dimensionUnit: 'cm',
          value: 99.99,
          currency: 'USD',
        },
      ],
    }

    it('should calculate shipping rates successfully', async () => {
      const rates = await shippingService.calculateRates(mockRateData)

      expect(rates).toBeInstanceOf(Array)
      expect(rates.length).toBeGreaterThan(0)
      
      const firstRate = rates[0]
      expect(firstRate).toHaveProperty('carrier')
      expect(firstRate).toHaveProperty('service')
      expect(firstRate).toHaveProperty('cost')
      expect(firstRate).toHaveProperty('currency')
      expect(firstRate).toHaveProperty('estimatedDays')
      expect(firstRate).toHaveProperty('guaranteed')
      expect(typeof firstRate.cost).toBe('number')
      expect(firstRate.cost).toBeGreaterThan(0)
    })

    it('should filter rates by requested services', async () => {
      const rateDataWithFilter = {
        ...mockRateData,
        services: ['EXPRESS' as const, 'OVERNIGHT' as const],
      }

      const rates = await shippingService.calculateRates(rateDataWithFilter)

      expect(rates.length).toBeGreaterThan(0)
      rates.forEach(rate => {
        expect(['EXPRESS', 'OVERNIGHT']).toContain(rate.service)
      })
    })

    it('should sort rates by cost ascending', async () => {
      const rates = await shippingService.calculateRates(mockRateData)

      for (let i = 1; i < rates.length; i++) {
        expect(rates[i].cost).toBeGreaterThanOrEqual(rates[i - 1].cost)
      }
    })

    it('should validate package weight limits', async () => {
      const invalidRateData = {
        ...mockRateData,
        packages: [
          {
            ...mockRateData.packages[0],
            weight: 100, // Exceeds max weight
          },
        ],
      }

      await expect(shippingService.calculateRates(invalidRateData))
        .rejects.toThrow(AppError)
    })

    it('should validate package dimensions', async () => {
      const invalidRateData = {
        ...mockRateData,
        packages: [
          {
            ...mockRateData.packages[0],
            length: -1, // Invalid negative dimension
          },
        ],
      }

      await expect(shippingService.calculateRates(invalidRateData))
        .rejects.toThrow(AppError)
    })

    it('should validate package value', async () => {
      const invalidRateData = {
        ...mockRateData,
        packages: [
          {
            ...mockRateData.packages[0],
            value: 0, // Invalid zero value
          },
        ],
      }

      await expect(shippingService.calculateRates(invalidRateData))
        .rejects.toThrow(AppError)
    })
  })

  describe('createShipment', () => {
    const mockOrderData = {
      id: 'order-123',
      status: 'PENDING',
      items: [
        {
          product: {
            id: 'product-123',
            weight: 1.5,
          },
        },
      ],
      shippingAddress: {
        street1: '456 Customer Ave',
        city: 'Los Angeles',
        state: 'CA',
        postalCode: '90210',
        country: 'US',
        firstName: 'John',
        lastName: 'Doe',
      },
    }

    const mockShipmentData: CreateShipmentInput = {
      orderId: 'order-123',
      carrier: 'UPS',
      service: 'STANDARD',
      packageInfo: {
        weight: 1.5,
        weightUnit: 'kg',
        length: 10,
        width: 8,
        height: 6,
        dimensionUnit: 'cm',
        value: 99.99,
        currency: 'USD',
      },
      labelFormat: 'PDF',
      insurance: false,
      signature: false,
      saturdayDelivery: false,
    }

    beforeEach(() => {
      prismaMock.order.findUnique.mockResolvedValue(mockOrderData as any)
      prismaMock.$transaction.mockImplementation(async (callback) => {
        return await callback(prismaMock)
      })
    })

    it('should create shipment successfully', async () => {
      const mockCreatedShipment = {
        id: 'shipment-123',
        orderId: 'order-123',
        trackingNumber: 'UPS123456789',
        carrier: 'UPS',
        method: 'STANDARD',
        status: 'PENDING',
        cost: 15.99,
        currency: 'USD',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      prismaMock.shipment.create.mockResolvedValue(mockCreatedShipment as any)
      prismaMock.trackingEvent.create.mockResolvedValue({} as any)
      prismaMock.order.update.mockResolvedValue({} as any)
      prismaMock.orderTimeline.create.mockResolvedValue({} as any)

      // Mock the getShipmentById method
      const mockShipmentDetails = {
        ...mockCreatedShipment,
        serviceName: 'UPS Ground',
        trackingUrl: 'https://www.ups.com/track?trackingNumber=UPS123456789',
        packageInfo: mockShipmentData.packageInfo,
        insurance: false,
        signature: false,
        saturdayDelivery: false,
        order: {
          id: 'order-123',
          orderNumber: 'ORD-20241205-0001',
          status: 'PROCESSING',
        },
      }
      
      prismaMock.shipment.findUnique.mockResolvedValue({
        ...mockCreatedShipment,
        order: {
          orderNumber: 'ORD-20241205-0001',
        },
        metadata: {
          packageInfo: mockShipmentData.packageInfo,
          insurance: false,
          signature: false,
          saturdayDelivery: false,
        },
      } as any)

      const result = await shippingService.createShipment(mockShipmentData)

      expect(result).toHaveProperty('id')
      expect(result).toHaveProperty('trackingNumber')
      expect(result.carrier).toBe('UPS')
      expect(result.service).toBe('STANDARD')
      expect(prismaMock.shipment.create).toHaveBeenCalledTimes(1)
      expect(prismaMock.trackingEvent.create).toHaveBeenCalledTimes(1)
      expect(prismaMock.order.update).toHaveBeenCalledWith({
        where: { id: 'order-123' },
        data: { status: 'PROCESSING' },
      })
    })

    it('should throw error for non-existent order', async () => {
      prismaMock.order.findUnique.mockResolvedValue(null)

      await expect(shippingService.createShipment(mockShipmentData))
        .rejects.toThrow(new AppError('Order not found', 404))
    })

    it('should throw error for cancelled order', async () => {
      const cancelledOrder = {
        ...mockOrderData,
        status: 'CANCELLED',
      }
      prismaMock.order.findUnique.mockResolvedValue(cancelledOrder as any)

      await expect(shippingService.createShipment(mockShipmentData))
        .rejects.toThrow(new AppError('Cannot create shipment for cancelled or refunded order', 400))
    })

    it('should throw error for refunded order', async () => {
      const refundedOrder = {
        ...mockOrderData,
        status: 'REFUNDED',
      }
      prismaMock.order.findUnique.mockResolvedValue(refundedOrder as any)

      await expect(shippingService.createShipment(mockShipmentData))
        .rejects.toThrow(new AppError('Cannot create shipment for cancelled or refunded order', 400))
    })
  })

  describe('updateShipment', () => {
    const mockExistingShipment = {
      id: 'shipment-123',
      orderId: 'order-123',
      trackingNumber: 'UPS123456789',
      carrier: 'UPS',
      method: 'STANDARD',
      status: 'SHIPPED',
      cost: 15.99,
      currency: 'USD',
      metadata: {},
      order: { id: 'order-123' },
    }

    const mockUpdateData: UpdateShipmentInput = {
      status: 'DELIVERED',
      actualDelivery: '2024-12-05T10:00:00Z',
      notes: 'Package delivered successfully',
    }

    beforeEach(() => {
      prismaMock.shipment.findUnique.mockResolvedValue(mockExistingShipment as any)
      prismaMock.$transaction.mockImplementation(async (callback) => {
        return await callback(prismaMock)
      })
    })

    it('should update shipment successfully', async () => {
      const mockUpdatedShipment = {
        ...mockExistingShipment,
        status: 'DELIVERED',
        actualDelivery: new Date('2024-12-05T10:00:00Z'),
        notes: 'Package delivered successfully',
      }

      prismaMock.shipment.update.mockResolvedValue(mockUpdatedShipment as any)
      prismaMock.trackingEvent.create.mockResolvedValue({} as any)
      prismaMock.order.update.mockResolvedValue({} as any)
      prismaMock.orderTimeline.create.mockResolvedValue({} as any)

      // Mock getShipmentById
      prismaMock.shipment.findUnique.mockResolvedValueOnce({
        ...mockUpdatedShipment,
        order: {
          orderNumber: 'ORD-20241205-0001',
        },
        metadata: {},
      } as any)

      const result = await shippingService.updateShipment('shipment-123', mockUpdateData)

      expect(result.status).toBe('DELIVERED')
      expect(prismaMock.shipment.update).toHaveBeenCalledTimes(1)
      expect(prismaMock.trackingEvent.create).toHaveBeenCalledTimes(1)
      expect(prismaMock.order.update).toHaveBeenCalledWith({
        where: { id: 'order-123' },
        data: { status: 'DELIVERED' },
      })
    })

    it('should throw error for non-existent shipment', async () => {
      prismaMock.shipment.findUnique.mockResolvedValue(null)

      await expect(shippingService.updateShipment('non-existent', mockUpdateData))
        .rejects.toThrow(new AppError('Shipment not found', 404))
    })

    it('should create tracking event when status changes', async () => {
      const mockUpdatedShipment = {
        ...mockExistingShipment,
        status: 'IN_TRANSIT',
      }

      prismaMock.shipment.update.mockResolvedValue(mockUpdatedShipment as any)
      prismaMock.trackingEvent.create.mockResolvedValue({} as any)

      // Mock getShipmentById
      prismaMock.shipment.findUnique.mockResolvedValueOnce({
        ...mockUpdatedShipment,
        order: {
          orderNumber: 'ORD-20241205-0001',
        },
        metadata: {},
      } as any)

      await shippingService.updateShipment('shipment-123', { status: 'IN_TRANSIT' })

      expect(prismaMock.trackingEvent.create).toHaveBeenCalledWith({
        data: {
          shipmentId: 'shipment-123',
          status: 'IN_TRANSIT',
          description: 'Package is in transit',
          timestamp: expect.any(Date),
        },
      })
    })

    it('should not create tracking event when status unchanged', async () => {
      const mockUpdatedShipment = {
        ...mockExistingShipment,
        notes: 'Updated notes',
      }

      prismaMock.shipment.update.mockResolvedValue(mockUpdatedShipment as any)

      // Mock getShipmentById
      prismaMock.shipment.findUnique.mockResolvedValueOnce({
        ...mockUpdatedShipment,
        order: {
          orderNumber: 'ORD-20241205-0001',
        },
        metadata: {},
      } as any)

      await shippingService.updateShipment('shipment-123', { notes: 'Updated notes' })

      expect(prismaMock.trackingEvent.create).not.toHaveBeenCalled()
    })
  })

  describe('getShipmentById', () => {
    it('should return shipment details', async () => {
      const mockShipment = {
        id: 'shipment-123',
        orderId: 'order-123',
        trackingNumber: 'UPS123456789',
        carrier: 'UPS',
        method: 'STANDARD',
        status: 'SHIPPED',
        cost: 15.99,
        currency: 'USD',
        estimatedDelivery: new Date(),
        actualDelivery: null,
        notes: 'Test notes',
        metadata: {
          packageInfo: {
            weight: 1.5,
            weightUnit: 'kg',
          },
          insurance: false,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        order: {
          id: 'order-123',
          orderNumber: 'ORD-20241205-0001',
          status: 'PROCESSING',
        },
      }

      prismaMock.shipment.findUnique.mockResolvedValue(mockShipment as any)

      const result = await shippingService.getShipmentById('shipment-123')

      expect(result).toHaveProperty('id', 'shipment-123')
      expect(result).toHaveProperty('trackingNumber', 'UPS123456789')
      expect(result).toHaveProperty('carrier', 'UPS')
      expect(result).toHaveProperty('trackingUrl')
      expect(result.trackingUrl).toContain('UPS123456789')
    })

    it('should throw error for non-existent shipment', async () => {
      prismaMock.shipment.findUnique.mockResolvedValue(null)

      await expect(shippingService.getShipmentById('non-existent'))
        .rejects.toThrow(new AppError('Shipment not found', 404))
    })
  })

  describe('trackShipment', () => {
    it('should return tracking information', async () => {
      const mockShipment = {
        id: 'shipment-123',
        trackingNumber: 'UPS123456789',
        carrier: 'UPS',
        status: 'IN_TRANSIT',
        estimatedDelivery: new Date(),
        actualDelivery: null,
        updatedAt: new Date(),
        trackingEvents: [
          {
            id: 'event-1',
            shipmentId: 'shipment-123',
            status: 'SHIPPED',
            location: 'Seoul, KR',
            description: 'Package shipped',
            timestamp: new Date('2024-12-01T10:00:00Z'),
            metadata: {},
            createdAt: new Date(),
          },
          {
            id: 'event-2',
            shipmentId: 'shipment-123',
            status: 'IN_TRANSIT',
            location: 'Los Angeles, CA',
            description: 'Package in transit',
            timestamp: new Date('2024-12-03T15:00:00Z'),
            metadata: {},
            createdAt: new Date(),
          },
        ],
      }

      prismaMock.shipment.findFirst.mockResolvedValue(mockShipment as any)

      const result = await shippingService.trackShipment({
        trackingNumber: 'UPS123456789',
      })

      expect(result).toHaveProperty('trackingNumber', 'UPS123456789')
      expect(result).toHaveProperty('carrier', 'UPS')
      expect(result).toHaveProperty('status', 'IN_TRANSIT')
      expect(result).toHaveProperty('events')
      expect(result.events).toHaveLength(2)
      expect(result.events[0]).toHaveProperty('status', 'IN_TRANSIT') // Latest first
      expect(result.events[1]).toHaveProperty('status', 'SHIPPED')
    })

    it('should throw error for non-existent tracking number', async () => {
      prismaMock.shipment.findFirst.mockResolvedValue(null)

      await expect(shippingService.trackShipment({
        trackingNumber: 'NONEXISTENT123',
      })).rejects.toThrow(new AppError('Shipment not found', 404))
    })
  })

  describe('getShipments', () => {
    it('should return paginated shipments', async () => {
      const mockShipments = [
        {
          id: 'shipment-1',
          orderId: 'order-1',
          trackingNumber: 'UPS111111111',
          carrier: 'UPS',
          method: 'STANDARD',
          status: 'SHIPPED',
          cost: 15.99,
          currency: 'USD',
          estimatedDelivery: new Date(),
          createdAt: new Date(),
          order: {
            orderNumber: 'ORD-20241205-0001',
          },
        },
        {
          id: 'shipment-2',
          orderId: 'order-2',
          trackingNumber: 'FEDEX222222222',
          carrier: 'FEDEX',
          method: 'EXPRESS',
          status: 'DELIVERED',
          cost: 25.99,
          currency: 'USD',
          estimatedDelivery: new Date(),
          createdAt: new Date(),
          order: {
            orderNumber: 'ORD-20241205-0002',
          },
        },
      ]

      prismaMock.shipment.findMany.mockResolvedValue(mockShipments as any)
      prismaMock.shipment.count.mockResolvedValue(2)

      const result = await shippingService.getShipments({
        page: 1,
        limit: 10,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      })

      expect(result.shipments).toHaveLength(2)
      expect(result.pagination).toMatchObject({
        page: 1,
        limit: 10,
        total: 2,
        totalPages: 1,
      })
    })

    it('should filter shipments by carrier', async () => {
      const mockShipments = [
        {
          id: 'shipment-1',
          orderId: 'order-1',
          trackingNumber: 'UPS111111111',
          carrier: 'UPS',
          method: 'STANDARD',
          status: 'SHIPPED',
          cost: 15.99,
          currency: 'USD',
          estimatedDelivery: new Date(),
          createdAt: new Date(),
          order: {
            orderNumber: 'ORD-20241205-0001',
          },
        },
      ]

      prismaMock.shipment.findMany.mockResolvedValue(mockShipments as any)
      prismaMock.shipment.count.mockResolvedValue(1)

      const result = await shippingService.getShipments({
        page: 1,
        limit: 10,
        carrier: 'UPS',
        sortBy: 'createdAt',
        sortOrder: 'desc',
      })

      expect(result.shipments).toHaveLength(1)
      expect(result.shipments[0].carrier).toBe('UPS')
    })
  })

  describe('handleCarrierWebhook', () => {
    it('should process webhook and create tracking event', async () => {
      const mockShipment = {
        id: 'shipment-123',
        orderId: 'order-123',
        status: 'SHIPPED',
      }

      prismaMock.shipment.findFirst.mockResolvedValue(mockShipment as any)
      prismaMock.$transaction.mockImplementation(async (callback) => {
        return await callback(prismaMock)
      })
      prismaMock.trackingEvent.create.mockResolvedValue({} as any)
      prismaMock.shipment.update.mockResolvedValue({} as any)

      await shippingService.handleCarrierWebhook('UPS', {
        trackingNumber: 'UPS123456789',
        status: 'IN_TRANSIT',
        location: 'Los Angeles, CA',
        timestamp: '2024-12-05T10:00:00Z',
        description: 'Package in transit',
      })

      expect(prismaMock.trackingEvent.create).toHaveBeenCalledWith({
        data: {
          shipmentId: 'shipment-123',
          status: 'IN_TRANSIT',
          location: 'Los Angeles, CA',
          description: 'Package in transit',
          timestamp: new Date('2024-12-05T10:00:00Z'),
          metadata: undefined,
        },
      })
    })

    it('should handle webhook for non-existent shipment gracefully', async () => {
      prismaMock.shipment.findFirst.mockResolvedValue(null)

      // Should not throw error
      await expect(shippingService.handleCarrierWebhook('UPS', {
        trackingNumber: 'NONEXISTENT123',
        status: 'IN_TRANSIT',
        timestamp: '2024-12-05T10:00:00Z',
      })).resolves.toBeUndefined()
    })
  })

  describe('getAnalytics', () => {
    it('should return shipping analytics', async () => {
      const mockAnalyticsData = [
        // Total shipments
        2,
        // Shipment stats
        { _sum: { cost: 41.98 }, _avg: { cost: 20.99 } },
        // Status counts
        [
          { status: 'SHIPPED', _count: { status: 1 }, _sum: { cost: 15.99 } },
          { status: 'DELIVERED', _count: { status: 1 }, _sum: { cost: 25.99 } },
        ],
        // Carrier counts
        [
          { carrier: 'UPS', _count: { carrier: 1 }, _sum: { cost: 15.99 }, _avg: { cost: 15.99 } },
          { carrier: 'FEDEX', _count: { carrier: 1 }, _sum: { cost: 25.99 }, _avg: { cost: 25.99 } },
        ],
        // Recent shipments
        [
          {
            id: 'shipment-1',
            orderId: 'order-1',
            trackingNumber: 'UPS111111111',
            carrier: 'UPS',
            method: 'STANDARD',
            status: 'SHIPPED',
            cost: 15.99,
            currency: 'USD',
            estimatedDelivery: new Date(),
            createdAt: new Date(),
            order: { orderNumber: 'ORD-20241205-0001' },
          },
        ],
      ]

      // Mock all Promise.all calls
      prismaMock.shipment.count.mockResolvedValue(mockAnalyticsData[0])
      prismaMock.shipment.aggregate.mockResolvedValue(mockAnalyticsData[1])
      prismaMock.shipment.groupBy
        .mockResolvedValueOnce(mockAnalyticsData[2] as any)
        .mockResolvedValueOnce(mockAnalyticsData[3] as any)
      prismaMock.shipment.findMany.mockResolvedValue(mockAnalyticsData[4] as any)

      const result = await shippingService.getAnalytics()

      expect(result).toMatchObject({
        totalShipments: 2,
        totalCost: 41.98,
        averageCost: 20.99,
        statusCounts: [
          { status: 'SHIPPED', count: 1, totalCost: 15.99 },
          { status: 'DELIVERED', count: 1, totalCost: 25.99 },
        ],
        carrierCounts: [
          { carrier: 'UPS', count: 1, totalCost: 15.99, averageCost: 15.99 },
          { carrier: 'FEDEX', count: 1, totalCost: 25.99, averageCost: 25.99 },
        ],
        recentShipments: expect.any(Array),
      })
    })
  })
})