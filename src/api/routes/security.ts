import { Router } from 'express'
import { authenticate, authorize } from '../../middleware/auth'
import { rateLimiter } from '../../middleware/rateLimiter'
import { SecurityController } from '../controllers/securityController'

const router = Router()
const securityController = new SecurityController()

// All security routes require admin authentication
router.use(authenticate)
router.use(authorize(['ADMIN', 'SUPER_ADMIN']))

// Audit logs
router.get(
  '/audit-logs',
  rateLimiter('api'),
  securityController.searchAuditLogs
)

router.get(
  '/audit-logs/export',
  rateLimiter('api'),
  securityController.exportAuditLogs
)

// Security alerts
router.get(
  '/alerts',
  rateLimiter('api'),
  securityController.getSecurityAlerts
)

router.patch(
  '/alerts/:id/resolve',
  rateLimiter('api'),
  securityController.resolveSecurityAlert
)

// Compliance reports
router.get(
  '/compliance/pci-dss',
  rateLimiter('api'),
  securityController.getPCIComplianceReport
)

router.get(
  '/compliance/gdpr',
  rateLimiter('api'),
  securityController.getGDPRComplianceReport
)

router.get(
  '/compliance/security',
  rateLimiter('api'),
  securityController.getSecurityReport
)

// Blacklist management
router.get(
  '/blacklist',
  rateLimiter('api'),
  securityController.getBlacklist
)

router.post(
  '/blacklist',
  rateLimiter('api'),
  securityController.addToBlacklist
)

router.delete(
  '/blacklist/:id',
  rateLimiter('api'),
  securityController.removeFromBlacklist
)

// API key management
router.get(
  '/api-keys',
  rateLimiter('api'),
  securityController.getAPIKeys
)

router.post(
  '/api-keys',
  rateLimiter('api'),
  securityController.createAPIKey
)

router.delete(
  '/api-keys/:id',
  rateLimiter('api'),
  securityController.revokeAPIKey
)

// Session management
router.get(
  '/sessions',
  rateLimiter('api'),
  securityController.getActiveSessions
)

router.delete(
  '/sessions/:id',
  rateLimiter('api'),
  securityController.terminateSession
)

router.delete(
  '/sessions/user/:userId',
  rateLimiter('api'),
  securityController.terminateUserSessions
)

// Security maintenance
router.post(
  '/maintenance/cleanup-logs',
  rateLimiter('api'),
  securityController.cleanupOldLogs
)

router.post(
  '/maintenance/cleanup-tokens',
  rateLimiter('api'),
  securityController.cleanupExpiredTokens
)

export default router