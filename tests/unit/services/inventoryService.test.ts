import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { InventoryService } from '../../../src/services/inventoryService'
import { prisma } from '../../../src/utils/database'

// Mock dependencies
vi.mock('../../../src/utils/database')
vi.mock('../../../src/services/notificationService')

const mockPrisma = vi.mocked(prisma)

describe('InventoryService', () => {
  let inventoryService: InventoryService

  beforeEach(() => {
    vi.clearAllMocks()
    inventoryService = new InventoryService()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('adjustInventory', () => {
    test('should successfully adjust inventory with SALE type', async () => {
      const mockProduct = {
        id: 'product-1',
        name: 'Test Product',
        sku: 'TEST-001',
        trackQuantity: true,
        quantity: 100,
        lowStockThreshold: 10,
        allowBackorders: false
      }

      const mockLog = {
        id: 'log-1',
        productId: 'product-1',
        type: 'SALE',
        quantity: -5,
        reason: 'Order sale',
        reference: 'ORDER-123',
        createdAt: new Date()
      }

      mockPrisma.product.findUnique.mockResolvedValue(mockProduct as any)
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return await callback(mockPrisma as any)
      })
      mockPrisma.product.update.mockResolvedValue({ ...mockProduct, quantity: 95 } as any)
      mockPrisma.inventoryLog.create.mockResolvedValue(mockLog as any)

      const result = await inventoryService.adjustInventory({
        productId: 'product-1',
        quantity: -5,
        type: 'SALE',
        reason: 'Order sale',
        reference: 'ORDER-123'
      })

      expect(result).toEqual(mockLog)
      expect(mockPrisma.product.update).toHaveBeenCalledWith({
        where: { id: 'product-1' },
        data: { quantity: 95 }
      })
    })

    test('should throw error for insufficient inventory', async () => {
      const mockProduct = {
        id: 'product-1',
        name: 'Test Product',
        sku: 'TEST-001',
        trackQuantity: true,
        quantity: 5,
        lowStockThreshold: 10,
        allowBackorders: false
      }

      mockPrisma.product.findUnique.mockResolvedValue(mockProduct as any)

      await expect(
        inventoryService.adjustInventory({
          productId: 'product-1',
          quantity: -10,
          type: 'SALE'
        })
      ).rejects.toThrow('Insufficient inventory')
    })

    test('should allow negative inventory with backorders enabled', async () => {
      const mockProduct = {
        id: 'product-1',
        name: 'Test Product',
        sku: 'TEST-001',
        trackQuantity: true,
        quantity: 5,
        lowStockThreshold: 10,
        allowBackorders: true
      }

      const mockLog = {
        id: 'log-1',
        productId: 'product-1',
        type: 'SALE',
        quantity: -10,
        createdAt: new Date()
      }

      mockPrisma.product.findUnique.mockResolvedValue(mockProduct as any)
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return await callback(mockPrisma as any)
      })
      mockPrisma.product.update.mockResolvedValue({ ...mockProduct, quantity: -5 } as any)
      mockPrisma.inventoryLog.create.mockResolvedValue(mockLog as any)

      const result = await inventoryService.adjustInventory({
        productId: 'product-1',
        quantity: -10,
        type: 'SALE'
      })

      expect(result).toEqual(mockLog)
    })

    test('should handle RESTOCK type correctly', async () => {
      const mockProduct = {
        id: 'product-1',
        name: 'Test Product',
        sku: 'TEST-001',
        trackQuantity: true,
        quantity: 5,
        lowStockThreshold: 10,
        allowBackorders: false
      }

      mockPrisma.product.findUnique.mockResolvedValue(mockProduct as any)
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return await callback(mockPrisma as any)
      })
      mockPrisma.product.update.mockResolvedValue({ ...mockProduct, quantity: 25 } as any)
      mockPrisma.inventoryLog.create.mockResolvedValue({} as any)

      await inventoryService.adjustInventory({
        productId: 'product-1',
        quantity: 20,
        type: 'RESTOCK'
      })

      expect(mockPrisma.product.update).toHaveBeenCalledWith({
        where: { id: 'product-1' },
        data: { quantity: 25 }
      })
    })

    test('should throw error for product that does not track quantity', async () => {
      const mockProduct = {
        id: 'product-1',
        trackQuantity: false,
        quantity: 100
      }

      mockPrisma.product.findUnique.mockResolvedValue(mockProduct as any)

      await expect(
        inventoryService.adjustInventory({
          productId: 'product-1',
          quantity: -5,
          type: 'SALE'
        })
      ).rejects.toThrow('Product does not track quantity')
    })
  })

  describe('bulkAdjustInventory', () => {
    test('should process multiple inventory adjustments', async () => {
      const adjustments = [
        { productId: 'product-1', quantity: -5, type: 'SALE' as const },
        { productId: 'product-2', quantity: 10, type: 'RESTOCK' as const }
      ]

      const mockProduct1 = {
        id: 'product-1',
        name: 'Product 1',
        sku: 'PROD-001',
        trackQuantity: true,
        quantity: 100,
        lowStockThreshold: 10,
        allowBackorders: false
      }

      const mockProduct2 = {
        id: 'product-2',
        name: 'Product 2',
        sku: 'PROD-002',
        trackQuantity: true,
        quantity: 20,
        lowStockThreshold: 5,
        allowBackorders: false
      }

      mockPrisma.product.findUnique
        .mockResolvedValueOnce(mockProduct1 as any)
        .mockResolvedValueOnce(mockProduct2 as any)

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return await callback(mockPrisma as any)
      })

      mockPrisma.inventoryLog.create
        .mockResolvedValueOnce({ id: 'log-1' } as any)
        .mockResolvedValueOnce({ id: 'log-2' } as any)

      const results = await inventoryService.bulkAdjustInventory(adjustments)

      expect(results).toHaveLength(2)
      expect(mockPrisma.product.findUnique).toHaveBeenCalledTimes(2)
    })
  })

  describe('getLowStockProducts', () => {
    test('should return products with low stock', async () => {
      const mockLowStockProducts = [
        {
          id: 'product-1',
          name: 'Low Stock Product',
          quantity: 3,
          lowStockThreshold: 10,
          category: { name: 'Electronics', slug: 'electronics' }
        }
      ]

      mockPrisma.product.findMany.mockResolvedValue(mockLowStockProducts as any)

      const result = await inventoryService.getLowStockProducts()

      expect(result).toEqual(mockLowStockProducts)
      expect(mockPrisma.product.findMany).toHaveBeenCalledWith({
        where: {
          trackQuantity: true,
          OR: [
            {
              quantity: {
                lte: mockPrisma.product.fields.lowStockThreshold
              }
            },
            {
              quantity: 0
            }
          ]
        },
        include: {
          category: {
            select: { name: true, slug: true }
          }
        },
        orderBy: [
          { quantity: 'asc' },
          { name: 'asc' }
        ]
      })
    })
  })

  describe('getOutOfStockProducts', () => {
    test('should return products that are out of stock', async () => {
      const mockOutOfStockProducts = [
        {
          id: 'product-1',
          name: 'Out of Stock Product',
          quantity: 0,
          category: { name: 'Books', slug: 'books' }
        }
      ]

      mockPrisma.product.findMany.mockResolvedValue(mockOutOfStockProducts as any)

      const result = await inventoryService.getOutOfStockProducts()

      expect(result).toEqual(mockOutOfStockProducts)
      expect(mockPrisma.product.findMany).toHaveBeenCalledWith({
        where: {
          trackQuantity: true,
          quantity: 0
        },
        include: {
          category: {
            select: { name: true, slug: true }
          }
        },
        orderBy: { name: 'asc' }
      })
    })
  })

  describe('reserveInventory', () => {
    test('should reserve inventory for order items', async () => {
      const items = [
        { productId: 'product-1', quantity: 2 },
        { productId: 'product-2', quantity: 1 }
      ]
      const orderId = 'ORDER-123'

      const mockProduct1 = {
        id: 'product-1',
        sku: 'PROD-001',
        trackQuantity: true,
        quantity: 10,
        allowBackorders: false
      }

      const mockProduct2 = {
        id: 'product-2',
        sku: 'PROD-002',
        trackQuantity: true,
        quantity: 5,
        allowBackorders: false
      }

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const txPrisma = {
          ...mockPrisma,
          product: {
            ...mockPrisma.product,
            findUnique: vi.fn()
              .mockResolvedValueOnce(mockProduct1)
              .mockResolvedValueOnce(mockProduct2),
            update: vi.fn().mockResolvedValue({})
          },
          inventoryLog: {
            ...mockPrisma.inventoryLog,
            create: vi.fn().mockResolvedValue({})
          }
        }
        
        return await callback(txPrisma as any)
      })

      await inventoryService.reserveInventory(items, orderId)

      expect(mockPrisma.$transaction).toHaveBeenCalled()
    })

    test('should throw error when insufficient inventory for reservation', async () => {
      const items = [
        { productId: 'product-1', quantity: 15 } // More than available
      ]
      const orderId = 'ORDER-123'

      const mockProduct = {
        id: 'product-1',
        sku: 'PROD-001',
        trackQuantity: true,
        quantity: 10,
        allowBackorders: false
      }

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const txPrisma = {
          ...mockPrisma,
          product: {
            ...mockPrisma.product,
            findUnique: vi.fn().mockResolvedValue(mockProduct)
          }
        }
        
        return await callback(txPrisma as any)
      })

      await expect(
        inventoryService.reserveInventory(items, orderId)
      ).rejects.toThrow('Insufficient inventory for product PROD-001')
    })
  })

  describe('releaseInventory', () => {
    test('should release reserved inventory', async () => {
      const items = [
        { productId: 'product-1', quantity: 2 }
      ]
      const orderId = 'ORDER-123'

      const mockProduct = {
        id: 'product-1',
        sku: 'PROD-001',
        trackQuantity: true,
        quantity: 8
      }

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const txPrisma = {
          ...mockPrisma,
          product: {
            ...mockPrisma.product,
            findUnique: vi.fn().mockResolvedValue(mockProduct),
            update: vi.fn().mockResolvedValue({})
          },
          inventoryLog: {
            ...mockPrisma.inventoryLog,
            create: vi.fn().mockResolvedValue({})
          }
        }
        
        return await callback(txPrisma as any)
      })

      await inventoryService.releaseInventory(items, orderId)

      expect(mockPrisma.$transaction).toHaveBeenCalled()
    })
  })

  describe('generateInventoryReport', () => {
    test('should generate comprehensive inventory report', async () => {
      // Mock the various database calls
      mockPrisma.product.count
        .mockResolvedValueOnce(100) // totalProducts
        .mockResolvedValueOnce(85)  // inStockProducts
        .mockResolvedValueOnce(5)   // outOfStockProducts
        .mockResolvedValueOnce(10)  // lowStockProducts

      mockPrisma.product.aggregate.mockResolvedValue({
        _sum: { quantity: 5000 }
      } as any)

      mockPrisma.product.findMany
        .mockResolvedValueOnce([ // topLowStockProducts
          {
            id: 'product-1',
            name: 'Low Stock Item',
            sku: 'LOW-001',
            quantity: 2,
            lowStockThreshold: 10,
            price: 29.99
          }
        ])
        .mockResolvedValueOnce([ // allProducts for total value calculation
          { quantity: 10, price: 100 },
          { quantity: 20, price: 50 }
        ])

      const report = await inventoryService.generateInventoryReport()

      expect(report).toHaveProperty('totalProducts', 100)
      expect(report).toHaveProperty('inStockProducts', 85)
      expect(report).toHaveProperty('outOfStockProducts', 5)
      expect(report).toHaveProperty('lowStockProducts', 10)
      expect(report).toHaveProperty('totalValue')
      expect(report).toHaveProperty('averageStockLevel')
      expect(report).toHaveProperty('topLowStockProducts')
    })
  })

  describe('getInventoryStats', () => {
    test('should return dashboard statistics', async () => {
      mockPrisma.product.count
        .mockResolvedValueOnce(100)  // totalProducts
        .mockResolvedValueOnce(15)   // lowStockCount
        .mockResolvedValueOnce(5)    // outOfStockCount

      mockPrisma.inventoryLog.count.mockResolvedValue(25) // recentMovements

      mockPrisma.product.findMany.mockResolvedValue([
        { quantity: 10, price: 100 },
        { quantity: 20, price: 50 }
      ] as any)

      const stats = await inventoryService.getInventoryStats()

      expect(stats).toEqual({
        totalProducts: 100,
        lowStockCount: 15,
        outOfStockCount: 5,
        totalValue: 2000, // (10 * 100) + (20 * 50)
        recentMovements: 25
      })
    })
  })
})