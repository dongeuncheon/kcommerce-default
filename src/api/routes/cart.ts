import { Router } from 'express'
import { cartController } from '../controllers/cartController'
import {
  cartUpdatedMiddleware,
  itemAddedMiddleware,
  itemUpdatedMiddleware,
  itemRemovedMiddleware,
  cartClearedMiddleware,
  couponAppliedMiddleware,
  couponRemovedMiddleware,
  stockWarningMiddleware,
  cartExpirationMiddleware,
  addCartEventData
} from '../../middleware/cartWebSocket'

const router = Router()

// Apply global middlewares for cart operations
router.use(stockWarningMiddleware)
router.use(cartExpirationMiddleware)

// Cart CRUD operations
router.post('/', cartUpdatedMiddleware, cartController.createCart)
router.get('/find', cartController.getCartByUserOrSession)
router.get('/', cartController.getCarts)
router.get('/:id', cartController.getCartById)
router.put('/:id', cartUpdatedMiddleware, cartController.updateCart)
router.delete('/:id', cartUpdatedMiddleware, cartController.deleteCart)

// Cart item operations
router.post(
  '/:id/items',
  addCartEventData({ action: 'add_item' }),
  itemAddedMiddleware,
  cartController.addItemToCart
)

router.put(
  '/:cartId/items/:itemId',
  addCartEventData({ action: 'update_item' }),
  itemUpdatedMiddleware,
  cartController.updateCartItem
)

router.delete(
  '/:cartId/items/:itemId',
  addCartEventData({ action: 'remove_item' }),
  itemRemovedMiddleware,
  cartController.removeCartItem
)

router.delete(
  '/:id/items',
  addCartEventData({ action: 'clear_cart' }),
  cartClearedMiddleware,
  cartController.clearCart
)

// Coupon operations
router.post(
  '/:id/coupons',
  addCartEventData({ action: 'apply_coupon' }),
  couponAppliedMiddleware,
  cartController.applyCoupon
)

router.delete(
  '/:id/coupons',
  addCartEventData({ action: 'remove_coupon' }),
  couponRemovedMiddleware,
  cartController.removeCoupon
)

// Cart merge and transfer operations
router.post(
  '/merge',
  addCartEventData({ action: 'merge_carts' }),
  cartUpdatedMiddleware,
  cartController.mergeCarts
)

router.post(
  '/transfer',
  addCartEventData({ action: 'transfer_cart' }),
  cartUpdatedMiddleware,
  cartController.transferCart
)

// Utility operations
router.get('/:id/validate-stock', cartController.validateCartStock)
router.get('/:id/summary', cartController.getCartSummary)
router.get('/count/items', cartController.getCartItemsCount)

// Quick add operation
router.post(
  '/quick-add',
  addCartEventData({ action: 'quick_add' }),
  itemAddedMiddleware,
  cartController.quickAddToCart
)

// Admin operations
router.delete('/expired/cleanup', cartController.cleanupExpiredCarts)

// Restore cart from local storage
router.post(
  '/restore',
  addCartEventData({ action: 'restore_cart' }),
  cartUpdatedMiddleware,
  cartController.restoreCart
)

// Duplicate cart
router.post(
  '/:id/duplicate',
  addCartEventData({ action: 'duplicate_cart' }),
  cartUpdatedMiddleware,
  cartController.duplicateCart
)

// ===== GUEST CART ROUTES =====

/**
 * @route   GET /api/v1/carts/guest
 * @desc    Get or create guest cart by session ID
 * @access  Public
 * @query   sessionId - Guest session ID
 */
router.get('/guest', cartController.getOrCreateGuestCart)

/**
 * @route   GET /api/v1/carts/guest/:sessionId/summary
 * @desc    Get lightweight guest cart summary
 * @access  Public
 * @params  sessionId - Guest session ID
 */
router.get('/guest/:sessionId/summary', cartController.getGuestCartSummary)

/**
 * @route   POST /api/v1/carts/guest/quick-add
 * @desc    Quick add item to guest cart (auto-creates cart if needed)
 * @access  Public
 * @body    { sessionId, productId, variantId?, quantity? }
 */
router.post(
  '/guest/quick-add',
  addCartEventData({ action: 'guest_quick_add' }),
  cartUpdatedMiddleware,
  cartController.quickAddToGuestCart
)

/**
 * @route   POST /api/v1/carts/guest/transfer
 * @desc    Transfer guest cart to authenticated user
 * @access  Public
 * @body    { sessionId, userId }
 */
router.post(
  '/guest/transfer',
  addCartEventData({ action: 'guest_transfer' }),
  cartUpdatedMiddleware,
  cartController.transferGuestCart
)

/**
 * @route   POST /api/v1/carts/guest/migrate
 * @desc    Migrate cart data from local storage to guest session
 * @access  Public
 * @body    { sessionId, cartData }
 */
router.post(
  '/guest/migrate',
  addCartEventData({ action: 'guest_migrate' }),
  cartUpdatedMiddleware,
  cartController.migrateGuestCartFromLocalStorage
)

/**
 * @route   GET /api/v1/carts/guest/session/:sessionId/info
 * @desc    Get guest session information for debugging
 * @access  Public
 * @params  sessionId - Guest session ID
 */
router.get('/guest/session/:sessionId/info', cartController.getGuestSessionInfo)

/**
 * @route   POST /api/v1/carts/guest/session/:sessionId/extend
 * @desc    Extend guest session expiration
 * @access  Public
 * @params  sessionId - Guest session ID
 * @body    { hours? } - Number of hours to extend (default: 24)
 */
router.post('/guest/session/:sessionId/extend', cartController.extendGuestSession)

/**
 * @route   GET /api/v1/carts/guest/stats
 * @desc    Get guest session statistics for analytics
 * @access  Admin
 * @query   hours? - Time period in hours (default: 24)
 */
router.get('/guest/stats', cartController.getGuestSessionStats)

export default router