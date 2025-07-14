import { PricingService } from '../../../src/services/pricingService'
import { prisma } from '../../../src/utils/database'

// Mock dependencies
jest.mock('../../../src/utils/database')

const mockPrisma = prisma as jest.Mocked<typeof prisma>

describe('PricingService', () => {
  let pricingService: PricingService

  beforeEach(() => {
    jest.clearAllMocks()
    pricingService = new PricingService()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('calculatePrice', () => {
    test('should calculate price with no applicable rules', async () => {
      const mockProduct = {
        id: 'product-1',
        name: 'Test Product',
        price: 100,
        categoryId: 'category-1',
        quantity: 50
      }

      mockPrisma.product.findUnique.mockResolvedValue(mockProduct as any)
      mockPrisma.pricingRule.findMany.mockResolvedValue([])

      const request = {
        productId: 'product-1',
        quantity: 2,
        userId: 'user-1'
      }

      const result = await pricingService.calculatePrice(request)

      expect(result).toEqual({
        productId: 'product-1',
        originalPrice: 100,
        finalPrice: 100,
        discountAmount: 0,
        appliedRules: [],
        savings: 0,
        savingsPercentage: 0
      })
    })

    test('should calculate price with percentage discount rule', async () => {
      const mockProduct = {
        id: 'product-1',
        name: 'Test Product',
        price: 100,
        categoryId: 'category-1',
        quantity: 50
      }

      const mockRule = {
        id: 'rule-1',
        name: 'Quantity Discount',
        type: 'QUANTITY_DISCOUNT',
        discountType: 'PERCENTAGE',
        discountValue: 10,
        priority: 1,
        conditions: { minQuantity: 2 },
        usageLimit: null,
        usageCount: 0,
        perCustomerLimit: null,
        products: [],
        categories: [],
        customerGroups: []
      }

      mockPrisma.product.findUnique.mockResolvedValue(mockProduct as any)
      mockPrisma.pricingRule.findMany.mockResolvedValue([mockRule] as any)
      mockPrisma.pricingApplication.count.mockResolvedValue(0)
      mockPrisma.pricingApplication.create.mockResolvedValue({} as any)
      mockPrisma.pricingRule.update.mockResolvedValue(mockRule as any)

      const request = {
        productId: 'product-1',
        quantity: 2,
        userId: 'user-1'
      }

      const result = await pricingService.calculatePrice(request)

      expect(result.originalPrice).toBe(100)
      expect(result.finalPrice).toBe(90)
      expect(result.discountAmount).toBe(10)
      expect(result.savings).toBe(20) // 10 discount * 2 quantity
      expect(result.savingsPercentage).toBe(10)
      expect(result.appliedRules).toHaveLength(1)
      expect(result.appliedRules[0].ruleName).toBe('Quantity Discount')
    })

    test('should calculate price with fixed amount discount', async () => {
      const mockProduct = {
        id: 'product-1',
        name: 'Test Product',
        price: 100,
        categoryId: 'category-1',
        quantity: 50
      }

      const mockRule = {
        id: 'rule-1',
        name: 'Fixed Discount',
        type: 'QUANTITY_DISCOUNT',
        discountType: 'FIXED_AMOUNT',
        discountValue: 15,
        priority: 1,
        conditions: { minQuantity: 1 },
        usageLimit: null,
        usageCount: 0,
        perCustomerLimit: null,
        products: [],
        categories: [],
        customerGroups: []
      }

      mockPrisma.product.findUnique.mockResolvedValue(mockProduct as any)
      mockPrisma.pricingRule.findMany.mockResolvedValue([mockRule] as any)
      mockPrisma.pricingApplication.count.mockResolvedValue(0)
      mockPrisma.pricingApplication.create.mockResolvedValue({} as any)
      mockPrisma.pricingRule.update.mockResolvedValue(mockRule as any)

      const request = {
        productId: 'product-1',
        quantity: 1,
        userId: 'user-1'
      }

      const result = await pricingService.calculatePrice(request)

      expect(result.originalPrice).toBe(100)
      expect(result.finalPrice).toBe(85)
      expect(result.discountAmount).toBe(15)
      expect(result.savings).toBe(15)
      expect(result.savingsPercentage).toBe(15)
    })

    test('should apply multiple rules in priority order', async () => {
      const mockProduct = {
        id: 'product-1',
        name: 'Test Product',
        price: 100,
        categoryId: 'category-1',
        quantity: 50
      }

      const mockRules = [
        {
          id: 'rule-1',
          name: 'High Priority Rule',
          type: 'QUANTITY_DISCOUNT',
          discountType: 'PERCENTAGE',
          discountValue: 20,
          priority: 10,
          conditions: { minQuantity: 1 },
          usageLimit: null,
          usageCount: 0,
          perCustomerLimit: null,
          products: [],
          categories: [],
          customerGroups: []
        },
        {
          id: 'rule-2',
          name: 'Low Priority Rule',
          type: 'QUANTITY_DISCOUNT',
          discountType: 'PERCENTAGE',
          discountValue: 10,
          priority: 1,
          conditions: { minQuantity: 1 },
          usageLimit: null,
          usageCount: 0,
          perCustomerLimit: null,
          products: [],
          categories: [],
          customerGroups: []
        }
      ]

      mockPrisma.product.findUnique.mockResolvedValue(mockProduct as any)
      mockPrisma.pricingRule.findMany.mockResolvedValue(mockRules as any)
      mockPrisma.pricingApplication.count.mockResolvedValue(0)
      mockPrisma.pricingApplication.create.mockResolvedValue({} as any)
      mockPrisma.pricingRule.update.mockResolvedValue({} as any)

      const request = {
        productId: 'product-1',
        quantity: 1,
        userId: 'user-1'
      }

      const result = await pricingService.calculatePrice(request)

      expect(result.appliedRules).toHaveLength(2)
      expect(result.appliedRules[0].ruleName).toBe('High Priority Rule')
      expect(result.appliedRules[1].ruleName).toBe('Low Priority Rule')
      // Final price: 100 - 20% = 80, then 80 - 10% = 72
      expect(result.finalPrice).toBe(72)
    })

    test('should respect usage limits', async () => {
      const mockProduct = {
        id: 'product-1',
        name: 'Test Product',
        price: 100,
        categoryId: 'category-1',
        quantity: 50
      }

      const mockRule = {
        id: 'rule-1',
        name: 'Limited Rule',
        type: 'QUANTITY_DISCOUNT',
        discountType: 'PERCENTAGE',
        discountValue: 10,
        priority: 1,
        conditions: { minQuantity: 1 },
        usageLimit: 100,
        usageCount: 100, // Already at limit
        perCustomerLimit: null,
        products: [],
        categories: [],
        customerGroups: []
      }

      mockPrisma.product.findUnique.mockResolvedValue(mockProduct as any)
      mockPrisma.pricingRule.findMany.mockResolvedValue([mockRule] as any)

      const request = {
        productId: 'product-1',
        quantity: 1,
        userId: 'user-1'
      }

      const result = await pricingService.calculatePrice(request)

      expect(result.finalPrice).toBe(100) // No discount applied
      expect(result.appliedRules).toHaveLength(0)
    })

    test('should throw error for non-existent product', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null)

      const request = {
        productId: 'non-existent',
        quantity: 1
      }

      await expect(pricingService.calculatePrice(request)).rejects.toThrow('Product with ID non-existent not found')
    })
  })

  describe('calculateBulkPricing', () => {
    test('should calculate pricing for multiple items', async () => {
      const mockProducts = [
        { id: 'product-1', name: 'Product 1', price: 100, categoryId: 'cat-1', quantity: 50 },
        { id: 'product-2', name: 'Product 2', price: 200, categoryId: 'cat-2', quantity: 30 }
      ]

      mockPrisma.product.findUnique
        .mockResolvedValueOnce(mockProducts[0] as any)
        .mockResolvedValueOnce(mockProducts[1] as any)
      
      mockPrisma.pricingRule.findMany.mockResolvedValue([])

      const request = {
        items: [
          { productId: 'product-1', quantity: 2 },
          { productId: 'product-2', quantity: 1 }
        ],
        userId: 'user-1'
      }

      const result = await pricingService.calculateBulkPricing(request)

      expect(result.items).toHaveLength(2)
      expect(result.totalOriginalPrice).toBe(400) // (100 * 2) + (200 * 1)
      expect(result.totalFinalPrice).toBe(400)
      expect(result.totalSavings).toBe(0)
      expect(result.totalSavingsPercentage).toBe(0)
    })
  })

  describe('createPricingRule', () => {
    test('should create a new pricing rule', async () => {
      const mockRule = {
        id: 'rule-1',
        name: 'Test Rule',
        type: 'QUANTITY_DISCOUNT',
        discountType: 'PERCENTAGE',
        discountValue: 10
      }

      mockPrisma.pricingRule.create.mockResolvedValue(mockRule as any)
      mockPrisma.pricingRuleCategory.createMany.mockResolvedValue({ count: 0 } as any)
      mockPrisma.pricingRuleProduct.createMany.mockResolvedValue({ count: 0 } as any)
      mockPrisma.pricingRuleCustomerGroup.createMany.mockResolvedValue({ count: 0 } as any)

      const data = {
        name: 'Test Rule',
        type: 'QUANTITY_DISCOUNT',
        discountType: 'PERCENTAGE',
        discountValue: 10,
        conditions: { minQuantity: 2 }
      }

      const result = await pricingService.createPricingRule(data)

      expect(result).toEqual(mockRule)
      expect(mockPrisma.pricingRule.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Test Rule',
          type: 'QUANTITY_DISCOUNT',
          discountType: 'PERCENTAGE'
        })
      })
    })

    test('should create rule with category associations', async () => {
      const mockRule = { id: 'rule-1', name: 'Category Rule' }

      mockPrisma.pricingRule.create.mockResolvedValue(mockRule as any)
      mockPrisma.pricingRuleCategory.createMany.mockResolvedValue({ count: 2 } as any)

      const data = {
        name: 'Category Rule',
        type: 'CATEGORY_DISCOUNT',
        discountType: 'PERCENTAGE',
        discountValue: 15,
        conditions: {},
        categoryIds: ['cat-1', 'cat-2']
      }

      await pricingService.createPricingRule(data)

      expect(mockPrisma.pricingRuleCategory.createMany).toHaveBeenCalledWith({
        data: [
          { ruleId: 'rule-1', categoryId: 'cat-1' },
          { ruleId: 'rule-1', categoryId: 'cat-2' }
        ]
      })
    })
  })

  describe('getPricingRules', () => {
    test('should get all pricing rules with filters', async () => {
      const mockRules = [
        {
          id: 'rule-1',
          name: 'Active Rule',
          isActive: true,
          type: 'QUANTITY_DISCOUNT',
          priority: 10
        },
        {
          id: 'rule-2',
          name: 'Inactive Rule',
          isActive: false,
          type: 'TIME_BASED',
          priority: 5
        }
      ]

      mockPrisma.pricingRule.findMany.mockResolvedValue(mockRules as any)

      const filters = { isActive: true, type: 'QUANTITY_DISCOUNT' }
      const result = await pricingService.getPricingRules(filters)

      expect(result).toEqual(mockRules)
      expect(mockPrisma.pricingRule.findMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
          type: 'QUANTITY_DISCOUNT'
        },
        include: expect.any(Object),
        orderBy: expect.any(Array)
      })
    })
  })

  describe('getPricingAnalytics', () => {
    test('should generate pricing analytics', async () => {
      const mockApplications = [
        {
          id: 'app-1',
          ruleId: 'rule-1',
          discountAmount: 10,
          rule: { name: 'Test Rule', type: 'QUANTITY_DISCOUNT' },
          product: { name: 'Test Product', sku: 'TEST-001' }
        },
        {
          id: 'app-2',
          ruleId: 'rule-1',
          discountAmount: 15,
          rule: { name: 'Test Rule', type: 'QUANTITY_DISCOUNT' },
          product: { name: 'Test Product 2', sku: 'TEST-002' }
        }
      ]

      mockPrisma.pricingApplication.findMany.mockResolvedValue(mockApplications as any)

      const result = await pricingService.getPricingAnalytics()

      expect(result.summary.totalApplications).toBe(2)
      expect(result.summary.totalSavings).toBe(25)
      expect(result.summary.averageDiscount).toBe(12.5)
      expect(result.rulePerformance).toHaveLength(1)
      expect((result.rulePerformance as any)[0].applications).toBe(2)
      expect((result.rulePerformance as any)[0].totalSavings).toBe(25)
    })
  })

  describe('Time-based rule evaluation', () => {
    test('should evaluate time-of-day conditions', async () => {
      const mockProduct = {
        id: 'product-1',
        price: 100,
        categoryId: 'cat-1',
        quantity: 50
      }

      const mockRule = {
        id: 'rule-1',
        name: 'Happy Hour',
        type: 'TIME_BASED',
        discountType: 'PERCENTAGE',
        discountValue: 20,
        priority: 1,
        conditions: {
          timeOfDay: { startHour: 9, endHour: 17 }
        },
        usageLimit: null,
        usageCount: 0,
        perCustomerLimit: null,
        products: [],
        categories: [],
        customerGroups: []
      }

      mockPrisma.product.findUnique.mockResolvedValue(mockProduct as any)
      mockPrisma.pricingRule.findMany.mockResolvedValue([mockRule] as any)
      mockPrisma.pricingApplication.count.mockResolvedValue(0)
      mockPrisma.pricingApplication.create.mockResolvedValue({} as any)
      mockPrisma.pricingRule.update.mockResolvedValue(mockRule as any)

      // Mock current time to be within happy hour (e.g., 14:00)
      const mockDate = new Date()
      mockDate.setHours(14, 0, 0, 0)
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any)

      const request = {
        productId: 'product-1',
        quantity: 1
      }

      const result = await pricingService.calculatePrice(request)

      expect(result.finalPrice).toBe(80) // 20% discount applied
      expect(result.appliedRules).toHaveLength(1)
    })
  })

  describe('Inventory-based rule evaluation', () => {
    test('should apply discount for low stock items', async () => {
      const mockProduct = {
        id: 'product-1',
        price: 100,
        categoryId: 'cat-1',
        quantity: 3, // Below threshold
        lowStockThreshold: 10
      }

      const mockRule = {
        id: 'rule-1',
        name: 'Low Stock Clearance',
        type: 'INVENTORY_BASED',
        discountType: 'PERCENTAGE',
        discountValue: 30,
        priority: 1,
        conditions: { lowStockOnly: true },
        usageLimit: null,
        usageCount: 0,
        perCustomerLimit: null,
        products: [],
        categories: [],
        customerGroups: []
      }

      mockPrisma.product.findUnique.mockResolvedValue(mockProduct as any)
      mockPrisma.pricingRule.findMany.mockResolvedValue([mockRule] as any)
      mockPrisma.pricingApplication.count.mockResolvedValue(0)
      mockPrisma.pricingApplication.create.mockResolvedValue({} as any)
      mockPrisma.pricingRule.update.mockResolvedValue(mockRule as any)

      const request = {
        productId: 'product-1',
        quantity: 1
      }

      const result = await pricingService.calculatePrice(request)

      expect(result.finalPrice).toBe(70) // 30% discount applied
      expect(result.appliedRules).toHaveLength(1)
      expect(result.appliedRules[0].ruleName).toBe('Low Stock Clearance')
    })
  })
})