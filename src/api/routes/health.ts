import { Router, Request, Response } from 'express'
import { prisma } from '../../utils/database'
import { asyncHandler, getErrorMetrics, getErrorStatistics } from '../../middleware/error'
import { getRateLimitMetrics } from '../../middleware/rateLimiter'
import { getCircuitBreakerMetrics } from '../../middleware/circuitBreaker'
import { getVersionStatistics } from '../../middleware/apiVersioning'
import { config } from '../../config/config'
import { performanceService } from '../../services/performanceService'
import { cacheService } from '../../services/cacheService'
import { QueryOptimizationService } from '../../services/queryOptimizationService'

const router = Router()

/**
 * @route   GET /health
 * @desc    Health check endpoint
 * @access  Public
 */
router.get('/', asyncHandler(async (_req: Request, res: Response) => {
  const healthCheck = {
    uptime: process.uptime(),
    message: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    version: process.env.npm_package_version || '1.0.0',
    checks: {
      database: 'checking...',
      memory: 'checking...',
    }
  }

  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`
    healthCheck.checks.database = 'healthy'
  } catch (error) {
    healthCheck.checks.database = 'unhealthy'
    healthCheck.message = 'Database connection failed'
  }

  // Check memory usage
  const memoryUsage = process.memoryUsage()
  const memoryInMB = {
    rss: Math.round(memoryUsage.rss / 1024 / 1024),
    heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
    heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
    external: Math.round(memoryUsage.external / 1024 / 1024),
  }

  if (memoryInMB.heapUsed > 500) { // Alert if heap usage > 500MB
    healthCheck.checks.memory = 'warning'
  } else {
    healthCheck.checks.memory = 'healthy'
  }

  healthCheck.checks = {
    ...healthCheck.checks,
    memory: `${memoryInMB.heapUsed}MB used of ${memoryInMB.heapTotal}MB total`,
  }

  const statusCode = Object.values(healthCheck.checks).some(check => 
    typeof check === 'string' && check.includes('unhealthy')
  ) ? 503 : 200

  res.status(statusCode).json(healthCheck)
}))

/**
 * @route   GET /health/ready
 * @desc    Readiness probe for Kubernetes
 * @access  Public
 */
router.get('/ready', asyncHandler(async (_req: Request, res: Response) => {
  try {
    // Check if database is ready
    await prisma.$queryRaw`SELECT 1`
    
    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
      error: 'Database not available',
    })
  }
}))

/**
 * @route   GET /health/live
 * @desc    Liveness probe for Kubernetes
 * @access  Public
 */
router.get('/live', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  })
})

/**
 * @route   GET /health/performance
 * @desc    Get performance metrics
 * @access  Public
 */
router.get('/performance', asyncHandler(async (_req: Request, res: Response) => {
  const metrics = performanceService.getMetrics()
  const healthStatus = performanceService.getHealthStatus()
  
  res.json({
    metrics,
    health: healthStatus,
    timestamp: new Date().toISOString()
  })
}))

/**
 * @route   GET /health/cache
 * @desc    Get cache statistics
 * @access  Public
 */
router.get('/cache', asyncHandler(async (_req: Request, res: Response) => {
  const isConnected = cacheService.isConnected()
  
  res.json({
    status: isConnected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  })
}))

/**
 * @route   GET /health/database
 * @desc    Get database performance metrics
 * @access  Public
 */
router.get('/database', asyncHandler(async (_req: Request, res: Response) => {
  const queryOptimizer = new QueryOptimizationService(prisma)
  const connectionStats = await queryOptimizer.getConnectionPoolStats()
  
  res.json({
    connectionPool: connectionStats,
    timestamp: new Date().toISOString()
  })
}))

/**
 * @route   GET /health/errors
 * @desc    Get error metrics and statistics
 * @access  Private
 */
router.get('/errors', asyncHandler(async (_req: Request, res: Response) => {
  const errorMetrics = getErrorMetrics()
  const errorStatistics = getErrorStatistics()
  
  res.json({
    metrics: errorMetrics,
    statistics: errorStatistics,
    timestamp: new Date().toISOString()
  })
}))

/**
 * @route   GET /health/rate-limits
 * @desc    Get rate limiting metrics
 * @access  Private
 */
router.get('/rate-limits', asyncHandler(async (_req: Request, res: Response) => {
  const rateLimitMetrics = await getRateLimitMetrics()
  
  res.json({
    ...rateLimitMetrics,
    timestamp: new Date().toISOString()
  })
}))

/**
 * @route   GET /health/circuit-breakers
 * @desc    Get circuit breaker status
 * @access  Private
 */
router.get('/circuit-breakers', asyncHandler(async (_req: Request, res: Response) => {
  const circuitBreakerMetrics = getCircuitBreakerMetrics()
  
  res.json({
    circuitBreakers: circuitBreakerMetrics,
    timestamp: new Date().toISOString()
  })
}))

/**
 * @route   GET /health/api-versions
 * @desc    Get API version usage statistics
 * @access  Private
 */
router.get('/api-versions', asyncHandler(async (_req: Request, res: Response) => {
  const versionStats = getVersionStatistics()
  
  res.json({
    ...versionStats,
    timestamp: new Date().toISOString()
  })
}))

/**
 * @route   GET /health/system
 * @desc    Get comprehensive system health information
 * @access  Private
 */
router.get('/system', asyncHandler(async (_req: Request, res: Response) => {
  const systemHealth = {
    uptime: process.uptime(),
    environment: config.nodeEnv,
    version: process.env.npm_package_version || '1.0.0',
    timestamp: new Date().toISOString(),
    
    // Memory information
    memory: {
      usage: process.memoryUsage(),
      heapStatistics: (process as any).memoryUsage?.rss ? {
        totalHeap: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        usedHeap: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        freeHeap: Math.round((process.memoryUsage().heapTotal - process.memoryUsage().heapUsed) / 1024 / 1024),
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024)
      } : null
    },
    
    // CPU information
    cpu: {
      usage: process.cpuUsage(),
      loadAverage: process.platform !== 'win32' ? require('os').loadavg() : null,
      cores: require('os').cpus().length
    },
    
    // Event loop lag (simplified)
    eventLoop: {
      lag: typeof process.hrtime.bigint === 'function' ? 'available' : 'not_available'
    },
    
    // Database status
    database: {
      connected: false,
      latency: null as number | null
    },
    
    // External services status
    services: {
      redis: config.redis.enabled,
      monitoring: config.monitoring.enabled,
      cdn: config.cdn.enabled
    }
  }

  try {
    // Test database connection and measure latency
    const start = Date.now()
    await prisma.$queryRaw`SELECT 1`
    systemHealth.database.connected = true
    systemHealth.database.latency = Date.now() - start
  } catch (error) {
    systemHealth.database.connected = false
  }

  // Determine overall health status
  const isHealthy = systemHealth.database.connected && 
                   systemHealth.memory.heapStatistics &&
                   systemHealth.memory.heapStatistics.usedHeap < 1000 // Less than 1GB

  res.status(isHealthy ? 200 : 503).json(systemHealth)
}))

/**
 * @route   GET /health/security
 * @desc    Get security-related health information
 * @access  Private
 */
router.get('/security', asyncHandler(async (_req: Request, res: Response) => {
  const securityHealth = {
    timestamp: new Date().toISOString(),
    
    // Security middleware status
    middleware: {
      rateLimiting: config.rateLimit.enableAdaptive,
      circuitBreaker: config.rateLimit.enableCircuitBreaker,
      helmet: config.security.enableHelmet,
      csrf: config.security.enableCsrf,
      cors: !!config.cors.origin
    },
    
    // Recent security events
    recentEvents: {
      rateLimitViolations: await getRateLimitMetrics().then(m => m.blockedRequests).catch(() => 0),
      circuitBreakerTrips: Object.values(getCircuitBreakerMetrics())
        .filter(cb => cb.state === 'OPEN').length
    },
    
    // Configuration status
    configuration: {
      httpsOnly: config.security.enableHsts,
      securityHeaders: config.security.enableHelmet,
      inputValidation: true, // Always enabled
      outputEncoding: true // Always enabled
    }
  }

  res.json(securityHealth)
}))

/**
 * @route   GET /health/metrics
 * @desc    Get comprehensive metrics for monitoring systems (Prometheus format)
 * @access  Private
 */
router.get('/metrics', asyncHandler(async (_req: Request, res: Response) => {
  const metrics: string[] = []
  
  // System metrics
  const memUsage = process.memoryUsage()
  metrics.push(`# HELP nodejs_memory_heap_used_bytes Node.js heap memory used`)
  metrics.push(`# TYPE nodejs_memory_heap_used_bytes gauge`)
  metrics.push(`nodejs_memory_heap_used_bytes ${memUsage.heapUsed}`)
  
  metrics.push(`# HELP nodejs_memory_heap_total_bytes Node.js heap memory total`)
  metrics.push(`# TYPE nodejs_memory_heap_total_bytes gauge`)
  metrics.push(`nodejs_memory_heap_total_bytes ${memUsage.heapTotal}`)
  
  metrics.push(`# HELP nodejs_uptime_seconds Node.js uptime`)
  metrics.push(`# TYPE nodejs_uptime_seconds counter`)
  metrics.push(`nodejs_uptime_seconds ${process.uptime()}`)
  
  // Error metrics
  const errorStats = getErrorStatistics()
  metrics.push(`# HELP api_errors_total Total API errors`)
  metrics.push(`# TYPE api_errors_total counter`)
  metrics.push(`api_errors_total ${errorStats.total}`)
  
  metrics.push(`# HELP api_errors_critical_total Critical API errors`)
  metrics.push(`# TYPE api_errors_critical_total counter`)
  metrics.push(`api_errors_critical_total ${errorStats.critical}`)
  
  // Rate limit metrics
  try {
    const rateLimitMetrics = await getRateLimitMetrics()
    metrics.push(`# HELP api_rate_limit_blocked_total Blocked requests due to rate limiting`)
    metrics.push(`# TYPE api_rate_limit_blocked_total counter`)
    metrics.push(`api_rate_limit_blocked_total ${rateLimitMetrics.blockedRequests}`)
    
    metrics.push(`# HELP api_rate_limit_active_users Active users`)
    metrics.push(`# TYPE api_rate_limit_active_users gauge`)
    metrics.push(`api_rate_limit_active_users ${rateLimitMetrics.activeUsers}`)
  } catch (error) {
    // Rate limit metrics not available
  }
  
  // Circuit breaker metrics
  const circuitBreakers = getCircuitBreakerMetrics()
  for (const [name, cb] of Object.entries(circuitBreakers)) {
    metrics.push(`# HELP circuit_breaker_state Circuit breaker state (0=closed, 1=open, 2=half-open)`)
    metrics.push(`# TYPE circuit_breaker_state gauge`)
    const stateValue = cb.state === 'CLOSED' ? 0 : cb.state === 'OPEN' ? 1 : 2
    metrics.push(`circuit_breaker_state{name="${name}"} ${stateValue}`)
    
    metrics.push(`# HELP circuit_breaker_failures Circuit breaker failure count`)
    metrics.push(`# TYPE circuit_breaker_failures counter`)
    metrics.push(`circuit_breaker_failures{name="${name}"} ${cb.failureCount}`)
  }

  res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  res.send(metrics.join('\n'))
}))

/**
 * @route   POST /health/alerts
 * @desc    Create health alerts (for monitoring integration)
 * @access  Private
 */
router.post('/alerts', asyncHandler(async (req: Request, res: Response) => {
  const { type, message, severity = 'info', metadata = {} } = req.body

  // Log the alert
  const alertData = {
    type,
    message,
    severity,
    metadata,
    timestamp: new Date().toISOString(),
    source: 'health-check-system'
  }

  switch (severity) {
    case 'critical':
    case 'error':
      console.error('HEALTH ALERT:', alertData)
      break
    case 'warning':
      console.warn('HEALTH ALERT:', alertData)
      break
    default:
      console.info('HEALTH ALERT:', alertData)
  }

  // In a real implementation, you would send this to your alerting system
  // await sendToAlertingSystem(alertData)

  res.status(201).json({
    success: true,
    alert: alertData
  })
}))

export { router as healthRoutes }