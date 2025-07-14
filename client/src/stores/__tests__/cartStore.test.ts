import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useCartStore } from '../cartStore'
import { cartService } from '@/services/cartService'
import { Cart } from '@/types'

// Mock the services
vi.mock('@/services/cartService')
vi.mock('react-hot-toast')

const mockCart: Cart = {
  id: '1',
  sessionId: 'session123',
  userId: 'user123',
  items: [
    {
      id: 'item1',
      productId: 'prod1',
      product: {
        id: 'prod1',
        name: 'Test Product',
        slug: 'test-product',
        sku: 'TEST-001',
        status: 'PUBLISHED',
        type: 'SIMPLE',
        price: 50000,
        trackQuantity: true,
        quantity: 20,
        lowStockThreshold: 5,
        allowBackorders: false,
        images: [],
        createdAt: '2023-01-01',
        updatedAt: '2023-01-01',
      },
      quantity: 2,
      price: 50000,
      subtotal: 100000,
      addedAt: '2023-01-01',
    },
  ],
  subtotal: 100000,
  shipping: 0,
  tax: 10000,
  discount: 0,
  total: 110000,
  createdAt: '2023-01-01',
  updatedAt: '2023-01-01',
}

describe('cartStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset store state
    useCartStore.setState({
      cart: null,
      isLoading: false,
      error: null,
    })
  })

  describe('fetchCart', () => {
    it('should fetch cart successfully', async () => {
      vi.mocked(cartService.getCart).mockResolvedValue({
        success: true,
        data: mockCart,
      })

      const { result } = renderHook(() => useCartStore())

      await act(async () => {
        await result.current.fetchCart()
      })

      expect(result.current.cart).toEqual(mockCart)
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBe(null)
    })

    it('should handle fetch error', async () => {
      vi.mocked(cartService.getCart).mockRejectedValue(new Error('Network error'))

      const { result } = renderHook(() => useCartStore())

      await act(async () => {
        await result.current.fetchCart()
      })

      expect(result.current.cart).toBe(null)
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBe('Failed to fetch cart')
    })
  })

  describe('addItem', () => {
    it('should add item to cart', async () => {
      vi.mocked(cartService.addItem).mockResolvedValue({
        success: true,
        data: mockCart,
      })

      const { result } = renderHook(() => useCartStore())

      await act(async () => {
        await result.current.addItem('prod1', 2)
      })

      expect(cartService.addItem).toHaveBeenCalledWith('prod1', 2)
      expect(result.current.cart).toEqual(mockCart)
    })
  })

  describe('updateItem', () => {
    it('should update item quantity', async () => {
      vi.mocked(cartService.updateItem).mockResolvedValue({
        success: true,
        data: mockCart,
      })

      const { result } = renderHook(() => useCartStore())

      await act(async () => {
        await result.current.updateItem('item1', 3)
      })

      expect(cartService.updateItem).toHaveBeenCalledWith('item1', 3)
      expect(result.current.cart).toEqual(mockCart)
    })

    it('should remove item when quantity is less than 1', async () => {
      vi.mocked(cartService.removeItem).mockResolvedValue({
        success: true,
        data: mockCart,
      })

      const { result } = renderHook(() => useCartStore())

      await act(async () => {
        await result.current.updateItem('item1', 0)
      })

      expect(cartService.removeItem).toHaveBeenCalledWith('item1')
    })
  })

  describe('removeItem', () => {
    it('should remove item from cart', async () => {
      vi.mocked(cartService.removeItem).mockResolvedValue({
        success: true,
        data: mockCart,
      })

      const { result } = renderHook(() => useCartStore())

      await act(async () => {
        await result.current.removeItem('item1')
      })

      expect(cartService.removeItem).toHaveBeenCalledWith('item1')
      expect(result.current.cart).toEqual(mockCart)
    })
  })

  describe('clearCart', () => {
    it('should clear cart', async () => {
      const emptyCart = { ...mockCart, items: [], subtotal: 0, total: 0 }
      vi.mocked(cartService.clearCart).mockResolvedValue({
        success: true,
        data: emptyCart,
      })

      const { result } = renderHook(() => useCartStore())
      
      // Set initial cart
      act(() => {
        useCartStore.setState({ cart: mockCart })
      })

      await act(async () => {
        await result.current.clearCart()
      })

      expect(cartService.clearCart).toHaveBeenCalled()
      expect(result.current.cart).toEqual(emptyCart)
    })
  })

  describe('applyCoupon', () => {
    it('should apply coupon code', async () => {
      const cartWithCoupon = { ...mockCart, couponCode: 'SAVE10', discount: 10000 }
      vi.mocked(cartService.applyCoupon).mockResolvedValue({
        success: true,
        data: cartWithCoupon,
      })

      const { result } = renderHook(() => useCartStore())

      await act(async () => {
        await result.current.applyCoupon('SAVE10')
      })

      expect(cartService.applyCoupon).toHaveBeenCalledWith('SAVE10')
      expect(result.current.cart).toEqual(cartWithCoupon)
    })
  })

  describe('removeCoupon', () => {
    it('should remove coupon', async () => {
      vi.mocked(cartService.removeCoupon).mockResolvedValue({
        success: true,
        data: mockCart,
      })

      const { result } = renderHook(() => useCartStore())

      await act(async () => {
        await result.current.removeCoupon()
      })

      expect(cartService.removeCoupon).toHaveBeenCalled()
      expect(result.current.cart).toEqual(mockCart)
    })
  })

  describe('computed values', () => {
    it('should calculate item count correctly', () => {
      const { result } = renderHook(() => useCartStore())
      
      act(() => {
        useCartStore.setState({ cart: mockCart })
      })

      expect(result.current.getItemCount()).toBe(2)
    })

    it('should return 0 when cart is null', () => {
      const { result } = renderHook(() => useCartStore())
      
      expect(result.current.getItemCount()).toBe(0)
    })

    it('should get item by product id', () => {
      const { result } = renderHook(() => useCartStore())
      
      act(() => {
        useCartStore.setState({ cart: mockCart })
      })

      const item = result.current.getItem('prod1')
      expect(item?.productId).toBe('prod1')
      expect(item?.quantity).toBe(2)
    })

    it('should return undefined for non-existent item', () => {
      const { result } = renderHook(() => useCartStore())
      
      act(() => {
        useCartStore.setState({ cart: mockCart })
      })

      const item = result.current.getItem('non-existent')
      expect(item).toBeUndefined()
    })
  })
})