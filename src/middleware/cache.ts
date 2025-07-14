import { Request, Response, NextFunction } from 'express'
import { cacheService, CacheService, CacheOptions } from '../services/cacheService'
import { logger } from '../utils/logger'
import crypto from 'crypto'

export interface CacheMiddlewareOptions extends CacheOptions {
  keyGenerator?: (_req: Request) => string
  condition?: (_req: Request) => boolean
  varyBy?: string[] // Headers to vary cache by
}

/**
 * Cache middleware for GET requests
 */
export function cache(options: CacheMiddlewareOptions = {}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next()
    }

    // Check condition if provided
    if (options.condition && !options.condition(req)) {
      return next()
    }

    // Generate cache key
    const cacheKey = options.keyGenerator
      ? options.keyGenerator(req)
      : generateDefaultCacheKey(req, options.varyBy)

    try {
      // Try to get from cache
      const cached = await cacheService.get<CachedResponse>(cacheKey)

      if (cached) {
        logger.debug(`Cache hit for key: ${cacheKey}`)

        // Set cached headers
        res.set(cached.headers)
        res.set('X-Cache', 'HIT')
        res.set('X-Cache-Key', cacheKey)

        return res.status(cached.statusCode).json(cached.data)
      }

      logger.debug(`Cache miss for key: ${cacheKey}`)

      // Store original send method
      const originalSend = res.json.bind(res)

      // Override json method to cache the response
      res.json = function(data: any) {
        // Only cache successful responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const cachedResponse: CachedResponse = {
            statusCode: res.statusCode,
            headers: getRelevantHeaders(res),
            data: data,
            timestamp: new Date().toISOString(),
          }

          // Cache asynchronously
          cacheService.set(cacheKey, cachedResponse, options)
            .catch(err => logger.error('Failed to cache response:', err))
        }

        res.set('X-Cache', 'MISS')
        res.set('X-Cache-Key', cacheKey)

        return originalSend(data)
      }

      next()
    } catch (error) {
      logger.error('Cache middleware error:', error)
      next()
    }
  }
}

/**
 * Cache invalidation middleware
 */
export function invalidateCache(tags: string[] | ((_req: Request) => string[])) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const tagsToInvalidate = typeof tags === 'function' ? tags(req) : tags

      if (tagsToInvalidate.length > 0) {
        await cacheService.invalidateByTags(tagsToInvalidate)
        logger.info(`Invalidated cache tags: ${tagsToInvalidate.join(', ')}`)
      }
    } catch (error) {
      logger.error('Cache invalidation error:', error)
    }

    next()
  }
}

/**
 * Specific cache middleware for product endpoints
 */
export const cacheProduct = cache({
  ttl: CacheService.ttl.medium,
  tags: [CacheService.tags.products],
  keyGenerator: (req) => CacheService.keys.product(req.params.id),
})

/**
 * Specific cache middleware for product list endpoints
 */
export const cacheProductList = cache({
  ttl: CacheService.ttl.short,
  tags: [CacheService.tags.products],
  keyGenerator: (req) => CacheService.keys.productList(req.query),
})

/**
 * Specific cache middleware for category endpoints
 */
export const cacheCategory = cache({
  ttl: CacheService.ttl.long,
  tags: [CacheService.tags.categories],
  keyGenerator: (req) => CacheService.keys.category(req.params.id),
})

/**
 * Specific cache middleware for category tree
 */
export const cacheCategoryTree = cache({
  ttl: CacheService.ttl.long,
  tags: [CacheService.tags.categories],
  keyGenerator: () => CacheService.keys.categoryTree(),
})

/**
 * Specific cache middleware for search endpoints
 */
export const cacheSearch = cache({
  ttl: CacheService.ttl.short,
  tags: [CacheService.tags.search],
  keyGenerator: (req) => CacheService.keys.search(
    req.query.q as string || '',
    req.query,
  ),
})

/**
 * Helper function to generate default cache key
 */
function generateDefaultCacheKey(req: Request, varyBy?: string[]): string {
  const parts = [
    req.method,
    req.originalUrl || req.url,
  ]

  // Add vary headers
  if (varyBy && varyBy.length > 0) {
    const varyValues = varyBy.map(header =>
      `${header}:${req.headers[header.toLowerCase()] || ''}`,
    )
    parts.push(...varyValues)
  }

  // Generate hash for consistent key length
  const hash = crypto
    .createHash('md5')
    .update(parts.join('|'))
    .digest('hex')

  return `cache:${hash}`
}

/**
 * Helper function to get relevant headers for caching
 */
function getRelevantHeaders(res: Response): Record<string, string> {
  const headers: Record<string, string> = {}
  const relevantHeaders = [
    'content-type',
    'cache-control',
    'etag',
    'last-modified',
  ]

  relevantHeaders.forEach(header => {
    const value = res.get(header)
    if (value) {
      headers[header] = value
    }
  })

  return headers
}

/**
 * Interface for cached response
 */
interface CachedResponse {
  statusCode: number
  headers: Record<string, string>
  data: any
  timestamp: string
}
