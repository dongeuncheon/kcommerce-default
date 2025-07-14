import { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'
import { Prisma } from '@prisma/client'
import { logger } from '../utils/logger'
import { config } from '../config/config'
import { circuitBreakers } from './circuitBreaker'

export interface ErrorResponse {
  success: false
  error: {
    type: string
    message: string
    code?: string
    details?: any
    timestamp?: string
    requestId?: string
    documentation?: string
    stack?: string
  }
}

export interface ErrorMetrics {
  totalErrors: number
  errorsByType: Record<string, number>
  errorsByEndpoint: Record<string, number>
  recentErrors: Array<{
    timestamp: string
    type: string
    message: string
    endpoint: string
    statusCode: number
  }>
}

// Error classification
export enum ErrorCategory {
  // eslint-disable-next-line no-unused-vars
  VALIDATION = 'VALIDATION',
  // eslint-disable-next-line no-unused-vars
  AUTHENTICATION = 'AUTHENTICATION',
  // eslint-disable-next-line no-unused-vars
  AUTHORIZATION = 'AUTHORIZATION',
  // eslint-disable-next-line no-unused-vars
  NOT_FOUND = 'NOT_FOUND',
  // eslint-disable-next-line no-unused-vars
  CONFLICT = 'CONFLICT',
  // eslint-disable-next-line no-unused-vars
  RATE_LIMIT = 'RATE_LIMIT',
  // eslint-disable-next-line no-unused-vars
  DATABASE = 'DATABASE',
  // eslint-disable-next-line no-unused-vars
  EXTERNAL_SERVICE = 'EXTERNAL_SERVICE',
  // eslint-disable-next-line no-unused-vars
  BUSINESS_LOGIC = 'BUSINESS_LOGIC',
  // eslint-disable-next-line no-unused-vars
  SYSTEM = 'SYSTEM',
  // eslint-disable-next-line no-unused-vars
  SECURITY = 'SECURITY',
  // eslint-disable-next-line no-unused-vars
  NETWORK = 'NETWORK'
}

// Error codes for better client handling
export const ERROR_CODES = {
  // Validation errors
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_FIELD: 'MISSING_FIELD',
  INVALID_FORMAT: 'INVALID_FORMAT',

  // Authentication errors
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',

  // Authorization errors
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  ACCESS_DENIED: 'ACCESS_DENIED',

  // Business logic errors
  PRODUCT_OUT_OF_STOCK: 'PRODUCT_OUT_OF_STOCK',
  INVALID_QUANTITY: 'INVALID_QUANTITY',
  PAYMENT_FAILED: 'PAYMENT_FAILED',

  // System errors
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',

  // Rate limiting
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',

  // Security
  SUSPICIOUS_ACTIVITY: 'SUSPICIOUS_ACTIVITY',
  CSRF_TOKEN_MISSING: 'CSRF_TOKEN_MISSING',
  IP_BLOCKED: 'IP_BLOCKED',
} as const

// Error metrics tracking
let errorMetrics: ErrorMetrics = {
  totalErrors: 0,
  errorsByType: {},
  errorsByEndpoint: {},
  recentErrors: [],
}

export interface ApiError extends Error {
  statusCode?: number
  isOperational?: boolean
}

export class AppError extends Error implements ApiError {
  public readonly statusCode: number
  public readonly isOperational: boolean
  public readonly code?: string
  public readonly category?: ErrorCategory
  public readonly details?: any
  public readonly documentationUrl?: string

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    code?: string,
    category?: ErrorCategory,
    details?: any,
    documentationUrl?: string,
  ) {
    super(message)
    this.statusCode = statusCode
    this.isOperational = isOperational
    this.code = code
    this.category = category
    this.details = details
    this.documentationUrl = documentationUrl

    Error.captureStackTrace(this, this.constructor)
  }
}

/**
 * Enhanced error factory functions
 */
export const createValidationError = (message: string, details?: any): AppError => {
  return new AppError(
    message,
    400,
    true,
    ERROR_CODES.INVALID_INPUT,
    ErrorCategory.VALIDATION,
    details,
    '/docs/errors#validation',
  )
}

export const createAuthenticationError = (message: string = 'Authentication required', code?: string): AppError => {
  return new AppError(
    message,
    401,
    true,
    code || ERROR_CODES.INVALID_CREDENTIALS,
    ErrorCategory.AUTHENTICATION,
    undefined,
    '/docs/errors#authentication',
  )
}

