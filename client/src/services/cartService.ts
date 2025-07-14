import api from './api'
import { Cart, CartItem, ApiResponse } from '@/types'

export const cartService = {
  // Get current cart
  async getCart(): Promise<ApiResponse<Cart>> {
    return api.get('/carts/current')
  },

  // Add item to cart
  async addItem(productId: string, quantity: number = 1): Promise<ApiResponse<Cart>> {
    return api.post('/carts/items', { productId, quantity })
  },

  // Update cart item quantity
  async updateItem(itemId: string, quantity: number): Promise<ApiResponse<Cart>> {
    return api.patch(`/carts/items/${itemId}`, { quantity })
  },

  // Remove item from cart
  async removeItem(itemId: string): Promise<ApiResponse<Cart>> {
    return api.delete(`/carts/items/${itemId}`)
  },

  // Clear cart
  async clearCart(): Promise<ApiResponse<Cart>> {
    return api.delete('/carts/clear')
  },

  // Apply coupon
  async applyCoupon(code: string): Promise<ApiResponse<Cart>> {
    return api.post('/carts/coupon', { code })
  },

  // Remove coupon
  async removeCoupon(): Promise<ApiResponse<Cart>> {
    return api.delete('/carts/coupon')
  },

  // Update cart notes
  async updateNotes(notes: string): Promise<ApiResponse<Cart>> {
    return api.patch('/carts/notes', { notes })
  },
}