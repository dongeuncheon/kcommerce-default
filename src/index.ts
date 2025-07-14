import express from 'express'
import cookieParser from 'cookie-parser'
import { createServer } from 'http'
import responseTime from 'response-time'
import { config } from './config/config'
import { logger } from './utils/logger'
import { 
  errorHandler, 
  notFoundHandler, 
  requestIdMiddleware
} from './middleware/error'
import { requestLogger } from './middleware/requestLogger'
import { 
  dynamicRateLimiter,
  whitelistMiddleware,
  smartAdaptiveRateLimiter,
  blacklistCheck
} from './middleware/rateLimiter'
import { combinedSecurityMiddleware } from './middleware/securityHeaders'
import { apiVersioning, versionAnalytics } from './middleware/apiVersioning'
import { 
  requestValidation,
  contentTypeValidation 
} from './middleware/requestValidation'
import { circuitBreakerMiddleware } from './middleware/circuitBreaker'
import { configureCompression, brotliCompression } from './middleware/compression'
import { cacheService } from './services/cacheService'
import { performanceMiddleware } from './services/performanceService'
import { cdnMiddleware } from './services/cdnService'
import { QueryOptimizationService } from './services/queryOptimizationService'
import { PrismaClient } from '@prisma/client'
import { productRoutes } from './api/routes/products'
import { productOptionsRoutes } from './api/routes/productOptions'
import { healthRoutes } from './api/routes/health'
import { adminRoutes } from './api/routes/admin'
import { inventoryRoutes } from './api/routes/inventory'
import { pricingRoutes } from './api/routes/pricing'
import cartRoutes from './api/routes/cart'
import orderRoutes from './api/routes/orders'
import shippingRoutes from './api/routes/shipping'
import categoryRoutes from './api/routes/categories'
import securityRoutes from './api/routes/security'
import customerRoutes from './api/routes/customers'
import { autoSaveRoutes } from './api/routes/autoSave'
import metricsRoutes from './api/routes/metrics'
import webhooksRoutes from './api/routes/webhooks'
// import verificationRoutes from './api/routes/verification' // Temporarily disabled
// import pointRoutes from './api/routes/points' // Temporarily disabled
import trackingRoutes from './api/routes/tracking'
import inquiryRoutes from './api/routes/inquiries'
import oauthRoutes from './api/routes/oauth'
import authRoutes from './api/routes/auth'
import searchRoutes from './api/routes/search'
import dashboardRoutes from './api/routes/dashboard'
import reportRoutes from './api/routes/reports'
import { initializeSocketServer } from './socket/socketServer'
import { masterController } from './orchestration/master-controller'
import { sessionMiddleware, cartSessionMiddleware } from './middleware/sessionMiddleware'
import { autoSaveMiddleware, shutdownAutoSave } from './middleware/autoSave'
import { metricsMiddleware, businessMetricsMiddleware } from './middleware/metricsMiddleware'
import { setupSwagger } from './middleware/swagger'
import { MonitoringService } from './services/monitoringService'
import Redis from 'ioredis'
import { setupStaticFiles } from './middleware/static'
import { setupViteDevServer } from './middleware/vite-dev'
import { integrateCoreFeatures } from './integration/core-integration'

const app = express()
const server = createServer(app)

// Initialize Prisma Client with connection pooling
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: config.databaseUrl,
    },
  },
  log: config.database.enableQueryLogging ? ['query', 'info', 'warn', 'error'] : ['warn', 'error'],
})

// Initialize Redis client for monitoring
const redis = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  enableReadyCheck: false,
  maxRetriesPerRequest: null
})

// Initialize services
const queryOptimizer = new QueryOptimizationService(prisma)
const monitoringService = new MonitoringService(prisma, redis)

// Initialize cache service
async function initializeCache() {
  try {
    await cacheService.connect()
    logger.info('Redis cache connected successfully')
  } catch (error) {
    logger.error('Failed to connect to Redis cache:', error)
    logger.warn('Running without cache')
  }
}

