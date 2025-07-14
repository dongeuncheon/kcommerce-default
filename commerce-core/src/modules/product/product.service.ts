import { Container } from '@/core/di/container';
import { LoggerService } from '@/core/services/logger.service';
import { CacheService } from '@/core/services/cache.service';
import type { QueryOptions, PaginationResult } from '@/types/common';
import type {
  IProduct,
  CreateProductDto,
  UpdateProductDto,
  ProductFilterOptions,
  InventoryUpdateDto,
  ProductStatus
} from './product.types';
import type { IProductRepository } from './product.repository.interface';
import { ProductRepository } from './product.repository';
import { generateSlug } from '@/utils/slug';
import { ValidationError, NotFoundError, ConflictError } from '@/types/errors';

export class ProductService {
  private repository: IProductRepository;
  private logger: LoggerService;
  private cache: CacheService;
  private readonly CACHE_TTL = 3600; // 1 hour
  private readonly CACHE_PREFIX = 'product:';

  constructor() {
    const container = Container.getInstance();
    this.repository = container.resolve<IProductRepository>('ProductRepository');
    this.logger = container.resolve<LoggerService>('LoggerService');
    this.cache = container.resolve<CacheService>('CacheService');
  }

  /**
   * Get all products with pagination and filters
   */
  async list(
    filters: ProductFilterOptions = {},
    options: QueryOptions = {}
  ): Promise<PaginationResult<IProduct>> {
    try {
      // Generate cache key based on filters and options
      const cacheKey = this.generateCacheKey('list', { filters, options });
      const cached = await this.cache.get<PaginationResult<IProduct>>(cacheKey);
      
      if (cached) {
        return cached;
      }

      const result = await this.repository.findWithFilters(filters, options);
      
      // Cache the result
      await this.cache.set(cacheKey, result, this.CACHE_TTL);
      
      return result;
    } catch (error) {
      this.logger.error('Failed to list products', { error, filters, options });
      throw error;
    }
  }

