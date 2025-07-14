import { Router } from 'express'
import { shippingController } from '../controllers/shippingController'
import { authenticate, authorize } from '../../middleware/auth'
import { dynamicRateLimiter } from '../../middleware/rateLimiter'

const router = Router()

// Public routes (no authentication required)
// Calculate shipping rates for checkout
router.post('/rates', dynamicRateLimiter('api'), shippingController.calculateRates)

// Track shipment by tracking number (public access)
router.get('/track/:trackingNumber', dynamicRateLimiter('api'), shippingController.trackShipment)

// Get available carriers and services
router.get('/carriers', shippingController.getCarriers)

// Calculate shipping for specific order (used during checkout)
router.post('/orders/:orderId/calculate', shippingController.calculateOrderShipping)

// Webhook endpoints for carriers (no authentication, but should verify signature)
router.post('/webhooks/ups', dynamicRateLimiter('api'), shippingController.handleWebhook)
router.post('/webhooks/fedex', dynamicRateLimiter('api'), shippingController.handleWebhook)
router.post('/webhooks/dhl', dynamicRateLimiter('api'), shippingController.handleWebhook)
router.post('/webhooks/usps', dynamicRateLimiter('api'), shippingController.handleWebhook)
router.post('/webhooks/:carrier', dynamicRateLimiter('api'), shippingController.handleWebhook)

// Authenticated routes
router.use(authenticate)

// Customer routes (authenticated users)
// Note: Customers typically can't directly create shipments, but they can track their orders
// These might be moved to order routes in a real implementation

// Staff/Admin routes
// Create shipment (staff and admin only)
router.post('/', authorize(['ADMIN', 'SUPER_ADMIN', 'STAFF']), shippingController.createShipment)

// Get shipments with pagination (staff and admin only)
router.get('/', authorize(['ADMIN', 'SUPER_ADMIN', 'STAFF']), shippingController.getShipments)

// Get shipment by ID (staff and admin only)
router.get('/:id', authorize(['ADMIN', 'SUPER_ADMIN', 'STAFF']), shippingController.getShipmentById)

// Update shipment (staff and admin only)
router.put('/:id', authorize(['ADMIN', 'SUPER_ADMIN', 'STAFF']), shippingController.updateShipment)

// Cancel shipment (staff and admin only)
router.post('/:id/cancel', authorize(['ADMIN', 'SUPER_ADMIN', 'STAFF']), shippingController.cancelShipment)

// Get shipment label (admin only)
router.get('/:id/label', authorize(['ADMIN', 'SUPER_ADMIN']), shippingController.getShipmentLabel)

// Admin-only routes
// Get shipping analytics
router.get('/analytics/overview', authorize(['ADMIN', 'SUPER_ADMIN']), shippingController.getAnalytics)

// Shipping management routes (admin only)
// TODO: Add shipping rules management
// router.get('/rules', authorize(['ADMIN', 'SUPER_ADMIN']), shippingController.getShippingRules)
// router.post('/rules', authorize(['ADMIN', 'SUPER_ADMIN']), shippingController.createShippingRule)
// router.put('/rules/:id', authorize(['ADMIN', 'SUPER_ADMIN']), shippingController.updateShippingRule)
// router.delete('/rules/:id', authorize(['ADMIN', 'SUPER_ADMIN']), shippingController.deleteShippingRule)

// TODO: Add shipping zones management
// router.get('/zones', authorize(['ADMIN', 'SUPER_ADMIN']), shippingController.getShippingZones)
// router.post('/zones', authorize(['ADMIN', 'SUPER_ADMIN']), shippingController.createShippingZone)
// router.put('/zones/:id', authorize(['ADMIN', 'SUPER_ADMIN']), shippingController.updateShippingZone)
// router.delete('/zones/:id', authorize(['ADMIN', 'SUPER_ADMIN']), shippingController.deleteShippingZone)

// TODO: Add carrier configuration management
// router.get('/carriers/config', authorize(['ADMIN', 'SUPER_ADMIN']), shippingController.getCarrierConfigs)
// router.post('/carriers/config', authorize(['ADMIN', 'SUPER_ADMIN']), shippingController.createCarrierConfig)
// router.put('/carriers/config/:id', authorize(['ADMIN', 'SUPER_ADMIN']), shippingController.updateCarrierConfig)
// router.delete('/carriers/config/:id', authorize(['ADMIN', 'SUPER_ADMIN']), shippingController.deleteCarrierConfig)

// Test endpoints (admin only, for development/testing)
// router.post('/test/rates', authorize(['ADMIN', 'SUPER_ADMIN']), shippingController.testRateCalculation)
// router.post('/test/webhooks', authorize(['ADMIN', 'SUPER_ADMIN']), shippingController.testWebhook)

export default router