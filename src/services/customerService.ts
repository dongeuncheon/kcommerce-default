import { prisma } from '../utils/database'
import { logger } from '../utils/logger'
import { AppError } from '../middleware/error'
import {
  UpdateCustomerProfile,
  CustomerAddress,
  CustomerPaymentMethod,
  UpdatePaymentMethod,
  CustomerPreferences,
  CustomerAnalytics,
  CustomerSearch,
  WishlistQuery,
  CustomerActivityQuery,
} from '../types/customer'
import { Prisma } from '@prisma/client'

export class CustomerService {
  // Profile Management
  static async getProfile(userId: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          role: true,
          isVerified: true,
          createdAt: true,
          lastLoginAt: true,
        },
      })

      if (!user) {
        throw new AppError('User not found', 404)
      }

      return user
    } catch (error) {
      logger.error('Error fetching customer profile:', error)
      throw error
    }
  }

  static async updateProfile(userId: string, data: UpdateCustomerProfile) {
    try {
      const updated = await prisma.user.update({
        where: { id: userId },
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
        },
      })

      return updated
    } catch (error) {
      logger.error('Error updating customer profile:', error)
      throw error
    }
  }

  // Address Management
  static async getAddresses(userId: string) {
    return prisma.address.findMany({
      where: { userId },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' },
      ],
    })
  }

  static async getAddress(userId: string, addressId: string) {
    const address = await prisma.address.findFirst({
      where: {
        id: addressId,
        userId,
      },
    })

    if (!address) {
      throw new AppError('Address not found', 404)
    }

    return address
  }

  static async addAddress(userId: string, data: CustomerAddress) {
    try {
      // If this is set as default, unset other defaults
      if (data.isDefault) {
        await prisma.address.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        })
      }

      const address = await prisma.address.create({
        data: {
          ...data,
          userId,
        },
      })

      return address
    } catch (error) {
      logger.error('Error adding customer address:', error)
      throw error
    }
  }

  static async updateAddress(userId: string, addressId: string, data: Partial<CustomerAddress>) {
    try {
      // Verify ownership
      const existing = await this.getAddress(userId, addressId)

      // If setting as default, unset others
      if (data.isDefault && !existing.isDefault) {
        await prisma.address.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        })
      }

      const updated = await prisma.address.update({
        where: { id: addressId },
        data,
      })

      return updated
    } catch (error) {
      logger.error('Error updating customer address:', error)
      throw error
    }
  }

  static async deleteAddress(userId: string, addressId: string) {
    try {
      // Verify ownership
      await this.getAddress(userId, addressId)

      // Check if address is used in any pending orders
      const pendingOrders = await prisma.order.count({
        where: {
          userId,
          status: { in: ['PENDING', 'CONFIRMED', 'PROCESSING'] },
          OR: [
            { shippingAddressId: addressId },
            { billingAddressId: addressId },
          ],
        },
      })

      if (pendingOrders > 0) {
        throw new AppError('Cannot delete address used in pending orders', 400)
      }

      await prisma.address.delete({
        where: { id: addressId },
      })
    } catch (error) {
      logger.error('Error deleting customer address:', error)
      throw error
    }
  }

  static async setDefaultAddress(userId: string, addressId: string) {
    try {
      await this.getAddress(userId, addressId)
      await prisma.address.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      })
      const updated = await prisma.address.update({
        where: { id: addressId },
        data: { isDefault: true },
      })
      return updated
    } catch (error) {
      logger.error('Error setting default address:', error)
      throw error
    }
  }

  static async getPaymentMethods(userId: string) {
    return prisma.paymentMethod.findMany({
      where: { userId },
      select: {
        id: true,
        type: true,
        provider: true,
        last4: true,
        brand: true,
        expiryMonth: true,
        expiryYear: true,
        isDefault: true,
        createdAt: true,
      },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' },
      ],
    })
  }

  static async getPaymentMethod(userId: string, paymentMethodId: string) {
    const method = await prisma.paymentMethod.findFirst({
      where: {
        id: paymentMethodId,
        userId,
      },
      select: {
        id: true,
        type: true,
        provider: true,
        last4: true,
        brand: true,
        expiryMonth: true,
        expiryYear: true,
        isDefault: true,
        createdAt: true,
      },
    })

    if (!method) {
      throw new AppError('Payment method not found', 404)
    }

    return method
  }

  static async addPaymentMethod(userId: string, data: CustomerPaymentMethod) {
    try {
      if (data.isDefault) {
        await prisma.paymentMethod.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        })
      }

      const method = await prisma.paymentMethod.create({
        data: {
          ...data,
          userId,
        },
        select: {
          id: true,
          type: true,
          provider: true,
          last4: true,
          brand: true,
          expiryMonth: true,
          expiryYear: true,
          isDefault: true,
          createdAt: true,
        },
      })

      return method
    } catch (error) {
      logger.error('Error adding payment method:', error)
      throw error
    }
  }

  static async updatePaymentMethod(userId: string, paymentMethodId: string, data: UpdatePaymentMethod) {
    try {
      await this.getPaymentMethod(userId, paymentMethodId)

      if (data.isDefault) {
        await prisma.paymentMethod.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        })
      }

      const updated = await prisma.paymentMethod.update({
        where: { id: paymentMethodId },
        data: {
          isDefault: data.isDefault,
        },
        select: {
          id: true,
          type: true,
          provider: true,
          last4: true,
          brand: true,
          expiryMonth: true,
          expiryYear: true,
          isDefault: true,
          createdAt: true,
        },
      })

      return updated
    } catch (error) {
      logger.error('Error updating payment method:', error)
      throw error
    }
  }

  static async deletePaymentMethod(userId: string, paymentMethodId: string) {
    try {
      await this.getPaymentMethod(userId, paymentMethodId)
      await prisma.paymentMethod.delete({
        where: { id: paymentMethodId },
      })
    } catch (error) {
      logger.error('Error deleting payment method:', error)
      throw error
    }
  }

  static async setDefaultPaymentMethod(userId: string, paymentMethodId: string) {
    try {
      await this.getPaymentMethod(userId, paymentMethodId)
      await prisma.paymentMethod.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      })
      const updated = await prisma.paymentMethod.update({
        where: { id: paymentMethodId },
        data: { isDefault: true },
        select: {
          id: true,
          type: true,
          provider: true,
          last4: true,
          brand: true,
          expiryMonth: true,
          expiryYear: true,
          isDefault: true,
          createdAt: true,
        },
      })
      return updated
    } catch (error) {
      logger.error('Error setting default payment method:', error)
      throw error
    }
  }

  static async getOrderHistory(userId: string, page = 1, limit = 10) {
    try {
      const skip = (page - 1) * limit
      const [orders, total] = await Promise.all([
        prisma.order.findMany({
          where: { userId },
          include: {
            items: true,
            shippingAddress: true,
            shipments: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.order.count({ where: { userId } }),
      ])

      return {
        orders,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      }
    } catch (error) {
      logger.error('Error fetching order history:', error)
      throw error
    }
  }

  static async getWishlist(userId: string, query: WishlistQuery) {
    try {
      const skip = (query.page - 1) * query.limit
      const where: any = { userId }

      const [items, total] = await Promise.all([
        prisma.wishlistItem.findMany({
          where,
          include: {
            product: {
              include: {
                images: {
                  where: { isMain: true },
                  take: 1,
                },
                category: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: query.limit,
        }),
        prisma.wishlistItem.count({ where }),
      ])

      return {
        items,
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.ceil(total / query.limit),
        },
      }
    } catch (error) {
      logger.error('Error fetching wishlist:', error)
      throw error
    }
  }

  static async addToWishlist(userId: string, productId: string) {
    try {
      const product = await prisma.product.findUnique({
        where: { id: productId },
      })

      if (!product) {
        throw new AppError('Product not found', 404)
      }

      const existing = await prisma.wishlistItem.findUnique({
        where: {
          userId_productId: {
            userId,
            productId,
          },
        },
      })

      if (existing) {
        throw new AppError('Product already in wishlist', 400)
      }

      const item = await prisma.wishlistItem.create({
        data: {
          userId,
          productId,
        },
        include: {
          product: {
            include: {
              images: {
                where: { isMain: true },
                take: 1,
              },
            },
          },
        },
      })

      return item
    } catch (error) {
      logger.error('Error adding to wishlist:', error)
      throw error
    }
  }

  static async removeFromWishlist(userId: string, productId: string) {
    try {
      const deleted = await prisma.wishlistItem.deleteMany({
        where: {
          userId,
          productId,
        },
      })

      if (deleted.count === 0) {
        throw new AppError('Product not in wishlist', 404)
      }
    } catch (error) {
      logger.error('Error removing from wishlist:', error)
      throw error
    }
  }

  static async clearWishlist(userId: string) {
    try {
      const deleted = await prisma.wishlistItem.deleteMany({
        where: { userId },
      })

      return { deleted: deleted.count }
    } catch (error) {
      logger.error('Error clearing wishlist:', error)
      throw error
    }
  }

  static async getPreferences(userId: string): Promise<CustomerPreferences> {
    try {
      const setting = await prisma.setting.findUnique({
        where: { key: `user_preferences_${userId}` },
      })

      if (!setting) {
        return {
          language: 'en',
          currency: 'USD',
          emailNotifications: true,
          smsNotifications: false,
          marketingEmails: false,
          orderUpdates: true,
          newsletter: false,
          theme: 'auto' as const,
        }
      }

      return setting.value as CustomerPreferences
    } catch (error) {
      logger.error('Error fetching customer preferences:', error)
      throw error
    }
  }

  static async updatePreferences(userId: string, preferences: Partial<CustomerPreferences>) {
    try {
      const current = await this.getPreferences(userId)
      const updated = { ...current, ...preferences }

      await prisma.setting.upsert({
        where: { key: `user_preferences_${userId}` },
        update: { value: updated },
        create: {
          key: `user_preferences_${userId}`,
          value: updated,
          category: 'user_preferences',
          isPublic: false,
        },
      })

      return updated
    } catch (error) {
      logger.error('Error updating customer preferences:', error)
      throw error
    }
  }

  static async getActivity(userId: string, query: CustomerActivityQuery) {
    try {
      const skip = (query.page - 1) * query.limit
      const where: any = { userId }

      if (query.type) {
        where.action = { contains: query.type.toUpperCase() }
      }
      if (query.startDate) {
        where.createdAt = { gte: new Date(query.startDate) }
      }
      if (query.endDate) {
        where.createdAt = { ...where.createdAt, lte: new Date(query.endDate) }
      }

      const [activities, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: query.limit,
        }),
        prisma.auditLog.count({ where }),
      ])

      return {
        activities,
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.ceil(total / query.limit),
        },
      }
    } catch (error) {
      logger.error('Error fetching customer activity:', error)
      throw error
    }
  }

  static async getAnalytics(customerId: string, startDate?: Date, endDate?: Date): Promise<CustomerAnalytics> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: customerId },
        include: {
          orders: {
            where: {
              createdAt: {
                gte: startDate,
                lte: endDate,
              },
            },
          },
          reviews: true,
          wishlistItems: true,
        },
      })

      if (!user) {
        throw new AppError('Customer not found', 404)
      }

      const totalOrders = user.orders.length
      const totalSpent = user.orders.reduce((sum, order) =>
        sum + Number(order.total), 0,
      )
      const averageOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0

      return {
        overview: {
          totalOrders,
          totalSpent,
          averageOrderValue,
          lastOrderDate: user.orders[0]?.createdAt,
          customerSince: user.createdAt,
          lifetimeValue: totalSpent,
        },
        orders: {
          count: totalOrders,
          statuses: {},
          monthlySpend: [],
        },
        products: {
          topCategories: [],
          topProducts: [],
          recentlyViewed: [],
        },
        engagement: {
          reviewCount: user.reviews.length,
          averageRating: 0,
          wishlistCount: user.wishlistItems.length,
          lastLoginAt: user.lastLoginAt || undefined,
          loginCount: 0,
        },
      }
    } catch (error) {
      logger.error('Error fetching customer analytics:', error)
      throw error
    }
  }

  static async searchCustomers(query: CustomerSearch) {
    try {
      const skip = (query.page - 1) * query.limit

      const where: Prisma.UserWhereInput = {
        role: query.role || 'CUSTOMER',
      }

      if (query.search) {
        where.OR = [
          { email: { contains: query.search, mode: 'insensitive' } },
          { firstName: { contains: query.search, mode: 'insensitive' } },
          { lastName: { contains: query.search, mode: 'insensitive' } },
        ]
      }

      const [customers, total] = await Promise.all([
        prisma.user.findMany({
          where,
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            role: true,
            isActive: true,
            isVerified: true,
            createdAt: true,
            lastLoginAt: true,
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: query.limit,
        }),
        prisma.user.count({ where }),
      ])

      return {
        customers,
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.ceil(total / query.limit),
        },
      }
    } catch (error) {
      logger.error('Error searching customers:', error)
      throw error
    }
  }

  static async deleteAccount(userId: string, _password: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { password: true },
      })

      if (!user) {
        throw new AppError('User not found', 404)
      }

      await prisma.user.update({
        where: { id: userId },
        data: {
          deletedAt: new Date(),
          email: `deleted_${userId}@deleted.com`,
          firstName: 'Deleted',
          lastName: 'User',
          phone: null,
          isActive: false,
        },
      })

      await Promise.all([
        prisma.address.deleteMany({ where: { userId } }),
        prisma.paymentMethod.deleteMany({ where: { userId } }),
        prisma.wishlistItem.deleteMany({ where: { userId } }),
        prisma.cart.deleteMany({ where: { userId } }),
        prisma.session.deleteMany({ where: { userId } }),
      ])

      logger.info(`Customer account deleted: ${userId}`)
    } catch (error) {
      logger.error('Error deleting customer account:', error)
      throw error
    }
  }

  static async exportCustomerData(userId: string) {
    try {
      const data = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          addresses: true,
          orders: {
            include: {
              items: true,
              payments: true,
              shipments: true,
            },
          },
          reviews: true,
          wishlistItems: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                },
              },
            },
          },
          carts: {
            include: {
              items: {
                include: {
                  product: {
                    select: {
                      id: true,
                      name: true,
                      sku: true,
                    },
                  },
                },
              },
            },
          },
        },
      })

      if (!data) {
        throw new AppError('Customer not found', 404)
      }

      const { password: _password, ...customerData } = data as any

      return customerData
    } catch (error) {
      logger.error('Error exporting customer data:', error)
      throw error
    }
  }
}
