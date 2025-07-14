import { create } from 'zustand'
import { Cart, CartItem } from '@/types'
import { cartService } from '@/services/cartService'
import toast from 'react-hot-toast'

interface CartState {
  cart: Cart | null
  isLoading: boolean
  error: string | null
  
  // Actions
  fetchCart: () => Promise<void>
  addItem: (productId: string, quantity?: number) => Promise<void>
  updateItem: (itemId: string, quantity: number) => Promise<void>
  removeItem: (itemId: string) => Promise<void>
  clearCart: () => Promise<void>
  applyCoupon: (code: string) => Promise<void>
  removeCoupon: () => Promise<void>
  
  // Computed values
  getItemCount: () => number
  getItem: (productId: string) => CartItem | undefined
}

export const useCartStore = create<CartState>((set, get) => ({
  cart: null,
  isLoading: false,
  error: null,

  fetchCart: async () => {
    set({ isLoading: true, error: null })
    try {
      const response = await cartService.getCart()
      if (response.success && response.data) {
        set({ cart: response.data })
      }
    } catch (error) {
      set({ error: 'Failed to fetch cart' })
    } finally {
      set({ isLoading: false })
    }
  },

  addItem: async (productId, quantity = 1) => {
    try {
      const response = await cartService.addItem(productId, quantity)
      if (response.success && response.data) {
        set({ cart: response.data })
        toast.success('Item added to cart')
      }
    } catch (error) {
      toast.error('Failed to add item to cart')
    }
  },

  updateItem: async (itemId, quantity) => {
    if (quantity < 1) {
      return get().removeItem(itemId)
    }

    try {
      const response = await cartService.updateItem(itemId, quantity)
      if (response.success && response.data) {
        set({ cart: response.data })
      }
    } catch (error) {
      toast.error('Failed to update item')
    }
  },

  removeItem: async (itemId) => {
    try {
      const response = await cartService.removeItem(itemId)
      if (response.success && response.data) {
        set({ cart: response.data })
        toast.success('Item removed from cart')
      }
    } catch (error) {
      toast.error('Failed to remove item')
    }
  },

  clearCart: async () => {
    try {
      const response = await cartService.clearCart()
      if (response.success && response.data) {
        set({ cart: response.data })
        toast.success('Cart cleared')
      }
    } catch (error) {
      toast.error('Failed to clear cart')
    }
  },

  applyCoupon: async (code) => {
    try {
      const response = await cartService.applyCoupon(code)
      if (response.success && response.data) {
        set({ cart: response.data })
        toast.success('Coupon applied successfully')
      }
    } catch (error) {
      toast.error('Invalid coupon code')
    }
  },

  removeCoupon: async () => {
    try {
      const response = await cartService.removeCoupon()
      if (response.success && response.data) {
        set({ cart: response.data })
        toast.success('Coupon removed')
      }
    } catch (error) {
      toast.error('Failed to remove coupon')
    }
  },

  getItemCount: () => {
    const cart = get().cart
    if (!cart) return 0
    return cart.items.reduce((sum, item) => sum + item.quantity, 0)
  },

  getItem: (productId) => {
    const cart = get().cart
    if (!cart) return undefined
    return cart.items.find(item => item.productId === productId)
  },
}))