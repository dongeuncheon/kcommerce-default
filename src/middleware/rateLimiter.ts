import { Request, Response, NextFunction } from 'express'
import { RateLimiterRedis, RateLimiterMemory } from 'rate-limiter-flexible'
import Redis from 'ioredis'
import { AppError } from './error'
import { logger } from '../utils/logger'
// import { SecurityUtils } from '../utils/security' // Commented to fix unused import
import { config } from '../config/config'
// import { circuitBreakers } from './circuitBreaker' // Commented to fix unused import

export interface UserTier {
  name: string
  points: number
  duration: number
  description: string
}

export interface RateLimitMetrics {
  totalRequests: number
  blockedRequests: number
  activeUsers: number
  topAbusers: Array<{ key: string; requests: number }>
}

// Redis client for rate limiting
const redisClient = config.redis.enabled
  ? new Redis({
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    db: config.redis.db,
    maxRetriesPerRequest: config.redis.maxRetriesPerRequest,
  })
  : null

// User tier definitions
export const USER_TIERS: Record<string, UserTier> = {
  basic: {
    name: 'basic',
    points: config.rateLimit.userTiers.basic.points,
    duration: config.rateLimit.userTiers.basic.duration,
    description: 'Basic user with standard rate limits',
  },
  premium: {
    name: 'premium',
    points: config.rateLimit.userTiers.premium.points,
    duration: config.rateLimit.userTiers.premium.duration,
    description: 'Premium user with increased rate limits',
  },
  enterprise: {
    name: 'enterprise',
    points: config.rateLimit.userTiers.enterprise.points,
    duration: config.rateLimit.userTiers.enterprise.duration,
    description: 'Enterprise user with high rate limits',
  },
}

// Metrics tracking
const rateLimitMetrics: RateLimitMetrics = {
  totalRequests: 0,
  blockedRequests: 0,
  activeUsers: 0,
  topAbusers: [],
}

// Rate limiter configurations
const rateLimiters = {
  // General API rate limit
  api: redisClient
    ? new RateLimiterRedis({
      storeClient: redisClient,
      keyPrefix: 'rl:api',
      points: 100, // Number of requests
      duration: 60, // Per minute
      blockDuration: 60, // Block for 1 minute
    })
    : new RateLimiterMemory({
      keyPrefix: 'rl:api',
      points: 100,
      duration: 60,
      blockDuration: 60,
    }),

  // Strict limit for auth endpoints
  auth: redisClient
    ? new RateLimiterRedis({
      storeClient: redisClient,
      keyPrefix: 'rl:auth',
      points: 5,
      duration: 300, // Per 5 minutes
      blockDuration: 900, // Block for 15 minutes
    })
    : new RateLimiterMemory({
      keyPrefix: 'rl:auth',
      points: 5,
      duration: 300,
      blockDuration: 900,
    }),

  // Payment endpoints rate limit
  payment: redisClient
    ? new RateLimiterRedis({
      storeClient: redisClient,
      keyPrefix: 'rl:payment',
      points: 10,
      duration: 300, // Per 5 minutes
      blockDuration: 1800, // Block for 30 minutes
    })
    : new RateLimiterMemory({
      keyPrefix: 'rl:payment',
      points: 10,
      duration: 300,
      blockDuration: 1800,
    }),

  // Search endpoints rate limit
  search: redisClient
    ? new RateLimiterRedis({
      storeClient: redisClient,
      keyPrefix: 'rl:search',
      points: 30,
      duration: 60, // Per minute
      blockDuration: 60,
    })
    : new RateLimiterMemory({
      keyPrefix: 'rl:search',
      points: 30,
      duration: 60,
      blockDuration: 60,
    }),
}

// DDoS protection - consecutive failed requests
const consecutiveFailLimiter = redisClient
  ? new RateLimiterRedis({
    storeClient: redisClient,
    keyPrefix: 'rl:fail',
    points: 10,
    duration: 600, // 10 minutes
    blockDuration: 3600, // Block for 1 hour
  })
  : new RateLimiterMemory({
    keyPrefix: 'rl:fail',
    points: 10,
    duration: 600,
    blockDuration: 3600,
  })

