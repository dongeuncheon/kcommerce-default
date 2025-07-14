import { Router } from 'express'
import { orderController } from '../controllers/orderController'
import { authenticate, authorize } from '../../middleware/auth'
import {
  orderCreatedMiddleware,
  orderUpdatedMiddleware,
  orderCancelledMiddleware,
  orderShippedMiddleware,
  orderDeliveredMiddleware,
  orderRefundedMiddleware,
  trackStatusChange,
} from '../../middleware/orderWebSocket'

const router = Router()

// All order routes require authentication
router.use(authenticate)

// Customer routes
router.post('/', orderCreatedMiddleware, orderController.createOrder)
router.get('/my-orders', orderController.getMyOrders)
router.get('/my-analytics', orderController.getMyOrderAnalytics)
router.get('/number/:orderNumber', orderController.getOrderByNumber)
router.get('/:id', orderController.getOrderById)
router.get('/:id/timeline', orderController.getOrderTimeline)
router.post('/:id/cancel', orderCancelledMiddleware, orderController.cancelOrder)
router.get('/:id/invoice', orderController.downloadInvoice)
router.post('/:id/resend-confirmation', orderController.resendOrderConfirmation)

// Admin routes
router.get('/', authorize(['ADMIN', 'SUPER_ADMIN']), orderController.getOrders)
router.put('/:id', authorize(['ADMIN', 'SUPER_ADMIN']), trackStatusChange, orderUpdatedMiddleware, orderController.updateOrder)
router.post('/:id/refund', authorize(['ADMIN', 'SUPER_ADMIN']), orderRefundedMiddleware, orderController.processRefund)
router.put('/:id/shipping', authorize(['ADMIN', 'SUPER_ADMIN']), orderShippedMiddleware, orderController.updateShipping)
router.post('/:id/delivered', authorize(['ADMIN', 'SUPER_ADMIN']), orderDeliveredMiddleware, orderController.markAsDelivered)
router.get('/analytics/overview', authorize(['ADMIN', 'SUPER_ADMIN']), orderController.getOrderAnalytics)
router.get('/export', authorize(['ADMIN', 'SUPER_ADMIN']), orderController.exportOrders)

export default router