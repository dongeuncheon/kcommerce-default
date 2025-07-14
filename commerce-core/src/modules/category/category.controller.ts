import { Container } from '@/core/di/container';
import { CategoryService } from './category.service';
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { 
  CreateCategoryDto, 
  UpdateCategoryDto, 
  CategoryFilterOptions,
  ReorderCategoryDto,
  MoveCategoryDto
} from './category.types';
import { requireAuth, requireRole } from '@/modules/auth/auth.middleware';
import { z } from 'zod';

// Validation schemas
const categoryFilterSchema = z.object({
  page: z.string().optional().transform(val => val ? parseInt(val, 10) : 1),
  limit: z.string().optional().transform(val => val ? parseInt(val, 10) : 20),
  parentId: z.string().optional(),
  isActive: z.string().optional().transform(val => val === 'true'),
  search: z.string().optional(),
  orderBy: z.string().optional(),
  orderDirection: z.enum(['asc', 'desc']).optional()
});

const createCategorySchema = z.object({
  name: z.string().min(1).max(255),
  name_ko: z.string().min(1).max(255),
  slug: z.string().min(1).max(255).optional(),
  slug_ko: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  description_ko: z.string().optional(),
  parentId: z.string().uuid().optional().nullable(),
  imageUrl: z.string().url().optional(),
  displayOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  metadata: z.record(z.any()).optional()
});

const updateCategorySchema = createCategorySchema.partial();

const reorderCategorySchema = z.array(z.object({
  id: z.string().uuid(),
  order: z.number().int().min(0)
}));

const moveCategorySchema = z.object({
  categoryId: z.string().uuid(),
  newParentId: z.string().uuid().nullable()
});

export class CategoryController {
  private categoryService: CategoryService;

  constructor() {
    const container = Container.getInstance();
    this.categoryService = container.resolve<CategoryService>('CategoryService');
  }

