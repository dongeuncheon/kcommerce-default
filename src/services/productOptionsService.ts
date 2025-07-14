import { prisma } from '../utils/database'
import { logger } from '../utils/logger'
import {
  CreateProductOptionInput,
  UpdateProductOptionInput,
  ProductOption,
  ProductWithOptions,
  SelectedProductOptions,
  OptionValidationResult,
  OptionPriceCalculation,
  BulkOptionOperation,
  OptionTemplate,
  OPTION_TEMPLATES,
} from '../types/productOptions'
import { Decimal } from '@prisma/client/runtime/library'

export class ProductOptionsService {

  // Create a new product option with values
  async createProductOption(data: CreateProductOptionInput): Promise<ProductOption> {
    try {
      const option = await prisma.$transaction(async (tx) => {
        // Create the option
        const createdOption = await tx.productOption.create({
          data: {
            productId: data.productId,
            name: data.name,
            displayName: data.displayName,
            type: data.type,
            isRequired: data.isRequired,
            sortOrder: data.sortOrder,
            config: data.config ? data.config as any : null,
          },
        })

        // Create option values
        if (data.values && data.values.length > 0) {
          await tx.productOptionValue.createMany({
            data: data.values.map(value => ({
              optionId: createdOption.id,
              value: value.value,
              displayValue: value.displayValue,
              sortOrder: value.sortOrder || 0,
              isActive: value.isActive ?? true,
              priceAdjustment: value.priceAdjustment ? new Decimal(value.priceAdjustment) : null,
              sku: value.sku,
              image: value.image,
              hexColor: value.hexColor,
              description: value.description,
            })),
          })
        }

        return createdOption
      })

      logger.info(`Created product option: ${option.id} for product: ${data.productId}`)
      return this.getProductOptionById(option.id)
    } catch (error) {
      logger.error('Error creating product option:', error)
      throw error
    }
  }

  // Get product option by ID with values
  async getProductOptionById(optionId: string): Promise<ProductOption> {
    try {
      const option = await prisma.productOption.findUnique({
        where: { id: optionId },
        include: {
          values: {
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' },
          },
        },
      })

      if (!option) {
        throw new Error(`Product option with ID ${optionId} not found`)
      }

      return {
        id: option.id,
        productId: option.productId,
        name: option.name,
        displayName: option.displayName,
        type: option.type as any,
        isRequired: option.isRequired,
        sortOrder: option.sortOrder,
        isActive: option.isActive,
        config: option.config as any,
        values: option.values.map(value => ({
          id: value.id,
          value: value.value,
          displayValue: value.displayValue,
          sortOrder: value.sortOrder,
          isActive: value.isActive,
          priceAdjustment: value.priceAdjustment ? Number(value.priceAdjustment) : undefined,
          sku: value.sku || undefined,
          image: value.image || undefined,
          hexColor: value.hexColor || undefined,
          description: value.description || undefined,
        })),
      }
    } catch (error) {
      logger.error('Error getting product option:', error)
      throw error
    }
  }

  // Get all options for a product
  async getProductOptions(productId: string): Promise<ProductOption[]> {
    try {
      const options = await prisma.productOption.findMany({
        where: {
          productId,
          isActive: true,
        },
        include: {
          values: {
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' },
          },
        },
        orderBy: { sortOrder: 'asc' },
      })

      return options.map(option => ({
        id: option.id,
        productId: option.productId,
        name: option.name,
        displayName: option.displayName,
        type: option.type as any,
        isRequired: option.isRequired,
        sortOrder: option.sortOrder,
        isActive: option.isActive,
        config: option.config as any,
        values: option.values.map(value => ({
          id: value.id,
          value: value.value,
          displayValue: value.displayValue,
          sortOrder: value.sortOrder,
          isActive: value.isActive,
          priceAdjustment: value.priceAdjustment ? Number(value.priceAdjustment) : undefined,
          sku: value.sku || undefined,
          image: value.image || undefined,
          hexColor: value.hexColor || undefined,
          description: value.description || undefined,
        })),
      }))
    } catch (error) {
      logger.error('Error getting product options:', error)
      throw error
    }
  }

  // Update product option
  async updateProductOption(optionId: string, data: UpdateProductOptionInput): Promise<ProductOption> {
    try {
      await prisma.productOption.update({
        where: { id: optionId },
        data: {
          name: data.name,
          displayName: data.displayName,
          type: data.type,
          isRequired: data.isRequired,
          sortOrder: data.sortOrder,
          isActive: data.isActive,
          config: data.config || undefined,
        },
      })

      logger.info(`Updated product option: ${optionId}`)
      return this.getProductOptionById(optionId)
    } catch (error) {
      logger.error('Error updating product option:', error)
      throw error
    }
  }

