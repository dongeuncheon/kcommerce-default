import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { categoryService } from '../../services/categoryService';

// Validation schemas
const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  description: z.string().optional(),
  image: z.string().url().optional(),
  parentId: z.string().optional(),
  sortOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

const updateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().optional(),
  image: z.string().url().optional().nullable(),
  parentId: z.string().optional().nullable(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

const reorderCategoriesSchema = z.array(
  z.object({
    id: z.string(),
    sortOrder: z.number().int().min(0),
  })
);

export class CategoryController {
  /**
   * Create a new category
   */
  async createCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validatedData = createCategorySchema.parse(req.body);

      const category = await categoryService.createCategory(validatedData);

      res.status(201).json({
        success: true,
        data: category,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors,
        });
      } else {
        next(error);
      }
    }
  }

  /**
   * Get all categories
   */
  async getCategories(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const includeInactive = req.query.includeInactive === 'true';
      const categories = await categoryService.getAllCategories(includeInactive);

      res.json({
        success: true,
        data: categories,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get category by ID
   */
  async getCategoryById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const category = await categoryService.getCategoryById(id);

      if (!category) {
        res.status(404).json({
          success: false,
          error: 'Category not found',
        });
        return;
      }

      res.json({
        success: true,
        data: category,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get category by slug
   */
  async getCategoryBySlug(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { slug } = req.params;
      const category = await categoryService.getCategoryBySlug(slug);

      if (!category) {
        res.status(404).json({
          success: false,
          error: 'Category not found',
        });
        return;
      }

      res.json({
        success: true,
        data: category,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update category
   */
  async updateCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const validatedData = updateCategorySchema.parse(req.body);

      const category = await categoryService.updateCategory(id, validatedData);

      res.json({
        success: true,
        data: category,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors,
        });
      } else if (error instanceof Error && error.message.includes('Circular reference')) {
        res.status(400).json({
          success: false,
          error: error.message,
        });
      } else {
        next(error);
      }
    }
  }

  /**
   * Delete category
   */
  async deleteCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      await categoryService.deleteCategory(id);

      res.json({
        success: true,
        message: 'Category deleted successfully',
      });
    } catch (error) {
      if (error instanceof Error && 
          (error.message.includes('Cannot delete category with children') ||
           error.message.includes('Cannot delete category with products'))) {
        res.status(400).json({
          success: false,
          error: error.message,
        });
      } else {
        next(error);
      }
    }
  }

  /**
   * Get category tree
   */
  async getCategoryTree(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const tree = await categoryService.getCategoryTree(id);

      if (!tree) {
        res.status(404).json({
          success: false,
          error: 'Category not found',
        });
        return;
      }

      res.json({
        success: true,
        data: tree,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get category breadcrumb
   */
  async getCategoryBreadcrumb(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const breadcrumb = await categoryService.getCategoryBreadcrumb(id);

      res.json({
        success: true,
        data: breadcrumb,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Search categories
   */
  async searchCategories(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { q } = req.query;
      
      if (!q || typeof q !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Query parameter "q" is required',
        });
        return;
      }

      const categories = await categoryService.searchCategories(q);

      res.json({
        success: true,
        data: categories,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get categories by tag
   */
  async getCategoriesByTag(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { tagId } = req.params;
      const categories = await categoryService.getCategoriesByTag(tagId);

      res.json({
        success: true,
        data: categories,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Reorder categories
   */
  async reorderCategories(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validatedData = reorderCategoriesSchema.parse(req.body);
      await categoryService.reorderCategories(validatedData);

      res.json({
        success: true,
        message: 'Categories reordered successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors,
        });
      } else {
        next(error);
      }
    }
  }
}

export const categoryController = new CategoryController();