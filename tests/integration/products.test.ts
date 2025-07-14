import request from 'supertest'
import app from '../../src/index'
import { prisma } from '../../src/utils/database'

describe('Product Integration Tests', () => {
  beforeEach(async () => {
    // Clean up database before each test
    await prisma.productTag.deleteMany()
    await prisma.productAttribute.deleteMany()
    await prisma.productImage.deleteMany()
    await prisma.productVariant.deleteMany()
    await prisma.inventoryLog.deleteMany()
    await prisma.product.deleteMany()
    await prisma.tag.deleteMany()
    await prisma.category.deleteMany()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  describe('POST /api/v1/products', () => {
    it('should create a new product', async () => {
      const productData = {
        name: 'Test Product',
        sku: 'TEST-001',
        price: 99.99,
        description: 'A test product',
        status: 'PUBLISHED',
        type: 'SIMPLE',
        quantity: 10,
        trackQuantity: true,
      }

      const response = await request(app)
        .post('/api/v1/products')
        .send(productData)
        .expect(201)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toMatchObject({
        name: productData.name,
        sku: productData.sku,
        price: productData.price,
        status: productData.status,
        type: productData.type,
        quantity: productData.quantity,
      })
      expect(response.body.data.id).toBeDefined()
      expect(response.body.data.slug).toBe('test-product')
    })

    it('should create a product with category', async () => {
      // First create a category
      const category = await prisma.category.create({
        data: {
          name: 'Electronics',
          slug: 'electronics',
        },
      })

      const productData = {
        name: 'Smartphone',
        sku: 'PHONE-001',
        price: 599.99,
        categoryId: category.id,
        status: 'PUBLISHED',
        type: 'SIMPLE',
      }

      const response = await request(app)
        .post('/api/v1/products')
        .send(productData)
        .expect(201)

      expect(response.body.data.categoryId).toBe(category.id)
      expect(response.body.data.category).toMatchObject({
        id: category.id,
        name: category.name,
        slug: category.slug,
      })
    })

    it('should return 400 for invalid product data', async () => {
      const invalidData = {
        name: '', // Invalid: empty name
        sku: 'TEST-001',
        price: -10, // Invalid: negative price
      }

      const response = await request(app)
        .post('/api/v1/products')
        .send(invalidData)
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error.type).toBe('ValidationError')
    })

    it('should return 409 for duplicate SKU', async () => {
      const productData = {
        name: 'Product 1',
        sku: 'DUPLICATE-SKU',
        price: 99.99,
        status: 'PUBLISHED',
        type: 'SIMPLE',
      }

      // Create first product
      await request(app)
        .post('/api/v1/products')
        .send(productData)
        .expect(201)

      // Try to create second product with same SKU
      const duplicateData = {
        ...productData,
        name: 'Product 2',
      }

      const response = await request(app)
        .post('/api/v1/products')
        .send(duplicateData)
        .expect(409)

      expect(response.body.success).toBe(false)
      expect(response.body.error.message).toContain('SKU already exists')
    })
  })

  describe('GET /api/v1/products', () => {
    beforeEach(async () => {
      // Create test products
      await prisma.product.createMany({
        data: [
          {
            name: 'Product 1',
            slug: 'product-1',
            sku: 'PROD-001',
            price: 99.99,
            status: 'PUBLISHED',
            type: 'SIMPLE',
            quantity: 10,
          },
          {
            name: 'Product 2',
            slug: 'product-2',
            sku: 'PROD-002',
            price: 199.99,
            status: 'PUBLISHED',
            type: 'SIMPLE',
            quantity: 5,
          },
          {
            name: 'Draft Product',
            slug: 'draft-product',
            sku: 'DRAFT-001',
            price: 299.99,
            status: 'DRAFT',
            type: 'SIMPLE',
            quantity: 0,
          },
        ],
      })
    })

    it('should get all products with pagination', async () => {
      const response = await request(app)
        .get('/api/v1/products')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveLength(3)
      expect(response.body.pagination).toMatchObject({
        page: 1,
        limit: 10,
        total: 3,
        totalPages: 1,
      })
    })

    it('should filter products by status', async () => {
      const response = await request(app)
        .get('/api/v1/products?status=PUBLISHED')
        .expect(200)

      expect(response.body.data).toHaveLength(2)
      expect(response.body.data.every((p: any) => p.status === 'PUBLISHED')).toBe(true)
    })

    it('should search products by name', async () => {
      const response = await request(app)
        .get('/api/v1/products?search=Product 1')
        .expect(200)

      expect(response.body.data).toHaveLength(1)
      expect(response.body.data[0].name).toBe('Product 1')
    })

    it('should filter products by price range', async () => {
      const response = await request(app)
        .get('/api/v1/products?minPrice=150&maxPrice=250')
        .expect(200)

      expect(response.body.data).toHaveLength(1)
      expect(response.body.data[0].name).toBe('Product 2')
    })

    it('should sort products by price', async () => {
      const response = await request(app)
        .get('/api/v1/products?sortBy=price&sortOrder=asc')
        .expect(200)

      const prices = response.body.data.map((p: any) => p.price)
      expect(prices).toEqual([...prices].sort((a, b) => a - b))
    })

    it('should paginate results', async () => {
      const response = await request(app)
        .get('/api/v1/products?page=1&limit=2')
        .expect(200)

      expect(response.body.data).toHaveLength(2)
      expect(response.body.pagination.totalPages).toBe(2)
    })
  })

  describe('GET /api/v1/products/:id', () => {
    let productId: string

    beforeEach(async () => {
      const product = await prisma.product.create({
        data: {
          name: 'Test Product',
          slug: 'test-product',
          sku: 'TEST-001',
          price: 99.99,
          status: 'PUBLISHED',
          type: 'SIMPLE',
        },
      })
      productId = product.id
    })

    it('should get product by ID', async () => {
      const response = await request(app)
        .get(`/api/v1/products/${productId}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.id).toBe(productId)
      expect(response.body.data.name).toBe('Test Product')
    })

    it('should return 404 for non-existent product', async () => {
      const response = await request(app)
        .get('/api/v1/products/clxxxxxxxxxxxxxxxxxxxxxxxx')
        .expect(404)

      expect(response.body.success).toBe(false)
      expect(response.body.error.type).toBe('NotFoundError')
    })

    it('should return 400 for invalid product ID', async () => {
      const response = await request(app)
        .get('/api/v1/products/invalid-id')
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error.type).toBe('ValidationError')
    })
  })

  describe('PUT /api/v1/products/:id', () => {
    let productId: string

    beforeEach(async () => {
      const product = await prisma.product.create({
        data: {
          name: 'Original Product',
          slug: 'original-product',
          sku: 'ORIG-001',
          price: 99.99,
          status: 'DRAFT',
          type: 'SIMPLE',
        },
      })
      productId = product.id
    })

    it('should update product', async () => {
      const updateData = {
        name: 'Updated Product',
        price: 149.99,
        status: 'PUBLISHED',
      }

      const response = await request(app)
        .put(`/api/v1/products/${productId}`)
        .send(updateData)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.name).toBe('Updated Product')
      expect(response.body.data.price).toBe(149.99)
      expect(response.body.data.status).toBe('PUBLISHED')
      expect(response.body.data.publishedAt).toBeDefined()
    })

    it('should return 404 for non-existent product', async () => {
      const response = await request(app)
        .put('/api/v1/products/clxxxxxxxxxxxxxxxxxxxxxxxx')
        .send({ name: 'Updated Name' })
        .expect(404)

      expect(response.body.success).toBe(false)
      expect(response.body.error.type).toBe('NotFoundError')
    })
  })

  describe('DELETE /api/v1/products/:id', () => {
    let productId: string

    beforeEach(async () => {
      const product = await prisma.product.create({
        data: {
          name: 'Product to Delete',
          slug: 'product-to-delete',
          sku: 'DELETE-001',
          price: 99.99,
          status: 'DRAFT',
          type: 'SIMPLE',
        },
      })
      productId = product.id
    })

    it('should delete product', async () => {
      const response = await request(app)
        .delete(`/api/v1/products/${productId}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.message).toBe('Product deleted successfully')

      // Verify product is deleted
      const deletedProduct = await prisma.product.findUnique({
        where: { id: productId },
      })
      expect(deletedProduct).toBeNull()
    })

    it('should return 404 for non-existent product', async () => {
      const response = await request(app)
        .delete('/api/v1/products/clxxxxxxxxxxxxxxxxxxxxxxxx')
        .expect(404)

      expect(response.body.success).toBe(false)
      expect(response.body.error.type).toBe('NotFoundError')
    })
  })

  describe('POST /api/v1/products/inventory/adjust', () => {
    let productId: string

    beforeEach(async () => {
      const product = await prisma.product.create({
        data: {
          name: 'Inventory Product',
          slug: 'inventory-product',
          sku: 'INV-001',
          price: 99.99,
          status: 'PUBLISHED',
          type: 'SIMPLE',
          quantity: 10,
          trackQuantity: true,
        },
      })
      productId = product.id
    })

    it('should adjust inventory successfully', async () => {
      const adjustmentData = {
        productId,
        quantity: 5,
        type: 'RESTOCK',
        reason: 'Manual adjustment',
      }

      const response = await request(app)
        .post('/api/v1/products/inventory/adjust')
        .send(adjustmentData)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.message).toBe('Inventory adjusted successfully')

      // Verify inventory was updated
      const updatedProduct = await prisma.product.findUnique({
        where: { id: productId },
      })
      expect(updatedProduct?.quantity).toBe(15)

      // Verify inventory log was created
      const inventoryLog = await prisma.inventoryLog.findFirst({
        where: { productId },
      })
      expect(inventoryLog).toBeDefined()
      expect(inventoryLog?.type).toBe('RESTOCK')
      expect(inventoryLog?.quantity).toBe(5)
    })

    it('should return 400 for insufficient inventory', async () => {
      const adjustmentData = {
        productId,
        quantity: -15, // More than available
        type: 'SALE',
        reason: 'Sale',
      }

      const response = await request(app)
        .post('/api/v1/products/inventory/adjust')
        .send(adjustmentData)
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error.message).toBe('Insufficient inventory')
    })
  })

  describe('GET /api/v1/products/low-stock', () => {
    beforeEach(async () => {
      await prisma.product.createMany({
        data: [
          {
            name: 'Low Stock Product',
            slug: 'low-stock-product',
            sku: 'LOW-001',
            price: 99.99,
            status: 'PUBLISHED',
            type: 'SIMPLE',
            quantity: 2,
            lowStockThreshold: 5,
            trackQuantity: true,
          },
          {
            name: 'Normal Stock Product',
            slug: 'normal-stock-product',
            sku: 'NORMAL-001',
            price: 99.99,
            status: 'PUBLISHED',
            type: 'SIMPLE',
            quantity: 10,
            lowStockThreshold: 5,
            trackQuantity: true,
          },
        ],
      })
    })

    it('should return low stock products', async () => {
      const response = await request(app)
        .get('/api/v1/products/low-stock')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveLength(1)
      expect(response.body.data[0].name).toBe('Low Stock Product')
      expect(response.body.count).toBe(1)
    })
  })
})