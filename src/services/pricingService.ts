import { prisma } from '../utils/database'
import { logger } from '../utils/logger'
import { Decimal } from '@prisma/client/runtime/library'

export interface PricingCalculationRequest {
  productId: string
  userId?: string
  quantity: number
  customerGroup?: string
  context?: {
    cartTotal?: number
    isFirstPurchase?: boolean
    timeOfDay?: string
    seasonalContext?: string
  }
}

export interface PricingCalculationResult {
  productId: string
  originalPrice: number
  finalPrice: number
  discountAmount: number
  appliedRules: AppliedPricingRule[]
  savings: number
  savingsPercentage: number
}

export interface AppliedPricingRule {
  ruleId: string
  ruleName: string
  ruleType: string
  discountType: string
  discountValue: number
  discountAmount: number
  priority: number
}

export interface BulkPricingRequest {
  items: PricingCalculationRequest[]
  userId?: string
  customerGroup?: string
  context?: any
}

export interface BulkPricingResult {
  items: PricingCalculationResult[]
  totalOriginalPrice: number
  totalFinalPrice: number
  totalSavings: number
  totalSavingsPercentage: number
}

export class PricingService {

  async calculatePrice(request: PricingCalculationRequest): Promise<PricingCalculationResult> {
    try {
      // Get product with base price
      const product = await prisma.product.findUnique({
        where: { id: request.productId },
        select: {
          id: true,
          name: true,
          price: true,
          categoryId: true,
          quantity: true,
        },
      })

      if (!product) {
        throw new Error(`Product with ID ${request.productId} not found`)
      }

      const originalPrice = Number(product.price)
      let finalPrice = originalPrice
      const appliedRules: AppliedPricingRule[] = []

      // Get applicable pricing rules
      const applicableRules = await this.getApplicablePricingRules(request, product)

      // Sort rules by priority (higher priority first)
      applicableRules.sort((a, b) => b.priority - a.priority)

      // Apply pricing rules in order of priority
      for (const rule of applicableRules) {
        const ruleApplication = await this.applyPricingRule(rule, {
          ...request,
          originalPrice,
          currentPrice: finalPrice,
        })

        if (ruleApplication.applied) {
          finalPrice = ruleApplication.newPrice
          appliedRules.push({
            ruleId: rule.id,
            ruleName: rule.name,
            ruleType: rule.type,
            discountType: rule.discountType,
            discountValue: Number(rule.discountValue),
            discountAmount: ruleApplication.discountAmount,
            priority: rule.priority,
          })

          // Record pricing application for analytics
          await this.recordPricingApplication({
            ruleId: rule.id,
            userId: request.userId,
            productId: request.productId,
            originalPrice,
            discountAmount: ruleApplication.discountAmount,
            finalPrice,
            quantity: request.quantity,
            customerGroup: request.customerGroup,
            conditions: rule.conditions,
          })

          // Update rule usage count
          await prisma.pricingRule.update({
            where: { id: rule.id },
            data: { usageCount: { increment: 1 } },
          })
        }
      }

      const discountAmount = originalPrice - finalPrice
      const savings = discountAmount * request.quantity
      const savingsPercentage = originalPrice > 0 ? (discountAmount / originalPrice) * 100 : 0

      return {
        productId: request.productId,
        originalPrice,
        finalPrice,
        discountAmount,
        appliedRules,
        savings,
        savingsPercentage,
      }
    } catch (error) {
      logger.error('Error calculating price:', error)
      throw error
    }
  }

  async calculateBulkPricing(request: BulkPricingRequest): Promise<BulkPricingResult> {
    try {
      const results: PricingCalculationResult[] = []
      let totalOriginalPrice = 0
      let totalFinalPrice = 0

      for (const item of request.items) {
        const itemRequest = {
          ...item,
          userId: request.userId,
          customerGroup: request.customerGroup,
          context: { ...item.context, ...request.context },
        }

        const result = await this.calculatePrice(itemRequest)
        results.push(result)

        totalOriginalPrice += result.originalPrice * item.quantity
        totalFinalPrice += result.finalPrice * item.quantity
      }

      const totalSavings = totalOriginalPrice - totalFinalPrice
      const totalSavingsPercentage = totalOriginalPrice > 0 ? (totalSavings / totalOriginalPrice) * 100 : 0

      return {
        items: results,
        totalOriginalPrice,
        totalFinalPrice,
        totalSavings,
        totalSavingsPercentage,
      }
    } catch (error) {
      logger.error('Error calculating bulk pricing:', error)
      throw error
    }
  }

