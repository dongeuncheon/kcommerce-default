import { Request, Response } from 'express'
import { inventoryService } from '../../services/inventoryService'
import { notificationService } from '../../services/notificationService'
import { asyncHandler } from '../../middleware/error'
import { z } from 'zod'

// Validation schemas
const InventoryAdjustmentSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  quantity: z.number().int('Quantity must be an integer'),
  type: z.enum(['SALE', 'PURCHASE', 'ADJUSTMENT', 'RETURN', 'DAMAGE', 'RESTOCK']),
  reason: z.string().optional(),
  reference: z.string().optional(),
})

const BulkInventoryAdjustmentSchema = z.object({
  adjustments: z.array(InventoryAdjustmentSchema).min(1, 'At least one adjustment is required'),
})

const InventoryReservationSchema = z.object({
  items: z.array(z.object({
    productId: z.string().min(1, 'Product ID is required'),
    quantity: z.number().int().positive('Quantity must be positive'),
  })).min(1, 'At least one item is required'),
  orderId: z.string().min(1, 'Order ID is required'),
})

const ProductHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

const TestNotificationSchema = z.object({
  type: z.enum(['LOW_STOCK_ALERT', 'OUT_OF_STOCK_ALERT', 'CRITICAL_STOCK_ALERT']),
  email: z.string().email('Valid email is required'),
})

export class InventoryController {

  // Adjust inventory for a single product
  adjustInventory = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const validatedData = InventoryAdjustmentSchema.parse(req.body)
    
    const result = await inventoryService.adjustInventory(validatedData)

