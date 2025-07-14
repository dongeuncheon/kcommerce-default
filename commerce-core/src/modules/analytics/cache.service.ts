import { CacheService } from '../../core/services/cache.service';
import { LoggerService } from '../../core/services/logger.service';
import { AnalyticsCacheConfig } from './analytics.types';

export interface CacheStats {
  totalKeys: number;
  memoryUsage: number;
  hitRate: number;
  missRate: number;
  averageResponseTime: number;
  topKeys: Array<{
    key: string;
    hits: number;
    lastAccessed: Date;
    size: number;
  }>;
  keysByPattern: Record<string, number>;
}

export interface CacheWarmupConfig {
  patterns: string[];
  priority: 'high' | 'medium' | 'low';
  schedule?: {
    enabled: boolean;
    cron: string;
    timezone?: string;
  };
}

export class AnalyticsCacheService {
  private readonly CACHE_PATTERNS = {
    DASHBOARD: 'analytics:dashboard:*',
    SALES: 'analytics:sales:*',
    PRODUCTS: 'analytics:products:*',
    CUSTOMERS: 'analytics:customers:*',
    ORDERS: 'analytics:orders:*',
    PAYMENTS: 'analytics:payments:*',
    REAL_TIME: 'analytics:realtime:*',
    REPORTS: 'analytics:reports:*'
  };

  private readonly CACHE_CONFIGS: Record<string, AnalyticsCacheConfig> = {
    dashboard_metrics: {
      ttl: 60, // 1 minute for real-time data
      key: 'dashboard:metrics',
      invalidationTriggers: ['new_order', 'payment_completed', 'inventory_update']
    },
    sales_analytics: {
      ttl: 300, // 5 minutes
      key: 'analytics:sales',
      invalidationTriggers: ['new_sale', 'refund_processed']
    },
    product_analytics: {
      ttl: 600, // 10 minutes
      key: 'analytics:products',
      invalidationTriggers: ['product_viewed', 'product_purchased', 'inventory_update']
    },
    customer_analytics: {
      ttl: 900, // 15 minutes
      key: 'analytics:customers',
      invalidationTriggers: ['customer_registered', 'customer_updated']
    },
    korean_payment_analytics: {
      ttl: 300, // 5 minutes
      key: 'analytics:korean_payments',
      invalidationTriggers: ['payment_completed', 'payment_failed']
    },
    holiday_impact: {
      ttl: 3600, // 1 hour
      key: 'analytics:korean_holidays',
      invalidationTriggers: ['holiday_config_updated']
    }
  };

  private warmupInterval?: NodeJS.Timeout;
  private readonly WARMUP_INTERVAL = 300000; // 5 minutes

  constructor(
    private readonly cacheService: CacheService,
    private readonly logger: LoggerService
  ) {}

  // ================== BASIC CACHE OPERATIONS ==================

  async get<T>(key: string): Promise<T | null> {
    try {
      const startTime = Date.now();
      const result = await this.cacheService.get<T>(key);
      const duration = Date.now() - startTime;

      this.logger.debug('Cache get operation', { 
        key, 
        hit: result !== null, 
        duration 
      });

      return result;
      
    } catch (error) {
      this.logger.error('Cache get failed', { error, key });
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      const startTime = Date.now();
      
      // Use configured TTL if available
      const config = this.getCacheConfig(key);
      const finalTtl = ttl || config?.ttl || 300;
      
      await this.cacheService.set(key, value, finalTtl);
      
      const duration = Date.now() - startTime;
      
      this.logger.debug('Cache set operation', { 
        key, 
        ttl: finalTtl, 
        duration,
        size: this.estimateSize(value)
      });
      
    } catch (error) {
      this.logger.error('Cache set failed', { error, key });
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.cacheService.delete(key);
      this.logger.debug('Cache delete operation', { key });
      
    } catch (error) {
      this.logger.error('Cache delete failed', { error, key });
    }
  }

  async deletePattern(pattern: string): Promise<void> {
    try {
      await this.cacheService.deletePattern(pattern);
      this.logger.info('Cache pattern deleted', { pattern });
      
    } catch (error) {
      this.logger.error('Cache pattern delete failed', { error, pattern });
    }
  }

  // ================== ANALYTICS-SPECIFIC CACHE OPERATIONS ==================

