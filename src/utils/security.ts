import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { config } from '../config/config'

/**
 * Security utilities for PCI DSS and GDPR compliance
 */

export class SecurityUtils {
  private static readonly ENCRYPTION_ALGORITHM = 'aes-256-gcm'
  private static readonly IV_LENGTH = 16

  /**
   * Encrypt sensitive data (PCI DSS requirement)
   */
  static encrypt(text: string): string {
    const key = Buffer.from(config.security.encryptionKey, 'hex')
    const iv = crypto.randomBytes(this.IV_LENGTH)
    const cipher = crypto.createCipheriv(this.ENCRYPTION_ALGORITHM, key, iv)

    let encrypted = cipher.update(text, 'utf8', 'hex')
    encrypted += cipher.final('hex')

    const authTag = cipher.getAuthTag()

    // Combine iv + authTag + encrypted
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted
  }

  /**
   * Decrypt sensitive data
   */
  static decrypt(encryptedData: string): string {
    try {
      const parts = encryptedData.split(':')
      const iv = Buffer.from(parts[0], 'hex')
      const authTag = Buffer.from(parts[1], 'hex')
      const encrypted = parts[2]

      const key = Buffer.from(config.security.encryptionKey, 'hex')
      const decipher = crypto.createDecipheriv(this.ENCRYPTION_ALGORITHM, key, iv)
      decipher.setAuthTag(authTag)

      let decrypted = decipher.update(encrypted, 'hex', 'utf8')
      decrypted += decipher.final('utf8')

      return decrypted
    } catch (error) {
      throw new Error('Failed to decrypt data')
    }
  }

  /**
   * Hash password using bcrypt
   */
  static async hashPassword(password: string): Promise<string> {
    const saltRounds = 12
    return bcrypt.hash(password, saltRounds)
  }