/**
 * Dynamic rate limiting based on user tier
 */
export const dynamicRateLimiter = (limiterType: keyof typeof rateLimiters = 'api') => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      rateLimitMetrics.totalRequests++

      const userTier = getUserTier(req)
      const key = getKey(req)

      // Create dynamic limiter based on user tier
      const tierConfig = USER_TIERS[userTier]
      const dynamicLimiter = redisClient
        ? new RateLimiterRedis({
          storeClient: redisClient,
          keyPrefix: `rl:${limiterType}:${userTier}`,
          points: tierConfig.points,
          duration: tierConfig.duration,
          blockDuration: tierConfig.duration,
        })
        : new RateLimiterMemory({
          keyPrefix: `rl:${limiterType}:${userTier}`,
          points: tierConfig.points,
          duration: tierConfig.duration,
          blockDuration: tierConfig.duration,
        })

      // Consume 1 point
      const rateLimiterRes = await dynamicLimiter.consume(key)

      // Set rate limit headers with tier information
      res.set({
        'X-RateLimit-Limit': tierConfig.points.toString(),
        'X-RateLimit-Remaining': rateLimiterRes.remainingPoints.toString(),
        'X-RateLimit-Reset': new Date(Date.now() + rateLimiterRes.msBeforeNext).toISOString(),
        'X-RateLimit-Tier': userTier,
        'X-RateLimit-Type': limiterType,
      })

      // Track successful request
      await trackRequestMetrics(key, false)

      next()
    } catch (rateLimiterRes: any) {
      rateLimitMetrics.blockedRequests++

      // Log rate limit violation with enhanced details
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        endpoint: req.originalUrl,
        limiterType,
        userTier: getUserTier(req),
        userAgent: req.headers['user-agent'],
        remainingPoints: rateLimiterRes.remainingPoints,
        msBeforeNext: rateLimiterRes.msBeforeNext,
      })

      // Track blocked request
      await trackRequestMetrics(getKey(req), true)

      // Enhanced rate limit headers
      const userTier = getUserTier(req)
      const tierConfig = USER_TIERS[userTier]

      res.set({
        'X-RateLimit-Limit': tierConfig.points.toString(),
        'X-RateLimit-Remaining': rateLimiterRes.remainingPoints?.toString() || '0',
        'X-RateLimit-Reset': new Date(Date.now() + rateLimiterRes.msBeforeNext).toISOString(),
        'X-RateLimit-Tier': userTier,
        'X-RateLimit-Type': limiterType,
        'Retry-After': Math.round(rateLimiterRes.msBeforeNext / 1000).toString(),
      })

      throw new AppError(`Rate limit exceeded for ${userTier} tier`, 429, true)
    }
  }
}

/**
 * Legacy rate limiting middleware (for backwards compatibility)
 */
export const rateLimiter = (limiterType: keyof typeof rateLimiters = 'api') => {
  return dynamicRateLimiter(limiterType)
}

/**
 * Track failed requests for DDoS protection
 */
export const trackFailedRequest = async (req: Request) => {
  try {
    const key = getKey(req)
    await consecutiveFailLimiter.consume(key)
  } catch (error) {
    logger.error('User blocked due to too many failed requests', {
      ip: req.ip,
      endpoint: req.originalUrl,
    })

    // Add to blacklist
    await addToBlacklist(req.ip || 'unknown')
  }
}

/**
 * Adaptive rate limiting based on user behavior
 */
export const adaptiveRateLimiter = () => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const key = getKey(req)
      const userBehavior = await analyzeUserBehavior(key)

      // Adjust rate limit based on behavior
      let points = 100
      if (userBehavior.suspiciousScore > 50) {
        points = 50
      } else if (userBehavior.suspiciousScore > 80) {
        points = 20
      }

      const adaptiveLimiter = redisClient
        ? new RateLimiterRedis({
          storeClient: redisClient,
          keyPrefix: 'rl:adaptive',
          points,
          duration: 60,
        })
        : new RateLimiterMemory({
          keyPrefix: 'rl:adaptive',
          points,
          duration: 60,
        })

      await adaptiveLimiter.consume(key)
      next()
    } catch (error) {
      throw new AppError('Rate limit exceeded', 429)
    }
  }
}

