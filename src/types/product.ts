import { z } from 'zod'

/**
 * @swagger
 * components:
 *   schemas:
 *     Product:
 *       type: object
 *       required:
 *         - id
 *         - name
 *         - sku
 *         - price
 *         - status
 *       properties:
 *         id:
 *           type: string
 *           description: Unique product identifier
 *           example: "prod_123456789"
 *         name:
 *           type: string
 *           description: Product name
 *           example: "Premium Wireless Headphones"
 *           maxLength: 255
 *         slug:
 *           type: string
 *           description: URL-friendly product identifier
 *           example: "premium-wireless-headphones"
 *           maxLength: 255
 *         description:
 *           type: string
 *           description: Detailed product description
 *           example: "High-quality wireless headphones with noise cancellation"
 *         shortDescription:
 *           type: string
 *           description: Brief product description
 *           example: "Wireless headphones with noise cancellation"
 *           maxLength: 500
 *         sku:
 *           type: string
 *           description: Stock Keeping Unit
 *           example: "WH-1000XM4"
 *           maxLength: 100
 *         status:
 *           type: string
 *           enum: [DRAFT, PUBLISHED, ARCHIVED]
 *           description: Product status
 *           example: "PUBLISHED"
 *         type:
 *           type: string
 *           enum: [SIMPLE, VARIABLE, GROUPED, EXTERNAL]
 *           description: Product type
 *           example: "SIMPLE"
 *         price:
 *           type: number
 *           format: decimal
 *           description: Product price
 *           example: 299.99
 *           minimum: 0
 *         comparePrice:
 *           type: number
 *           format: decimal
 *           description: Compare at price (MSRP)
 *           example: 399.99
 *           minimum: 0
 *         costPrice:
 *           type: number
 *           format: decimal
 *           description: Cost price for profit calculations
 *           example: 150.00
 *           minimum: 0
 *         trackQuantity:
 *           type: boolean
 *           description: Whether to track inventory quantity
 *           example: true
 *         quantity:
 *           type: integer
 *           description: Current stock quantity
 *           example: 50
 *           minimum: 0
 *         lowStockThreshold:
 *           type: integer
 *           description: Threshold for low stock alerts
 *           example: 5
 *           minimum: 0
 *         allowBackorders:
 *           type: boolean
 *           description: Allow orders when out of stock
 *           example: false
 *         weight:
 *           type: number
 *           format: decimal
 *           description: Product weight in grams
 *           example: 250.5
 *           minimum: 0
 *         length:
 *           type: number
 *           format: decimal
 *           description: Product length in centimeters
 *           example: 15.5
 *           minimum: 0
 *         width:
 *           type: number
 *           format: decimal
 *           description: Product width in centimeters
 *           example: 10.2
 *           minimum: 0
 *         height:
 *           type: number
 *           format: decimal
 *           description: Product height in centimeters
 *           example: 8.0
 *           minimum: 0
 *         metaTitle:
 *           type: string
 *           description: SEO meta title
 *           example: "Premium Wireless Headphones | Best Audio Quality"
 *           maxLength: 255
 *         metaDescription:
 *           type: string
 *           description: SEO meta description
 *           example: "Experience superior sound quality with our premium wireless headphones featuring active noise cancellation."
 *           maxLength: 500
 *         focusKeyword:
 *           type: string
 *           description: Primary SEO keyword
 *           example: "wireless headphones"
 *           maxLength: 100
 *         isFeatured:
 *           type: boolean
 *           description: Whether product is featured
 *           example: true
 *         isDigital:
 *           type: boolean
 *           description: Whether product is digital
 *           example: false
 *         requiresShipping:
 *           type: boolean
 *           description: Whether product requires shipping
 *           example: true
 *         categoryId:
 *           type: string
 *           description: Associated category ID
 *           example: "cat_electronics"
 *         category:
 *           $ref: '#/components/schemas/Category'
 *         images:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ProductImage'
 *         variants:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ProductVariant'
 *         attributes:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ProductAttribute'
 *         tags:
 *           type: array
 *           items:
 *             type: string
 *           example: ["electronics", "audio", "wireless"]
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Product creation timestamp
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Last update timestamp
 *     ProductImage:
 *       type: object
 *       required:
 *         - id
 *         - url
 *       properties:
 *         id:
 *           type: string
 *           description: Image identifier
 *         url:
 *           type: string
 *           format: uri
 *           description: Image URL
 *           example: "https://cdn.example.com/images/headphones-1.jpg"
 *         alt:
 *           type: string
 *           description: Alt text for accessibility
 *           example: "Premium wireless headphones in black"
 *         sortOrder:
 *           type: integer
 *           description: Display order
 *           example: 1
 *           minimum: 0
 *         isMain:
 *           type: boolean
 *           description: Whether this is the primary image
 *           example: true
 *     ProductVariant:
 *       type: object
 *       required:
 *         - id
 *         - name
 *         - sku
 *         - price
 *       properties:
 *         id:
 *           type: string
 *           description: Variant identifier
 *         name:
 *           type: string
 *           description: Variant name
 *           example: "Black - Large"
 *         sku:
 *           type: string
 *           description: Variant SKU
 *           example: "WH-1000XM4-BLK-L"
 *         price:
 *           type: number
 *           format: decimal
 *           description: Variant price
 *           example: 299.99
 *         comparePrice:
 *           type: number
 *           format: decimal
 *           description: Variant compare price
 *           example: 399.99
 *         quantity:
 *           type: integer
 *           description: Variant stock quantity
 *           example: 25
 *         attributes:
 *           type: object
 *           description: Variant-specific attributes
 *           example:
 *             color: "Black"
 *             size: "Large"
 *         isActive:
 *           type: boolean
 *           description: Whether variant is active
 *           example: true
 *     ProductAttribute:
 *       type: object
 *       required:
 *         - name
 *         - value
 *       properties:
 *         name:
 *           type: string
 *           description: Attribute name
 *           example: "Brand"
 *         value:
 *           type: string
 *           description: Attribute value
 *           example: "Sony"
 *     Category:
 *       type: object
 *       required:
 *         - id
 *         - name
 *       properties:
 *         id:
 *           type: string
 *           description: Category identifier
 *         name:
 *           type: string
 *           description: Category name
 *           example: "Electronics"
 *         slug:
 *           type: string
 *           description: Category slug
 *           example: "electronics"
 */

