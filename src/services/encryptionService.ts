import { SecurityUtils } from '../utils/security'
import { logger } from '../utils/logger'
import { prisma } from '../utils/database'

/**
 * Service for handling sensitive data encryption (PCI DSS & GDPR compliance)
 */
export class EncryptionService {
  /**
   * Encrypt payment method data before storing
   */
  async encryptPaymentMethod(data: {
    cardNumber?: string
    cvv?: string
    accountNumber?: string
    routingNumber?: string
  }): Promise<{
    encryptedData: Record<string, string>
    maskedData: Record<string, string>
  }> {
    const encryptedData: Record<string, string> = {}
    const maskedData: Record<string, string> = {}

    try {
      // Never store CVV (PCI DSS requirement)
      if (data.cvv) {
        logger.warn('Attempted to store CVV - this is not allowed')
        delete data.cvv
      }

      // Encrypt card number
      if (data.cardNumber) {
        encryptedData.cardNumber = SecurityUtils.encrypt(data.cardNumber)
        maskedData.cardNumber = SecurityUtils.maskCardNumber(data.cardNumber)
        maskedData.last4 = data.cardNumber.slice(-4)
      }

      // Encrypt bank account details
      if (data.accountNumber) {
        encryptedData.accountNumber = SecurityUtils.encrypt(data.accountNumber)
        maskedData.accountNumber = '*'.repeat(data.accountNumber.length - 4) +
          data.accountNumber.slice(-4)
      }

      if (data.routingNumber) {
        encryptedData.routingNumber = SecurityUtils.encrypt(data.routingNumber)
        maskedData.routingNumber = '*'.repeat(data.routingNumber.length)
      }

      return { encryptedData, maskedData }
    } catch (error) {
      logger.error('Failed to encrypt payment method', error)
      throw new Error('Encryption failed')
    }
  }

  /**
   * Decrypt payment method data
   */
  async decryptPaymentMethod(encryptedData: Record<string, string>): Promise<Record<string, string>> {
    const decryptedData: Record<string, string> = {}

    try {
      for (const [key, value] of Object.entries(encryptedData)) {
        if (value && typeof value === 'string') {
          decryptedData[key] = SecurityUtils.decrypt(value)
        }
      }

      return decryptedData
    } catch (error) {
      logger.error('Failed to decrypt payment method', error)
      throw new Error('Decryption failed')
    }
  }

  /**
   * Encrypt personal data (GDPR requirement)
   */
  async encryptPersonalData(data: {
    email?: string
    phone?: string
    ssn?: string
    taxId?: string
    dateOfBirth?: string
    passport?: string
  }): Promise<Record<string, string>> {
    const encryptedData: Record<string, string> = {}

    try {
      for (const [key, value] of Object.entries(data)) {
        if (value && typeof value === 'string') {
          encryptedData[key] = SecurityUtils.encrypt(value)
        }
      }

      return encryptedData
    } catch (error) {
      logger.error('Failed to encrypt personal data', error)
      throw new Error('Encryption failed')
    }
  }

