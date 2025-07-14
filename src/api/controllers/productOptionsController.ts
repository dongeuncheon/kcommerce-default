import { Request, Response } from 'express'
import { productOptionsService } from '../../services/productOptionsService'
import { logger } from '../../utils/logger'
import { z } from 'zod'
import {
  CreateProductOptionSchema,
  UpdateProductOptionSchema,
  ValidateProductOptionsSchema,
  SelectedProductOptionsSchema,
  BulkOptionOperationSchema,
  ProductOptionValueSchema
} from '../../types/productOptions'

export class ProductOptionsController {

  // Create a new product option
  createProductOption = async (req: Request, res: Response) => {
    try {
      const validatedData = CreateProductOptionSchema.parse(req.body)
      
      const option = await productOptionsService.createProductOption(validatedData)
      
      return res.status(201).json({
        success: true,
        data: option,
        message: 'Product option created successfully'
      })
    } catch (error) {
      logger.error('Error creating product option:', error)
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Validation error',
            details: error.errors
          }
        })
      }
      
      return res.status(500).json({
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Internal server error'
        }
      })
    }
  }

  // Get product option by ID
  getProductOption = async (req: Request, res: Response) => {
    try {
      const { optionId } = req.params
      
      const option = await productOptionsService.getProductOptionById(optionId)
      
      return res.json({
        success: true,
        data: option
      })
    } catch (error) {
      logger.error('Error getting product option:', error)
      
      if (error instanceof Error && error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: { message: error.message }
        })
      }
      
      return res.status(500).json({
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Internal server error'
        }
      })
    }
  }

  // Get all options for a product
  getProductOptions = async (req: Request, res: Response) => {
    try {
      const { productId } = req.params
      
      const options = await productOptionsService.getProductOptions(productId)
      
      return res.json({
        success: true,
        data: options,
        count: options.length
      })
    } catch (error) {
      logger.error('Error getting product options:', error)
      
      return res.status(500).json({
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Internal server error'
        }
      })
    }
  }

  // Update product option
  updateProductOption = async (req: Request, res: Response) => {
    try {
      const { optionId } = req.params
      const validatedData = UpdateProductOptionSchema.parse(req.body)
      
      const option = await productOptionsService.updateProductOption(optionId, validatedData)
      
      return res.json({
        success: true,
        data: option,
        message: 'Product option updated successfully'
      })
    } catch (error) {
      logger.error('Error updating product option:', error)
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Validation error',
            details: error.errors
          }
        })
      }
      
      return res.status(500).json({
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Internal server error'
        }
      })
    }
  }

  // Delete product option
  deleteProductOption = async (req: Request, res: Response) => {
    try {
      const { optionId } = req.params
      
      await productOptionsService.deleteProductOption(optionId)
      
      return res.json({
        success: true,
        message: 'Product option deleted successfully'
      })
    } catch (error) {
      logger.error('Error deleting product option:', error)
      
      return res.status(500).json({
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Internal server error'
        }
      })
    }
  }

  // Add option value to existing option
  addOptionValue = async (req: Request, res: Response) => {
    try {
      const { optionId } = req.params
      const validatedData = ProductOptionValueSchema.omit({ id: true }).parse(req.body)
      
      await productOptionsService.addOptionValue(optionId, validatedData)
      
      return res.status(201).json({
        success: true,
        message: 'Option value added successfully'
      })
    } catch (error) {
      logger.error('Error adding option value:', error)
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Validation error',
            details: error.errors
          }
        })
      }
      
      return res.status(500).json({
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Internal server error'
        }
      })
    }
  }

  // Update option value
  updateOptionValue = async (req: Request, res: Response) => {
    try {
      const { valueId } = req.params
      const validatedData = ProductOptionValueSchema.partial().parse(req.body)
      
      await productOptionsService.updateOptionValue(valueId, validatedData)
      
      return res.json({
        success: true,
        message: 'Option value updated successfully'
      })
    } catch (error) {
      logger.error('Error updating option value:', error)
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Validation error',
            details: error.errors
          }
        })
      }
      
      return res.status(500).json({
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Internal server error'
        }
      })
    }
  }

  // Delete option value
  deleteOptionValue = async (req: Request, res: Response) => {
    try {
      const { valueId } = req.params
      
      await productOptionsService.deleteOptionValue(valueId)
      
      return res.json({
        success: true,
        message: 'Option value deleted successfully'
      })
    } catch (error) {
      logger.error('Error deleting option value:', error)
      
      return res.status(500).json({
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Internal server error'
        }
      })
    }
  }

  // Get product with all options and values
  getProductWithOptions = async (req: Request, res: Response) => {
    try {
      const { productId } = req.params
      
      const product = await productOptionsService.getProductWithOptions(productId)
      
      return res.json({
        success: true,
        data: product
      })
    } catch (error) {
      logger.error('Error getting product with options:', error)
      
      if (error instanceof Error && error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: { message: error.message }
        })
      }
      
      return res.status(500).json({
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Internal server error'
        }
      })
    }
  }

  // Validate selected options for a product
  validateProductOptions = async (req: Request, res: Response) => {
    try {
      const validatedData = ValidateProductOptionsSchema.parse(req.body)
      
      const validation = await productOptionsService.validateProductOptions(
        validatedData.productId,
        validatedData.selectedOptions
      )
      
      return res.json({
        success: true,
        data: validation
      })
    } catch (error) {
      logger.error('Error validating product options:', error)
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Validation error',
            details: error.errors
          }
        })
      }
      
      return res.status(500).json({
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Internal server error'
        }
      })
    }
  }

  // Calculate price with selected options
  calculateOptionPricing = async (req: Request, res: Response) => {
    try {
      const { productId } = req.params
      const { selectedOptions } = req.body
      
      const validatedOptions = SelectedProductOptionsSchema.parse(selectedOptions)
      
      const pricing = await productOptionsService.calculateOptionPricing(productId, validatedOptions)
      
      return res.json({
        success: true,
        data: pricing
      })
    } catch (error) {
      logger.error('Error calculating option pricing:', error)
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Validation error',
            details: error.errors
          }
        })
      }
      
      return res.status(500).json({
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Internal server error'
        }
      })
    }
  }

  // Bulk operations for options
  bulkOptionOperation = async (req: Request, res: Response) => {
    try {
      const validatedData = BulkOptionOperationSchema.parse(req.body)
      
      await productOptionsService.bulkOptionOperation(validatedData)
      
      return res.json({
        success: true,
        message: `Bulk ${validatedData.operation} operation completed successfully`
      })
    } catch (error) {
      logger.error('Error in bulk option operation:', error)
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Validation error',
            details: error.errors
          }
        })
      }
      
      return res.status(500).json({
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Internal server error'
        }
      })
    }
  }

  // Apply option template to product
  applyOptionTemplate = async (req: Request, res: Response) => {
    try {
      const { productId } = req.params
      const { templateId } = req.body
      
      const schema = z.object({
        templateId: z.string().min(1, 'Template ID is required')
      })
      
      const validatedData = schema.parse({ templateId })
      
      await productOptionsService.applyOptionTemplate(productId, validatedData.templateId)
      
      return res.json({
        success: true,
        message: 'Option template applied successfully'
      })
    } catch (error) {
      logger.error('Error applying option template:', error)
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Validation error',
            details: error.errors
          }
        })
      }
      
      return res.status(500).json({
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Internal server error'
        }
      })
    }
  }

  // Get available option templates
  getOptionTemplates = async (_req: Request, res: Response) => {
    try {
      const templates = productOptionsService.getOptionTemplates()
      
      return res.json({
        success: true,
        data: templates,
        count: templates.length
      })
    } catch (error) {
      logger.error('Error getting option templates:', error)
      
      return res.status(500).json({
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Internal server error'
        }
      })
    }
  }

  // Clone options from one product to another
  cloneProductOptions = async (req: Request, res: Response) => {
    try {
      const { sourceProductId, targetProductId } = req.body
      
      const schema = z.object({
        sourceProductId: z.string().cuid('Invalid source product ID'),
        targetProductId: z.string().cuid('Invalid target product ID')
      })
      
      const validatedData = schema.parse({ sourceProductId, targetProductId })
      
      await productOptionsService.cloneProductOptions(
        validatedData.sourceProductId,
        validatedData.targetProductId
      )
      
      return res.json({
        success: true,
        message: 'Product options cloned successfully'
      })
    } catch (error) {
      logger.error('Error cloning product options:', error)
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Validation error',
            details: error.errors
          }
        })
      }
      
      return res.status(500).json({
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Internal server error'
        }
      })
    }
  }

  // Reorder product options
  reorderProductOptions = async (req: Request, res: Response) => {
    try {
      const { productId: _productId } = req.params
      const { optionIds } = req.body
      
      const schema = z.object({
        optionIds: z.array(z.string().cuid()).min(1, 'At least one option ID is required')
      })
      
      const validatedData = schema.parse({ optionIds })
      
      // Create reorder operation
      const reorderOptions = validatedData.optionIds.map((id, index) => ({
        id,
        sortOrder: index
      }))
      
      await productOptionsService.bulkOptionOperation({
        operation: 'reorder',
        options: reorderOptions as any
      })
      
      return res.json({
        success: true,
        message: 'Product options reordered successfully'
      })
    } catch (error) {
      logger.error('Error reordering product options:', error)
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Validation error',
            details: error.errors
          }
        })
      }
      
      return res.status(500).json({
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Internal server error'
        }
      })
    }
  }
}

export const productOptionsController = new ProductOptionsController()