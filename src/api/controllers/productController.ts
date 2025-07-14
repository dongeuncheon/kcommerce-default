import { Request, Response } from 'express'
import { productService } from '../../services/productService'
import { asyncHandler } from '../../middleware/error'
import { 
  CreateProductSchema,
  UpdateProductSchema,
  ProductQuerySchema,
  ProductParamsSchema,
  InventoryAdjustmentSchema
} from '../../types/product'
import { getFileUrl } from '../../middleware/upload'
import { imageService } from '../../services/imageService'
import { logger } from '../../utils/logger'

export class ProductController {
  
  // Create a new product
  createProduct = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    // Parse and validate request body
    const validatedData = CreateProductSchema.parse(req.body)
    
    // Handle uploaded images
    if (req.files && Array.isArray(req.files)) {
      const images = req.files.map((file, index) => ({
        url: getFileUrl(req, file.path),
        alt: file.originalname,
        sortOrder: index,
        isMain: index === 0,
      }))
      
      validatedData.images = images
    }

    const product = await productService.createProduct(validatedData)

    res.status(201).json({
      success: true,
      data: product,
      message: 'Product created successfully',
    })
    return
  })

  // Get all products with pagination and filtering
  getProducts = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const validatedQuery = ProductQuerySchema.parse(req.query)
    const result = await productService.getProducts(validatedQuery)

    res.json({
      success: true,
      data: result.products,
      pagination: result.pagination,
    })
    return
  })

  // Get product by ID
  getProductById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = ProductParamsSchema.parse(req.params)
    const product = await productService.getProductById(id)

    res.json({
      success: true,
      data: product,
    })
    return
  })

  // Get product by slug
  getProductBySlug = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { slug } = req.params
    
    try {
      const product = await productService.getProductBySlug(slug)

      res.json({
        success: true,
        data: product,
      })
      return
    } catch (error) {
      if (error instanceof Error && error.message === 'Product not found') {
        res.status(404).json({
          success: false,
          error: {
            type: 'NotFoundError',
            message: 'Product not found',
          },
        })
        return
      }
      throw error
    }
  })

  // Update product
  updateProduct = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = ProductParamsSchema.parse(req.params)
    const validatedData = UpdateProductSchema.parse({ id, ...req.body })

    // Handle uploaded images
    if (req.files && Array.isArray(req.files)) {
      const images = req.files.map((file, index) => ({
        url: getFileUrl(req, file.path),
        alt: file.originalname,
        sortOrder: index,
        isMain: index === 0,
      }))
      
      validatedData.images = images
    }

    const product = await productService.updateProduct(id, validatedData)

    res.json({
      success: true,
      data: product,
      message: 'Product updated successfully',
    })
    return
  })

  // Delete product
  deleteProduct = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = ProductParamsSchema.parse(req.params)
    await productService.deleteProduct(id)

    res.json({
      success: true,
      message: 'Product deleted successfully',
    })
    return
  })

  // Upload product images with thumbnail generation
  uploadImages = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = ProductParamsSchema.parse(req.params)
    
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      res.status(400).json({
        success: false,
        error: {
          type: 'ValidationError',
          message: 'No images uploaded',
        },
      })
      return
    }

    const processedImages: Array<{ url: string; alt: string; sortOrder: number; isMain: boolean }> = []

    // Process each uploaded image
    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i]
      
      try {
        // Process image and generate thumbnails
        const processedImage = await imageService.processImage(
          file.buffer,
          file.originalname,
          {
            quality: 85,
            format: 'jpeg',
            maxWidth: 2048,
            maxHeight: 2048
          }
        )

        // Create image object for database
        const imageData = {
          url: imageService.getImageUrl(processedImage.originalPath),
          alt: file.originalname,
          sortOrder: i,
          isMain: i === 0
        }

        processedImages.push(imageData)
        
        logger.info(`Processed image for product ${id}: ${file.originalname}`)
      } catch (error) {
        logger.error(`Failed to process image ${file.originalname}:`, error)
        throw error
      }
    }

    // Update product with new images
    const product = await productService.updateProduct(id, { images: processedImages })

    res.json({
      success: true,
      data: {
        images: product.images,
        processed: processedImages.length,
      },
      message: 'Images uploaded and processed successfully',
    })
    return
  })

  // Upload single product image
  uploadSingleImage = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = ProductParamsSchema.parse(req.params)
    
    if (!req.file) {
      res.status(400).json({
        success: false,
        error: {
          type: 'ValidationError',
          message: 'No image uploaded',
        },
      })
      return
    }

    try {
      // Process image and generate thumbnails
      const processedImage = await imageService.processImage(
        req.file.buffer,
        req.file.originalname,
        {
          quality: 85,
          format: 'jpeg',
          maxWidth: 2048,
          maxHeight: 2048
        }
      )

      // Create image object for database
      const imageData = {
        url: imageService.getImageUrl(processedImage.originalPath),
        alt: req.file.originalname,
        sortOrder: 0,
        isMain: true
      }

      // Get existing product to append new image
      const existingProduct = await productService.getProductById(id)
      const existingImages = existingProduct.images || []
      
      // Convert existing images to the format expected by updateProduct
      const formattedExistingImages = existingImages.map((img: any) => ({
        url: img.url,
        alt: img.alt || '',
        sortOrder: img.sortOrder,
        isMain: img.isMain
      }))
      
      // Add new image to existing images
      const updatedImages = [...formattedExistingImages, imageData]
      
      // Update product with new images
      const product = await productService.updateProduct(id, { images: updatedImages })

      res.json({
        success: true,
        data: {
          image: imageData,
          totalImages: product.images?.length || 0,
        },
        message: 'Image uploaded and processed successfully',
      })
      return
    } catch (error) {
      logger.error(`Failed to process single image:`, error)
      throw error
    }
  })

  // Delete product image
  deleteImage = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id, imageId } = req.params
    
    // Get existing product
    const existingProduct = await productService.getProductById(id)
    
    if (!existingProduct.images || existingProduct.images.length === 0) {
      res.status(404).json({
        success: false,
        error: {
          type: 'NotFoundError',
          message: 'No images found for this product',
        },
      })
      return
    }

    // Find the image to delete
    const imageToDelete = existingProduct.images.find(img => img.url.includes(imageId))
    
    if (!imageToDelete) {
      res.status(404).json({
        success: false,
        error: {
          type: 'NotFoundError',
          message: 'Image not found',
        },
      })
      return
    }

    try {
      // Extract file path from URL
      const imagePath = imageToDelete.url.replace('/uploads/', '')
      
      // Delete image files and thumbnails
      await imageService.deleteImage(imagePath)
      
      // Remove image from product - convert to the format expected by updateProduct
      const updatedImages = existingProduct.images
        .filter(img => img.url !== imageToDelete.url)
        .map((img: any) => ({
          url: img.url,
          alt: img.alt || '',
          sortOrder: img.sortOrder,
          isMain: img.isMain
        }))
      
      // Update product
      const product = await productService.updateProduct(id, { images: updatedImages })

      res.json({
        success: true,
        data: {
          remainingImages: product.images?.length || 0,
        },
        message: 'Image deleted successfully',
      })
      return
    } catch (error) {
      logger.error(`Failed to delete image:`, error)
      throw error
    }
  })

  // Adjust inventory
  adjustInventory = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const validatedData = InventoryAdjustmentSchema.parse(req.body)
    await productService.adjustInventory(validatedData)

    res.json({
      success: true,
      message: 'Inventory adjusted successfully',
    })
    return
  })

  // Get low stock products
  getLowStockProducts = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const products = await productService.getLowStockProducts()

    res.json({
      success: true,
      data: products,
      count: products.length,
    })
    return
  })

  // Get product statistics
  getProductStats = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    // This is a placeholder for product statistics
    // In a real implementation, you'd calculate various metrics
    const stats = {
      totalProducts: 0,
      publishedProducts: 0,
      draftProducts: 0,
      lowStockProducts: 0,
      totalValue: 0,
    }

    res.json({
      success: true,
      data: stats,
    })
    return
  })

  // Bulk operations
  bulkUpdateProducts = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { productIds, updates } = req.body

    if (!Array.isArray(productIds) || productIds.length === 0) {
      res.status(400).json({
        success: false,
        error: {
          type: 'ValidationError',
          message: 'Product IDs array is required',
        },
      })
      return
    }

    const results: Array<{ id: any; success: boolean; data?: any; error?: string }> = []
    
    for (const productId of productIds) {
      try {
        const product = await productService.updateProduct(productId, updates)
        results.push({ id: productId, success: true, data: product })
      } catch (error) {
        results.push({ 
          id: productId, 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        })
      }
    }

    res.json({
      success: true,
      data: results,
      message: 'Bulk update completed',
    })
    return
  })

  // Generate SEO preview for product
  generateSEOPreview = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { name, description, categoryId, price } = req.body

    if (!name || typeof name !== 'string') {
      res.status(400).json({
        success: false,
        error: {
          type: 'ValidationError',
          message: 'Product name is required',
        },
      })
      return
    }

    if (!price || typeof price !== 'number') {
      res.status(400).json({
        success: false,
        error: {
          type: 'ValidationError',
          message: 'Valid price is required',
        },
      })
      return
    }

    try {
      const seoPreview = await productService.generateSEOPreview({
        name,
        description,
        categoryId,
        price,
      })

      res.json({
        success: true,
        data: seoPreview,
        message: 'SEO preview generated successfully',
      })
      return
    } catch (error) {
      logger.error('Failed to generate SEO preview:', error)
      throw error
    }
  })

  // Validate SEO data
  validateSEO = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { slug, metaTitle, metaDescription, focusKeyword } = req.body

    const validation = productService.validateProductSEO({
      slug,
      metaTitle,
      metaDescription,
      focusKeyword,
    })

    res.json({
      success: true,
      data: {
        isValid: validation.isValid,
        errors: validation.errors,
      },
      message: validation.isValid ? 'SEO data is valid' : 'SEO data has validation errors',
    })
    return
  })

  // Duplicate product
  duplicateProduct = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = ProductParamsSchema.parse(req.params)
    const existingProduct = await productService.getProductById(id)

    // Create new product data based on existing product
    const newProductData = {
      name: `${existingProduct.name} (Copy)`,
      slug: `${existingProduct.slug}-copy-${Date.now()}`,
      description: existingProduct.description || '',
      shortDescription: existingProduct.shortDescription || '',
      sku: `${existingProduct.sku}-COPY-${Date.now()}`,
      status: 'DRAFT' as const,
      type: existingProduct.type,
      price: Number(existingProduct.price),
      comparePrice: existingProduct.comparePrice ? Number(existingProduct.comparePrice) : undefined,
      costPrice: existingProduct.costPrice ? Number(existingProduct.costPrice) : undefined,
      trackQuantity: existingProduct.trackQuantity,
      quantity: 0, // Reset quantity for duplicate
      lowStockThreshold: existingProduct.lowStockThreshold,
      allowBackorders: existingProduct.allowBackorders,
      weight: existingProduct.weight ? Number(existingProduct.weight) : undefined,
      length: existingProduct.length ? Number(existingProduct.length) : undefined,
      width: existingProduct.width ? Number(existingProduct.width) : undefined,
      height: existingProduct.height ? Number(existingProduct.height) : undefined,
      metaTitle: existingProduct.metaTitle || '',
      metaDescription: existingProduct.metaDescription || '',
      focusKeyword: existingProduct.focusKeyword || '',
      isFeatured: false, // Reset featured flag
      isDigital: existingProduct.isDigital,
      requiresShipping: existingProduct.requiresShipping,
      categoryId: existingProduct.categoryId || undefined,
      images: existingProduct.images.map(img => ({
        url: img.url,
        alt: img.alt || '',
        sortOrder: img.sortOrder,
        isMain: img.isMain,
      })),
      attributes: existingProduct.attributes.map(attr => ({
        name: attr.name,
        value: attr.value,
      })),
      tags: existingProduct.tags.map(tag => tag.tag.name),
    }

    const duplicatedProduct = await productService.createProduct(newProductData)

    logger.info(`Product duplicated: ${id} -> ${duplicatedProduct.id}`)

    res.status(201).json({
      success: true,
      data: duplicatedProduct,
      message: 'Product duplicated successfully',
    })
    return
  })
}

export const productController = new ProductController()