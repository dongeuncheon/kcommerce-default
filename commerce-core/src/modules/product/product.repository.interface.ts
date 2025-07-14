import type { IRepository } from '@/core/repository/repository.interface';
import type { QueryOptions, PaginationResult } from '@/types/common';
import type {
  IProduct,
  IProductCategory,
  ProductFilterOptions,
  InventoryUpdateDto,
  ProductStatus
} from './product.types';

/**
 * Product repository interface extending base repository
 */
export interface IProductRepository extends IRepository<IProduct> {
  /**
   * Find product by SKU
   */
  findBySku(sku: string): Promise<IProduct | null>;

  /**
   * Find product by slug
   */
  findBySlug(slug: string): Promise<IProduct | null>;

  /**
   * Find products by category
   */
  findByCategory(
    categoryId: string,
    options?: QueryOptions
  ): Promise<PaginationResult<IProduct>>;

  /**
   * Find products with filters
   */
  findWithFilters(
    filters: ProductFilterOptions,
    options?: QueryOptions
  ): Promise<PaginationResult<IProduct>>;

  /**
   * Search products by name or description
   */
  searchProducts(
    query: string,
    options?: QueryOptions
  ): Promise<PaginationResult<IProduct>>;

  /**
   * Find featured products
   */
  findFeatured(
    limit?: number,
    options?: QueryOptions
  ): Promise<IProduct[]>;

  /**
   * Find related products
   */
  findRelated(
    productId: string,
    limit?: number
  ): Promise<IProduct[]>;

  /**
   * Update product inventory
   */
  updateInventory(
    updates: InventoryUpdateDto
  ): Promise<IProduct>;

  /**
   * Bulk update inventory
   */
  bulkUpdateInventory(
    updates: InventoryUpdateDto[]
  ): Promise<void>;

  /**
   * Get low stock products
   */
  findLowStock(
    threshold?: number,
    options?: QueryOptions
  ): Promise<PaginationResult<IProduct>>;

  /**
   * Update product status
   */
  updateStatus(
    productId: string,
    status: ProductStatus
  ): Promise<IProduct>;

  /**
   * Increment view count
   */
  incrementViewCount(productId: string): Promise<void>;

  /**
   * Increment sales count
   */
  incrementSalesCount(
    productId: string,
    quantity?: number
  ): Promise<void>;

  /**
   * Validate if SKU is unique
   */
  validateSku(sku: string, excludeId?: string): Promise<boolean>;

  /**
   * Validate if slug is unique
   */
  validateSlug(slug: string, excludeId?: string): Promise<boolean>;

  /**
   * Get product statistics
   */
  getStats(): Promise<{
    total: number;
    active: number;
    outOfStock: number;
    lowStock: number;
    featured: number;
  }>;
}

/**
 * Product category repository interface
 */
export interface IProductCategoryRepository extends IRepository<IProductCategory> {
  /**
   * Find category by slug
   */
  findBySlug(slug: string): Promise<IProductCategory | null>;

  /**
   * Find category by Korean slug
   */
  findBySlugKo(slugKo: string): Promise<IProductCategory | null>;

  /**
   * Find root categories (no parent)
   */
  findRootCategories(
    options?: QueryOptions
  ): Promise<IProductCategory[]>;

  /**
   * Find subcategories
   */
  findSubcategories(
    parentId: string,
    options?: QueryOptions
  ): Promise<IProductCategory[]>;

  /**
   * Get category tree
   */
  getCategoryTree(): Promise<IProductCategory[]>;

  /**
   * Get category path (breadcrumb)
   */
  getCategoryPath(categoryId: string): Promise<IProductCategory[]>;

  /**
   * Count products in category
   */
  countProducts(categoryId: string): Promise<number>;

  /**
   * Move category to new parent
   */
  moveCategory(
    categoryId: string,
    newParentId: string | null
  ): Promise<IProductCategory>;

  /**
   * Reorder categories
   */
  reorderCategories(
    categoryOrders: Array<{ id: string; order: number }>
  ): Promise<void>;

  /**
   * Validate if slug is unique
   */
  validateSlug(slug: string, excludeId?: string): Promise<boolean>;

  /**
   * Validate if Korean slug is unique
   */
  validateSlugKo(slugKo: string, excludeId?: string): Promise<boolean>;
}