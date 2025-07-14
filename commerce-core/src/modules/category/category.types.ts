import type { IBaseEntity } from '@/types';
import type { IProductCategory } from '../product/product.types';

// Re-export IProductCategory for convenience
export type { IProductCategory };

export interface ICategoryTreeNode extends IProductCategory {
  children: ICategoryTreeNode[];
  productCount?: number;
}

export interface CategoryStats {
  totalCategories: number;
  activeCategories: number;
  rootCategories: number;
  totalProducts: number;
}

// DTOs
export interface CreateCategoryDto {
  name: string;
  name_ko: string;
  slug: string;
  slug_ko: string;
  description?: string;
  description_ko?: string;
  parentId?: string;
  imageUrl?: string;
  displayOrder?: number;
  isActive?: boolean;
  metadata?: Record<string, any>;
}

export interface UpdateCategoryDto extends Partial<CreateCategoryDto> {
  id: string;
}

export interface CategoryFilterOptions {
  parentId?: string;
  isActive?: boolean;
  search?: string;
}

export interface ReorderCategoryDto {
  id: string;
  order: number;
}

export interface MoveCategoryDto {
  categoryId: string;
  newParentId: string | null;
}