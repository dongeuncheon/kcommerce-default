import client from 'prom-client'

// Create a Registry which registers the metrics
export const register = new client.Registry()

// Add a default label which is added to all metrics
register.setDefaultLabels({
  app: 'commerce-plugin',
})

// Enable the collection of default metrics
client.collectDefaultMetrics({ register })

// Custom metrics
export const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'path', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 5, 10],
})

export const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'path', 'status'],
})

export const activeUsers = new client.Gauge({
  name: 'active_users_total',
  help: 'Number of currently active users',
})

export const databaseConnections = new client.Gauge({
  name: 'database_connections_active',
  help: 'Number of active database connections',
})

export const redisConnections = new client.Gauge({
  name: 'redis_connections_active',
  help: 'Number of active Redis connections',
})

// Business metrics
export const ordersCompleted = new client.Counter({
  name: 'orders_completed_total',
  help: 'Total number of completed orders',
})

export const ordersCreated = new client.Counter({
  name: 'orders_created_total',
  help: 'Total number of created orders',
})

export const ordersByStatus = new client.Gauge({
  name: 'orders_by_status_total',
  help: 'Number of orders by status',
  labelNames: ['status'],
})

export const cartCreated = new client.Counter({
  name: 'cart_created_total',
  help: 'Total number of carts created',
})

export const cartAbandoned = new client.Counter({
  name: 'cart_abandoned_total',
  help: 'Total number of abandoned carts',
})

export const revenue = new client.Counter({
  name: 'revenue_total',
  help: 'Total revenue generated',
})

export const productRevenue = new client.Counter({
  name: 'product_revenue_total',
  help: 'Revenue by product',
  labelNames: ['product_id', 'product_name'],
})

export const paymentAttempts = new client.Counter({
  name: 'payment_attempts_total',
  help: 'Total number of payment attempts',
  labelNames: ['gateway', 'method'],
})

export const paymentSuccess = new client.Counter({
  name: 'payment_success_total',
  help: 'Total number of successful payments',
  labelNames: ['gateway', 'method'],
})

export const paymentFailures = new client.Counter({
  name: 'payment_failures_total',
  help: 'Total number of failed payments',
  labelNames: ['gateway', 'method', 'error_code'],
})

export const userRegistrations = new client.Counter({
  name: 'user_registrations_total',
  help: 'Total number of user registrations',
})

export const userLogins = new client.Counter({
  name: 'user_logins_total',
  help: 'Total number of user logins',
})

export const sessionCreated = new client.Counter({
  name: 'session_created_total',
  help: 'Total number of sessions created',
})

export const sessionTimeouts = new client.Counter({
  name: 'session_timeouts_total',
  help: 'Total number of session timeouts',
})

export const searchRequests = new client.Counter({
  name: 'search_requests_total',
  help: 'Total number of search requests',
})

export const searchNoResults = new client.Counter({
  name: 'search_no_results_total',
  help: 'Total number of searches with no results',
})

export const productInventoryLevel = new client.Gauge({
  name: 'product_inventory_level',
  help: 'Current inventory level for products',
  labelNames: ['product_id', 'product_name'],
})

export const apiErrors = new client.Counter({
  name: 'api_errors_total',
  help: 'Total number of API errors',
  labelNames: ['endpoint', 'error_type', 'status_code'],
})

export const cacheHits = new client.Counter({
  name: 'cache_hits_total',
  help: 'Total number of cache hits',
  labelNames: ['cache_type'],
})

export const cacheMisses = new client.Counter({
  name: 'cache_misses_total',
  help: 'Total number of cache misses',
  labelNames: ['cache_type'],
})

export const emailsSent = new client.Counter({
  name: 'emails_sent_total',
  help: 'Total number of emails sent',
  labelNames: ['type', 'status'],
})

export const webhookEvents = new client.Counter({
  name: 'webhook_events_total',
  help: 'Total number of webhook events',
  labelNames: ['event_type', 'status'],
})

// Register all metrics
register.registerMetric(httpRequestDuration)
register.registerMetric(httpRequestsTotal)
register.registerMetric(activeUsers)
register.registerMetric(databaseConnections)
register.registerMetric(redisConnections)
register.registerMetric(ordersCompleted)
register.registerMetric(ordersCreated)
register.registerMetric(ordersByStatus)
register.registerMetric(cartCreated)
register.registerMetric(cartAbandoned)
register.registerMetric(revenue)
register.registerMetric(productRevenue)
register.registerMetric(paymentAttempts)
register.registerMetric(paymentSuccess)
register.registerMetric(paymentFailures)
register.registerMetric(userRegistrations)
register.registerMetric(userLogins)
register.registerMetric(sessionCreated)
register.registerMetric(sessionTimeouts)
register.registerMetric(searchRequests)
register.registerMetric(searchNoResults)
register.registerMetric(productInventoryLevel)
register.registerMetric(apiErrors)
register.registerMetric(cacheHits)
register.registerMetric(cacheMisses)
register.registerMetric(emailsSent)
register.registerMetric(webhookEvents)

