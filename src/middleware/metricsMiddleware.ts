import { Request, Response, NextFunction } from 'express'
import { MetricsService } from '../services/metricsService'
import { logger } from '../utils/logger'

export interface MetricsRequest extends Request {
  startTime?: number;
}

export const metricsMiddleware = (req: MetricsRequest, res: Response, next: NextFunction) => {
  // Record the start time
  req.startTime = Date.now()

  // Override the end method to capture metrics
  const originalEnd = res.end
  res.end = function(this: Response, ..._args: any[]) {
    // Calculate duration
    const duration = (Date.now() - (req.startTime || Date.now())) / 1000

    // Clean up the path for metrics (remove IDs and query params)
    const cleanPath = req.path
      .replace(/\/\d+/g, '/:id')
      .replace(/\?.*/, '')
      .toLowerCase()

    // Record the HTTP request metrics
    MetricsService.recordHttpRequest(
      req.method,
      cleanPath,
      res.statusCode,
      duration,
    )

    // Record API errors if status code indicates an error
    if (res.statusCode >= 400) {
      const errorType = res.statusCode >= 500 ? 'server_error' : 'client_error'
      MetricsService.recordApiError(cleanPath, errorType, res.statusCode)
    }

    // Call the original end method
    return originalEnd.apply(res, _args as any)
  } as any

  next()
}

export const businessMetricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Track specific business events based on the endpoint
  const originalJson = res.json

  res.json = function(data?: any) {
    try {
      // Track business metrics based on the endpoint and response
      if (req.method === 'POST' && req.path.includes('/orders') && res.statusCode === 201) {
        MetricsService.recordOrderCreated()
        if (data?.amount) {
          MetricsService.recordOrderCompleted(data.id, data.amount)
        }
      }

      if (req.method === 'POST' && req.path.includes('/cart') && res.statusCode === 201) {
        MetricsService.recordCartCreated()
      }

      if (req.method === 'POST' && req.path.includes('/users/register') && res.statusCode === 201) {
        MetricsService.recordUserRegistration()
      }

      if (req.method === 'POST' && req.path.includes('/users/login') && res.statusCode === 200) {
        MetricsService.recordUserLogin()
      }

      if (req.method === 'POST' && req.path.includes('/search') && res.statusCode === 200) {
        MetricsService.recordSearchRequest()
        if (data?.results?.length === 0) {
          MetricsService.recordSearchNoResults()
        }
      }

      if (req.method === 'POST' && req.path.includes('/payment') && res.statusCode === 200) {
        const gateway = req.body?.gateway || 'unknown'
        const method = req.body?.method || 'unknown'
        MetricsService.recordPaymentAttempt(gateway, method)

        if (data?.status === 'success') {
          MetricsService.recordPaymentSuccess(gateway, method)
        } else if (data?.status === 'failed') {
          MetricsService.recordPaymentFailure(gateway, method, data?.errorCode || 'unknown')
        }
      }
    } catch (error) {
      logger.error('Error recording business metrics:', error)
    }

    // Call the original json method
    return originalJson.call(this, data)
  }

  next()
}

export default { metricsMiddleware, businessMetricsMiddleware }