  async cacheAnalyticsData(
    type: string, 
    params: Record<string, any>, 
    data: any, 
    ttl?: number
  ): Promise<void> {
    try {
      const cacheKey = this.generateAnalyticsCacheKey(type, params);
      await this.set(cacheKey, data, ttl);
      
      // Track cache operation
      await this.trackCacheOperation('set', cacheKey, true);
      
    } catch (error) {
      this.logger.error('Failed to cache analytics data', { error, type, params });
    }
  }

  async getAnalyticsData<T>(
    type: string, 
    params: Record<string, any>
  ): Promise<T | null> {
    try {
      const cacheKey = this.generateAnalyticsCacheKey(type, params);
      const result = await this.get<T>(cacheKey);
      
      // Track cache operation
      await this.trackCacheOperation('get', cacheKey, result !== null);
      
      return result;
      
    } catch (error) {
      this.logger.error('Failed to get analytics data from cache', { error, type, params });
      return null;
    }
  }

  async invalidateAnalyticsCache(trigger: string): Promise<void> {
    try {
      this.logger.info('Invalidating analytics cache', { trigger });

      // Find all cache configs that should be invalidated by this trigger
      const patternsToInvalidate: string[] = [];
      
      for (const [configName, config] of Object.entries(this.CACHE_CONFIGS)) {
        if (config.invalidationTriggers.includes(trigger)) {
          patternsToInvalidate.push(`${config.key}:*`);
        }
      }

      // Invalidate cache patterns
      for (const pattern of patternsToInvalidate) {
        await this.deletePattern(pattern);
      }

      this.logger.info('Analytics cache invalidated', { 
        trigger, 
        patternsInvalidated: patternsToInvalidate.length 
      });
      
    } catch (error) {
      this.logger.error('Failed to invalidate analytics cache', { error, trigger });
    }
  }

  // ================== CACHE WARMING ==================

  async warmCache(): Promise<void> {
    try {
      this.logger.info('Starting cache warming');

      const warmupTasks = [
        this.warmDashboardCache(),
        this.warmSalesCache(),
        this.warmProductCache(),
        this.warmCustomerCache(),
        this.warmKoreanAnalyticsCache()
      ];

      await Promise.allSettled(warmupTasks);
      
      this.logger.info('Cache warming completed');
      
    } catch (error) {
      this.logger.error('Cache warming failed', { error });
    }
  }

  async startWarming(): Promise<void> {
    try {
      if (this.warmupInterval) {
        clearInterval(this.warmupInterval);
      }

      // Initial warm-up
      await this.warmCache();

      // Schedule periodic warm-up
      this.warmupInterval = setInterval(async () => {
        try {
          await this.warmCache();
        } catch (error) {
          this.logger.error('Scheduled cache warming failed', { error });
        }
      }, this.WARMUP_INTERVAL);

      this.logger.info('Cache warming started', { 
        interval: this.WARMUP_INTERVAL 
      });
      
    } catch (error) {
      this.logger.error('Failed to start cache warming', { error });
    }
  }

  async stopWarming(): Promise<void> {
    try {
      if (this.warmupInterval) {
        clearInterval(this.warmupInterval);
        this.warmupInterval = undefined;
      }

      this.logger.info('Cache warming stopped');
      
    } catch (error) {
      this.logger.error('Failed to stop cache warming', { error });
    }
  }

  // ================== CACHE STATISTICS ==================

  async getStats(): Promise<CacheStats> {
    try {
      // Mock cache statistics (in real implementation, get from Redis/cache provider)
      const stats: CacheStats = {
        totalKeys: 450,
        memoryUsage: 125000000, // 125MB
        hitRate: 0.87,
        missRate: 0.13,
        averageResponseTime: 2.3, // milliseconds
        topKeys: [
          {
            key: 'dashboard:metrics',
            hits: 2450,
            lastAccessed: new Date(),
            size: 15000
          },
          {
            key: 'analytics:sales:daily',
            hits: 1890,
            lastAccessed: new Date(Date.now() - 60000),
            size: 25000
          },
          {
            key: 'analytics:products:top',
            hits: 1340,
            lastAccessed: new Date(Date.now() - 120000),
            size: 18000
          }
        ],
        keysByPattern: {
          'analytics:dashboard:*': 45,
          'analytics:sales:*': 125,
          'analytics:products:*': 89,
          'analytics:customers:*': 67,
          'analytics:payments:*': 34,
          'analytics:realtime:*': 23,
          'analytics:reports:*': 67
        }
      };

      return stats;
      
    } catch (error) {
      this.logger.error('Failed to get cache stats', { error });
      throw error;
    }
  }