// Metrics collection functions
export class MetricsService {
  static recordHttpRequest(method: string, path: string, statusCode: number, duration: number) {
    httpRequestsTotal.inc({ method, path, status: statusCode.toString() })
    httpRequestDuration.observe({ method, path, status_code: statusCode.toString() }, duration)
  }

  static recordOrderCompleted(_orderId: string, amount: number) {
    ordersCompleted.inc()
    revenue.inc(amount)
  }

  static recordOrderCreated() {
    ordersCreated.inc()
  }

  static updateOrderStatus(status: string, count: number) {
    ordersByStatus.set({ status }, count)
  }

  static recordCartCreated() {
    cartCreated.inc()
  }

  static recordCartAbandoned() {
    cartAbandoned.inc()
  }

  static recordProductRevenue(productId: string, productName: string, amount: number) {
    productRevenue.inc({ product_id: productId, product_name: productName }, amount)
  }

  static recordPaymentAttempt(gateway: string, method: string) {
    paymentAttempts.inc({ gateway, method })
  }

  static recordPaymentSuccess(gateway: string, method: string) {
    paymentSuccess.inc({ gateway, method })
  }

  static recordPaymentFailure(gateway: string, method: string, errorCode: string) {
    paymentFailures.inc({ gateway, method, error_code: errorCode })
  }

  static recordUserRegistration() {
    userRegistrations.inc()
  }

  static recordUserLogin() {
    userLogins.inc()
  }

  static recordSessionCreated() {
    sessionCreated.inc()
  }

  static recordSessionTimeout() {
    sessionTimeouts.inc()
  }

  static recordSearchRequest() {
    searchRequests.inc()
  }

  static recordSearchNoResults() {
    searchNoResults.inc()
  }

  static updateProductInventory(productId: string, productName: string, level: number) {
    productInventoryLevel.set({ product_id: productId, product_name: productName }, level)
  }

  static recordApiError(endpoint: string, errorType: string, statusCode: number) {
    apiErrors.inc({ endpoint, error_type: errorType, status_code: statusCode.toString() })
  }

  static recordCacheHit(cacheType: string) {
    cacheHits.inc({ cache_type: cacheType })
  }

  static recordCacheMiss(cacheType: string) {
    cacheMisses.inc({ cache_type: cacheType })
  }

  static recordEmailSent(type: string, status: string) {
    emailsSent.inc({ type, status })
  }

  static recordWebhookEvent(eventType: string, status: string) {
    webhookEvents.inc({ event_type: eventType, status })
  }

  static setActiveUsers(count: number) {
    activeUsers.set(count)
  }

  static setDatabaseConnections(count: number) {
    databaseConnections.set(count)
  }

  static setRedisConnections(count: number) {
    redisConnections.set(count)
  }

  // Health check metrics
  static async getHealthMetrics() {
    try {
      const metrics = await register.metrics()
      return metrics
    } catch (error) {
      throw new Error(`Failed to get metrics: ${error}`)
    }
  }

  // Business metrics endpoint
  static async getBusinessMetrics() {
    try {
      const businessRegistry = new client.Registry()

      // Only register business-related metrics
      businessRegistry.registerMetric(ordersCompleted)
      businessRegistry.registerMetric(ordersCreated)
      businessRegistry.registerMetric(ordersByStatus)
      businessRegistry.registerMetric(cartCreated)
      businessRegistry.registerMetric(cartAbandoned)
      businessRegistry.registerMetric(revenue)
      businessRegistry.registerMetric(productRevenue)
      businessRegistry.registerMetric(paymentAttempts)
      businessRegistry.registerMetric(paymentSuccess)
      businessRegistry.registerMetric(paymentFailures)
      businessRegistry.registerMetric(userRegistrations)
      businessRegistry.registerMetric(userLogins)
      businessRegistry.registerMetric(searchRequests)
      businessRegistry.registerMetric(searchNoResults)
      businessRegistry.registerMetric(productInventoryLevel)

      const metrics = await businessRegistry.metrics()
      return metrics
    } catch (error) {
      throw new Error(`Failed to get business metrics: ${error}`)
    }
  }
}

export default MetricsService
