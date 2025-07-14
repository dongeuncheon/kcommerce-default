import { Router } from 'express'
import { pricingController } from '../controllers/pricingController'

const router = Router()

/**
 * @route   POST /api/v1/pricing/calculate
 * @desc    Calculate dynamic price for a single product
 * @access  Public
 * @body    { productId, quantity, userId?, customerGroup?, context? }
 */
router.post('/calculate', pricingController.calculatePrice)

/**
 * @route   POST /api/v1/pricing/calculate-bulk
 * @desc    Calculate dynamic pricing for multiple products
 * @access  Public
 * @body    { items: [{ productId, quantity, context? }], userId?, customerGroup?, context? }
 */
router.post('/calculate-bulk', pricingController.calculateBulkPricing)

/**
 * @route   POST /api/v1/pricing/preview
 * @desc    Preview pricing without recording applications
 * @access  Public
 * @body    { productId, quantity, userId?, customerGroup?, context? }
 */
router.post('/preview', pricingController.previewPricing)

/**
 * @route   POST /api/v1/pricing/rules
 * @desc    Create a new pricing rule
 * @access  Private (Admin)
 * @body    { name, description?, type, conditions, discountType, discountValue, ... }
 */
router.post('/rules', pricingController.createPricingRule)

/**
 * @route   GET /api/v1/pricing/rules
 * @desc    Get all pricing rules with optional filters
 * @access  Private (Admin)
 * @query   isActive?, type?, priority?
 */
router.get('/rules', pricingController.getPricingRules)

/**
 * @route   GET /api/v1/pricing/rules/:ruleId
 * @desc    Get a specific pricing rule by ID
 * @access  Private (Admin)
 * @params  ruleId - Pricing rule ID
 */
router.get('/rules/:ruleId', pricingController.getPricingRule)

/**
 * @route   PUT /api/v1/pricing/rules/:ruleId
 * @desc    Update a pricing rule
 * @access  Private (Admin)
 * @params  ruleId - Pricing rule ID
 * @body    { name?, description?, type?, conditions?, discountType?, discountValue?, ... }
 */
router.put('/rules/:ruleId', pricingController.updatePricingRule)

/**
 * @route   DELETE /api/v1/pricing/rules/:ruleId
 * @desc    Delete a pricing rule
 * @access  Private (Admin)
 * @params  ruleId - Pricing rule ID
 */
router.delete('/rules/:ruleId', pricingController.deletePricingRule)

/**
 * @route   POST /api/v1/pricing/rules/:ruleId/test
 * @desc    Test a pricing rule against sample data
 * @access  Private (Admin)
 * @params  ruleId - Pricing rule ID
 * @body    { productId, quantity, userId?, customerGroup?, context? }
 */
router.post('/rules/:ruleId/test', pricingController.testPricingRule)

/**
 * @route   GET /api/v1/pricing/analytics
 * @desc    Get pricing analytics and performance metrics
 * @access  Private (Admin)
 * @query   startDate?, endDate?
 */
router.get('/analytics', pricingController.getPricingAnalytics)

export { router as pricingRoutes }