  private async getApplicablePricingRules(request: PricingCalculationRequest, product: any) {
    const now = new Date()

    // Base query for active rules within date range
    const baseWhere = {
      isActive: true,
      OR: [
        { startDate: null },
        { startDate: { lte: now } },
      ],
      AND: [
        {
          OR: [
            { endDate: null },
            { endDate: { gte: now } },
          ],
        },
      ],
    }

    // Get rules that apply to this product specifically
    const productRules = await prisma.pricingRule.findMany({
      where: {
        ...baseWhere,
        applyToProducts: true,
        products: {
          some: { productId: request.productId },
        },
      },
      include: {
        products: true,
        categories: true,
        customerGroups: true,
      },
    })

    // Get rules that apply to this product's category
    const categoryRules = product.categoryId ? await prisma.pricingRule.findMany({
      where: {
        ...baseWhere,
        applyToCategories: true,
        categories: {
          some: { categoryId: product.categoryId },
        },
      },
      include: {
        products: true,
        categories: true,
        customerGroups: true,
      },
    }) : []

    // Get customer group rules if applicable
    const customerGroupRules = request.customerGroup ? await prisma.pricingRule.findMany({
      where: {
        ...baseWhere,
        applyToCustomers: true,
        customerGroups: {
          some: { group: { name: request.customerGroup } },
        },
      },
      include: {
        products: true,
        categories: true,
        customerGroups: true,
      },
    }) : []

    // Get global rules (no specific targeting)
    const globalRules = await prisma.pricingRule.findMany({
      where: {
        ...baseWhere,
        applyToProducts: false,
        applyToCategories: false,
        applyToCustomers: false,
      },
      include: {
        products: true,
        categories: true,
        customerGroups: true,
      },
    })

    // Combine and deduplicate rules
    const allRules = [...productRules, ...categoryRules, ...customerGroupRules, ...globalRules]
    const uniqueRules = allRules.filter((rule, index, self) =>
      index === self.findIndex(r => r.id === rule.id),
    )

    // Filter rules based on conditions and usage limits
    const applicableRules = []
    for (const rule of uniqueRules) {
      if (await this.evaluateRuleConditions(rule, request, product)) {
        // Check usage limits
        if (rule.usageLimit && rule.usageCount >= rule.usageLimit) {
          continue
        }

        // Check per-customer usage limits
        if (rule.perCustomerLimit && request.userId) {
          const customerUsage = await prisma.pricingApplication.count({
            where: {
              ruleId: rule.id,
              userId: request.userId,
            },
          })
          if (customerUsage >= rule.perCustomerLimit) {
            continue
          }
        }

        applicableRules.push(rule)
      }
    }

    return applicableRules
  }

  private async evaluateRuleConditions(rule: any, request: PricingCalculationRequest, product: any): Promise<boolean> {
    try {
      const conditions = rule.conditions as any

      // Quantity-based conditions
      if (rule.type === 'QUANTITY_DISCOUNT') {
        const minQuantity = conditions.minQuantity || 1
        const maxQuantity = conditions.maxQuantity

        if (request.quantity < minQuantity) return false
        if (maxQuantity && request.quantity > maxQuantity) return false
      }

      // Time-based conditions
      if (rule.type === 'TIME_BASED') {
        const now = new Date()

        if (conditions.timeOfDay) {
          const currentHour = now.getHours()
          const { startHour, endHour } = conditions.timeOfDay

          if (startHour <= endHour) {
            if (currentHour < startHour || currentHour > endHour) return false
          } else {
            if (currentHour < startHour && currentHour > endHour) return false
          }
        }

        if (conditions.daysOfWeek) {
          const currentDay = now.getDay()
          if (!conditions.daysOfWeek.includes(currentDay)) return false
        }

        if (conditions.dateRange) {
          const { startDate, endDate } = conditions.dateRange
          if (startDate && now < new Date(startDate)) return false
          if (endDate && now > new Date(endDate)) return false
        }
      }

      // Inventory-based conditions
      if (rule.type === 'INVENTORY_BASED') {
        if (conditions.lowStockOnly && product.quantity > product.lowStockThreshold) {
          return false
        }

        if (conditions.overStockOnly && product.quantity <= product.lowStockThreshold) {
          return false
        }

        if (conditions.stockRange) {
          const { min, max } = conditions.stockRange
          if (min !== undefined && product.quantity < min) return false
          if (max !== undefined && product.quantity > max) return false
        }
      }

      // Cart value conditions
      if (conditions.minCartValue && request.context?.cartTotal) {
        if (request.context.cartTotal < conditions.minCartValue) return false
      }

      if (conditions.maxCartValue && request.context?.cartTotal) {
        if (request.context.cartTotal > conditions.maxCartValue) return false
      }

      // First-time customer conditions
      if (conditions.firstPurchaseOnly && !request.context?.isFirstPurchase) {
        return false
      }

      return true
    } catch (error) {
      logger.error('Error evaluating rule conditions:', error)
      return false
    }
  }