/**
 * Analyze user behavior for suspicious patterns
 */
async function analyzeUserBehavior(key: string): Promise<{
  suspiciousScore: number
  patterns: string[]
}> {
  const patterns: string[] = []
  let suspiciousScore = 0

  try {
    // Check request patterns in Redis
    if (redisClient) {
      const recentRequests = await redisClient.lrange(`behavior:${key}`, 0, 100)

      // Analyze patterns
      const endpoints = recentRequests.map(r => JSON.parse(r).endpoint)
      const uniqueEndpoints = new Set(endpoints)

      // Suspicious if hitting many different endpoints rapidly
      if (uniqueEndpoints.size > 20) {
        suspiciousScore += 30
        patterns.push('endpoint_scanning')
      }

      // Check for parameter tampering
      const params = recentRequests.map(r => JSON.parse(r).params)
      const suspiciousParams = params.filter(p =>
        p.includes('script') ||
        p.includes('DROP') ||
        p.includes('SELECT'),
      )

      if (suspiciousParams.length > 0) {
        suspiciousScore += 50
        patterns.push('sql_injection_attempt')
      }
    }

    return { suspiciousScore, patterns }
  } catch (error) {
    logger.error('Failed to analyze user behavior', error)
    return { suspiciousScore: 0, patterns: [] }
  }
}

/**
 * Log request for behavior analysis
 */
export const logRequestBehavior = async (req: Request) => {
  try {
    if (redisClient) {
      const key = getKey(req)
      const behavior = {
        endpoint: req.path,
        method: req.method,
        params: JSON.stringify(req.query),
        timestamp: Date.now(),
      }

      await redisClient.lpush(`behavior:${key}`, JSON.stringify(behavior))
      await redisClient.ltrim(`behavior:${key}`, 0, 1000) // Keep last 1000 requests
      await redisClient.expire(`behavior:${key}`, 3600) // Expire after 1 hour
    }
  } catch (error) {
    logger.error('Failed to log request behavior', error)
  }
}

/**
 * Add IP to blacklist
 */
async function addToBlacklist(ip: string) {
  try {
    const prisma = await getPrisma()
    await prisma.blacklist.create({
      data: {
        type: 'IP',
        value: ip,
        reason: 'Too many failed requests',
        isActive: true,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      },
    })
  } catch (error) {
    logger.error('Failed to add IP to blacklist', error)
  }
}

/**
 * Get user tier based on request
 */
function getUserTier(req: Request): string {
  // Check if user has a specific tier
  if ((req as any).user?.tier) {
    return (req as any).user.tier
  }

  // Check if API client has a tier
  if ((req as any).apiClient?.tier) {
    return (req as any).apiClient.tier
  }

  // Default to basic tier
  return 'basic'
}

/**
 * Track request metrics
 */
async function trackRequestMetrics(key: string, isBlocked: boolean): Promise<void> {
  try {
    if (!redisClient) return

    const metricsKey = `metrics:${key}`
    const currentHour = Math.floor(Date.now() / (1000 * 60 * 60))

    await redisClient.multi()
      .hincrby(metricsKey, 'total', 1)
      .hincrby(metricsKey, isBlocked ? 'blocked' : 'success', 1)
      .hincrby(metricsKey, `hour_${currentHour}`, 1)
      .expire(metricsKey, 24 * 60 * 60) // 24 hours
      .exec()
  } catch (error) {
    logger.error('Failed to track request metrics', error)
  }
}

/**
 * Get rate limit key based on request
 */
function getKey(req: Request): string {
  // Use authenticated user ID if available
  if ((req as any).user?.id) {
    return `user:${(req as any).user.id}`
  }

  // Use API key if available
  if ((req as any).apiClient?.id) {
    return `api:${(req as any).apiClient.id}`
  }

  // Fall back to IP address
  return `ip:${req.ip}`
}