export const createAuthorizationError = (message: string = 'Insufficient permissions'): AppError => {
  return new AppError(
    message,
    403,
    true,
    ERROR_CODES.INSUFFICIENT_PERMISSIONS,
    ErrorCategory.AUTHORIZATION,
    undefined,
    '/docs/errors#authorization',
  )
}

export const createNotFoundError = (resource: string = 'Resource'): AppError => {
  return new AppError(
    `${resource} not found`,
    404,
    true,
    'NOT_FOUND',
    ErrorCategory.NOT_FOUND,
    { resource },
    '/docs/errors#not-found',
  )
}

export const createConflictError = (message: string, details?: any): AppError => {
  return new AppError(
    message,
    409,
    true,
    'CONFLICT',
    ErrorCategory.CONFLICT,
    details,
    '/docs/errors#conflict',
  )
}

export const createRateLimitError = (message: string = 'Rate limit exceeded', details?: any): AppError => {
  return new AppError(
    message,
    429,
    true,
    ERROR_CODES.RATE_LIMIT_EXCEEDED,
    ErrorCategory.RATE_LIMIT,
    details,
    '/docs/errors#rate-limiting',
  )
}

export const createSystemError = (message: string = 'Internal system error', code?: string): AppError => {
  return new AppError(
    message,
    500,
    false,
    code || 'SYSTEM_ERROR',
    ErrorCategory.SYSTEM,
    undefined,
    '/docs/errors#system',
  )
}

export const createError = (message: string, statusCode: number = 500): AppError => {
  return new AppError(message, statusCode)
}

/**
 * Track error metrics
 */
function trackErrorMetrics(error: ApiError, endpoint: string): void {
  errorMetrics.totalErrors++

  const errorType = error.name || 'Unknown'
  errorMetrics.errorsByType[errorType] = (errorMetrics.errorsByType[errorType] || 0) + 1
  errorMetrics.errorsByEndpoint[endpoint] = (errorMetrics.errorsByEndpoint[endpoint] || 0) + 1

  // Keep only recent 100 errors
  errorMetrics.recentErrors.unshift({
    timestamp: new Date().toISOString(),
    type: errorType,
    message: error.message,
    endpoint,
    statusCode: error.statusCode || 500,
  })

  if (errorMetrics.recentErrors.length > 100) {
    errorMetrics.recentErrors = errorMetrics.recentErrors.slice(0, 100)
  }
}

/**
 * Enhanced error handler with comprehensive error classification and response formatting
 */
