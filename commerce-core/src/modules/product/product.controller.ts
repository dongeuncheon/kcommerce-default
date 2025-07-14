import { Container } from '@/core/di/container';
import { ProductService } from './product.service';
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { 
  CreateProductDto, 
  UpdateProductDto, 
  ProductFilterOptions,
  InventoryUpdateDto,
  ProductStatus 
} from './product.types';
import { validateRequest } from '@/middleware/validation';
import { requireAuth, requireRole } from '@/modules/auth/auth.middleware';
import { uploadHandler } from '@/middleware/upload';
import { z } from 'zod';

// Validation schemas
const productFilterSchema = z.object({
  page: z.string().optional().transform(val => val ? parseInt(val, 10) : 1),
  limit: z.string().optional().transform(val => val ? parseInt(val, 10) : 20),
  categoryId: z.string().optional(),
  status: z.enum(['active', 'inactive', 'out_of_stock', 'discontinued']).optional(),
  minPrice: z.string().optional().transform(val => val ? parseFloat(val) : undefined),
  maxPrice: z.string().optional().transform(val => val ? parseFloat(val) : undefined),
  inStock: z.string().optional().transform(val => val === 'true'),
  isFeatured: z.string().optional().transform(val => val === 'true'),
  tags: z.string().optional().transform(val => val ? val.split(',') : undefined),
  search: z.string().optional(),
  origin: z.string().optional(),
  manufacturer: z.string().optional(),
  orderBy: z.string().optional(),
  orderDirection: z.enum(['asc', 'desc']).optional()
});

const createProductSchema = z.object({
  sku: z.string().min(1).max(100),
  name: z.string().min(1).max(255),
  name_ko: z.string().min(1).max(255),
  description: z.string().min(1),
  description_ko: z.string().min(1),
  origin: z.string().min(1).max(100),
  manufacturer: z.string().min(1).max(255),
  expiryDays: z.number().optional(),
  categoryId: z.string().uuid(),
  price: z.number().positive(),
  comparePrice: z.number().positive().optional(),
  cost: z.number().positive().optional(),
  trackInventory: z.boolean().optional(),
  quantity: z.number().int().min(0).optional(),
  lowStockThreshold: z.number().int().min(0).optional(),
  allowBackorder: z.boolean().optional(),
  weight: z.number().positive().optional(),
  dimensions: z.object({
    length: z.number().positive(),
    width: z.number().positive(),
    height: z.number().positive()
  }).optional(),
  status: z.enum(['active', 'inactive', 'out_of_stock', 'discontinued']).optional(),
  isVisible: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  metaKeywords: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  attributes: z.array(z.object({
    key: z.string(),
    value: z.string(),
    displayName: z.string().optional(),
    displayName_ko: z.string().optional()
  })).optional(),
  metadata: z.record(z.any()).optional()
});

const updateProductSchema = createProductSchema.partial();

const inventoryUpdateSchema = z.object({
  quantity: z.number().int().min(0),
  operation: z.enum(['add', 'subtract', 'set']),
  reason: z.string().optional(),
  metadata: z.record(z.any()).optional()
});

export class ProductController {
  private productService: ProductService;

  constructor() {
    const container = Container.getInstance();
    this.productService = container.resolve<ProductService>('ProductService');
  }

