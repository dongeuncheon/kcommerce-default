import { Router } from 'express'
import { productOptionsController } from '../controllers/productOptionsController'

const router = Router()

// ===== PRODUCT OPTION MANAGEMENT =====

/**
 * @route   POST /api/v1/product-options
 * @desc    Create a new product option with values
 * @access  Private (Admin)
 * @body    { productId, name, displayName, type, isRequired?, sortOrder?, config?, values[] }
 */
router.post('/', productOptionsController.createProductOption)

/**
 * @route   GET /api/v1/product-options/:optionId
 * @desc    Get product option by ID with values
 * @access  Public
 * @params  optionId - Product option ID
 */
router.get('/:optionId', productOptionsController.getProductOption)

/**
 * @route   PUT /api/v1/product-options/:optionId
 * @desc    Update product option
 * @access  Private (Admin)
 * @params  optionId - Product option ID
 * @body    { name?, displayName?, type?, isRequired?, sortOrder?, isActive?, config? }
 */
router.put('/:optionId', productOptionsController.updateProductOption)

/**
 * @route   DELETE /api/v1/product-options/:optionId
 * @desc    Delete product option and all its values
 * @access  Private (Admin)
 * @params  optionId - Product option ID
 */
router.delete('/:optionId', productOptionsController.deleteProductOption)

// ===== OPTION VALUES MANAGEMENT =====

/**
 * @route   POST /api/v1/product-options/:optionId/values
 * @desc    Add option value to existing option
 * @access  Private (Admin)
 * @params  optionId - Product option ID
 * @body    { value, displayValue, sortOrder?, priceAdjustment?, sku?, image?, hexColor?, description? }
 */
router.post('/:optionId/values', productOptionsController.addOptionValue)

/**
 * @route   PUT /api/v1/product-options/values/:valueId
 * @desc    Update option value
 * @access  Private (Admin)
 * @params  valueId - Option value ID
 * @body    { value?, displayValue?, sortOrder?, priceAdjustment?, sku?, image?, hexColor?, description? }
 */
router.put('/values/:valueId', productOptionsController.updateOptionValue)

/**
 * @route   DELETE /api/v1/product-options/values/:valueId
 * @desc    Delete option value
 * @access  Private (Admin)
 * @params  valueId - Option value ID
 */
router.delete('/values/:valueId', productOptionsController.deleteOptionValue)

// ===== PRODUCT-SPECIFIC OPTIONS =====

/**
 * @route   GET /api/v1/product-options/products/:productId
 * @desc    Get all options for a specific product
 * @access  Public
 * @params  productId - Product ID
 */
router.get('/products/:productId', productOptionsController.getProductOptions)

/**
 * @route   GET /api/v1/product-options/products/:productId/full
 * @desc    Get product with all options, values, and details
 * @access  Public
 * @params  productId - Product ID
 */
router.get('/products/:productId/full', productOptionsController.getProductWithOptions)

/**
 * @route   POST /api/v1/product-options/products/:productId/reorder
 * @desc    Reorder product options
 * @access  Private (Admin)
 * @params  productId - Product ID
 * @body    { optionIds[] } - Array of option IDs in desired order
 */
router.post('/products/:productId/reorder', productOptionsController.reorderProductOptions)

// ===== VALIDATION & PRICING =====

/**
 * @route   POST /api/v1/product-options/validate
 * @desc    Validate selected options for a product
 * @access  Public
 * @body    { productId, selectedOptions }
 */
router.post('/validate', productOptionsController.validateProductOptions)

/**
 * @route   POST /api/v1/product-options/products/:productId/pricing
 * @desc    Calculate price adjustments based on selected options
 * @access  Public
 * @params  productId - Product ID
 * @body    { selectedOptions } - Object with option name/value pairs
 */
router.post('/products/:productId/pricing', productOptionsController.calculateOptionPricing)

// ===== BULK OPERATIONS =====

/**
 * @route   POST /api/v1/product-options/bulk
 * @desc    Perform bulk operations on product options
 * @access  Private (Admin)
 * @body    { operation: 'create'|'update'|'delete'|'reorder', options[] }
 */
router.post('/bulk', productOptionsController.bulkOptionOperation)

/**
 * @route   POST /api/v1/product-options/clone
 * @desc    Clone options from one product to another
 * @access  Private (Admin)
 * @body    { sourceProductId, targetProductId }
 */
router.post('/clone', productOptionsController.cloneProductOptions)

// ===== TEMPLATES =====

/**
 * @route   GET /api/v1/product-options/templates
 * @desc    Get available option templates
 * @access  Public
 */
router.get('/templates', productOptionsController.getOptionTemplates)

/**
 * @route   POST /api/v1/product-options/products/:productId/apply-template
 * @desc    Apply option template to product
 * @access  Private (Admin)
 * @params  productId - Product ID
 * @body    { templateId }
 */
router.post('/products/:productId/apply-template', productOptionsController.applyOptionTemplate)

export { router as productOptionsRoutes }