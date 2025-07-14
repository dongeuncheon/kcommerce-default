import { Request, Response } from 'express'
import { shippingService } from '../../services/shippingService'
import { asyncHandler } from '../../middleware/error'
import { logger } from '../../utils/logger'
import {
  CalculateRatesSchema,
  CreateShipmentSchema,
  UpdateShipmentSchema,
  ShipmentQuerySchema,
  ShipmentParamsSchema,
  CarrierWebhookSchema,
} from '../../types/shipping'

// Enhanced request interface for authenticated requests
interface AuthenticatedRequest extends Request {
  user?: {
    id: string
    email: string
    role: string
  }
}

export class ShippingController {

  // Calculate shipping rates
  calculateRates = asyncHandler(async (req: Request, res: Response) => {
    const validatedData = CalculateRatesSchema.parse(req.body)
    
    logger.info('Calculating shipping rates', { 
      origin: validatedData.origin.city,
      destination: validatedData.destination.city,
      packages: validatedData.packages.length,
      userId: (req as AuthenticatedRequest).user?.id,
    })

    const rates = await shippingService.calculateRates(validatedData)

    return res.json({
      success: true,
      data: {
        rates,
        origin: validatedData.origin,
        destination: validatedData.destination,
        packages: validatedData.packages,
      },
      message: `Found ${rates.length} shipping options`,
    })
  })

  // Create shipment
  createShipment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const validatedData = CreateShipmentSchema.parse(req.body)
    
    logger.info('Creating shipment', { 
      orderId: validatedData.orderId,
      carrier: validatedData.carrier,
      service: validatedData.service,
      userId: req.user?.id,
    })

    // Check if user has permission to create shipments for this order
    if (req.user!.role !== 'ADMIN' && req.user!.role !== 'STAFF') {
      return res.status(403).json({
        success: false,
        error: {
          type: 'ForbiddenError',
          message: 'You do not have permission to create shipments',
        },
      })
    }

    const shipment = await shippingService.createShipment(validatedData)

