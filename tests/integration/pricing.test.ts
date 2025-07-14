import { describe, test, expect, beforeEach } from 'vitest'
import request from 'supertest'
import app from '../../src/index'

describe('Pricing API Integration Tests', () => {
  let testProduct: any
  let testCategory: any
  let testRule: any

  beforeEach(async () => {
    // Create a test category
    const categoryData = {
      name: 'Test Category',
      slug: 'test-category',
      description: 'Category for pricing tests'
    }

    const categoryResponse = await request(app)
      .post('/api/v1/categories')
      .send(categoryData)

    testCategory = categoryResponse.body.data

    // Create a test product
    const productData = {
      name: 'Pricing Test Product',
      slug: 'pricing-test-product',
      sku: 'PRICE-TEST-001',
      status: 'PUBLISHED',
      type: 'SIMPLE',
      price: 100.00,
      categoryId: testCategory.id,
      trackQuantity: true,
      quantity: 50,
      lowStockThreshold: 10,
      allowBackorders: false
    }

    const productResponse = await request(app)
      .post('/api/v1/products')
      .send(productData)

    testProduct = productResponse.body.data
  })

  describe('POST /api/v1/pricing/calculate', () => {
    test('should calculate price for product with no rules', async () => {
      const requestData = {
        productId: testProduct.id,
        quantity: 2,
        userId: 'test-user-1'
      }

      const response = await request(app)
        .post('/api/v1/pricing/calculate')
        .send(requestData)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveProperty('productId', testProduct.id)
      expect(response.body.data).toHaveProperty('originalPrice', 100)
      expect(response.body.data).toHaveProperty('finalPrice', 100)
      expect(response.body.data).toHaveProperty('discountAmount', 0)
      expect(response.body.data).toHaveProperty('appliedRules')
      expect(response.body.data.appliedRules).toBeInstanceOf(Array)
      expect(response.body.data.appliedRules).toHaveLength(0)
    })

    test('should return 400 for invalid request data', async () => {
      const invalidData = {
        productId: '',
        quantity: -1
      }

      const response = await request(app)
        .post('/api/v1/pricing/calculate')
        .send(invalidData)

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
      expect(response.body.error.message).toBe('Validation error')
    })

    test('should return 500 for non-existent product', async () => {
      const requestData = {
        productId: 'non-existent-product',
        quantity: 1
      }

      const response = await request(app)
        .post('/api/v1/pricing/calculate')
        .send(requestData)

      expect(response.status).toBe(500)
      expect(response.body.success).toBe(false)
      expect(response.body.error.message).toContain('not found')
    })
  })

  describe('POST /api/v1/pricing/calculate-bulk', () => {
    test('should calculate bulk pricing for multiple products', async () => {
      // Create a second test product
      const product2Data = {
        name: 'Pricing Test Product 2',
        slug: 'pricing-test-product-2',
        sku: 'PRICE-TEST-002',
        status: 'PUBLISHED',
        type: 'SIMPLE',
        price: 50.00,
        categoryId: testCategory.id
      }

      const product2Response = await request(app)
        .post('/api/v1/products')
        .send(product2Data)

      const testProduct2 = product2Response.body.data

      const requestData = {
        items: [
          { productId: testProduct.id, quantity: 2 },
          { productId: testProduct2.id, quantity: 3 }
        ],
        userId: 'test-user-1'
      }

      const response = await request(app)
        .post('/api/v1/pricing/calculate-bulk')
        .send(requestData)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.items).toHaveLength(2)
      expect(response.body.data).toHaveProperty('totalOriginalPrice', 350) // (100*2) + (50*3)
      expect(response.body.data).toHaveProperty('totalFinalPrice', 350)
      expect(response.body.data).toHaveProperty('totalSavings', 0)
      expect(response.body.data).toHaveProperty('totalSavingsPercentage', 0)
    })

    test('should return 400 for empty items array', async () => {
      const response = await request(app)
        .post('/api/v1/pricing/calculate-bulk')
        .send({ items: [] })

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
    })
  })

  describe('POST /api/v1/pricing/preview', () => {
    test('should generate pricing preview', async () => {
      const requestData = {
        productId: testProduct.id,
        quantity: 1,
        userId: 'test-user-1'
      }

      const response = await request(app)
        .post('/api/v1/pricing/preview')
        .send(requestData)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveProperty('preview', true)
      expect(response.body.data).toHaveProperty('productId', testProduct.id)
      expect(response.body.data).toHaveProperty('originalPrice', 100)
      expect(response.body.data).toHaveProperty('finalPrice', 100)
    })
  })

  describe('POST /api/v1/pricing/rules', () => {
    test('should create a new pricing rule', async () => {
      const ruleData = {
        name: 'Quantity Discount Test',
        description: 'Test quantity-based discount rule',
        type: 'QUANTITY_DISCOUNT',
        conditions: {
          minQuantity: 3,
          maxQuantity: 10
        },
        discountType: 'PERCENTAGE',
        discountValue: 15,
        priority: 5,
        applyToCategories: true,
        categoryIds: [testCategory.id],
        isActive: true
      }

      const response = await request(app)
        .post('/api/v1/pricing/rules')
        .send(ruleData)

      expect(response.status).toBe(201)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveProperty('id')
      expect(response.body.data).toHaveProperty('name', 'Quantity Discount Test')
      expect(response.body.data).toHaveProperty('type', 'QUANTITY_DISCOUNT')
      expect(response.body.data).toHaveProperty('discountType', 'PERCENTAGE')
      expect(response.body.data).toHaveProperty('discountValue')

      testRule = response.body.data
    })

    test('should return 400 for invalid rule data', async () => {
      const invalidRuleData = {
        name: '',
        type: 'INVALID_TYPE',
        discountValue: -10
      }

      const response = await request(app)
        .post('/api/v1/pricing/rules')
        .send(invalidRuleData)

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
      expect(response.body.error.message).toBe('Validation error')
    })
  })

  describe('GET /api/v1/pricing/rules', () => {
    beforeEach(async () => {
      // Create a test rule first
      const ruleData = {
        name: 'Test Rule for Listing',
        type: 'QUANTITY_DISCOUNT',
        conditions: { minQuantity: 2 },
        discountType: 'PERCENTAGE',
        discountValue: 10,
        isActive: true
      }

      const ruleResponse = await request(app)
        .post('/api/v1/pricing/rules')
        .send(ruleData)

      testRule = ruleResponse.body.data
    })

    test('should get all pricing rules', async () => {
      const response = await request(app)
        .get('/api/v1/pricing/rules')

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeInstanceOf(Array)
      expect(response.body).toHaveProperty('count')
      expect(response.body.count).toBeGreaterThanOrEqual(1)
    })

    test('should filter pricing rules by active status', async () => {
      const response = await request(app)
        .get('/api/v1/pricing/rules?isActive=true')

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeInstanceOf(Array)
      
      // Verify all returned rules are active
      response.body.data.forEach((rule: any) => {
        expect(rule.isActive).toBe(true)
      })
    })

    test('should filter pricing rules by type', async () => {
      const response = await request(app)
        .get('/api/v1/pricing/rules?type=QUANTITY_DISCOUNT')

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeInstanceOf(Array)
      
      // Verify all returned rules are of correct type
      response.body.data.forEach((rule: any) => {
        expect(rule.type).toBe('QUANTITY_DISCOUNT')
      })
    })
  })

  describe('GET /api/v1/pricing/rules/:ruleId', () => {
    beforeEach(async () => {
      // Create a test rule
      const ruleData = {
        name: 'Test Rule for Details',
        type: 'QUANTITY_DISCOUNT',
        conditions: { minQuantity: 2 },
        discountType: 'PERCENTAGE',
        discountValue: 10,
        isActive: true
      }

      const ruleResponse = await request(app)
        .post('/api/v1/pricing/rules')
        .send(ruleData)

      testRule = ruleResponse.body.data
    })

    test('should get specific pricing rule by ID', async () => {
      const response = await request(app)
        .get(`/api/v1/pricing/rules/${testRule.id}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveProperty('id', testRule.id)
      expect(response.body.data).toHaveProperty('name', 'Test Rule for Details')
    })

    test('should return 404 for non-existent rule', async () => {
      const response = await request(app)
        .get('/api/v1/pricing/rules/non-existent-rule-id')

      expect(response.status).toBe(404)
      expect(response.body.success).toBe(false)
      expect(response.body.error.message).toBe('Pricing rule not found')
    })
  })

  describe('PUT /api/v1/pricing/rules/:ruleId', () => {
    beforeEach(async () => {
      // Create a test rule
      const ruleData = {
        name: 'Test Rule for Update',
        type: 'QUANTITY_DISCOUNT',
        conditions: { minQuantity: 2 },
        discountType: 'PERCENTAGE',
        discountValue: 10,
        isActive: true
      }

      const ruleResponse = await request(app)
        .post('/api/v1/pricing/rules')
        .send(ruleData)

      testRule = ruleResponse.body.data
    })

    test('should update pricing rule', async () => {
      const updateData = {
        name: 'Updated Test Rule',
        discountValue: 20,
        isActive: false
      }

      const response = await request(app)
        .put(`/api/v1/pricing/rules/${testRule.id}`)
        .send(updateData)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveProperty('name', 'Updated Test Rule')
    })

    test('should return 400 for invalid update data', async () => {
      const invalidUpdateData = {
        discountValue: -5
      }

      const response = await request(app)
        .put(`/api/v1/pricing/rules/${testRule.id}`)
        .send(invalidUpdateData)

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
    })
  })

  describe('DELETE /api/v1/pricing/rules/:ruleId', () => {
    beforeEach(async () => {
      // Create a test rule
      const ruleData = {
        name: 'Test Rule for Deletion',
        type: 'QUANTITY_DISCOUNT',
        conditions: { minQuantity: 2 },
        discountType: 'PERCENTAGE',
        discountValue: 10,
        isActive: true
      }

      const ruleResponse = await request(app)
        .post('/api/v1/pricing/rules')
        .send(ruleData)

      testRule = ruleResponse.body.data
    })

    test('should delete pricing rule', async () => {
      const response = await request(app)
        .delete(`/api/v1/pricing/rules/${testRule.id}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.message).toContain('deleted successfully')

      // Verify rule is deleted
      const getResponse = await request(app)
        .get(`/api/v1/pricing/rules/${testRule.id}`)

      expect(getResponse.status).toBe(404)
    })
  })

  describe('POST /api/v1/pricing/rules/:ruleId/test', () => {
    beforeEach(async () => {
      // Create a test rule
      const ruleData = {
        name: 'Test Rule for Testing',
        type: 'QUANTITY_DISCOUNT',
        conditions: { minQuantity: 2 },
        discountType: 'PERCENTAGE',
        discountValue: 15,
        applyToProducts: true,
        productIds: [testProduct.id],
        isActive: true
      }

      const ruleResponse = await request(app)
        .post('/api/v1/pricing/rules')
        .send(ruleData)

      testRule = ruleResponse.body.data
    })

    test('should test pricing rule application', async () => {
      const testData = {
        productId: testProduct.id,
        quantity: 3, // Meets minQuantity condition
        userId: 'test-user-1'
      }

      const response = await request(app)
        .post(`/api/v1/pricing/rules/${testRule.id}/test`)
        .send(testData)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveProperty('productId', testProduct.id)
      expect(response.body.data).toHaveProperty('originalPrice', 100)
      expect(response.body.data).toHaveProperty('finalPrice')
      expect(response.body.data).toHaveProperty('appliedRules')
    })
  })

  describe('GET /api/v1/pricing/analytics', () => {
    test('should get pricing analytics', async () => {
      const response = await request(app)
        .get('/api/v1/pricing/analytics')

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveProperty('summary')
      expect(response.body.data.summary).toHaveProperty('totalApplications')
      expect(response.body.data.summary).toHaveProperty('totalSavings')
      expect(response.body.data.summary).toHaveProperty('averageDiscount')
      expect(response.body.data).toHaveProperty('rulePerformance')
      expect(response.body.data).toHaveProperty('applications')
    })

    test('should get pricing analytics with date filters', async () => {
      const startDate = '2024-01-01'
      const endDate = '2024-12-31'

      const response = await request(app)
        .get(`/api/v1/pricing/analytics?startDate=${startDate}&endDate=${endDate}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.summary.dateRange).toHaveProperty('startDate')
      expect(response.body.data.summary.dateRange).toHaveProperty('endDate')
    })
  })

  describe('Integration Test: Price Calculation with Rules', () => {
    test('should apply quantity discount rule correctly', async () => {
      // First create a quantity discount rule
      const ruleData = {
        name: 'Buy 3+ Get 20% Off',
        type: 'QUANTITY_DISCOUNT',
        conditions: { minQuantity: 3 },
        discountType: 'PERCENTAGE',
        discountValue: 20,
        applyToProducts: true,
        productIds: [testProduct.id],
        isActive: true,
        priority: 1
      }

      await request(app)
        .post('/api/v1/pricing/rules')
        .send(ruleData)

      // Now test price calculation
      const priceRequest = {
        productId: testProduct.id,
        quantity: 3,
        userId: 'test-user-1'
      }

      const response = await request(app)
        .post('/api/v1/pricing/calculate')
        .send(priceRequest)

      expect(response.status).toBe(200)
      expect(response.body.data.originalPrice).toBe(100)
      expect(response.body.data.finalPrice).toBe(80) // 20% discount
      expect(response.body.data.discountAmount).toBe(20)
      expect(response.body.data.savings).toBe(60) // 20 discount * 3 quantity
      expect(response.body.data.savingsPercentage).toBe(20)
      expect(response.body.data.appliedRules).toHaveLength(1)
      expect(response.body.data.appliedRules[0].ruleName).toBe('Buy 3+ Get 20% Off')
    })

    test('should not apply rule when quantity requirement not met', async () => {
      // Test with quantity below threshold
      const priceRequest = {
        productId: testProduct.id,
        quantity: 2, // Below minQuantity of 3
        userId: 'test-user-1'
      }

      const response = await request(app)
        .post('/api/v1/pricing/calculate')
        .send(priceRequest)

      expect(response.status).toBe(200)
      expect(response.body.data.originalPrice).toBe(100)
      expect(response.body.data.finalPrice).toBe(100) // No discount
      expect(response.body.data.discountAmount).toBe(0)
      expect(response.body.data.appliedRules).toHaveLength(0)
    })
  })
})