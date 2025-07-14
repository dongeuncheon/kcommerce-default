import { describe, test, expect, beforeEach } from 'vitest'
import request from 'supertest'
import app from '../../src/index'

describe('SEO API Integration Tests', () => {
  describe('POST /api/v1/products/seo/preview', () => {
    test('should generate SEO preview for valid product data', async () => {
      const productData = {
        name: 'Amazing Wireless Headphones',
        description: 'High-quality wireless headphones with active noise cancellation.',
        price: 199.99
      }

      const response = await request(app)
        .post('/api/v1/products/seo/preview')
        .send(productData)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveProperty('slug')
      expect(response.body.data).toHaveProperty('metaTitle')
      expect(response.body.data).toHaveProperty('metaDescription')
      expect(response.body.data).toHaveProperty('focusKeyword')
      
      expect(response.body.data.slug).toBe('amazing-wireless-headphones')
      expect(response.body.data.metaTitle).toContain('Amazing Wireless Headphones')
      expect(response.body.data.metaDescription).toContain('wireless headphones')
      expect(response.body.message).toBe('SEO preview generated successfully')
    })

    test('should generate SEO preview with category', async () => {
      // First create a category to test with
      const categoryData = {
        name: 'Electronics',
        slug: 'electronics',
        description: 'Electronic products and gadgets'
      }

      const categoryResponse = await request(app)
        .post('/api/v1/categories')
        .send(categoryData)

      const categoryId = categoryResponse.body.data.id

      const productData = {
        name: 'Gaming Mouse',
        description: 'High-precision gaming mouse with RGB lighting.',
        categoryId,
        price: 79.99
      }

      const response = await request(app)
        .post('/api/v1/products/seo/preview')
        .send(productData)

      expect(response.status).toBe(200)
      expect(response.body.data.metaTitle).toContain('Electronics')
    })

    test('should return 400 for missing product name', async () => {
      const productData = {
        description: 'Some description',
        price: 99.99
      }

      const response = await request(app)
        .post('/api/v1/products/seo/preview')
        .send(productData)

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
      expect(response.body.error.message).toBe('Product name is required')
    })

    test('should return 400 for missing price', async () => {
      const productData = {
        name: 'Product Name',
        description: 'Some description'
      }

      const response = await request(app)
        .post('/api/v1/products/seo/preview')
        .send(productData)

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
      expect(response.body.error.message).toBe('Valid price is required')
    })

    test('should handle Korean product names', async () => {
      const productData = {
        name: '무선 블루투스 이어폰',
        description: '고품질 무선 이어폰입니다.',
        price: 150000
      }

      const response = await request(app)
        .post('/api/v1/products/seo/preview')
        .send(productData)

      expect(response.status).toBe(200)
      expect(response.body.data.slug).toBe('무선-블루투스-이어폰')
      expect(response.body.data.metaTitle).toContain('무선 블루투스 이어폰')
    })
  })

  describe('POST /api/v1/products/seo/validate', () => {
    test('should validate correct SEO data', async () => {
      const seoData = {
        slug: 'valid-product-slug',
        metaTitle: 'Valid Product Title',
        metaDescription: 'This is a valid meta description for the product.',
        focusKeyword: 'valid product'
      }

      const response = await request(app)
        .post('/api/v1/products/seo/validate')
        .send(seoData)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.isValid).toBe(true)
      expect(response.body.data.errors).toHaveLength(0)
      expect(response.body.message).toBe('SEO data is valid')
    })

    test('should reject invalid slug', async () => {
      const seoData = {
        slug: 'invalid_slug!@#'
      }

      const response = await request(app)
        .post('/api/v1/products/seo/validate')
        .send(seoData)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.isValid).toBe(false)
      expect(response.body.data.errors.length).toBeGreaterThan(0)
      expect(response.body.message).toBe('SEO data has validation errors')
    })

    test('should reject meta title that is too long', async () => {
      const seoData = {
        metaTitle: 'This is an extremely long meta title that exceeds the maximum allowed length for SEO optimization and search engine display purposes in most search engines'
      }

      const response = await request(app)
        .post('/api/v1/products/seo/validate')
        .send(seoData)

      expect(response.status).toBe(200)
      expect(response.body.data.isValid).toBe(false)
      expect(response.body.data.errors).toContain('Meta title must be 60 characters or less')
    })

    test('should reject meta description that is too long', async () => {
      const seoData = {
        metaDescription: 'This is an extremely long meta description that goes on and on about various product features and benefits and specifications that will definitely exceed the maximum allowed character limit for meta descriptions in search engine results pages and SEO optimization guidelines'
      }

      const response = await request(app)
        .post('/api/v1/products/seo/validate')
        .send(seoData)

      expect(response.status).toBe(200)
      expect(response.body.data.isValid).toBe(false)
      expect(response.body.data.errors).toContain('Meta description must be 160 characters or less')
    })

    test('should accept empty SEO data', async () => {
      const response = await request(app)
        .post('/api/v1/products/seo/validate')
        .send({})

      expect(response.status).toBe(200)
      expect(response.body.data.isValid).toBe(true)
    })

    test('should validate Korean SEO data', async () => {
      const seoData = {
        slug: '무선-이어폰-제품',
        metaTitle: '무선 블루투스 이어폰 | 전자제품',
        metaDescription: '고품질 무선 블루투스 이어폰을 만나보세요.',
        focusKeyword: '무선 이어폰'
      }

      const response = await request(app)
        .post('/api/v1/products/seo/validate')
        .send(seoData)

      expect(response.status).toBe(200)
      expect(response.body.data.isValid).toBe(true)
    })
  })

  describe('GET /api/v1/products/slug/:slug', () => {
    test('should get product by slug', async () => {
      // First create a product
      const productData = {
        name: 'Test Product for Slug',
        sku: 'SLUG-TEST-001',
        status: 'PUBLISHED',
        type: 'SIMPLE',
        price: 99.99,
        trackQuantity: true,
        quantity: 10,
        lowStockThreshold: 5,
        allowBackorders: false
      }

      const createResponse = await request(app)
        .post('/api/v1/products')
        .send(productData)

      expect(createResponse.status).toBe(201)
      const productSlug = createResponse.body.data.slug

      // Now get the product by slug
      const response = await request(app)
        .get(`/api/v1/products/slug/${productSlug}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveProperty('id')
      expect(response.body.data).toHaveProperty('slug', productSlug)
      expect(response.body.data).toHaveProperty('name', 'Test Product for Slug')
    })

    test('should return 404 for non-existent slug', async () => {
      const response = await request(app)
        .get('/api/v1/products/slug/non-existent-slug')

      expect(response.status).toBe(404)
      expect(response.body.success).toBe(false)
      expect(response.body.error.message).toBe('Product not found')
    })
  })

  describe('SEO Integration in Product Creation', () => {
    test('should auto-generate SEO data when creating product without SEO fields', async () => {
      const productData = {
        name: 'Auto SEO Test Product',
        description: 'This product will have auto-generated SEO data.',
        sku: 'AUTO-SEO-001',
        status: 'PUBLISHED',
        type: 'SIMPLE',
        price: 149.99,
        trackQuantity: true,
        quantity: 10,
        lowStockThreshold: 5,
        allowBackorders: false
      }

      const response = await request(app)
        .post('/api/v1/products')
        .send(productData)

      expect(response.status).toBe(201)
      expect(response.body.data).toHaveProperty('slug')
      expect(response.body.data).toHaveProperty('metaTitle')
      expect(response.body.data).toHaveProperty('metaDescription')
      expect(response.body.data).toHaveProperty('focusKeyword')
      
      expect(response.body.data.slug).toBe('auto-seo-test-product')
      expect(response.body.data.metaTitle).toContain('Auto SEO Test Product')
      expect(response.body.data.metaDescription).toContain('auto-generated SEO')
    })

    test('should use provided SEO data when creating product', async () => {
      const productData = {
        name: 'Custom SEO Product',
        description: 'This product has custom SEO data.',
        slug: 'custom-seo-product-slug',
        metaTitle: 'Custom SEO Product Title',
        metaDescription: 'Custom meta description for this product.',
        focusKeyword: 'custom seo',
        sku: 'CUSTOM-SEO-001',
        status: 'PUBLISHED',
        type: 'SIMPLE',
        price: 199.99,
        trackQuantity: true,
        quantity: 10,
        lowStockThreshold: 5,
        allowBackorders: false
      }

      const response = await request(app)
        .post('/api/v1/products')
        .send(productData)

      expect(response.status).toBe(201)
      expect(response.body.data.slug).toBe('custom-seo-product-slug')
      expect(response.body.data.metaTitle).toBe('Custom SEO Product Title')
      expect(response.body.data.metaDescription).toBe('Custom meta description for this product.')
      expect(response.body.data.focusKeyword).toBe('custom seo')
    })

    test('should reject product creation with invalid SEO data', async () => {
      const productData = {
        name: 'Invalid SEO Product',
        slug: 'invalid_slug!@#',
        sku: 'INVALID-SEO-001',
        status: 'PUBLISHED',
        type: 'SIMPLE',
        price: 99.99,
        trackQuantity: true,
        quantity: 10,
        lowStockThreshold: 5,
        allowBackorders: false
      }

      const response = await request(app)
        .post('/api/v1/products')
        .send(productData)

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
      expect(response.body.error.message).toContain('SEO validation failed')
    })
  })
})