/**
 * Blacklist check middleware
 */
export const blacklistCheck = async (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  try {
    const prisma = await getPrisma()
    const blacklisted = await prisma.blacklist.findFirst({
      where: {
        AND: [
          {
            OR: [
              { type: 'IP', value: req.ip },
              { type: 'USER_AGENT', value: req.headers['user-agent'] || '' },
            ],
          },
          { isActive: true },
          {
            OR: [
              { expiresAt: null },
              { expiresAt: { gt: new Date() } },
            ],
          },
        ],
      },
    })

    if (blacklisted) {
      logger.warn('Blacklisted request blocked', {
        type: blacklisted.type,
        value: blacklisted.value,
        reason: blacklisted.reason,
      })

      throw new AppError('Access denied', 403)
    }

    next()
  } catch (error) {
    if (error instanceof AppError) {
      next(error)
    } else {
      // Don't block on blacklist check errors
      logger.error('Blacklist check failed', error)
      next()
    }
  }
}

/**
 * Get rate limiting metrics for monitoring
 */
export const getRateLimitMetrics = async (): Promise<RateLimitMetrics> => {
  try {
    if (!redisClient) {
      return rateLimitMetrics
    }

    // Get active users count
    const activeUsers = await redisClient.keys('rl:*').then(keys =>
      new Set(keys.map(key => key.split(':')[2])).size,
    )

    // Get top abusers
    const metricsKeys = await redisClient.keys('metrics:*')
    const topAbusers: Array<{ key: string; requests: number; blocked: number; ratio: number }> = []

    for (const key of metricsKeys.slice(0, 100)) { // Limit to avoid performance issues
      const metrics: Record<string, string> = await redisClient.hgetall(key)
      const blocked = parseInt(metrics.blocked || '0')
      const total = parseInt(metrics.total || '0')

      if (blocked > 10 || (total > 100 && blocked / total > 0.1)) {
        topAbusers.push({
          key: key.replace('metrics:', ''),
          requests: total,
          blocked,
          ratio: blocked / total,
        })
      }
    }

    return {
      ...rateLimitMetrics,
      activeUsers,
      topAbusers: topAbusers
        .sort((a, b) => b.blocked - a.blocked)
        .slice(0, 10)
        .map(({ key, requests }) => ({ key, requests })),
    }
  } catch (error) {
    logger.error('Failed to get rate limit metrics', error)
    return rateLimitMetrics
  }
}

/**
 * Reset rate limits for a specific key
 */
export const resetRateLimit = async (key: string): Promise<void> => {
  try {
    if (!redisClient) return

    const patterns = [
      `rl:*:${key}`,
      `rl:fail:${key}`,
      `rl:adaptive:${key}`,
      `behavior:${key}`,
      `metrics:${key}`,
    ]

    for (const pattern of patterns) {
      const keys = await redisClient.keys(pattern)
      if (keys.length > 0) {
        await redisClient.del(...keys)
      }
    }

    logger.info(`Rate limits reset for key: ${key}`)
  } catch (error) {
    logger.error('Failed to reset rate limit', error)
    throw error
  }
}

/**
 * Update user tier for rate limiting
 */
export const updateUserTier = async (userId: string, tier: keyof typeof USER_TIERS): Promise<void> => {
  try {
    if (!USER_TIERS[tier]) {
      throw new Error(`Invalid tier: ${tier}`)
    }

    // Reset current rate limits for user
    await resetRateLimit(`user:${userId}`)

    logger.info('User tier updated', { userId, tier })
  } catch (error) {
    logger.error('Failed to update user tier', error)
    throw error
  }
}

/**
 * Get rate limit status for a key
 */
