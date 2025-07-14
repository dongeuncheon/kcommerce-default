import { CustomerService } from '../../../src/services/customerService'
import { prisma } from '../../../src/utils/database'
import { AppError } from '../../../src/middleware/error'
import { AuditLogService } from '../../../src/services/auditLogService'
import { NotificationService } from '../../../src/services/notificationService'

// Mock dependencies
jest.mock('../../../src/utils/database', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    address: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
    paymentMethod: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
    wishlistItem: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
    },
    order: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    product: {
      findUnique: jest.fn(),
    },
    setting: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    auditLog: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    $disconnect: jest.fn(),
  },
}))

jest.mock('../../../src/services/auditLogService')
jest.mock('../../../src/services/notificationService')

describe('CustomerService', () => {
  const mockUserId = 'user123'
  const mockAddressId = 'address123'
  const mockPaymentMethodId = 'payment123'
  const mockProductId = 'product123'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getProfile', () => {
    test('should return user profile with preferences and stats', async () => {
      const mockUser = {
        id: mockUserId,
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        phone: '+1234567890',
        role: 'CUSTOMER',
        isVerified: true,
        createdAt: new Date(),
        lastLoginAt: new Date(),
        addresses: [],
        paymentMethods: [],
        orders: [],
        wishlistItems: [],
        _count: {
          orders: 5,
          reviews: 3,
          wishlistItems: 2,
        },
      }

      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser)
      ;(prisma.setting.findUnique as jest.Mock).mockResolvedValue(null)

      const profile = await CustomerService.getProfile(mockUserId)

      expect(profile).toMatchObject({
        id: mockUserId,
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        preferences: {
          language: 'en',
          currency: 'USD',
          emailNotifications: true,
          theme: 'auto',
        },
        stats: {
          totalOrders: 5,
          totalReviews: 3,
          wishlistItems: 2,
        },
      })
    })

    test('should throw error if user not found', async () => {
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(null)

      await expect(CustomerService.getProfile(mockUserId))
        .rejects.toThrow(new AppError('User not found', 404))
    })
  })

  describe('updateProfile', () => {
    test('should update user profile successfully', async () => {
      const updateData = {
        firstName: 'Updated',
        lastName: 'Name',
        phone: '+9876543210',
      }

      const updatedUser = {
        id: mockUserId,
        email: 'test@example.com',
        ...updateData,
      }

      ;(prisma.user.update as jest.Mock).mockResolvedValue(updatedUser)

      const result = await CustomerService.updateProfile(mockUserId, updateData)

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUserId },
        data: updateData,
        select: expect.any(Object),
      })
      expect(result).toEqual(updatedUser)
      expect(AuditLogService.log).toHaveBeenCalledWith({
        userId: mockUserId,
        action: 'UPDATE_PROFILE',
        entityType: 'USER',
        entityId: mockUserId,
        metadata: { updatedFields: ['firstName', 'lastName', 'phone'] },
      })
    })
  })

  describe('Address Management', () => {
    describe('getAddresses', () => {
      test('should return user addresses sorted by default and date', async () => {
        const mockAddresses = [
          { id: 'addr1', isDefault: true, createdAt: new Date() },
          { id: 'addr2', isDefault: false, createdAt: new Date() },
        ]

        ;(prisma.address.findMany as jest.Mock).mockResolvedValue(mockAddresses)

        const addresses = await CustomerService.getAddresses(mockUserId)

        expect(prisma.address.findMany).toHaveBeenCalledWith({
          where: { userId: mockUserId },
          orderBy: [
            { isDefault: 'desc' },
            { createdAt: 'desc' },
          ],
        })
        expect(addresses).toEqual(mockAddresses)
      })
    })

    describe('addAddress', () => {
      test('should add address and set as default', async () => {
        const addressData = {
          type: 'SHIPPING' as const,
          firstName: 'John',
          lastName: 'Doe',
          addressLine1: '123 Main St',
          city: 'New York',
          state: 'NY',
          postalCode: '10001',
          country: 'US',
          isDefault: true,
        }

        const createdAddress = { id: mockAddressId, ...addressData }

        ;(prisma.address.updateMany as jest.Mock).mockResolvedValue({ count: 1 })
        ;(prisma.address.create as jest.Mock).mockResolvedValue(createdAddress)

        const result = await CustomerService.addAddress(mockUserId, addressData)

        expect(prisma.address.updateMany).toHaveBeenCalledWith({
          where: { userId: mockUserId, isDefault: true },
          data: { isDefault: false },
        })
        expect(prisma.address.create).toHaveBeenCalledWith({
          data: { ...addressData, userId: mockUserId },
        })
        expect(result).toEqual(createdAddress)
      })
    })

    describe('deleteAddress', () => {
      test('should delete address if not used in pending orders', async () => {
        ;(prisma.address.findFirst as jest.Mock).mockResolvedValue({ id: mockAddressId })
        ;(prisma.order.count as jest.Mock).mockResolvedValue(0)
        ;(prisma.address.delete as jest.Mock).mockResolvedValue({ id: mockAddressId })

        await CustomerService.deleteAddress(mockUserId, mockAddressId)

        expect(prisma.order.count).toHaveBeenCalled()
        expect(prisma.address.delete).toHaveBeenCalledWith({
          where: { id: mockAddressId },
        })
      })

      test('should throw error if address used in pending orders', async () => {
        ;(prisma.address.findFirst as jest.Mock).mockResolvedValue({ id: mockAddressId })
        ;(prisma.order.count as jest.Mock).mockResolvedValue(1)

        await expect(CustomerService.deleteAddress(mockUserId, mockAddressId))
          .rejects.toThrow(new AppError('Cannot delete address used in pending orders', 400))
      })
    })
  })

  describe('Wishlist Management', () => {
    describe('addToWishlist', () => {
      test('should add product to wishlist', async () => {
        const mockProduct = {
          id: mockProductId,
          name: 'Test Product',
          price: 99.99,
          comparePrice: 149.99,
        }

        const mockWishlistItem = {
          id: 'wishlist123',
          userId: mockUserId,
          productId: mockProductId,
          product: mockProduct,
        }

        ;(prisma.product.findUnique as jest.Mock).mockResolvedValue(mockProduct)
        ;(prisma.wishlistItem.findUnique as jest.Mock).mockResolvedValue(null)
        ;(prisma.wishlistItem.create as jest.Mock).mockResolvedValue(mockWishlistItem)

        const result = await CustomerService.addToWishlist(mockUserId, mockProductId)

        expect(prisma.wishlistItem.create).toHaveBeenCalledWith({
          data: { userId: mockUserId, productId: mockProductId },
          include: expect.any(Object),
        })
        expect(result).toEqual(mockWishlistItem)
        expect(NotificationService.sendNotification).toHaveBeenCalled()
      })

      test('should throw error if product already in wishlist', async () => {
        ;(prisma.product.findUnique as jest.Mock).mockResolvedValue({ id: mockProductId })
        ;(prisma.wishlistItem.findUnique as jest.Mock).mockResolvedValue({ id: 'existing' })

        await expect(CustomerService.addToWishlist(mockUserId, mockProductId))
          .rejects.toThrow(new AppError('Product already in wishlist', 400))
      })
    })

    describe('getWishlist', () => {
      test('should return paginated wishlist', async () => {
        const mockItems = [
          { id: 'item1', productId: 'prod1', product: { name: 'Product 1' } },
          { id: 'item2', productId: 'prod2', product: { name: 'Product 2' } },
        ]

        ;(prisma.wishlistItem.findMany as jest.Mock).mockResolvedValue(mockItems)
        ;(prisma.wishlistItem.count as jest.Mock).mockResolvedValue(2)

        const result = await CustomerService.getWishlist(mockUserId, {
          page: 1,
          limit: 10,
          sortBy: 'addedAt',
          sortOrder: 'desc',
        })

        expect(result).toHaveProperty('items', mockItems)
        expect(result).toHaveProperty('pagination')
        expect(result.pagination).toMatchObject({
          page: 1,
          limit: 10,
          total: 2,
          totalPages: 1,
        })
      })
    })
  })

  describe('Preferences Management', () => {
    test('should return default preferences if none exist', async () => {
      ;(prisma.setting.findUnique as jest.Mock).mockResolvedValue(null)

      const preferences = await CustomerService.getPreferences(mockUserId)

      expect(preferences).toEqual({
        language: 'en',
        currency: 'USD',
        emailNotifications: true,
        smsNotifications: false,
        marketingEmails: false,
        orderUpdates: true,
        newsletter: false,
        theme: 'auto',
      })
    })

    test('should update preferences', async () => {
      const currentPrefs = { language: 'en', currency: 'USD' }
      const updates = { language: 'es', theme: 'dark' }
      const merged = { ...currentPrefs, ...updates }

      ;(prisma.setting.findUnique as jest.Mock).mockResolvedValue({ value: currentPrefs })
      ;(prisma.setting.upsert as jest.Mock).mockResolvedValue({ value: merged })

      const result = await CustomerService.updatePreferences(mockUserId, updates)

      expect(prisma.setting.upsert).toHaveBeenCalledWith({
        where: { key: `user_preferences_${mockUserId}` },
        update: { value: merged },
        create: {
          key: `user_preferences_${mockUserId}`,
          value: merged,
          category: 'user_preferences',
          isPublic: false,
        },
      })
      expect(result).toEqual(merged)
    })
  })

  describe('Customer Analytics', () => {
    test('should calculate comprehensive analytics', async () => {
      const mockOrders = [
        {
          id: 'order1',
          total: 100,
          status: 'DELIVERED',
          createdAt: new Date('2024-01-01'),
          items: [
            {
              product: {
                id: 'prod1',
                name: 'Product 1',
                category: { id: 'cat1', name: 'Category 1' },
              },
              quantity: 2,
              total: 100,
            },
          ],
        },
        {
          id: 'order2',
          total: 200,
          status: 'DELIVERED',
          createdAt: new Date('2024-02-01'),
          items: [
            {
              product: {
                id: 'prod2',
                name: 'Product 2',
                category: { id: 'cat1', name: 'Category 1' },
              },
              quantity: 1,
              total: 200,
            },
          ],
        },
      ]

      const mockUser = {
        id: mockUserId,
        createdAt: new Date('2023-01-01'),
        lastLoginAt: new Date(),
        orders: mockOrders,
        reviews: [{ rating: 4 }, { rating: 5 }],
        wishlistItems: [{}, {}, {}],
        sessions: [{ createdAt: new Date() }],
        _count: { sessions: 10 },
      }

      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser)

      const analytics = await CustomerService.getAnalytics(mockUserId)

      expect(analytics.overview).toMatchObject({
        totalOrders: 2,
        totalSpent: 300,
        averageOrderValue: 150,
        customerSince: mockUser.createdAt,
        lifetimeValue: 300,
      })
      expect(analytics.orders).toMatchObject({
        count: 2,
        statuses: { DELIVERED: 2 },
      })
      expect(analytics.engagement).toMatchObject({
        reviewCount: 2,
        averageRating: 4.5,
        wishlistCount: 3,
        loginCount: 10,
      })
    })
  })

  describe('GDPR Compliance', () => {
    describe('exportCustomerData', () => {
      test('should export all customer data without sensitive fields', async () => {
        const mockUserData = {
          id: mockUserId,
          email: 'test@example.com',
          password: 'hashedpassword',
          firstName: 'Test',
          lastName: 'User',
          addresses: [{ id: 'addr1' }],
          orders: [{ id: 'order1' }],
          reviews: [{ id: 'review1' }],
          wishlistItems: [{ id: 'wish1' }],
          carts: [{ id: 'cart1' }],
        }

        ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUserData)

        const exportedData = await CustomerService.exportCustomerData(mockUserId)

        expect(exportedData).not.toHaveProperty('password')
        expect(exportedData).toHaveProperty('email')
        expect(exportedData).toHaveProperty('addresses')
        expect(exportedData).toHaveProperty('orders')
      })
    })

    describe('deleteAccount', () => {
      test('should soft delete account and remove sensitive data', async () => {
        ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({ password: 'hashed' })
        ;(prisma.user.update as jest.Mock).mockResolvedValue({})
        ;(prisma.address.deleteMany as jest.Mock).mockResolvedValue({})
        ;(prisma.paymentMethod.deleteMany as jest.Mock).mockResolvedValue({})
        ;(prisma.wishlistItem.deleteMany as jest.Mock).mockResolvedValue({})

        await CustomerService.deleteAccount(mockUserId, 'password123')

        expect(prisma.user.update).toHaveBeenCalledWith({
          where: { id: mockUserId },
          data: {
            deletedAt: expect.any(Date),
            email: `deleted_${mockUserId}@deleted.com`,
            firstName: 'Deleted',
            lastName: 'User',
            phone: null,
            isActive: false,
          },
        })
        expect(prisma.address.deleteMany).toHaveBeenCalledWith({ where: { userId: mockUserId } })
        expect(prisma.paymentMethod.deleteMany).toHaveBeenCalledWith({ where: { userId: mockUserId } })
      })
    })
  })
})