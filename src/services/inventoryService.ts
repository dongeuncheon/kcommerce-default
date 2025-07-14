import { Product, InventoryAction, InventoryLog } from '@prisma/client'
import { prisma } from '../utils/database'
import { logger } from '../utils/logger'
import { AppError } from '../middleware/error'
import { notificationService } from './notificationService'

export interface InventoryAlert {
  id: string
  productId: string
  productName: string
  productSku: string
  currentQuantity: number
  lowStockThreshold: number
  alertType: 'LOW_STOCK' | 'OUT_OF_STOCK' | 'CRITICAL_STOCK'
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  createdAt: Date
}

export interface InventoryAdjustment {
  productId: string
  quantity: number
  type: InventoryAction
  reason?: string
  reference?: string
  batchId?: string
}

export interface InventoryReport {
  totalProducts: number
  inStockProducts: number
  outOfStockProducts: number
  lowStockProducts: number
  totalValue: number
  lowStockValue: number
  averageStockLevel: number
  topLowStockProducts: Array<{
    id: string
    name: string
    sku: string
    quantity: number
    lowStockThreshold: number
    value: number
  }>
}

export interface InventoryMovement {
  date: Date
  type: InventoryAction
  quantity: number
  runningBalance: number
  reason?: string
  reference?: string
}

export class InventoryService {

  // Adjust inventory for a single product
  async adjustInventory(adjustment: InventoryAdjustment): Promise<InventoryLog> {
    const { productId, quantity, type, reason, reference, batchId } = adjustment

    try {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: {
          id: true,
          name: true,
          sku: true,
          trackQuantity: true,
          quantity: true,
          lowStockThreshold: true,
          allowBackorders: true,
        },
      })

      if (!product) {
        throw new AppError('Product not found', 404)
      }

      if (!product.trackQuantity) {
        throw new AppError('Product does not track quantity', 400)
      }

      // Calculate new quantity
      const currentQuantity = product.quantity
      let newQuantity: number

      switch (type) {
      case 'SALE':
      case 'DAMAGE':
        newQuantity = currentQuantity - Math.abs(quantity)
        break
      case 'PURCHASE':
      case 'RESTOCK':
      case 'RETURN':
        newQuantity = currentQuantity + Math.abs(quantity)
        break
      case 'ADJUSTMENT':
        newQuantity = currentQuantity + quantity // Can be positive or negative
        break
      default:
        throw new AppError('Invalid inventory action type', 400)
      }

      // Check for negative inventory
      if (newQuantity < 0 && !product.allowBackorders) {
        throw new AppError(
          `Insufficient inventory. Current: ${currentQuantity}, Requested: ${Math.abs(quantity)}`,
          400,
        )
      }

      // Perform the transaction
      const result = await prisma.$transaction(async (tx) => {
        // Update product quantity
        await tx.product.update({
          where: { id: productId },
          data: { quantity: newQuantity },
        })

        // Create inventory log
        const log = await tx.inventoryLog.create({
          data: {
            productId,
            type,
            quantity,
            reason,
            reference: reference || batchId,
          },
        })

        return log
      })

      // Check if low stock alert should be triggered
      await this.checkAndCreateLowStockAlert(productId, newQuantity, product.lowStockThreshold)

