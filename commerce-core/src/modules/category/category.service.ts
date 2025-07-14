import { Container } from '@/core/di/container';
import { LoggerService } from '@/core/services/logger.service';
import { CacheService } from '@/core/services/cache.service';
import type { QueryOptions, PaginationResult } from '@/types/common';
import type {
  IProductCategory,
  CreateCategoryDto,
  UpdateCategoryDto,
  CategoryFilterOptions,
  ICategoryTreeNode,
  CategoryStats,
  ReorderCategoryDto,
  MoveCategoryDto
} from './category.types';
import type { IProductCategoryRepository } from '../product/product.repository.interface';
import { CategoryRepository } from './category.repository';
import { generateSlug } from '@/utils/slug';
import { ValidationError, NotFoundError, ConflictError } from '@/types/errors';

export class CategoryService {
  private repository: IProductCategoryRepository;
  private logger: LoggerService;
  private cache: CacheService;
  private readonly CACHE_TTL = 3600; // 1 hour
  private readonly CACHE_PREFIX = 'category:';

  constructor() {
    const container = Container.getInstance();
    this.repository = container.resolve<IProductCategoryRepository>('CategoryRepository');
    this.logger = container.resolve<LoggerService>('LoggerService');
    this.cache = container.resolve<CacheService>('CacheService');
  }

