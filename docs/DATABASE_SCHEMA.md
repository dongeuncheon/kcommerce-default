# Database Schema Documentation

## Overview

The Commerce Base Plugin uses PostgreSQL as the primary database with Prisma ORM for type-safe database operations. The schema is designed to support a comprehensive e-commerce platform with the following core entities:

## Entity Relationship Diagram

```
Users ──┐
        ├── Addresses
        ├── Orders ──── OrderItems ──── Products
        ├── Carts ──── CartItems ──── Products
        ├── Reviews ──── Products
        ├── PaymentMethods
        └── WishlistItems ──── Products

Products ──┐
          ├── Categories (hierarchical)
          ├── ProductImages
          ├── ProductVariants
          ├── ProductAttributes
          ├── ProductTags ──── Tags
          ├── Reviews
          ├── WishlistItems
          ├── CartItems
          ├── OrderItems
          └── InventoryLogs

Orders ──┐
        ├── OrderItems
        ├── Payments
        ├── Shipments
        ├── OrderCoupons ──── Coupons
        └── OrderStatusHistory

Carts ──┐
       ├── CartItems
       └── CartCoupons ──── Coupons
```

## Core Entities

### 1. User Management

#### Users
- **Purpose**: Central user management for customers and administrators
- **Key Fields**: email (unique), password (hashed), role, verification status
- **Relationships**: addresses, orders, carts, reviews, payment methods, wishlist

#### Addresses
- **Purpose**: Store shipping and billing addresses for users
- **Key Fields**: type (shipping/billing/both), address components, default flag
- **Relationships**: belongs to user, referenced by orders

### 2. Product Catalog

#### Categories
- **Purpose**: Hierarchical product categorization
- **Key Fields**: name, slug (unique), parent-child relationships
- **Features**: Unlimited nesting levels, sorting, active/inactive status

#### Products
- **Purpose**: Core product information and inventory
- **Key Fields**: 
  - Basic: name, slug, SKU, description, status
  - Pricing: price, compare price, cost price
  - Inventory: quantity, low stock threshold, backorder settings
  - Physical: weight, dimensions for shipping calculations
  - SEO: meta title/description, focus keyword
- **Product Types**: Simple, Variable, Grouped, External
- **Relationships**: category, images, variants, attributes, tags, reviews

#### Product Variants
- **Purpose**: Product variations (size, color, etc.)
- **Key Fields**: SKU, price override, quantity, attributes (JSON)
- **Use Case**: Different sizes/colors of the same product

#### Product Images
- **Purpose**: Product visual media management
- **Key Fields**: URL, alt text, sort order, main image flag
- **Features**: Multiple images per product, ordered display

#### Tags & Attributes
- **Tags**: Flexible labeling system (bestseller, new arrival, sale)
- **Attributes**: Key-value product specifications (brand, material, etc.)

### 3. Shopping Cart

#### Carts
- **Purpose**: Temporary shopping cart storage
- **Key Fields**: user/session association, totals, expiration
- **Features**: 
  - Guest cart support via session ID
  - Automatic total calculations
  - Cart expiration for cleanup

#### Cart Items
- **Purpose**: Individual items in shopping cart
- **Key Fields**: product, variant, quantity, price snapshot
- **Features**: Price locked at add time, variant support

### 4. Order Management

#### Orders
- **Purpose**: Customer purchase records
- **Key Fields**: 
  - Identification: order number (unique), status
  - Customer: user reference or guest details
  - Financial: subtotal, tax, shipping, discount, total
  - Addresses: shipping and billing address references
- **Status Flow**: Pending → Confirmed → Processing → Shipped → Delivered

#### Order Items
- **Purpose**: Products purchased in each order
- **Key Fields**: product, variant, quantity, price, total
- **Features**: Historical price preservation

#### Order Status History
- **Purpose**: Audit trail of order status changes
- **Key Fields**: status, timestamp, notes
- **Features**: Complete order lifecycle tracking

### 5. Payment Processing

