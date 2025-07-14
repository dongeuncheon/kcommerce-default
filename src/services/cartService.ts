import { Prisma, ProductVariant } from '@prisma/client'
import { prisma } from '../utils/database'
import { logger } from '../utils/logger'
import { AppError } from '../middleware/error'
import { productOptionsService } from './productOptionsService'
import {
  CreateCartInput,
  UpdateCartInput,
  AddCartItemInput,
  UpdateCartItemInput,
  CartQueryInput,
  ApplyCouponInput,
  MergeCartsInput,
  TransferCartInput,
  CartWithDetails,
  CartItemWithDetails,
  CartTotals,
  StockValidationResult,
} from '../types/cart'

// Type for cart with all relations - using any for complex types to avoid build issues
type CartWithRelations = any

export class CartService {
  private readonly CART_EXPIRY_HOURS = 72 // 3 days
  private readonly MAX_CART_ITEMS = 100
  private readonly MIN_QUANTITY = 1
  private readonly MAX_QUANTITY = 999

  // Create a new cart
  async createCart(data: CreateCartInput): Promise<CartWithDetails> {
    try {
      // Set expiry date
      const expiresAt = new Date()
      expiresAt.setHours(expiresAt.getHours() + this.CART_EXPIRY_HOURS)

      const cart = await prisma.$transaction(async (tx) => {
        // Create the cart
        const createdCart = await tx.cart.create({
          data: {
            userId: data.userId,
            sessionId: data.sessionId,
            currency: data.currency,
            expiresAt,
          },
        })

        // Add initial items if provided
        if (data.items && data.items.length > 0) {
          for (const item of data.items) {
            await this.performAddItemToCart(tx, createdCart.id, item)
          }
        }

        return createdCart
      })

      logger.info(`Cart created: ${cart.id}`)
      return this.getCartWithDetails(cart.id)
    } catch (error) {
      logger.error('Error creating cart:', error)
      throw error
    }
  }

  // Get cart by ID with all details
  async getCartById(id: string): Promise<CartWithDetails> {
    return this.getCartWithDetails(id)
  }

  // Get cart by user ID or session ID
  async getCartByUserOrSession(userId?: string, sessionId?: string): Promise<CartWithDetails | null> {
    if (!userId && !sessionId) {
      throw new AppError('Either userId or sessionId must be provided', 400)
    }

    const where: Prisma.CartWhereInput = {
      OR: [],
      expiresAt: {
        gt: new Date(), // Only non-expired carts
      },
    }

    if (userId) {
      where.OR!.push({ userId })
    }
    if (sessionId) {
      where.OR!.push({ sessionId })
    }

    const cart = await prisma.cart.findFirst({
      where,
      orderBy: { updatedAt: 'desc' },
    })

    if (!cart) {
      return null
    }

    return this.getCartWithDetails(cart.id)
  }

