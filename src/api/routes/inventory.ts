import { Router } from 'express'
import { inventoryController } from '../controllers/inventoryController'

const router = Router()

/**
 * @route   POST /api/v1/inventory/adjust
 * @desc    Adjust inventory for a single product
 * @access  Private (Admin)
 * @body    { productId, quantity, type, reason?, reference? }
 */
router.post('/adjust', inventoryController.adjustInventory)

/**
 * @route   POST /api/v1/inventory/bulk-adjust
 * @desc    Bulk adjust inventory for multiple products
 * @access  Private (Admin)
 * @body    { adjustments: [{ productId, quantity, type, reason?, reference? }] }
 */
router.post('/bulk-adjust', inventoryController.bulkAdjustInventory)

/**
 * @route   GET /api/v1/inventory/low-stock
 * @desc    Get products with low stock
 * @access  Private (Admin)
 */
router.get('/low-stock', inventoryController.getLowStockProducts)

/**
 * @route   GET /api/v1/inventory/out-of-stock
 * @desc    Get products that are out of stock
 * @access  Private (Admin)
 */
router.get('/out-of-stock', inventoryController.getOutOfStockProducts)

/**
 * @route   GET /api/v1/inventory/report
 * @desc    Generate comprehensive inventory report
 * @access  Private (Admin)
 */
router.get('/report', inventoryController.generateInventoryReport)

/**
 * @route   GET /api/v1/inventory/stats
 * @desc    Get inventory statistics for dashboard
 * @access  Private (Admin)
 */
router.get('/stats', inventoryController.getInventoryStats)

/**
 * @route   GET /api/v1/inventory/alerts
 * @desc    Get current inventory alerts
 * @access  Private (Admin)
 */
router.get('/alerts', inventoryController.getInventoryAlerts)

/**
 * @route   GET /api/v1/inventory/history/:productId
 * @desc    Get inventory movement history for a specific product
 * @access  Private (Admin)
 * @params  productId - Product ID
 * @query   limit?, offset? - Pagination parameters
 */
router.get('/history/:productId', inventoryController.getProductInventoryHistory)

/**
 * @route   POST /api/v1/inventory/reserve
 * @desc    Reserve inventory for an order
 * @access  Private (Admin)
 * @body    { items: [{ productId, quantity }], orderId }
 */
router.post('/reserve', inventoryController.reserveInventory)

/**
 * @route   POST /api/v1/inventory/release
 * @desc    Release reserved inventory
 * @access  Private (Admin)
 * @body    { items: [{ productId, quantity }], orderId }
 */
router.post('/release', inventoryController.releaseInventory)

/**
 * @route   POST /api/v1/inventory/test-notification
 * @desc    Test notification system
 * @access  Private (Admin)
 * @body    { type, email }
 */
router.post('/test-notification', inventoryController.testNotification)

/**
 * @route   POST /api/v1/inventory/check-alerts/:productId
 * @desc    Manually trigger low stock check for a product
 * @access  Private (Admin)
 * @params  productId - Product ID
 */
router.post('/check-alerts/:productId', inventoryController.triggerLowStockCheck)

/**
 * @route   PUT /api/v1/inventory/threshold/:productId
 * @desc    Set low stock threshold for a product
 * @access  Private (Admin)
 * @params  productId - Product ID
 * @body    { threshold }
 */
router.put('/threshold/:productId', inventoryController.setLowStockThreshold)

export { router as inventoryRoutes }