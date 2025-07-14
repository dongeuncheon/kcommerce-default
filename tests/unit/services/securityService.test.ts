import { SecurityUtils } from '../../../src/utils/security'
import { encryptionService } from '../../../src/services/encryptionService'
import { paymentSecurityService } from '../../../src/services/paymentSecurityService'
import { auditLogService } from '../../../src/services/auditLogService'

describe('Security Services', () => {
  describe('SecurityUtils', () => {
    describe('Encryption', () => {
      it('should encrypt and decrypt data correctly', () => {
        const plainText = 'sensitive data'
        const encrypted = SecurityUtils.encrypt(plainText)
        const decrypted = SecurityUtils.decrypt(encrypted)
        
        expect(encrypted).not.toBe(plainText)
        expect(decrypted).toBe(plainText)
      })

      it('should generate different encrypted values for same input', () => {
        const plainText = 'test data'
        const encrypted1 = SecurityUtils.encrypt(plainText)
        const encrypted2 = SecurityUtils.encrypt(plainText)
        
        expect(encrypted1).not.toBe(encrypted2)
      })
    })

    describe('Password Security', () => {
      it('should hash passwords securely', async () => {
        const password = 'TestPassword123!'
        const hash = await SecurityUtils.hashPassword(password)
        
        expect(hash).not.toBe(password)
        expect(hash.length).toBeGreaterThan(50)
      })

      it('should verify passwords correctly', async () => {
        const password = 'TestPassword123!'
        const hash = await SecurityUtils.hashPassword(password)
        
        const isValid = await SecurityUtils.verifyPassword(password, hash)
        const isInvalid = await SecurityUtils.verifyPassword('WrongPassword', hash)
        
        expect(isValid).toBe(true)
        expect(isInvalid).toBe(false)
      })

      it('should validate password strength', () => {
        const weakPassword = SecurityUtils.validatePasswordStrength('weak')
        expect(weakPassword.isValid).toBe(false)
        expect(weakPassword.errors).toContain('Password must be at least 8 characters long')
        
        const strongPassword = SecurityUtils.validatePasswordStrength('StrongP@ssw0rd123')
        expect(strongPassword.isValid).toBe(true)
        expect(strongPassword.errors).toHaveLength(0)
      })
    })

    describe('Token Generation', () => {
      it('should generate secure random tokens', () => {
        const token1 = SecurityUtils.generateSecureToken()
        const token2 = SecurityUtils.generateSecureToken()
        
        expect(token1).toHaveLength(64) // 32 bytes = 64 hex chars
        expect(token2).toHaveLength(64)
        expect(token1).not.toBe(token2)
      })

      it('should generate valid API keys', () => {
        const apiKey = SecurityUtils.generateAPIKey()
        
        expect(apiKey).toMatch(/^sk_(test|live)_[a-f0-9]{48}$/)
        expect(SecurityUtils.isValidAPIKey(apiKey)).toBe(true)
      })

      it('should validate API key format', () => {
        expect(SecurityUtils.isValidAPIKey('sk_test_' + 'a'.repeat(48))).toBe(true)
        expect(SecurityUtils.isValidAPIKey('sk_live_' + 'f'.repeat(48))).toBe(true)
        expect(SecurityUtils.isValidAPIKey('invalid_key')).toBe(false)
        expect(SecurityUtils.isValidAPIKey('sk_prod_' + 'a'.repeat(48))).toBe(false)
      })
    })

    describe('Data Masking', () => {
      it('should mask card numbers correctly', () => {
        expect(SecurityUtils.maskCardNumber('4111111111111111')).toBe('************1111')
        expect(SecurityUtils.maskCardNumber('5500 0000 0000 0004')).toBe('************0004')
        expect(SecurityUtils.maskCardNumber('371449635398431')).toBe('***********8431')
      })

      it('should mask email addresses', () => {
        expect(SecurityUtils.maskEmail('test@example.com')).toBe('t**t@example.com')
        expect(SecurityUtils.maskEmail('a@b.com')).toBe('a@b.com')
        expect(SecurityUtils.maskEmail('longusername@domain.com')).toBe('l**********e@domain.com')
      })
    })

    describe('JWT', () => {
      it('should generate and verify JWT tokens', () => {
        const payload = { userId: '123', email: 'test@example.com' }
        const token = SecurityUtils.generateJWT(payload)
        const decoded = SecurityUtils.verifyJWT(token)
        
        expect(decoded.userId).toBe(payload.userId)
        expect(decoded.email).toBe(payload.email)
        expect(decoded.iss).toBe('commerce-plugin')
      })

      it('should reject invalid JWT tokens', () => {
        expect(() => SecurityUtils.verifyJWT('invalid.token.here')).toThrow('Invalid token')
      })
    })

    describe('Data Redaction', () => {
      it('should redact sensitive fields from logs', () => {
        const data = {
          user: 'john',
          password: 'secret123',
          cardNumber: '4111111111111111',
          apiKey: 'sk_test_12345',
          nested: {
            token: 'bearer_token_123',
            public: 'visible_data'
          }
        }
        
        const redacted = SecurityUtils.redactSensitiveData(data)
        
        expect(redacted.user).toBe('john')
        expect(redacted.password).toBe('[REDACTED]')
        expect(redacted.cardNumber).toBe('[REDACTED]')
        expect(redacted.apiKey).toBe('[REDACTED]')
        expect(redacted.nested.token).toBe('[REDACTED]')
        expect(redacted.nested.public).toBe('visible_data')
      })
    })
  })

  describe('EncryptionService', () => {
    describe('Payment Method Encryption', () => {
      it('should encrypt payment card data', async () => {
        const cardData = {
          cardNumber: '4111111111111111',
          cvv: '123'
        }
        
        const result = await encryptionService.encryptPaymentMethod(cardData)
        
        expect(result.encryptedData.cardNumber).toBeDefined()
        expect(result.encryptedData.cvv).toBeUndefined() // CVV should not be stored
        expect(result.maskedData.cardNumber).toBe('************1111')
        expect(result.maskedData.last4).toBe('1111')
      })

      it('should not store CVV', async () => {
        const cardData = {
          cardNumber: '4111111111111111',
          cvv: '123'
        }
        
        const result = await encryptionService.encryptPaymentMethod(cardData)
        
        expect(result.encryptedData.cvv).toBeUndefined()
        expect(Object.keys(result.encryptedData)).not.toContain('cvv')
      })
    })

    describe('Personal Data Encryption', () => {
      it('should encrypt personal data fields', async () => {
        const personalData = {
          email: 'user@example.com',
          phone: '+1234567890',
          ssn: '123-45-6789'
        }
        
        const encrypted = await encryptionService.encryptPersonalData(personalData)
        
        expect(encrypted.email).not.toBe(personalData.email)
        expect(encrypted.phone).not.toBe(personalData.phone)
        expect(encrypted.ssn).not.toBe(personalData.ssn)
      })
    })

    describe('File Encryption', () => {
      it('should encrypt file contents and metadata', async () => {
        const fileBuffer = Buffer.from('file contents')
        const metadata = { filename: 'test.pdf', size: 1024 }
        
        const result = await encryptionService.encryptFile(fileBuffer, metadata)
        
        expect(result.encryptedBuffer).toBeDefined()
        expect(result.encryptedBuffer).not.toEqual(fileBuffer)
        expect(result.encryptedMetadata).toBeDefined()
        expect(result.encryptedMetadata).not.toBe(JSON.stringify(metadata))
      })
    })
  })

  describe('PaymentSecurityService', () => {
    describe('Card Tokenization', () => {
      it('should validate card numbers using Luhn algorithm', async () => {
        const validCards = [
          '4111111111111111', // Visa
          '5500000000000004', // Mastercard
          '371449635398431',  // Amex
        ]
        
        for (const cardNumber of validCards) {
          const result = await paymentSecurityService.tokenizeCard({
            cardNumber,
            expiryMonth: 12,
            expiryYear: 2025
          })
          
          expect(result.token).toMatch(/^tok_/)
          expect(result.last4).toBe(cardNumber.slice(-4))
        }
      })

      it('should reject invalid card numbers', async () => {
        await expect(
          paymentSecurityService.tokenizeCard({
            cardNumber: '1234567890123456',
            expiryMonth: 12,
            expiryYear: 2025
          })
        ).rejects.toThrow('Invalid card number')
      })

      it('should detect card brands correctly', async () => {
        const cards = [
          { number: '4111111111111111', brand: 'visa' },
          { number: '5500000000000004', brand: 'mastercard' },
          { number: '371449635398431', brand: 'amex' },
          { number: '6011111111111117', brand: 'discover' },
        ]
        
        for (const card of cards) {
          const result = await paymentSecurityService.tokenizeCard({
            cardNumber: card.number,
            expiryMonth: 12,
            expiryYear: 2025
          })
          
          expect(result.brand).toBe(card.brand)
        }
      })
    })

    describe('Fraud Detection', () => {
      it('should calculate risk scores for payment requests', async () => {
        const paymentData = {
          userId: 'user123',
          amount: 100,
          currency: 'USD',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0'
        }
        
        const result = await paymentSecurityService.validatePaymentRequest(paymentData)
        
        expect(result.isValid).toBeDefined()
        expect(result.riskScore).toBeGreaterThanOrEqual(0)
        expect(result.reasons).toBeDefined()
      })
    })
  })

  describe('AuditLogService', () => {
    describe('Event Logging', () => {
      it('should log authentication events', async () => {
        const req = {
          ip: '192.168.1.1',
          headers: { 'user-agent': 'Mozilla/5.0' },
          method: 'POST',
          originalUrl: '/api/v1/auth/login'
        } as any
        
        await expect(
          auditLogService.logAuthEvent('LOGIN', 'user123', req)
        ).resolves.not.toThrow()
      })

      it('should log security events with appropriate severity', async () => {
        const req = {
          ip: '192.168.1.1',
          headers: { 'user-agent': 'Mozilla/5.0' },
          method: 'GET',
          originalUrl: '/api/v1/users'
        } as any
        
        await expect(
          auditLogService.logSecurityEvent('RATE_LIMIT_EXCEEDED', null, req)
        ).resolves.not.toThrow()
      })
    })

    describe('Compliance Reporting', () => {
      it('should generate compliance reports', async () => {
        const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        const endDate = new Date()
        
        const report = await auditLogService.generateComplianceReport(
          startDate,
          endDate,
          'SECURITY'
        )
        
        expect(report).toBeDefined()
        expect(report.reportType).toBe('SECURITY')
        expect(report.period).toBeDefined()
        expect(report.generatedAt).toBeDefined()
      })
    })
  })
})

