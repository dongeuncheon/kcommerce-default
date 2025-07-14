import { Request, Response, NextFunction } from 'express'
import { logger } from '../utils/logger'
import { AppError } from './error'

export interface CircuitBreakerConfig {
  failureThreshold: number
  resetTimeout: number
  monitoringPeriod: number
  name: string
}

export enum CircuitBreakerState {
  // eslint-disable-next-line no-unused-vars
  CLOSED = 'CLOSED',
  // eslint-disable-next-line no-unused-vars
  OPEN = 'OPEN',
  // eslint-disable-next-line no-unused-vars
  HALF_OPEN = 'HALF_OPEN'
}

export class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED
  private failureCount: number = 0
  private lastFailureTime?: number
  private successCount: number = 0
  private config: CircuitBreakerConfig

  constructor(config: CircuitBreakerConfig) {
    this.config = config
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitBreakerState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitBreakerState.HALF_OPEN
        this.successCount = 0
        logger.info(`Circuit breaker ${this.config.name} moving to HALF_OPEN state`)
      } else {
        throw new AppError(`Circuit breaker ${this.config.name} is OPEN`, 503)
      }
    }

    try {
      const result = await operation()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }

  private onSuccess(): void {
    this.failureCount = 0
    this.successCount++

    if (this.state === CircuitBreakerState.HALF_OPEN && this.successCount >= 3) {
      this.state = CircuitBreakerState.CLOSED
      this.successCount = 0
      logger.info(`Circuit breaker ${this.config.name} moving to CLOSED state`)
    }
  }

  private onFailure(): void {
    this.failureCount++
    this.lastFailureTime = Date.now()

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.state = CircuitBreakerState.OPEN
      logger.warn(`Circuit breaker ${this.config.name} moving to OPEN state from HALF_OPEN`)
    } else if (this.failureCount >= this.config.failureThreshold) {
      this.state = CircuitBreakerState.OPEN
      logger.warn(`Circuit breaker ${this.config.name} moving to OPEN state`, {
        failureCount: this.failureCount,
        threshold: this.config.failureThreshold,
      })
    }
  }

  private shouldAttemptReset(): boolean {
    return Boolean(
      this.lastFailureTime &&
      Date.now() - this.lastFailureTime >= this.config.resetTimeout,
    )
  }

  getState(): CircuitBreakerState {
    return this.state
  }

  getMetrics() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      name: this.config.name,
    }
  }

  reset(): void {
    this.state = CircuitBreakerState.CLOSED
    this.failureCount = 0
    this.successCount = 0
    this.lastFailureTime = undefined
    logger.info(`Circuit breaker ${this.config.name} manually reset`)
  }
}

// Circuit breaker instances for different services
export const circuitBreakers = {
  database: new CircuitBreaker({
    name: 'database',
    failureThreshold: 5,
    resetTimeout: 60000, // 1 minute
    monitoringPeriod: 10000, // 10 seconds
  }),

  payment: new CircuitBreaker({
    name: 'payment',
    failureThreshold: 3,
    resetTimeout: 30000, // 30 seconds
    monitoringPeriod: 5000, // 5 seconds
  }),

  external_api: new CircuitBreaker({
    name: 'external_api',
    failureThreshold: 10,
    resetTimeout: 120000, // 2 minutes
    monitoringPeriod: 15000, // 15 seconds
  }),

  email: new CircuitBreaker({
    name: 'email',
    failureThreshold: 5,
    resetTimeout: 60000, // 1 minute
    monitoringPeriod: 10000, // 10 seconds
  }),
}

/**
 * Circuit breaker middleware for protecting external service calls
 */
export const circuitBreakerMiddleware = (breakerName: keyof typeof circuitBreakers) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const breaker = circuitBreakers[breakerName]

    if (breaker.getState() === CircuitBreakerState.OPEN) {
      logger.warn(`Circuit breaker ${breakerName} is OPEN, rejecting request`, {
        endpoint: req.originalUrl,
        method: req.method,
      })

      res.status(503).json({
        success: false,
        error: {
          type: 'ServiceUnavailable',
          message: `${breakerName} service is temporarily unavailable`,
          retryAfter: '60',
        },
      })
      return
    }

    // Store breaker in request for use in route handlers
    (req as any).circuitBreaker = breaker
    next()
  }
}

/**
 * Get all circuit breaker metrics
 */
export const getCircuitBreakerMetrics = () => {
  return Object.fromEntries(
    Object.entries(circuitBreakers).map(([name, breaker]) => [
      name,
      breaker.getMetrics(),
    ]),
  )
}

/**
 * Reset all circuit breakers
 */
export const resetAllCircuitBreakers = () => {
  Object.values(circuitBreakers).forEach(breaker => breaker.reset())
  logger.info('All circuit breakers reset')
}

/**
 * Reset specific circuit breaker
 */
export const resetCircuitBreaker = (name: keyof typeof circuitBreakers) => {
  circuitBreakers[name].reset()
  logger.info(`Circuit breaker ${name} reset`)
}
