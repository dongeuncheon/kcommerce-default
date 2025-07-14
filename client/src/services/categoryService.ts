import api from './api'
import { Category, ApiResponse } from '@/types'

export const categoryService = {
  // Get all categories
  async getCategories(): Promise<ApiResponse<Category[]>> {
    return api.get('/categories')
  },

  // Get category tree
  async getCategoryTree(): Promise<ApiResponse<Category[]>> {
    return api.get('/categories/tree')
  },

  // Get single category
  async getCategory(id: string): Promise<ApiResponse<Category>> {
    return api.get(`/categories/${id}`)
  },

  // Get category by slug
  async getCategoryBySlug(slug: string): Promise<ApiResponse<Category>> {
    return api.get(`/categories/slug/${slug}`)
  },
}