  /**
   * Encrypt sensitive order data
   */
  async encryptOrderData(orderId: string): Promise<void> {
    try {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          user: true,
          shippingAddress: true,
          billingAddress: true,
        },
      })

      if (!order) {
        throw new Error('Order not found')
      }

      // Encrypt customer information
      const updates: any = {}

      if (order.customerEmail) {
        updates.customerEmail = SecurityUtils.encrypt(order.customerEmail)
      }

      if (order.customerPhone) {
        updates.customerPhone = SecurityUtils.encrypt(order.customerPhone)
      }

      // Update order with encrypted data
      await prisma.order.update({
        where: { id: orderId },
        data: updates,
      })

      logger.info(`Order ${orderId} data encrypted`)
    } catch (error) {
      logger.error(`Failed to encrypt order ${orderId}`, error)
      throw error
    }
  }

  /**
   * Anonymize user data (GDPR right to be forgotten)
   */
  async anonymizeUserData(userId: string): Promise<void> {
    try {
      // Start transaction
      await prisma.$transaction(async (tx) => {
        // Anonymize user data
        const anonymizedEmail = `deleted_${Date.now()}@anonymized.com`

        await tx.user.update({
          where: { id: userId },
          data: {
            email: anonymizedEmail,
            firstName: 'DELETED',
            lastName: 'USER',
            phone: null,
            password: SecurityUtils.generateSecureToken(),
            isActive: false,
            deletedAt: new Date(),
          },
        })

        // Anonymize addresses
        await tx.address.updateMany({
          where: { userId },
          data: {
            firstName: 'DELETED',
            lastName: 'USER',
            company: null,
            addressLine1: 'DELETED',
            addressLine2: null,
            city: 'DELETED',
            state: 'DELETED',
            postalCode: '00000',
            phone: null,
          },
        })

        // Anonymize orders
        await tx.order.updateMany({
          where: { userId },
          data: {
            customerEmail: anonymizedEmail,
            customerFirstName: 'DELETED',
            customerLastName: 'USER',
            customerPhone: null,
            notes: null,
          },
        })

        // Delete payment methods
        await tx.paymentMethod.deleteMany({
          where: { userId },
        })

        // Delete sessions
        await tx.session.deleteMany({
          where: { userId },
        })

        // Create audit log
        await tx.auditLog.create({
          data: {
            userId: 'system',
            action: 'USER_ANONYMIZED',
            entityType: 'user',
            entityId: userId,
            metadata: {
              anonymizedAt: new Date(),
              reason: 'GDPR right to be forgotten',
            },
          },
        })
      })

      logger.info(`User ${userId} data anonymized`)
    } catch (error) {
      logger.error(`Failed to anonymize user ${userId}`, error)
      throw error
    }
  }

  /**
   * Export user data (GDPR right to data portability)
   */
  async exportUserData(userId: string): Promise<any> {
    try {
      const userData = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          addresses: true,
          orders: {
            include: {
              items: true,
              payments: {
                select: {
                  id: true,
                  amount: true,
                  currency: true,
                  status: true,
                  method: true,
                  createdAt: true,
                },
              },
            },
          },
          carts: {
            include: {
              items: true,
            },
          },
          reviews: true,
          wishlistItems: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
        },
      })

      if (!userData) {
        throw new Error('User not found')
      }

      // Remove sensitive data
      const exportData = {
        ...userData,
        password: undefined,
        paymentMethods: undefined,
      }

      // Create audit log
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'USER_DATA_EXPORTED',
          entityType: 'user',
          entityId: userId,
          metadata: {
            exportedAt: new Date(),
            reason: 'GDPR data portability request',
          },
        },
      })

      logger.info(`User ${userId} data exported`)
      return exportData
    } catch (error) {
      logger.error(`Failed to export user ${userId} data`, error)
      throw error
    }
  }

  /**
   * Check if data needs re-encryption (key rotation)
   */
  async checkReencryptionNeeded(_encryptedData: string, encryptionVersion?: string): Promise<boolean> {
    const currentVersion = '1.0'
    return encryptionVersion !== currentVersion
  }

  /**
   * Re-encrypt data with new key (key rotation)
   */
  async reencryptData(oldEncryptedData: string, oldKeyVersion: string): Promise<string> {
    try {
      // This would decrypt with old key and encrypt with new key
      // For now, we'll just return the same data
      // In production, implement proper key rotation
      logger.info('Data re-encryption requested', { oldKeyVersion })
      return oldEncryptedData
    } catch (error) {
      logger.error('Failed to re-encrypt data', error)
      throw error
    }
  }

  /**
   * Encrypt file/document
   */
  async encryptFile(buffer: Buffer, metadata: Record<string, any>): Promise<{
    encryptedBuffer: Buffer
    encryptedMetadata: string
  }> {
    try {
      // Encrypt file contents
      const encryptedContent = SecurityUtils.encrypt(buffer.toString('base64'))
      const encryptedBuffer = Buffer.from(encryptedContent)

      // Encrypt metadata
      const encryptedMetadata = SecurityUtils.encrypt(JSON.stringify(metadata))

      return {
        encryptedBuffer,
        encryptedMetadata,
      }
    } catch (error) {
      logger.error('Failed to encrypt file', error)
      throw error
    }
  }

  /**
   * Generate data retention report
   */
  async generateDataRetentionReport(): Promise<{
    totalUsers: number
    activeUsers: number
    inactiveUsers: number
    dataToBeDeleted: number
    oldestData: Date | null
  }> {
    try {
      const retentionPeriod = 7 * 365 * 24 * 60 * 60 * 1000 // 7 years in milliseconds
      const cutoffDate = new Date(Date.now() - retentionPeriod)

      const [
        totalUsers,
        activeUsers,
        inactiveUsers,
        dataToBeDeleted,
        oldestOrder,
      ] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { isActive: true } }),
        prisma.user.count({ where: { isActive: false } }),
        prisma.order.count({ where: { createdAt: { lt: cutoffDate } } }),
        prisma.order.findFirst({ orderBy: { createdAt: 'asc' } }),
      ])

      return {
        totalUsers,
        activeUsers,
        inactiveUsers,
        dataToBeDeleted,
        oldestData: oldestOrder?.createdAt || null,
      }
    } catch (error) {
      logger.error('Failed to generate data retention report', error)
      throw error
    }
  }
}

export const encryptionService = new EncryptionService()
