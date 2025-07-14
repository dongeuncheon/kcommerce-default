# Quick Start Guide

Get up and running with the NewTravel Commerce Plugin in minutes.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 18+ and **npm** 8+
- **PostgreSQL** 14+
- **Redis** 6+ (optional but recommended)
- **Docker** (optional but recommended for development)

## 🚀 Quick Installation

### Option 1: Docker (Recommended)

The fastest way to get started is using Docker:

```bash
# Clone the repository
git clone https://github.com/your-org/commerce-plugin.git
cd commerce-plugin

# Start all services with Docker Compose
npm run docker:dev

# The API will be available at http://localhost:3000
```

This will start:
- Commerce API server on port 3000
- PostgreSQL database on port 5432
- Redis cache on port 6379
- Adminer (database UI) on port 8080

### Option 2: Local Installation

```bash
# Clone the repository
git clone https://github.com/your-org/commerce-plugin.git
cd commerce-plugin

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit .env file with your database configuration
nano .env

# Setup database
npm run db:setup

# Start development server
npm run dev
```

## 🔧 Environment Configuration

Create a `.env` file in the project root:

```bash
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/commerce_db"

# Redis (optional)
REDIS_URL="redis://localhost:6379"

# Security
JWT_SECRET="your-super-secret-jwt-key"
ENCRYPTION_KEY="your-32-character-encryption-key"

# Server
PORT=3000
NODE_ENV=development

# File Upload
UPLOAD_MAX_SIZE=10485760  # 10MB
UPLOAD_ALLOWED_TYPES=image/jpeg,image/png,image/gif,image/webp

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=1000

# External Services (optional)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
AWS_ACCESS_KEY_ID=your-aws-key
AWS_SECRET_ACCESS_KEY=your-aws-secret
AWS_S3_BUCKET=your-bucket-name
```

## ✅ Verification

After starting the server, verify everything is working:

### 1. Health Check
```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2024-06-06T12:00:00Z",
  "version": "1.0.0",
  "uptime": 123.45,
  "checks": {
    "database": "healthy",
    "redis": "healthy",
    "filesystem": "healthy"
  }
}
```

### 2. API Documentation
Visit [http://localhost:3000/api-docs](http://localhost:3000/api-docs) to access the interactive API documentation.

### 3. Database Status
```bash
npm run db:studio
```
This opens Prisma Studio at [http://localhost:5555](http://localhost:5555) to view your database.

## 📚 First API Calls

### 1. Create a Product
```bash
curl -X POST http://localhost:3000/api/v1/products \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Sample Product",
    "description": "A sample product for testing",
    "sku": "SAMPLE-001",
    "price": 29.99,
    "stockQuantity": 100,
    "status": "PUBLISHED"
  }'
```

### 2. Get All Products
```bash
curl http://localhost:3000/api/v1/products
```

### 3. Create a Category
```bash
curl -X POST http://localhost:3000/api/v1/categories \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Electronics",
    "description": "Electronic products",
    "slug": "electronics"
  }'
```

### 4. Add Product to Cart (Guest)
```bash
# First, create a guest session
SESSION_RESPONSE=$(curl -c cookies.txt -b cookies.txt http://localhost:3000/api/v1/carts)

# Then add a product to cart
curl -X POST http://localhost:3000/api/v1/carts/items \
  -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "YOUR_PRODUCT_ID",
    "quantity": 2
  }'
```

## 🎯 Next Steps

Now that you have the system running, here are some suggested next steps:

### 1. Explore the API
- Visit the [Interactive API Documentation](http://localhost:3000/api-docs)
- Try different endpoints using the Swagger UI
- Download and import our [Postman collection](../api/postman/)

### 2. Set Up Sample Data
```bash
# Seed the database with sample data
npm run db:seed
```

This creates:
- Sample product categories
- Sample products with variants
- Sample customers
- Sample orders

### 3. Test Real-time Features
The system includes WebSocket support for real-time updates:

```javascript
// Connect to WebSocket
const socket = io('http://localhost:3000');

// Listen for cart updates
socket.on('cart:updated', (data) => {
  console.log('Cart updated:', data);
});

// Listen for order updates
socket.on('order:status_changed', (data) => {
  console.log('Order status changed:', data);
});
```

### 4. Configure Payment Processing
Set up payment gateways for order processing:

```bash
# Add Stripe configuration to .env
STRIPE_SECRET_KEY=sk_test_your_test_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_test_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
```

### 5. Set Up File Uploads
Configure file storage for product images:

```bash
# Local storage (default)
STORAGE_TYPE=local
UPLOAD_PATH=./uploads

# Or AWS S3
STORAGE_TYPE=s3
AWS_S3_BUCKET=your-bucket-name
AWS_S3_REGION=us-east-1
```

## 🔍 Troubleshooting

### Common Issues

#### Database Connection Error
```bash
Error: Can't reach database server at localhost:5432
```

**Solution:**
1. Ensure PostgreSQL is running
2. Check your `DATABASE_URL` in `.env`
3. Verify database credentials

#### Redis Connection Error
```bash
Redis connection failed
```

**Solution:**
1. Redis is optional for development
2. Comment out `REDIS_URL` in `.env` to disable
3. Or install and start Redis server

#### Port Already in Use
```bash
Error: listen EADDRINUSE: address already in use :::3000
```

**Solution:**
1. Change `PORT` in `.env` to a different port
2. Or kill the process using port 3000:
   ```bash
   lsof -ti:3000 | xargs kill -9
   ```

#### Permission Errors
```bash
EACCES: permission denied
```

**Solution:**
1. Ensure upload directory is writable:
   ```bash
   chmod 755 uploads/
   ```
2. Check file ownership and permissions

### Getting Help

If you encounter issues:

1. Check the [Troubleshooting Guide](../troubleshooting/common-issues.md)
2. Review the [Error Codes Reference](../api/error-codes.md)
3. Search [GitHub Issues](https://github.com/your-org/commerce-plugin/issues)
4. Ask for help in [GitHub Discussions](https://github.com/your-org/commerce-plugin/discussions)

## 📖 Learning Resources

### Documentation
- [Full API Reference](../api/README.md)
- [Database Schema](../DATABASE_SCHEMA.md)
- [Architecture Overview](../architecture/README.md)

### Tutorials
- [Building Your First Integration](../tutorials/first-integration.md)
- [Custom Product Types](../tutorials/custom-product-types.md)
- [Payment Processing](../tutorials/payment-processing.md)
- [Real-time Features](../tutorials/real-time-features.md)

### Examples
- [JavaScript SDK Examples](../api/sdks/javascript.md)
- [Python Integration Examples](../api/sdks/python.md)
- [React Frontend Example](../examples/react-frontend/)
- [Node.js Backend Integration](../examples/nodejs-integration/)

## 🎉 You're Ready!

Congratulations! You now have a fully functional commerce system running. The system includes:

- ✅ Product catalog management
- ✅ Shopping cart functionality
- ✅ Order processing
- ✅ Real-time updates via WebSocket
- ✅ Comprehensive API documentation
- ✅ Developer-friendly tools

Start building your e-commerce application with confidence!

---

*Need help? Check our [documentation](../README.md) or reach out to [support](mailto:api-support@newtravel.com).*