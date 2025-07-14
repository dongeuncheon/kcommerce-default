import { BaseRepository } from '@/core/repository/base.repository';
import type { IDatabaseAdapter } from '@/adapters/database.adapter';
import type { QueryOptions } from '@/types/common';
import type { IProductCategory } from '../product/product.types';
import type { IProductCategoryRepository } from '../product/product.repository.interface';
import { ProductCategory } from '../product/product.entity';

export class CategoryRepository 
  extends BaseRepository<IProductCategory> 
  implements IProductCategoryRepository {
  
  constructor(protected adapter: IDatabaseAdapter) {
    super(adapter, 'product_categories', ProductCategory);
  }

  /**
   * Find category by slug
   */
  async findBySlug(slug: string): Promise<IProductCategory | null> {
    const results = await this.adapter.query<IProductCategory>({
      table: this.tableName,
      where: { slug },
      limit: 1
    });
    return results.data[0] || null;
  }

  /**
   * Find category by Korean slug
   */
  async findBySlugKo(slugKo: string): Promise<IProductCategory | null> {
    const results = await this.adapter.query<IProductCategory>({
      table: this.tableName,
      where: { slug_ko: slugKo },
      limit: 1
    });
    return results.data[0] || null;
  }

  /**
   * Find root categories (no parent)
   */
  async findRootCategories(
    options: QueryOptions = {}
  ): Promise<IProductCategory[]> {
    const result = await this.adapter.query<IProductCategory>({
      table: this.tableName,
      where: { 
        parent_id: null,
        is_active: true 
      },
      orderBy: [{ field: 'display_order', direction: 'asc' }],
      ...this.prepareQueryOptions(options)
    });
    return result.data;
  }

  /**
   * Find subcategories
   */
  async findSubcategories(
    parentId: string,
    options: QueryOptions = {}
  ): Promise<IProductCategory[]> {
    const result = await this.adapter.query<IProductCategory>({
      table: this.tableName,
      where: { 
        parent_id: parentId,
        is_active: true 
      },
      orderBy: [{ field: 'display_order', direction: 'asc' }],
      ...this.prepareQueryOptions(options)
    });
    return result.data;
  }

  /**
   * Get category tree
   */
  async getCategoryTree(): Promise<IProductCategory[]> {
    // Get all categories
    const allCategories = await this.findAll({
      orderBy: [{ field: 'display_order', direction: 'asc' }]
    });

    // Build tree structure
    const categoryMap = new Map<string, IProductCategory>();
    const rootCategories: IProductCategory[] = [];

    // First pass: create map
    allCategories.data.forEach(category => {
      categoryMap.set(category.id, { ...category, children: [] });
    });

    // Second pass: build tree
    allCategories.data.forEach(category => {
      const categoryNode = categoryMap.get(category.id)!;
      if (category.parentId) {
        const parent = categoryMap.get(category.parentId);
        if (parent) {
          if (!parent.children) parent.children = [];
          parent.children.push(categoryNode);
        }
      } else {
        rootCategories.push(categoryNode);
      }
    });

    return rootCategories;
  }

  /**
   * Get category path (breadcrumb)
   */
  async getCategoryPath(categoryId: string): Promise<IProductCategory[]> {
    const path: IProductCategory[] = [];
    let currentId: string | null = categoryId;

    while (currentId) {
      const category = await this.findById(currentId);
      if (!category) break;
      
      path.unshift(category); // Add to beginning
      currentId = category.parentId || null;
    }

    return path;
  }

  /**
   * Count products in category
   */
  async countProducts(categoryId: string): Promise<number> {
    const result = await this.adapter.query({
      table: 'products',
      where: { category_id: categoryId },
      limit: 0
    });
    return result.total;
  }

  /**
   * Move category to new parent
   */
  async moveCategory(
    categoryId: string,
    newParentId: string | null
  ): Promise<IProductCategory> {
    // Check for circular reference
    if (newParentId) {
      const parentPath = await this.getCategoryPath(newParentId);
      if (parentPath.some(cat => cat.id === categoryId)) {
        throw new Error('Circular reference detected');
      }
    }

    return this.update(categoryId, { parentId: newParentId });
  }

  /**
   * Reorder categories
   */
  async reorderCategories(
    categoryOrders: Array<{ id: string; order: number }>
  ): Promise<void> {
    // Update each category's display order
    for (const { id, order } of categoryOrders) {
      await this.update(id, { displayOrder: order });
    }
  }

  /**
   * Validate if slug is unique
   */
  async validateSlug(slug: string, excludeId?: string): Promise<boolean> {
    const where: Record<string, any> = { slug };
    if (excludeId) {
      where.id = { $ne: excludeId };
    }
    
    const result = await this.adapter.query<IProductCategory>({
      table: this.tableName,
      where,
      limit: 1,
      select: ['id']
    });
    
    return result.total === 0;
  }

  /**
   * Validate if Korean slug is unique
   */
  async validateSlugKo(slugKo: string, excludeId?: string): Promise<boolean> {
    const where: Record<string, any> = { slug_ko: slugKo };
    if (excludeId) {
      where.id = { $ne: excludeId };
    }
    
    const result = await this.adapter.query<IProductCategory>({
      table: this.tableName,
      where,
      limit: 1,
      select: ['id']
    });
    
    return result.total === 0;
  }

  /**
   * Get categories with product count
   */
  async getCategoriesWithProductCount(): Promise<Array<IProductCategory & { productCount: number }>> {
    // This would ideally use a JOIN query, but for now we'll do it in two steps
    const categories = await this.findAll();
    const categoriesWithCount = await Promise.all(
      categories.data.map(async (category) => ({
        ...category,
        productCount: await this.countProducts(category.id)
      }))
    );
    
    return categoriesWithCount;
  }

  /**
   * Delete category and reassign products
   */
  async deleteCategoryAndReassignProducts(
    categoryId: string,
    newCategoryId?: string
  ): Promise<boolean> {
    // If newCategoryId is provided, reassign all products to new category
    if (newCategoryId) {
      await this.adapter.execute(
        `UPDATE products SET category_id = ? WHERE category_id = ?`,
        [newCategoryId, categoryId]
      );
    }

    // Delete the category
    return this.delete(categoryId);
  }
}