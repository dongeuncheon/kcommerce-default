import { Prisma, Product, ProductImage, ProductVariant, ProductAttribute, ProductTag } from '@prisma/client'
import { prisma } from '../utils/database'
import { logger } from '../utils/logger'
import { AppError } from '../middleware/error'
import { seoService } from './seoService'
import {
  CreateProductInput,
  UpdateProductInput,
  ProductQueryInput,
  InventoryAdjustmentInput,
} from '../types/product'

// Type for product with all relations
type ProductWithRelations = Product & {
  category?: { id: string; name: string; slug: string } | null
  images: ProductImage[]
  variants: ProductVariant[]
  attributes: ProductAttribute[]
  tags: (ProductTag & { tag: { id: string; name: string; slug: string } })[]
  _count?: {
    reviews: number
    orderItems: number
  }
}

export class ProductService {

  // Create a new product
  async createProduct(data: CreateProductInput): Promise<ProductWithRelations> {
    try {
      // Get existing slugs to ensure uniqueness
      const existingProducts = await prisma.product.findMany({
        select: { slug: true },
      })
      const existingSlugs = existingProducts.map(p => p.slug)

      // Get category name for SEO
      let categoryName: string | undefined
      if (data.categoryId) {
        const category = await prisma.category.findUnique({
          where: { id: data.categoryId },
          select: { name: true },
        })
        categoryName = category?.name
      }

      // Generate SEO data if not provided
      const seoData = seoService.generateProductSEO(
        data.name,
        data.description || undefined,
        categoryName,
        typeof data.price === 'number' ? data.price : Number(data.price),
        existingSlugs,
      )

      // Use provided SEO data or generated fallbacks
      const slug = data.slug || seoData.slug
      const metaTitle = data.metaTitle || seoData.metaTitle
      const metaDescription = data.metaDescription || seoData.metaDescription
      const focusKeyword = data.focusKeyword || seoData.focusKeyword

      // Validate SEO data
      const validation = seoService.validateSEOData({
        slug,
        metaTitle,
        metaDescription,
        focusKeyword,
      })

      if (!validation.isValid) {
        throw new AppError(`SEO validation failed: ${validation.errors.join(', ')}`, 400)
      }

      // Check if slug already exists
      const existingProduct = await prisma.product.findUnique({
        where: { slug },
      })

      if (existingProduct) {
        throw new AppError('Product with this slug already exists', 409)
      }

      // Check if SKU already exists
      const existingSku = await prisma.product.findUnique({
        where: { sku: data.sku },
      })

      if (existingSku) {
        throw new AppError('Product with this SKU already exists', 409)
      }

      // Verify category exists if provided
      if (data.categoryId) {
        const category = await prisma.category.findUnique({
          where: { id: data.categoryId },
        })

        if (!category) {
          throw new AppError('Category not found', 404)
        }
      }

      const product = await prisma.$transaction(async (tx) => {
        // Create the main product
        const createdProduct = await tx.product.create({
          data: {
            name: data.name,
            slug,
            description: data.description,
            shortDescription: data.shortDescription,
            sku: data.sku,
            status: data.status,
            type: data.type,
            price: data.price,
            comparePrice: data.comparePrice,
            costPrice: data.costPrice,
            trackQuantity: data.trackQuantity,
            quantity: data.quantity,
            lowStockThreshold: data.lowStockThreshold,
            allowBackorders: data.allowBackorders,
            weight: data.weight || undefined,
            length: data.length || undefined,
            width: data.width || undefined,
            height: data.height || undefined,
            metaTitle,
            metaDescription,
            focusKeyword,
            isFeatured: data.isFeatured,
            isDigital: data.isDigital,
            requiresShipping: data.requiresShipping,
            categoryId: data.categoryId,
            publishedAt: data.status === 'PUBLISHED' ? new Date() : null,
          },
        })

        // Create images if provided
        if (data.images && data.images.length > 0) {
          await tx.productImage.createMany({
            data: data.images.map((image, index) => ({
              productId: createdProduct.id,
              url: image.url,
              alt: image.alt,
              sortOrder: image.sortOrder || index,
              isMain: image.isMain || index === 0,
            })),
          })
        }

        // Create variants if provided
        if (data.variants && data.variants.length > 0) {
          for (const variant of data.variants) {
            // Check if variant SKU already exists
            const existingVariantSku = await tx.productVariant.findUnique({
              where: { sku: variant.sku },
            })

            if (existingVariantSku) {
              throw new AppError(`Variant SKU ${variant.sku} already exists`, 409)
            }

            await tx.productVariant.create({
              data: {
                productId: createdProduct.id,
                name: variant.name,
                sku: variant.sku,
                price: variant.price,
                comparePrice: variant.comparePrice,
                quantity: variant.quantity,
                attributes: variant.attributes,
                isActive: variant.isActive,
              },
            })
          }
        }

        // Create attributes if provided
        if (data.attributes && data.attributes.length > 0) {
          await tx.productAttribute.createMany({
            data: data.attributes.map((attr) => ({
              productId: createdProduct.id,
              name: attr.name,
              value: attr.value,
            })),
          })
        }

        // Handle tags if provided
        if (data.tags && data.tags.length > 0) {
          for (const tagName of data.tags) {
            // Find or create tag
            const tag = await tx.tag.upsert({
              where: { slug: this.generateSlug(tagName) },
              update: {},
              create: {
                name: tagName,
                slug: this.generateSlug(tagName),
              },
            })

            // Create product-tag relation
            await tx.productTag.create({
              data: {
                productId: createdProduct.id,
                tagId: tag.id,
              },
            })
          }
        }

        return createdProduct
      })

      // Log inventory if tracking quantity
      if (data.trackQuantity && data.quantity > 0) {
        await this.logInventoryChange({
          productId: product.id,
          quantity: data.quantity,
          type: 'RESTOCK',
          reason: 'Initial stock',
        })
      }

      logger.info(`Product created: ${product.id}`)
      return this.getProductById(product.id)
    } catch (error) {
      logger.error('Error creating product:', error)
      throw error
    }
  }

