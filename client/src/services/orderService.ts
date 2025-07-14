import api from './api'
import { Order, Address, ApiResponse } from '@/types'

interface CheckoutData {
  customerEmail: string
  customerFirstName?: string
  customerLastName?: string
  customerPhone?: string
  shippingAddress: Partial<Address>
  billingAddress?: Partial<Address>
  sameAsShipping?: boolean
  notes?: string
}

interface PaymentData {
  paymentMethod: string
  paymentDetails?: any
}

export const orderService = {
  // Create order from cart
  async createOrder(checkoutData: CheckoutData): Promise<ApiResponse<Order>> {
    return api.post('/orders', checkoutData)
  },

  // Process payment for order
  async processPayment(orderId: string, paymentData: PaymentData): Promise<ApiResponse<{
    order: Order
    paymentUrl?: string
    transactionId?: string
  }>> {
    return api.post(`/orders/${orderId}/payment`, paymentData)
  },

  // Get order by ID
  async getOrder(orderId: string): Promise<ApiResponse<Order>> {
    return api.get(`/orders/${orderId}`)
  },

  // Get order by order number
  async getOrderByNumber(orderNumber: string): Promise<ApiResponse<Order>> {
    return api.get(`/orders/number/${orderNumber}`)
  },

  // Get user's orders
  async getMyOrders(): Promise<ApiResponse<Order[]>> {
    return api.get('/orders/my-orders')
  },

  // Cancel order
  async cancelOrder(orderId: string): Promise<ApiResponse<Order>> {
    return api.post(`/orders/${orderId}/cancel`)
  },

  // Track order
  async trackOrder(orderNumber: string, email: string): Promise<ApiResponse<Order>> {
    return api.post('/orders/track', { orderNumber, email })
  },
}