  private async applyPricingRule(rule: any, context: any): Promise<{ applied: boolean; newPrice: number; discountAmount: number }> {
    try {
      const { currentPrice, quantity } = context
      const conditions = rule.conditions as any
      let newPrice = currentPrice
      let discountAmount = 0

      switch (rule.discountType) {
      case 'PERCENTAGE':
        discountAmount = (currentPrice * Number(rule.discountValue)) / 100
        newPrice = currentPrice - discountAmount
        break

      case 'FIXED_AMOUNT':
        discountAmount = Number(rule.discountValue)
        newPrice = Math.max(0, currentPrice - discountAmount)
        break

      case 'FIXED_PRICE':
        newPrice = Number(rule.discountValue)
        discountAmount = currentPrice - newPrice
        break

      case 'BUY_X_GET_Y':
        if (rule.type === 'QUANTITY_DISCOUNT' && conditions.buyXGetY) {
          const { buyQuantity, getQuantity, getDiscountPercent } = conditions.buyXGetY
          const eligibleSets = Math.floor(quantity / buyQuantity)
          const freeItems = eligibleSets * getQuantity
          const discountPerItem = (currentPrice * getDiscountPercent) / 100
          discountAmount = freeItems * discountPerItem
          newPrice = currentPrice - (discountAmount / quantity)
        }
        break
      }

      // Apply maximum discount limit if specified
      if (rule.maxDiscountValue && discountAmount > Number(rule.maxDiscountValue)) {
        discountAmount = Number(rule.maxDiscountValue)
        newPrice = currentPrice - discountAmount
      }

      // Ensure price doesn't go below zero
      newPrice = Math.max(0, newPrice)
      discountAmount = currentPrice - newPrice

      return {
        applied: discountAmount > 0,
        newPrice,
        discountAmount,
      }
    } catch (error) {
      logger.error('Error applying pricing rule:', error)
      return { applied: false, newPrice: context.currentPrice, discountAmount: 0 }
    }
  }

  private async recordPricingApplication(data: any) {
    try {
      await prisma.pricingApplication.create({
        data: {
          ruleId: data.ruleId,
          userId: data.userId,
          productId: data.productId,
          originalPrice: new Decimal(data.originalPrice),
          discountAmount: new Decimal(data.discountAmount),
          finalPrice: new Decimal(data.finalPrice),
          quantity: data.quantity,
          customerGroup: data.customerGroup,
          conditions: data.conditions,
        },
      })
    } catch (error) {
      logger.error('Error recording pricing application:', error)
    }
  }

  async createPricingRule(data: any) {
    try {
      const rule = await prisma.pricingRule.create({
        data: {
          name: data.name,
          description: data.description,
          type: data.type,
          conditions: data.conditions,
          discountType: data.discountType,
          discountValue: new Decimal(data.discountValue),
          maxDiscountValue: data.maxDiscountValue ? new Decimal(data.maxDiscountValue) : null,
          startDate: data.startDate ? new Date(data.startDate) : null,
          endDate: data.endDate ? new Date(data.endDate) : null,
          timeZone: data.timeZone,
          priority: data.priority || 0,
          applyToCategories: data.applyToCategories || false,
          applyToProducts: data.applyToProducts || false,
          applyToCustomers: data.applyToCustomers || false,
          usageLimit: data.usageLimit,
          perCustomerLimit: data.perCustomerLimit,
          isActive: data.isActive !== false,
        },
      })

      // Associate with categories if specified
      if (data.categoryIds && data.categoryIds.length > 0) {
        await prisma.pricingRuleCategory.createMany({
          data: data.categoryIds.map((categoryId: string) => ({
            ruleId: rule.id,
            categoryId,
          })),
        })
      }

      // Associate with products if specified
      if (data.productIds && data.productIds.length > 0) {
        await prisma.pricingRuleProduct.createMany({
          data: data.productIds.map((productId: string) => ({
            ruleId: rule.id,
            productId,
          })),
        })
      }

      // Associate with customer groups if specified
      if (data.customerGroupIds && data.customerGroupIds.length > 0) {
        await prisma.pricingRuleCustomerGroup.createMany({
          data: data.customerGroupIds.map((groupId: string) => ({
            ruleId: rule.id,
            groupId,
          })),
        })
      }

      return rule
    } catch (error) {
      logger.error('Error creating pricing rule:', error)
      throw error
    }
  }

