import { Request, Response, NextFunction } from 'express'
import { logger } from '../utils/logger'
import { auditLogService } from '../services/auditLogService'
import { logRequestBehavior } from './rateLimiter'

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now()

  // Log request
  logger.info('Incoming request', {
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    timestamp: new Date().toISOString(),
  })

  // Log request behavior for rate limiting analysis
  logRequestBehavior(req).catch(err =>
    logger.error('Failed to log request behavior', err),
  )

  // Capture errors
  let responseError: any = null
  const originalEmit = res.emit
  res.emit = function(event: string, ...args: any[]): boolean {
    if (event === 'error') {
      responseError = args[0]
    }
    return originalEmit.apply(res, [event, ...args])
  }

  // Override res.end to log response
  const originalEnd = res.end
  res.end = function(this: Response, ..._args: any[]) {
    const duration = Date.now() - start

    logger.info('Request completed', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    })

    // Log to audit system for API access
    auditLogService.logAPIAccess(req, res, duration, responseError)
      .catch(err => logger.error('Failed to log API access', err))

    return originalEnd.apply(res, _args as any)
  } as any

  next()
}