  /**
   * GET /api/products
   * List products with filters and pagination
   */
  async list(
    request: FastifyRequest<{ Querystring: ProductFilterOptions }>,
    reply: FastifyReply
  ): Promise<any> {
    try {
      const validatedQuery = productFilterSchema.parse(request.query);
      
      const { page, limit, orderBy, orderDirection, ...filters } = validatedQuery;
      
      const options = {
        page,
        limit,
        orderBy: orderBy ? [{ field: orderBy, direction: orderDirection || 'asc' }] : undefined
      };

      const result = await this.productService.list(filters, options);

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
        error: 'Failed to fetch products'
      });
    }
  }

  /**
   * GET /api/products/:id
   * Get product by ID
   */
  async get(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<any> {
    try {
      const { id } = request.params;
      const product = await this.productService.get(id);
      
      return {
        success: true,
        data: product
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
        error: 'Failed to fetch product'
      });
    }
  }

  /**
   * GET /api/products/sku/:sku
   * Get product by SKU
   */
  async getBySku(
    request: FastifyRequest<{ Params: { sku: string } }>,
    reply: FastifyReply
  ): Promise<any> {
    try {
      const { sku } = request.params;
      const product = await this.productService.getBySku(sku);
      
      return {
        success: true,
        data: product
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
        error: 'Failed to fetch product'
      });
    }
  }

  /**
   * GET /api/products/slug/:slug
   * Get product by slug
   */
  async getBySlug(
    request: FastifyRequest<{ Params: { slug: string } }>,
    reply: FastifyReply
  ): Promise<any> {
    try {
      const { slug } = request.params;
      const product = await this.productService.getBySlug(slug);
      
      return {
        success: true,
        data: product
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
        error: 'Failed to fetch product'
      });
    }
  }

  /**
   * POST /api/products
   * Create a new product
   */
  async create(
    request: FastifyRequest<{ Body: CreateProductDto }>,
    reply: FastifyReply
  ): Promise<any> {
    try {
      const validatedData = createProductSchema.parse(request.body);
      const product = await this.productService.create(validatedData);
      
      return reply.status(201).send({
        success: true,
        data: product
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid product data',
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
      return reply.status(500).send({
        success: false,
        error: 'Failed to create product'
      });
    }
  }

  /**
   * PUT /api/products/:id
   * Update a product
   */
  async update(
    request: FastifyRequest<{ Params: { id: string }; Body: UpdateProductDto }>,
    reply: FastifyReply
  ): Promise<any> {
    try {
      const { id } = request.params;
      const validatedData = updateProductSchema.parse(request.body);
      const product = await this.productService.update(id, validatedData);
      
      return {
        success: true,
        data: product
      };
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid product data',
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
      return reply.status(500).send({
        success: false,
        error: 'Failed to update product'
      });
    }
  }

  /**
   * DELETE /api/products/:id
   * Delete a product
   */
  async delete(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<any> {
    try {
      const { id } = request.params;
      await this.productService.delete(id);
      
      return {
        success: true,
        message: 'Product deleted successfully'
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
        error: 'Failed to delete product'
      });
    }
  }

  /**
   * POST /api/products/:id/images
   * Upload product images
   */
  async uploadImages(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<any> {
    try {
      const { id } = request.params;
      
      // Handle file upload (implementation depends on your upload middleware)
      const files = await uploadHandler(request, {
        allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
        maxFileSize: 5 * 1024 * 1024, // 5MB
        destination: 'products'
      });

      if (!files || files.length === 0) {
        return reply.status(400).send({
          success: false,
          error: 'No files uploaded'
        });
      }

      // Update product with new images
      const images = files.map((file, index) => ({
        id: `img_${Date.now()}_${index}`,
        url: file.url,
        alt: file.originalName,
        displayOrder: index,
        isMain: index === 0
      }));

      const product = await this.productService.update(id, { images });
      
      return {
        success: true,
        data: product
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
        error: 'Failed to upload images'
      });
    }
  }

  /**
   * PUT /api/products/:id/inventory
   * Update product inventory
   */
  async updateInventory(
    request: FastifyRequest<{ Params: { id: string }; Body: InventoryUpdateDto }>,
    reply: FastifyReply
  ): Promise<any> {
    try {
      const { id } = request.params;
      const validatedData = inventoryUpdateSchema.parse(request.body);
      
      const product = await this.productService.updateInventory({
        productId: id,
        ...validatedData
      });
      
      return {
        success: true,
        data: product
      };
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid inventory data',
          details: error.errors
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
        error: 'Failed to update inventory'
      });
    }
  }

  /**
   * POST /api/products/bulk-inventory
   * Bulk update product inventory
   */
  async bulkUpdateInventory(
    request: FastifyRequest<{ Body: InventoryUpdateDto[] }>,
    reply: FastifyReply
  ): Promise<any> {
    try {
      const updates = z.array(inventoryUpdateSchema.extend({
        productId: z.string().uuid()
      })).parse(request.body);
      
      await this.productService.bulkUpdateInventory(updates);
      
      return {
        success: true,
        message: 'Inventory updated successfully'
      };
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid inventory data',
          details: error.errors
        });
      }
      return reply.status(500).send({
        success: false,
        error: 'Failed to update inventory'
      });
    }
  }

  /**
   * GET /api/products/featured
   * Get featured products
   */
  async getFeatured(
    request: FastifyRequest<{ Querystring: { limit?: string } }>,
    reply: FastifyReply
  ): Promise<any> {
    try {
      const limit = request.query.limit ? parseInt(request.query.limit, 10) : 10;
      const products = await this.productService.getFeatured(limit);
      
      return {
        success: true,
        data: products
      };
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch featured products'
      });
    }
  }

  /**
   * GET /api/products/:id/related
   * Get related products
   */
  async getRelated(
    request: FastifyRequest<{ Params: { id: string }; Querystring: { limit?: string } }>,
    reply: FastifyReply
  ): Promise<any> {
    try {
      const { id } = request.params;
      const limit = request.query.limit ? parseInt(request.query.limit, 10) : 5;
      const products = await this.productService.getRelated(id, limit);
      
      return {
        success: true,
        data: products
      };
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch related products'
      });
    }
  }

  /**
   * GET /api/products/low-stock
   * Get low stock products
   */
  async getLowStock(
    request: FastifyRequest<{ Querystring: { threshold?: string; page?: string; limit?: string } }>,
    reply: FastifyReply
  ): Promise<any> {
    try {
      const threshold = request.query.threshold ? parseInt(request.query.threshold, 10) : undefined;
      const page = request.query.page ? parseInt(request.query.page, 10) : 1;
      const limit = request.query.limit ? parseInt(request.query.limit, 10) : 20;
      
      const result = await this.productService.getLowStock(threshold, { page, limit });
      
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
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch low stock products'
      });
    }
  }

  /**
   * GET /api/products/search
   * Search products
   */
  async search(
    request: FastifyRequest<{ Querystring: { q: string; page?: string; limit?: string } }>,
    reply: FastifyReply
  ): Promise<any> {
    try {
      const { q, page = '1', limit = '20' } = request.query;
      
      if (!q) {
        return reply.status(400).send({
          success: false,
          error: 'Search query is required'
        });
      }
      
      const result = await this.productService.search(q, {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10)
      });
      
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
      return reply.status(500).send({
        success: false,
        error: 'Failed to search products'
      });
    }
  }

  /**
   * PUT /api/products/:id/status
   * Update product status
   */
  async updateStatus(
    request: FastifyRequest<{ Params: { id: string }; Body: { status: ProductStatus } }>,
    reply: FastifyReply
  ): Promise<any> {
    try {
      const { id } = request.params;
      const { status } = request.body;
      
      if (!status || !['active', 'inactive', 'out_of_stock', 'discontinued'].includes(status)) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid status'
        });
      }
      
      const product = await this.productService.updateStatus(id, status);
      
      return {
        success: true,
        data: product
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
        error: 'Failed to update product status'
      });
    }
  }

  /**
   * GET /api/products/stats
   * Get product statistics
   */
  async getStats(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<any> {
    try {
      const stats = await this.productService.getStats();
      
      return {
        success: true,
        data: stats
      };
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch product statistics'
      });
    }
  }

  /**
   * Register routes
   */
  static registerRoutes(server: any): void {
    const controller = new ProductController();

    // Public routes
    server.get('/api/products', controller.list.bind(controller));
    server.get('/api/products/featured', controller.getFeatured.bind(controller));
    server.get('/api/products/search', controller.search.bind(controller));
    server.get('/api/products/stats', controller.getStats.bind(controller));
    server.get('/api/products/:id', controller.get.bind(controller));
    server.get('/api/products/sku/:sku', controller.getBySku.bind(controller));
    server.get('/api/products/slug/:slug', controller.getBySlug.bind(controller));
    server.get('/api/products/:id/related', controller.getRelated.bind(controller));

    // Protected routes (require authentication)
    server.post('/api/products', 
      { preHandler: [requireAuth, requireRole('admin', 'manager')] }, 
      controller.create.bind(controller)
    );
    server.put('/api/products/:id', 
      { preHandler: [requireAuth, requireRole('admin', 'manager')] }, 
      controller.update.bind(controller)
    );
    server.delete('/api/products/:id', 
      { preHandler: [requireAuth, requireRole('admin')] }, 
      controller.delete.bind(controller)
    );
    server.post('/api/products/:id/images', 
      { preHandler: [requireAuth, requireRole('admin', 'manager')] }, 
      controller.uploadImages.bind(controller)
    );
    server.put('/api/products/:id/inventory', 
      { preHandler: [requireAuth, requireRole('admin', 'manager', 'staff')] }, 
      controller.updateInventory.bind(controller)
    );
    server.post('/api/products/bulk-inventory', 
      { preHandler: [requireAuth, requireRole('admin', 'manager')] }, 
      controller.bulkUpdateInventory.bind(controller)
    );
    server.put('/api/products/:id/status', 
      { preHandler: [requireAuth, requireRole('admin', 'manager')] }, 
      controller.updateStatus.bind(controller)
    );
    server.get('/api/products/low-stock', 
      { preHandler: [requireAuth, requireRole('admin', 'manager', 'staff')] }, 
      controller.getLowStock.bind(controller)
    );
  }
}