// Initialize database optimizations
async function initializeDatabase() {
  try {
    await queryOptimizer.createIndexes()
    logger.info('Database indexes created successfully')
  } catch (error) {
    logger.error('Failed to create database indexes:', error)
  }
}

// ============= ENHANCED MIDDLEWARE STACK =============

// 1. Request ID and basic security (first)
app.use(requestIdMiddleware)

// 2. Enhanced security headers and CORS
app.use(combinedSecurityMiddleware)

// 3. Performance monitoring
app.use(performanceMiddleware)
app.use(responseTime())

// 4. CDN middleware
app.use(cdnMiddleware())

// 5. Compression middleware
if (config.performance.enableCompression) {
  app.use(configureCompression())
  app.use(brotliCompression())
}

// 6. Body parsing with validation
app.use(express.json({ 
  limit: '10mb',
  verify: (_req, _res, buf) => {
    // Basic size validation
    if (buf.length > 10 * 1024 * 1024) {
      throw new Error('Request body too large')
    }
  }
}))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))
app.use(cookieParser())

// 7. Content-Type validation for POST/PUT requests
app.use(contentTypeValidation(['application/json', 'multipart/form-data', 'application/x-www-form-urlencoded']))

// 8. Metrics collection middleware
app.use(metricsMiddleware)
app.use(businessMetricsMiddleware)

// 9. Request logging and analytics
app.use(requestLogger)

// 10. Security checks (blacklist, etc.)
app.use(blacklistCheck)

// 11. Whitelist check (bypass rate limits for trusted sources)
app.use(whitelistMiddleware)

// 12. API versioning
if (config.api.enableVersioning) {
  app.use('/api', apiVersioning())
  app.use('/api', versionAnalytics())
}

// 13. Request validation and sanitization
app.use('/api', requestValidation())

// 14. Enhanced rate limiting with user tiers
app.use('/api/auth', dynamicRateLimiter('auth'))
app.use('/api/payment', dynamicRateLimiter('payment'))
app.use('/api/search', dynamicRateLimiter('search'))
app.use('/api', smartAdaptiveRateLimiter())

// 15. Circuit breaker for external services
app.use('/api/payment', circuitBreakerMiddleware('payment'))
app.use('/api/email', circuitBreakerMiddleware('email'))

// Session management for guest users
app.use(sessionMiddleware({
  autoCreate: true,
  trackActivity: true,
  extendOnActivity: false
}))

// Static files for uploads
app.use('/uploads', express.static('uploads'))

// ============= API DOCUMENTATION =============
setupSwagger(app)

// ============= STATIC FILES & FRONTEND =============
// 프로덕션에서는 정적 파일 서빙
if (process.env.NODE_ENV === 'production') {
  setupStaticFiles(app)
}

// ============= COMMERCE-CORE INTEGRATION =============
// Commerce-Core 기능들을 통합
integrateCoreFeatures(app, {
  enableCoreRoutes: true,
  coreApiPrefix: '/api/core',
  enableSampleData: true
})

// ============= ROUTES =============

// Health check and monitoring (no auth required)
app.use('/health', healthRoutes)
app.use('/metrics', metricsRoutes)
app.use('/webhooks', webhooksRoutes)

// Auth routes (no auth required for login/register)
app.use('/api/v1/auth', authRoutes)
// OAuth routes for social login
app.use('/api/v1/oauth', oauthRoutes)

// Admin routes (should add auth middleware in production)
app.use('/admin', adminRoutes)

// API routes with versioning
app.use('/api/v1/products', productRoutes)
app.use('/api/v1/product-options', productOptionsRoutes)
app.use('/api/v1/categories', categoryRoutes)
app.use('/api/v1/inventory', inventoryRoutes)
app.use('/api/v1/pricing', pricingRoutes)
app.use('/api/v1/carts', cartSessionMiddleware(), autoSaveMiddleware({
  interval: 30,
  onlyOnChanges: true,
  enablePeriodicSave: true,
  maxRetries: 3,
  enableRecovery: true
}), cartRoutes)
app.use('/api/v1/orders', orderRoutes)
app.use('/api/v1/shipping', shippingRoutes)
app.use('/api/v1/security', securityRoutes)
app.use('/api/v1/customers', customerRoutes)
app.use('/api/v1/auto-save', autoSaveRoutes)
// app.use('/api/v1/verification', verificationRoutes) // Temporarily disabled
// app.use('/api/v1/points', pointRoutes) // Temporarily disabled
app.use('/api/v1/tracking', trackingRoutes)
app.use('/api/v1/inquiries', inquiryRoutes)
app.use('/api/v1/search', searchRoutes)
app.use('/api/v1/dashboard', dashboardRoutes)
app.use('/api/v1/reports', reportRoutes)

