import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { prisma } from '../../utils/database'
import { auditLogService } from '../../services/auditLogService'
import { paymentSecurityService } from '../../services/paymentSecurityService'
import { SecurityUtils } from '../../utils/security'
import { AuthenticatedRequest } from '../../middleware/auth'

const AuditLogSearchSchema = z.object({
  userId: z.string().optional(),
  action: z.string().optional(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  ipAddress: z.string().optional(),
  limit: z.string().transform(Number).optional(),
})

const BlacklistSchema = z.object({
  type: z.enum(['IP', 'USER_AGENT', 'EMAIL', 'CARD_FINGERPRINT']),
  value: z.string(),
  reason: z.string(),
  expiresAt: z.string().datetime().optional(),
})

const APIKeySchema = z.object({
  name: z.string(),
  permissions: z.array(z.string()),
  expiresAt: z.string().datetime().optional(),
})

export class SecurityController {
  /**
   * Search audit logs
   */
  async searchAuditLogs(req: Request, res: Response, next: NextFunction) {
    try {
      const query = AuditLogSearchSchema.parse(req.query)
      
      const criteria = {
        ...query,
        startDate: query.startDate ? new Date(query.startDate) : undefined,
        endDate: query.endDate ? new Date(query.endDate) : undefined,
        limit: query.limit || 100,
      }

      const logs = await auditLogService.searchLogs(criteria)

      // Log this admin action
      await auditLogService.logAdminAction(
        'AUDIT_LOG_SEARCH',
        'audit_log',
        'multiple',
        (req as AuthenticatedRequest).user!.id,
        req,
        { criteria }
      )

      res.json({
        success: true,
        data: logs,
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Export audit logs
   */
  async exportAuditLogs(req: Request, res: Response, next: NextFunction) {
    try {
      const query = AuditLogSearchSchema.parse(req.query)
      
      const criteria = {
        ...query,
        startDate: query.startDate ? new Date(query.startDate) : undefined,
        endDate: query.endDate ? new Date(query.endDate) : undefined,
        limit: 10000, // Higher limit for exports
      }

      const logs = await auditLogService.searchLogs(criteria)

      // Log export action
      await auditLogService.logAdminAction(
        'AUDIT_LOG_EXPORT',
        'audit_log',
        'multiple',
        (req as AuthenticatedRequest).user!.id,
        req,
        { count: logs.length }
      )

      // Set headers for CSV download
      res.setHeader('Content-Type', 'text/csv')
      res.setHeader('Content-Disposition', 'attachment; filename=audit-logs.csv')

      // Generate CSV
      const csv = this.generateCSV(logs)
      res.send(csv)
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get security alerts
   */
  async getSecurityAlerts(req: Request, res: Response, next: NextFunction) {
    try {
      const { resolved, severity, userId } = req.query

      const where: any = {}
      if (resolved !== undefined) where.resolved = resolved === 'true'
      if (severity) where.severity = severity
      if (userId) where.userId = userId

      const alerts = await prisma.securityAlert.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 100,
      })

      res.json({
        success: true,
        data: alerts,
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Resolve security alert
   */
  async resolveSecurityAlert(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params

      const alert = await prisma.securityAlert.update({
        where: { id },
        data: { resolved: true },
      })

      await auditLogService.logAdminAction(
        'SECURITY_ALERT_RESOLVED',
        'security_alert',
        id,
        (req as AuthenticatedRequest).user!.id,
        req
      )

      res.json({
        success: true,
        data: alert,
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get PCI DSS compliance report
   */
  async getPCIComplianceReport(req: Request, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate } = req.query

      const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      const end = endDate ? new Date(endDate as string) : new Date()

      const [auditReport, paymentReport] = await Promise.all([
        auditLogService.generateComplianceReport(start, end, 'PCI_DSS'),
        paymentSecurityService.generatePCIComplianceReport(),
      ])

      await auditLogService.logAdminAction(
        'COMPLIANCE_REPORT_GENERATED',
        'compliance',
        'PCI_DSS',
        (req as AuthenticatedRequest).user!.id,
        req
      )

      res.json({
        success: true,
        data: {
          audit: auditReport,
          payment: paymentReport,
          generatedAt: new Date(),
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get GDPR compliance report
   */
  async getGDPRComplianceReport(req: Request, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate } = req.query

      const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      const end = endDate ? new Date(endDate as string) : new Date()

      const report = await auditLogService.generateComplianceReport(start, end, 'GDPR')

      await auditLogService.logAdminAction(
        'COMPLIANCE_REPORT_GENERATED',
        'compliance',
        'GDPR',
        (req as AuthenticatedRequest).user!.id,
        req
      )

      res.json({
        success: true,
        data: report,
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get security report
   */
  async getSecurityReport(req: Request, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate } = req.query

      const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      const end = endDate ? new Date(endDate as string) : new Date()

      const report = await auditLogService.generateComplianceReport(start, end, 'SECURITY')

      await auditLogService.logAdminAction(
        'COMPLIANCE_REPORT_GENERATED',
        'compliance',
        'SECURITY',
        (req as AuthenticatedRequest).user!.id,
        req
      )

      res.json({
        success: true,
        data: report,
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get blacklist entries
   */
  async getBlacklist(req: Request, res: Response, next: NextFunction) {
    try {
      const { type, isActive } = req.query

      const where: any = {}
      if (type) where.type = type
      if (isActive !== undefined) where.isActive = isActive === 'true'

      const blacklist = await prisma.blacklist.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 100,
      })

      res.json({
        success: true,
        data: blacklist,
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Add to blacklist
   */
  async addToBlacklist(req: Request, res: Response, next: NextFunction) {
    try {
      const data = BlacklistSchema.parse(req.body)

      const entry = await prisma.blacklist.create({
        data: {
          ...data,
          expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
        },
      })

      await auditLogService.logAdminAction(
        'BLACKLIST_ENTRY_ADDED',
        'blacklist',
        entry.id,
        (req as AuthenticatedRequest).user!.id,
        req,
        data
      )

      res.status(201).json({
        success: true,
        data: entry,
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Remove from blacklist
   */
  async removeFromBlacklist(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params

      await prisma.blacklist.update({
        where: { id },
        data: { isActive: false },
      })

      await auditLogService.logAdminAction(
        'BLACKLIST_ENTRY_REMOVED',
        'blacklist',
        id,
        (req as AuthenticatedRequest).user!.id,
        req
      )

      res.json({
        success: true,
        message: 'Blacklist entry deactivated',
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get API keys
   */
  async getAPIKeys(_req: Request, res: Response, next: NextFunction) {
    try {
      const apiKeys = await prisma.apiClient.findMany({
        select: {
          id: true,
          name: true,
          permissions: true,
          isActive: true,
          lastUsedAt: true,
          requestCount: true,
          expiresAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      })

      res.json({
        success: true,
        data: apiKeys,
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Create API key
   */
  async createAPIKey(req: Request, res: Response, next: NextFunction) {
    try {
      const data = APIKeySchema.parse(req.body)

      // Generate API key
      const apiKey = SecurityUtils.generateAPIKey()
      const hashedKey = SecurityUtils.hashData(apiKey)

      const client = await prisma.apiClient.create({
        data: {
          name: data.name,
          hashedKey,
          permissions: data.permissions,
          expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
        },
      })

      await auditLogService.logAdminAction(
        'API_KEY_CREATED',
        'api_client',
        client.id,
        (req as AuthenticatedRequest).user!.id,
        req,
        { name: data.name }
      )

      res.status(201).json({
        success: true,
        data: {
          id: client.id,
          name: client.name,
          apiKey, // Only shown once
          permissions: client.permissions,
          expiresAt: client.expiresAt,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Revoke API key
   */
  async revokeAPIKey(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params

      await prisma.apiClient.update({
        where: { id },
        data: { isActive: false },
      })

      await auditLogService.logAdminAction(
        'API_KEY_REVOKED',
        'api_client',
        id,
        (req as AuthenticatedRequest).user!.id,
        req
      )

      res.json({
        success: true,
        message: 'API key revoked',
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get active sessions
   */
  async getActiveSessions(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId } = req.query

      const where: any = {
        expiresAt: { gt: new Date() },
        revokedAt: null,
      }

      if (userId) where.userId = userId

      const sessions = await prisma.session.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { lastActivityAt: 'desc' },
        take: 100,
      })

      res.json({
        success: true,
        data: sessions,
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Terminate session
   */
  async terminateSession(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params

      const session = await prisma.session.update({
        where: { id },
        data: { revokedAt: new Date() },
      })

      await auditLogService.logAdminAction(
        'SESSION_TERMINATED',
        'session',
        id,
        (req as AuthenticatedRequest).user!.id,
        req,
        { userId: session.userId }
      )

      res.json({
        success: true,
        message: 'Session terminated',
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Terminate all user sessions
   */
  async terminateUserSessions(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params

      const result = await prisma.session.updateMany({
        where: {
          userId,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      })

      await auditLogService.logAdminAction(
        'USER_SESSIONS_TERMINATED',
        'user',
        userId,
        (req as AuthenticatedRequest).user!.id,
        req,
        { count: result.count }
      )

      res.json({
        success: true,
        message: `Terminated ${result.count} sessions`,
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Cleanup old audit logs
   */
  async cleanupOldLogs(req: Request, res: Response, next: NextFunction) {
    try {
      const { retentionDays = 90 } = req.body

      const count = await auditLogService.cleanupOldLogs(retentionDays)

      await auditLogService.logAdminAction(
        'AUDIT_LOGS_CLEANUP',
        'system',
        'audit_logs',
        (req as AuthenticatedRequest).user!.id,
        req,
        { retentionDays, deletedCount: count }
      )

      res.json({
        success: true,
        message: `Cleaned up ${count} old audit logs`,
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Cleanup expired payment tokens
   */
  async cleanupExpiredTokens(req: Request, res: Response, next: NextFunction) {
    try {
      const count = await paymentSecurityService.cleanupExpiredTokens()

      await auditLogService.logAdminAction(
        'PAYMENT_TOKENS_CLEANUP',
        'system',
        'payment_tokens',
        (req as AuthenticatedRequest).user!.id,
        req,
        { deletedCount: count }
      )

      res.json({
        success: true,
        message: `Cleaned up ${count} expired payment tokens`,
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Generate CSV from audit logs
   */
  private generateCSV(logs: any[]): string {
    const headers = ['Date', 'User ID', 'Action', 'Entity Type', 'Entity ID', 'IP Address', 'User Agent', 'Method', 'Path', 'Status Code']
    const rows = logs.map(log => [
      log.createdAt.toISOString(),
      log.userId,
      log.action,
      log.entityType || '',
      log.entityId || '',
      log.ipAddress || '',
      log.userAgent || '',
      log.method || '',
      log.path || '',
      log.statusCode || '',
    ])

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n')

    return csv
  }
}

export default SecurityController