      logger.info(`Inventory adjusted for product ${product.sku}: ${quantity} (${type})`)
      return result

    } catch (error) {
      logger.error('Inventory adjustment failed:', error)
      throw error
    }
  }

  // Bulk inventory adjustments
  async bulkAdjustInventory(adjustments: InventoryAdjustment[]): Promise<InventoryLog[]> {
    try {
      const results: InventoryLog[] = []
      const batchId = `BATCH-${Date.now()}`

      // Process each adjustment
      for (const adjustment of adjustments) {
        try {
          const result = await this.adjustInventory({
            ...adjustment,
            batchId,
          })
          results.push(result)
        } catch (error) {
          logger.error(`Failed to adjust inventory for product ${adjustment.productId}:`, error)
          // Continue with other adjustments instead of failing the entire batch
        }
      }

      logger.info(`Bulk inventory adjustment completed. Processed ${results.length}/${adjustments.length} items`)
      return results

    } catch (error) {
      logger.error('Bulk inventory adjustment failed:', error)
      throw new AppError('Bulk inventory adjustment failed', 500)
    }
  }

  // Get low stock products
  async getLowStockProducts(): Promise<Array<Product & { category: { name: string; slug: string } | null }>> {
    try {
      const products = await prisma.product.findMany({
        where: {
          trackQuantity: true,
          OR: [
            {
              quantity: {
                lte: prisma.product.fields.lowStockThreshold,
              },
            },
            {
              quantity: 0,
            },
          ],
        },
        include: {
          category: {
            select: { name: true, slug: true },
          },
        },
        orderBy: [
          { quantity: 'asc' },
          { name: 'asc' },
        ],
      })

      return products
    } catch (error) {
      logger.error('Failed to get low stock products:', error)
      throw new AppError('Failed to retrieve low stock products', 500)
    }
  }

  // Get out of stock products
  async getOutOfStockProducts(): Promise<Array<Product & { category: { name: string; slug: string } | null }>> {
    try {
      const products = await prisma.product.findMany({
        where: {
          trackQuantity: true,
          quantity: 0,
        },
        include: {
          category: {
            select: { name: true, slug: true },
          },
        },
        orderBy: { name: 'asc' },
      })

      return products
    } catch (error) {
      logger.error('Failed to get out of stock products:', error)
      throw new AppError('Failed to retrieve out of stock products', 500)
    }
  }

  // Generate inventory report
  async generateInventoryReport(): Promise<InventoryReport> {
    try {
      const [
        totalProducts,
        inStockProducts,
        outOfStockProducts,
        lowStockProducts,
        inventoryValue,
        topLowStockProducts,
      ] = await Promise.all([
        // Total products that track quantity
        prisma.product.count({
          where: { trackQuantity: true },
        }),

        // In stock products
        prisma.product.count({
          where: {
            trackQuantity: true,
            quantity: { gt: 0 },
          },
        }),

        // Out of stock products
        prisma.product.count({
          where: {
            trackQuantity: true,
            quantity: 0,
          },
        }),

        // Low stock products
        prisma.product.count({
          where: {
            trackQuantity: true,
            quantity: {
              gt: 0,
              lte: prisma.product.fields.lowStockThreshold,
            },
          },
        }),

        // Calculate total inventory value
        prisma.product.aggregate({
          where: { trackQuantity: true },
          _sum: {
            quantity: true,
          },
        }),

        // Top 10 low stock products
        prisma.product.findMany({
          where: {
            trackQuantity: true,
            quantity: {
              lte: prisma.product.fields.lowStockThreshold,
            },
          },
          select: {
            id: true,
            name: true,
            sku: true,
            quantity: true,
            lowStockThreshold: true,
            price: true,
          },
          orderBy: { quantity: 'asc' },
          take: 10,
        }),
      ])

      // Calculate low stock value
      const lowStockValue = topLowStockProducts.reduce((total, product) => {
        return total + (Number(product.price) * product.quantity)
      }, 0)

      // Calculate total value (simplified - using current stock * price)
      const allProducts = await prisma.product.findMany({
        where: { trackQuantity: true },
        select: { quantity: true, price: true },
      })

      const totalValue = allProducts.reduce((total, product) => {
        return total + (Number(product.price) * product.quantity)
      }, 0)

      return {
        totalProducts,
        inStockProducts,
        outOfStockProducts,
        lowStockProducts,
        totalValue,
        lowStockValue,
        averageStockLevel: inventoryValue._sum.quantity ?
          Math.round(inventoryValue._sum.quantity / totalProducts) : 0,
        topLowStockProducts: topLowStockProducts.map(p => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          quantity: p.quantity,
          lowStockThreshold: p.lowStockThreshold,
          value: Number(p.price) * p.quantity,
        })),
      }
    } catch (error) {
      logger.error('Failed to generate inventory report:', error)
      throw new AppError('Failed to generate inventory report', 500)
    }
  }

  // Get inventory movements for a product
  async getProductInventoryHistory(
    productId: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<InventoryMovement[]> {
    try {
      const logs = await prisma.inventoryLog.findMany({
        where: { productId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      })

      // Calculate running balance
      let runningBalance = 0
      const movements: InventoryMovement[] = []

      // Get current quantity to start calculation
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { quantity: true },
      })

      if (!product) {
        throw new AppError('Product not found', 404)
      }

      runningBalance = product.quantity

      // Process logs in reverse order to calculate running balance
      for (let i = 0; i < logs.length; i++) {
        const log = logs[i]

        movements.unshift({
          date: log.createdAt,
          type: log.type,
          quantity: log.quantity,
          runningBalance,
          reason: log.reason || undefined,
          reference: log.reference || undefined,
        })

        // Adjust running balance for previous state
        switch (log.type) {
        case 'SALE':
        case 'DAMAGE':
          runningBalance += Math.abs(log.quantity)
          break
        case 'PURCHASE':
        case 'RESTOCK':
        case 'RETURN':
          runningBalance -= Math.abs(log.quantity)
          break
        case 'ADJUSTMENT':
          runningBalance -= log.quantity
          break
        }
      }

      return movements.reverse() // Return in chronological order
    } catch (error) {
      logger.error('Failed to get inventory history:', error)
      throw new AppError('Failed to retrieve inventory history', 500)
    }
  }

  // Reserve inventory for an order
  async reserveInventory(items: Array<{ productId: string; quantity: number }>, orderId: string): Promise<void> {
    try {
      await prisma.$transaction(async (tx) => {
        for (const item of items) {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
            select: {
              id: true,
              sku: true,
              trackQuantity: true,
              quantity: true,
              allowBackorders: true,
            },
          })

          if (!product) {
            throw new AppError(`Product not found: ${item.productId}`, 404)
          }

          if (!product.trackQuantity) {
            continue // Skip products that don't track quantity
          }

          if (product.quantity < item.quantity && !product.allowBackorders) {
            throw new AppError(
              `Insufficient inventory for product ${product.sku}. Available: ${product.quantity}, Requested: ${item.quantity}`,
              400,
            )
          }

          // Reserve the inventory
          await tx.product.update({
            where: { id: item.productId },
            data: { quantity: product.quantity - item.quantity },
          })

          // Log the reservation
          await tx.inventoryLog.create({
            data: {
              productId: item.productId,
              type: 'SALE',
              quantity: -item.quantity,
              reason: 'Order reservation',
              reference: orderId,
            },
          })
        }
      })

      logger.info(`Inventory reserved for order: ${orderId}`)
    } catch (error) {
      logger.error('Failed to reserve inventory:', error)
      throw error
    }
  }

  // Release reserved inventory (e.g., when order is cancelled)
  async releaseInventory(items: Array<{ productId: string; quantity: number }>, orderId: string): Promise<void> {
    try {
      await prisma.$transaction(async (tx) => {
        for (const item of items) {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
            select: {
              id: true,
              sku: true,
              trackQuantity: true,
              quantity: true,
            },
          })

          if (!product || !product.trackQuantity) {
            continue
          }

          // Release the inventory
          await tx.product.update({
            where: { id: item.productId },
            data: { quantity: product.quantity + item.quantity },
          })

          // Log the release
          await tx.inventoryLog.create({
            data: {
              productId: item.productId,
              type: 'RETURN',
              quantity: item.quantity,
              reason: 'Order cancellation',
              reference: orderId,
            },
          })
        }
      })

      logger.info(`Inventory released for order: ${orderId}`)
    } catch (error) {
      logger.error('Failed to release inventory:', error)
      throw error
    }
  }

  // Check for low stock and create alert if needed
  private async checkAndCreateLowStockAlert(
    productId: string,
    currentQuantity: number,
    lowStockThreshold: number,
  ): Promise<void> {
    try {
      let alertType: 'LOW_STOCK' | 'OUT_OF_STOCK' | 'CRITICAL_STOCK' | null = null

      if (currentQuantity === 0) {
        alertType = 'OUT_OF_STOCK'
      } else if (currentQuantity <= Math.floor(lowStockThreshold * 0.5)) {
        alertType = 'CRITICAL_STOCK'
      } else if (currentQuantity <= lowStockThreshold) {
        alertType = 'LOW_STOCK'
      }

      if (alertType) {
        // Get product details for the alert
        const product = await prisma.product.findUnique({
          where: { id: productId },
          include: {
            category: {
              select: { name: true },
            },
          },
        })

        if (product) {
          // Send low stock alert notification
          await notificationService.sendLowStockAlert({
            productId,
            productName: product.name,
            productSku: product.sku,
            currentQuantity,
            lowStockThreshold,
            categoryName: product.category?.name,
            alertType,
          })
        }

        logger.warn(`Inventory alert for product ${productId}: ${alertType} (quantity: ${currentQuantity}, threshold: ${lowStockThreshold})`)
      }
    } catch (error) {
      logger.error('Failed to check low stock alert:', error)
      // Don't throw error here to avoid breaking the main inventory operation
    }
  }

  // Get inventory statistics for dashboard
  async getInventoryStats(): Promise<{
    totalProducts: number
    lowStockCount: number
    outOfStockCount: number
    totalValue: number
    recentMovements: number
  }> {
    try {
      const [
        totalProducts,
        lowStockCount,
        outOfStockCount,
        recentMovements,
      ] = await Promise.all([
        prisma.product.count({ where: { trackQuantity: true } }),
        prisma.product.count({
          where: {
            trackQuantity: true,
            quantity: { lte: prisma.product.fields.lowStockThreshold },
          },
        }),
        prisma.product.count({
          where: {
            trackQuantity: true,
            quantity: 0,
          },
        }),
        prisma.inventoryLog.count({
          where: {
            createdAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
            },
          },
        }),
      ])

      // Calculate total value
      const products = await prisma.product.findMany({
        where: { trackQuantity: true },
        select: { quantity: true, price: true },
      })

      const totalValue = products.reduce((sum, product) => {
        return sum + (Number(product.price) * product.quantity)
      }, 0)

      return {
        totalProducts,
        lowStockCount,
        outOfStockCount,
        totalValue,
        recentMovements,
      }
    } catch (error) {
      logger.error('Failed to get inventory stats:', error)
      throw new AppError('Failed to retrieve inventory statistics', 500)
    }
  }
}

export const inventoryService = new InventoryService()