  async getCacheHealth(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    metrics: Record<string, any>;
    recommendations: string[];
  }> {
    try {
      const stats = await this.getStats();
      
      let status: 'healthy' | 'warning' | 'critical' = 'healthy';
      const recommendations: string[] = [];

      // Check hit rate
      if (stats.hitRate < 0.5) {
        status = 'critical';
        recommendations.push('Cache hit rate is very low. Consider increasing TTL or improving cache strategy.');
      } else if (stats.hitRate < 0.7) {
        status = 'warning';
        recommendations.push('Cache hit rate could be improved. Review cache patterns and TTL settings.');
      }

      // Check memory usage (assuming 200MB limit)
      if (stats.memoryUsage > 180000000) {
        status = 'critical';
        recommendations.push('Cache memory usage is very high. Consider reducing TTL or implementing LRU eviction.');
      } else if (stats.memoryUsage > 150000000) {
        if (status === 'healthy') status = 'warning';
        recommendations.push('Cache memory usage is high. Monitor for potential memory issues.');
      }

      // Check response time
      if (stats.averageResponseTime > 10) {
        status = 'critical';
        recommendations.push('Cache response time is too high. Check cache server performance.');
      } else if (stats.averageResponseTime > 5) {
        if (status === 'healthy') status = 'warning';
        recommendations.push('Cache response time is elevated. Monitor cache server load.');
      }

      return {
        status,
        metrics: {
          hitRate: stats.hitRate,
          memoryUsageMB: Math.round(stats.memoryUsage / 1024 / 1024),
          responseTimeMs: stats.averageResponseTime,
          totalKeys: stats.totalKeys
        },
        recommendations
      };
      
    } catch (error) {
      this.logger.error('Failed to get cache health', { error });
      return {
        status: 'critical',
        metrics: {},
        recommendations: ['Unable to retrieve cache health metrics']
      };
    }
  }

  // ================== CACHE OPTIMIZATION ==================

  async optimizeCache(): Promise<void> {
    try {
      this.logger.info('Starting cache optimization');

      // Remove expired keys
      await this.cleanupExpiredKeys();
      
      // Optimize frequently accessed data
      await this.optimizeHotKeys();
      
      // Adjust TTL for low-hit keys
      await this.adjustTTLForLowHitKeys();

      this.logger.info('Cache optimization completed');
      
    } catch (error) {
      this.logger.error('Cache optimization failed', { error });
    }
  }

  async clearAllCache(): Promise<void> {
    try {
      this.logger.warn('Clearing all analytics cache');

      for (const pattern of Object.values(this.CACHE_PATTERNS)) {
        await this.deletePattern(pattern);
      }

      this.logger.info('All analytics cache cleared');
      
    } catch (error) {
      this.logger.error('Failed to clear all cache', { error });
    }
  }

  // ================== SPECIALIZED CACHE WARMING ==================

  private async warmDashboardCache(): Promise<void> {
    try {
      // Warm up common dashboard queries
      const commonQueries = [
        { type: 'dashboard', params: {} },
        { type: 'realtime', params: {} },
        { type: 'kpis', params: {} }
      ];

      for (const query of commonQueries) {
        const cacheKey = this.generateAnalyticsCacheKey(query.type, query.params);
        
        // Check if already cached
        const cached = await this.get(cacheKey);
        if (!cached) {
          // In real implementation, fetch and cache the data
          this.logger.debug('Warming dashboard cache', { cacheKey });
        }
      }
      
    } catch (error) {
      this.logger.error('Failed to warm dashboard cache', { error });
    }
  }

  private async warmSalesCache(): Promise<void> {
    try {
      const commonPeriods = [
        { startDate: '2024-01-01', endDate: '2024-01-31', granularity: 'day' },
        { startDate: '2024-01-01', endDate: '2024-12-31', granularity: 'month' }
      ];

      for (const period of commonPeriods) {
        const cacheKey = this.generateAnalyticsCacheKey('sales', period);
        const cached = await this.get(cacheKey);
        
        if (!cached) {
          this.logger.debug('Warming sales cache', { cacheKey, period });
        }
      }
      
    } catch (error) {
      this.logger.error('Failed to warm sales cache', { error });
    }
  }