  /**
   * Get all categories with pagination and filters
   */
  async list(
    filters: CategoryFilterOptions = {},
    options: QueryOptions = {}
  ): Promise<PaginationResult<IProductCategory>> {
    try {
      const where: Record<string, any> = {};
      
      if (filters.parentId !== undefined) {
        where.parent_id = filters.parentId;
      }
      if (filters.isActive !== undefined) {
        where.is_active = filters.isActive;
      }
      if (filters.search) {
        where.$or = [
          { name: { $like: `%${filters.search}%` } },
          { name_ko: { $like: `%${filters.search}%` } },
          { description: { $like: `%${filters.search}%` } },
          { description_ko: { $like: `%${filters.search}%` } }
        ];
      }

      const result = await this.repository.findAll({
        where,
        ...options,
        orderBy: options.orderBy || [{ field: 'display_order', direction: 'asc' }]
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to list categories', { error, filters, options });
      throw error;
    }
  }

  /**
   * Get category by ID
   */
  async get(id: string): Promise<IProductCategory> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}${id}`;
      const cached = await this.cache.get<IProductCategory>(cacheKey);
      
      if (cached) {
        return cached;
      }

      const category = await this.repository.findById(id);
      if (!category) {
        throw new NotFoundError(`Category with ID ${id} not found`);
      }

      // Cache the category
      await this.cache.set(cacheKey, category, this.CACHE_TTL);
      
      return category;
    } catch (error) {
      this.logger.error('Failed to get category', { error, id });
      throw error;
    }
  }

  /**
   * Get category by slug
   */
  async getBySlug(slug: string): Promise<IProductCategory> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}slug:${slug}`;
      const cached = await this.cache.get<IProductCategory>(cacheKey);
      
      if (cached) {
        return cached;
      }

      const category = await this.repository.findBySlug(slug);
      if (!category) {
        throw new NotFoundError(`Category with slug ${slug} not found`);
      }

      // Cache the category
      await this.cache.set(cacheKey, category, this.CACHE_TTL);
      
      return category;
    } catch (error) {
      this.logger.error('Failed to get category by slug', { error, slug });
      throw error;
    }
  }

  /**
   * Get category by Korean slug
   */
  async getBySlugKo(slugKo: string): Promise<IProductCategory> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}slug-ko:${slugKo}`;
      const cached = await this.cache.get<IProductCategory>(cacheKey);
      
      if (cached) {
        return cached;
      }

      const category = await this.repository.findBySlugKo(slugKo);
      if (!category) {
        throw new NotFoundError(`Category with Korean slug ${slugKo} not found`);
      }

      // Cache the category
      await this.cache.set(cacheKey, category, this.CACHE_TTL);
      
      return category;
    } catch (error) {
      this.logger.error('Failed to get category by Korean slug', { error, slugKo });
      throw error;
    }
  }

  /**
   * Create a new category
   */
  async create(data: CreateCategoryDto): Promise<IProductCategory> {
    try {
      // Validate required fields
      this.validateCategoryData(data);

      // Generate slugs if not provided
      if (!data.slug) {
        data.slug = generateSlug(data.name);
      }
      if (!data.slug_ko) {
        data.slug_ko = generateSlug(data.name_ko);
      }

      // Validate slug uniqueness
      const slugValid = await this.repository.validateSlug(data.slug);
      if (!slugValid) {
        throw new ConflictError(`Category with slug ${data.slug} already exists`);
      }

      // Validate Korean slug uniqueness
      const slugKoValid = await this.repository.validateSlugKo(data.slug_ko);
      if (!slugKoValid) {
        throw new ConflictError(`Category with Korean slug ${data.slug_ko} already exists`);
      }

      // Validate parent exists if provided
      if (data.parentId) {
        const parent = await this.repository.findById(data.parentId);
        if (!parent) {
          throw new NotFoundError(`Parent category with ID ${data.parentId} not found`);
        }
      }

      // Create the category
      const category = await this.repository.create(data);

      // Clear relevant caches
      await this.clearCaches();

      this.logger.info('Category created', { categoryId: category.id, slug: category.slug });
      
      return category;
    } catch (error) {
      this.logger.error('Failed to create category', { error, data });
      throw error;
    }
  }

  /**
   * Update a category
   */
  async update(id: string, data: UpdateCategoryDto): Promise<IProductCategory> {
    try {
      // Check if category exists
      const existing = await this.repository.findById(id);
      if (!existing) {
        throw new NotFoundError(`Category with ID ${id} not found`);
      }

      // Validate slug uniqueness if changed
      if (data.slug && data.slug !== existing.slug) {
        const slugValid = await this.repository.validateSlug(data.slug, id);
        if (!slugValid) {
          throw new ConflictError(`Category with slug ${data.slug} already exists`);
        }
      }

      // Validate Korean slug uniqueness if changed
      if (data.slug_ko && data.slug_ko !== existing.slug_ko) {
        const slugKoValid = await this.repository.validateSlugKo(data.slug_ko, id);
        if (!slugKoValid) {
          throw new ConflictError(`Category with Korean slug ${data.slug_ko} already exists`);
        }
      }

      // Validate parent exists if changed
      if (data.parentId !== undefined && data.parentId !== existing.parentId) {
        if (data.parentId) {
          const parent = await this.repository.findById(data.parentId);
          if (!parent) {
            throw new NotFoundError(`Parent category with ID ${data.parentId} not found`);
          }
          
          // Check for circular reference
          if (data.parentId === id) {
            throw new ValidationError('Category cannot be its own parent');
          }
        }
      }

      // Update the category
      const category = await this.repository.update(id, data);

      // Clear caches
      await this.clearCategoryCache(id, existing.slug, existing.slug_ko);
      await this.clearCaches();

      this.logger.info('Category updated', { categoryId: id });
      
      return category;
    } catch (error) {
      this.logger.error('Failed to update category', { error, id, data });
      throw error;
    }
  }

  /**
   * Delete a category
   */
  async delete(id: string, reassignToId?: string): Promise<boolean> {
    try {
      const category = await this.repository.findById(id);
      if (!category) {
        throw new NotFoundError(`Category with ID ${id} not found`);
      }

      // Check if category has products
      const productCount = await this.repository.countProducts(id);
      if (productCount > 0 && !reassignToId) {
        throw new ConflictError(`Category has ${productCount} products. Provide reassignToId to move them.`);
      }

      // Delete category (and reassign products if needed)
      const result = reassignToId 
        ? await (this.repository as CategoryRepository).deleteCategoryAndReassignProducts(id, reassignToId)
        : await this.repository.delete(id);

      // Clear caches
      await this.clearCategoryCache(id, category.slug, category.slug_ko);
      await this.clearCaches();

      this.logger.info('Category deleted', { categoryId: id, reassignedTo: reassignToId });
      
      return result;
    } catch (error) {
      this.logger.error('Failed to delete category', { error, id });
      throw error;
    }
  }

  /**
   * Get category tree
   */
  async getCategoryTree(): Promise<ICategoryTreeNode[]> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}tree`;
      const cached = await this.cache.get<ICategoryTreeNode[]>(cacheKey);
      
      if (cached) {
        return cached;
      }

      const tree = await this.repository.getCategoryTree();
      
      // Add product counts to tree nodes
      const treeWithCounts = await this.addProductCountsToTree(tree);
      
      // Cache the result
      await this.cache.set(cacheKey, treeWithCounts, this.CACHE_TTL);
      
      return treeWithCounts;
    } catch (error) {
      this.logger.error('Failed to get category tree', { error });
      throw error;
    }
  }

  /**
   * Get category path (breadcrumb)
   */
  async getCategoryPath(categoryId: string): Promise<IProductCategory[]> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}path:${categoryId}`;
      const cached = await this.cache.get<IProductCategory[]>(cacheKey);
      
      if (cached) {
        return cached;
      }

      const path = await this.repository.getCategoryPath(categoryId);
      
      // Cache the result
      await this.cache.set(cacheKey, path, this.CACHE_TTL);
      
      return path;
    } catch (error) {
      this.logger.error('Failed to get category path', { error, categoryId });
      throw error;
    }
  }

  /**
   * Get root categories
   */
  async getRootCategories(): Promise<IProductCategory[]> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}roots`;
      const cached = await this.cache.get<IProductCategory[]>(cacheKey);
      
      if (cached) {
        return cached;
      }

      const categories = await this.repository.findRootCategories();
      
      // Cache the result
      await this.cache.set(cacheKey, categories, this.CACHE_TTL);
      
      return categories;
    } catch (error) {
      this.logger.error('Failed to get root categories', { error });
      throw error;
    }
  }

  /**
   * Get subcategories
   */
  async getSubcategories(parentId: string): Promise<IProductCategory[]> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}subs:${parentId}`;
      const cached = await this.cache.get<IProductCategory[]>(cacheKey);
      
      if (cached) {
        return cached;
      }

      const categories = await this.repository.findSubcategories(parentId);
      
      // Cache the result
      await this.cache.set(cacheKey, categories, this.CACHE_TTL);
      
      return categories;
    } catch (error) {
      this.logger.error('Failed to get subcategories', { error, parentId });
      throw error;
    }
  }

  /**
   * Move category to new parent
   */
  async moveCategory(data: MoveCategoryDto): Promise<IProductCategory> {
    try {
      const category = await this.repository.moveCategory(data.categoryId, data.newParentId);

      // Clear caches
      await this.clearCaches();

      this.logger.info('Category moved', { 
        categoryId: data.categoryId, 
        newParentId: data.newParentId 
      });
      
      return category;
    } catch (error) {
      this.logger.error('Failed to move category', { error, data });
      throw error;
    }
  }

  /**
   * Reorder categories
   */
  async reorderCategories(orders: ReorderCategoryDto[]): Promise<void> {
    try {
      await this.repository.reorderCategories(orders);

      // Clear caches
      await this.clearCaches();

      this.logger.info('Categories reordered', { count: orders.length });
    } catch (error) {
      this.logger.error('Failed to reorder categories', { error, orders });
      throw error;
    }
  }

  /**
   * Get category statistics
   */
  async getStats(): Promise<CategoryStats> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}stats`;
      const cached = await this.cache.get<CategoryStats>(cacheKey);
      
      if (cached) {
        return cached;
      }

      // Get all categories
      const allCategories = await this.repository.findAll({ limit: 0 });
      const activeCategories = await this.repository.findAll({ 
        where: { is_active: true }, 
        limit: 0 
      });
      const rootCategories = await this.repository.findRootCategories();

      // Count total products across all categories
      const categoriesWithCount = await (this.repository as CategoryRepository).getCategoriesWithProductCount();
      const totalProducts = categoriesWithCount.reduce((sum, cat) => sum + cat.productCount, 0);

      const stats: CategoryStats = {
        totalCategories: allCategories.total,
        activeCategories: activeCategories.total,
        rootCategories: rootCategories.length,
        totalProducts
      };
      
      // Cache for a shorter time
      await this.cache.set(cacheKey, stats, 300); // 5 minutes
      
      return stats;
    } catch (error) {
      this.logger.error('Failed to get category stats', { error });
      throw error;
    }
  }

  /**
   * Validate category data
   */
  private validateCategoryData(data: CreateCategoryDto): void {
    const errors: string[] = [];

    if (!data.name) errors.push('Name is required');
    if (!data.name_ko) errors.push('Korean name is required');

    if (errors.length > 0) {
      throw new ValidationError('Invalid category data', errors);
    }
  }

  /**
   * Add product counts to category tree
   */
  private async addProductCountsToTree(
    categories: IProductCategory[]
  ): Promise<ICategoryTreeNode[]> {
    return Promise.all(
      categories.map(async (category) => {
        const productCount = await this.repository.countProducts(category.id);
        const children = category.children 
          ? await this.addProductCountsToTree(category.children)
          : [];
        
        return {
          ...category,
          children,
          productCount
        } as ICategoryTreeNode;
      })
    );
  }

  /**
   * Clear category-specific cache
   */
  private async clearCategoryCache(id: string, slug: string, slugKo: string): Promise<void> {
    await Promise.all([
      this.cache.del(`${this.CACHE_PREFIX}${id}`),
      this.cache.del(`${this.CACHE_PREFIX}slug:${slug}`),
      this.cache.del(`${this.CACHE_PREFIX}slug-ko:${slugKo}`),
      this.cache.del(`${this.CACHE_PREFIX}path:${id}`)
    ]);
  }

  /**
   * Clear all category-related caches
   */
  private async clearCaches(): Promise<void> {
    await Promise.all([
      this.cache.del(`${this.CACHE_PREFIX}tree`),
      this.cache.del(`${this.CACHE_PREFIX}roots`),
      this.cache.del(`${this.CACHE_PREFIX}subs:*`),
      this.cache.del(`${this.CACHE_PREFIX}stats`)
    ]);
  }
}