export const getRateLimitStatus = async (key: string): Promise<any> => {
  try {
    if (!redisClient) return null

    const status: any = {}

    // Check all rate limiter types
    for (const [type, limiter] of Object.entries(rateLimiters)) {
      try {
        const res = await limiter.get(key)
        status[type] = {
          totalHits: res ? (res.remainingPoints ? ((res as any).points || 100) - res.remainingPoints : 0) : 0,
          remainingPoints: res?.remainingPoints,
          msBeforeNext: res?.msBeforeNext,
          isBlocked: !res || res.remainingPoints === 0,
        }
      } catch (error) {
        status[type] = { error: 'Failed to get status' }
      }
    }

    return status
  } catch (error) {
    logger.error('Failed to get rate limit status', error)
    return null
  }
}

/**
 * Whitelist middleware - bypass rate limits for trusted sources
 */
export const whitelistMiddleware = (req: Request, _res: Response, next: NextFunction) => {
  const trustedIPs = [
    '127.0.0.1',
    '::1',
    // Add more trusted IPs from config
  ]

  const trustedUserAgents = [
    'health-check',
    'monitoring',
    // Add more trusted user agents
  ]

  const userAgent = req.headers['user-agent'] || ''

  if (trustedIPs.includes(req.ip || '') || trustedUserAgents.some(ua => userAgent.includes(ua))) {
    (req as any).skipRateLimit = true
    logger.debug('Request whitelisted, skipping rate limit', {
      ip: req.ip,
      userAgent,
      endpoint: req.originalUrl,
    })
  }

  next()
}

/**
 * Enhanced adaptive rate limiting with machine learning-like behavior pattern detection
 */
export const smartAdaptiveRateLimiter = () => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Skip if whitelisted
      if ((req as any).skipRateLimit) {
        return next()
      }

      const key = getKey(req)
      const userBehavior = await analyzeUserBehavior(key)
      const userTier = getUserTier(req)

      // Calculate dynamic points based on multiple factors
      const basePoints = USER_TIERS[userTier].points
      let adjustmentFactor = 1

      // Adjust based on suspicious behavior
      if (userBehavior.suspiciousScore > 80) {
        adjustmentFactor = 0.1 // Severe restriction
      } else if (userBehavior.suspiciousScore > 50) {
        adjustmentFactor = 0.3 // Moderate restriction
      } else if (userBehavior.suspiciousScore > 20) {
        adjustmentFactor = 0.7 // Light restriction
      }

      // Consider time of day and load
      const currentHour = new Date().getHours()
      const isPeakHour = currentHour >= 9 && currentHour <= 17 // 9 AM to 5 PM

      if (isPeakHour) {
        adjustmentFactor *= 0.8 // Reduce limits during peak hours
      }

      const adjustedPoints = Math.max(1, Math.floor(basePoints * adjustmentFactor))

      const adaptiveLimiter = redisClient
        ? new RateLimiterRedis({
          storeClient: redisClient,
          keyPrefix: 'rl:smart',
          points: adjustedPoints,
          duration: 60,
          blockDuration: userBehavior.suspiciousScore > 50 ? 300 : 60,
        })
        : new RateLimiterMemory({
          keyPrefix: 'rl:smart',
          points: adjustedPoints,
          duration: 60,
          blockDuration: userBehavior.suspiciousScore > 50 ? 300 : 60,
        })

      await adaptiveLimiter.consume(key)

      // Set informative headers
      res.set({
        'X-RateLimit-Smart-Points': adjustedPoints.toString(),
        'X-RateLimit-Smart-Adjustment': adjustmentFactor.toString(),
        'X-RateLimit-Smart-Suspicious-Score': userBehavior.suspiciousScore.toString(),
        'X-RateLimit-Smart-Patterns': userBehavior.patterns.join(','),
      })

      next()
    } catch (error) {
      logger.warn('Smart adaptive rate limit exceeded', {
        ip: req.ip,
        endpoint: req.originalUrl,
        userAgent: req.headers['user-agent'],
      })

      throw new AppError('Smart rate limit exceeded - suspicious behavior detected', 429)
    }
  }
}

// Import prisma dynamically to avoid circular dependency
const getPrisma = async () => {
  const { prisma } = await import('../utils/database')
  return prisma
}
