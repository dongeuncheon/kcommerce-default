import { Request, Response } from 'express'
import { cartService } from '../../services/cartService'
import { sessionService } from '../../services/sessionService'
import { asyncHandler } from '../../middleware/error'
import {
  CreateCartSchema,
  UpdateCartSchema,
  AddCartItemSchema,
  UpdateCartItemSchema,
  CartQuerySchema,
  CartParamsSchema,
  CartItemParamsSchema,
  ApplyCouponSchema,
  RemoveCouponSchema,
  MergeCartsSchema,
  TransferCartSchema,
} from '../../types/cart'
import { logger } from '../../utils/logger'
import { z } from 'zod'

export class CartController {

  // Create a new cart
  createCart = asyncHandler(async (req: Request, res: Response) => {
    const validatedData = CreateCartSchema.parse(req.body)
    
    // If no sessionId provided, generate one
    if (!validatedData.userId && !validatedData.sessionId) {
      validatedData.sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }

    const cart = await cartService.createCart(validatedData)

    res.status(201).json({
      success: true,
      data: cart,
      message: 'Cart created successfully',
    })
  })

  // Get cart by ID
  getCartById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = CartParamsSchema.parse(req.params)
    const cart = await cartService.getCartById(id)

    res.json({
      success: true,
      data: cart,
    })
  })

  // Get cart by user or session
  getCartByUserOrSession = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { userId, sessionId } = req.query

    if (!userId && !sessionId) {
      res.status(400).json({
        success: false,
        error: {
          type: 'ValidationError',
          message: 'Either userId or sessionId must be provided',
        },
      })
      return
    }

    const cart = await cartService.getCartByUserOrSession(
      userId as string,
      sessionId as string
    )

    if (!cart) {
      res.status(404).json({
        success: false,
        error: {
          type: 'NotFoundError',
          message: 'Cart not found',
        },
      })
      return
    }

    res.json({
      success: true,
      data: cart,
    })
  })

  // Get all carts with pagination
  getCarts = asyncHandler(async (req: Request, res: Response) => {
    const validatedQuery = CartQuerySchema.parse(req.query)
    const result = await cartService.getCarts(validatedQuery)

    res.json({
      success: true,
      data: result.carts,
      pagination: result.pagination,
    })
  })

  // Update cart
  updateCart = asyncHandler(async (req: Request, res: Response) => {
    const { id } = CartParamsSchema.parse(req.params)
    const validatedData = UpdateCartSchema.parse(req.body)

    const cart = await cartService.updateCart(id, validatedData)

    res.json({
      success: true,
      data: cart,
      message: 'Cart updated successfully',
    })
  })

  // Delete cart
  deleteCart = asyncHandler(async (req: Request, res: Response) => {
    const { id } = CartParamsSchema.parse(req.params)
    await cartService.deleteCart(id)

    res.json({
      success: true,
      message: 'Cart deleted successfully',
    })
  })

  // Add item to cart
  addItemToCart = asyncHandler(async (req: Request, res: Response) => {
    const { id } = CartParamsSchema.parse(req.params)
    const validatedData = AddCartItemSchema.parse(req.body)

    const cart = await cartService.addItemToCart(id, validatedData)

    res.json({
      success: true,
      data: cart,
      message: 'Item added to cart successfully',
    })
  })

  // Update cart item
  updateCartItem = asyncHandler(async (req: Request, res: Response) => {
    const { cartId, itemId } = CartItemParamsSchema.parse(req.params)
    const validatedData = UpdateCartItemSchema.parse(req.body)

    const cart = await cartService.updateCartItem(cartId, itemId, validatedData)

    res.json({
      success: true,
      data: cart,
      message: 'Cart item updated successfully',
    })
  })

  // Remove item from cart
  removeCartItem = asyncHandler(async (req: Request, res: Response) => {
    const { cartId, itemId } = CartItemParamsSchema.parse(req.params)

    const cart = await cartService.removeCartItem(cartId, itemId)

    res.json({
      success: true,
      data: cart,
      message: 'Item removed from cart successfully',
    })
  })

  // Clear cart
  clearCart = asyncHandler(async (req: Request, res: Response) => {
    const { id } = CartParamsSchema.parse(req.params)

    const cart = await cartService.clearCart(id)

    res.json({
      success: true,
      data: cart,
      message: 'Cart cleared successfully',
    })
  })

  // Apply coupon to cart
  applyCoupon = asyncHandler(async (req: Request, res: Response) => {
    const { id } = CartParamsSchema.parse(req.params)
    const validatedData = ApplyCouponSchema.parse(req.body)

    const cart = await cartService.applyCoupon(id, validatedData)

    res.json({
      success: true,
      data: cart,
      message: 'Coupon applied successfully',
    })
  })

  // Remove coupon from cart
  removeCoupon = asyncHandler(async (req: Request, res: Response) => {
    const { id } = CartParamsSchema.parse(req.params)
    const { couponId } = RemoveCouponSchema.parse(req.body)

    const cart = await cartService.removeCoupon(id, couponId)

    res.json({
      success: true,
      data: cart,
      message: 'Coupon removed successfully',
    })
  })

  // Merge carts
  mergeCarts = asyncHandler(async (req: Request, res: Response) => {
    const validatedData = MergeCartsSchema.parse(req.body)

    const cart = await cartService.mergeCarts(validatedData)

    res.json({
      success: true,
      data: cart,
      message: 'Carts merged successfully',
    })
  })

  // Transfer cart from session to user
  transferCart = asyncHandler(async (req: Request, res: Response) => {
    const validatedData = TransferCartSchema.parse(req.body)

    const cart = await cartService.transferCart(validatedData)

    res.json({
      success: true,
      data: cart,
      message: 'Cart transferred successfully',
    })
  })

  // Validate cart stock
  validateCartStock = asyncHandler(async (req: Request, res: Response) => {
    const { id } = CartParamsSchema.parse(req.params)

    const result = await cartService.validateCartStock(id)

    res.json({
      success: true,
      data: result,
    })
  })

  // Get cart summary/totals
  getCartSummary = asyncHandler(async (req: Request, res: Response) => {
    const { id } = CartParamsSchema.parse(req.params)
    const cart = await cartService.getCartById(id)

    res.json({
      success: true,
      data: {
        id: cart.id,
        itemCount: cart.totals.itemCount,
        totals: cart.totals,
        appliedCoupons: cart.appliedCoupons,
        isExpired: cart.isExpired,
        lastActivity: cart.lastActivity,
      },
    })
  })

  // Get cart items count
  getCartItemsCount = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { userId, sessionId } = req.query

    if (!userId && !sessionId) {
      res.json({
        success: true,
        data: { count: 0 },
      })
      return
    }

    const cart = await cartService.getCartByUserOrSession(
      userId as string,
      sessionId as string
    )

    const count = cart ? cart.totals.itemCount : 0

    res.json({
      success: true,
      data: { count },
    })
  })

  // Quick add to cart (simplified endpoint)
  quickAddToCart = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { productId, variantId, quantity = 1 } = req.body
    const { userId, sessionId } = req.query

    if (!productId) {
      res.status(400).json({
        success: false,
        error: {
          type: 'ValidationError',
          message: 'Product ID is required',
        },
      })
      return
    }

    // Try to find existing cart or create new one
    let cart = await cartService.getCartByUserOrSession(
      userId as string,
      sessionId as string
    )

    if (!cart) {
      // Create new cart
      const createData = {
        userId: userId as string,
        sessionId: sessionId as string || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        currency: 'USD',
      }
      cart = await cartService.createCart(createData)
    }

    // Add item to cart
    const updatedCart = await cartService.addItemToCart(cart.id, {
      productId,
      variantId,
      quantity: Number(quantity),
    })

    res.json({
      success: true,
      data: updatedCart,
      message: 'Item added to cart successfully',
    })
  })

  // Cleanup expired carts (admin endpoint)
  cleanupExpiredCarts = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const count = await cartService.cleanupExpiredCarts()

    res.json({
      success: true,
      data: { deletedCount: count },
      message: `Cleaned up ${count} expired carts`,
    })
  })

  // Restore cart from local storage (for PWA/offline support)
  restoreCart = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { cartData, userId, sessionId } = req.body

    if (!cartData || !cartData.items || !Array.isArray(cartData.items)) {
      res.status(400).json({
        success: false,
        error: {
          type: 'ValidationError',
          message: 'Invalid cart data provided',
        },
      })
      return
    }

    // Create new cart with restored items
    const createData = {
      userId,
      sessionId,
      currency: cartData.currency || 'USD',
      items: cartData.items.map((item: any) => ({
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
      })),
    }

    const cart = await cartService.createCart(createData)

    logger.info(`Cart restored for ${userId ? `user ${userId}` : `session ${sessionId}`}`)

    res.status(201).json({
      success: true,
      data: cart,
      message: 'Cart restored successfully',
    })
  })

  // Duplicate cart (for save for later functionality)
  duplicateCart = asyncHandler(async (req: Request, res: Response) => {
    const { id } = CartParamsSchema.parse(req.params)
    const { userId, sessionId } = req.body

    const originalCart = await cartService.getCartById(id)

    const createData = {
      userId,
      sessionId: sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      currency: originalCart.currency,
      items: originalCart.items.map(item => ({
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
      })),
    }

    const duplicatedCart = await cartService.createCart(createData)

    res.status(201).json({
      success: true,
      data: duplicatedCart,
      message: 'Cart duplicated successfully',
    })
  })

  // ===== GUEST-SPECIFIC ENDPOINTS =====

  // Get or create guest cart by session
  getOrCreateGuestCart = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { sessionId } = req.query
    
    if (!sessionId) {
      res.status(400).json({
        success: false,
        error: { message: 'Session ID is required for guest cart' }
      })
      return
    }

    // Try to find existing guest cart
    let cart = await cartService.getCartByUserOrSession(undefined, sessionId as string)
    
    if (!cart) {
      // Create new guest cart
      cart = await cartService.createCart({
        sessionId: sessionId as string,
        currency: 'USD'
      })
      
      logger.info(`Created new guest cart for session: ${sessionId}`)
    }

    res.json({
      success: true,
      data: cart,
      message: cart.items.length === 0 ? 'Empty guest cart ready' : 'Guest cart retrieved'
    })
  })

  // Get guest session info
  getGuestSessionInfo = asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params
    
    const sessionInfo = await sessionService.getSessionInfo(sessionId)
    
    res.json({
      success: true,
      data: sessionInfo
    })
  })

  // Extend guest session
  extendGuestSession = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { sessionId } = req.params
    const { hours = 24 } = req.body
    
    const ExtendSessionSchema = z.object({
      hours: z.number().min(1).max(168).default(24) // Max 1 week
    })
    
    const { hours: validatedHours } = ExtendSessionSchema.parse({ hours })
    
    const session = await sessionService.extendSession(sessionId, validatedHours)
    
    if (!session) {
      res.status(404).json({
        success: false,
        error: { message: 'Guest session not found' }
      })
      return
    }

    res.json({
      success: true,
      data: session,
      message: `Session extended by ${validatedHours} hours`
    })
  })

  // Transfer guest cart to authenticated user
  transferGuestCart = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { sessionId, userId } = req.body
    
    const TransferGuestCartSchema = z.object({
      sessionId: z.string().min(1, 'Session ID is required'),
      userId: z.string().cuid('Invalid user ID')
    })
    
    const validatedData = TransferGuestCartSchema.parse({ sessionId, userId })
    
    const success = await sessionService.transferSessionToUser(validatedData.sessionId, validatedData.userId)
    
    if (!success) {
      res.status(404).json({
        success: false,
        error: { message: 'Guest cart not found or transfer failed' }
      })
      return
    }

    // Get the user's cart after transfer
    const userCart = await cartService.getCartByUserOrSession(validatedData.userId)

    res.json({
      success: true,
      data: userCart,
      message: 'Guest cart transferred to user successfully'
    })
  })

  // Quick add to guest cart (auto-create cart if needed)
  quickAddToGuestCart = asyncHandler(async (req: Request, res: Response) => {
    const { sessionId, productId, variantId, quantity = 1 } = req.body
    
    const QuickAddSchema = z.object({
      sessionId: z.string().min(1, 'Session ID is required'),
      productId: z.string().cuid('Invalid product ID'),
      variantId: z.string().cuid().optional(),
      quantity: z.number().int().min(1).max(999).default(1)
    })
    
    const validatedData = QuickAddSchema.parse({ sessionId, productId, variantId, quantity })
    
    // Get or create guest cart
    let cart = await cartService.getCartByUserOrSession(undefined, validatedData.sessionId)
    
    if (!cart) {
      cart = await cartService.createCart({
        sessionId: validatedData.sessionId,
        currency: 'USD'
      })
    }

    // Add item to cart
    const updatedCart = await cartService.addItemToCart(cart.id, {
      productId: validatedData.productId,
      variantId: validatedData.variantId,
      quantity: validatedData.quantity
    })

    res.json({
      success: true,
      data: updatedCart,
      message: 'Item added to guest cart'
    })
  })

  // Get guest cart summary (lightweight version)
  getGuestCartSummary = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { sessionId } = req.params
    
    const cart = await cartService.getCartByUserOrSession(undefined, sessionId)
    
    if (!cart) {
      res.json({
        success: true,
        data: {
          itemCount: 0,
          total: 0,
          subtotal: 0,
          currency: 'USD',
          isEmpty: true
        }
      })
      return
    }

    res.json({
      success: true,
      data: {
        cartId: cart.id,
        itemCount: cart.totals.itemCount,
        total: cart.totals.total,
        subtotal: cart.totals.subtotal,
        taxAmount: cart.totals.taxAmount,
        discountAmount: cart.totals.discountAmount,
        currency: cart.currency,
        isEmpty: cart.items.length === 0,
        expiresAt: cart.expiresAt,
        isExpired: cart.isExpired
      }
    })
  })

  // Migrate guest cart data from local storage
  migrateGuestCartFromLocalStorage = asyncHandler(async (req: Request, res: Response) => {
    const { sessionId, cartData } = req.body
    
    const MigrateCartSchema = z.object({
      sessionId: z.string().min(1, 'Session ID is required'),
      cartData: z.object({
        items: z.array(z.object({
          productId: z.string().cuid(),
          variantId: z.string().cuid().optional(),
          quantity: z.number().int().min(1),
          options: z.record(z.any()).optional()
        })),
        coupons: z.array(z.string()).optional(),
        currency: z.string().length(3).default('USD')
      })
    })
    
    const validatedData = MigrateCartSchema.parse({ sessionId, cartData })
    
    // Create new guest cart
    const cart = await cartService.createCart({
      sessionId: validatedData.sessionId,
      currency: validatedData.cartData.currency
    })

    // Add items from local storage
    for (const item of validatedData.cartData.items) {
      try {
        await cartService.addItemToCart(cart.id, item)
      } catch (error) {
        logger.warn(`Failed to migrate item ${item.productId}:`, error)
        // Continue with other items
      }
    }

    // Apply coupons if any
    if (validatedData.cartData.coupons) {
      for (const couponCode of validatedData.cartData.coupons) {
        try {
          await cartService.applyCoupon(cart.id, { couponCode })
        } catch (error) {
          logger.warn(`Failed to apply coupon ${couponCode}:`, error)
          // Continue with other coupons
        }
      }
    }

    // Get updated cart
    const migratedCart = await cartService.getCartById(cart.id)

    res.json({
      success: true,
      data: migratedCart,
      message: 'Guest cart migrated from local storage'
    })
  })

  // Get guest session statistics (for analytics)
  getGuestSessionStats = asyncHandler(async (req: Request, res: Response) => {
    const { hours = 24 } = req.query
    
    const stats = await sessionService.getSessionStats(Number(hours))
    
    res.json({
      success: true,
      data: stats
    })
  })
}

export const cartController = new CartController()