import { z } from 'zod'

// Product Option Type Enum
export const ProductOptionTypeSchema = z.enum([
  'SELECT',
  'RADIO',
  'CHECKBOX',
  'TEXT',
  'TEXTAREA',
  'NUMBER',
  'COLOR',
  'DATE',
  'FILE',
  'RANGE',
])

// Product Option Value Schema
export const ProductOptionValueSchema = z.object({
  id: z.string().cuid().optional(),
  value: z.string().min(1, 'Value is required'),
  displayValue: z.string().min(1, 'Display value is required'),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
  priceAdjustment: z.number().optional(),
  sku: z.string().optional(),
  image: z.string().url().optional(),
  hexColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  description: z.string().optional(),
})

// Product Option Schema
export const ProductOptionSchema = z.object({
  id: z.string().cuid().optional(),
  productId: z.string().cuid('Invalid product ID'),
  name: z.string().min(1, 'Option name is required'),
  displayName: z.string().min(1, 'Display name is required'),
  type: ProductOptionTypeSchema.default('SELECT'),
  isRequired: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
  config: z.record(z.any()).optional(),
  values: z.array(ProductOptionValueSchema).optional(),
})

// Create Product Option Schema
export const CreateProductOptionSchema = z.object({
  productId: z.string().cuid('Invalid product ID'),
  name: z.string().min(1, 'Option name is required'),
  displayName: z.string().min(1, 'Display name is required'),
  type: ProductOptionTypeSchema.default('SELECT'),
  isRequired: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
  config: z.record(z.any()).optional(),
  values: z.array(ProductOptionValueSchema.omit({ id: true })).min(1, 'At least one option value is required'),
})

// Update Product Option Schema
export const UpdateProductOptionSchema = z.object({
  name: z.string().min(1).optional(),
  displayName: z.string().min(1).optional(),
  type: ProductOptionTypeSchema.optional(),
  isRequired: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
  config: z.record(z.any()).optional(),
})

// Selected Product Options Schema (for cart/order)
export const SelectedProductOptionsSchema = z.record(
  z.string(), // option name/id
  z.union([
    z.string(),           // Single value selection
    z.array(z.string()),  // Multiple value selection
    z.number(),           // Number input
    z.boolean(),           // Checkbox
  ]),
)

// Cart Item with Options Schema
export const CartItemWithOptionsSchema = z.object({
  productId: z.string().cuid('Invalid product ID'),
  variantId: z.string().cuid().optional(),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  options: SelectedProductOptionsSchema.optional(),
})

// Product Option Validation Schema
export const ValidateProductOptionsSchema = z.object({
  productId: z.string().cuid('Invalid product ID'),
  selectedOptions: SelectedProductOptionsSchema,
})

// Option Configuration Schemas for different types
export const SelectOptionConfigSchema = z.object({
  multiSelect: z.boolean().default(false),
  maxSelections: z.number().int().min(1).optional(),
})

export const NumberOptionConfigSchema = z.object({
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().positive().optional(),
  unit: z.string().optional(), // e.g., "cm", "kg", "inches"
})

export const TextOptionConfigSchema = z.object({
  minLength: z.number().int().min(0).optional(),
  maxLength: z.number().int().min(1).optional(),
  placeholder: z.string().optional(),
  pattern: z.string().optional(), // regex pattern
})

export const FileOptionConfigSchema = z.object({
  allowedTypes: z.array(z.string()).optional(), // MIME types
  maxSize: z.number().int().positive().optional(), // bytes
  maxFiles: z.number().int().positive().default(1),
})

export const RangeOptionConfigSchema = z.object({
  min: z.number(),
  max: z.number(),
  step: z.number().positive().default(1),
  unit: z.string().optional(),
})

// Response Types
export type ProductOptionType = z.infer<typeof ProductOptionTypeSchema>
export type ProductOptionValue = z.infer<typeof ProductOptionValueSchema>
export type ProductOption = z.infer<typeof ProductOptionSchema>
export type CreateProductOptionInput = z.infer<typeof CreateProductOptionSchema>
export type UpdateProductOptionInput = z.infer<typeof UpdateProductOptionSchema>
export type SelectedProductOptions = z.infer<typeof SelectedProductOptionsSchema>
export type CartItemWithOptions = z.infer<typeof CartItemWithOptionsSchema>
export type ValidateProductOptionsInput = z.infer<typeof ValidateProductOptionsSchema>

// Option Configuration Types
export type SelectOptionConfig = z.infer<typeof SelectOptionConfigSchema>
export type NumberOptionConfig = z.infer<typeof NumberOptionConfigSchema>
export type TextOptionConfig = z.infer<typeof TextOptionConfigSchema>
export type FileOptionConfig = z.infer<typeof FileOptionConfigSchema>
export type RangeOptionConfig = z.infer<typeof RangeOptionConfigSchema>

