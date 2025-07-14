import { BaseEntity } from '@/types/entities/base.entity';
import type { 
  IProduct, 
  IProductCategory, 
  ProductStatus, 
  PriceType,
  IProductImage,
  IProductAttribute,
  IProductVariant 
} from './product.types';

export class ProductCategory extends BaseEntity implements IProductCategory {
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
  displayOrder: number = 0;
  isActive: boolean = true;
  metadata?: Record<string, any>;

  constructor(data: Partial<IProductCategory>) {
    super();
    Object.assign(this, data);
  }
}

export class Product extends BaseEntity implements IProduct {
  // Basic Information
  sku: string;
  name: string;
  name_ko: string;
  description: string;
  description_ko: string;
  slug: string;
  
  // Korean-specific fields
  origin: string;
  manufacturer: string;
  expiryDays?: number;
  
  // Categorization
  categoryId: string;
  category?: IProductCategory;
  tags?: string[] = [];
  
  // Pricing
  priceType: PriceType = PriceType.FIXED;
  price: number = 0;
  comparePrice?: number;
  cost?: number;
  
  // Inventory
  trackInventory: boolean = true;
  quantity: number = 0;
  lowStockThreshold?: number = 10;
  allowBackorder: boolean = false;
  
  // Product Details
  weight?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  
  // Media
  images: IProductImage[] = [];
  featuredImage?: string;
  
  // Status & Visibility
  status: ProductStatus = ProductStatus.ACTIVE;
  isVisible: boolean = true;
  isFeatured: boolean = false;
  
  // SEO
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string[] = [];
  
  // Additional Information
  attributes?: IProductAttribute[] = [];
  variants?: IProductVariant[] = [];
  relatedProductIds?: string[] = [];
  
  // Statistics
  viewCount: number = 0;
  salesCount: number = 0;
  rating?: number;
  reviewCount: number = 0;
  
  // Metadata
  metadata?: Record<string, any>;

  constructor(data: Partial<IProduct>) {
    super();
    Object.assign(this, data);
  }

  // Helper methods
  isInStock(): boolean {
    return !this.trackInventory || this.quantity > 0 || this.allowBackorder;
  }

  canPurchase(requestedQuantity: number = 1): boolean {
    if (!this.trackInventory || this.allowBackorder) {
      return true;
    }
    return this.quantity >= requestedQuantity;
  }

  getDiscountPercentage(): number | null {
    if (!this.comparePrice || this.comparePrice <= this.price) {
      return null;
    }
    return Math.round(((this.comparePrice - this.price) / this.comparePrice) * 100);
  }

  isLowStock(): boolean {
    if (!this.trackInventory || !this.lowStockThreshold) {
      return false;
    }
    return this.quantity <= this.lowStockThreshold;
  }

  getMainImage(): string | null {
    const mainImage = this.images.find(img => img.isMain);
    return mainImage?.url || this.featuredImage || this.images[0]?.url || null;
  }

  // Database schema for SQL adapters
  static get schema() {
    return {
      tableName: 'products',
      columns: {
        id: { type: 'uuid', primary: true },
        sku: { type: 'string', unique: true, required: true },
        name: { type: 'string', required: true },
        name_ko: { type: 'string', required: true },
        description: { type: 'text', required: true },
        description_ko: { type: 'text', required: true },
        slug: { type: 'string', unique: true, required: true },
        origin: { type: 'string', required: true },
        manufacturer: { type: 'string', required: true },
        expiry_days: { type: 'integer', nullable: true },
        category_id: { type: 'uuid', required: true, foreign: 'categories.id' },
        price_type: { type: 'enum', values: ['fixed', 'variable', 'negotiable'], default: 'fixed' },
        price: { type: 'decimal', precision: 10, scale: 2, required: true },
        compare_price: { type: 'decimal', precision: 10, scale: 2, nullable: true },
        cost: { type: 'decimal', precision: 10, scale: 2, nullable: true },
        track_inventory: { type: 'boolean', default: true },
        quantity: { type: 'integer', default: 0 },
        low_stock_threshold: { type: 'integer', nullable: true },
        allow_backorder: { type: 'boolean', default: false },
        weight: { type: 'integer', nullable: true },
        dimensions: { type: 'json', nullable: true },
        images: { type: 'json', default: '[]' },
        featured_image: { type: 'string', nullable: true },
        status: { type: 'enum', values: ['active', 'inactive', 'out_of_stock', 'discontinued'], default: 'active' },
        is_visible: { type: 'boolean', default: true },
        is_featured: { type: 'boolean', default: false },
        meta_title: { type: 'string', nullable: true },
        meta_description: { type: 'text', nullable: true },
        meta_keywords: { type: 'json', default: '[]' },
        tags: { type: 'json', default: '[]' },
        attributes: { type: 'json', default: '[]' },
        related_product_ids: { type: 'json', default: '[]' },
        view_count: { type: 'integer', default: 0 },
        sales_count: { type: 'integer', default: 0 },
        rating: { type: 'decimal', precision: 3, scale: 2, nullable: true },
        review_count: { type: 'integer', default: 0 },
        metadata: { type: 'json', nullable: true },
        created_at: { type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        updated_at: { type: 'timestamp', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' }
      },
      indexes: [
        { columns: ['sku'] },
        { columns: ['slug'] },
        { columns: ['category_id'] },
        { columns: ['status'] },
        { columns: ['price'] },
        { columns: ['created_at'] },
        { columns: ['name'], type: 'fulltext' },
        { columns: ['name_ko'], type: 'fulltext' }
      ]
    };
  }
}

export class ProductCategorySchema {
  static get schema() {
    return {
      tableName: 'product_categories',
      columns: {
        id: { type: 'uuid', primary: true },
        name: { type: 'string', required: true },
        name_ko: { type: 'string', required: true },
        slug: { type: 'string', unique: true, required: true },
        slug_ko: { type: 'string', unique: true, required: true },
        description: { type: 'text', nullable: true },
        description_ko: { type: 'text', nullable: true },
        parent_id: { type: 'uuid', nullable: true, foreign: 'product_categories.id' },
        image_url: { type: 'string', nullable: true },
        display_order: { type: 'integer', default: 0 },
        is_active: { type: 'boolean', default: true },
        metadata: { type: 'json', nullable: true },
        created_at: { type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        updated_at: { type: 'timestamp', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' }
      },
      indexes: [
        { columns: ['slug'] },
        { columns: ['slug_ko'] },
        { columns: ['parent_id'] },
        { columns: ['display_order'] },
        { columns: ['name'], type: 'fulltext' },
        { columns: ['name_ko'], type: 'fulltext' }
      ]
    };
  }
}

export class ProductVariantSchema {
  static get schema() {
    return {
      tableName: 'product_variants',
      columns: {
        id: { type: 'uuid', primary: true },
        product_id: { type: 'uuid', required: true, foreign: 'products.id' },
        sku: { type: 'string', unique: true, required: true },
        name: { type: 'string', required: true },
        price: { type: 'decimal', precision: 10, scale: 2, required: true },
        quantity: { type: 'integer', default: 0 },
        attributes: { type: 'json', default: '[]' },
        image_url: { type: 'string', nullable: true },
        is_active: { type: 'boolean', default: true },
        created_at: { type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        updated_at: { type: 'timestamp', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' }
      },
      indexes: [
        { columns: ['product_id'] },
        { columns: ['sku'] },
        { columns: ['is_active'] }
      ]
    };
  }
}