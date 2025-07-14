# Performance Optimization Guide

## Overview

This document outlines the comprehensive performance optimization techniques implemented in the Commerce Plugin to ensure fast response times and scalability.

## Performance Targets

- **Product List API**: < 100ms response time
- **Product Detail API**: < 50ms response time
- **Search API**: < 200ms response time
- **Static Assets**: CDN delivered with aggressive caching
- **Database Queries**: Optimized with proper indexes
- **Cache Hit Rate**: > 80% for frequently accessed data

## Implemented Optimizations

### 1. Redis Caching Layer

#### Cache Service (`src/services/cacheService.ts`)
- Distributed caching with Redis
- Automatic cache key generation
- TTL-based expiration
- Tag-based invalidation
- Cache warming strategies

#### Cache Middleware (`src/middleware/cache.ts`)
- Automatic response caching
- Cache key generation based on request parameters
- Cache headers (X-Cache: HIT/MISS)
- Conditional caching support

#### Cached Endpoints
```typescript
// Product endpoints with caching
router.get('/products', cacheProductList, handler)
router.get('/products/:id', cacheProduct, handler)
router.get('/categories', cacheCategoryTree, handler)
```

### 2. Database Performance

#### Query Optimization (`src/services/queryOptimizationService.ts`)
- Automatic index creation for common queries
- Connection pooling configuration
- Query result caching
- Optimized query patterns

#### Database Indexes
```sql
-- Product indexes
CREATE INDEX idx_products_slug ON "Product"(slug);
CREATE INDEX idx_products_status ON "Product"(status);
CREATE INDEX idx_products_price ON "Product"(price);
CREATE INDEX idx_products_composite ON "Product"(status, "categoryId", price);

-- Full-text search indexes
CREATE INDEX idx_products_name_trgm ON "Product" USING gin(name gin_trgm_ops);
CREATE INDEX idx_products_description_trgm ON "Product" USING gin(description gin_trgm_ops);
```

#### Connection Pooling
```typescript
// Prisma configuration
datasources:
  db:
    provider: "postgresql"
    url: DATABASE_URL
    connectionLimit: 10
```

### 3. Response Compression

#### Compression Middleware (`src/middleware/compression.ts`)
- Gzip compression for text-based responses
- Brotli compression for better ratios
- Threshold-based compression (> 1KB)
- Content-type specific compression

#### Configuration
```typescript
compression({
  level: 6, // Compression level (0-9)
  threshold: 1024, // Minimum size to compress
  filter: (req, res) => {
    // Custom filter logic
  }
})
```

### 4. CDN Integration

#### CDN Service (`src/services/cdnService.ts`)
- Automatic URL rewriting for static assets
- Image transformation support
- Responsive image generation
- Cache purging capabilities

#### CDN Headers
```typescript
// Aggressive caching for static assets
'Cache-Control': 'public, max-age=31536000, immutable' // 1 year
'Vary': 'Accept-Encoding'
```

### 5. Load Balancing

#### Nginx Configuration (`nginx.conf`)
- Least connections load balancing
- Health check endpoints
- Request rate limiting
- Static file serving
- WebSocket support

#### PM2 Clustering (`ecosystem.config.js`)
- Multi-process clustering
- Automatic restart on failure
- Memory limit monitoring
- Zero-downtime deployment

### 6. Performance Monitoring

#### Performance Service (`src/services/performanceService.ts`)
- Response time tracking
- Memory usage monitoring
- Request metrics collection
- Slow query identification

#### Health Endpoints
- `/health` - Overall system health
- `/health/performance` - Performance metrics
- `/health/cache` - Cache statistics
- `/health/database` - Database metrics
- `/health/slow-queries` - Slow query analysis

## Configuration

### Environment Variables

```bash
# Redis Configuration
REDIS_URL=redis://localhost:6379

# Performance Settings
ENABLE_COMPRESSION=true
COMPRESSION_LEVEL=6
ENABLE_CACHING=true
CACHE_DEFAULT_TTL=3600
ENABLE_RESPONSE_TIME=true

# Database Performance
DB_POOL_MIN=2
DB_POOL_MAX=10
DB_QUERY_TIMEOUT=30000
DB_ENABLE_QUERY_LOGGING=false

# CDN Configuration
CDN_ENABLED=true
CDN_URL=https://cdn.example.com
CDN_ASSETS=images,videos,documents

# Monitoring
MONITORING_ENABLED=true
METRICS_PORT=9090
```

### Performance Tuning

#### Cache TTL Configuration
```typescript
CacheService.ttl = {
  short: 300,    // 5 minutes
  medium: 3600,  // 1 hour
  long: 86400,   // 24 hours
  week: 604800,  // 7 days
}
```

#### Rate Limiting
```typescript
// Different zones for different endpoints
limit_req_zone api_limit rate=100r/s;
limit_req_zone search_limit rate=20r/s;
limit_req_zone checkout_limit rate=5r/s;
```

## Monitoring and Metrics

### Key Performance Indicators (KPIs)

1. **Response Time Metrics**
   - Average response time
   - 95th percentile response time
   - Peak response time

2. **Cache Metrics**
   - Cache hit rate
   - Cache miss rate
   - Cache size

3. **Database Metrics**
   - Query execution time
   - Connection pool usage
   - Slow query count

4. **System Metrics**
   - CPU usage
   - Memory usage
   - Request rate
   - Error rate

### Performance Testing

Run performance tests:
```bash
npm run test:performance
```

Load testing with Artillery:
```bash
artillery run tests/load/products.yml
```

## Best Practices

### 1. Cache Strategy
- Cache frequently accessed data
- Use appropriate TTL values
- Implement cache warming for critical data
- Monitor cache hit rates

### 2. Database Optimization
- Use proper indexes
- Avoid N+1 queries
- Use connection pooling
- Monitor slow queries

### 3. API Design
- Implement pagination
- Use field selection
- Batch operations when possible
- Implement request throttling

### 4. Static Assets
- Use CDN for images and static files
- Implement responsive images
- Use WebP format when supported
- Enable browser caching

### 5. Monitoring
- Set up alerts for performance degradation
- Monitor error rates
- Track response times
- Review slow query logs

## Troubleshooting

### High Response Times
1. Check cache hit rates
2. Review slow query logs
3. Monitor CPU and memory usage
4. Check network latency

### Memory Issues
1. Review memory usage patterns
2. Check for memory leaks
3. Adjust Node.js heap size
4. Monitor garbage collection

### Database Performance
1. Run EXPLAIN ANALYZE on slow queries
2. Check index usage
3. Review connection pool settings
4. Monitor lock contention

## Future Optimizations

1. **GraphQL DataLoader** - Batch and cache database queries
2. **Edge Computing** - Deploy to edge locations
3. **Service Worker** - Client-side caching
4. **HTTP/3** - Improved protocol performance
5. **Database Sharding** - Horizontal scaling