// Extended Product with Options
export interface ProductWithOptions {
  id: string
  name: string
  slug: string
  sku: string
  price: number
  comparePrice?: number
  status: string
  type: string
  description?: string
  images: Array<{
    id: string
    url: string
    alt?: string
    isMain: boolean
  }>
  variants: Array<{
    id: string
    name: string
    sku: string
    price: number
    attributes: Record<string, any>
    quantity: number
  }>
  options: Array<{
    id: string
    name: string
    displayName: string
    type: ProductOptionType
    isRequired: boolean
    sortOrder: number
    config?: Record<string, any>
    values: Array<{
      id: string
      value: string
      displayValue: string
      priceAdjustment?: number
      sku?: string
      image?: string
      hexColor?: string
      description?: string
    }>
  }>
  category?: {
    id: string
    name: string
    slug: string
  }
}

// Option Validation Result
export interface OptionValidationResult {
  isValid: boolean
  errors: Array<{
    optionName: string
    message: string
    code: string
  }>
  warnings: Array<{
    optionName: string
    message: string
  }>
}

// Price Calculation Result with Options
export interface OptionPriceCalculation {
  basePrice: number
  optionAdjustments: Record<string, number>
  totalAdjustment: number
  finalPrice: number
  breakdown: Array<{
    optionName: string
    optionValue: string
    adjustment: number
  }>
}

// Option Display Configuration
export interface OptionDisplayConfig {
  showPriceAdjustment: boolean
  showImages: boolean
  showDescriptions: boolean
  groupSimilarOptions: boolean
  sortBy: 'sortOrder' | 'name' | 'price'
  layout: 'grid' | 'list' | 'inline'
}

// Bulk Option Operations
export const BulkOptionOperationSchema = z.object({
  operation: z.enum(['create', 'update', 'delete', 'reorder']),
  options: z.array(z.union([
    CreateProductOptionSchema,
    ProductOptionSchema.extend({
      id: z.string().cuid(),
    }),
  ])),
})

export type BulkOptionOperation = z.infer<typeof BulkOptionOperationSchema>

// Option Templates for common use cases
export interface OptionTemplate {
  id: string
  name: string
  description: string
  category: string
  options: Array<Omit<CreateProductOptionInput, 'productId'>>
}

// Common option templates
export const OPTION_TEMPLATES: OptionTemplate[] = [
  {
    id: 'clothing-basic',
    name: 'Basic Clothing Options',
    description: 'Standard size and color options for clothing',
    category: 'Clothing',
    options: [
      {
        name: 'size',
        displayName: 'Size',
        type: 'SELECT',
        isRequired: true,
        sortOrder: 1,
        values: [
          { value: 'xs', displayValue: 'Extra Small (XS)', sortOrder: 1, isActive: true },
          { value: 's', displayValue: 'Small (S)', sortOrder: 2, isActive: true },
          { value: 'm', displayValue: 'Medium (M)', sortOrder: 3, isActive: true },
          { value: 'l', displayValue: 'Large (L)', sortOrder: 4, isActive: true },
          { value: 'xl', displayValue: 'Extra Large (XL)', sortOrder: 5, isActive: true },
        ],
      },
      {
        name: 'color',
        displayName: 'Color',
        type: 'COLOR',
        isRequired: true,
        sortOrder: 2,
        values: [
          { value: 'black', displayValue: 'Black', hexColor: '#000000', sortOrder: 1, isActive: true },
          { value: 'white', displayValue: 'White', hexColor: '#FFFFFF', sortOrder: 2, isActive: true },
          { value: 'red', displayValue: 'Red', hexColor: '#FF0000', sortOrder: 3, isActive: true },
          { value: 'blue', displayValue: 'Blue', hexColor: '#0000FF', sortOrder: 4, isActive: true },
        ],
      },
    ],
  },
  {
    id: 'electronics-basic',
    name: 'Basic Electronics Options',
    description: 'Standard options for electronic products',
    category: 'Electronics',
    options: [
      {
        name: 'storage',
        displayName: 'Storage Capacity',
        type: 'SELECT',
        isRequired: true,
        sortOrder: 1,
        values: [
          { value: '64gb', displayValue: '64 GB', priceAdjustment: 0, sortOrder: 1, isActive: true },
          { value: '128gb', displayValue: '128 GB', priceAdjustment: 50, sortOrder: 2, isActive: true },
          { value: '256gb', displayValue: '256 GB', priceAdjustment: 100, sortOrder: 3, isActive: true },
          { value: '512gb', displayValue: '512 GB', priceAdjustment: 200, sortOrder: 4, isActive: true },
        ],
      },
      {
        name: 'warranty',
        displayName: 'Extended Warranty',
        type: 'SELECT',
        isRequired: false,
        sortOrder: 2,
        values: [
          { value: 'none', displayValue: 'No Extended Warranty', priceAdjustment: 0, sortOrder: 1, isActive: true },
          { value: '1year', displayValue: '1 Year Extended Warranty', priceAdjustment: 99, sortOrder: 2, isActive: true },
          { value: '2year', displayValue: '2 Year Extended Warranty', priceAdjustment: 179, sortOrder: 3, isActive: true },
        ],
      },
    ],
  },
]