  // Delete product option
  async deleteProductOption(optionId: string): Promise<void> {
    try {
      await prisma.productOption.delete({
        where: { id: optionId },
      })

      logger.info(`Deleted product option: ${optionId}`)
    } catch (error) {
      logger.error('Error deleting product option:', error)
      throw error
    }
  }

  // Add option value to existing option
  async addOptionValue(optionId: string, valueData: any): Promise<void> {
    try {
      await prisma.productOptionValue.create({
        data: {
          optionId,
          value: valueData.value,
          displayValue: valueData.displayValue,
          sortOrder: valueData.sortOrder || 0,
          isActive: valueData.isActive ?? true,
          priceAdjustment: valueData.priceAdjustment ? new Decimal(valueData.priceAdjustment) : null,
          sku: valueData.sku,
          image: valueData.image,
          hexColor: valueData.hexColor,
          description: valueData.description,
        },
      })

      logger.info(`Added option value to option: ${optionId}`)
    } catch (error) {
      logger.error('Error adding option value:', error)
      throw error
    }
  }

  // Update option value
  async updateOptionValue(valueId: string, valueData: any): Promise<void> {
    try {
      await prisma.productOptionValue.update({
        where: { id: valueId },
        data: {
          value: valueData.value,
          displayValue: valueData.displayValue,
          sortOrder: valueData.sortOrder,
          isActive: valueData.isActive,
          priceAdjustment: valueData.priceAdjustment ? new Decimal(valueData.priceAdjustment) : null,
          sku: valueData.sku,
          image: valueData.image,
          hexColor: valueData.hexColor,
          description: valueData.description,
        },
      })

      logger.info(`Updated option value: ${valueId}`)
    } catch (error) {
      logger.error('Error updating option value:', error)
      throw error
    }
  }

  // Delete option value
  async deleteOptionValue(valueId: string): Promise<void> {
    try {
      await prisma.productOptionValue.delete({
        where: { id: valueId },
      })

      logger.info(`Deleted option value: ${valueId}`)
    } catch (error) {
      logger.error('Error deleting option value:', error)
      throw error
    }
  }

