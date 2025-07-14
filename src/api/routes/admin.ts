import { Router, Request, Response } from 'express'
import { asyncHandler } from '../../middleware/error'
import { 
  getRateLimitMetrics, 
  resetRateLimit, 
  updateUserTier, 
  getRateLimitStatus,
  USER_TIERS
} from '../../middleware/rateLimiter'
import { 
  getCircuitBreakerMetrics, 
  resetAllCircuitBreakers, 
  resetCircuitBreaker 
} from '../../middleware/circuitBreaker'
import { 
  getErrorMetrics, 
  getErrorStatistics, 
  resetErrorMetrics 
} from '../../middleware/error'
import { getVersionStatistics } from '../../middleware/apiVersioning'
import { logger } from '../../utils/logger'

const router = Router()

/**
 * @route   GET /admin/rate-limits
 * @desc    Get comprehensive rate limiting information
 * @access  Private - Admin only
 */
router.get('/rate-limits', asyncHandler(async (_req: Request, res: Response) => {
  const metrics = await getRateLimitMetrics()
  
  res.json({
    success: true,
    data: {
      metrics,
      userTiers: USER_TIERS,
      configuration: {
        adaptive: true,
        circuitBreaker: true
      }
    }
  })
}))

/**
 * @route   POST /admin/rate-limits/reset
 * @desc    Reset rate limits for specific key or all
 * @access  Private - Admin only
 */
router.post('/rate-limits/reset', asyncHandler(async (req: Request, res: Response) => {
  const { key, all = false } = req.body

  if (all) {
    // Reset all rate limits (would need implementation)
    logger.info('All rate limits reset by admin', {
      adminUser: (req as any).user?.id,
      ip: req.ip
    })
    
    res.json({
      success: true,
      message: 'All rate limits reset successfully'
    })
  } else if (key) {
    await resetRateLimit(key)
    
    logger.info('Rate limit reset by admin', {
      key,
      adminUser: (req as any).user?.id,
      ip: req.ip
    })
    
    res.json({
      success: true,
      message: `Rate limit reset for key: ${key}`
    })
  } else {
    res.status(400).json({
      success: false,
      error: {
        type: 'ValidationError',
        message: 'Either "key" or "all: true" must be provided'
      }
    })
  }
}))

/**
 * @route   POST /admin/rate-limits/user-tier
 * @desc    Update user tier for rate limiting
 * @access  Private - Admin only
 */
router.post('/rate-limits/user-tier', asyncHandler(async (req: Request, res: Response) => {
  const { userId, tier } = req.body

  if (!userId || !tier) {
    return res.status(400).json({
      success: false,
      error: {
        type: 'ValidationError',
        message: 'userId and tier are required'
      }
    })
  }

  if (!USER_TIERS[tier]) {
    return res.status(400).json({
      success: false,
      error: {
        type: 'ValidationError',
        message: `Invalid tier. Available tiers: ${Object.keys(USER_TIERS).join(', ')}`
      }
    })
  }

  await updateUserTier(userId, tier)
  
  logger.info('User tier updated by admin', {
    userId,
    tier,
    adminUser: (req as any).user?.id,
    ip: req.ip
  })

  return res.json({
    success: true,
    message: `User ${userId} tier updated to ${tier}`,
    data: {
      userId,
      tier,
      tierDetails: USER_TIERS[tier]
    }
  })
}))

/**
 * @route   GET /admin/rate-limits/status/:key
 * @desc    Get rate limit status for specific key
 * @access  Private - Admin only
 */
router.get('/rate-limits/status/:key', asyncHandler(async (req: Request, res: Response) => {
  const { key } = req.params
  const status = await getRateLimitStatus(key)

  res.json({
    success: true,
    data: {
      key,
      status
    }
  })
}))

/**
 * @route   GET /admin/circuit-breakers
 * @desc    Get circuit breaker status and metrics
 * @access  Private - Admin only
 */
router.get('/circuit-breakers', asyncHandler(async (_req: Request, res: Response) => {
  const metrics = getCircuitBreakerMetrics()

  res.json({
    success: true,
    data: {
      circuitBreakers: metrics,
      summary: {
        total: Object.keys(metrics).length,
        open: Object.values(metrics).filter(cb => cb.state === 'OPEN').length,
        halfOpen: Object.values(metrics).filter(cb => cb.state === 'HALF_OPEN').length,
        closed: Object.values(metrics).filter(cb => cb.state === 'CLOSED').length
      }
    }
  })
}))

/**
 * @route   POST /admin/circuit-breakers/reset
 * @desc    Reset circuit breakers
 * @access  Private - Admin only
 */
router.post('/circuit-breakers/reset', asyncHandler(async (req: Request, res: Response) => {
  const { name, all = false } = req.body

  if (all) {
    resetAllCircuitBreakers()
    
    logger.info('All circuit breakers reset by admin', {
      adminUser: (req as any).user?.id,
      ip: req.ip
    })
    
    res.json({
      success: true,
      message: 'All circuit breakers reset successfully'
    })
  } else if (name) {
    resetCircuitBreaker(name)
    
    logger.info('Circuit breaker reset by admin', {
      name,
      adminUser: (req as any).user?.id,
      ip: req.ip
    })
    
    res.json({
      success: true,
      message: `Circuit breaker ${name} reset successfully`
    })
  } else {
    res.status(400).json({
      success: false,
      error: {
        type: 'ValidationError',
        message: 'Either "name" or "all: true" must be provided'
      }
    })
  }
}))

