import { Category, Product } from '@prisma/client'

export interface CategoryWithRelations extends Category {
  parent?: Category | null;
  children?: CategoryWithRelations[];
  products?: Product[];
  _count?: {
    products: number;
    children: number;
  };
}

export interface CreateCategoryDto {
  name: string;
  slug: string;
  description?: string;
  image?: string;
  parentId?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export interface UpdateCategoryDto {
  name?: string;
  slug?: string;
  description?: string;
  image?: string;
  parentId?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

export interface CategoryTreeNode {
  id: string;
  name: string;
  slug: string;
  level: number;
  path: string[];
  children: CategoryTreeNode[];
  productCount?: number;
}

export interface CategoryFilterOptions {
  isActive?: boolean;
  parentId?: string | null;
  search?: string;
  includeChildren?: boolean;
  includeProducts?: boolean;
  includeCount?: boolean;
}

export interface ReorderCategoryDto {
  id: string;
  sortOrder: number;
}