  private async warmProductCache(): Promise<void> {
    try {
      const cacheKey = this.generateAnalyticsCacheKey('products', { limit: 50 });
      const cached = await this.get(cacheKey);
      
      if (!cached) {
        this.logger.debug('Warming product cache', { cacheKey });
      }
      
    } catch (error) {
      this.logger.error('Failed to warm product cache', { error });
    }
  }

  private async warmCustomerCache(): Promise<void> {
    try {
      const cacheKey = this.generateAnalyticsCacheKey('customers', {});
      const cached = await this.get(cacheKey);
      
      if (!cached) {
        this.logger.debug('Warming customer cache', { cacheKey });
      }
      
    } catch (error) {
      this.logger.error('Failed to warm customer cache', { error });
    }
  }

  private async warmKoreanAnalyticsCache(): Promise<void> {
    try {
      const koreanQueries = [
        { type: 'korean_payments', params: {} },
        { type: 'korean_holidays', params: {} },
        { type: 'korean_shopping_patterns', params: {} }
      ];

      for (const query of koreanQueries) {
        const cacheKey = this.generateAnalyticsCacheKey(query.type, query.params);
        const cached = await this.get(cacheKey);
        
        if (!cached) {
          this.logger.debug('Warming Korean analytics cache', { cacheKey });
        }
      }
      
    } catch (error) {
      this.logger.error('Failed to warm Korean analytics cache', { error });
    }
  }

  // ================== CACHE MAINTENANCE ==================

  private async cleanupExpiredKeys(): Promise<void> {
    try {
      // In real implementation, scan for and remove expired keys
      this.logger.debug('Cleaning up expired cache keys');
      
    } catch (error) {
      this.logger.error('Failed to cleanup expired keys', { error });
    }
  }

  private async optimizeHotKeys(): Promise<void> {
    try {
      const stats = await this.getStats();
      
      // Extend TTL for frequently accessed keys
      for (const hotKey of stats.topKeys) {
        if (hotKey.hits > 1000) {
          // In real implementation, extend TTL for hot keys
          this.logger.debug('Optimizing hot key', { 
            key: hotKey.key, 
            hits: hotKey.hits 
          });
        }
      }
      
    } catch (error) {
      this.logger.error('Failed to optimize hot keys', { error });
    }
  }

  private async adjustTTLForLowHitKeys(): Promise<void> {
    try {
      // In real implementation, reduce TTL for keys with low hit rates
      this.logger.debug('Adjusting TTL for low-hit keys');
      
    } catch (error) {
      this.logger.error('Failed to adjust TTL for low-hit keys', { error });
    }
  }

  // ================== HELPER METHODS ==================

  private generateAnalyticsCacheKey(type: string, params: Record<string, any>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((result, key) => {
        result[key] = params[key];
        return result;
      }, {} as Record<string, any>);
    
    const paramString = Object.keys(sortedParams).length > 0 
      ? `:${Buffer.from(JSON.stringify(sortedParams)).toString('base64')}`
      : '';
    
    return `analytics:${type}${paramString}`;
  }

  private getCacheConfig(key: string): AnalyticsCacheConfig | null {
    for (const [configName, config] of Object.entries(this.CACHE_CONFIGS)) {
      if (key.includes(config.key)) {
        return config;
      }
    }
    return null;
  }

  private estimateSize(value: any): number {
    try {
      return Buffer.byteLength(JSON.stringify(value), 'utf8');
    } catch {
      return 0;
    }
  }

  private async trackCacheOperation(
    operation: 'get' | 'set' | 'delete', 
    key: string, 
    success: boolean
  ): Promise<void> {
    try {
      // In real implementation, track cache operations for analytics
      this.logger.debug('Cache operation tracked', { 
        operation, 
        key: key.substring(0, 50) + '...', 
        success 
      });
      
    } catch (error) {
      this.logger.error('Failed to track cache operation', { error });
    }
  }

  // ================== CLEANUP ==================

  async destroy(): Promise<void> {
    try {
      await this.stopWarming();
      this.logger.info('Analytics cache service destroyed');
      
    } catch (error) {
      this.logger.error('Failed to destroy analytics cache service', { error });
    }
  }
}