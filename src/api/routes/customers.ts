import { Router } from 'express'
import { CustomerController } from '../controllers/customerController'
import { authenticate, authorize, csrfProtection } from '../../middleware/auth'
import { dynamicRateLimiter } from '../../middleware/rateLimiter'

const router = Router()

// Rate limiting for sensitive operations
const strictRateLimit = dynamicRateLimiter('auth')
const standardRateLimit = dynamicRateLimiter('api')

// ===== Customer Profile Routes =====

// Get own profile
router.get('/profile', 
  authenticate, 
  standardRateLimit,
  CustomerController.getProfile
)

// Update own profile
router.put('/profile', 
  authenticate, 
  csrfProtection,
  standardRateLimit,
  CustomerController.updateProfile
)

// ===== Address Management Routes =====

// Get all addresses
router.get('/addresses', 
  authenticate, 
  standardRateLimit,
  CustomerController.getAddresses
)

// Get specific address
router.get('/addresses/:addressId', 
  authenticate, 
  standardRateLimit,
  CustomerController.getAddress
)

// Add new address
router.post('/addresses', 
  authenticate, 
  csrfProtection,
  standardRateLimit,
  CustomerController.addAddress
)

// Update address
router.put('/addresses/:addressId', 
  authenticate, 
  csrfProtection,
  standardRateLimit,
  CustomerController.updateAddress
)

// Delete address
router.delete('/addresses/:addressId', 
  authenticate, 
  csrfProtection,
  standardRateLimit,
  CustomerController.deleteAddress
)

// Set default address
router.put('/addresses/:addressId/set-default', 
  authenticate, 
  csrfProtection,
  standardRateLimit,
  CustomerController.setDefaultAddress
)

// ===== Payment Method Management Routes =====

// Get all payment methods
router.get('/payment-methods', 
  authenticate, 
  standardRateLimit,
  CustomerController.getPaymentMethods
)

// Get specific payment method
router.get('/payment-methods/:paymentMethodId', 
  authenticate, 
  standardRateLimit,
  CustomerController.getPaymentMethod
)

// Add new payment method
router.post('/payment-methods', 
  authenticate, 
  csrfProtection,
  strictRateLimit, // Stricter rate limit for payment operations
  CustomerController.addPaymentMethod
)

// Update payment method (limited updates allowed)
router.put('/payment-methods/:paymentMethodId', 
  authenticate, 
  csrfProtection,
  standardRateLimit,
  CustomerController.updatePaymentMethod
)

// Delete payment method
router.delete('/payment-methods/:paymentMethodId', 
  authenticate, 
  csrfProtection,
  standardRateLimit,
  CustomerController.deletePaymentMethod
)

// Set default payment method
router.put('/payment-methods/:paymentMethodId/set-default', 
  authenticate, 
  csrfProtection,
  standardRateLimit,
  CustomerController.setDefaultPaymentMethod
)

// ===== Order History Routes =====

// Get order history
router.get('/orders', 
  authenticate, 
  standardRateLimit,
  CustomerController.getOrderHistory
)

// ===== Wishlist Management Routes =====

// Get wishlist
router.get('/wishlist', 
  authenticate, 
  standardRateLimit,
  CustomerController.getWishlist
)

// Add to wishlist
router.post('/wishlist', 
  authenticate, 
  csrfProtection,
  standardRateLimit,
  CustomerController.addToWishlist
)

// Remove from wishlist
router.delete('/wishlist/:productId', 
  authenticate, 
  csrfProtection,
  standardRateLimit,
  CustomerController.removeFromWishlist
)

// Clear wishlist
router.delete('/wishlist', 
  authenticate, 
  csrfProtection,
  standardRateLimit,
  CustomerController.clearWishlist
)

// ===== Customer Preferences Routes =====

// Get preferences
router.get('/preferences', 
  authenticate, 
  standardRateLimit,
  CustomerController.getPreferences
)

// Update preferences
router.put('/preferences', 
  authenticate, 
  csrfProtection,
  standardRateLimit,
  CustomerController.updatePreferences
)

// ===== Customer Activity Routes =====

// Get activity history
router.get('/activity', 
  authenticate, 
  standardRateLimit,
  CustomerController.getActivity
)

// ===== GDPR Compliance Routes =====

// Export customer data
router.get('/export-data', 
  authenticate, 
  strictRateLimit, // Strict rate limit for data export
  CustomerController.exportData
)

// Delete account
router.delete('/account', 
  authenticate, 
  csrfProtection,
  strictRateLimit, // Very strict rate limit for account deletion
  CustomerController.deleteAccount
)

// ===== Admin Routes =====

// Search customers (admin only)
router.get('/search', 
  authenticate, 
  authorize(['ADMIN', 'SUPER_ADMIN']),
  standardRateLimit,
  CustomerController.searchCustomers
)

// Get customer analytics (admin only)
router.get('/:customerId/analytics', 
  authenticate, 
  authorize(['ADMIN', 'SUPER_ADMIN']),
  standardRateLimit,
  CustomerController.getCustomerAnalytics
)

// View customer profile (admin only)
router.get('/:customerId/profile', 
  authenticate, 
  authorize(['ADMIN', 'SUPER_ADMIN']),
  standardRateLimit,
  CustomerController.adminGetCustomerProfile
)

// Update customer status (admin only)
router.put('/:customerId/status', 
  authenticate, 
  authorize(['ADMIN', 'SUPER_ADMIN']),
  csrfProtection,
  standardRateLimit,
  CustomerController.adminUpdateCustomerStatus
)

export default router