  /**
   * GET /api/categories
   * List categories with filters and pagination
   */
  async list(
    request: FastifyRequest<{ Querystring: CategoryFilterOptions }>,
    reply: FastifyReply
  ): Promise<any> {
    try {
      const validatedQuery = categoryFilterSchema.parse(request.query);
      
      const { page, limit, orderBy, orderDirection, ...filters } = validatedQuery;
      
      const options = {
        page,
        limit,
        orderBy: orderBy ? [{ field: orderBy, direction: orderDirection || 'asc' }] : undefined
      };

      const result = await this.categoryService.list(filters, options);

      return {
        success: true,
        data: result.data,
        meta: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages
        }
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid query parameters',
          details: error.errors
        });
      }
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch categories'
      });
    }
  }

  /**
   * GET /api/categories/tree
   * Get category tree structure
   */
  async getTree(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<any> {
    try {
      const tree = await this.categoryService.getCategoryTree();
      
      return {
        success: true,
        data: tree
      };
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch category tree'
      });
    }
  }

  /**
   * GET /api/categories/roots
   * Get root categories
   */
  async getRoots(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<any> {
    try {
      const categories = await this.categoryService.getRootCategories();
      
      return {
        success: true,
        data: categories
      };
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch root categories'
      });
    }
  }

  /**
   * GET /api/categories/:id
   * Get category by ID
   */
  async get(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<any> {
    try {
      const { id } = request.params;
      const category = await this.categoryService.get(id);
      
      return {
        success: true,
        data: category
      };
    } catch (error: any) {
      if (error.name === 'NotFoundError') {
        return reply.status(404).send({
          success: false,
          error: error.message
        });
      }
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch category'
      });
    }
  }

  /**
   * GET /api/categories/slug/:slug
   * Get category by slug
   */
  async getBySlug(
    request: FastifyRequest<{ Params: { slug: string } }>,
    reply: FastifyReply
  ): Promise<any> {
    try {
      const { slug } = request.params;
      const category = await this.categoryService.getBySlug(slug);
      
      return {
        success: true,
        data: category
      };
    } catch (error: any) {
      if (error.name === 'NotFoundError') {
        return reply.status(404).send({
          success: false,
          error: error.message
        });
      }
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch category'
      });
    }
  }

  /**
   * GET /api/categories/slug-ko/:slugKo
   * Get category by Korean slug
   */
  async getBySlugKo(
    request: FastifyRequest<{ Params: { slugKo: string } }>,
    reply: FastifyReply
  ): Promise<any> {
    try {
      const { slugKo } = request.params;
      const category = await this.categoryService.getBySlugKo(slugKo);
      
      return {
        success: true,
        data: category
      };
    } catch (error: any) {
      if (error.name === 'NotFoundError') {
        return reply.status(404).send({
          success: false,
          error: error.message
        });
      }
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch category'
      });
    }
  }

  /**
   * GET /api/categories/:id/subcategories
   * Get subcategories of a category
   */
  async getSubcategories(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<any> {
    try {
      const { id } = request.params;
      const categories = await this.categoryService.getSubcategories(id);
      
      return {
        success: true,
        data: categories
      };
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch subcategories'
      });
    }
  }

  /**
   * GET /api/categories/:id/path
   * Get category path (breadcrumb)
   */
  async getPath(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<any> {
    try {
      const { id } = request.params;
      const path = await this.categoryService.getCategoryPath(id);
      
      return {
        success: true,
        data: path
      };
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch category path'
      });
    }
  }

  /**
   * POST /api/categories
   * Create a new category
   */
  async create(
    request: FastifyRequest<{ Body: CreateCategoryDto }>,
    reply: FastifyReply
  ): Promise<any> {
    try {
      const validatedData = createCategorySchema.parse(request.body);
      const category = await this.categoryService.create(validatedData);
      
      return reply.status(201).send({
        success: true,
        data: category
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid category data',
          details: error.errors
        });
      }
      if (error.name === 'ConflictError') {
        return reply.status(409).send({
          success: false,
          error: error.message
        });
      }
      if (error.name === 'ValidationError') {
        return reply.status(400).send({
          success: false,
          error: error.message,
          details: error.details
        });
      }
      if (error.name === 'NotFoundError') {
        return reply.status(404).send({
          success: false,
          error: error.message
        });
      }
      return reply.status(500).send({
        success: false,
        error: 'Failed to create category'
      });
    }
  }

  /**
   * PUT /api/categories/:id
   * Update a category
   */
  async update(
    request: FastifyRequest<{ Params: { id: string }; Body: UpdateCategoryDto }>,
    reply: FastifyReply
  ): Promise<any> {
    try {
      const { id } = request.params;
      const validatedData = updateCategorySchema.parse(request.body);
      const category = await this.categoryService.update(id, validatedData);
      
      return {
        success: true,
        data: category
      };
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid category data',
          details: error.errors
        });
      }
      if (error.name === 'NotFoundError') {
        return reply.status(404).send({
          success: false,
          error: error.message
        });
      }
      if (error.name === 'ConflictError') {
        return reply.status(409).send({
          success: false,
          error: error.message
        });
      }
      if (error.name === 'ValidationError') {
        return reply.status(400).send({
          success: false,
          error: error.message,
          details: error.details
        });
      }
      return reply.status(500).send({
        success: false,
        error: 'Failed to update category'
      });
    }
  }

  /**
   * DELETE /api/categories/:id
   * Delete a category
   */
  async delete(
    request: FastifyRequest<{ 
      Params: { id: string };
      Querystring: { reassignToId?: string }
    }>,
    reply: FastifyReply
  ): Promise<any> {
    try {
      const { id } = request.params;
      const { reassignToId } = request.query;
      
      await this.categoryService.delete(id, reassignToId);
      
      return {
        success: true,
        message: 'Category deleted successfully'
      };
    } catch (error: any) {
      if (error.name === 'NotFoundError') {
        return reply.status(404).send({
          success: false,
          error: error.message
        });
      }
      if (error.name === 'ConflictError') {
        return reply.status(409).send({
          success: false,
          error: error.message
        });
      }
      return reply.status(500).send({
        success: false,
        error: 'Failed to delete category'
      });
    }
  }

  /**
   * POST /api/categories/reorder
   * Reorder categories
   */
  async reorder(
    request: FastifyRequest<{ Body: ReorderCategoryDto[] }>,
    reply: FastifyReply
  ): Promise<any> {
    try {
      const validatedData = reorderCategorySchema.parse(request.body);
      await this.categoryService.reorderCategories(validatedData);
      
      return {
        success: true,
        message: 'Categories reordered successfully'
      };
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid reorder data',
          details: error.errors
        });
      }
      return reply.status(500).send({
        success: false,
        error: 'Failed to reorder categories'
      });
    }
  }

  /**
   * POST /api/categories/move
   * Move category to new parent
   */
  async move(
    request: FastifyRequest<{ Body: MoveCategoryDto }>,
    reply: FastifyReply
  ): Promise<any> {
    try {
      const validatedData = moveCategorySchema.parse(request.body);
      const category = await this.categoryService.moveCategory(validatedData);
      
      return {
        success: true,
        data: category
      };
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid move data',
          details: error.errors
        });
      }
      if (error.message === 'Circular reference detected') {
        return reply.status(400).send({
          success: false,
          error: error.message
        });
      }
      return reply.status(500).send({
        success: false,
        error: 'Failed to move category'
      });
    }
  }

  /**
   * GET /api/categories/stats
   * Get category statistics
   */
  async getStats(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<any> {
    try {
      const stats = await this.categoryService.getStats();
      
      return {
        success: true,
        data: stats
      };
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch category statistics'
      });
    }
  }

  /**
   * Register routes
   */
  static registerRoutes(server: any): void {
    const controller = new CategoryController();

    // Public routes
    server.get('/api/categories', controller.list.bind(controller));
    server.get('/api/categories/tree', controller.getTree.bind(controller));
    server.get('/api/categories/roots', controller.getRoots.bind(controller));
    server.get('/api/categories/stats', controller.getStats.bind(controller));
    server.get('/api/categories/:id', controller.get.bind(controller));
    server.get('/api/categories/slug/:slug', controller.getBySlug.bind(controller));
    server.get('/api/categories/slug-ko/:slugKo', controller.getBySlugKo.bind(controller));
    server.get('/api/categories/:id/subcategories', controller.getSubcategories.bind(controller));
    server.get('/api/categories/:id/path', controller.getPath.bind(controller));

    // Protected routes (require authentication)
    server.post('/api/categories', 
      { preHandler: [requireAuth, requireRole('admin', 'manager')] }, 
      controller.create.bind(controller)
    );
    server.put('/api/categories/:id', 
      { preHandler: [requireAuth, requireRole('admin', 'manager')] }, 
      controller.update.bind(controller)
    );
    server.delete('/api/categories/:id', 
      { preHandler: [requireAuth, requireRole('admin')] }, 
      controller.delete.bind(controller)
    );
    server.post('/api/categories/reorder', 
      { preHandler: [requireAuth, requireRole('admin', 'manager')] }, 
      controller.reorder.bind(controller)
    );
    server.post('/api/categories/move', 
      { preHandler: [requireAuth, requireRole('admin', 'manager')] }, 
      controller.move.bind(controller)
    );
  }
}