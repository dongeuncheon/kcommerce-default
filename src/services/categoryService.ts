import { PrismaClient, Category } from '@prisma/client'
import { logger } from '../utils/logger'

const prisma = new PrismaClient()

export interface CategoryWithChildren extends Category {
  children?: CategoryWithChildren[];
}

export interface CreateCategoryInput {
  name: string;
  slug: string;
  description?: string;
  image?: string;
  parentId?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export interface UpdateCategoryInput {
  name?: string;
  slug?: string;
  description?: string;
  image?: string | null;
  parentId?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

export class CategoryService {
  /**
   * Create a new category
   */
  async createCategory(data: CreateCategoryInput): Promise<Category> {
    try {
      const category = await prisma.category.create({
        data,
        include: {
          parent: true,
          children: true,
        },
      })

      logger.info(`Category created: ${category.id}`)
      return category
    } catch (error) {
      logger.error('Error creating category:', error)
      throw error
    }
  }

  /**
   * Get all categories with hierarchical structure
   */
  async getAllCategories(includeInactive = false): Promise<CategoryWithChildren[]> {
    try {
      const categories = await prisma.category.findMany({
        where: includeInactive ? {} : { isActive: true },
        include: {
          children: {
            where: includeInactive ? {} : { isActive: true },
            orderBy: { sortOrder: 'asc' },
          },
        },
        orderBy: { sortOrder: 'asc' },
      })

      // Build hierarchical tree structure
      return this.buildCategoryTree(categories)
    } catch (error) {
      logger.error('Error fetching categories:', error)
      throw error
    }
  }

  /**
   * Get category by ID
   */
  async getCategoryById(id: string): Promise<Category | null> {
    try {
      const category = await prisma.category.findUnique({
        where: { id },
        include: {
          parent: true,
          children: {
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' },
          },
          products: {
            where: { status: 'PUBLISHED' },
            take: 10,
          },
        },
      })

      return category
    } catch (error) {
      logger.error(`Error fetching category ${id}:`, error)
      throw error
    }
  }

  /**
   * Get category by slug
   */
  async getCategoryBySlug(slug: string): Promise<Category | null> {
    try {
      const category = await prisma.category.findUnique({
        where: { slug },
        include: {
          parent: true,
          children: {
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' },
          },
          products: {
            where: { status: 'PUBLISHED' },
          },
        },
      })

      return category
    } catch (error) {
      logger.error(`Error fetching category by slug ${slug}:`, error)
      throw error
    }
  }

  /**
   * Update category
   */
  async updateCategory(id: string, data: UpdateCategoryInput): Promise<Category> {
    try {
      // Check for circular reference if parentId is being updated
      if (data.parentId) {
        await this.validateParentCategory(id, data.parentId)
      }

      const category = await prisma.category.update({
        where: { id },
        data,
        include: {
          parent: true,
          children: true,
        },
      })

      logger.info(`Category updated: ${id}`)
      return category
    } catch (error) {
      logger.error(`Error updating category ${id}:`, error)
      throw error
    }
  }

  /**
   * Delete category
   */
  async deleteCategory(id: string): Promise<void> {
    try {
      // Check if category has children
      const children = await prisma.category.count({
        where: { parentId: id },
      })

      if (children > 0) {
        throw new Error('Cannot delete category with children')
      }

      // Check if category has products
      const products = await prisma.product.count({
        where: { categoryId: id },
      })

      if (products > 0) {
        throw new Error('Cannot delete category with products')
      }

      await prisma.category.delete({
        where: { id },
      })

      logger.info(`Category deleted: ${id}`)
    } catch (error) {
      logger.error(`Error deleting category ${id}:`, error)
      throw error
    }
  }

  /**
   * Get category tree starting from a specific category
   */
  async getCategoryTree(categoryId: string): Promise<CategoryWithChildren | null> {
    try {
      const category = await this.getCategoryById(categoryId)
      if (!category) return null

      return this.buildCategoryBranch(category.id)
    } catch (error) {
      logger.error(`Error building category tree for ${categoryId}:`, error)
      throw error
    }
  }

  /**
   * Get all parent categories (breadcrumb)
   */
  async getCategoryBreadcrumb(categoryId: string): Promise<Category[]> {
    try {
      const breadcrumb: Category[] = []
      let currentCategory = await this.getCategoryById(categoryId)

      while (currentCategory) {
        breadcrumb.unshift(currentCategory)
        if (currentCategory.parentId) {
          currentCategory = await this.getCategoryById(currentCategory.parentId)
        } else {
          break
        }
      }

      return breadcrumb
    } catch (error) {
      logger.error(`Error building breadcrumb for ${categoryId}:`, error)
      throw error
    }
  }

  /**
   * Search categories by name
   */
  async searchCategories(query: string): Promise<Category[]> {
    try {
      const categories = await prisma.category.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
          ],
          isActive: true,
        },
        orderBy: { name: 'asc' },
      })

