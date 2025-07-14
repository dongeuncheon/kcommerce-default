import { CartService } from '../../../src/services/cartService'
import { prisma } from '../../../src/utils/database'
import { AppError } from '../../../src/middleware/error'

// Mock Prisma
jest.mock('../../../src/utils/database', () => ({
  prisma: {
    cart: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
    },
    cartItem: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      updateMany: jest.fn(),
    },
    cartCoupon: {
      create: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      findFirst: jest.fn(),
    },
    product: {
      findUnique: jest.fn(),
    },
    coupon: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}))

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}))

describe('CartService', () => {
  let cartService: CartService

  beforeEach(() => {
    cartService = new CartService()
    jest.clearAllMocks()
  })

  describe('createCart', () => {
    const mockCartData = {
      sessionId: 'test-session-123',
      currency: 'USD',
    }

    it('should create a cart successfully', async () => {
      const mockCreatedCart = {
        id: 'cart-1',
        ...mockCartData,
        expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const mockCartWithDetails = {
        ...mockCreatedCart,
        items: [],
        totals: {
          subtotal: 0,
          taxAmount: 0,
          shippingCost: 9.99,
          discountAmount: 0,
          total: 9.99,
          itemCount: 0,
          currency: 'USD',
        },
        appliedCoupons: [],
        isExpired: false,
        lastActivity: mockCreatedCart.updatedAt,
      }

      // Mock transaction
      ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return callback({
          cart: {
            create: jest.fn().mockResolvedValue(mockCreatedCart),
          },
        })
      })

      // Mock getCartWithDetails call
      jest.spyOn(cartService as any, 'getCartWithDetails').mockResolvedValue(mockCartWithDetails)

      const result = await cartService.createCart(mockCartData)

      expect(result).toEqual(mockCartWithDetails)
      expect(prisma.$transaction).toHaveBeenCalled()
    })

    it('should create cart with initial items', async () => {
      const cartDataWithItems = {
        ...mockCartData,
        items: [
          {
            productId: 'product-1',
            quantity: 2,
          },
        ],
      }

      const mockCreatedCart = {
        id: 'cart-1',
        sessionId: 'test-session-123',
        currency: 'USD',
        expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      // Mock transaction with item creation
      ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return callback({
          cart: {
            create: jest.fn().mockResolvedValue(mockCreatedCart),
          },
        })
      })

      // Mock addItemToCart method
      jest.spyOn(cartService as any, 'addItemToCart').mockResolvedValue(undefined)
      jest.spyOn(cartService as any, 'getCartWithDetails').mockResolvedValue({
        ...mockCreatedCart,
        items: [{ productId: 'product-1', quantity: 2 }],
        totals: { itemCount: 2 },
      })

      const result = await cartService.createCart(cartDataWithItems)

      expect(result.items).toHaveLength(1)
      expect(result.totals.itemCount).toBe(2)
    })
  })

  describe('getCartByUserOrSession', () => {
    it('should find cart by session ID', async () => {
      const mockCart = {
        id: 'cart-1',
        sessionId: 'test-session-123',
        expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
      }

      ;(prisma.cart.findFirst as jest.Mock).mockResolvedValue(mockCart)
      jest.spyOn(cartService as any, 'getCartWithDetails').mockResolvedValue(mockCart)

      const result = await cartService.getCartByUserOrSession(undefined, 'test-session-123')

      expect(result).toEqual(mockCart)
      expect(prisma.cart.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [{ sessionId: 'test-session-123' }],
          expiresAt: { gt: expect.any(Date) },
        },
        orderBy: { updatedAt: 'desc' },
      })
    })

    it('should find cart by user ID', async () => {
      const mockCart = {
        id: 'cart-1',
        userId: 'user-123',
        expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
      }

      ;(prisma.cart.findFirst as jest.Mock).mockResolvedValue(mockCart)
      jest.spyOn(cartService as any, 'getCartWithDetails').mockResolvedValue(mockCart)

      const result = await cartService.getCartByUserOrSession('user-123')

      expect(result).toEqual(mockCart)
      expect(prisma.cart.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [{ userId: 'user-123' }],
          expiresAt: { gt: expect.any(Date) },
        },
        orderBy: { updatedAt: 'desc' },
      })
    })

    it('should return null if cart not found', async () => {
      ;(prisma.cart.findFirst as jest.Mock).mockResolvedValue(null)

      const result = await cartService.getCartByUserOrSession(undefined, 'non-existent')

      expect(result).toBeNull()
    })

    it('should throw error if neither userId nor sessionId provided', async () => {
      await expect(cartService.getCartByUserOrSession()).rejects.toThrow(
        new AppError('Either userId or sessionId must be provided', 400)
      )
    })
  })

  describe('addItemToCart', () => {
    const cartId = 'cart-1'
    const itemData = {
      productId: 'product-1',
      quantity: 2,
    }

    it('should add item to cart successfully', async () => {
      const mockCart = {
        id: cartId,
        expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
        items: [],
      }

      const mockProduct = {
        id: 'product-1',
        status: 'PUBLISHED',
        trackQuantity: true,
        quantity: 10,
        price: 99.99,
      }

      const mockCartWithDetails = {
        ...mockCart,
        items: [{ productId: 'product-1', quantity: 2, price: 99.99 }],
        totals: { itemCount: 2 },
      }

      // Mock transaction
      ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        await callback(prisma) // Call the transaction callback with mock prisma
      })

      // Mock private method
      jest.spyOn(cartService as any, 'performAddItemToCart').mockResolvedValue(undefined)
      jest.spyOn(cartService as any, 'getCartWithDetails').mockResolvedValue(mockCartWithDetails)

      const result = await cartService.addItemToCart(cartId, itemData)

      expect(result).toEqual(mockCartWithDetails)
      expect(prisma.$transaction).toHaveBeenCalled()
    })

    it('should update existing item quantity', async () => {
      const mockCart = {
        id: cartId,
        expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
        items: [{ id: 'item-1', productId: 'product-1', quantity: 1 }],
      }

      const mockProduct = {
        id: 'product-1',
        status: 'PUBLISHED',
        trackQuantity: true,
        quantity: 10,
        price: 99.99,
      }

      const mockExistingItem = {
        id: 'item-1',
        cartId,
        productId: 'product-1',
        quantity: 1,
        price: 99.99,
      }

      const mockCartWithDetails = {
        ...mockCart,
        items: [{ ...mockExistingItem, quantity: 3 }], // 1 + 2
        totals: { itemCount: 3 },
      }

      // Mock the performAddItemToCart private method
      jest.spyOn(cartService as any, 'performAddItemToCart').mockImplementation(async (tx, cartId, data) => {
        // Mock finding existing cart
        tx.cart.findUnique = jest.fn().mockResolvedValue(mockCart)
        
        // Mock finding product
        tx.product.findUnique = jest.fn().mockResolvedValue(mockProduct)
        
        // Mock finding existing item
        tx.cartItem.findFirst = jest.fn().mockResolvedValue(mockExistingItem)
        
        // Mock updating existing item
        tx.cartItem.update = jest.fn().mockResolvedValue({ ...mockExistingItem, quantity: 3 })
        
        // Mock updating cart timestamp
        tx.cart.update = jest.fn().mockResolvedValue(mockCart)
      })

      ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        await callback(prisma)
      })

      jest.spyOn(cartService as any, 'getCartWithDetails').mockResolvedValue(mockCartWithDetails)

      const result = await cartService.addItemToCart(cartId, itemData)

      expect(result.totals.itemCount).toBe(3)
    })
  })

  describe('updateCartItem', () => {
    const cartId = 'cart-1'
    const itemId = 'item-1'
    const updateData = { quantity: 5 }

    it('should update cart item successfully', async () => {
      const mockCart = {
        id: cartId,
        expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
      }

      const mockCartItem = {
        id: itemId,
        cartId,
        productId: 'product-1',
        quantity: 2,
        product: {
          trackQuantity: true,
          quantity: 10,
        },
        variant: null,
      }

      const mockUpdatedCart = {
        ...mockCart,
        items: [{ ...mockCartItem, quantity: 5 }],
        totals: { itemCount: 5 },
      }

      ;(prisma.cart.findUnique as jest.Mock).mockResolvedValue(mockCart)
      ;(prisma.cartItem.findFirst as jest.Mock).mockResolvedValue(mockCartItem)
      ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        await callback({
          cartItem: {
            update: jest.fn().mockResolvedValue({ ...mockCartItem, quantity: 5 }),
          },
          cart: {
            update: jest.fn().mockResolvedValue(mockCart),
          },
        })
      })

      jest.spyOn(cartService as any, 'getCartWithDetails').mockResolvedValue(mockUpdatedCart)

      const result = await cartService.updateCartItem(cartId, itemId, updateData)

      expect(result.totals.itemCount).toBe(5)
      expect(prisma.$transaction).toHaveBeenCalled()
    })

    it('should throw error if cart not found', async () => {
      ;(prisma.cart.findUnique as jest.Mock).mockResolvedValue(null)

      await expect(cartService.updateCartItem(cartId, itemId, updateData)).rejects.toThrow(
        new AppError('Cart not found', 404)
      )
    })

    it('should throw error if cart item not found', async () => {
      const mockCart = {
        id: cartId,
        expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
      }

      ;(prisma.cart.findUnique as jest.Mock).mockResolvedValue(mockCart)
      ;(prisma.cartItem.findFirst as jest.Mock).mockResolvedValue(null)

      await expect(cartService.updateCartItem(cartId, itemId, updateData)).rejects.toThrow(
        new AppError('Cart item not found', 404)
      )
    })

    it('should throw error for insufficient stock', async () => {
      const mockCart = {
        id: cartId,
        expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
      }

      const mockCartItem = {
        id: itemId,
        cartId,
        productId: 'product-1',
        quantity: 2,
        product: {
          trackQuantity: true,
          quantity: 3, // Less than requested 5
        },
        variant: null,
      }

      ;(prisma.cart.findUnique as jest.Mock).mockResolvedValue(mockCart)
      ;(prisma.cartItem.findFirst as jest.Mock).mockResolvedValue(mockCartItem)

      await expect(cartService.updateCartItem(cartId, itemId, updateData)).rejects.toThrow(
        new AppError('Insufficient stock for requested quantity', 400)
      )
    })
  })

  describe('removeCartItem', () => {
    const cartId = 'cart-1'
    const itemId = 'item-1'

    it('should remove cart item successfully', async () => {
      const mockCart = {
        id: cartId,
        expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
      }

      const mockCartItem = {
        id: itemId,
        cartId,
      }

      const mockUpdatedCart = {
        ...mockCart,
        items: [],
        totals: { itemCount: 0 },
      }

      ;(prisma.cart.findUnique as jest.Mock).mockResolvedValue(mockCart)
      ;(prisma.cartItem.findFirst as jest.Mock).mockResolvedValue(mockCartItem)
      ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        await callback({
          cartItem: {
            delete: jest.fn().mockResolvedValue(mockCartItem),
          },
          cart: {
            update: jest.fn().mockResolvedValue(mockCart),
          },
        })
      })

      jest.spyOn(cartService as any, 'getCartWithDetails').mockResolvedValue(mockUpdatedCart)

      const result = await cartService.removeCartItem(cartId, itemId)

      expect(result.items).toHaveLength(0)
      expect(result.totals.itemCount).toBe(0)
    })

    it('should throw error if cart item not found', async () => {
      const mockCart = {
        id: cartId,
        expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
      }

      ;(prisma.cart.findUnique as jest.Mock).mockResolvedValue(mockCart)
      ;(prisma.cartItem.findFirst as jest.Mock).mockResolvedValue(null)

      await expect(cartService.removeCartItem(cartId, itemId)).rejects.toThrow(
        new AppError('Cart item not found', 404)
      )
    })
  })

  describe('clearCart', () => {
    const cartId = 'cart-1'

    it('should clear all items from cart', async () => {
      const mockCart = {
        id: cartId,
        expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
      }

      const mockClearedCart = {
        ...mockCart,
        items: [],
        totals: {
          subtotal: 0,
          taxAmount: 0,
          shippingCost: 0,
          discountAmount: 0,
          total: 0,
          itemCount: 0,
          currency: 'USD',
        },
      }

      ;(prisma.cart.findUnique as jest.Mock).mockResolvedValue(mockCart)
      ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        await callback({
          cartItem: {
            deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
          },
          cartCoupon: {
            deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
          },
          cart: {
            update: jest.fn().mockResolvedValue(mockCart),
          },
        })
      })

      jest.spyOn(cartService as any, 'getCartWithDetails').mockResolvedValue(mockClearedCart)

      const result = await cartService.clearCart(cartId)

      expect(result.items).toHaveLength(0)
      expect(result.totals.total).toBe(0)
    })
  })

  describe('validateCartStock', () => {
    const cartId = 'cart-1'

    it('should return valid stock validation result', async () => {
      const mockCart = {
        id: cartId,
        items: [
          {
            productId: 'product-1',
            variantId: null,
            quantity: 2,
            product: {
              trackQuantity: true,
              quantity: 10,
            },
            variant: null,
          },
        ],
      }

      ;(prisma.cart.findUnique as jest.Mock).mockResolvedValue(mockCart)

      const result = await cartService.validateCartStock(cartId)

      expect(result.isValid).toBe(true)
      expect(result.issues).toHaveLength(0)
    })

    it('should return stock validation issues', async () => {
      const mockCart = {
        id: cartId,
        items: [
          {
            productId: 'product-1',
            variantId: null,
            quantity: 15, // Exceeds available stock
            product: {
              trackQuantity: true,
              quantity: 10,
            },
            variant: null,
          },
        ],
      }

      ;(prisma.cart.findUnique as jest.Mock).mockResolvedValue(mockCart)

      const result = await cartService.validateCartStock(cartId)

      expect(result.isValid).toBe(false)
      expect(result.issues).toHaveLength(1)
      expect(result.issues[0]).toMatchObject({
        productId: 'product-1',
        requestedQuantity: 15,
        availableQuantity: 10,
      })
    })
  })

  describe('cleanupExpiredCarts', () => {
    it('should delete expired carts', async () => {
      const mockDeleteResult = { count: 5 }

      ;(prisma.cart.deleteMany as jest.Mock).mockResolvedValue(mockDeleteResult)

      const result = await cartService.cleanupExpiredCarts()

      expect(result).toBe(5)
      expect(prisma.cart.deleteMany).toHaveBeenCalledWith({
        where: {
          expiresAt: {
            lt: expect.any(Date),
          },
        },
      })
    })
  })
})