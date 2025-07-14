import { Request, Response } from 'express'
import { pricingService } from '../../services/pricingService'
import { logger } from '../../utils/logger'
import { z } from 'zod'

// Validation schemas
const calculatePriceSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  quantity: z.number().min(1, 'Quantity must be at least 1'),
  userId: z.string().optional(),
  customerGroup: z.string().optional(),
  context: z.object({
    cartTotal: z.number().optional(),
    isFirstPurchase: z.boolean().optional(),
    timeOfDay: z.string().optional(),
    seasonalContext: z.string().optional()
  }).optional()
})

const bulkCalculatePriceSchema = z.object({
  items: z.array(calculatePriceSchema),
  userId: z.string().optional(),
  customerGroup: z.string().optional(),
  context: z.any().optional()
})

const createPricingRuleSchema = z.object({
  name: z.string().min(1, 'Rule name is required'),
  description: z.string().optional(),
  type: z.enum(['QUANTITY_DISCOUNT', 'TIME_BASED', 'CUSTOMER_GROUP', 'CATEGORY_DISCOUNT', 'PRODUCT_BUNDLE', 'INVENTORY_BASED', 'DYNAMIC_MARKET']),
  conditions: z.any(),
  discountType: z.enum(['PERCENTAGE', 'FIXED_AMOUNT', 'FIXED_PRICE', 'BUY_X_GET_Y']),
  discountValue: z.number().min(0, 'Discount value must be non-negative'),
  maxDiscountValue: z.number().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  timeZone: z.string().optional(),
  priority: z.number().default(0),
  applyToCategories: z.boolean().default(false),
  applyToProducts: z.boolean().default(false),
  applyToCustomers: z.boolean().default(false),
  usageLimit: z.number().optional(),
  perCustomerLimit: z.number().optional(),
  categoryIds: z.array(z.string()).optional(),
  productIds: z.array(z.string()).optional(),
  customerGroupIds: z.array(z.string()).optional(),
  isActive: z.boolean().default(true)
})

const updatePricingRuleSchema = createPricingRuleSchema.partial().omit({
  categoryIds: true,
  productIds: true,
  customerGroupIds: true
})

export class PricingController {
  