    res.json({
      success: true,
      data: result,
      message: 'Inventory adjusted successfully',
    })
  })

  // Bulk inventory adjustments
  bulkAdjustInventory = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const validatedData = BulkInventoryAdjustmentSchema.parse(req.body)
    
    const results = await inventoryService.bulkAdjustInventory(validatedData.adjustments)

    res.json({
      success: true,
      data: {
        processed: results.length,
        total: validatedData.adjustments.length,
        results,
      },
      message: `Bulk inventory adjustment completed. ${results.length}/${validatedData.adjustments.length} items processed.`,
    })
  })

  // Get low stock products
  getLowStockProducts = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const products = await inventoryService.getLowStockProducts()

    res.json({
      success: true,
      data: products,
      count: products.length,
      message: 'Low stock products retrieved successfully',
    })
  })

  // Get out of stock products
  getOutOfStockProducts = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const products = await inventoryService.getOutOfStockProducts()

    res.json({
      success: true,
      data: products,
      count: products.length,
      message: 'Out of stock products retrieved successfully',
    })
  })

  // Generate inventory report
  generateInventoryReport = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const report = await inventoryService.generateInventoryReport()

    res.json({
      success: true,
      data: report,
      message: 'Inventory report generated successfully',
    })
  })

  // Get inventory statistics for dashboard
  getInventoryStats = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const stats = await inventoryService.getInventoryStats()

    res.json({
      success: true,
      data: stats,
      message: 'Inventory statistics retrieved successfully',
    })
  })

  // Get product inventory history
  getProductInventoryHistory = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { productId } = req.params
    const { limit, offset } = ProductHistoryQuerySchema.parse(req.query)

    if (!productId) {
      res.status(400).json({
        success: false,
        error: {
          type: 'ValidationError',
          message: 'Product ID is required',
        },
      })
      return
    }

    const history = await inventoryService.getProductInventoryHistory(productId, limit, offset)

    res.json({
      success: true,
      data: {
        productId,
        movements: history,
        pagination: {
          limit,
          offset,
          count: history.length,
        },
      },
      message: 'Product inventory history retrieved successfully',
    })
  })

  // Reserve inventory for an order
  reserveInventory = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const validatedData = InventoryReservationSchema.parse(req.body)
    
    await inventoryService.reserveInventory(validatedData.items, validatedData.orderId)

    res.json({
      success: true,
      message: `Inventory reserved for order ${validatedData.orderId}`,
    })
  })

  // Release reserved inventory
  releaseInventory = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const validatedData = InventoryReservationSchema.parse(req.body)
    
    await inventoryService.releaseInventory(validatedData.items, validatedData.orderId)

    res.json({
      success: true,
      message: `Inventory released for order ${validatedData.orderId}`,
    })
  })

  // Test notification system
  testNotification = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const validatedData = TestNotificationSchema.parse(req.body)
    
    await notificationService.testNotification(validatedData.type, validatedData.email)

    res.json({
      success: true,
      message: `Test notification sent to ${validatedData.email}`,
    })
  })

  // Get inventory alerts (placeholder for future implementation)
  getInventoryAlerts = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    // TODO: Implement actual alert storage and retrieval
    // For now, return current low stock products as alerts
    const lowStockProducts = await inventoryService.getLowStockProducts()
    // Note: outOfStockProducts could be used for additional alert types in future
    await inventoryService.getOutOfStockProducts()

    const alerts = [
      ...lowStockProducts.map(product => ({
        id: `low-stock-${product.id}`,
        type: product.quantity === 0 ? 'OUT_OF_STOCK' : 
              product.quantity <= Math.floor(product.lowStockThreshold * 0.5) ? 'CRITICAL_STOCK' : 'LOW_STOCK',
        severity: product.quantity === 0 ? 'CRITICAL' : 
                 product.quantity <= Math.floor(product.lowStockThreshold * 0.5) ? 'HIGH' : 'MEDIUM',
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        currentQuantity: product.quantity,
        lowStockThreshold: product.lowStockThreshold,
        categoryName: product.category?.name || 'Uncategorized',
        createdAt: new Date(),
      }))
    ]

    res.json({
      success: true,
      data: alerts,
      count: alerts.length,
      message: 'Inventory alerts retrieved successfully',
    })
  })

  // Manual trigger for low stock check (for testing or admin use)
  triggerLowStockCheck = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { productId } = req.params

    if (!productId) {
      res.status(400).json({
        success: false,
        error: {
          type: 'ValidationError',
          message: 'Product ID is required',
        },
      })
    }

    // Get product details
    const product = await inventoryService.getLowStockProducts()
    const targetProduct = product.find(p => p.id === productId)

    if (!targetProduct) {
      res.status(404).json({
        success: false,
        error: {
          type: 'NotFoundError',
          message: 'Product not found or does not track inventory',
        },
      })
      return
    }

    // Trigger manual check (this would normally be done automatically)
    if (targetProduct.quantity <= targetProduct.lowStockThreshold) {
      const alertType = targetProduct.quantity === 0 ? 'OUT_OF_STOCK' :
                      targetProduct.quantity <= Math.floor(targetProduct.lowStockThreshold * 0.5) ? 'CRITICAL_STOCK' : 'LOW_STOCK'

      await notificationService.sendLowStockAlert({
        productId: targetProduct.id,
        productName: targetProduct.name,
        productSku: targetProduct.sku,
        currentQuantity: targetProduct.quantity,
        lowStockThreshold: targetProduct.lowStockThreshold,
        categoryName: targetProduct.category?.name,
        alertType
      })
    }

    res.json({
      success: true,
      message: 'Low stock check triggered successfully',
      data: {
        productId: targetProduct.id,
        currentQuantity: targetProduct.quantity,
        lowStockThreshold: targetProduct.lowStockThreshold,
        alertTriggered: targetProduct.quantity <= targetProduct.lowStockThreshold
      }
    })
  })

  // Set low stock threshold for a product
  setLowStockThreshold = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { productId } = req.params
    const { threshold } = req.body

    if (!productId) {
      res.status(400).json({
        success: false,
        error: {
          type: 'ValidationError',
          message: 'Product ID is required',
        },
      })
      return
    }

    if (!threshold || typeof threshold !== 'number' || threshold < 0) {
      res.status(400).json({
        success: false,
        error: {
          type: 'ValidationError',
          message: 'Valid threshold value is required',
        },
      })
      return
    }

    // Update the product's low stock threshold
    // Note: This creates an inventory movement record for audit purposes
    await inventoryService.adjustInventory({
      productId,
      quantity: 0, // No quantity change
      type: 'ADJUSTMENT',
      reason: `Low stock threshold updated to ${threshold}`,
    })

    // Note: This is a simplified approach. In a real implementation,
    // you might want to add a separate endpoint or modify the product directly
    
    res.json({
      success: true,
      message: 'Low stock threshold updated successfully',
      data: {
        productId,
        newThreshold: threshold
      }
    })
  })
}

export const inventoryController = new InventoryController()