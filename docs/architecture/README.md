# System Architecture

The NewTravel Commerce Plugin is designed as a modern, scalable, and maintainable e-commerce system built with enterprise-grade architecture patterns.

## Table of Contents

- [Overview](#overview)
- [Architecture Principles](#architecture-principles)
- [System Components](#system-components)
- [Data Architecture](#data-architecture)
- [API Architecture](#api-architecture)
- [Security Architecture](#security-architecture)
- [Performance Architecture](#performance-architecture)
- [Deployment Architecture](#deployment-architecture)
- [Scalability Considerations](#scalability-considerations)

## Overview

The system follows a **layered architecture** pattern with clear separation of concerns, making it maintainable, testable, and scalable.

```
┌─────────────────────────────────────────────────────────────┐
│                    Client Applications                       │
│  (Web Apps, Mobile Apps, Third-party Integrations)        │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                     API Gateway                             │
│  (Rate Limiting, Authentication, Load Balancing)           │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                  Application Layer                          │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │
│  │   Routes    │ │ Controllers │ │ Middleware  │          │
│  └─────────────┘ └─────────────┘ └─────────────┘          │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                   Business Layer                            │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │
│  │  Services   │ │ Validators  │ │   Utilities │          │
│  └─────────────┘ └─────────────┘ └─────────────┘          │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                    Data Layer                               │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │
│  │   Prisma    │ │    Redis    │ │ File Storage│          │
│  │ (PostgreSQL)│ │   (Cache)   │ │   (AWS S3)  │          │
│  └─────────────┘ └─────────────┘ └─────────────┘          │
└─────────────────────────────────────────────────────────────┘
```

## Architecture Principles

### 1. **Separation of Concerns**
Each layer has a specific responsibility:
- **Routes**: Handle HTTP requests and responses
- **Controllers**: Orchestrate business logic
- **Services**: Implement business rules
- **Models**: Define data structures and validation
- **Utilities**: Provide common functionality

### 2. **Dependency Inversion**
High-level modules don't depend on low-level modules. Both depend on abstractions.

### 3. **Single Responsibility**
Each module has one reason to change.

### 4. **Open/Closed Principle**
Open for extension, closed for modification.

### 5. **Interface Segregation**
Clients should not depend on interfaces they don't use.

### 6. **Don't Repeat Yourself (DRY)**
Common functionality is abstracted into reusable modules.

## System Components

### Core Application Components

```
src/
├── api/
│   ├── controllers/     # Handle HTTP requests
│   └── routes/         # Define API endpoints
├── services/           # Business logic implementation
├── middleware/         # Request processing pipeline
├── types/             # TypeScript type definitions
├── utils/             # Common utilities
├── config/            # Configuration management
└── index.ts           # Application entry point
```

### Infrastructure Components

```
├── prisma/            # Database schema and migrations
├── docker/            # Container configurations
├── scripts/           # Build and deployment scripts
├── tests/             # Test suites
└── docs/              # Documentation
```

### External Dependencies

```
┌─────────────────────────────────────────────────────────────┐
│                   External Services                         │
├─────────────────────────────────────────────────────────────┤
│ Payment Gateways    │ Stripe, PayPal, Square               │
│ File Storage        │ AWS S3, Google Cloud Storage         │
│ Email Service       │ SendGrid, Mailgun                    │
│ Monitoring          │ Datadog, New Relic                   │
│ Error Tracking      │ Sentry, Rollbar                      │
└─────────────────────────────────────────────────────────────┘
```

## Data Architecture

### Database Design

The system uses **PostgreSQL** as the primary database with **Prisma** as the ORM.

#### Core Entities

```sql
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Products   │    │ Categories  │    │  Customers  │
├─────────────┤    ├─────────────┤    ├─────────────┤
│ id          │    │ id          │    │ id          │
│ name        │    │ name        │    │ email       │
│ sku         │◄──►│ slug        │    │ firstName   │
│ price       │    │ description │    │ lastName    │
│ category_id │────┤ parent_id   │    │ phone       │
│ status      │    │ isActive    │    │ addresses   │
└─────────────┘    └─────────────┘    └─────────────┘
       │                                     │
       ▼                                     ▼
┌─────────────┐                    ┌─────────────┐
│ Cart Items  │                    │   Orders    │
├─────────────┤                    ├─────────────┤
│ id          │                    │ id          │
│ cart_id     │                    │ customer_id │────┐
│ product_id  │────────────────────┤ status      │    │
│ quantity    │                    │ total       │    │
│ price       │                    │ created_at  │    │
└─────────────┘                    └─────────────┘    │
                                           │           │
                                           ▼           ▼
                                  ┌─────────────┐ ┌─────────────┐
                                  │Order Items  │ │  Payments   │
                                  ├─────────────┤ ├─────────────┤
                                  │ id          │ │ id          │
                                  │ order_id    │ │ order_id    │
                                  │ product_id  │ │ amount      │
                                  │ quantity    │ │ gateway     │
                                  │ price       │ │ status      │
                                  └─────────────┘ └─────────────┘
```

#### Database Features

- **ACID Compliance**: Full transactional support
- **Indexes**: Optimized for common queries
- **Constraints**: Data integrity enforcement
- **Triggers**: Automated business logic
- **Views**: Simplified data access

### Caching Strategy

**Redis** is used for multiple caching scenarios:

```
┌─────────────────────────────────────────────────────────────┐
│                     Redis Cache Layers                      │
├─────────────────────────────────────────────────────────────┤
│ Session Store       │ User sessions and cart data          │
│ Query Cache         │ Frequently accessed data             │
│ Rate Limiting       │ Request throttling counters          │
│ WebSocket Store     │ Real-time connection management      │
│ Background Jobs     │ Task queue and job management        │
└─────────────────────────────────────────────────────────────┘
```

### File Storage

**Multi-provider** file storage system:

```typescript
interface StorageProvider {
  upload(file: File, path: string): Promise<string>
  delete(path: string): Promise<void>
  getUrl(path: string): string
}

// Implementations
- LocalStorageProvider    // For development
- S3StorageProvider      // For production
- GCSStorageProvider     // Alternative cloud provider
```

## API Architecture

### RESTful Design

The API follows REST principles with consistent patterns:

```
Resource-based URLs:
GET    /api/v1/products           # List products
POST   /api/v1/products           # Create product
GET    /api/v1/products/{id}      # Get product
PUT    /api/v1/products/{id}      # Update product
DELETE /api/v1/products/{id}      # Delete product

Nested resources:
GET    /api/v1/products/{id}/variants
POST   /api/v1/products/{id}/variants
```

### API Versioning

**URL-based versioning** with backward compatibility:

```
/api/v1/products    # Current stable version
/api/v2/products    # Next version (beta)
```

### Request/Response Format

**Consistent JSON structure**:

```typescript
// Success Response
interface ApiResponse<T> {
  data: T
  meta?: PaginationMeta
  success: true
}

// Error Response
interface ApiError {
  error: {
    code: string
    message: string
    details?: string
    timestamp: string
    requestId: string
  }
}
```

### Middleware Stack

**Comprehensive middleware pipeline**:

```typescript
// Request processing pipeline
app.use(requestIdMiddleware)        // Unique request ID
app.use(securityMiddleware)         // Security headers
app.use(rateLimitMiddleware)        // Rate limiting
app.use(authenticationMiddleware)   // Authentication
app.use(validationMiddleware)       // Input validation
app.use(loggingMiddleware)         // Request logging
app.use(compressionMiddleware)      // Response compression
```

## Security Architecture

### Authentication & Authorization

**Multi-layer security approach**:

```
┌─────────────────────────────────────────────────────────────┐
│                   Security Layers                           │
├─────────────────────────────────────────────────────────────┤
│ Transport Security  │ HTTPS, TLS 1.3                       │
│ API Gateway         │ Rate limiting, IP filtering           │
│ Authentication      │ JWT tokens, Session cookies           │
│ Authorization       │ Role-based access control             │
│ Input Validation    │ Schema validation, sanitization       │
│ Data Protection     │ Encryption at rest, PII handling      │
└─────────────────────────────────────────────────────────────┘
```

### Security Features

1. **Helmet.js** - Security headers
2. **CORS** - Cross-origin resource sharing
3. **CSRF Protection** - Cross-site request forgery prevention
4. **Rate Limiting** - DDoS protection
5. **Input Sanitization** - XSS prevention
6. **SQL Injection Prevention** - Parameterized queries
7. **Password Hashing** - bcrypt with salt rounds
8. **JWT Security** - Short-lived tokens with refresh

### Data Encryption

```typescript
// Encryption strategy
interface EncryptionConfig {
  algorithm: 'aes-256-gcm'
  keyDerivation: 'pbkdf2'
  iterations: 100000
  saltLength: 32
  ivLength: 16
}

// Encrypted fields
- Customer PII data
- Payment information
- API keys and secrets
```

## Performance Architecture

### Optimization Strategies

```
┌─────────────────────────────────────────────────────────────┐
│                  Performance Layers                         │
├─────────────────────────────────────────────────────────────┤
│ CDN                 │ Static asset delivery                 │
│ Load Balancer       │ Request distribution                  │
│ Application Cache   │ Redis query caching                   │
│ Database            │ Optimized queries, indexes            │
│ Compression         │ Gzip/Brotli response compression      │
│ Connection Pooling  │ Database connection optimization      │
└─────────────────────────────────────────────────────────────┘
```

### Caching Strategy

**Multi-level caching**:

```typescript
// Cache hierarchy
1. Browser Cache (static assets)
2. CDN Cache (global distribution)
3. Application Cache (Redis)
4. Database Query Cache
5. ORM Level Cache (Prisma)
```

### Database Optimization

```sql
-- Index strategy
CREATE INDEX CONCURRENTLY idx_products_status_category 
ON products(status, category_id);

CREATE INDEX CONCURRENTLY idx_orders_customer_date 
ON orders(customer_id, created_at);

-- Query optimization
EXPLAIN ANALYZE SELECT * FROM products 
WHERE status = 'active' AND category_id = ?;
```

### Monitoring & Metrics

**Comprehensive monitoring**:

```typescript
interface PerformanceMetrics {
  responseTime: number      // API response times
  throughput: number        // Requests per second
  errorRate: number         // Error percentage
  dbConnections: number     // Database pool status
  memoryUsage: number       // RAM consumption
  cpuUsage: number         // CPU utilization
}
```

## Deployment Architecture

### Container Strategy

**Docker-based deployment**:

```dockerfile
# Multi-stage build
FROM node:20-alpine AS builder
# Build application

FROM node:20-alpine AS production
# Production runtime
```

### Orchestration

**Kubernetes deployment** (optional):

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: commerce-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: commerce-api
  template:
    metadata:
      labels:
        app: commerce-api
    spec:
      containers:
      - name: api
        image: commerce-api:latest
        ports:
        - containerPort: 3000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: url
```

### CI/CD Pipeline

**Automated deployment workflow**:

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Source    │───▶│    Build    │───▶│    Test     │
│   (Git)     │    │  (Docker)   │    │   (Jest)    │
└─────────────┘    └─────────────┘    └─────────────┘
                                            │
┌─────────────┐    ┌─────────────┐    ┌─────▼───────┐
│   Monitor   │◄───│   Deploy    │◄───│   Package   │
│ (Metrics)   │    │ (K8s/PM2)   │    │ (Registry)  │
└─────────────┘    └─────────────┘    └─────────────┘
```

## Scalability Considerations

### Horizontal Scaling

**Scale-out architecture**:

```
┌─────────────────────────────────────────────────────────────┐
│                    Load Balancer                            │
│                     (Nginx/HAProxy)                         │
└─────────────────────┬───────────────────────────────────────┘
                      │
    ┌─────────────────┼─────────────────┐
    │                 │                 │
┌───▼───┐        ┌───▼───┐        ┌───▼───┐
│API #1 │        │API #2 │        │API #3 │
│       │        │       │        │       │
└───────┘        └───────┘        └───────┘
    │                 │                 │
    └─────────────────┼─────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                  Shared Services                            │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │
│  │ PostgreSQL  │ │    Redis    │ │ File Storage│          │
│  │ (Primary/   │ │   (Cache)   │ │   (S3/CDN)  │          │
│  │  Replica)   │ │             │ │             │          │
│  └─────────────┘ └─────────────┘ └─────────────┘          │
└─────────────────────────────────────────────────────────────┘
```

### Database Scaling

**Read replicas and sharding**:

```sql
-- Read replica setup
Primary Database (Write operations)
  │
  ├── Read Replica 1 (Product queries)
  ├── Read Replica 2 (Order queries)  
  └── Read Replica 3 (Analytics)
```

### Microservices Evolution

**Future microservices decomposition**:

```
┌─────────────────────────────────────────────────────────────┐
│                Current Monolith                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │
│  │  Products   │ │    Cart     │ │   Orders    │          │
│  │  Service    │ │   Service   │ │   Service   │          │
│  └─────────────┘ └─────────────┘ └─────────────┘          │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼ (Future Evolution)
┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│  Product    │ │    Cart     │ │   Order     │ │  Payment    │
│  Service    │ │   Service   │ │   Service   │ │   Service   │
│             │ │             │ │             │ │             │
└─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
```

---

## Next Steps

- [Database Schema Details](./database-schema.md)
- [API Design Patterns](./api-patterns.md)
- [Security Architecture](./security.md)
- [Performance Optimization](./performance.md)

*For specific implementation details, see the respective architecture documents.*