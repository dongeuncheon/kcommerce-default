import api from './api'
import { Product, ApiResponse, FilterOptions } from '@/types'

export const productService = {
  // Get all products with filters
  async getProducts(filters?: FilterOptions): Promise<ApiResponse<Product[]>> {
    const params = new URLSearchParams()
    
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString())
        }
      })
    }

    return api.get(`/products?${params.toString()}`)
  },

  // Get single product by ID
  async getProduct(id: string): Promise<ApiResponse<Product>> {
    return api.get(`/products/${id}`)
  },

  // Get product by slug
  async getProductBySlug(slug: string): Promise<ApiResponse<Product>> {
    return api.get(`/products/slug/${slug}`)
  },

  // Search products
  async searchProducts(query: string): Promise<ApiResponse<Product[]>> {
    return api.get(`/products/search?q=${encodeURIComponent(query)}`)
  },

  // Get featured products
  async getFeaturedProducts(): Promise<ApiResponse<Product[]>> {
    return api.get('/products/featured')
  },

  // Get related products
  async getRelatedProducts(productId: string): Promise<ApiResponse<Product[]>> {
    return api.get(`/products/${productId}/related`)
  },
}