// Error handling
app.use(notFoundHandler)
app.use(errorHandler)

// 포트 설정 (환경변수 우선, 기본값 3000)
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000

// Initialize Socket.io server
const socketServer = initializeSocketServer(server)

// Start server with async initialization
async function startServer() {
  try {
    // Initialize cache
    await initializeCache()
    
    // Skip database initialization for now
    // await initializeDatabase()
    
    // Initialize and start master controller
    await masterController.initialize()
    await masterController.start()
    
    // Start monitoring service
    monitoringService.startMonitoring()
    logger.info('Monitoring service started')
    
    // Setup Vite dev server in development
    if (process.env.NODE_ENV !== 'production') {
      await setupViteDevServer(app)
      logger.info('Vite development server integrated')
    } else {
      // 프로덕션에서는 빌드된 클라이언트 파일 서빙
      setupStaticFiles(app)
      logger.info('Static client files served')
    }
    
    // Send ready signal for PM2
    if (process.send) {
      process.send('ready')
    }
    
    server.listen(PORT, () => {
      logger.info(`🚀 Commerce API server running on port ${PORT}`)
      logger.info(`📚 API Documentation: http://localhost:${PORT}/api-docs`)
      logger.info(`🏥 Health Check: http://localhost:${PORT}/health`)
      logger.info(`📊 Prometheus Metrics: http://localhost:${PORT}/metrics`)
      logger.info(`📈 Business Metrics: http://localhost:${PORT}/metrics/business`)
      logger.info(`🔔 AlertManager Webhooks: http://localhost:${PORT}/webhooks/alerts`)
      logger.info(`🔌 WebSocket server initialized for real-time cart sync`)
      logger.info(`🚄 Performance optimizations enabled`)
      logger.info(`📊 Performance metrics: http://localhost:${PORT}/health/performance`)
      
      // Enhanced features info
      logger.info(`🛡️ Enhanced Security: Rate limiting, CSRF protection, input sanitization`)
      logger.info(`⚡ Circuit Breakers: External service protection enabled`)
      logger.info(`🔄 API Versioning: Multi-version support with deprecation notices`)
      logger.info(`📈 Monitoring: Comprehensive metrics and error tracking with Prometheus`)
      logger.info(`🚨 Alerting: Real-time alerts via AlertManager with multiple notification channels`)
      logger.info(`📊 Grafana Ready: Dashboards for application and business metrics`)
      logger.info(`🎯 Rate Limiting: User tier-based with adaptive behavior analysis`)
      logger.info(`🔧 Admin Dashboard: http://localhost:${PORT}/admin/dashboard`)
      logger.info(`📋 Error Documentation: http://localhost:${PORT}/docs/api/error-codes.md`)
      logger.info(`🔍 Monitoring Stack: Start with 'npm run monitoring:start'`)
    })
  } catch (error) {
    logger.error('Failed to start server:', error)
    process.exit(1)
  }
}

startServer()

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...')
  await masterController.stop()
  shutdownAutoSave()
  socketServer.close()
  await cacheService.disconnect()
  await redis.disconnect()
  await prisma.$disconnect()
  server.close(() => {
    logger.info('Server closed')
    process.exit(0)
  })
})

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...')
  await masterController.stop()
  shutdownAutoSave()
  socketServer.close()
  await cacheService.disconnect()
  await redis.disconnect()
  await prisma.$disconnect()
  server.close(() => {
    logger.info('Server closed')
    process.exit(0)
  })
})

export default app