  /**
   * Verify password against hash
   */
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash)
  }

  /**
   * Generate secure random token
   */
  static generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex')
  }

  /**
   * Generate JWT token
   */
  static generateJWT(payload: any, expiresIn: string | number = '1h'): string {
    const options: jwt.SignOptions = {
      algorithm: 'HS256',
      issuer: 'commerce-plugin',
    }

    if (expiresIn) {
      // Handle string/number union type for expiresIn
      if (typeof expiresIn === 'string') {
        options.expiresIn = expiresIn as any
      } else {
        options.expiresIn = Number(expiresIn)
      }
    }
    return jwt.sign(payload, config.security.jwtSecret, options)
  }

  /**
   * Verify JWT token
   */
  static verifyJWT(token: string): any {
    try {
      return jwt.verify(token, config.security.jwtSecret, {
        algorithms: ['HS256'],
        issuer: 'commerce-plugin',
      })
    } catch (error) {
      throw new Error('Invalid token')
    }
  }

  /**
   * Mask sensitive data (PCI DSS - show only last 4 digits)
   */
  static maskCardNumber(cardNumber: string): string {
    const cleaned = cardNumber.replace(/\D/g, '')
    const last4 = cleaned.slice(-4)
    const masked = cleaned.slice(0, -4).replace(/\d/g, '*')
    return masked + last4
  }

  /**
   * Mask email for privacy (GDPR)
   */
  static maskEmail(email: string): string {
    const [localPart, domain] = email.split('@')
    const maskedLocal = localPart.charAt(0) +
      localPart.slice(1, -1).replace(/./g, '*') +
      localPart.slice(-1)
    return `${maskedLocal}@${domain}`
  }

  /**
   * Anonymize personal data (GDPR right to be forgotten)
   */
  static anonymizeData(data: Record<string, any>): Record<string, any> {
    const anonymized = { ...data }

    // Anonymize personal fields
    const personalFields = [
      'email', 'firstName', 'lastName', 'phone',
      'addressLine1', 'addressLine2', 'city', 'state', 'postalCode',
    ]

    personalFields.forEach(field => {
      if (anonymized[field]) {
        anonymized[field] = 'ANONYMIZED'
      }
    })

    // Hash any IDs for tracking while maintaining anonymity
    if (anonymized.id) {
      anonymized.anonymizedId = crypto
        .createHash('sha256')
        .update(anonymized.id)
        .digest('hex')
    }

    return anonymized
  }

  /**
   * Validate password strength (PCI DSS requirement)
   */
  static validatePasswordStrength(password: string): {
    isValid: boolean
    errors: string[]
  } {
    const errors: string[] = []

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long')
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter')
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter')
    }

    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number')
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character')
    }

    return {
      isValid: errors.length === 0,
      errors,
    }
  }

  /**
   * Sanitize input to prevent injection attacks
   */
  static sanitizeInput(input: string): string {
    return input
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .replace(/['"]/g, '') // Remove quotes
      .trim()
  }

  /**
   * Generate CSRF token
   */
  static generateCSRFToken(): string {
    return crypto.randomBytes(32).toString('hex')
  }

  /**
   * Hash data for integrity check
   */
  static hashData(data: string): string {
    return crypto
      .createHash('sha256')
      .update(data)
      .digest('hex')
  }

  /**
   * Verify data integrity
   */
  static verifyDataIntegrity(data: string, hash: string): boolean {
    const computedHash = this.hashData(data)
    return computedHash === hash
  }

  /**
   * Generate API key
   */
  static generateAPIKey(): string {
    const prefix = 'sk_'
    const env = config.nodeEnv === 'production' ? 'live' : 'test'
    const random = crypto.randomBytes(24).toString('hex')
    return `${prefix}${env}_${random}`
  }

  /**
   * Validate API key format
   */
  static isValidAPIKey(apiKey: string): boolean {
    const pattern = /^sk_(test|live)_[a-f0-9]{48}$/
    return pattern.test(apiKey)
  }

  /**
   * Redact sensitive data from logs
   */
  static redactSensitiveData(data: any): any {
    if (typeof data !== 'object' || data === null) {
      return data
    }

    const sensitiveFields = [
      'password', 'token', 'apiKey', 'secretKey',
      'cardNumber', 'cvv', 'ssn', 'taxId',
      'authorization', 'x-api-key',
    ]

    const redacted = Array.isArray(data) ? [...data] : { ...data }

    Object.keys(redacted).forEach(key => {
      if (sensitiveFields.some(field =>
        key.toLowerCase().includes(field.toLowerCase()),
      )) {
        redacted[key] = '[REDACTED]'
      } else if (typeof redacted[key] === 'object') {
        redacted[key] = this.redactSensitiveData(redacted[key])
      }
    })

    return redacted
  }

  /**
   * Check if request is from trusted source
   */
  static isTrustedSource(ip: string, userAgent: string): boolean {
    // Check against whitelist
    const trustedIPs = config.security.trustedIPs || []
    if (trustedIPs.includes(ip)) {
      return true
    }

    // Check for suspicious user agents
    const suspiciousAgents = [
      'bot', 'crawler', 'spider', 'scraper',
      'curl', 'wget', 'python-requests',
    ]

    const lowerUserAgent = userAgent.toLowerCase()
    return !suspiciousAgents.some(agent => lowerUserAgent.includes(agent))
  }

  /**
   * Rate limit key generator
   */
  static getRateLimitKey(identifier: string, window: string = 'minute'): string {
    const now = new Date()
    let timeWindow: string

    switch (window) {
    case 'second':
      timeWindow = `${now.getMinutes()}:${now.getSeconds()}`
      break
    case 'minute':
      timeWindow = `${now.getHours()}:${now.getMinutes()}`
      break
    case 'hour':
      timeWindow = `${now.getDate()}:${now.getHours()}`
      break
    default:
      timeWindow = `${now.getHours()}:${now.getMinutes()}`
    }

    return `ratelimit:${identifier}:${timeWindow}`
  }
}

export default SecurityUtils
