import { prisma } from '../utils/database'
import { logger } from '../utils/logger'
import { SecurityUtils } from '../utils/security'
import { Request } from 'express'
import { AuthenticatedRequest } from '../middleware/auth'

export interface AuditLogData {
  userId?: string
  action: string
  entityType?: string
  entityId?: string
  metadata?: any
  ipAddress?: string
  userAgent?: string
  method?: string
  path?: string
  statusCode?: number
  duration?: number
}

/**
 * Security Audit Log Service
 * Tracks all security-relevant events for compliance and forensics
 */
export class AuditLogService {
  /**
   * Log authentication events
   */
  async logAuthEvent(
    action: 'LOGIN' | 'LOGOUT' | 'LOGIN_FAILED' | 'PASSWORD_RESET' | 'TOKEN_REFRESH' | 'SESSION_EXPIRED',
    userId: string | null,
    req: Request,
    metadata?: any,
  ): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId: userId || 'anonymous',
          action: `AUTH_${action}`,
          entityType: 'user',
          entityId: userId || undefined,
          ipAddress: req.ip || 'unknown',
          userAgent: req.headers['user-agent'] || 'unknown',
          method: req.method,
          path: req.originalUrl,
          metadata: {
            ...metadata,
            timestamp: new Date(),
            sessionId: (req as AuthenticatedRequest).session?.id,
          },
          createdAt: new Date(),
        },
      })

      // Alert on suspicious auth patterns
      if (action === 'LOGIN_FAILED') {
        await this.checkFailedLoginPatterns(req.ip || 'unknown')
      }
    } catch (error) {
      logger.error('Failed to log auth event', { error, action, userId })
    }
  }

  /**
   * Log data access events
   */
  async logDataAccess(
    action: 'VIEW' | 'EXPORT' | 'DOWNLOAD' | 'SHARE',
    entityType: string,
    entityId: string,
    userId: string,
    req: Request,
    metadata?: any,
  ): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action: `DATA_${action}`,
          entityType,
          entityId,
          ipAddress: req.ip || 'unknown',
          userAgent: req.headers['user-agent'] || 'unknown',
          method: req.method,
          path: req.originalUrl,
          metadata: {
            ...metadata,
            timestamp: new Date(),
            dataClassification: await this.classifyData(entityType, entityId),
          },
          createdAt: new Date(),
        },
      })

      // Check for data exfiltration patterns
      await this.checkDataExfiltration(userId, entityType)
    } catch (error) {
      logger.error('Failed to log data access', { error, action, entityType, entityId })
    }
  }

  /**
   * Log security events
   */
  async logSecurityEvent(
    action: 'RATE_LIMIT_EXCEEDED' | 'CSRF_VIOLATION' | 'SUSPICIOUS_ACTIVITY' | 'BLACKLIST_HIT' | 'ENCRYPTION_FAILURE',
    userId: string | null,
    req: Request,
    metadata?: any,
  ): Promise<void> {
    try {
      const severity = this.getSecurityEventSeverity(action)

      await prisma.auditLog.create({
        data: {
          userId: userId || 'anonymous',
          action: `SECURITY_${action}`,
          entityType: 'security',
          ipAddress: req.ip || 'unknown',
          userAgent: req.headers['user-agent'] || 'unknown',
          method: req.method,
          path: req.originalUrl,
          metadata: {
            ...metadata,
            severity,
            timestamp: new Date(),
          },
          createdAt: new Date(),
        },
      })

      // Create security alert for high severity events
      if (severity === 'HIGH' || severity === 'CRITICAL') {
        await this.createSecurityAlert(action, userId, req, metadata)
      }
    } catch (error) {
      logger.error('Failed to log security event', { error, action })
    }
  }

  /**
   * Log payment events
   */
  async logPaymentEvent(
    action: 'INITIATE' | 'COMPLETE' | 'FAIL' | 'REFUND' | 'DISPUTE' | 'FRAUD_CHECK',
    paymentId: string,
    userId: string,
    req: Request,
    metadata?: any,
  ): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action: `PAYMENT_${action}`,
          entityType: 'payment',
          entityId: paymentId,
          ipAddress: req.ip || 'unknown',
          userAgent: req.headers['user-agent'] || 'unknown',
          method: req.method,
          path: req.originalUrl,
          metadata: {
            ...metadata,
            timestamp: new Date(),
            amount: metadata?.amount,
            currency: metadata?.currency,
            gateway: metadata?.gateway,
            maskedCardNumber: metadata?.cardNumber ? SecurityUtils.maskCardNumber(metadata.cardNumber) : undefined,
          },
          createdAt: new Date(),
        },
      })

      // Monitor payment patterns
      if (action === 'FRAUD_CHECK' && metadata?.riskScore > 50) {
        await this.createSecurityAlert('HIGH_RISK_PAYMENT', userId, req, metadata)
      }
    } catch (error) {
      logger.error('Failed to log payment event', { error, action, paymentId })
    }
  }

  /**
   * Log administrative actions
   */
  async logAdminAction(
    action: string,
    targetType: string,
    targetId: string,
    adminId: string,
    req: Request,
    metadata?: any,
  ): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId: adminId,
          action: `ADMIN_${action}`,
          entityType: targetType,
          entityId: targetId,
          ipAddress: req.ip || 'unknown',
          userAgent: req.headers['user-agent'] || 'unknown',
          method: req.method,
          path: req.originalUrl,
          metadata: {
            ...metadata,
            timestamp: new Date(),
            adminRole: (req as AuthenticatedRequest).user?.role,
          },
          createdAt: new Date(),
        },
      })

      // Alert on sensitive admin actions
      const sensitiveActions = ['USER_DELETE', 'PERMISSION_GRANT', 'DATA_EXPORT', 'SYSTEM_CONFIG_CHANGE']
      if (sensitiveActions.includes(action)) {
        await this.createSecurityAlert('SENSITIVE_ADMIN_ACTION', adminId, req, { action, targetType, targetId })
      }
    } catch (error) {
      logger.error('Failed to log admin action', { error, action, targetType })
    }
  }

  /**
   * Log API access
   */
  async logAPIAccess(
    req: Request,
    res: any,
    responseTime: number,
    error?: any,
  ): Promise<void> {
    try {
      const userId = (req as AuthenticatedRequest).user?.id ||
                    (req as any).apiClient?.id ||
                    'anonymous'

      await prisma.auditLog.create({
        data: {
          userId,
          action: 'API_ACCESS',
          entityType: 'api',
          ipAddress: req.ip || 'unknown',
          userAgent: req.headers['user-agent'] || 'unknown',
          method: req.method,
          path: req.originalUrl,
          statusCode: res.statusCode,
          metadata: {
            responseTime,
            error: error ? SecurityUtils.redactSensitiveData(error) : undefined,
            requestSize: req.headers['content-length'],
            responseSize: res.get('content-length'),
            apiVersion: req.headers['api-version'],
            timestamp: new Date(),
          },
          createdAt: new Date(),
        },
      })

      // Monitor API abuse patterns
      if (responseTime > 5000 || res.statusCode >= 500) {
        await this.checkAPIAbusePatterns(userId, req)
      }
    } catch (error) {
      logger.error('Failed to log API access', { error })
    }
  }

  /**
   * Check failed login patterns
   */
  private async checkFailedLoginPatterns(ipAddress: string): Promise<void> {
    const recentFailures = await prisma.auditLog.count({
      where: {
        action: 'AUTH_LOGIN_FAILED',
        ipAddress,
        createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) }, // Last 15 minutes
      },
    })

    if (recentFailures >= 5) {
      logger.warn('Multiple failed login attempts detected', { ipAddress, count: recentFailures })

      // Auto-blacklist IP after 10 failures
      if (recentFailures >= 10) {
        await prisma.blacklist.create({
          data: {
            type: 'IP',
            value: ipAddress,
            reason: 'Multiple failed login attempts',
            isActive: true,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
          },
        })
      }
    }
  }

  /**
   * Check data exfiltration patterns
   */
  private async checkDataExfiltration(userId: string, entityType: string): Promise<void> {
    const recentExports = await prisma.auditLog.count({
      where: {
        userId,
        action: { in: ['DATA_EXPORT', 'DATA_DOWNLOAD'] },
        createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) }, // Last hour
      },
    })

    if (recentExports > 50) {
      logger.warn('Potential data exfiltration detected', { userId, exports: recentExports })

      await prisma.securityAlert.create({
        data: {
          userId,
          alertType: 'DATA_EXFILTRATION_SUSPECTED',
          severity: 'HIGH',
          metadata: {
            exportCount: recentExports,
            entityType,
            timeWindow: '1_hour',
          },
          createdAt: new Date(),
        },
      })
    }
  }

  /**
   * Check API abuse patterns
   */
  private async checkAPIAbusePatterns(userId: string, _req: Request): Promise<void> {
    const recentRequests = await prisma.auditLog.findMany({
      where: {
        userId,
        action: 'API_ACCESS',
        createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) }, // Last 5 minutes
      },
      select: {
        statusCode: true,
        metadata: true,
      },
    })

    const errorRate = recentRequests.filter(r => (r.statusCode || 0) >= 400).length / recentRequests.length
    const avgResponseTime = recentRequests.reduce((sum, r) =>
      sum + ((r.metadata as any)?.responseTime || 0), 0,
    ) / recentRequests.length

    if (errorRate > 0.5 || avgResponseTime > 3000) {
      logger.warn('API abuse pattern detected', {
        userId,
        errorRate,
        avgResponseTime,
        requestCount: recentRequests.length,
      })
    }
  }

  /**
   * Get security event severity
   */
  private getSecurityEventSeverity(action: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    const severityMap: Record<string, 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'> = {
      'RATE_LIMIT_EXCEEDED': 'MEDIUM',
      'CSRF_VIOLATION': 'HIGH',
      'SUSPICIOUS_ACTIVITY': 'HIGH',
      'BLACKLIST_HIT': 'HIGH',
      'ENCRYPTION_FAILURE': 'CRITICAL',
    }

    return severityMap[action] || 'MEDIUM'
  }

  /**
   * Create security alert
   */
  private async createSecurityAlert(
    alertType: string,
    userId: string | null,
    req: Request,
    metadata: any,
  ): Promise<void> {
    await prisma.securityAlert.create({
      data: {
        userId: userId || 'system',
        alertType,
        severity: this.getSecurityEventSeverity(alertType),
        metadata: {
          ...metadata,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          timestamp: new Date(),
        },
        createdAt: new Date(),
      },
    })

    // Send notifications for critical alerts
    if (this.getSecurityEventSeverity(alertType) === 'CRITICAL') {
      logger.error('CRITICAL SECURITY ALERT', { alertType, userId, metadata })
      // In production, send email/SMS alerts to security team
    }
  }

  /**
   * Classify data sensitivity
   */
  private async classifyData(entityType: string, _entityId: string): Promise<string> {
    const sensitiveTypes = {
      'payment': 'HIGHLY_SENSITIVE',
      'paymentMethod': 'HIGHLY_SENSITIVE',
      'user': 'SENSITIVE',
      'order': 'SENSITIVE',
      'address': 'SENSITIVE',
      'product': 'PUBLIC',
      'category': 'PUBLIC',
    }

    return sensitiveTypes[entityType as keyof typeof sensitiveTypes] || 'INTERNAL'
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(
    startDate: Date,
    endDate: Date,
    reportType: 'PCI_DSS' | 'GDPR' | 'SECURITY',
  ): Promise<any> {
    try {
      const baseQuery = {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      }

      const report: any = {
        reportType,
        period: { startDate, endDate },
        generatedAt: new Date(),
      }

      switch (reportType) {
      case 'PCI_DSS':
        report.paymentAccess = await prisma.auditLog.count({
          where: {
            ...baseQuery,
            action: { startsWith: 'PAYMENT_' },
          },
        })

        report.encryptionFailures = await prisma.auditLog.count({
          where: {
            ...baseQuery,
            action: 'SECURITY_ENCRYPTION_FAILURE',
          },
        })

        report.unauthorizedAccess = await prisma.auditLog.count({
          where: {
            ...baseQuery,
            action: { in: ['AUTH_LOGIN_FAILED', 'SECURITY_BLACKLIST_HIT'] },
          },
        })
        break

      case 'GDPR':
        report.dataExports = await prisma.auditLog.count({
          where: {
            ...baseQuery,
            action: 'USER_DATA_EXPORTED',
          },
        })

        report.dataAnonymizations = await prisma.auditLog.count({
          where: {
            ...baseQuery,
            action: 'USER_ANONYMIZED',
          },
        })

        report.consentUpdates = await prisma.auditLog.count({
          where: {
            ...baseQuery,
            action: 'CONSENT_UPDATED',
          },
        })
        break

      case 'SECURITY': {
        const securityEvents = await prisma.auditLog.groupBy({
          by: ['action'],
          where: {
            ...baseQuery,
            action: { startsWith: 'SECURITY_' },
          },
          _count: true,
        })

        report.securityEvents = securityEvents
        report.totalAlerts = await prisma.securityAlert.count({
          where: baseQuery,
        })

        report.criticalAlerts = await prisma.securityAlert.count({
          where: {
            ...baseQuery,
            severity: 'CRITICAL',
          },
        })
        break
      }
      }

      return report
    } catch (error) {
      logger.error('Failed to generate compliance report', { error, reportType })
      throw error
    }
  }

  /**
   * Clean up old audit logs
   */
  async cleanupOldLogs(retentionDays: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)

      // Archive logs before deletion (in production, export to cold storage)
      const logsToDelete = await prisma.auditLog.count({
        where: {
          createdAt: { lt: cutoffDate },
        },
      })

      if (logsToDelete > 0) {
        logger.info(`Archiving ${logsToDelete} audit logs older than ${retentionDays} days`)

        // Delete old logs
        const result = await prisma.auditLog.deleteMany({
          where: {
            createdAt: { lt: cutoffDate },
          },
        })

        return result.count
      }

      return 0
    } catch (error) {
      logger.error('Failed to cleanup old audit logs', error)
      throw error
    }
  }

  /**
   * Search audit logs
   */
  async searchLogs(criteria: {
    userId?: string
    action?: string
    entityType?: string
    entityId?: string
    startDate?: Date
    endDate?: Date
    ipAddress?: string
    limit?: number
  }): Promise<any[]> {
    try {
      const where: any = {}

      if (criteria.userId) where.userId = criteria.userId
      if (criteria.action) where.action = { contains: criteria.action }
      if (criteria.entityType) where.entityType = criteria.entityType
      if (criteria.entityId) where.entityId = criteria.entityId
      if (criteria.ipAddress) where.ipAddress = criteria.ipAddress

      if (criteria.startDate || criteria.endDate) {
        where.createdAt = {}
        if (criteria.startDate) where.createdAt.gte = criteria.startDate
        if (criteria.endDate) where.createdAt.lte = criteria.endDate
      }

      return await prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: criteria.limit || 100,
      })
    } catch (error) {
      logger.error('Failed to search audit logs', error)
      throw error
    }
  }
}

export const auditLogService = new AuditLogService()