  // Get all carts with pagination
  async getCarts(query: CartQueryInput): Promise<{
    carts: CartWithDetails[]
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
    }
  }> {
    const { page, limit, userId, sessionId, includeExpired } = query

    const where: Prisma.CartWhereInput = {}

    if (userId) {
      where.userId = userId
    }

    if (sessionId) {
      where.sessionId = sessionId
    }

    if (!includeExpired) {
      where.expiresAt = {
        gt: new Date(),
      }
    }

    const skip = (page - 1) * limit

    const [carts, total] = await Promise.all([
      prisma.cart.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.cart.count({ where }),
    ])

    // Get detailed cart information
    const cartsWithDetails = await Promise.all(
      carts.map(cart => this.getCartWithDetails(cart.id)),
    )

    return {
      carts: cartsWithDetails,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }
  }

  // Update cart
  async updateCart(id: string, data: UpdateCartInput): Promise<CartWithDetails> {
    const existingCart = await prisma.cart.findUnique({
      where: { id },
    })

    if (!existingCart) {
      throw new AppError('Cart not found', 404)
    }

    if (this.isCartExpired(existingCart)) {
      throw new AppError('Cart has expired', 410)
    }

    await prisma.cart.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    })

    logger.info(`Cart updated: ${id}`)
    return this.getCartWithDetails(id)
  }

  // Delete cart
  async deleteCart(id: string): Promise<void> {
    const cart = await prisma.cart.findUnique({
      where: { id },
    })

    if (!cart) {
      throw new AppError('Cart not found', 404)
    }

    await prisma.cart.delete({
      where: { id },
    })

    logger.info(`Cart deleted: ${id}`)
  }

  // Add item to cart
  async addItemToCart(cartId: string, itemData: AddCartItemInput): Promise<CartWithDetails> {
    await prisma.$transaction(async (transaction) => {
      await this.performAddItemToCart(transaction, cartId, itemData)
    })

    logger.info(`Item added to cart ${cartId}: ${itemData.productId}`)
    return this.getCartWithDetails(cartId)
  }

  private async performAddItemToCart(
    tx: any,
    cartId: string,
    data: AddCartItemInput,
  ): Promise<void> {
    // Verify cart exists and is not expired
    const cart = await tx.cart.findUnique({
      where: { id: cartId },
      include: { items: true },
    })

    if (!cart) {
      throw new AppError('Cart not found', 404)
    }

    if (this.isCartExpired(cart)) {
      throw new AppError('Cart has expired', 410)
    }

    // Check cart item limit
    if (cart.items.length >= this.MAX_CART_ITEMS) {
      throw new AppError(`Cannot add more than ${this.MAX_CART_ITEMS} items to cart`, 400)
    }

    // Verify product exists and is available
    const product = await tx.product.findUnique({
      where: { id: data.productId },
      include: {
        variants: data.variantId ? {
          where: { id: data.variantId },
        } : false,
      },
    })

    if (!product) {
      throw new AppError('Product not found', 404)
    }

    if (product.status !== 'PUBLISHED') {
      throw new AppError('Product is not available', 400)
    }

    // Verify variant if specified
    let variant: ProductVariant | undefined
    if (data.variantId) {
      variant = product.variants?.[0]
      if (!variant || !variant.isActive) {
        throw new AppError('Product variant not found or inactive', 404)
      }
    }

    // Check stock availability
    const availableQuantity = variant ? variant.quantity : product.quantity
    if (product.trackQuantity || (variant && product.trackQuantity)) {
      if (availableQuantity < data.quantity) {
        throw new AppError('Insufficient stock available', 400)
      }
    }

    // Validate product options if provided and calculate final price
    let finalPrice: number = variant ? Number(variant.price) : Number(product.price)
    if (data.options) {
      try {
        // Validate options
        const validation = await productOptionsService.validateProductOptions(
          data.productId,
          data.options,
        )

        if (!validation.isValid) {
          const errorMessages = validation.errors.map(e => e.message).join(', ')
          throw new AppError(`Invalid product options: ${errorMessages}`, 400)
        }

        // Calculate price with options
        const pricing = await productOptionsService.calculateOptionPricing(
          data.productId,
          data.options,
        )

        finalPrice = Number(pricing.finalPrice)
      } catch (error) {
        if (error instanceof AppError) {
          throw error
        }
        logger.warn('Error validating product options:', error)
        // Continue without options validation if service is unavailable
      }
    }

    // Check if item already exists in cart (including options comparison)
    const existingItem = await tx.cartItem.findFirst({
      where: {
        cartId,
        productId: data.productId,
        variantId: data.variantId || null,
        // Only combine items if options are identical
        options: data.options ? data.options : null,
      },
    })

    if (existingItem) {
      // Update existing item quantity
      const newQuantity = existingItem.quantity + data.quantity

      if (newQuantity > this.MAX_QUANTITY) {
        throw new AppError(`Quantity cannot exceed ${this.MAX_QUANTITY}`, 400)
      }

      // Check stock for updated quantity
      if (product.trackQuantity && availableQuantity < newQuantity) {
        throw new AppError('Insufficient stock for requested quantity', 400)
      }

      await tx.cartItem.update({
        where: { id: existingItem.id },
        data: {
          quantity: newQuantity,
          price: new Prisma.Decimal(finalPrice), // Update price in case it changed
          updatedAt: new Date(),
        },
      })
    } else {
      // Create new cart item
      await tx.cartItem.create({
        data: {
          cartId,
          productId: data.productId,
          variantId: data.variantId,
          quantity: data.quantity,
          price: new Prisma.Decimal(finalPrice),
          options: data.options,
        },
      })
    }

    // Update cart's updatedAt timestamp
    await tx.cart.update({
      where: { id: cartId },
      data: { updatedAt: new Date() },
    })
  }

  // Update cart item
  async updateCartItem(
    cartId: string,
    itemId: string,
    data: UpdateCartItemInput & { options?: Record<string, any> },
  ): Promise<CartWithDetails> {
    const cart = await prisma.cart.findUnique({
      where: { id: cartId },
    })

    if (!cart) {
      throw new AppError('Cart not found', 404)
    }

    if (this.isCartExpired(cart)) {
      throw new AppError('Cart has expired', 410)
    }

    const cartItem = await prisma.cartItem.findFirst({
      where: {
        id: itemId,
        cartId,
      },
      include: {
        product: true,
        variant: true,
      },
    })

    if (!cartItem) {
      throw new AppError('Cart item not found', 404)
    }

    // Validate quantity
    if (data.quantity < this.MIN_QUANTITY || data.quantity > this.MAX_QUANTITY) {
      throw new AppError(
        `Quantity must be between ${this.MIN_QUANTITY} and ${this.MAX_QUANTITY}`,
        400,
      )
    }

    // Check stock availability
    const availableQuantity = cartItem.variant
      ? cartItem.variant.quantity
      : cartItem.product.quantity

    if (cartItem.product.trackQuantity && availableQuantity < data.quantity) {
      throw new AppError('Insufficient stock for requested quantity', 400)
    }

    // Calculate new price if options changed
    let finalPrice: number = cartItem.variant ? Number(cartItem.variant.price) : Number(cartItem.product.price)
    if (data.options) {
      try {
        const validation = await productOptionsService.validateProductOptions(
          cartItem.productId,
          data.options,
        )

        if (!validation.isValid) {
          const errorMessages = validation.errors.map(e => e.message).join(', ')
          throw new AppError(`Invalid product options: ${errorMessages}`, 400)
        }

        const pricing = await productOptionsService.calculateOptionPricing(
          cartItem.productId,
          data.options,
        )

        finalPrice = Number(pricing.finalPrice)
      } catch (error) {
        if (error instanceof AppError) {
          throw error
        }
        logger.warn('Error validating product options during update:', error)
        // Continue without options validation if service is unavailable
      }
    }

    await prisma.$transaction(async (tx) => {
      const updateData: any = {
        quantity: data.quantity,
        updatedAt: new Date(),
      }

      // Update price if options changed
      if (data.options) {
        updateData.price = new Prisma.Decimal(finalPrice)
        updateData.options = data.options
      }

      await tx.cartItem.update({
        where: { id: itemId },
        data: updateData,
      })

      await tx.cart.update({
        where: { id: cartId },
        data: { updatedAt: new Date() },
      })
    })

    logger.info(`Cart item updated: ${itemId} in cart ${cartId}`)
    return this.getCartWithDetails(cartId)
  }

  // Remove item from cart
  async removeCartItem(cartId: string, itemId: string): Promise<CartWithDetails> {
    const cart = await prisma.cart.findUnique({
      where: { id: cartId },
    })

    if (!cart) {
      throw new AppError('Cart not found', 404)
    }

    if (this.isCartExpired(cart)) {
      throw new AppError('Cart has expired', 410)
    }

    const cartItem = await prisma.cartItem.findFirst({
      where: {
        id: itemId,
        cartId,
      },
    })

    if (!cartItem) {
      throw new AppError('Cart item not found', 404)
    }

    await prisma.$transaction(async (tx) => {
      await tx.cartItem.delete({
        where: { id: itemId },
      })

      await tx.cart.update({
        where: { id: cartId },
        data: { updatedAt: new Date() },
      })
    })

    logger.info(`Cart item removed: ${itemId} from cart ${cartId}`)
    return this.getCartWithDetails(cartId)
  }

  // Clear all items from cart
  async clearCart(cartId: string): Promise<CartWithDetails> {
    const cart = await prisma.cart.findUnique({
      where: { id: cartId },
    })

    if (!cart) {
      throw new AppError('Cart not found', 404)
    }

    if (this.isCartExpired(cart)) {
      throw new AppError('Cart has expired', 410)
    }

    await prisma.$transaction(async (tx) => {
      await tx.cartItem.deleteMany({
        where: { cartId },
      })

      await tx.cartCoupon.deleteMany({
        where: { cartId },
      })

      await tx.cart.update({
        where: { id: cartId },
        data: {
          subtotal: 0,
          taxAmount: 0,
          shippingCost: 0,
          discountAmount: 0,
          total: 0,
          updatedAt: new Date(),
        },
      })
    })

    logger.info(`Cart cleared: ${cartId}`)
    return this.getCartWithDetails(cartId)
  }

  // Apply coupon to cart
  async applyCoupon(cartId: string, data: ApplyCouponInput): Promise<CartWithDetails> {
    const cart = await prisma.cart.findUnique({
      where: { id: cartId },
      include: {
        items: true,
        coupons: {
          include: { coupon: true },
        },
      },
    })

    if (!cart) {
      throw new AppError('Cart not found', 404)
    }

    if (this.isCartExpired(cart)) {
      throw new AppError('Cart has expired', 410)
    }

    // Find the coupon
    const coupon = await prisma.coupon.findUnique({
      where: { code: data.couponCode },
    })

    if (!coupon) {
      throw new AppError('Invalid coupon code', 400)
    }

    // Validate coupon
    if (!coupon.isActive) {
      throw new AppError('Coupon is inactive', 400)
    }

    if (coupon.expiresAt && coupon.expiresAt < new Date()) {
      throw new AppError('Coupon has expired', 400)
    }

    if (coupon.startsAt && coupon.startsAt > new Date()) {
      throw new AppError('Coupon is not yet active', 400)
    }

    if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
      throw new AppError('Coupon usage limit exceeded', 400)
    }

    // Check if coupon is already applied
    const existingCoupon = cart.coupons.find(cc => cc.coupon.code === data.couponCode)
    if (existingCoupon) {
      throw new AppError('Coupon is already applied to this cart', 400)
    }

    // Calculate cart subtotal for minimum order value check
    const subtotal = cart.items.reduce((sum, item) => sum + (Number(item.price) * item.quantity), 0)

    if (coupon.minOrderValue && subtotal < Number(coupon.minOrderValue)) {
      throw new AppError(
        `Minimum order value of ${coupon.minOrderValue} required for this coupon`,
        400,
      )
    }

    await prisma.cartCoupon.create({
      data: {
        cartId,
        couponId: coupon.id,
      },
    })

    logger.info(`Coupon applied to cart ${cartId}: ${data.couponCode}`)
    return this.getCartWithDetails(cartId)
  }

  // Remove coupon from cart
  async removeCoupon(cartId: string, couponId: string): Promise<CartWithDetails> {
    const cart = await prisma.cart.findUnique({
      where: { id: cartId },
    })

    if (!cart) {
      throw new AppError('Cart not found', 404)
    }

    if (this.isCartExpired(cart)) {
      throw new AppError('Cart has expired', 410)
    }

    const cartCoupon = await prisma.cartCoupon.findFirst({
      where: {
        cartId,
        couponId,
      },
    })

    if (!cartCoupon) {
      throw new AppError('Coupon not found in cart', 404)
    }

    await prisma.cartCoupon.delete({
      where: {
        cartId_couponId: {
          cartId,
          couponId,
        },
      },
    })

    logger.info(`Coupon removed from cart ${cartId}: ${couponId}`)
    return this.getCartWithDetails(cartId)
  }

  // Merge two carts
  async mergeCarts(data: MergeCartsInput): Promise<CartWithDetails> {
    const { sourceCartId, targetCartId } = data

    const [sourceCart, targetCart] = await Promise.all([
      prisma.cart.findUnique({
        where: { id: sourceCartId },
        include: { items: true },
      }),
      prisma.cart.findUnique({
        where: { id: targetCartId },
        include: { items: true },
      }),
    ])

    if (!sourceCart) {
      throw new AppError('Source cart not found', 404)
    }

    if (!targetCart) {
      throw new AppError('Target cart not found', 404)
    }

    if (this.isCartExpired(sourceCart) || this.isCartExpired(targetCart)) {
      throw new AppError('One or both carts have expired', 410)
    }

    await prisma.$transaction(async (tx) => {
      // Move items from source to target cart
      for (const item of sourceCart.items) {
        // Check if item already exists in target cart (simplified for type safety)
        const existingItem = await tx.cartItem.findFirst({
          where: {
            cartId: targetCartId,
            productId: item.productId,
            variantId: item.variantId,
          },
        })

        if (existingItem) {
          // Update quantity
          await tx.cartItem.update({
            where: { id: existingItem.id },
            data: {
              quantity: existingItem.quantity + item.quantity,
              updatedAt: new Date(),
            },
          })
        } else {
          // Create new item in target cart
          await tx.cartItem.create({
            data: {
              cartId: targetCartId,
              productId: item.productId,
              variantId: item.variantId,
              quantity: item.quantity,
              price: item.price,
            },
          })
        }
      }

      // Delete source cart
      await tx.cart.delete({
        where: { id: sourceCartId },
      })

      // Update target cart timestamp
      await tx.cart.update({
        where: { id: targetCartId },
        data: { updatedAt: new Date() },
      })
    })

    logger.info(`Carts merged: ${sourceCartId} -> ${targetCartId}`)
    return this.getCartWithDetails(targetCartId)
  }

  // Transfer cart from session to user
  async transferCart(data: TransferCartInput): Promise<CartWithDetails> {
    const { sessionId, userId } = data

    const sessionCart = await prisma.cart.findFirst({
      where: {
        sessionId,
        userId: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { updatedAt: 'desc' },
    })

    if (!sessionCart) {
      throw new AppError('Session cart not found', 404)
    }

    // Check if user already has a cart
    const userCart = await prisma.cart.findFirst({
      where: {
        userId,
        expiresAt: { gt: new Date() },
      },
      orderBy: { updatedAt: 'desc' },
    })

    if (userCart) {
      // Merge session cart into user cart
      await this.mergeCarts({
        sourceCartId: sessionCart.id,
        targetCartId: userCart.id,
      })
      return this.getCartWithDetails(userCart.id)
    } else {
      // Transfer session cart to user
      await prisma.cart.update({
        where: { id: sessionCart.id },
        data: {
          userId,
          sessionId: null,
          updatedAt: new Date(),
        },
      })

      logger.info(`Cart transferred from session ${sessionId} to user ${userId}`)
      return this.getCartWithDetails(sessionCart.id)
    }
  }

  // Validate cart stock
  async validateCartStock(cartId: string): Promise<StockValidationResult> {
    const cart = await prisma.cart.findUnique({
      where: { id: cartId },
      include: {
        items: {
          include: {
            product: true,
            variant: true,
          },
        },
      },
    })

    if (!cart) {
      throw new AppError('Cart not found', 404)
    }

    const issues: StockValidationResult['issues'] = []

    for (const item of cart.items) {
      const availableQuantity = item.variant
        ? item.variant.quantity
        : item.product.quantity

      if (item.product.trackQuantity && availableQuantity < item.quantity) {
        issues.push({
          productId: item.productId,
          variantId: item.variantId || undefined,
          requestedQuantity: item.quantity,
          availableQuantity,
          message: `Only ${availableQuantity} items available, but ${item.quantity} requested`,
        })
      }
    }

    return {
      isValid: issues.length === 0,
      issues,
    }
  }

  // Clean up expired carts
  async cleanupExpiredCarts(): Promise<number> {
    const result = await prisma.cart.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    })

    logger.info(`Cleaned up ${result.count} expired carts`)
    return result.count
  }

  // Private helper methods
  private async getCartWithDetails(cartId: string): Promise<CartWithDetails> {
    const cart = await prisma.cart.findUnique({
      where: { id: cartId },
      include: {
        items: {
          include: {
            product: {
              include: {
                images: {
                  orderBy: { sortOrder: 'asc' },
                },
              },
            },
            variant: true,
          },
        },
        coupons: {
          include: {
            coupon: true,
          },
        },
      },
    })

    if (!cart) {
      throw new AppError('Cart not found', 404)
    }

    // Calculate totals
    const totals = this.calculateCartTotals(cart as any)

    // Transform items with additional details
    const itemsWithDetails: CartItemWithDetails[] = cart.items.map((item: any) => ({
      id: item.id,
      cartId: item.cartId,
      productId: item.productId,
      variantId: item.variantId || undefined,
      quantity: item.quantity,
      unitPrice: Number(item.price),
      totalPrice: Number(item.price) * item.quantity,
      product: {
        id: item.product.id,
        name: item.product.name,
        slug: item.product.slug,
        sku: item.product.sku,
        price: Number(item.product.price),
        images: item.product.images.map((img: any) => ({
          id: img.id,
          url: img.url,
          alt: img.alt || undefined,
          isMain: img.isMain,
        })),
        status: item.product.status,
        trackQuantity: item.product.trackQuantity,
        quantity: item.product.quantity,
      },
      variant: item.variant ? {
        id: item.variant.id,
        name: item.variant.name,
        sku: item.variant.sku,
        price: Number(item.variant.price),
        attributes: item.variant.attributes as Record<string, any>,
        quantity: item.variant.quantity,
      } : undefined,
      options: (item as any).options as Record<string, any> | undefined,
      isAvailable: item.product.status === 'PUBLISHED',
      stockStatus: this.getStockStatus(item),
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }))

    // Transform applied coupons
    const appliedCoupons = cart.coupons.map(cc => ({
      id: cc.coupon.id,
      code: cc.coupon.code,
      name: cc.coupon.name,
      type: cc.coupon.type as string,
      value: Number(cc.coupon.value),
      discountAmount: this.calculateCouponDiscount(cc.coupon, totals.subtotal),
    }))

    return {
      id: cart.id,
      userId: cart.userId || undefined,
      sessionId: cart.sessionId || undefined,
      currency: cart.currency,
      items: itemsWithDetails,
      totals,
      appliedCoupons,
      expiresAt: cart.expiresAt || undefined,
      isExpired: this.isCartExpired(cart),
      lastActivity: cart.updatedAt,
      createdAt: cart.createdAt,
      updatedAt: cart.updatedAt,
    }
  }

  private calculateCartTotals(cart: CartWithRelations): CartTotals {
    const subtotal = cart.items.reduce((sum: number, item: any) => {
      return sum + (Number(item.price) * item.quantity)
    }, 0)

    // Calculate discount from coupons
    let discountAmount = 0
    for (const cartCoupon of cart.coupons) {
      discountAmount += this.calculateCouponDiscount(cartCoupon.coupon, subtotal)
    }

    // Basic tax calculation (8.25% - should be configurable)
    const taxRate = 0.0825
    const taxableAmount = Math.max(0, subtotal - discountAmount)
    const taxAmount = taxableAmount * taxRate

    // Basic shipping calculation (should be enhanced with real shipping logic)
    const shippingCost = subtotal > 100 ? 0 : 9.99

    const total = subtotal + taxAmount + shippingCost - discountAmount

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      taxAmount: Math.round(taxAmount * 100) / 100,
      shippingCost: Math.round(shippingCost * 100) / 100,
      discountAmount: Math.round(discountAmount * 100) / 100,
      total: Math.round(total * 100) / 100,
      itemCount: cart.items.reduce((sum: number, item: any) => sum + item.quantity, 0),
      currency: cart.currency,
    }
  }

  private calculateCouponDiscount(coupon: any, subtotal: number): number {
    switch (coupon.type) {
    case 'PERCENTAGE':
      return subtotal * (Number(coupon.value) / 100)
    case 'FIXED_AMOUNT':
      return Math.min(Number(coupon.value), subtotal)
    case 'FREE_SHIPPING':
      return 0 // Shipping discount would be handled separately
    default:
      return 0
    }
  }

  private getStockStatus(item: any): 'in_stock' | 'low_stock' | 'out_of_stock' {
    if (!item.product.trackQuantity) {
      return 'in_stock'
    }

    const availableQuantity = item.variant
      ? item.variant.quantity
      : item.product.quantity

    if (availableQuantity <= 0) {
      return 'out_of_stock'
    }

    if (availableQuantity <= item.product.lowStockThreshold) {
      return 'low_stock'
    }

    return 'in_stock'
  }

  private isCartExpired(cart: { expiresAt: Date | null }): boolean {
    return cart.expiresAt ? cart.expiresAt < new Date() : false
  }
}

export const cartService = new CartService()