describe('Security Integration', () => {
  it('should handle end-to-end payment security flow', async () => {
    // 1. Tokenize card
    const tokenResult = await paymentSecurityService.tokenizeCard({
      cardNumber: '4111111111111111',
      expiryMonth: 12,
      expiryYear: 2025
    })
    
    expect(tokenResult.token).toMatch(/^tok_/)
    
    // 2. Validate payment request
    const validationResult = await paymentSecurityService.validatePaymentRequest({
      userId: 'user123',
      amount: 100,
      currency: 'USD',
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0',
      cardToken: tokenResult.token
    })
    
    expect(validationResult.isValid).toBeDefined()
    
    // 3. Prepare secure payment data
    const secureData = await paymentSecurityService.prepareSecurePaymentData({
      amount: 100,
      currency: 'USD',
      token: tokenResult.token
    })
    
    expect(secureData.signature).toBeDefined()
    expect(secureData.secureData.nonce).toBeDefined()
  })
})

// Mock prisma for tests
jest.mock('../../../src/utils/database', () => ({
  prisma: {
    paymentToken: {
      findFirst: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn()
    },
    payment: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([])
    },
    order: {
      aggregate: jest.fn().mockResolvedValue({
        _avg: { total: { toNumber: () => 50 } },
        _max: { total: { toNumber: () => 100 } }
      })
    },
    blacklist: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn()
    },
    paymentMethod: {
      count: jest.fn().mockResolvedValue(0)
    },
    fraudCheck: {
      create: jest.fn()
    },
    securityAlert: {
      create: jest.fn()
    },
    auditLog: {
      create: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      groupBy: jest.fn().mockResolvedValue([])
    },
    user: {
      findUnique: jest.fn(),
      update: jest.fn()
    },
    address: {
      updateMany: jest.fn()
    },
    session: {
      deleteMany: jest.fn()
    }
  }
}))

// Mock config
jest.mock('../../../src/config/config', () => ({
  config: {
    security: {
      encryptionKey: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      jwtSecret: 'test-jwt-secret',
      paymentSecret: 'test-payment-secret',
      trustedIPs: [],
      forceSSL: true
    },
    nodeEnv: 'test'
  }
}))