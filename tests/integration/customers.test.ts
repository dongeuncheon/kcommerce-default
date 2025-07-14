import request from 'supertest'
import app from '../../src/index'
import { prisma } from '../../src/utils/database'
import { SecurityUtils } from '../../src/utils/security'
import { CustomerService } from '../../src/services/customerService'

describe('Customer Management Integration Tests', () => {
  let authToken: string
  let userId: string
  let addressId: string
  let paymentMethodId: string
  let productId: string

  beforeAll(async () => {
    // Clean up database
    await prisma.wishlistItem.deleteMany()
    await prisma.address.deleteMany()
    await prisma.paymentMethod.deleteMany()
    await prisma.user.deleteMany()
    await prisma.product.deleteMany()
    await prisma.category.deleteMany()

    // Create test user
    const hashedPassword = await SecurityUtils.hashPassword('Test123!')
    const user = await prisma.user.create({
      data: {
        email: 'test@example.com',
        password: hashedPassword,
        firstName: 'Test',
        lastName: 'User',
        role: 'CUSTOMER',
        isVerified: true,
      },
    })
    userId = user.id

    // Create session and generate token
    const token = SecurityUtils.generateJWT({ id: user.id, email: user.email })
    authToken = token

    await prisma.session.create({
      data: {
        userId: user.id,
        token: SecurityUtils.hashData(token),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    })

    // Create test product for wishlist tests
    const category = await prisma.category.create({
      data: {
        name: 'Test Category',
        slug: 'test-category',
      },
    })

    const product = await prisma.product.create({
      data: {
        name: 'Test Product',
        slug: 'test-product',
        sku: 'TEST-001',
        price: 99.99,
        quantity: 100,
        status: 'PUBLISHED',
        categoryId: category.id,
      },
    })
    productId = product.id
  })

  afterAll(async () => {
    await prisma.wishlistItem.deleteMany()
    await prisma.address.deleteMany()
    await prisma.paymentMethod.deleteMany()
    await prisma.session.deleteMany()
    await prisma.user.deleteMany()
    await prisma.product.deleteMany()
    await prisma.category.deleteMany()
    await prisma.$disconnect()
  })

  describe('Profile Management', () => {
    test('should get customer profile', async () => {
      const response = await request(app)
        .get('/api/v1/customers/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body).toHaveProperty('id', userId)
      expect(response.body).toHaveProperty('email', 'test@example.com')
      expect(response.body).toHaveProperty('firstName', 'Test')
      expect(response.body).toHaveProperty('lastName', 'User')
      expect(response.body).toHaveProperty('preferences')
      expect(response.body).toHaveProperty('stats')
    })

    test('should update customer profile', async () => {
      const response = await request(app)
        .put('/api/v1/customers/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-CSRF-Token', 'test-csrf-token')
        .send({
          firstName: 'Updated',
          lastName: 'Name',
          phone: '+1234567890',
        })
        .expect(200)

      expect(response.body.message).toBe('Profile updated successfully')
      expect(response.body.profile.firstName).toBe('Updated')
      expect(response.body.profile.lastName).toBe('Name')
      expect(response.body.profile.phone).toBe('+1234567890')
    })

    test('should validate profile update data', async () => {
      const response = await request(app)
        .put('/api/v1/customers/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-CSRF-Token', 'test-csrf-token')
        .send({
          firstName: '', // Invalid: empty string
        })
        .expect(400)

      expect(response.body.message).toBe('Validation error')
    })
  })

  describe('Address Management', () => {
    test('should add a new address', async () => {
      const response = await request(app)
        .post('/api/v1/customers/addresses')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-CSRF-Token', 'test-csrf-token')
        .send({
          type: 'SHIPPING',
          firstName: 'John',
          lastName: 'Doe',
          addressLine1: '123 Main St',
          city: 'New York',
          state: 'NY',
          postalCode: '10001',
          country: 'US',
          isDefault: true,
        })
        .expect(201)

      expect(response.body.message).toBe('Address added successfully')
      expect(response.body.address).toHaveProperty('id')
      expect(response.body.address.type).toBe('SHIPPING')
      expect(response.body.address.isDefault).toBe(true)
      addressId = response.body.address.id
    })

    test('should get all addresses', async () => {
      const response = await request(app)
        .get('/api/v1/customers/addresses')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(Array.isArray(response.body)).toBe(true)
      expect(response.body.length).toBeGreaterThan(0)
      expect(response.body[0]).toHaveProperty('id', addressId)
    })

    test('should get specific address', async () => {
      const response = await request(app)
        .get(`/api/v1/customers/addresses/${addressId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body).toHaveProperty('id', addressId)
      expect(response.body.type).toBe('SHIPPING')
    })

    test('should update address', async () => {
      const response = await request(app)
        .put(`/api/v1/customers/addresses/${addressId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-CSRF-Token', 'test-csrf-token')
        .send({
          addressLine1: '456 Updated St',
          city: 'Los Angeles',
          state: 'CA',
        })
        .expect(200)

      expect(response.body.message).toBe('Address updated successfully')
      expect(response.body.address.addressLine1).toBe('456 Updated St')
      expect(response.body.address.city).toBe('Los Angeles')
    })

    test('should set default address', async () => {
      // Create another address
      const newAddress = await request(app)
        .post('/api/v1/customers/addresses')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-CSRF-Token', 'test-csrf-token')
        .send({
          type: 'BILLING',
          firstName: 'Jane',
          lastName: 'Doe',
          addressLine1: '789 Other St',
          city: 'Chicago',
          state: 'IL',
          postalCode: '60601',
          country: 'US',
          isDefault: false,
        })
        .expect(201)

      const newAddressId = newAddress.body.address.id

      // Set it as default
      const response = await request(app)
        .put(`/api/v1/customers/addresses/${newAddressId}/set-default`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-CSRF-Token', 'test-csrf-token')
        .expect(200)

      expect(response.body.message).toBe('Default address updated successfully')
      expect(response.body.address.isDefault).toBe(true)
    })

    test('should delete address', async () => {
      const response = await request(app)
        .delete(`/api/v1/customers/addresses/${addressId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-CSRF-Token', 'test-csrf-token')
        .expect(200)

      expect(response.body.message).toBe('Address deleted successfully')
    })
  })

  describe('Payment Method Management', () => {
    test('should add a payment method', async () => {
      const response = await request(app)
        .post('/api/v1/customers/payment-methods')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-CSRF-Token', 'test-csrf-token')
        .send({
          type: 'CREDIT_CARD',
          provider: 'stripe',
          last4: '4242',
          expiryMonth: 12,
          expiryYear: 2025,
          brand: 'Visa',
          isDefault: true,
        })
        .expect(201)

      expect(response.body.message).toBe('Payment method added successfully')
      expect(response.body.paymentMethod).toHaveProperty('id')
      expect(response.body.paymentMethod.type).toBe('CREDIT_CARD')
      paymentMethodId = response.body.paymentMethod.id
    })

    test('should get all payment methods', async () => {
      const response = await request(app)
        .get('/api/v1/customers/payment-methods')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(Array.isArray(response.body)).toBe(true)
      expect(response.body.length).toBeGreaterThan(0)
      expect(response.body[0]).toHaveProperty('id', paymentMethodId)
    })

    test('should update payment method', async () => {
      const response = await request(app)
        .put(`/api/v1/customers/payment-methods/${paymentMethodId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-CSRF-Token', 'test-csrf-token')
        .send({
          isDefault: false,
        })
        .expect(200)

      expect(response.body.message).toBe('Payment method updated successfully')
      expect(response.body.paymentMethod.isDefault).toBe(false)
    })

    test('should delete payment method', async () => {
      const response = await request(app)
        .delete(`/api/v1/customers/payment-methods/${paymentMethodId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-CSRF-Token', 'test-csrf-token')
        .expect(200)

      expect(response.body.message).toBe('Payment method deleted successfully')
    })
  })

  describe('Wishlist Management', () => {
    test('should add product to wishlist', async () => {
      const response = await request(app)
        .post('/api/v1/customers/wishlist')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-CSRF-Token', 'test-csrf-token')
        .send({
          productId,
        })
        .expect(201)

      expect(response.body.message).toBe('Product added to wishlist')
      expect(response.body.item).toHaveProperty('productId', productId)
    })

    test('should get wishlist', async () => {
      const response = await request(app)
        .get('/api/v1/customers/wishlist')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body).toHaveProperty('items')
      expect(response.body).toHaveProperty('pagination')
      expect(response.body.items.length).toBeGreaterThan(0)
      expect(response.body.items[0]).toHaveProperty('productId', productId)
    })

    test('should remove product from wishlist', async () => {
      const response = await request(app)
        .delete(`/api/v1/customers/wishlist/${productId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-CSRF-Token', 'test-csrf-token')
        .expect(200)

      expect(response.body.message).toBe('Product removed from wishlist')
    })

    test('should clear wishlist', async () => {
      // Add product back
      await request(app)
        .post('/api/v1/customers/wishlist')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-CSRF-Token', 'test-csrf-token')
        .send({ productId })
        .expect(201)

      // Clear wishlist
      const response = await request(app)
        .delete('/api/v1/customers/wishlist')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-CSRF-Token', 'test-csrf-token')
        .expect(200)

      expect(response.body.message).toBe('Wishlist cleared successfully')
      expect(response.body.deleted).toBe(1)
    })
  })

  describe('Customer Preferences', () => {
    test('should get preferences with defaults', async () => {
      const response = await request(app)
        .get('/api/v1/customers/preferences')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body).toHaveProperty('language', 'en')
      expect(response.body).toHaveProperty('currency', 'USD')
      expect(response.body).toHaveProperty('emailNotifications', true)
      expect(response.body).toHaveProperty('theme', 'auto')
    })

    test('should update preferences', async () => {
      const response = await request(app)
        .put('/api/v1/customers/preferences')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-CSRF-Token', 'test-csrf-token')
        .send({
          language: 'es',
          currency: 'EUR',
          theme: 'dark',
          marketingEmails: true,
        })
        .expect(200)

      expect(response.body.message).toBe('Preferences updated successfully')
      expect(response.body.preferences.language).toBe('es')
      expect(response.body.preferences.currency).toBe('EUR')
      expect(response.body.preferences.theme).toBe('dark')
      expect(response.body.preferences.marketingEmails).toBe(true)
    })
  })

  describe('Customer Activity', () => {
    test('should get customer activity', async () => {
      const response = await request(app)
        .get('/api/v1/customers/activity')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body).toHaveProperty('activities')
      expect(response.body).toHaveProperty('pagination')
      expect(Array.isArray(response.body.activities)).toBe(true)
    })

    test('should filter activity by type', async () => {
      const response = await request(app)
        .get('/api/v1/customers/activity?type=profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body).toHaveProperty('activities')
      // Activities should be profile-related
    })
  })

  describe('Order History', () => {
    test('should get order history', async () => {
      const response = await request(app)
        .get('/api/v1/customers/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body).toHaveProperty('orders')
      expect(response.body).toHaveProperty('pagination')
      expect(Array.isArray(response.body.orders)).toBe(true)
    })

    test('should support pagination', async () => {
      const response = await request(app)
        .get('/api/v1/customers/orders?page=1&limit=5')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body.pagination.page).toBe(1)
      expect(response.body.pagination.limit).toBe(5)
    })
  })

  describe('GDPR Compliance', () => {
    test('should export customer data', async () => {
      const response = await request(app)
        .get('/api/v1/customers/export-data')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.headers['content-type']).toContain('application/json')
      expect(response.headers['content-disposition']).toContain('attachment')
      expect(response.body).toHaveProperty('id', userId)
      expect(response.body).toHaveProperty('email')
      expect(response.body).not.toHaveProperty('password')
    })

    test('should require password for account deletion', async () => {
      const response = await request(app)
        .delete('/api/v1/customers/account')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-CSRF-Token', 'test-csrf-token')
        .send({})
        .expect(400)

      expect(response.body.message).toBe('Password confirmation required')
    })

    // Note: Actual account deletion test would affect other tests
  })

  describe('Admin Features', () => {
    let adminToken: string
    let adminUserId: string

    beforeAll(async () => {
      // Create admin user
      const hashedPassword = await SecurityUtils.hashPassword('Admin123!')
      const admin = await prisma.user.create({
        data: {
          email: 'admin@example.com',
          password: hashedPassword,
          firstName: 'Admin',
          lastName: 'User',
          role: 'ADMIN',
          isVerified: true,
        },
      })
      adminUserId = admin.id

      // Create admin session
      const token = SecurityUtils.generateJWT({ id: admin.id, email: admin.email })
      adminToken = token

      await prisma.session.create({
        data: {
          userId: admin.id,
          token: SecurityUtils.hashData(token),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      })
    })

    test('should search customers as admin', async () => {
      const response = await request(app)
        .get('/api/v1/customers/search?search=test')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      expect(response.body).toHaveProperty('customers')
      expect(response.body).toHaveProperty('pagination')
      expect(Array.isArray(response.body.customers)).toBe(true)
    })

    test('should get customer analytics as admin', async () => {
      const response = await request(app)
        .get(`/api/v1/customers/${userId}/analytics`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      expect(response.body).toHaveProperty('overview')
      expect(response.body).toHaveProperty('orders')
      expect(response.body).toHaveProperty('products')
      expect(response.body).toHaveProperty('engagement')
    })

    test('should view customer profile as admin', async () => {
      const response = await request(app)
        .get(`/api/v1/customers/${userId}/profile`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      expect(response.body).toHaveProperty('id', userId)
      expect(response.body).toHaveProperty('email', 'test@example.com')
    })

    test('should update customer status as admin', async () => {
      const response = await request(app)
        .put(`/api/v1/customers/${userId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-CSRF-Token', 'test-csrf-token')
        .send({
          isActive: false,
          reason: 'Suspicious activity',
        })
        .expect(200)

      expect(response.body.message).toBe('Customer deactivated successfully')
    })

    test('should deny access to non-admin users', async () => {
      await request(app)
        .get('/api/v1/customers/search')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403)
    })
  })

  describe('Error Handling', () => {
    test('should require authentication', async () => {
      await request(app)
        .get('/api/v1/customers/profile')
        .expect(401)
    })

    test('should handle invalid address ID', async () => {
      await request(app)
        .get('/api/v1/customers/addresses/invalid-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404)
    })

    test('should handle duplicate wishlist items', async () => {
      // Add product first
      await request(app)
        .post('/api/v1/customers/wishlist')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-CSRF-Token', 'test-csrf-token')
        .send({ productId })
        .expect(201)

      // Try to add again
      await request(app)
        .post('/api/v1/customers/wishlist')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-CSRF-Token', 'test-csrf-token')
        .send({ productId })
        .expect(400)
    })
  })
})