      return categories
    } catch (error) {
      logger.error('Error searching categories:', error)
      throw error
    }
  }

  /**
   * Get categories by tag
   */
  async getCategoriesByTag(tagId: string): Promise<Category[]> {
    try {
      // Get products with the tag
      const products = await prisma.product.findMany({
        where: {
          tags: {
            some: { tagId },
          },
          status: 'PUBLISHED',
        },
        select: { categoryId: true },
      })

      // Get unique category IDs
      const categoryIds = [...new Set(products.map(p => p.categoryId).filter(Boolean))]

      // Fetch categories
      const categories = await prisma.category.findMany({
        where: {
          id: { in: categoryIds as string[] },
          isActive: true,
        },
        orderBy: { name: 'asc' },
      })

      return categories
    } catch (error) {
      logger.error(`Error fetching categories by tag ${tagId}:`, error)
      throw error
    }
  }

  /**
   * Reorder categories
   */
  async reorderCategories(updates: { id: string; sortOrder: number }[]): Promise<void> {
    try {
      await prisma.$transaction(
        updates.map(({ id, sortOrder }) =>
          prisma.category.update({
            where: { id },
            data: { sortOrder },
          }),
        ),
      )

      logger.info('Categories reordered successfully')
    } catch (error) {
      logger.error('Error reordering categories:', error)
      throw error
    }
  }

  /**
   * Private helper methods
   */

  private buildCategoryTree(categories: any[]): CategoryWithChildren[] {
    const categoryMap = new Map<string, CategoryWithChildren>()
    const rootCategories: CategoryWithChildren[] = []

    // First pass: create map of all categories
    categories.forEach(cat => {
      categoryMap.set(cat.id, { ...cat, children: [] })
    })

    // Second pass: build tree structure
    categories.forEach(cat => {
      const category = categoryMap.get(cat.id)!
      if (cat.parentId) {
        const parent = categoryMap.get(cat.parentId)
        if (parent) {
          parent.children!.push(category)
        }
      } else {
        rootCategories.push(category)
      }
    })

    return rootCategories
  }

  private async buildCategoryBranch(categoryId: string): Promise<CategoryWithChildren> {
    const category = await prisma.category.findUnique({
      where: { id: categoryId },
      include: {
        children: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    })

    if (!category) {
      throw new Error('Category not found')
    }

    const result: CategoryWithChildren = {
      ...category,
      children: [],
    }

    if (category.children && category.children.length > 0) {
      result.children = await Promise.all(
        category.children.map(child => this.buildCategoryBranch(child.id)),
      )
    }

    return result
  }

  private async validateParentCategory(categoryId: string, parentId: string): Promise<void> {
    // Check if parent exists
    const parent = await this.getCategoryById(parentId)
    if (!parent) {
      throw new Error('Parent category not found')
    }

    // Check for circular reference
    let currentParentId: string | null = parentId
    while (currentParentId) {
      if (currentParentId === categoryId) {
        throw new Error('Circular reference detected')
      }
      const currentParent = await this.getCategoryById(currentParentId)
      currentParentId = currentParent?.parentId || null
    }
  }
}

export const categoryService = new CategoryService()