export const errorHandler = (
  err: Error | ApiError | ZodError | Prisma.PrismaClientKnownRequestError,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  const requestId = (req as any).id || generateRequestId()
  const isDevelopment = config.nodeEnv === 'development'
  const isProduction = config.nodeEnv === 'production'

  let error: AppError

  // Handle specific error types with enhanced classification
  if (err instanceof ZodError) {
    const validationErrors = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
      code: e.code,
      received: (e as any).received,
    }))

    error = createValidationError('Invalid input data', validationErrors)

    // Track validation errors for circuit breaker
    if (validationErrors.length > 10) {
      logger.warn('Excessive validation errors - possible attack', {
        ip: req.ip,
        endpoint: req.originalUrl,
        errorCount: validationErrors.length,
        userAgent: req.headers['user-agent'],
      })
    }
  }
  else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
    case 'P2002': {
      const duplicateField = err.meta?.target || 'unknown field'
      error = createConflictError(
        `A record with this ${duplicateField} already exists`,
        { field: duplicateField, value: err.meta?.target },
      )
      break
    }
    case 'P2025': {
      error = createNotFoundError('Record')
      break
    }
    case 'P2003': {
      error = createValidationError(
        'Foreign key constraint failed',
        { constraint: err.meta?.field_name },
      )
      break
    }
    case 'P2014': {
      error = createValidationError(
        'Invalid relation data',
        { relation: err.meta?.relation_name },
      )
      break
    }
    case 'P2021': {
      error = createSystemError('Database table does not exist', ERROR_CODES.DATABASE_ERROR)
      break
    }
    case 'P2024': {
      error = createSystemError('Connection timeout', ERROR_CODES.DATABASE_ERROR)
      break
    }
    default: {
      error = createSystemError(
        `Database operation failed: ${err.message}`,
        ERROR_CODES.DATABASE_ERROR,
      )

      // Trigger database circuit breaker on unknown errors
      circuitBreakers.database.execute(() => Promise.reject(err)).catch(() => {})
      break
    }
    }
  }
  else if (err instanceof AppError) {
    error = err
  }
  else if (err.name === 'JsonWebTokenError') {
    error = createAuthenticationError('Invalid token', ERROR_CODES.TOKEN_INVALID)
  }
  else if (err.name === 'TokenExpiredError') {
    error = createAuthenticationError('Token expired', ERROR_CODES.TOKEN_EXPIRED)
  }
  else if (err.name === 'MulterError') {
    if (err.message.includes('File too large')) {
      error = createValidationError('File too large', { maxSize: config.upload.maxFileSize })
    } else if (err.message.includes('Unexpected field')) {
      error = createValidationError('Invalid file field', { allowedFields: ['image', 'document'] })
    } else {
      error = createValidationError(`File upload error: ${err.message}`)
    }
  }
  else if (err.name === 'PaymentError') {
    error = new AppError(
      err.message,
      402,
      true,
      ERROR_CODES.PAYMENT_FAILED,
      ErrorCategory.BUSINESS_LOGIC,
      undefined,
      '/docs/errors#payment',
    )
  }
  else if (err.message.includes('ECONNREFUSED') || err.message.includes('ETIMEDOUT')) {
    error = new AppError(
      'External service unavailable',
      503,
      true,
      ERROR_CODES.EXTERNAL_SERVICE_ERROR,
      ErrorCategory.EXTERNAL_SERVICE,
      { originalError: err.message },
      '/docs/errors#external-services',
    )
  }
  else {
    // Unknown error - classify as system error
    error = createSystemError(
      isProduction ? 'An unexpected error occurred' : err.message,
      'UNKNOWN_ERROR',
    )
  }

  // Track error metrics
  trackErrorMetrics(error, req.originalUrl)

  // Enhanced logging with context
  const logContext = {
    requestId,
    errorId: generateErrorId(),
    type: error.name,
    code: error.code,
    category: error.category,
    message: error.message,
    statusCode: error.statusCode,
    isOperational: error.isOperational,
    stack: err.stack,
    request: {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      userId: (req as any).user?.id,
      sessionId: (req as any).session?.id,
    },
    ...(isDevelopment && {
      body: req.body,
      params: req.params,
      query: req.query,
      headers: req.headers,
    }),
  }

  // Log based on error severity
  if (error.statusCode >= 500) {
    logger.error('System error occurred', logContext)

    // Report critical errors to external monitoring (if configured)
    if (config.monitoring.errorReportingUrl) {
      reportErrorToExternalService(error, logContext).catch(reportErr => {
        logger.error('Failed to report error to external service', reportErr)
      })
    }
  } else if (error.statusCode >= 400) {
    logger.warn('Client error occurred', logContext)
  } else {
    logger.info('Error handled', logContext)
  }

  // Build comprehensive error response
  const errorResponse: ErrorResponse = {
    success: false,
    error: {
      type: error.name,
      message: error.message,
      code: error.code,
      timestamp: new Date().toISOString(),
      requestId,
      ...(error.details && { details: error.details }),
      ...(error.documentationUrl && { documentation: error.documentationUrl }),
      ...(isDevelopment && error.stack && { stack: error.stack }),
    },
  }

  // Add retry information for specific error types
  if (error.statusCode === 429) {
    res.setHeader('Retry-After', '60')
    errorResponse.error.details = {
      ...errorResponse.error.details,
      retryAfter: 60,
      retryStrategy: 'exponential_backoff',
    }
  }

  if (error.statusCode === 503) {
    res.setHeader('Retry-After', '30')
    errorResponse.error.details = {
      ...errorResponse.error.details,
      retryAfter: 30,
      retryStrategy: 'linear_backoff',
    }
  }

  // Send error response
  res.status(error.statusCode).json(errorResponse)
}

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Generate unique error ID for tracking
 */