  async updatePricingRule(ruleId: string, data: any) {
    try {
      const rule = await prisma.pricingRule.update({
        where: { id: ruleId },
        data: {
          name: data.name,
          description: data.description,
          type: data.type,
          conditions: data.conditions,
          discountType: data.discountType,
          discountValue: data.discountValue ? new Decimal(data.discountValue) : undefined,
          maxDiscountValue: data.maxDiscountValue ? new Decimal(data.maxDiscountValue) : undefined,
          startDate: data.startDate ? new Date(data.startDate) : undefined,
          endDate: data.endDate ? new Date(data.endDate) : undefined,
          timeZone: data.timeZone,
          priority: data.priority,
          applyToCategories: data.applyToCategories,
          applyToProducts: data.applyToProducts,
          applyToCustomers: data.applyToCustomers,
          usageLimit: data.usageLimit,
          perCustomerLimit: data.perCustomerLimit,
          isActive: data.isActive,
        },
      })

      return rule
    } catch (error) {
      logger.error('Error updating pricing rule:', error)
      throw error
    }
  }

  async getPricingRules(filters?: any) {
    try {
      const where: any = {}

      if (filters?.isActive !== undefined) {
        where.isActive = filters.isActive
      }

      if (filters?.type) {
        where.type = filters.type
      }

      if (filters?.priority) {
        where.priority = { gte: filters.priority }
      }

      const rules = await prisma.pricingRule.findMany({
        where,
        include: {
          categories: {
            include: { category: { select: { name: true, slug: true } } },
          },
          products: {
            include: { product: { select: { name: true, sku: true } } },
          },
          customerGroups: {
            include: { group: { select: { name: true } } },
          },
          _count: {
            select: { applications: true },
          },
        },
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'desc' },
        ],
      })

      return rules
    } catch (error) {
      logger.error('Error getting pricing rules:', error)
      throw error
    }
  }

  async deletePricingRule(ruleId: string) {
    try {
      await prisma.pricingRule.delete({
        where: { id: ruleId },
      })
    } catch (error) {
      logger.error('Error deleting pricing rule:', error)
      throw error
    }
  }

  async getPricingAnalytics(filters?: any) {
    try {
      const startDate = filters?.startDate ? new Date(filters.startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      const endDate = filters?.endDate ? new Date(filters.endDate) : new Date()

      const applications = await prisma.pricingApplication.findMany({
        where: {
          appliedAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        include: {
          rule: { select: { name: true, type: true } },
          product: { select: { name: true, sku: true } },
        },
      })

      const totalApplications = applications.length
      const totalSavings = applications.reduce((sum, app) => sum + Number(app.discountAmount), 0)
      const averageDiscount = totalApplications > 0 ? totalSavings / totalApplications : 0

      const rulePerformance = applications.reduce((acc, app) => {
        const ruleId = app.ruleId
        if (!acc[ruleId]) {
          acc[ruleId] = {
            ruleId,
            ruleName: app.rule.name,
            ruleType: app.rule.type,
            applications: 0,
            totalSavings: 0,
            averageDiscount: 0,
          }
        }
        acc[ruleId].applications++
        acc[ruleId].totalSavings += Number(app.discountAmount)
        acc[ruleId].averageDiscount = acc[ruleId].totalSavings / acc[ruleId].applications
        return acc
      }, {} as any)

      return {
        summary: {
          totalApplications,
          totalSavings,
          averageDiscount,
          dateRange: { startDate, endDate },
        },
        rulePerformance: Object.values(rulePerformance),
        applications: applications.slice(0, 100), // Latest 100 applications
      }
    } catch (error) {
      logger.error('Error getting pricing analytics:', error)
      throw error
    }
  }
}

export const pricingService = new PricingService()