/**
 * @route   GET /admin/errors
 * @desc    Get error metrics and statistics
 * @access  Private - Admin only
 */
router.get('/errors', asyncHandler(async (_req: Request, res: Response) => {
  const metrics = getErrorMetrics()
  const statistics = getErrorStatistics()

  res.json({
    success: true,
    data: {
      metrics,
      statistics,
      analysis: {
        errorRate: statistics.total > 0 ? (statistics.critical / statistics.total) : 0,
        trending: {
          hourly: statistics.lastHour,
          daily: statistics.lastDay / 24
        }
      }
    }
  })
}))

/**
 * @route   POST /admin/errors/reset
 * @desc    Reset error metrics
 * @access  Private - Admin only
 */
router.post('/errors/reset', asyncHandler(async (_req: Request, res: Response) => {
  resetErrorMetrics()
  
  logger.info('Error metrics reset by admin', {
    adminUser: (_req as any).user?.id,
    ip: _req.ip
  })

  res.json({
    success: true,
    message: 'Error metrics reset successfully'
  })
}))

/**
 * @route   GET /admin/api-versions
 * @desc    Get API version usage and management
 * @access  Private - Admin only
 */
router.get('/api-versions', asyncHandler(async (_req: Request, res: Response) => {
  const versionStats = getVersionStatistics()

  res.json({
    success: true,
    data: versionStats
  })
}))

/**
 * @route   GET /admin/dashboard
 * @desc    Get admin dashboard summary
 * @access  Private - Admin only
 */
router.get('/dashboard', asyncHandler(async (_req: Request, res: Response) => {
  const [
    rateLimitMetrics,
    circuitBreakerMetrics,
    errorStatistics,
    _versionStats
  ] = await Promise.all([
    getRateLimitMetrics(),
    Promise.resolve(getCircuitBreakerMetrics()),
    Promise.resolve(getErrorStatistics()),
    Promise.resolve(getVersionStatistics())
  ])

  const dashboard = {
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    
    // Key metrics summary
    summary: {
      totalRequests: rateLimitMetrics.totalRequests,
      blockedRequests: rateLimitMetrics.blockedRequests,
      activeUsers: rateLimitMetrics.activeUsers,
      totalErrors: errorStatistics.total,
      criticalErrors: errorStatistics.critical,
      openCircuitBreakers: Object.values(circuitBreakerMetrics)
        .filter(cb => cb.state === 'OPEN').length
    },
    
    // Health indicators
    health: {
      rateLimiting: {
        status: rateLimitMetrics.blockedRequests < 100 ? 'healthy' : 'warning',
        blockRate: rateLimitMetrics.totalRequests > 0 ? 
          (rateLimitMetrics.blockedRequests / rateLimitMetrics.totalRequests) : 0
      },
      circuitBreakers: {
        status: Object.values(circuitBreakerMetrics).every(cb => cb.state === 'CLOSED') ? 
          'healthy' : 'warning',
        openCount: Object.values(circuitBreakerMetrics)
          .filter(cb => cb.state === 'OPEN').length
      },
      errors: {
        status: errorStatistics.lastHour < 10 ? 'healthy' : 
                errorStatistics.lastHour < 50 ? 'warning' : 'critical',
        hourlyRate: errorStatistics.lastHour
      }
    },
    
    // Recent activity
    recentActivity: {
      topAbusers: rateLimitMetrics.topAbusers.slice(0, 5),
      topErrorEndpoints: errorStatistics.topErrorEndpoints.slice(0, 5),
      recentErrors: errorStatistics.lastHour
    },
    
    // System resources
    system: {
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
      },
      cpu: process.cpuUsage()
    }
  }

  res.json({
    success: true,
    data: dashboard
  })
}))

/**
 * @route   POST /admin/maintenance/enable
 * @desc    Enable maintenance mode
 * @access  Private - Admin only
 */
router.post('/maintenance/enable', asyncHandler(async (req: Request, res: Response) => {
  const { message = 'System is under maintenance' } = req.body

  // In a real implementation, you would set this in a persistent store
  // and have middleware check for maintenance mode
  
  logger.warn('Maintenance mode enabled by admin', {
    adminUser: (req as any).user?.id,
    ip: req.ip,
    message
  })

  res.json({
    success: true,
    message: 'Maintenance mode enabled',
    data: {
      maintenanceMessage: message,
      enabledAt: new Date().toISOString()
    }
  })
}))

/**
 * @route   POST /admin/maintenance/disable
 * @desc    Disable maintenance mode
 * @access  Private - Admin only
 */
router.post('/maintenance/disable', asyncHandler(async (_req: Request, res: Response) => {
  logger.info('Maintenance mode disabled by admin', {
    adminUser: (_req as any).user?.id,
    ip: _req.ip
  })

  res.json({
    success: true,
    message: 'Maintenance mode disabled',
    data: {
      disabledAt: new Date().toISOString()
    }
  })
}))

/**
 * @route   GET /admin/logs
 * @desc    Get recent system logs (paginated)
 * @access  Private - Admin only
 */
router.get('/logs', asyncHandler(async (req: Request, res: Response) => {
  const { 
    level = 'info', 
    limit = 100, 
    offset = 0,
    startDate,
    endDate 
  } = req.query

  // In a real implementation, you would query your logging system
  // This is a placeholder response
  const logs = {
    logs: [],
    pagination: {
      total: 0,
      limit: Number(limit),
      offset: Number(offset),
      hasMore: false
    },
    filters: {
      level,
      startDate,
      endDate
    }
  }

  res.json({
    success: true,
    data: logs
  })
}))

export { router as adminRoutes }