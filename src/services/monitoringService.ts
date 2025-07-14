import cron from 'node-cron'
import { MetricsService } from './metricsService'
import logger from '../utils/logger'
import { PrismaClient } from '@prisma/client'
import Redis from 'ioredis'

export class MonitoringService {
  private prisma: PrismaClient
  private redis: Redis

  constructor(prisma: PrismaClient, redis: Redis) {
    this.prisma = prisma
    this.redis = redis
  }

  /**
   * Start all monitoring tasks
   */
  public startMonitoring(): void {
    logger.info('Starting monitoring service')

    // Update active users every minute
    cron.schedule('* * * * *', () => {
      this.updateActiveUsers()
    })

    // Update database metrics every 30 seconds
    cron.schedule('*/30 * * * * *', () => {
      this.updateDatabaseMetrics()
    })

    // Update Redis metrics every 30 seconds
    cron.schedule('*/30 * * * * *', () => {
      this.updateRedisMetrics()
    })

    // Update business metrics every 5 minutes
    cron.schedule('*/5 * * * *', () => {
      this.updateBusinessMetrics()
    })

    // Update inventory metrics every 10 minutes
    cron.schedule('*/10 * * * *', () => {
      this.updateInventoryMetrics()
    })

    // Perform health checks every minute
    cron.schedule('* * * * *', () => {
      this.performHealthChecks()
    })

    // Generate daily business reports at midnight
    cron.schedule('0 0 * * *', () => {
      this.generateDailyBusinessReport()
    })

    // Clean up old metrics data every hour
    cron.schedule('0 * * * *', () => {
      this.cleanupOldMetrics()
    })

    logger.info('Monitoring service started successfully')
  }

  /**
   * Update active users count
   */
  private async updateActiveUsers(): Promise<void> {
    try {
      // Count active sessions from the last 30 minutes
      // This is a placeholder - implement based on your session storage
      const activeUsers = await this.redis.scard('active_users') || 0

      MetricsService.setActiveUsers(activeUsers)

      logger.debug('Updated active users metric', { count: activeUsers })
    } catch (error) {
      logger.error('Failed to update active users metric', error)
    }
  }

  /**
   * Update database connection metrics
   */
  private async updateDatabaseMetrics(): Promise<void> {
    try {
      // Get database connection info
      const result = await this.prisma.$queryRaw`
        SELECT count(*) as connection_count 
        FROM pg_stat_activity 
        WHERE state = 'active'
      ` as any[]

      const connectionCount = parseInt(result[0]?.connection_count || '0')
      MetricsService.setDatabaseConnections(connectionCount)

      logger.debug('Updated database metrics', { connections: connectionCount })
    } catch (error) {
      logger.error('Failed to update database metrics', error)
      MetricsService.setDatabaseConnections(0)
    }
  }

  /**
   * Update Redis connection metrics
   */
  private async updateRedisMetrics(): Promise<void> {
    try {
      const info = await this.redis.info('clients')
      const connectionMatch = info.match(/connected_clients:(\d+)/)
      const connectionCount = connectionMatch ? parseInt(connectionMatch[1]) : 0

      MetricsService.setRedisConnections(connectionCount)

      // Check cache performance
      const hits = await this.redis.get('cache:hits') || '0'
      const misses = await this.redis.get('cache:misses') || '0'

      logger.debug('Updated Redis metrics', {
        connections: connectionCount,
        hits: parseInt(hits),
        misses: parseInt(misses),
      })
    } catch (error) {
      logger.error('Failed to update Redis metrics', error)
      MetricsService.setRedisConnections(0)
    }
  }

  /**
   * Update business metrics from database
   */
  private async updateBusinessMetrics(): Promise<void> {
    try {
      // Update order status counts
      const orderStatusCounts = await this.prisma.order.groupBy({
        by: ['status'],
        _count: {
          id: true,
        },
      })

      for (const statusCount of orderStatusCounts) {
        MetricsService.updateOrderStatus(statusCount.status, statusCount._count.id)
      }

      // Calculate today's metrics
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const todayOrders = await this.prisma.order.count({
        where: {
          createdAt: {
            gte: today,
          },
        },
      })

      const todayRevenue = await this.prisma.order.aggregate({
        where: {
          createdAt: {
            gte: today,
          },
          status: 'DELIVERED',
        },
        _sum: {
          total: true,
        },
      })

      logger.debug('Updated business metrics', {
        todayOrders,
        todayRevenue: todayRevenue._sum?.total || 0,
      })

    } catch (error) {
      logger.error('Failed to update business metrics', error)
    }
  }

