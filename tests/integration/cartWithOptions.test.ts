import request from 'supertest'
import app from '../../src/index'
import { prisma } from '../../src/utils/database'

describe('Cart with Product Options Integration', () => {
  let productId: string
  let optionId: string
  let cartId: string

  beforeAll(async () => {
    // Create test product
    const product = await prisma.product.create({
      data: {
        name: 'Test T-Shirt',
        slug: 'test-t-shirt',
        description: 'A test t-shirt',
        price: 29.99,
        status: 'PUBLISHED',
        trackQuantity: true,
        quantity: 100,
        sku: 'TEST-SHIRT-001',
        categoryId: 'test-category-id',
      }
    })
    productId = product.id

    // Create product options
    const option = await prisma.productOption.create({
      data: {
        productId,
        name: 'size',
        displayName: 'Size',
        type: 'SELECT',
        isRequired: true,
        sortOrder: 1,
        values: {
          create: [
            {
              value: 'S',
              displayValue: 'Small',
              priceAdjustment: 0,
              sortOrder: 1,
            },
            {
              value: 'M',
              displayValue: 'Medium',
              priceAdjustment: 0,
              sortOrder: 2,
            },
            {
              value: 'L',
              displayValue: 'Large',
              priceAdjustment: 5.00,
              sortOrder: 3,
            },
          ]
        }
      }
    })
    optionId = option.id
  })

  afterAll(async () => {
    // Clean up test data
    await prisma.cartItem.deleteMany()
    await prisma.cart.deleteMany()
    await prisma.productOptionValue.deleteMany()
    await prisma.productOption.deleteMany()
    await prisma.product.deleteMany()
  })

  describe('POST /api/v1/carts', () => {
    it('should create cart with product options', async () => {
      const response = await request(app)
        .post('/api/v1/carts')
        .send({
          sessionId: 'test-session-123',
          currency: 'USD',
          items: [
            {
              productId,
              quantity: 2,
              options: {
                size: 'L'
              }
            }
          ]
        })

      expect(response.status).toBe(201)
      expect(response.body.success).toBe(true)
      expect(response.body.data.items).toHaveLength(1)
      expect(response.body.data.items[0].options).toEqual({ size: 'L' })
      expect(response.body.data.items[0].unitPrice).toBe(34.99) // 29.99 + 5.00 for Large
      expect(response.body.data.items[0].totalPrice).toBe(69.98) // 34.99 * 2

      cartId = response.body.data.id
    })
  })

  describe('POST /api/v1/carts/:cartId/items', () => {
    it('should add item with different options as separate cart item', async () => {
      const response = await request(app)
        .post(`/api/v1/carts/${cartId}/items`)
        .send({
          productId,
          quantity: 1,
          options: {
            size: 'S'
          }
        })

      expect(response.status).toBe(201)
      expect(response.body.success).toBe(true)
      expect(response.body.data.items).toHaveLength(2) // Should be separate items

      // Find the small size item
      const smallItem = response.body.data.items.find(
        (item: any) => item.options?.size === 'S'
      )
      expect(smallItem).toBeDefined()
      expect(smallItem.unitPrice).toBe(29.99) // No price adjustment for Small
      expect(smallItem.quantity).toBe(1)
    })

    it('should combine items with identical options', async () => {
      const response = await request(app)
        .post(`/api/v1/carts/${cartId}/items`)
        .send({
          productId,
          quantity: 1,
          options: {
            size: 'L'
          }
        })

      expect(response.status).toBe(201)
      expect(response.body.success).toBe(true)
      expect(response.body.data.items).toHaveLength(2) // Still 2 items

      // Find the large size item
      const largeItem = response.body.data.items.find(
        (item: any) => item.options?.size === 'L'
      )
      expect(largeItem).toBeDefined()
      expect(largeItem.quantity).toBe(3) // Should be combined: 2 + 1
      expect(largeItem.totalPrice).toBe(104.97) // 34.99 * 3
    })

    it('should reject invalid options', async () => {
      const response = await request(app)
        .post(`/api/v1/carts/${cartId}/items`)
        .send({
          productId,
          quantity: 1,
          options: {
            size: 'INVALID_SIZE'
          }
        })

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
      expect(response.body.error.message).toContain('Invalid product options')
    })
  })

  describe('PUT /api/v1/carts/:cartId/items/:itemId', () => {
    it('should update item options and recalculate price', async () => {
      // Get cart to find item ID
      const cartResponse = await request(app)
        .get(`/api/v1/carts/${cartId}`)

      const smallItem = cartResponse.body.data.items.find(
        (item: any) => item.options?.size === 'S'
      )

      const response = await request(app)
        .put(`/api/v1/carts/${cartId}/items/${smallItem.id}`)
        .send({
          quantity: 2,
          options: {
            size: 'L'
          }
        })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)

      // Should now have price adjustment for Large size
      const updatedItem = response.body.data.items.find(
        (item: any) => item.id === smallItem.id
      )
      expect(updatedItem.unitPrice).toBe(34.99)
      expect(updatedItem.quantity).toBe(2)
      expect(updatedItem.options.size).toBe('L')
    })
  })

  describe('GET /api/v1/carts/:cartId', () => {
    it('should return cart with options in item details', async () => {
      const response = await request(app)
        .get(`/api/v1/carts/${cartId}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.items).toHaveLength(2)

      // Check that all items have options
      response.body.data.items.forEach((item: any) => {
        expect(item.options).toBeDefined()
        expect(item.options.size).toMatch(/^[SLM]$/)
      })
    })
  })

  describe('POST /api/v1/product-options/validate', () => {
    it('should validate product options correctly', async () => {
      const response = await request(app)
        .post('/api/v1/product-options/validate')
        .send({
          productId,
          selectedOptions: {
            size: 'M'
          }
        })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.isValid).toBe(true)
      expect(response.body.data.errors).toHaveLength(0)
    })

    it('should return validation errors for invalid options', async () => {
      const response = await request(app)
        .post('/api/v1/product-options/validate')
        .send({
          productId,
          selectedOptions: {
            size: 'XL'
          }
        })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.isValid).toBe(false)
      expect(response.body.data.errors).toHaveLength(1)
    })
  })

  describe('POST /api/v1/product-options/products/:productId/pricing', () => {
    it('should calculate pricing with options correctly', async () => {
      const response = await request(app)
        .post(`/api/v1/product-options/products/${productId}/pricing`)
        .send({
          selectedOptions: {
            size: 'L'
          }
        })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.basePrice).toBe(29.99)
      expect(response.body.data.adjustments).toHaveLength(1)
      expect(response.body.data.adjustments[0].amount).toBe(5.00)
      expect(response.body.data.finalPrice).toBe(34.99)
    })
  })
})