  // Get product with all options and values
  async getProductWithOptions(productId: string): Promise<ProductWithOptions> {
    try {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        include: {
          images: {
            orderBy: { sortOrder: 'asc' },
          },
          variants: {
            where: { isActive: true },
            orderBy: { createdAt: 'asc' },
          },
          options: {
            where: { isActive: true },
            include: {
              values: {
                where: { isActive: true },
                orderBy: { sortOrder: 'asc' },
              },
            },
            orderBy: { sortOrder: 'asc' },
          },
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      })

      if (!product) {
        throw new Error(`Product with ID ${productId} not found`)
      }

      return {
        id: product.id,
        name: product.name,
        slug: product.slug,
        sku: product.sku,
        price: Number(product.price),
        comparePrice: product.comparePrice ? Number(product.comparePrice) : undefined,
        status: product.status,
        type: product.type,
        description: product.description || undefined,
        images: product.images.map(img => ({
          id: img.id,
          url: img.url,
          alt: img.alt || undefined,
          isMain: img.isMain,
        })),
        variants: product.variants.map(variant => ({
          id: variant.id,
          name: variant.name,
          sku: variant.sku,
          price: Number(variant.price),
          attributes: variant.attributes as Record<string, any>,
          quantity: variant.quantity,
        })),
        options: product.options.map(option => ({
          id: option.id,
          name: option.name,
          displayName: option.displayName,
          type: option.type as any,
          isRequired: option.isRequired,
          sortOrder: option.sortOrder,
          config: option.config as Record<string, any> || undefined,
          values: option.values.map(value => ({
            id: value.id,
            value: value.value,
            displayValue: value.displayValue,
            priceAdjustment: value.priceAdjustment ? Number(value.priceAdjustment) : undefined,
            sku: value.sku || undefined,
            image: value.image || undefined,
            hexColor: value.hexColor || undefined,
            description: value.description || undefined,
          })),
        })),
        category: product.category || undefined,
      }
    } catch (error) {
      logger.error('Error getting product with options:', error)
      throw error
    }
  }

  // Validate selected options for a product
  async validateProductOptions(productId: string, selectedOptions: SelectedProductOptions): Promise<OptionValidationResult> {
    try {
      const options = await this.getProductOptions(productId)
      const errors: Array<{ optionName: string; message: string; code: string }> = []
      const warnings: Array<{ optionName: string; message: string }> = []

      // Check required options
      for (const option of options) {
        if (option.isRequired && !selectedOptions[option.name]) {
          errors.push({
            optionName: option.name,
            message: `${option.displayName} is required`,
            code: 'REQUIRED_OPTION_MISSING',
          })
          continue
        }

        const selectedValue = selectedOptions[option.name]
        if (selectedValue !== undefined) {
          // Validate option value exists
          if (option.type === 'SELECT' || option.type === 'RADIO' || option.type === 'COLOR') {
            const valueExists = option.values?.some(v => v.value === selectedValue)
            if (!valueExists) {
              errors.push({
                optionName: option.name,
                message: `Invalid value for ${option.displayName}`,
                code: 'INVALID_OPTION_VALUE',
              })
            }
          }

          // Validate checkbox selections
          if (option.type === 'CHECKBOX' && Array.isArray(selectedValue)) {
            const config = option.config as any
            if (config?.maxSelections && selectedValue.length > config.maxSelections) {
              errors.push({
                optionName: option.name,
                message: `Maximum ${config.maxSelections} selections allowed for ${option.displayName}`,
                code: 'TOO_MANY_SELECTIONS',
              })
            }
          }

          // Validate number range
          if (option.type === 'NUMBER' || option.type === 'RANGE') {
            const numValue = Number(selectedValue)
            const config = option.config as any
            if (config?.min !== undefined && numValue < config.min) {
              errors.push({
                optionName: option.name,
                message: `${option.displayName} must be at least ${config.min}`,
                code: 'VALUE_TOO_LOW',
              })
            }
            if (config?.max !== undefined && numValue > config.max) {
              errors.push({
                optionName: option.name,
                message: `${option.displayName} cannot exceed ${config.max}`,
                code: 'VALUE_TOO_HIGH',
              })
            }
          }

          // Validate text length
          if (option.type === 'TEXT' || option.type === 'TEXTAREA') {
            const textValue = String(selectedValue)
            const config = option.config as any
            if (config?.minLength && textValue.length < config.minLength) {
              errors.push({
                optionName: option.name,
                message: `${option.displayName} must be at least ${config.minLength} characters`,
                code: 'TEXT_TOO_SHORT',
              })
            }
            if (config?.maxLength && textValue.length > config.maxLength) {
              errors.push({
                optionName: option.name,
                message: `${option.displayName} cannot exceed ${config.maxLength} characters`,
                code: 'TEXT_TOO_LONG',
              })
            }
          }
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
      }
    } catch (error) {
      logger.error('Error validating product options:', error)
      throw error
    }
  }

  // Calculate price adjustments based on selected options
  async calculateOptionPricing(productId: string, selectedOptions: SelectedProductOptions): Promise<OptionPriceCalculation> {
    try {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { price: true },
      })

      if (!product) {
        throw new Error(`Product with ID ${productId} not found`)
      }

      const options = await this.getProductOptions(productId)
      const basePrice = Number(product.price)
      const optionAdjustments: Record<string, number> = {}
      const breakdown: Array<{ optionName: string; optionValue: string; adjustment: number }> = []
      let totalAdjustment = 0

      for (const option of options) {
        const selectedValue = selectedOptions[option.name]
        if (selectedValue) {
          // Handle single selection
          if (typeof selectedValue === 'string') {
            const optionValue = option.values?.find(v => v.value === selectedValue)
            if (optionValue?.priceAdjustment) {
              const adjustment = optionValue.priceAdjustment
              optionAdjustments[option.name] = adjustment
              totalAdjustment += adjustment
              breakdown.push({
                optionName: option.displayName,
                optionValue: optionValue.displayValue,
                adjustment,
              })
            }
          }
          // Handle multiple selections (checkboxes)
          else if (Array.isArray(selectedValue)) {
            let optionTotal = 0
            for (const value of selectedValue) {
              const optionValue = option.values?.find(v => v.value === value)
              if (optionValue?.priceAdjustment) {
                optionTotal += optionValue.priceAdjustment
                breakdown.push({
                  optionName: option.displayName,
                  optionValue: optionValue.displayValue,
                  adjustment: optionValue.priceAdjustment,
                })
              }
            }
            if (optionTotal > 0) {
              optionAdjustments[option.name] = optionTotal
              totalAdjustment += optionTotal
            }
          }
        }
      }

      return {
        basePrice,
        optionAdjustments,
        totalAdjustment,
        finalPrice: basePrice + totalAdjustment,
        breakdown,
      }
    } catch (error) {
      logger.error('Error calculating option pricing:', error)
      throw error
    }
  }

  // Bulk operations for options
  async bulkOptionOperation(operation: BulkOptionOperation): Promise<void> {
    try {
      await prisma.$transaction(async (tx) => {
        switch (operation.operation) {
        case 'create':
          for (const optionData of operation.options) {
            // Create option
            const option = await tx.productOption.create({
              data: {
                productId: (optionData as any).productId,
                name: (optionData as any).name,
                displayName: (optionData as any).displayName,
                type: (optionData as any).type,
                isRequired: (optionData as any).isRequired || false,
                sortOrder: (optionData as any).sortOrder || 0,
                config: (optionData as any).config,
              },
            })

            // Create option values
            if ((optionData as any).values) {
              await tx.productOptionValue.createMany({
                data: (optionData as any).values.map((value: any) => ({
                  optionId: option.id,
                  value: value.value,
                  displayValue: value.displayValue,
                  sortOrder: value.sortOrder || 0,
                  priceAdjustment: value.priceAdjustment ? new Decimal(value.priceAdjustment) : null,
                  sku: value.sku,
                  image: value.image,
                  hexColor: value.hexColor,
                  description: value.description,
                })),
              })
            }
          }
          break

        case 'update':
          for (const optionData of operation.options) {
            if ((optionData as any).id) {
              await tx.productOption.update({
                where: { id: (optionData as any).id },
                data: {
                  name: (optionData as any).name,
                  displayName: (optionData as any).displayName,
                  type: (optionData as any).type,
                  isRequired: (optionData as any).isRequired,
                  sortOrder: (optionData as any).sortOrder,
                  config: (optionData as any).config,
                },
              })
            }
          }
          break

        case 'delete': {
          const optionIds = operation.options.map(opt => (opt as any).id).filter(Boolean)
          if (optionIds.length > 0) {
            await tx.productOption.deleteMany({
              where: { id: { in: optionIds } },
            })
          }
          break
        }

        case 'reorder':
          for (const optionData of operation.options) {
            if ((optionData as any).id) {
              await tx.productOption.update({
                where: { id: (optionData as any).id },
                data: { sortOrder: (optionData as any).sortOrder },
              })
            }
          }
          break
        }
      })

      logger.info(`Bulk operation ${operation.operation} completed for ${operation.options.length} options`)
    } catch (error) {
      logger.error('Error in bulk option operation:', error)
      throw error
    }
  }

  // Apply option template to product
  async applyOptionTemplate(productId: string, templateId: string): Promise<void> {
    try {
      const template = OPTION_TEMPLATES.find(t => t.id === templateId)
      if (!template) {
        throw new Error(`Template with ID ${templateId} not found`)
      }

      const optionsToCreate = template.options.map(option => ({
        ...option,
        productId,
      }))

      await this.bulkOptionOperation({
        operation: 'create',
        options: optionsToCreate as any,
      })

      logger.info(`Applied template ${templateId} to product ${productId}`)
    } catch (error) {
      logger.error('Error applying option template:', error)
      throw error
    }
  }

  // Get available option templates
  getOptionTemplates(): OptionTemplate[] {
    return OPTION_TEMPLATES
  }

  // Clone options from one product to another
  async cloneProductOptions(sourceProductId: string, targetProductId: string): Promise<void> {
    try {
      const sourceOptions = await this.getProductOptions(sourceProductId)

      const optionsToCreate = sourceOptions.map(option => ({
        productId: targetProductId,
        name: option.name,
        displayName: option.displayName,
        type: option.type,
        isRequired: option.isRequired,
        sortOrder: option.sortOrder,
        config: option.config,
        values: option.values || [],
      }))

      await this.bulkOptionOperation({
        operation: 'create',
        options: optionsToCreate as any,
      })

      logger.info(`Cloned options from product ${sourceProductId} to product ${targetProductId}`)
    } catch (error) {
      logger.error('Error cloning product options:', error)
      throw error
    }
  }
}

export const productOptionsService = new ProductOptionsService()