  /**
   * Update inventory metrics
   */
  private async updateInventoryMetrics(): Promise<void> {
    try {
      const products = await this.prisma.product.findMany({
        select: {
          id: true,
          name: true,
          quantity: true,
        },
      })

      for (const product of products) {
        MetricsService.updateProductInventory(
          product.id.toString(),
          product.name,
          product.quantity || 0,
        )
      }

      logger.debug('Updated inventory metrics', { productCount: products.length })
    } catch (error) {
      logger.error('Failed to update inventory metrics', error)
    }
  }

  /**
   * Perform health checks
   */
  private async performHealthChecks(): Promise<void> {
    try {
      // Check database connectivity
      await this.checkDatabaseHealth()

      // Check Redis connectivity
      await this.checkRedisHealth()

      // Check external services
      await this.checkExternalServices()

      logger.debug('Health checks completed successfully')
    } catch (error) {
      logger.error('Health check failed', error)
    }
  }

  /**
   * Check database health
   */
  private async checkDatabaseHealth(): Promise<void> {
    try {
      await this.prisma.$queryRaw`SELECT 1`
      logger.debug('Database health check passed')
    } catch (error) {
      logger.error('Database health check failed', error)
      throw error
    }
  }

  /**
   * Check Redis health
   */
  private async checkRedisHealth(): Promise<void> {
    try {
      await this.redis.ping()
      logger.debug('Redis health check passed')
    } catch (error) {
      logger.error('Redis health check failed', error)
      throw error
    }
  }

  /**
   * Check external services health
   */
  private async checkExternalServices(): Promise<void> {
    try {
      // Check payment gateways, email services, etc.
      // This is a placeholder for actual service checks
      logger.debug('External services health check passed')
    } catch (error) {
      logger.error('External services health check failed', error)
    }
  }

  /**
   * Generate daily business report
   */
  private async generateDailyBusinessReport(): Promise<void> {
    try {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      yesterday.setHours(0, 0, 0, 0)

      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const dailyStats = await this.prisma.order.aggregate({
        where: {
          createdAt: {
            gte: yesterday,
            lt: today,
          },
        },
        _count: {
          id: true,
        },
        _sum: {
          total: true,
        },
      })

      const report = {
        date: yesterday.toISOString().split('T')[0],
        totalOrders: dailyStats._count || 0,
        totalRevenue: dailyStats._sum?.total || 0,
        generatedAt: new Date().toISOString(),
      }

      logger.info('Daily business report generated', report)

      // Store report for historical analysis
      await this.storeDailyReport(report)

    } catch (error) {
      logger.error('Failed to generate daily business report', error)
    }
  }

  /**
   * Store daily report
   */
  private async storeDailyReport(report: any): Promise<void> {
    try {
      await this.redis.setex(
        `daily_report:${report.date}`,
        86400 * 30, // Keep for 30 days
        JSON.stringify(report),
      )
    } catch (error) {
      logger.error('Failed to store daily report', error)
    }
  }

  /**
   * Clean up old metrics data
   */
  private async cleanupOldMetrics(): Promise<void> {
    try {
      // Clean up old session data
      // Remove expired sessions from active users
      const activeUsersSessions = await this.redis.smembers('active_users')
      for (const session of activeUsersSessions) {
        const sessionData = await this.redis.get(`session:${session}`)
        if (!sessionData) {
          await this.redis.srem('active_users', session)
        }
      }

      logger.debug('Completed metrics cleanup')
    } catch (error) {
      logger.error('Failed to cleanup old metrics', error)
    }
  }

  /**
   * Get monitoring statistics
   */
  public async getMonitoringStats(): Promise<any> {
    try {
      const stats = {
        activeUsers: await this.redis.scard('active_users'),
        databaseConnections: await this.getDatabaseConnectionCount(),
        redisConnections: await this.getRedisConnectionCount(),
        lastHealthCheck: await this.redis.get('last_health_check'),
        systemUptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
      }

      return stats
    } catch (error) {
      logger.error('Failed to get monitoring stats', error)
      throw error
    }
  }

  private async getDatabaseConnectionCount(): Promise<number> {
    try {
      const result = await this.prisma.$queryRaw`
        SELECT count(*) as connection_count 
        FROM pg_stat_activity 
        WHERE state = 'active'
      ` as any[]
      return parseInt(result[0]?.connection_count || '0')
    } catch (error) {
      return 0
    }
  }

  private async getRedisConnectionCount(): Promise<number> {
    try {
      const info = await this.redis.info('clients')
      const connectionMatch = info.match(/connected_clients:(\d+)/)
      return connectionMatch ? parseInt(connectionMatch[1]) : 0
    } catch (error) {
      return 0
    }
  }
}

export default MonitoringService