  /**
   * Get product by ID
   */
  async get(id: string): Promise<IProduct> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}${id}`;
      const cached = await this.cache.get<IProduct>(cacheKey);
      
      if (cached) {
        // Increment view count asynchronously
        this.repository.incrementViewCount(id).catch(err => 
          this.logger.error('Failed to increment view count', { error: err, productId: id })
        );
        return cached;
      }

      const product = await this.repository.findById(id);
      if (!product) {
        throw new NotFoundError(`Product with ID ${id} not found`);
      }

      // Cache the product
      await this.cache.set(cacheKey, product, this.CACHE_TTL);
      
      // Increment view count
      await this.repository.incrementViewCount(id);
      
      return product;
    } catch (error) {
      this.logger.error('Failed to get product', { error, id });
      throw error;
    }
  }

  /**
   * Get product by SKU
   */
  async getBySku(sku: string): Promise<IProduct> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}sku:${sku}`;
      const cached = await this.cache.get<IProduct>(cacheKey);
      
      if (cached) {
        return cached;
      }

      const product = await this.repository.findBySku(sku);
      if (!product) {
        throw new NotFoundError(`Product with SKU ${sku} not found`);
      }

      // Cache the product
      await this.cache.set(cacheKey, product, this.CACHE_TTL);
      
      return product;
    } catch (error) {
      this.logger.error('Failed to get product by SKU', { error, sku });
      throw error;
    }
  }

  /**
   * Get product by slug
   */
  async getBySlug(slug: string): Promise<IProduct> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}slug:${slug}`;
      const cached = await this.cache.get<IProduct>(cacheKey);
      
      if (cached) {
        // Increment view count asynchronously
        this.repository.incrementViewCount(cached.id).catch(err => 
          this.logger.error('Failed to increment view count', { error: err, productId: cached.id })
        );
        return cached;
      }

      const product = await this.repository.findBySlug(slug);
      if (!product) {
        throw new NotFoundError(`Product with slug ${slug} not found`);
      }

      // Cache the product
      await this.cache.set(cacheKey, product, this.CACHE_TTL);
      
      // Increment view count
      await this.repository.incrementViewCount(product.id);
      
      return product;
    } catch (error) {
      this.logger.error('Failed to get product by slug', { error, slug });
      throw error;
    }
  }

  /**
   * Create a new product
   */
  async create(data: CreateProductDto): Promise<IProduct> {
    try {
      // Validate required fields
      this.validateProductData(data);

      // Generate slug if not provided
      if (!data.slug) {
        data.slug = generateSlug(data.name);
      }

      // Validate SKU uniqueness
      const skuValid = await this.repository.validateSku(data.sku);
      if (!skuValid) {
        throw new ConflictError(`Product with SKU ${data.sku} already exists`);
      }

      // Validate slug uniqueness
      const slugValid = await this.repository.validateSlug(data.slug);
      if (!slugValid) {
        throw new ConflictError(`Product with slug ${data.slug} already exists`);
      }

      // Create the product
      const product = await this.repository.create(data);

      // Clear relevant caches
      await this.clearListCaches();

      this.logger.info('Product created', { productId: product.id, sku: product.sku });
      
      return product;
    } catch (error) {
      this.logger.error('Failed to create product', { error, data });
      throw error;
    }
  }

  /**
   * Update a product
   */
  async update(id: string, data: UpdateProductDto): Promise<IProduct> {
    try {
      // Check if product exists
      const existing = await this.repository.findById(id);
      if (!existing) {
        throw new NotFoundError(`Product with ID ${id} not found`);
      }

      // Validate SKU uniqueness if changed
      if (data.sku && data.sku !== existing.sku) {
        const skuValid = await this.repository.validateSku(data.sku, id);
        if (!skuValid) {
          throw new ConflictError(`Product with SKU ${data.sku} already exists`);
        }
      }

      // Validate slug uniqueness if changed
      if (data.slug && data.slug !== existing.slug) {
        const slugValid = await this.repository.validateSlug(data.slug, id);
        if (!slugValid) {
          throw new ConflictError(`Product with slug ${data.slug} already exists`);
        }
      }

      // Update the product
      const product = await this.repository.update(id, data);

      // Clear caches
      await this.clearProductCaches(id, existing.sku, existing.slug);
      await this.clearListCaches();

      this.logger.info('Product updated', { productId: id });
      
      return product;
    } catch (error) {
      this.logger.error('Failed to update product', { error, id, data });
      throw error;
    }
  }

  /**
   * Delete a product
   */
  async delete(id: string): Promise<boolean> {
    try {
      const product = await this.repository.findById(id);
      if (!product) {
        throw new NotFoundError(`Product with ID ${id} not found`);
      }

      const result = await this.repository.delete(id);

      // Clear caches
      await this.clearProductCaches(id, product.sku, product.slug);
      await this.clearListCaches();

      this.logger.info('Product deleted', { productId: id });
      
      return result;
    } catch (error) {
      this.logger.error('Failed to delete product', { error, id });
      throw error;
    }
  }

  /**
   * Update product inventory
   */
  async updateInventory(update: InventoryUpdateDto): Promise<IProduct> {
    try {
      const product = await this.repository.updateInventory(update);

      // Clear product caches
      await this.clearProductCaches(product.id, product.sku, product.slug);

      this.logger.info('Product inventory updated', { 
        productId: update.productId,
        operation: update.operation,
        quantity: update.quantity
      });
      
      return product;
    } catch (error) {
      this.logger.error('Failed to update inventory', { error, update });
      throw error;
    }
  }

  /**
   * Bulk update inventory
   */
  async bulkUpdateInventory(updates: InventoryUpdateDto[]): Promise<void> {
    try {
      await this.repository.bulkUpdateInventory(updates);

      // Clear all product caches for updated products
      for (const update of updates) {
        await this.cache.del(`${this.CACHE_PREFIX}${update.productId}`);
      }
      await this.clearListCaches();

      this.logger.info('Bulk inventory update completed', { count: updates.length });
    } catch (error) {
      this.logger.error('Failed to bulk update inventory', { error, updates });
      throw error;
    }
  }

  /**
   * Get featured products
   */
  async getFeatured(limit: number = 10): Promise<IProduct[]> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}featured:${limit}`;
      const cached = await this.cache.get<IProduct[]>(cacheKey);
      
      if (cached) {
        return cached;
      }

      const products = await this.repository.findFeatured(limit);
      
      // Cache the result
      await this.cache.set(cacheKey, products, this.CACHE_TTL);
      
      return products;
    } catch (error) {
      this.logger.error('Failed to get featured products', { error, limit });
      throw error;
    }
  }

  /**
   * Get related products
   */
  async getRelated(productId: string, limit: number = 5): Promise<IProduct[]> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}related:${productId}:${limit}`;
      const cached = await this.cache.get<IProduct[]>(cacheKey);
      
      if (cached) {
        return cached;
      }

      const products = await this.repository.findRelated(productId, limit);
      
      // Cache the result
      await this.cache.set(cacheKey, products, this.CACHE_TTL);
      
      return products;
    } catch (error) {
      this.logger.error('Failed to get related products', { error, productId, limit });
      throw error;
    }
  }

  /**
   * Get low stock products
   */
  async getLowStock(
    threshold?: number,
    options: QueryOptions = {}
  ): Promise<PaginationResult<IProduct>> {
    try {
      return await this.repository.findLowStock(threshold, options);
    } catch (error) {
      this.logger.error('Failed to get low stock products', { error, threshold, options });
      throw error;
    }
  }

  /**
   * Search products
   */
  async search(
    query: string,
    options: QueryOptions = {}
  ): Promise<PaginationResult<IProduct>> {
    try {
      const cacheKey = this.generateCacheKey('search', { query, options });
      const cached = await this.cache.get<PaginationResult<IProduct>>(cacheKey);
      
      if (cached) {
        return cached;
      }

      const result = await this.repository.searchProducts(query, options);
      
      // Cache the result for a shorter time
      await this.cache.set(cacheKey, result, 300); // 5 minutes
      
      return result;
    } catch (error) {
      this.logger.error('Failed to search products', { error, query, options });
      throw error;
    }
  }

  /**
   * Update product status
   */
  async updateStatus(productId: string, status: ProductStatus): Promise<IProduct> {
    try {
      const product = await this.repository.updateStatus(productId, status);

      // Clear caches
      await this.clearProductCaches(productId, product.sku, product.slug);
      await this.clearListCaches();

      this.logger.info('Product status updated', { productId, status });
      
      return product;
    } catch (error) {
      this.logger.error('Failed to update product status', { error, productId, status });
      throw error;
    }
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
    try {
      const cacheKey = `${this.CACHE_PREFIX}stats`;
      const cached = await this.cache.get<any>(cacheKey);
      
      if (cached) {
        return cached;
      }

      const stats = await this.repository.getStats();
      
      // Cache for a shorter time
      await this.cache.set(cacheKey, stats, 300); // 5 minutes
      
      return stats;
    } catch (error) {
      this.logger.error('Failed to get product stats', { error });
      throw error;
    }
  }

  /**
   * Validate product data
   */
  private validateProductData(data: CreateProductDto): void {
    const errors: string[] = [];

    if (!data.sku) errors.push('SKU is required');
    if (!data.name) errors.push('Name is required');
    if (!data.name_ko) errors.push('Korean name is required');
    if (!data.description) errors.push('Description is required');
    if (!data.description_ko) errors.push('Korean description is required');
    if (!data.origin) errors.push('Origin is required');
    if (!data.manufacturer) errors.push('Manufacturer is required');
    if (!data.categoryId) errors.push('Category is required');
    if (data.price === undefined || data.price < 0) errors.push('Valid price is required');

    if (errors.length > 0) {
      throw new ValidationError('Invalid product data', errors);
    }
  }

  /**
   * Generate cache key
   */
  private generateCacheKey(prefix: string, params: any): string {
    const paramStr = JSON.stringify(params, Object.keys(params).sort());
    return `${this.CACHE_PREFIX}${prefix}:${Buffer.from(paramStr).toString('base64')}`;
  }

  /**
   * Clear product-specific caches
   */
  private async clearProductCaches(id: string, sku: string, slug: string): Promise<void> {
    await Promise.all([
      this.cache.del(`${this.CACHE_PREFIX}${id}`),
      this.cache.del(`${this.CACHE_PREFIX}sku:${sku}`),
      this.cache.del(`${this.CACHE_PREFIX}slug:${slug}`)
    ]);
  }

  /**
   * Clear list-related caches
   */
  private async clearListCaches(): Promise<void> {
    // Clear all list caches with pattern matching
    await this.cache.del(`${this.CACHE_PREFIX}list:*`);
    await this.cache.del(`${this.CACHE_PREFIX}featured:*`);
    await this.cache.del(`${this.CACHE_PREFIX}stats`);
  }
}