#### Payments
- **Purpose**: Payment transaction records
- **Key Fields**: amount, currency, status, method, gateway
- **Features**: 
  - Multiple payment methods support
  - Gateway response storage
  - Refund tracking

#### Payment Methods
- **Purpose**: Stored customer payment methods
- **Key Fields**: type, provider, encrypted details, default flag
- **Security**: Only stores safe details (last4, expiry, brand)

### 6. Shipping Management

#### Shipments
- **Purpose**: Shipping and delivery tracking
- **Key Fields**: tracking number, carrier, method, status, costs
- **Features**: 
  - Estimated vs actual delivery dates
  - Multiple shipping methods
  - Cost tracking

### 7. Discounts & Promotions

#### Coupons
- **Purpose**: Discount codes and promotions
- **Key Fields**: code (unique), type, value, usage limits, validity period
- **Types**: Percentage, Fixed Amount, Free Shipping
- **Features**: Usage tracking, minimum order requirements

#### Cart/Order Coupons
- **Purpose**: Applied coupons tracking
- **Features**: Many-to-many relationships with discount amounts

### 8. Inventory Management

#### Inventory Logs
- **Purpose**: Track all inventory movements
- **Key Fields**: product, action type, quantity, reason, reference
- **Actions**: Sale, Purchase, Adjustment, Return, Damage, Restock
- **Features**: Complete audit trail for inventory changes

### 9. Customer Engagement

#### Reviews
- **Purpose**: Product reviews and ratings
- **Key Fields**: rating (1-5), title, comment, verification status
- **Features**: 
  - Verified purchase reviews
  - Approval workflow
  - One review per user per product

#### Wishlist Items
- **Purpose**: Customer saved items for later
- **Key Fields**: user, product association
- **Features**: Quick add to cart, sharing capabilities

### 10. System Configuration

#### Settings
- **Purpose**: System-wide configuration storage
- **Key Fields**: key (unique), value (JSON), category, public flag
- **Features**: 
  - Flexible JSON value storage
  - Category organization
  - Public/private setting visibility

## Database Features

### Data Types
- **Decimal**: Used for all monetary values (precision: 10,2)
- **JSON**: Flexible storage for attributes, settings, gateway responses
- **CUID**: Collision-resistant unique identifiers
- **Timestamps**: Automatic created/updated tracking

### Indexes
- **Unique Constraints**: Email, SKU, slug fields
- **Composite Indexes**: Cart items (cart + product + variant)
- **Foreign Keys**: All relationships with appropriate cascade rules

### Cascade Rules
- **Cascade Delete**: User deletion removes addresses, carts, reviews
- **Set Null**: Product variant deletion sets order items to null
- **Restrict**: Prevent deletion of referenced categories

### Security Considerations
- **Password Hashing**: bcrypt with configurable rounds
- **Sensitive Data**: Payment methods store only safe details
- **Audit Trails**: Complete history for orders and inventory
- **Data Encryption**: Application-level encryption for PII

### Performance Optimizations
- **Indexing Strategy**: Optimized for common query patterns
- **Connection Pooling**: Configured in Prisma
- **Query Optimization**: Efficient joins and data fetching
- **Caching**: Redis layer for frequently accessed data

## Migration Strategy

### Development
```bash
npx prisma migrate dev --name init
npx prisma generate
npx prisma db seed
```

### Production
```bash
npx prisma migrate deploy
npx prisma generate
```

### Rollback
```bash
npx prisma migrate reset
```

## Backup Strategy

### Automated Backups
- Daily full database backups
- Transaction log backups every 15 minutes
- 30-day retention policy
- Cross-region backup replication

### Manual Backups
```bash
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
```

## Monitoring

### Key Metrics
- Connection pool utilization
- Query performance and slow queries
- Database size and growth
- Backup success/failure rates

### Alerts
- High connection usage (>80%)
- Slow queries (>1 second)
- Failed backups
- Disk space warnings

This schema provides a solid foundation for a scalable e-commerce platform while maintaining data integrity and performance.