  // Get product by ID with all relations
  async getProductById(id: string): Promise<ProductWithRelations> {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: {
          select: { id: true, name: true, slug: true },
        },
        images: {
          orderBy: { sortOrder: 'asc' },
        },
        variants: {
          where: { isActive: true },
          orderBy: { createdAt: 'asc' },
        },
        attributes: true,
        tags: {
          include: {
            tag: {
              select: { id: true, name: true, slug: true },
            },
          },
        },
        _count: {
          select: {
            reviews: true,
            orderItems: true,
          },
        },
      },
    })

    if (!product) {
      throw new AppError('Product not found', 404)
    }

    return product
  }

  // Get products with pagination and filtering
  async getProducts(query: ProductQueryInput): Promise<{
    products: ProductWithRelations[]
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
    }
  }> {
    const {
      page,
      limit,
      sortBy,
      sortOrder,
      status,
      categoryId,
      search,
      minPrice,
      maxPrice,
      isFeatured,
      inStock,
    } = query

    // Build where clause
    const where: Prisma.ProductWhereInput = {}

    if (status) {
      where.status = status
    }

    if (categoryId) {
      where.categoryId = categoryId
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      where.price = {}
      if (minPrice !== undefined) where.price.gte = minPrice
      if (maxPrice !== undefined) where.price.lte = maxPrice
    }

    if (isFeatured !== undefined) {
      where.isFeatured = isFeatured
    }

    if (inStock !== undefined && inStock) {
      where.quantity = { gt: 0 }
    }

    // Build order by
    const orderBy: Prisma.ProductOrderByWithRelationInput = {}
    orderBy[sortBy] = sortOrder

    const skip = (page - 1) * limit

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          category: {
            select: { id: true, name: true, slug: true },
          },
          images: {
            orderBy: { sortOrder: 'asc' },
          },
          variants: {
            where: { isActive: true },
            orderBy: { createdAt: 'asc' },
          },
          attributes: true,
          tags: {
            include: {
              tag: {
                select: { id: true, name: true, slug: true },
              },
            },
          },
          _count: {
            select: {
              reviews: true,
              orderItems: true,
            },
          },
        },
      }),
      prisma.product.count({ where }),
    ])

    return {
      products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }
  }

  // Update product
  async updateProduct(id: string, data: Omit<UpdateProductInput, 'id'>): Promise<ProductWithRelations> {
    try {
      // Check if product exists
      const existingProduct = await prisma.product.findUnique({
        where: { id },
      })

      if (!existingProduct) {
        throw new AppError('Product not found', 404)
      }

      // Check slug uniqueness if updating
      if (data.slug && data.slug !== existingProduct.slug) {
        const slugExists = await prisma.product.findUnique({
          where: { slug: data.slug },
        })
        if (slugExists) {
          throw new AppError('Product with this slug already exists', 409)
        }
      }

      // Check SKU uniqueness if updating
      if (data.sku && data.sku !== existingProduct.sku) {
        const skuExists = await prisma.product.findUnique({
          where: { sku: data.sku },
        })
        if (skuExists) {
          throw new AppError('Product with this SKU already exists', 409)
        }
      }

      // Verify category exists if provided
      if (data.categoryId) {
        const category = await prisma.category.findUnique({
          where: { id: data.categoryId },
        })
        if (!category) {
          throw new AppError('Category not found', 404)
        }
      }

      await prisma.$transaction(async (tx) => {
        // Extract images from data to handle separately
        const { images, variants: _variants, attributes, tags, ...productData } = data

        // Update main product
        const updateData: Prisma.ProductUpdateInput = {
          ...productData,
          publishedAt: data.status === 'PUBLISHED' && !existingProduct.publishedAt
            ? new Date()
            : undefined,
        }

        await tx.product.update({
          where: { id },
          data: updateData,
        })

        // Handle images update if provided
        if (images) {
          // Delete existing images
          await tx.productImage.deleteMany({
            where: { productId: id },
          })

          // Create new images
          if (images.length > 0) {
            await tx.productImage.createMany({
              data: images.map((image, index) => ({
                productId: id,
                url: image.url,
                alt: image.alt,
                sortOrder: image.sortOrder || index,
                isMain: image.isMain || index === 0,
              })),
            })
          }
        }

        // Handle attributes update if provided
        if (attributes) {
          // Delete existing attributes
          await tx.productAttribute.deleteMany({
            where: { productId: id },
          })

          // Create new attributes
          if (attributes.length > 0) {
            await tx.productAttribute.createMany({
              data: attributes.map((attr) => ({
                productId: id,
                name: attr.name,
                value: attr.value,
              })),
            })
          }
        }

        // Handle tags update if provided
        if (tags) {
          // Delete existing product-tag relations
          await tx.productTag.deleteMany({
            where: { productId: id },
          })

          // Create new tags and relations
          for (const tagName of tags) {
            const tag = await tx.tag.upsert({
              where: { slug: this.generateSlug(tagName) },
              update: {},
              create: {
                name: tagName,
                slug: this.generateSlug(tagName),
              },
            })

            await tx.productTag.create({
              data: {
                productId: id,
                tagId: tag.id,
              },
            })
          }
        }

        // Product updated successfully in transaction
        return true
      })

      logger.info(`Product updated: ${id}`)
      return this.getProductById(id)
    } catch (error) {
      logger.error('Error updating product:', error)
      throw error
    }
  }

  // Delete product
  async deleteProduct(id: string): Promise<void> {
    const product = await prisma.product.findUnique({
      where: { id },
    })

    if (!product) {
      throw new AppError('Product not found', 404)
    }

    await prisma.product.delete({
      where: { id },
    })

    logger.info(`Product deleted: ${id}`)
  }

  // Inventory management
  async adjustInventory(data: InventoryAdjustmentInput): Promise<void> {
    const product = await prisma.product.findUnique({
      where: { id: data.productId },
    })

    if (!product) {
      throw new AppError('Product not found', 404)
    }

    if (!product.trackQuantity) {
      throw new AppError('Product does not track quantity', 400)
    }

    const newQuantity = product.quantity + data.quantity

    if (newQuantity < 0) {
      throw new AppError('Insufficient inventory', 400)
    }

    await prisma.$transaction(async (tx) => {
      // Update product quantity
      await tx.product.update({
        where: { id: data.productId },
        data: { quantity: newQuantity },
      })

      // Log inventory change
      await tx.inventoryLog.create({
        data: {
          productId: data.productId,
          type: data.type,
          quantity: data.quantity,
          reason: data.reason,
          reference: data.reference,
        },
      })
    })

    logger.info(`Inventory adjusted for product ${data.productId}: ${data.quantity}`)
  }

  // Get low stock products
  async getLowStockProducts(): Promise<Product[]> {
    return prisma.product.findMany({
      where: {
        trackQuantity: true,
        quantity: {
          lte: prisma.product.fields.lowStockThreshold,
        },
      },
      include: {
        category: {
          select: { id: true, name: true, slug: true },
        },
      },
    })
  }

  // Get product by slug
  async getProductBySlug(slug: string): Promise<ProductWithRelations> {
    const product = await prisma.product.findUnique({
      where: { slug },
      include: {
        category: {
          select: { id: true, name: true, slug: true },
        },
        images: {
          orderBy: { sortOrder: 'asc' },
        },
        variants: {
          where: { isActive: true },
          orderBy: { createdAt: 'asc' },
        },
        attributes: true,
        tags: {
          include: {
            tag: {
              select: { id: true, name: true, slug: true },
            },
          },
        },
        _count: {
          select: {
            reviews: true,
            orderItems: true,
          },
        },
      },
    })

    if (!product) {
      throw new AppError('Product not found', 404)
    }

    return product
  }

  // Generate SEO preview for a product
  async generateSEOPreview(productData: {
    name: string
    description?: string
    categoryId?: string
    price: number
  }): Promise<{
    slug: string
    metaTitle: string
    metaDescription: string
    focusKeyword: string
  }> {
    try {
      // Get existing slugs
      const existingProducts = await prisma.product.findMany({
        select: { slug: true },
      })
      const existingSlugs = existingProducts.map(p => p.slug)

      // Get category name
      let categoryName: string | undefined
      if (productData.categoryId) {
        const category = await prisma.category.findUnique({
          where: { id: productData.categoryId },
          select: { name: true },
        })
        categoryName = category?.name
      }

      const seoData = seoService.generateProductSEO(
        productData.name,
        productData.description,
        categoryName,
        productData.price,
        existingSlugs,
      )

      return {
        slug: seoData.slug,
        metaTitle: seoData.metaTitle,
        metaDescription: seoData.metaDescription,
        focusKeyword: seoData.focusKeyword || '',
      }
    } catch (error) {
      logger.error('Error generating SEO preview:', error)
      throw new AppError('Failed to generate SEO preview', 500)
    }
  }

  // Validate product SEO data
  validateProductSEO(seoData: {
    slug?: string
    metaTitle?: string
    metaDescription?: string
    focusKeyword?: string
  }): { isValid: boolean; errors: string[] } {
    return seoService.validateSEOData(seoData)
  }

  // Private helper methods
  private generateSlug(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9 -]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()
  }

  private async logInventoryChange(data: Omit<InventoryAdjustmentInput, 'type'> & { type: string }): Promise<void> {
    await prisma.inventoryLog.create({
      data: {
        productId: data.productId,
        type: data.type as any,
        quantity: data.quantity,
        reason: data.reason,
        reference: data.reference,
      },
    })
  }
}

export const productService = new ProductService()