    return res.status(201).json({
      success: true,
      data: shipment,
      message: 'Shipment created successfully',
    })
  })

  // Get shipment by ID
  getShipmentById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = ShipmentParamsSchema.parse(req.params)
    const shipment = await shippingService.getShipmentById(id)

    // Check if user has access to this shipment
    if (req.user!.role !== 'ADMIN' && req.user!.role !== 'STAFF') {
      // For regular users, check if they own the order
      // Note: You might want to add order ownership check here
      return res.status(403).json({
        success: false,
        error: {
          type: 'ForbiddenError',
          message: 'You do not have access to this shipment',
        },
      })
    }

    return res.json({
      success: true,
      data: shipment,
    })
  })

  // Update shipment
  updateShipment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = ShipmentParamsSchema.parse(req.params)
    const validatedData = UpdateShipmentSchema.parse(req.body)

    logger.info('Updating shipment', { 
      id,
      updates: Object.keys(validatedData),
      userId: req.user?.id,
    })

    // Check if user has permission to update shipments
    if (req.user!.role !== 'ADMIN' && req.user!.role !== 'STAFF') {
      return res.status(403).json({
        success: false,
        error: {
          type: 'ForbiddenError',
          message: 'You do not have permission to update shipments',
        },
      })
    }

    const shipment = await shippingService.updateShipment(id, validatedData)

    return res.json({
      success: true,
      data: shipment,
      message: 'Shipment updated successfully',
    })
  })

  // Track shipment
  trackShipment = asyncHandler(async (req: Request, res: Response) => {
    const { trackingNumber } = req.params
    const carrier = req.query.carrier as string | undefined

    logger.info('Tracking shipment', { trackingNumber, carrier })

    const trackingData = await shippingService.trackShipment({
      trackingNumber,
      carrier: carrier as any,
    })

    return res.json({
      success: true,
      data: trackingData,
    })
  })

  // Get shipments with pagination
  getShipments = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const validatedQuery = ShipmentQuerySchema.parse(req.query)

    logger.info('Getting shipments', { 
      query: validatedQuery,
      userId: req.user?.id,
    })

    // Check if user has permission to view shipments
    if (req.user!.role !== 'ADMIN' && req.user!.role !== 'STAFF') {
      return res.status(403).json({
        success: false,
        error: {
          type: 'ForbiddenError',
          message: 'You do not have permission to view shipments',
        },
      })
    }

    const result = await shippingService.getShipments(validatedQuery)

    return res.json({
      success: true,
      data: result.shipments,
      pagination: result.pagination,
    })
  })

  // Handle carrier webhooks
  handleWebhook = asyncHandler(async (req: Request, res: Response) => {
    const { carrier } = req.params
    const validatedData = CarrierWebhookSchema.parse(req.body)

    logger.info('Handling carrier webhook', { 
      carrier,
      trackingNumber: validatedData.trackingNumber,
      status: validatedData.status,
    })

    // Verify webhook signature (implementation depends on carrier)
    // if (!this.verifyWebhookSignature(carrier, req)) {
    //   return res.status(401).json({
    //     success: false,
    //     error: { message: 'Invalid webhook signature' },
    //   })
    // }

    await shippingService.handleCarrierWebhook(carrier, validatedData)

    return res.json({
      success: true,
      message: 'Webhook processed successfully',
    })
  })

  // Get available carriers
  getCarriers = asyncHandler(async (_req: Request, res: Response) => {
    const carriers = [
      {
        code: 'UPS',
        name: 'UPS',
        services: [
          { code: 'STANDARD', name: 'UPS Ground', estimatedDays: 3 },
          { code: 'EXPRESS', name: 'UPS 2nd Day Air', estimatedDays: 2 },
          { code: 'OVERNIGHT', name: 'UPS Next Day Air', estimatedDays: 1 },
        ]
      },
      {
        code: 'FEDEX',
        name: 'FedEx',
        services: [
          { code: 'STANDARD', name: 'FedEx Ground', estimatedDays: 3 },
          { code: 'EXPRESS', name: 'FedEx Express Saver', estimatedDays: 2 },
          { code: 'OVERNIGHT', name: 'FedEx Standard Overnight', estimatedDays: 1 },
        ]
      },
      {
        code: 'DHL',
        name: 'DHL',
        services: [
          { code: 'STANDARD', name: 'DHL Express Worldwide', estimatedDays: 4 },
          { code: 'EXPRESS', name: 'DHL Express 12:00', estimatedDays: 2 },
          { code: 'OVERNIGHT', name: 'DHL Express 9:00', estimatedDays: 1 },
        ]
      },
      {
        code: 'USPS',
        name: 'USPS',
        services: [
          { code: 'STANDARD', name: 'USPS Ground Advantage', estimatedDays: 3 },
          { code: 'EXPRESS', name: 'USPS Priority Mail', estimatedDays: 2 },
          { code: 'OVERNIGHT', name: 'USPS Priority Mail Express', estimatedDays: 1 },
        ]
      },
    ]

    return res.json({
      success: true,
      data: carriers,
    })
  })

  // Get shipping analytics
  getAnalytics = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    logger.info('Getting shipping analytics', { userId: req.user?.id })

    // Check if user has permission to view analytics
    if (req.user!.role !== 'ADMIN' && req.user!.role !== 'STAFF') {
      return res.status(403).json({
        success: false,
        error: {
          type: 'ForbiddenError',
          message: 'You do not have permission to view shipping analytics',
        },
      })
    }

    const analytics = await shippingService.getAnalytics()

    return res.json({
      success: true,
      data: analytics,
    })
  })

  // Calculate shipping for order (public endpoint for checkout)
  calculateOrderShipping = asyncHandler(async (req: Request, res: Response) => {
    const { orderId } = req.params
    const { shippingAddress } = req.body

    logger.info('Calculating order shipping', { orderId })

    // This would typically get order details and calculate shipping
    // For now, return mock data
    const rates = [
      {
        carrier: 'UPS',
        service: 'STANDARD',
        serviceName: 'UPS Ground',
        cost: 15.99,
        currency: 'USD',
        estimatedDays: 3,
        estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        guaranteed: false,
      },
      {
        carrier: 'UPS',
        service: 'EXPRESS',
        serviceName: 'UPS 2nd Day Air',
        cost: 25.99,
        currency: 'USD',
        estimatedDays: 2,
        estimatedDelivery: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        guaranteed: true,
      },
      {
        carrier: 'UPS',
        service: 'OVERNIGHT',
        serviceName: 'UPS Next Day Air',
        cost: 45.99,
        currency: 'USD',
        estimatedDays: 1,
        estimatedDelivery: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
        guaranteed: true,
      },
    ]

    return res.json({
      success: true,
      data: {
        orderId,
        rates,
        shippingAddress,
      },
    })
  })

  // Get shipment labels (admin only)
  getShipmentLabel = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = ShipmentParamsSchema.parse(req.params)
    const format = req.query.format as string || 'PDF'

    logger.info('Getting shipment label', { id, format, userId: req.user?.id })

    // Check if user has permission
    if (req.user!.role !== 'ADMIN' && req.user!.role !== 'STAFF') {
      return res.status(403).json({
        success: false,
        error: {
          type: 'ForbiddenError',
          message: 'You do not have permission to access shipping labels',
        },
      })
    }

    // Get shipment
    const shipment = await shippingService.getShipmentById(id)

    // Mock label URL - in real implementation, this would generate or retrieve the actual label
    const labelUrl = `https://api.example.com/labels/${shipment.id}?format=${format}`

    return res.json({
      success: true,
      data: {
        shipmentId: id,
        labelUrl,
        format,
        createdAt: new Date(),
      },
    })
  })

  // Cancel shipment
  cancelShipment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = ShipmentParamsSchema.parse(req.params)
    const { reason } = req.body

    logger.info('Cancelling shipment', { id, reason, userId: req.user?.id })

    // Check if user has permission
    if (req.user!.role !== 'ADMIN' && req.user!.role !== 'STAFF') {
      return res.status(403).json({
        success: false,
        error: {
          type: 'ForbiddenError',
          message: 'You do not have permission to cancel shipments',
        },
      })
    }

    const shipment = await shippingService.updateShipment(id, {
      status: 'CANCELLED',
      notes: reason,
    })

    return res.json({
      success: true,
      data: shipment,
      message: 'Shipment cancelled successfully',
    })
  })

  // Private helper method for webhook signature verification (currently unused)
  /*
  private _verifyWebhookSignature(_carrier: string, _req: Request): boolean {
    // Implementation depends on carrier's webhook signature method
    // For example, some carriers use HMAC SHA256
    const signature = _req.headers['x-webhook-signature'] as string
    // Note: payload would be used for signature verification in real implementation
    const payload = JSON.stringify(_req.body)
    
    // Mock implementation - always return true for now
    console.log('Webhook signature verification:', { signature, payload })
    
    // This is a mock implementation
    // In real scenario, you would verify the signature using carrier's secret key
    return !!signature && signature.length > 0
  }
  */
}

export const shippingController = new ShippingController()