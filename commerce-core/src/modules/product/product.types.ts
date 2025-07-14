import type { IBaseEntity } from '@/types';

export enum ProductStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  OUT_OF_STOCK = 'out_of_stock',
  DISCONTINUED = 'discontinued',
}

export enum PriceType {
  FIXED = 'fixed',
  VARIABLE = 'variable',
  NEGOTIABLE = 'negotiable',
}

export interface IProductCategory extends IBaseEntity {
  name: string;
  name_ko: string;
  slug: string;
  slug_ko: string;
  description?: string;
  description_ko?: string;
  parentId?: string;
  parent?: IProductCategory;
  children?: IProductCategory[];
  imageUrl?: string;
  displayOrder: number;
  isActive: boolean;
  metadata?: Record<string, any>;
}

export interface IProduct extends IBaseEntity {
  // Basic Information
  sku: string;
  name: string;
  name_ko: string;
  description: string;
  description_ko: string;
  slug: string;
  
  // Korean-specific fields
  origin: string; // 원산지
  manufacturer: string; // 제조사
  expiryDays?: number; // 유통기한 (일수)
  
  // Categorization
  categoryId: string;
  category?: IProductCategory;
  tags?: string[];
  
  // Pricing
  priceType: PriceType;
  price: number;
  comparePrice?: number; // 할인 전 가격
  cost?: number; // 원가
  
  // Inventory
  trackInventory: boolean;
  quantity: number;
  lowStockThreshold?: number;
  allowBackorder: boolean;
  
  // Product Details
  weight?: number; // 무게 (그램)
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  
  // Media
  images: IProductImage[];
  featuredImage?: string;
  
  // Status & Visibility
  status: ProductStatus;
  isVisible: boolean;
  isFeatured: boolean;
  
  // SEO
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string[];
  
  // Additional Information
  attributes?: IProductAttribute[];
  variants?: IProductVariant[];
  relatedProductIds?: string[];
  
  // Statistics
  viewCount: number;
  salesCount: number;
  rating?: number;
  reviewCount: number;
  
  // Metadata
  metadata?: Record<string, any>;
}

export interface IProductImage {
  id: string;
  url: string;
  alt?: string;
  displayOrder: number;
  isMain: boolean;
}

export interface IProductAttribute {
  key: string;
  value: string;
  displayName?: string;
  displayName_ko?: string;
}

export interface IProductVariant extends IBaseEntity {
  productId: string;
  sku: string;
  name: string;
  price: number;
  quantity: number;
  attributes: IProductAttribute[];
  imageUrl?: string;
  isActive: boolean;
}

// DTOs
export interface CreateProductDto {
  sku: string;
  name: string;
  name_ko: string;
  description: string;
  description_ko: string;
  origin: string;
  manufacturer: string;
  expiryDays?: number;
  categoryId: string;
  price: number;
  comparePrice?: number;
  cost?: number;
  trackInventory?: boolean;
  quantity?: number;
  lowStockThreshold?: number;
  allowBackorder?: boolean;
  weight?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  status?: ProductStatus;
  isVisible?: boolean;
  isFeatured?: boolean;
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string[];
  tags?: string[];
  attributes?: IProductAttribute[];
  metadata?: Record<string, any>;
}

export interface UpdateProductDto extends Partial<CreateProductDto> {
  id: string;
}

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

export interface ProductFilterOptions {
  categoryId?: string;
  status?: ProductStatus;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  isFeatured?: boolean;
  tags?: string[];
  search?: string;
  origin?: string;
  manufacturer?: string;
}

export interface InventoryUpdateDto {
  productId: string;
  quantity: number;
  operation: 'add' | 'subtract' | 'set';
  reason?: string;
  metadata?: Record<string, any>;
}