function generateErrorId(): string {
  return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Report error to external monitoring service
 */
async function reportErrorToExternalService(_error: AppError, _context: any): Promise<void> {
  try {
    if (!config.monitoring.errorReportingUrl) return

    // const errorReport = {
    //   error: {
    //     type: error.name,
    //     message: error.message,
    //     code: error.code,
    //     category: error.category,
    //     statusCode: error.statusCode,
    //     stack: error.stack,
    //   },
    //   context,
    //   environment: config.nodeEnv,
    //   timestamp: new Date().toISOString(),
    //   service: 'commerce-api',
    // }

    // In a real implementation, you would send this to your monitoring service
    // await fetch(config.monitoring.errorReportingUrl, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(errorReport)
    // })

    logger.debug('Error reported to external service', { errorId: _context.errorId })
  } catch (reportError) {
    logger.error('Failed to report error to external service', reportError)
  }
}

export const notFoundHandler = (req: Request, res: Response): void => {
  const message = `Route ${req.originalUrl} not found`
  logger.warn(`404 - ${message}`)

  res.status(404).json({
    success: false,
    error: {
      type: 'NotFoundError',
      message,
    },
  })
}

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}

/**
 * Get error metrics for monitoring dashboard
 */
export const getErrorMetrics = (): ErrorMetrics => {
  return { ...errorMetrics }
}

/**
 * Reset error metrics (useful for testing or periodic resets)
 */
export const resetErrorMetrics = (): void => {
  errorMetrics = {
    totalErrors: 0,
    errorsByType: {},
    errorsByEndpoint: {},
    recentErrors: [],
  }
  logger.info('Error metrics reset')
}

/**
 * Get error statistics summary
 */
export const getErrorStatistics = () => {
  const now = Date.now()
  const oneHourAgo = now - (60 * 60 * 1000)
  const oneDayAgo = now - (24 * 60 * 60 * 1000)

  const recentErrors = errorMetrics.recentErrors
  const errorsLastHour = recentErrors.filter(e =>
    new Date(e.timestamp).getTime() > oneHourAgo,
  )
  const errorsLastDay = recentErrors.filter(e =>
    new Date(e.timestamp).getTime() > oneDayAgo,
  )

  const criticalErrors = recentErrors.filter(e => e.statusCode >= 500)
  const clientErrors = recentErrors.filter(e => e.statusCode >= 400 && e.statusCode < 500)

  return {
    total: errorMetrics.totalErrors,
    lastHour: errorsLastHour.length,
    lastDay: errorsLastDay.length,
    critical: criticalErrors.length,
    client: clientErrors.length,
    topErrorTypes: Object.entries(errorMetrics.errorsByType)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([type, count]) => ({ type, count })),
    topErrorEndpoints: Object.entries(errorMetrics.errorsByEndpoint)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([endpoint, count]) => ({ endpoint, count })),
    errorRate: {
      hourly: errorsLastHour.length,
      daily: errorsLastDay.length / 24,
      critical: criticalErrors.length / Math.max(1, errorMetrics.totalErrors),
    },
  }
}

/**
 * Request ID middleware - adds unique ID to each request
 */
export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const requestId = generateRequestId()
  ;(req as any).id = requestId
  res.setHeader('X-Request-ID', requestId)
  next()
}

/**
 * Error boundary for async operations with circuit breaker integration
 */
export const withErrorBoundary = async <T>(
  operation: () => Promise<T>,
  context: {
    operationName: string
    circuitBreaker?: keyof typeof circuitBreakers
    fallback?: () => Promise<T>
  },
): Promise<T> => {
  try {
    let result: T

    if (context.circuitBreaker) {
      const breaker = circuitBreakers[context.circuitBreaker]
      result = await breaker.execute(operation)
    } else {
      result = await operation()
    }

    return result
  } catch (error) {
    logger.error(`Error in ${context.operationName}`, {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      operationName: context.operationName,
      circuitBreaker: context.circuitBreaker,
    })

    if (context.fallback) {
      try {
        const fallbackResult = await context.fallback()
        logger.info(`Fallback executed successfully for ${context.operationName}`)
        return fallbackResult
      } catch (fallbackError) {
        logger.error(`Fallback failed for ${context.operationName}`, fallbackError)
        throw fallbackError
      }
    } else {
      throw error
    }
  }
}

/**
 * Validation middleware with enhanced error messages
 */
export const validateRequest = (schema: any, property: 'body' | 'query' | 'params' = 'body') => {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const validatedData = schema.parse(req[property])
      req[property] = validatedData
      next()
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = createValidationError(
          `Invalid ${property} data`,
          error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
            code: e.code,
            received: (e as any).received,
            expected: (e as any).expected,
          })),
        )
        next(validationError)
      } else {
        next(createSystemError('Validation system error'))
      }
    }
  }
}
