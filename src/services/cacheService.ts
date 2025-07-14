import { createClient, RedisClientType } from 'redis'
import { config } from '../config/config'
import { logger } from '../utils/logger'

export interface CacheOptions {
  ttl?: number // Time to live in seconds
  tags?: string[] // Cache tags for invalidation
}

export class CacheService {
  private client: RedisClientType
  private connected: boolean = false
  private defaultTTL: number = 3600 // 1 hour default

  constructor() {
    this.client = createClient({
      url: config.redis.url || `redis://${config.redis.host}:${config.redis.port}`,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            logger.error('Redis reconnection failed after 10 attempts')
            return new Error('Too many retries')
          }
          return Math.min(retries * 100, 3000)
        },
      },
    })

    this.client.on('error', (err) => {
      logger.error('Redis Client Error:', err)
      this.connected = false
    })

    this.client.on('connect', () => {
      logger.info('Redis Client Connected')
      this.connected = true
    })

    this.client.on('disconnect', () => {
      logger.warn('Redis Client Disconnected')
      this.connected = false
    })
  }

  async connect(): Promise<void> {
    if (!this.connected) {
      await this.client.connect()
    }
  }

  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.client.quit()
    }
  }

  isConnected(): boolean {
    return this.connected
  }

  /**
   * Get a value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      if (!this.connected) {
        logger.warn('Cache not connected, skipping get operation')
        return null
      }

      const value = await this.client.get(key)
      if (!value) return null

      return JSON.parse(value) as T
    } catch (error) {
      logger.error(`Cache get error for key ${key}:`, error)
      return null
    }
  }

  /**
   * Set a value in cache
   */
  async set<T>(key: string, value: T, options?: CacheOptions): Promise<boolean> {
    try {
      if (!this.connected) {
        logger.warn('Cache not connected, skipping set operation')
        return false
      }

      const ttl = options?.ttl || this.defaultTTL
      const serialized = JSON.stringify(value)

      await this.client.setEx(key, ttl, serialized)

      // Handle tags for cache invalidation
      if (options?.tags && options.tags.length > 0) {
        for (const tag of options.tags) {
          await this.client.sAdd(`tag:${tag}`, key)
          await this.client.expire(`tag:${tag}`, ttl)
        }
      }

      return true
    } catch (error) {
      logger.error(`Cache set error for key ${key}:`, error)
      return false
    }
  }

  /**
   * Delete a value from cache
   */
  async delete(key: string): Promise<boolean> {
    try {
      if (!this.connected) return false

      const result = await this.client.del(key)
      return result > 0
    } catch (error) {
      logger.error(`Cache delete error for key ${key}:`, error)
      return false
    }
  }

  /**
   * Delete multiple values from cache
   */
  async deleteMany(keys: string[]): Promise<number> {
    try {
      if (!this.connected || keys.length === 0) return 0

      return await this.client.del(keys)
    } catch (error) {
      logger.error('Cache deleteMany error:', error)
      return 0
    }
  }

  /**
   * Invalidate cache by tags
   */
  async invalidateByTags(tags: string[]): Promise<void> {
    try {
      if (!this.connected || tags.length === 0) return

      for (const tag of tags) {
        const keys = await this.client.sMembers(`tag:${tag}`)
        if (keys.length > 0) {
          await this.deleteMany(keys)
          await this.client.del(`tag:${tag}`)
        }
      }
    } catch (error) {
      logger.error('Cache invalidateByTags error:', error)
    }
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    try {
      if (!this.connected) return

      await this.client.flushDb()
      logger.info('Cache cleared successfully')
    } catch (error) {
      logger.error('Cache clear error:', error)
    }
  }

  /**
   * Get or set cache with a callback
   */
  async getOrSet<T>(
    key: string,
    callback: () => Promise<T>,
    options?: CacheOptions,
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key)
    if (cached !== null) {
      return cached
    }

    // If not in cache, call the callback
    const value = await callback()

    // Store in cache
    await this.set(key, value, options)

    return value
  }

  /**
   * Generate cache keys with namespace
   */
  static generateKey(...parts: (string | number)[]): string {
    return parts.join(':')
  }

  /**
   * Cache key patterns for different entities
   */
  static keys = {
    product: (id: string) => CacheService.generateKey('product', id),
    productList: (params: any) => CacheService.generateKey('products', JSON.stringify(params)),
    category: (id: string) => CacheService.generateKey('category', id),
    categoryTree: () => CacheService.generateKey('categories', 'tree'),
    categoryProducts: (categoryId: string, params: any) =>
      CacheService.generateKey('category', categoryId, 'products', JSON.stringify(params)),
    search: (query: string, params: any) =>
      CacheService.generateKey('search', query, JSON.stringify(params)),
    cart: (sessionId: string) => CacheService.generateKey('cart', sessionId),
    inventory: (productId: string) => CacheService.generateKey('inventory', productId),
    pricing: (productId: string) => CacheService.generateKey('pricing', productId),
    user: (userId: string) => CacheService.generateKey('user', userId),
    session: (sessionId: string) => CacheService.generateKey('session', sessionId),
  }

  /**
   * Cache TTL presets
   */
  static ttl = {
    short: 300, // 5 minutes
    medium: 3600, // 1 hour
    long: 86400, // 24 hours
    week: 604800, // 7 days
  }

  /**
   * Cache tags for invalidation groups
   */
  static tags = {
    products: 'products',
    categories: 'categories',
    inventory: 'inventory',
    pricing: 'pricing',
    search: 'search',
    carts: 'carts',
  }
}

// Export singleton instance
export const cacheService = new CacheService()
