import { Request, Response, NextFunction } from 'express'
import { logger } from '../utils/logger'
import { config } from '../config/config'
import os from 'os'
import { performance } from 'perf_hooks'

export interface PerformanceMetrics {
  requestCount: number
  errorCount: number
  averageResponseTime: number
  peakResponseTime: number
  activeRequests: number
  memoryUsage: ReturnType<typeof process.memoryUsage>
  cpuUsage: ReturnType<typeof process.cpuUsage>
  systemInfo: SystemInfo
  uptime: number
  timestamp: Date
}

interface SystemInfo {
  platform: string
  totalMemory: number
  freeMemory: number
  cpuCount: number
  loadAverage: number[]
}

interface RequestMetrics {
  path: string
  method: string
  statusCode: number
  responseTime: number
  timestamp: Date
}

class PerformanceMonitor {
  private requestMetrics: RequestMetrics[] = []
  private startTime: number = Date.now()
  private activeRequests: Set<string> = new Set()
  private errorCount: number = 0
  private maxMetricsHistory: number = 10000

  /**
   * Middleware to track response times
   */
  responseTimeMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!config.performance.enableResponseTime) {
        return next()
      }

      const startTime = performance.now()
      const requestId = `${req.method}:${req.path}:${Date.now()}`

      this.activeRequests.add(requestId)

      // Track response finish
      res.on('finish', () => {
        const responseTime = performance.now() - startTime

        this.activeRequests.delete(requestId)

        this.recordMetrics({
          path: req.path,
          method: req.method,
          statusCode: res.statusCode,
          responseTime,
          timestamp: new Date(),
        })

        // Set response time header
        res.setHeader('X-Response-Time', `${responseTime.toFixed(2)}ms`)

        // Log slow requests
        if (responseTime > 1000) {
          logger.warn(`Slow request detected: ${req.method} ${req.path} took ${responseTime.toFixed(2)}ms`)
        }

        // Track errors
        if (res.statusCode >= 400) {
          this.errorCount++
        }
      })

      next()
    }
  }

  /**
   * Record request metrics
   */
  private recordMetrics(metrics: RequestMetrics) {
    this.requestMetrics.push(metrics)

    // Maintain history limit
    if (this.requestMetrics.length > this.maxMetricsHistory) {
      this.requestMetrics = this.requestMetrics.slice(-this.maxMetricsHistory)
    }
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    const now = Date.now()
    const recentMetrics = this.requestMetrics.filter(
      m => now - m.timestamp.getTime() < 300000, // Last 5 minutes
    )

    const responseTimes = recentMetrics.map(m => m.responseTime)
    const averageResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0
    const peakResponseTime = responseTimes.length > 0
      ? Math.max(...responseTimes)
      : 0

    return {
      requestCount: this.requestMetrics.length,
      errorCount: this.errorCount,
      averageResponseTime: parseFloat(averageResponseTime.toFixed(2)),
      peakResponseTime: parseFloat(peakResponseTime.toFixed(2)),
      activeRequests: this.activeRequests.size,
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      systemInfo: this.getSystemInfo(),
      uptime: (now - this.startTime) / 1000, // in seconds
      timestamp: new Date(),
    }
  }

  /**
   * Get system information
   */
  private getSystemInfo(): SystemInfo {
    return {
      platform: os.platform(),
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      cpuCount: os.cpus().length,
      loadAverage: os.loadavg(),
    }
  }

  /**
   * Get endpoint-specific metrics
   */
  getEndpointMetrics(path: string, method?: string): RequestMetrics[] {
    return this.requestMetrics.filter(m => {
      const pathMatch = m.path === path || m.path.startsWith(path)
      const methodMatch = !method || m.method === method
      return pathMatch && methodMatch
    })
  }

  /**
   * Get slow queries (response time > threshold)
   */
  getSlowQueries(threshold: number = 1000): RequestMetrics[] {
    return this.requestMetrics
      .filter(m => m.responseTime > threshold)
      .sort((a, b) => b.responseTime - a.responseTime)
      .slice(0, 100) // Top 100 slowest
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.requestMetrics = []
    this.errorCount = 0
    this.startTime = Date.now()
    logger.info('Performance metrics reset')
  }

  /**
   * Get health status
   */
  getHealthStatus() {
    const metrics = this.getMetrics()
    const memoryUsagePercent = (metrics.memoryUsage.heapUsed / metrics.memoryUsage.heapTotal) * 100
    const freeMemoryPercent = (metrics.systemInfo.freeMemory / metrics.systemInfo.totalMemory) * 100

    const issues = []

    if (metrics.averageResponseTime > 500) {
      issues.push(`High average response time: ${metrics.averageResponseTime}ms`)
    }

    if (memoryUsagePercent > 90) {
      issues.push(`High memory usage: ${memoryUsagePercent.toFixed(2)}%`)
    }

    if (freeMemoryPercent < 10) {
      issues.push(`Low system memory: ${freeMemoryPercent.toFixed(2)}% free`)
    }

    if (metrics.errorCount > 100) {
      issues.push(`High error count: ${metrics.errorCount}`)
    }

    const loadAverage1Min = metrics.systemInfo.loadAverage[0]
    if (loadAverage1Min > metrics.systemInfo.cpuCount * 0.8) {
      issues.push(`High CPU load: ${loadAverage1Min.toFixed(2)}`)
    }

    return {
      status: issues.length === 0 ? 'healthy' : 'degraded',
      issues,
      metrics: {
        uptime: metrics.uptime,
        requestCount: metrics.requestCount,
        errorRate: metrics.requestCount > 0
          ? (metrics.errorCount / metrics.requestCount * 100).toFixed(2) + '%'
          : '0%',
        averageResponseTime: metrics.averageResponseTime + 'ms',
        memoryUsage: memoryUsagePercent.toFixed(2) + '%',
        systemMemory: freeMemoryPercent.toFixed(2) + '% free',
        cpuLoad: loadAverage1Min.toFixed(2),
      },
    }
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor()

// Alias for backward compatibility
export const performanceService = performanceMonitor

/**
 * Express middleware for performance monitoring
 */
export const performanceMiddleware = performanceMonitor.responseTimeMiddleware()
