import { Response, NextFunction } from 'express'
import { CustomerService } from '../../services/customerService'
import { AppError } from '../../middleware/error'
import { AuthenticatedRequest } from '../../middleware/auth'
import {
  UpdateCustomerProfileSchema,
  CustomerAddressSchema,
  CustomerPaymentMethodSchema,
  UpdatePaymentMethodSchema,
  AddToWishlistSchema,
  WishlistQuerySchema,
  CustomerActivityQuerySchema,
  CustomerAnalyticsQuerySchema,
  CustomerSearchSchema,
  CustomerPreferencesSchema,
} from '../../types/customer'
import { z } from 'zod'
import { auditLogService } from '../../services/auditLogService'
import { prisma } from '../../utils/database'

export class CustomerController {
  // Profile Management
  static async getProfile(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401)
      }

      const profile = await CustomerService.getProfile(req.user.id)
      res.json(profile)
    } catch (error) {
      next(error)
    }
  }

  static async updateProfile(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401)
      }

      const validatedData = UpdateCustomerProfileSchema.parse(req.body)
      const updated = await CustomerService.updateProfile(req.user.id, validatedData)
      
      res.json({
        message: 'Profile updated successfully',
        profile: updated,
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(new AppError('Validation error', 400, true, 'VALIDATION_ERROR', undefined, error.errors))
      }
      next(error)
    }
  }

  // Address Management
  static async getAddresses(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401)
      }

      const addresses = await CustomerService.getAddresses(req.user.id)
      res.json(addresses)
    } catch (error) {
      next(error)
    }
  }

  static async getAddress(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401)
      }

      const { addressId } = req.params
      const address = await CustomerService.getAddress(req.user.id, addressId)
      res.json(address)
    } catch (error) {
      next(error)
    }
  }

  static async addAddress(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401)
      }

      const validatedData = CustomerAddressSchema.parse(req.body)
      const address = await CustomerService.addAddress(req.user.id, validatedData)
      
      res.status(201).json({
        message: 'Address added successfully',
        address,
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(new AppError('Validation error', 400, true, 'VALIDATION_ERROR', undefined, error.errors))
      }
      next(error)
    }
  }

  static async updateAddress(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401)
      }

      const { addressId } = req.params
      const validatedData = CustomerAddressSchema.partial().parse(req.body)
      const updated = await CustomerService.updateAddress(req.user.id, addressId, validatedData)
      
      res.json({
        message: 'Address updated successfully',
        address: updated,
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(new AppError('Validation error', 400, true, 'VALIDATION_ERROR', undefined, error.errors))
      }
      next(error)
    }
  }

  static async deleteAddress(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401)
      }

      const { addressId } = req.params
      await CustomerService.deleteAddress(req.user.id, addressId)
      
      res.json({
        message: 'Address deleted successfully',
      })
    } catch (error) {
      next(error)
    }
  }

  static async setDefaultAddress(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401)
      }

      const { addressId } = req.params
      const updated = await CustomerService.setDefaultAddress(req.user.id, addressId)
      
      res.json({
        message: 'Default address updated successfully',
        address: updated,
      })
    } catch (error) {
      next(error)
    }
  }

  // Payment Method Management
  static async getPaymentMethods(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401)
      }

      const methods = await CustomerService.getPaymentMethods(req.user.id)
      res.json(methods)
    } catch (error) {
      next(error)
    }
  }

  static async getPaymentMethod(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401)
      }

      const { paymentMethodId } = req.params
      const method = await CustomerService.getPaymentMethod(req.user.id, paymentMethodId)
      res.json(method)
    } catch (error) {
      next(error)
    }
  }

  static async addPaymentMethod(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401)
      }

      const validatedData = CustomerPaymentMethodSchema.parse(req.body)
      const method = await CustomerService.addPaymentMethod(req.user.id, validatedData)
      
      res.status(201).json({
        message: 'Payment method added successfully',
        paymentMethod: method,
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(new AppError('Validation error', 400, true, 'VALIDATION_ERROR', undefined, error.errors))
      }
      next(error)
    }
  }

  static async updatePaymentMethod(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401)
      }

      const { paymentMethodId } = req.params
      const validatedData = UpdatePaymentMethodSchema.parse(req.body)
      const updated = await CustomerService.updatePaymentMethod(req.user.id, paymentMethodId, validatedData)
      
      res.json({
        message: 'Payment method updated successfully',
        paymentMethod: updated,
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(new AppError('Validation error', 400, true, 'VALIDATION_ERROR', undefined, error.errors))
      }
      next(error)
    }
  }

  static async deletePaymentMethod(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401)
      }

      const { paymentMethodId } = req.params
      await CustomerService.deletePaymentMethod(req.user.id, paymentMethodId)
      
      res.json({
        message: 'Payment method deleted successfully',
      })
    } catch (error) {
      next(error)
    }
  }

  static async setDefaultPaymentMethod(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401)
      }

      const { paymentMethodId } = req.params
      const updated = await CustomerService.setDefaultPaymentMethod(req.user.id, paymentMethodId)
      
      res.json({
        message: 'Default payment method updated successfully',
        paymentMethod: updated,
      })
    } catch (error) {
      next(error)
    }
  }

  // Order History
  static async getOrderHistory(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401)
      }

      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 10

      const result = await CustomerService.getOrderHistory(req.user.id, page, limit)
      res.json(result)
    } catch (error) {
      next(error)
    }
  }

  // Wishlist Management
  static async getWishlist(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401)
      }

      const query = WishlistQuerySchema.parse(req.query)
      const result = await CustomerService.getWishlist(req.user.id, query)
      res.json(result)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(new AppError('Validation error', 400, true, 'VALIDATION_ERROR', undefined, error.errors))
      }
      next(error)
    }
  }

  static async addToWishlist(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401)
      }

      const { productId } = AddToWishlistSchema.parse(req.body)
      const item = await CustomerService.addToWishlist(req.user.id, productId)
      
      res.status(201).json({
        message: 'Product added to wishlist',
        item,
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(new AppError('Validation error', 400, true, 'VALIDATION_ERROR', undefined, error.errors))
      }
      next(error)
    }
  }

  static async removeFromWishlist(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401)
      }

      const { productId } = req.params
      await CustomerService.removeFromWishlist(req.user.id, productId)
      
      res.json({
        message: 'Product removed from wishlist',
      })
    } catch (error) {
      next(error)
    }
  }

  static async clearWishlist(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401)
      }

      const result = await CustomerService.clearWishlist(req.user.id)
      
      res.json({
        message: 'Wishlist cleared successfully',
        ...result,
      })
    } catch (error) {
      next(error)
    }
  }

  // Customer Preferences
  static async getPreferences(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401)
      }

      const preferences = await CustomerService.getPreferences(req.user.id)
      res.json(preferences)
    } catch (error) {
      next(error)
    }
  }

  static async updatePreferences(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401)
      }

      const validatedData = CustomerPreferencesSchema.partial().parse(req.body)
      const updated = await CustomerService.updatePreferences(req.user.id, validatedData)
      
      res.json({
        message: 'Preferences updated successfully',
        preferences: updated,
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(new AppError('Validation error', 400, true, 'VALIDATION_ERROR', undefined, error.errors))
      }
      next(error)
    }
  }

  // Customer Activity
  static async getActivity(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401)
      }

      const query = CustomerActivityQuerySchema.parse(req.query)
      const result = await CustomerService.getActivity(req.user.id, query)
      res.json(result)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(new AppError('Validation error', 400, true, 'VALIDATION_ERROR', undefined, error.errors))
      }
      next(error)
    }
  }

  // Customer Analytics (Admin only)
  static async getCustomerAnalytics(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user || !['ADMIN', 'SUPER_ADMIN'].includes(req.user.role)) {
        throw new AppError('Admin access required', 403)
      }

      const { customerId } = req.params
      const query = CustomerAnalyticsQuerySchema.parse({ 
        customerId,
        ...req.query 
      })

      const startDate = query.startDate ? new Date(query.startDate) : undefined
      const endDate = query.endDate ? new Date(query.endDate) : undefined

      const analytics = await CustomerService.getAnalytics(customerId, startDate, endDate)
      res.json(analytics)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(new AppError('Validation error', 400, true, 'VALIDATION_ERROR', undefined, error.errors))
      }
      next(error)
    }
  }

  // Customer Search (Admin only)
  static async searchCustomers(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user || !['ADMIN', 'SUPER_ADMIN'].includes(req.user.role)) {
        throw new AppError('Admin access required', 403)
      }

      const query = CustomerSearchSchema.parse(req.query)
      const result = await CustomerService.searchCustomers(query)
      res.json(result)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(new AppError('Validation error', 400, true, 'VALIDATION_ERROR', undefined, error.errors))
      }
      next(error)
    }
  }

  // Customer Data Export (GDPR)
  static async exportData(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401)
      }

      const data = await CustomerService.exportCustomerData(req.user.id)
      
      // Set headers for file download
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Content-Disposition', `attachment; filename="customer-data-${req.user.id}.json"`)
      res.json(data)
    } catch (error) {
      next(error)
    }
  }

  // Account Deletion (GDPR)
  static async deleteAccount(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401)
      }

      const { password } = req.body
      if (!password) {
        throw new AppError('Password confirmation required', 400)
      }

      await CustomerService.deleteAccount(req.user.id, password)
      
      res.json({
        message: 'Account deleted successfully',
      })
    } catch (error) {
      next(error)
    }
  }

  // Admin: View customer profile
  static async adminGetCustomerProfile(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user || !['ADMIN', 'SUPER_ADMIN'].includes(req.user.role)) {
        throw new AppError('Admin access required', 403)
      }

      const { customerId } = req.params
      const profile = await CustomerService.getProfile(customerId)
      res.json(profile)
    } catch (error) {
      next(error)
    }
  }

  // Admin: Update customer status
  static async adminUpdateCustomerStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user || !['ADMIN', 'SUPER_ADMIN'].includes(req.user.role)) {
        throw new AppError('Admin access required', 403)
      }

      const { customerId } = req.params
      const { isActive, reason } = req.body

      if (typeof isActive !== 'boolean') {
        throw new AppError('isActive must be a boolean', 400)
      }

      await prisma.user.update({
        where: { id: customerId },
        data: { isActive },
      })

      await auditLogService.logAdminAction(
        isActive ? 'ACTIVATE_CUSTOMER' : 'DEACTIVATE_CUSTOMER',
        req.user.id,
        'user',
        customerId,
        req as any,
        { reason, adminId: req.user.id }
      )

      res.json({
        message: `Customer ${isActive ? 'activated' : 'deactivated'} successfully`,
      })
    } catch (error) {
      next(error)
    }
  }
}