// Product status enum
export const ProductStatusEnum = z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED'])
export type ProductStatus = z.infer<typeof ProductStatusEnum>

// Product type enum
export const ProductTypeEnum = z.enum(['SIMPLE', 'VARIABLE', 'GROUPED', 'EXTERNAL'])
export type ProductType = z.infer<typeof ProductTypeEnum>

// Base product validation schema
export const CreateProductSchema = z.object({
  name: z.string().min(1, 'Product name is required').max(255),
  slug: z.string().min(1, 'Product slug is required').max(255).optional(),
  description: z.string().optional(),
  shortDescription: z.string().max(500).optional(),
  sku: z.string().min(1, 'SKU is required').max(100),
  status: ProductStatusEnum.default('DRAFT'),
  type: ProductTypeEnum.default('SIMPLE'),

  // Pricing
  price: z.number().positive('Price must be positive'),
  comparePrice: z.number().positive().optional(),
  costPrice: z.number().positive().optional(),

  // Inventory
  trackQuantity: z.boolean().default(true),
  quantity: z.number().int().min(0).default(0),
  lowStockThreshold: z.number().int().min(0).default(5),
  allowBackorders: z.boolean().default(false),

  // Physical properties
  weight: z.number().positive().optional(),
  length: z.number().positive().optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),

  // SEO
  metaTitle: z.string().max(255).optional(),
  metaDescription: z.string().max(500).optional(),
  focusKeyword: z.string().max(100).optional(),

  // Flags
  isFeatured: z.boolean().default(false),
  isDigital: z.boolean().default(false),
  requiresShipping: z.boolean().default(true),

  // Relations
  categoryId: z.string().cuid().optional(),

  // Images (array of image objects)
  images: z.array(z.object({
    url: z.string().url(),
    alt: z.string().optional(),
    sortOrder: z.number().int().min(0).default(0),
    isMain: z.boolean().default(false),
  })).optional(),

  // Variants
  variants: z.array(z.object({
    name: z.string().min(1),
    sku: z.string().min(1),
    price: z.number().positive(),
    comparePrice: z.number().positive().optional(),
    quantity: z.number().int().min(0).default(0),
    attributes: z.record(z.any()),
    isActive: z.boolean().default(true),
  })).optional(),

  // Attributes
  attributes: z.array(z.object({
    name: z.string().min(1),
    value: z.string().min(1),
  })).optional(),

  // Tags
  tags: z.array(z.string()).optional(),
})

export const UpdateProductSchema = CreateProductSchema.partial().extend({
  id: z.string().cuid(),
})

export const ProductQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().min(1)).default('1'),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).default('10'),
  sortBy: z.enum(['name', 'price', 'createdAt', 'updatedAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  status: ProductStatusEnum.optional(),
  categoryId: z.string().cuid().optional(),
  search: z.string().optional(),
  minPrice: z.string().transform(Number).pipe(z.number().positive()).optional(),
  maxPrice: z.string().transform(Number).pipe(z.number().positive()).optional(),
  isFeatured: z.string().transform(val => val === 'true').optional(),
  inStock: z.string().transform(val => val === 'true').optional(),
})

export const ProductParamsSchema = z.object({
  id: z.string().cuid('Invalid product ID'),
})

// Image upload schema
export const ProductImageSchema = z.object({
  alt: z.string().optional(),
  sortOrder: z.string().transform(Number).pipe(z.number().int().min(0)).default('0'),
  isMain: z.string().transform(val => val === 'true').default('false'),
})

// Variant schema
export const ProductVariantSchema = z.object({
  name: z.string().min(1, 'Variant name is required'),
  sku: z.string().min(1, 'Variant SKU is required'),
  price: z.number().positive('Variant price must be positive'),
  comparePrice: z.number().positive().optional(),
  quantity: z.number().int().min(0).default(0),
  attributes: z.record(z.any()),
  isActive: z.boolean().default(true),
})

export const CreateProductVariantSchema = ProductVariantSchema.extend({
  productId: z.string().cuid(),
})

export const UpdateProductVariantSchema = ProductVariantSchema.partial().extend({
  id: z.string().cuid(),
})

// Inventory adjustment schema
export const InventoryAdjustmentSchema = z.object({
  productId: z.string().cuid(),
  quantity: z.number().int(),
  type: z.enum(['SALE', 'PURCHASE', 'ADJUSTMENT', 'RETURN', 'DAMAGE', 'RESTOCK']),
  reason: z.string().optional(),
  reference: z.string().optional(),
})

// Response types
export type CreateProductInput = z.infer<typeof CreateProductSchema>
export type UpdateProductInput = z.infer<typeof UpdateProductSchema>
export type ProductQueryInput = z.infer<typeof ProductQuerySchema>
export type ProductParamsInput = z.infer<typeof ProductParamsSchema>
export type ProductImageInput = z.infer<typeof ProductImageSchema>
export type CreateProductVariantInput = z.infer<typeof CreateProductVariantSchema>
export type UpdateProductVariantInput = z.infer<typeof UpdateProductVariantSchema>
export type InventoryAdjustmentInput = z.infer<typeof InventoryAdjustmentSchema>
