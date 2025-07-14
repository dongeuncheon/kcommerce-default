import request from 'supertest'
import app from '../../src/index'
import { prisma } from '../../src/utils/database'
import { SecurityUtils } from '../../src/utils/security'

describe('Security Integration Tests', () => {
  let adminToken: string
  let userToken: string
  let apiKey: string

  beforeAll(async () => {
    // Create test admin user
    const adminUser = await prisma.user.create({
      data: {
        email: 'admin@test.com',
        password: await SecurityUtils.hashPassword('AdminPass123!'),
        role: 'ADMIN',
        firstName: 'Admin',
        lastName: 'User',
        isActive: true,
        isVerified: true,
      },
    })

    // Create test regular user
    const regularUser = await prisma.user.create({
      data: {
        email: 'user@test.com',
        password: await SecurityUtils.hashPassword('UserPass123!'),
        role: 'CUSTOMER',
        firstName: 'Regular',
        lastName: 'User',
        isActive: true,
        isVerified: true,
      },
    })

    // Generate tokens
    adminToken = SecurityUtils.generateJWT({ id: adminUser.id, email: adminUser.email, role: 'ADMIN' })
    userToken = SecurityUtils.generateJWT({ id: regularUser.id, email: regularUser.email, role: 'CUSTOMER' })

    // Create test API key
    apiKey = SecurityUtils.generateAPIKey()
    await prisma.apiClient.create({
      data: {
        name: 'Test API Client',
        hashedKey: SecurityUtils.hashData(apiKey),
        permissions: ['products:read', 'orders:read'],
        isActive: true,
      },
    })
  })

  afterAll(async () => {
    // Cleanup
    await prisma.user.deleteMany({ where: { email: { in: ['admin@test.com', 'user@test.com'] } } })
    await prisma.apiClient.deleteMany({ where: { name: 'Test API Client' } })
  })

  describe('Authentication & Authorization', () => {
    it('should reject requests without authentication', async () => {
      const response = await request(app)
        .get('/api/v1/security/audit-logs')
        .expect(401)

      expect(response.body.error).toBe('No authentication token provided')
    })

    it('should reject requests with invalid token', async () => {
      const response = await request(app)
        .get('/api/v1/security/audit-logs')
        .set('Authorization', 'Bearer invalid_token')
        .expect(401)

      expect(response.body.error).toBe('Invalid authentication token')
    })

    it('should reject non-admin users from security endpoints', async () => {
      const response = await request(app)
        .get('/api/v1/security/audit-logs')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403)

      expect(response.body.error).toBe('Insufficient permissions')
    })

    it('should allow admin users to access security endpoints', async () => {
      const response = await request(app)
        .get('/api/v1/security/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeDefined()
    })
  })

  describe('API Key Authentication', () => {
    it('should authenticate requests with valid API key', async () => {
      const response = await request(app)
        .get('/api/v1/products')
        .set('X-API-Key', apiKey)
        .expect(200)

      expect(response.body.success).toBe(true)
    })

    it('should reject requests with invalid API key', async () => {
      const response = await request(app)
        .get('/api/v1/products')
        .set('X-API-Key', 'invalid_api_key')
        .expect(401)

      expect(response.body.error).toBe('Invalid API key format')
    })

    it('should track API key usage', async () => {
      await request(app)
        .get('/api/v1/products')
        .set('X-API-Key', apiKey)
        .expect(200)

      const apiClient = await prisma.apiClient.findFirst({
        where: { hashedKey: SecurityUtils.hashData(apiKey) }
      })

      expect(apiClient?.requestCount).toBeGreaterThan(0)
      expect(apiClient?.lastUsedAt).toBeDefined()
    })
  })

  describe('Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      // Make requests up to the limit
      for (let i = 0; i < 100; i++) {
        await request(app)
          .get('/api/v1/products')
          .set('Authorization', `Bearer ${userToken}`)
          .expect(200)
      }

      // Next request should be rate limited
      const response = await request(app)
        .get('/api/v1/products')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(429)

      expect(response.body.error).toContain('Too many requests')
    })

    it('should include rate limit headers', async () => {
      const response = await request(app)
        .get('/api/v1/products')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)

      expect(response.headers['x-ratelimit-limit']).toBeDefined()
      expect(response.headers['x-ratelimit-remaining']).toBeDefined()
      expect(response.headers['x-ratelimit-reset']).toBeDefined()
    })
  })

  describe('CSRF Protection', () => {
    it('should reject POST requests without CSRF token', async () => {
      const response = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Test Product' })
        .expect(403)

      expect(response.body.error).toBe('CSRF token missing')
    })

    it('should accept requests with valid CSRF token', async () => {
      const csrfToken = SecurityUtils.generateCSRFToken()
      
      // Create session with CSRF token
      await prisma.session.create({
        data: {
          userId: 'admin_id',
          token: SecurityUtils.hashData(adminToken),
          csrfToken,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        }
      })

      const response = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-CSRF-Token', csrfToken)
        .send({
          name: 'Test Product',
          slug: 'test-product',
          sku: 'TEST-001',
          price: 99.99
        })
        .expect(201)

      expect(response.body.success).toBe(true)
    })
  })

  describe('Blacklist Functionality', () => {
    it('should block blacklisted IPs', async () => {
      // Add IP to blacklist
      await prisma.blacklist.create({
        data: {
          type: 'IP',
          value: '::ffff:127.0.0.1', // localhost in IPv6 format
          reason: 'Test blacklist',
          isActive: true,
        }
      })

      const response = await request(app)
        .get('/api/v1/products')
        .expect(403)

      expect(response.body.error).toBe('Access denied')

      // Cleanup
      await prisma.blacklist.deleteMany({
        where: { value: '::ffff:127.0.0.1' }
      })
    })

    it('should block blacklisted user agents', async () => {
      const badUserAgent = 'BadBot/1.0'
      
      await prisma.blacklist.create({
        data: {
          type: 'USER_AGENT',
          value: badUserAgent,
          reason: 'Known bot',
          isActive: true,
        }
      })

      const response = await request(app)
        .get('/api/v1/products')
        .set('User-Agent', badUserAgent)
        .expect(403)

      expect(response.body.error).toBe('Access denied')

      // Cleanup
      await prisma.blacklist.deleteMany({
        where: { value: badUserAgent }
      })
    })
  })

  describe('Audit Logging', () => {
    it('should log API access', async () => {
      await request(app)
        .get('/api/v1/products')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)

      const logs = await prisma.auditLog.findMany({
        where: {
          action: 'API_ACCESS',
          path: '/api/v1/products'
        }
      })

      expect(logs.length).toBeGreaterThan(0)
      expect(logs[0].method).toBe('GET')
      expect(logs[0].statusCode).toBe(200)
    })

    it('should log authentication events', async () => {
      // Simulate failed login
      await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'user@test.com',
          password: 'WrongPassword'
        })
        .expect(401)

      const logs = await prisma.auditLog.findMany({
        where: {
          action: 'AUTH_LOGIN_FAILED'
        }
      })

      expect(logs.length).toBeGreaterThan(0)
    })

    it('should log security events', async () => {
      // Trigger rate limit
      for (let i = 0; i < 6; i++) {
        await request(app)
          .post('/api/v1/auth/login')
          .send({
            email: 'user@test.com',
            password: 'test'
          })
      }

      const logs = await prisma.auditLog.findMany({
        where: {
          action: 'SECURITY_RATE_LIMIT_EXCEEDED'
        }
      })

      expect(logs.length).toBeGreaterThan(0)
    })
  })

  describe('Security Endpoints', () => {
    describe('GET /api/v1/security/compliance/pci-dss', () => {
      it('should generate PCI DSS compliance report', async () => {
        const response = await request(app)
          .get('/api/v1/security/compliance/pci-dss')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200)

        expect(response.body.success).toBe(true)
        expect(response.body.data.audit).toBeDefined()
        expect(response.body.data.payment).toBeDefined()
      })
    })

    describe('GET /api/v1/security/compliance/gdpr', () => {
      it('should generate GDPR compliance report', async () => {
        const response = await request(app)
          .get('/api/v1/security/compliance/gdpr')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200)

        expect(response.body.success).toBe(true)
        expect(response.body.data.reportType).toBe('GDPR')
      })
    })

    describe('POST /api/v1/security/blacklist', () => {
      it('should add entry to blacklist', async () => {
        const response = await request(app)
          .post('/api/v1/security/blacklist')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            type: 'IP',
            value: '192.168.1.100',
            reason: 'Suspicious activity'
          })
          .expect(201)

        expect(response.body.success).toBe(true)
        expect(response.body.data.type).toBe('IP')
        expect(response.body.data.value).toBe('192.168.1.100')

        // Cleanup
        await prisma.blacklist.deleteMany({
          where: { value: '192.168.1.100' }
        })
      })
    })

    describe('POST /api/v1/security/api-keys', () => {
      it('should create new API key', async () => {
        const response = await request(app)
          .post('/api/v1/security/api-keys')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name: 'New API Client',
            permissions: ['products:read']
          })
          .expect(201)

        expect(response.body.success).toBe(true)
        expect(response.body.data.apiKey).toMatch(/^sk_(test|live)_/)
        expect(response.body.data.name).toBe('New API Client')

        // Cleanup
        await prisma.apiClient.deleteMany({
          where: { name: 'New API Client' }
        })
      })
    })

    describe('GET /api/v1/security/sessions', () => {
      it('should list active sessions', async () => {
        const response = await request(app)
          .get('/api/v1/security/sessions')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200)

        expect(response.body.success).toBe(true)
        expect(Array.isArray(response.body.data)).toBe(true)
      })
    })

    describe('POST /api/v1/security/maintenance/cleanup-logs', () => {
      it('should cleanup old audit logs', async () => {
        const response = await request(app)
          .post('/api/v1/security/maintenance/cleanup-logs')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ retentionDays: 90 })
          .expect(200)

        expect(response.body.success).toBe(true)
        expect(response.body.message).toContain('Cleaned up')
      })
    })
  })

  describe('Payment Security', () => {
    it('should tokenize payment cards securely', async () => {
      const response = await request(app)
        .post('/api/v1/payments/tokenize')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          cardNumber: '4111111111111111',
          expiryMonth: 12,
          expiryYear: 2025
        })
        .expect(200)

      expect(response.body.token).toMatch(/^tok_/)
      expect(response.body.last4).toBe('1111')
      expect(response.body.brand).toBe('visa')
    })

    it('should validate payment requests for fraud', async () => {
      const response = await request(app)
        .post('/api/v1/payments/validate')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          amount: 10000, // High amount
          currency: 'USD'
        })
        .expect(200)

      expect(response.body.isValid).toBeDefined()
      expect(response.body.riskScore).toBeDefined()
      if (!response.body.isValid) {
        expect(response.body.reasons.length).toBeGreaterThan(0)
      }
    })
  })
})

// Mock server close method
jest.mock('../../src/index', () => ({
  ...jest.requireActual('../../src/index'),
  default: {
    ...jest.requireActual('../../src/index').default,
    close: jest.fn((callback) => callback && callback())
  }
}))