  async calculatePrice(req: Request, res: Response): Promise<void> {
    try {
      const validatedData = calculatePriceSchema.parse(req.body)
      
      const result = await pricingService.calculatePrice(validatedData)
      
      res.status(200).json({
        success: true,
        data: result,
        message: 'Price calculated successfully'
      })
    } catch (error) {
      logger.error('Error calculating price:', error)
      
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Validation error',
            details: error.errors
          }
        })
      }
      
      res.status(500).json({
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Internal server error'
        }
      })
    }
  }

  async calculateBulkPricing(req: Request, res: Response): Promise<void> {
    try {
      const validatedData = bulkCalculatePriceSchema.parse(req.body)
      
      const result = await pricingService.calculateBulkPricing(validatedData)
      
      res.status(200).json({
        success: true,
        data: result,
        message: 'Bulk pricing calculated successfully'
      })
    } catch (error) {
      logger.error('Error calculating bulk pricing:', error)
      
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Validation error',
            details: error.errors
          }
        })
      }
      
      res.status(500).json({
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Internal server error'
        }
      })
    }
  }

  async createPricingRule(req: Request, res: Response): Promise<void> {
    try {
      const validatedData = createPricingRuleSchema.parse(req.body)
      
      const rule = await pricingService.createPricingRule(validatedData)
      
      res.status(201).json({
        success: true,
        data: rule,
        message: 'Pricing rule created successfully'
      })
    } catch (error) {
      logger.error('Error creating pricing rule:', error)
      
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Validation error',
            details: error.errors
          }
        })
      }
      
      res.status(500).json({
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Internal server error'
        }
      })
    }
  }

  async updatePricingRule(req: Request, res: Response): Promise<void> {
    try {
      const { ruleId } = req.params
      const validatedData = updatePricingRuleSchema.parse(req.body)
      
      const rule = await pricingService.updatePricingRule(ruleId, validatedData)
      
      res.status(200).json({
        success: true,
        data: rule,
        message: 'Pricing rule updated successfully'
      })
    } catch (error) {
      logger.error('Error updating pricing rule:', error)
      
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Validation error',
            details: error.errors
          }
        })
      }
      
      res.status(500).json({
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Internal server error'
        }
      })
    }
  }

  async getPricingRules(req: Request, res: Response): Promise<void> {
    try {
      const filters = {
        isActive: req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined,
        type: req.query.type as string,
        priority: req.query.priority ? parseInt(req.query.priority as string) : undefined
      }

      const rules = await pricingService.getPricingRules(filters)
      
      res.status(200).json({
        success: true,
        data: rules,
        count: rules.length,
        message: 'Pricing rules retrieved successfully'
      })
    } catch (error) {
      logger.error('Error getting pricing rules:', error)
      
      res.status(500).json({
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Internal server error'
        }
      })
    }
  }

  async getPricingRule(req: Request, res: Response): Promise<void> {
    try {
      const { ruleId } = req.params
      
      const rules = await pricingService.getPricingRules()
      const rule = rules.find(r => r.id === ruleId)
      
      if (!rule) {
        res.status(404).json({
          success: false,
          error: {
            message: 'Pricing rule not found'
          }
        })
      }
      
      res.status(200).json({
        success: true,
        data: rule,
        message: 'Pricing rule retrieved successfully'
      })
    } catch (error) {
      logger.error('Error getting pricing rule:', error)
      
      res.status(500).json({
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Internal server error'
        }
      })
    }
  }

  async deletePricingRule(req: Request, res: Response): Promise<void> {
    try {
      const { ruleId } = req.params
      
      await pricingService.deletePricingRule(ruleId)
      
      res.status(200).json({
        success: true,
        message: 'Pricing rule deleted successfully'
      })
    } catch (error) {
      logger.error('Error deleting pricing rule:', error)
      
      res.status(500).json({
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Internal server error'
        }
      })
    }
  }

  async getPricingAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const filters = {
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string
      }

      const analytics = await pricingService.getPricingAnalytics(filters)
      
      res.status(200).json({
        success: true,
        data: analytics,
        message: 'Pricing analytics retrieved successfully'
      })
    } catch (error) {
      logger.error('Error getting pricing analytics:', error)
      
      res.status(500).json({
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Internal server error'
        }
      })
    }
  }

  async testPricingRule(req: Request, res: Response): Promise<void> {
    try {
      const { ruleId: _ruleId } = req.params
      const testData = calculatePriceSchema.parse(req.body)
      
      // Add rule testing logic here
      const result = await pricingService.calculatePrice({
        ...testData,
        context: { ...testData.context }
      })
      
      res.status(200).json({
        success: true,
        data: result,
        message: 'Pricing rule test completed'
      })
    } catch (error) {
      logger.error('Error testing pricing rule:', error)
      
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Validation error',
            details: error.errors
          }
        })
      }
      
      res.status(500).json({
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Internal server error'
        }
      })
    }
  }

  async previewPricing(req: Request, res: Response): Promise<void> {
    try {
      const validatedData = calculatePriceSchema.parse(req.body)
      
      // Calculate pricing without recording applications
      const result = await pricingService.calculatePrice(validatedData)
      
      res.status(200).json({
        success: true,
        data: {
          ...result,
          preview: true
        },
        message: 'Pricing preview generated successfully'
      })
    } catch (error) {
      logger.error('Error generating pricing preview:', error)
      
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Validation error',
            details: error.errors
          }
        })
      }
      
      res.status(500).json({
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Internal server error'
        }
      })
    }
  }
}

export const pricingController = new PricingController()