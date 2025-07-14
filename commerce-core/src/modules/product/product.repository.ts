import { BaseRepository } from '@/core/repository/base.repository';
import type { IDatabaseAdapter } from '@/adapters/database.adapter';
import type { QueryOptions, PaginationResult } from '@/types/common';
import type {
  IProduct,
  ProductFilterOptions,
  InventoryUpdateDto,
  ProductStatus
} from './product.types';
import type { IProductRepository } from './product.repository.interface';
import { Product } from './product.entity';

export class ProductRepository 
  extends BaseRepository<IProduct> 
  implements IProductRepository {
  
  constructor(protected adapter: IDatabaseAdapter) {
    super(adapter, 'products', Product);
  }

  /**
   * Find product by SKU
   */
  async findBySku(sku: string): Promise<IProduct | null> {
    const results = await this.adapter.query<IProduct>({
      table: this.tableName,
      where: { sku },
      limit: 1
    });
    return results.data[0] || null;
  }

  /**
   * Find product by slug
   */
  async findBySlug(slug: string): Promise<IProduct | null> {
    const results = await this.adapter.query<IProduct>({
      table: this.tableName,
      where: { slug },
      limit: 1
    });
    return results.data[0] || null;
  }

  /**
   * Find products by category
   */
  async findByCategory(
    categoryId: string,
    options: QueryOptions = {}
  ): Promise<PaginationResult<IProduct>> {
    return this.adapter.query<IProduct>({
      table: this.tableName,
      where: { 
        category_id: categoryId,
        is_visible: true,
        status: ProductStatus.ACTIVE
      },
      ...this.prepareQueryOptions(options)
    });
  }

  /**
   * Find products with filters
   */
  async findWithFilters(
    filters: ProductFilterOptions,
    options: QueryOptions = {}
  ): Promise<PaginationResult<IProduct>> {
    const where: Record<string, any> = {
      is_visible: true
    };

    if (filters.categoryId) {
      where.category_id = filters.categoryId;
    }
    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.isFeatured !== undefined) {
      where.is_featured = filters.isFeatured;
    }
    if (filters.origin) {
      where.origin = filters.origin;
    }
    if (filters.manufacturer) {
      where.manufacturer = filters.manufacturer;
    }
    if (filters.inStock) {
      where.quantity = { $gt: 0 };
    }

    // Price range filter
    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
      where.price = {};
      if (filters.minPrice !== undefined) {
        where.price.$gte = filters.minPrice;
      }
      if (filters.maxPrice !== undefined) {
        where.price.$lte = filters.maxPrice;
      }
    }

    // Tags filter (JSON array contains)
    if (filters.tags && filters.tags.length > 0) {
      where.tags = { $contains: filters.tags };
    }

    // Search filter
    if (filters.search) {
      where.$or = [
        { name: { $like: `%${filters.search}%` } },
        { name_ko: { $like: `%${filters.search}%` } },
        { description: { $like: `%${filters.search}%` } },
        { description_ko: { $like: `%${filters.search}%` } },
        { sku: { $like: `%${filters.search}%` } }
      ];
    }

    return this.adapter.query<IProduct>({
      table: this.tableName,
      where,
      ...this.prepareQueryOptions(options)
    });
  }

  /**
   * Search products by name or description
   */
  async searchProducts(
    query: string,
    options: QueryOptions = {}
  ): Promise<PaginationResult<IProduct>> {
    return this.findWithFilters({ search: query }, options);
  }

  /**
   * Find featured products
   */
  async findFeatured(
    limit: number = 10,
    options: QueryOptions = {}
  ): Promise<IProduct[]> {
    const result = await this.adapter.query<IProduct>({
      table: this.tableName,
      where: {
        is_featured: true,
        is_visible: true,
        status: ProductStatus.ACTIVE
      },
      limit,
      orderBy: options.orderBy || [{ field: 'created_at', direction: 'desc' }]
    });
    return result.data;
  }

  /**
   * Find related products
   */
  async findRelated(
    productId: string,
    limit: number = 5
  ): Promise<IProduct[]> {
    // First, get the product to find its category and tags
    const product = await this.findById(productId);
    if (!product) {
      return [];
    }

    // Find products in the same category
    const result = await this.adapter.query<IProduct>({
      table: this.tableName,
      where: {
        category_id: product.categoryId,
        id: { $ne: productId },
        is_visible: true,
        status: ProductStatus.ACTIVE
      },
      limit,
      orderBy: [{ field: 'sales_count', direction: 'desc' }]
    });

    return result.data;
  }

  /**
   * Update product inventory
   */
  async updateInventory(
    update: InventoryUpdateDto
  ): Promise<IProduct> {
    const product = await this.findById(update.productId);
    if (!product) {
      throw new Error('Product not found');
    }

    let newQuantity: number;
    switch (update.operation) {
      case 'add':
        newQuantity = product.quantity + update.quantity;
        break;
      case 'subtract':
        newQuantity = Math.max(0, product.quantity - update.quantity);
        break;
      case 'set':
        newQuantity = update.quantity;
        break;
      default:
        throw new Error('Invalid operation');
    }

    // Update status based on inventory
    const status = newQuantity === 0 ? ProductStatus.OUT_OF_STOCK : product.status;

    return this.update(update.productId, {
      quantity: newQuantity,
      status,
      metadata: {
        ...product.metadata,
        lastInventoryUpdate: {
          operation: update.operation,
          quantity: update.quantity,
          reason: update.reason,
          timestamp: new Date().toISOString(),
          ...update.metadata
        }
      }
    });
  }

  /**
   * Bulk update inventory
   */
  async bulkUpdateInventory(
    updates: InventoryUpdateDto[]
  ): Promise<void> {
    // Process updates in a transaction if adapter supports it
    for (const update of updates) {
      await this.updateInventory(update);
    }
  }

  /**
   * Get low stock products
   */
  async findLowStock(
    threshold?: number,
    options: QueryOptions = {}
  ): Promise<PaginationResult<IProduct>> {
    const where: Record<string, any> = {
      track_inventory: true,
      status: ProductStatus.ACTIVE
    };

    if (threshold !== undefined) {
      where.quantity = { $lte: threshold };
    } else {
      // Use product's own low stock threshold
      where.$expr = { $lte: ['$quantity', '$low_stock_threshold'] };
    }

    return this.adapter.query<IProduct>({
      table: this.tableName,
      where,
      ...this.prepareQueryOptions(options)
    });
  }

  /**
   * Update product status
   */
  async updateStatus(
    productId: string,
    status: ProductStatus
  ): Promise<IProduct> {
    return this.update(productId, { status });
  }

  /**
   * Increment view count
   */
  async incrementViewCount(productId: string): Promise<void> {
    await this.adapter.execute(
      `UPDATE ${this.tableName} SET view_count = view_count + 1 WHERE id = ?`,
      [productId]
    );
  }

  /**
   * Increment sales count
   */
  async incrementSalesCount(
    productId: string,
    quantity: number = 1
  ): Promise<void> {
    await this.adapter.execute(
      `UPDATE ${this.tableName} SET sales_count = sales_count + ? WHERE id = ?`,
      [quantity, productId]
    );
  }

  /**
   * Validate if SKU is unique
   */
  async validateSku(sku: string, excludeId?: string): Promise<boolean> {
    const where: Record<string, any> = { sku };
    if (excludeId) {
      where.id = { $ne: excludeId };
    }
    
    const result = await this.adapter.query<IProduct>({
      table: this.tableName,
      where,
      limit: 1,
      select: ['id']
    });
    
    return result.total === 0;
  }

  /**
   * Validate if slug is unique
   */
  async validateSlug(slug: string, excludeId?: string): Promise<boolean> {
    const where: Record<string, any> = { slug };
    if (excludeId) {
      where.id = { $ne: excludeId };
    }
    
    const result = await this.adapter.query<IProduct>({
      table: this.tableName,
      where,
      limit: 1,
      select: ['id']
    });
    
    return result.total === 0;
  }

  /**
   * Get product statistics
   */
  async getStats(): Promise<{
    total: number;
    active: number;
    outOfStock: number;
    lowStock: number;
    featured: number;
  }> {
    // Get total count
    const totalResult = await this.adapter.query<IProduct>({
      table: this.tableName,
      limit: 0
    });

    // Get active count
    const activeResult = await this.adapter.query<IProduct>({
      table: this.tableName,
      where: { status: ProductStatus.ACTIVE },
      limit: 0
    });

    // Get out of stock count
    const outOfStockResult = await this.adapter.query<IProduct>({
      table: this.tableName,
      where: { status: ProductStatus.OUT_OF_STOCK },
      limit: 0
    });

    // Get low stock count
    const lowStockResult = await this.adapter.query<IProduct>({
      table: this.tableName,
      where: {
        track_inventory: true,
        status: ProductStatus.ACTIVE,
        $expr: { $lte: ['$quantity', '$low_stock_threshold'] }
      },
      limit: 0
    });

    // Get featured count
    const featuredResult = await this.adapter.query<IProduct>({
      table: this.tableName,
      where: { is_featured: true },
      limit: 0
    });

    return {
      total: totalResult.total,
      active: activeResult.total,
      outOfStock: outOfStockResult.total,
      lowStock: lowStockResult.total,
      featured: featuredResult.total
    };
  }
}