import { ProductService } from '../../../src/services/productService'
import { prisma } from '../../../src/utils/database'
import { AppError } from '../../../src/middleware/error'

// Mock Prisma
jest.mock('../../../src/utils/database', () => ({
  prisma: {
    product: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    category: {
      findUnique: jest.fn(),
    },
    productImage: {
      createMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    productVariant: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    productAttribute: {
      createMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    tag: {
      upsert: jest.fn(),
    },
    productTag: {
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    inventoryLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
  },
}))

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}))

describe('ProductService', () => {
  let productService: ProductService

  beforeEach(() => {
    productService = new ProductService()
    jest.clearAllMocks()
  })

  describe('createProduct', () => {
    const mockProductData = {
      name: 'Test Product',
      sku: 'TEST-001',
      price: 99.99,
      status: 'DRAFT' as const,
      type: 'SIMPLE' as const,
      trackQuantity: true,
      quantity: 10,
    }

    it('should create a product successfully', async () => {
      const mockCreatedProduct = {
        id: 'product-1',
        ...mockProductData,
        slug: 'test-product',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const mockProductWithRelations = {
        ...mockCreatedProduct,
        category: null,
        images: [],
        variants: [],
        attributes: [],
        tags: [],
        _count: { reviews: 0, orderItems: 0 },
      }

      // Mock database calls
      ;(prisma.product.findUnique as jest.Mock)
        .mockResolvedValueOnce(null) // slug check
        .mockResolvedValueOnce(null) // sku check
        .mockResolvedValueOnce(mockProductWithRelations) // final get

      ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return callback({
          product: {
            create: jest.fn().mockResolvedValue(mockCreatedProduct),
          },
        })
      })

      const result = await productService.createProduct(mockProductData)

      expect(result).toEqual(mockProductWithRelations)
      expect(prisma.product.findUnique).toHaveBeenCalledTimes(3)
    })

    it('should throw error if slug already exists', async () => {
      ;(prisma.product.findUnique as jest.Mock).mockResolvedValueOnce({
        id: 'existing-product',
        slug: 'test-product',
      })

      await expect(productService.createProduct(mockProductData)).rejects.toThrow(
        new AppError('Product with this slug already exists', 409)
      )
    })

    it('should throw error if SKU already exists', async () => {
      ;(prisma.product.findUnique as jest.Mock)
        .mockResolvedValueOnce(null) // slug check
        .mockResolvedValueOnce({ id: 'existing-product', sku: 'TEST-001' }) // sku check

      await expect(productService.createProduct(mockProductData)).rejects.toThrow(
        new AppError('Product with this SKU already exists', 409)
      )
    })

    it('should throw error if category does not exist', async () => {
      const dataWithCategory = {
        ...mockProductData,
        categoryId: 'non-existent-category',
      }

      ;(prisma.product.findUnique as jest.Mock)
        .mockResolvedValueOnce(null) // slug check
        .mockResolvedValueOnce(null) // sku check

      ;(prisma.category.findUnique as jest.Mock).mockResolvedValueOnce(null)

      await expect(productService.createProduct(dataWithCategory)).rejects.toThrow(
        new AppError('Category not found', 404)
      )
    })
  })

  describe('getProductById', () => {
    it('should return product with relations', async () => {
      const mockProduct = {
        id: 'product-1',
        name: 'Test Product',
        slug: 'test-product',
        sku: 'TEST-001',
        price: 99.99,
        category: { id: 'cat-1', name: 'Category 1', slug: 'category-1' },
        images: [],
        variants: [],
        attributes: [],
        tags: [],
        _count: { reviews: 0, orderItems: 0 },
      }

      ;(prisma.product.findUnique as jest.Mock).mockResolvedValueOnce(mockProduct)

      const result = await productService.getProductById('product-1')

      expect(result).toEqual(mockProduct)
      expect(prisma.product.findUnique).toHaveBeenCalledWith({
        where: { id: 'product-1' },
        include: expect.objectContaining({
          category: { select: { id: true, name: true, slug: true } },
          images: { orderBy: { sortOrder: 'asc' } },
          variants: { where: { isActive: true }, orderBy: { createdAt: 'asc' } },
          attributes: true,
          tags: {
            include: {
              tag: { select: { id: true, name: true, slug: true } },
            },
          },
          _count: { select: { reviews: true, orderItems: true } },
        }),
      })
    })

    it('should throw error if product not found', async () => {
      ;(prisma.product.findUnique as jest.Mock).mockResolvedValueOnce(null)

      await expect(productService.getProductById('non-existent')).rejects.toThrow(
        new AppError('Product not found', 404)
      )
    })
  })

  describe('getProducts', () => {
    const mockQuery = {
      page: 1,
      limit: 10,
      sortBy: 'createdAt' as const,
      sortOrder: 'desc' as const,
    }

    it('should return paginated products', async () => {
      const mockProducts = [
        {
          id: 'product-1',
          name: 'Product 1',
          category: null,
          images: [],
          variants: [],
          attributes: [],
          tags: [],
          _count: { reviews: 0, orderItems: 0 },
        },
      ]

      ;(prisma.product.findMany as jest.Mock).mockResolvedValueOnce(mockProducts)
      ;(prisma.product.count as jest.Mock).mockResolvedValueOnce(1)

      const result = await productService.getProducts(mockQuery)

      expect(result).toEqual({
        products: mockProducts,
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
        },
      })
    })

    it('should apply search filter', async () => {
      const queryWithSearch = {
        ...mockQuery,
        search: 'test',
      }

      ;(prisma.product.findMany as jest.Mock).mockResolvedValueOnce([])
      ;(prisma.product.count as jest.Mock).mockResolvedValueOnce(0)

      await productService.getProducts(queryWithSearch)

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { name: { contains: 'test', mode: 'insensitive' } },
              { description: { contains: 'test', mode: 'insensitive' } },
              { sku: { contains: 'test', mode: 'insensitive' } },
            ],
          }),
        })
      )
    })

    it('should apply price filter', async () => {
      const queryWithPriceFilter = {
        ...mockQuery,
        minPrice: 10,
        maxPrice: 100,
      }

      ;(prisma.product.findMany as jest.Mock).mockResolvedValueOnce([])
      ;(prisma.product.count as jest.Mock).mockResolvedValueOnce(0)

      await productService.getProducts(queryWithPriceFilter)

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            price: {
              gte: 10,
              lte: 100,
            },
          }),
        })
      )
    })
  })

  describe('updateProduct', () => {
    it('should update product successfully', async () => {
      const existingProduct = {
        id: 'product-1',
        name: 'Old Name',
        slug: 'old-name',
        sku: 'OLD-001',
        publishedAt: null,
      }

      const updateData = {
        name: 'New Name',
        price: 199.99,
      }

      const updatedProduct = {
        ...existingProduct,
        ...updateData,
        category: null,
        images: [],
        variants: [],
        attributes: [],
        tags: [],
        _count: { reviews: 0, orderItems: 0 },
      }

      ;(prisma.product.findUnique as jest.Mock)
        .mockResolvedValueOnce(existingProduct) // existence check
        .mockResolvedValueOnce(updatedProduct) // final get

      ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return callback({
          product: {
            update: jest.fn().mockResolvedValue(updatedProduct),
          },
        })
      })

      const result = await productService.updateProduct('product-1', updateData)

      expect(result).toEqual(updatedProduct)
    })

    it('should throw error if product not found', async () => {
      ;(prisma.product.findUnique as jest.Mock).mockResolvedValueOnce(null)

      await expect(
        productService.updateProduct('non-existent', { name: 'New Name' })
      ).rejects.toThrow(new AppError('Product not found', 404))
    })
  })

  describe('deleteProduct', () => {
    it('should delete product successfully', async () => {
      const existingProduct = {
        id: 'product-1',
        name: 'Test Product',
      }

      ;(prisma.product.findUnique as jest.Mock).mockResolvedValueOnce(existingProduct)
      ;(prisma.product.delete as jest.Mock).mockResolvedValueOnce(existingProduct)

      await productService.deleteProduct('product-1')

      expect(prisma.product.delete).toHaveBeenCalledWith({
        where: { id: 'product-1' },
      })
    })

    it('should throw error if product not found', async () => {
      ;(prisma.product.findUnique as jest.Mock).mockResolvedValueOnce(null)

      await expect(productService.deleteProduct('non-existent')).rejects.toThrow(
        new AppError('Product not found', 404)
      )
    })
  })

  describe('adjustInventory', () => {
    const mockAdjustmentData = {
      productId: 'product-1',
      quantity: 5,
      type: 'RESTOCK' as const,
      reason: 'Manual adjustment',
    }

    it('should adjust inventory successfully', async () => {
      const existingProduct = {
        id: 'product-1',
        quantity: 10,
        trackQuantity: true,
      }

      ;(prisma.product.findUnique as jest.Mock).mockResolvedValueOnce(existingProduct)
      ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return callback({
          product: {
            update: jest.fn().mockResolvedValue({ ...existingProduct, quantity: 15 }),
          },
          inventoryLog: {
            create: jest.fn().mockResolvedValue({}),
          },
        })
      })

      await productService.adjustInventory(mockAdjustmentData)

      expect(prisma.$transaction).toHaveBeenCalled()
    })

    it('should throw error if product not found', async () => {
      ;(prisma.product.findUnique as jest.Mock).mockResolvedValueOnce(null)

      await expect(productService.adjustInventory(mockAdjustmentData)).rejects.toThrow(
        new AppError('Product not found', 404)
      )
    })

    it('should throw error if product does not track quantity', async () => {
      const existingProduct = {
        id: 'product-1',
        quantity: 10,
        trackQuantity: false,
      }

      ;(prisma.product.findUnique as jest.Mock).mockResolvedValueOnce(existingProduct)

      await expect(productService.adjustInventory(mockAdjustmentData)).rejects.toThrow(
        new AppError('Product does not track quantity', 400)
      )
    })

    it('should throw error for insufficient inventory', async () => {
      const existingProduct = {
        id: 'product-1',
        quantity: 5,
        trackQuantity: true,
      }

      const negativeAdjustment = {
        ...mockAdjustmentData,
        quantity: -10, // Would result in negative inventory
      }

      ;(prisma.product.findUnique as jest.Mock).mockResolvedValueOnce(existingProduct)

      await expect(productService.adjustInventory(negativeAdjustment)).rejects.toThrow(
        new AppError('Insufficient inventory', 400)
      )
    })
  })
})