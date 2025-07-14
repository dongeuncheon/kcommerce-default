# Installation Guide

This guide provides detailed instructions for installing and configuring the NewTravel Commerce Plugin in different environments.

## Table of Contents

- [System Requirements](#system-requirements)
- [Installation Methods](#installation-methods)
- [Environment Configuration](#environment-configuration)
- [Database Setup](#database-setup)
- [File Storage Configuration](#file-storage-configuration)
- [Payment Gateway Setup](#payment-gateway-setup)
- [Production Deployment](#production-deployment)
- [Verification](#verification)

## System Requirements

### Minimum Requirements
- **Node.js**: 18.0.0 or higher
- **npm**: 8.0.0 or higher
- **PostgreSQL**: 14.0 or higher
- **Memory**: 512MB RAM
- **Storage**: 1GB available space

### Recommended Requirements
- **Node.js**: 20.0.0 or higher
- **npm**: 10.0.0 or higher
- **PostgreSQL**: 15.0 or higher
- **Redis**: 6.0 or higher (for caching and sessions)
- **Memory**: 2GB RAM
- **Storage**: 10GB available space

### Operating System Support
- **Linux**: Ubuntu 20.04+, CentOS 8+, Amazon Linux 2
- **macOS**: 10.15+ (Catalina)
- **Windows**: Windows 10/11 with WSL2

## Installation Methods

### Method 1: Docker Installation (Recommended)

Docker provides the easiest and most consistent installation experience.

#### Prerequisites
- Docker 20.10+
- Docker Compose 2.0+

#### Steps

1. **Clone the Repository**
   ```bash
   git clone https://github.com/your-org/commerce-plugin.git
   cd commerce-plugin
   ```

2. **Configure Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   nano .env
   ```

3. **Start Services**
   ```bash
   # Start all services in development mode
   npm run docker:dev
   
   # Or start in detached mode
   docker-compose -f docker-compose.dev.yml up -d
   ```

4. **Initialize Database**
   ```bash
   # Run database migrations and seed data
   npm run db:setup
   ```

The system will be available at:
- API Server: http://localhost:3000
- Database: localhost:5432
- Redis: localhost:6379
- Adminer (DB UI): http://localhost:8080

### Method 2: Local Installation

For development or when Docker is not available.

#### Prerequisites Installation

**On Ubuntu/Debian:**
```bash
# Update package list
sudo apt update

# Install Node.js and npm
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL
sudo apt-get install -y postgresql postgresql-contrib

# Install Redis (optional)
sudo apt-get install -y redis-server
```

**On macOS (using Homebrew):**
```bash
# Install Node.js
brew install node

# Install PostgreSQL
brew install postgresql
brew services start postgresql

# Install Redis (optional)
brew install redis
brew services start redis
```

**On Windows (using Chocolatey):**
```powershell
# Install Node.js
choco install nodejs

# Install PostgreSQL
choco install postgresql

# Install Redis (optional)
choco install redis-64
```

#### Application Installation

1. **Clone Repository**
   ```bash
   git clone https://github.com/your-org/commerce-plugin.git
   cd commerce-plugin
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment**
   ```bash
   cp .env.example .env
   ```

4. **Setup Database**
   ```bash
   # Create database
   createdb commerce_db
   
   # Run migrations and seed data
   npm run db:setup
   ```

5. **Start Application**
   ```bash
   npm run dev
   ```

### Method 3: Production Installation

For production environments with proper security and performance configurations.

#### Prerequisites
- Load balancer (Nginx/Apache)
- Process manager (PM2)
- SSL certificates
- Monitoring tools

#### Steps

1. **Clone and Build**
   ```bash
   git clone https://github.com/your-org/commerce-plugin.git
   cd commerce-plugin
   npm ci --production
   npm run build
   ```

2. **Install PM2**
   ```bash
   npm install -g pm2
   ```

3. **Configure Environment**
   ```bash
   cp .env.production .env
   # Edit with production values
   ```

4. **Setup Database**
   ```bash
   npm run db:deploy
   ```

5. **Start with PM2**
   ```bash
   pm2 start ecosystem.config.js --env production
   pm2 save
   pm2 startup
   ```

## Environment Configuration

### Basic Configuration

Create and configure your `.env` file:

```bash
# ===========================================
# BASIC CONFIGURATION
# ===========================================

# Server Configuration
NODE_ENV=development
PORT=3000
HOST=localhost

# Database Configuration
DATABASE_URL="postgresql://username:password@localhost:5432/commerce_db"

# Redis Configuration (optional but recommended)
REDIS_URL="redis://localhost:6379"

# Security Configuration
JWT_SECRET="your-super-secret-jwt-key-minimum-32-characters"
JWT_EXPIRES_IN="7d"
ENCRYPTION_KEY="your-32-character-encryption-key-here"
BCRYPT_ROUNDS=12

# Session Configuration
SESSION_SECRET="your-session-secret-key"
SESSION_MAX_AGE=86400000  # 24 hours in milliseconds

# CORS Configuration
CORS_ORIGIN="http://localhost:3000,http://localhost:3001"
CORS_CREDENTIALS=true

# ===========================================
# FEATURE CONFIGURATION
# ===========================================

# File Upload Configuration
UPLOAD_MAX_SIZE=10485760  # 10MB
UPLOAD_ALLOWED_TYPES="image/jpeg,image/png,image/gif,image/webp,application/pdf"
UPLOAD_PATH="./uploads"

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=1000
RATE_LIMIT_SKIP_FAILED_REQUESTS=true

# API Configuration
API_VERSION="v1"
API_PREFIX="/api"
ENABLE_API_DOCS=true
ENABLE_CORS=true

# Performance Configuration
ENABLE_COMPRESSION=true
ENABLE_CACHE=true
CACHE_TTL=3600  # 1 hour

# ===========================================
# EXTERNAL SERVICES
# ===========================================

# Payment Gateways
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

PAYPAL_CLIENT_ID="your-paypal-client-id"
PAYPAL_CLIENT_SECRET="your-paypal-client-secret"
PAYPAL_MODE="sandbox"  # or "live"

# Email Service
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
EMAIL_FROM="noreply@yourcompany.com"

# AWS S3 (for file storage)
AWS_ACCESS_KEY_ID="your-aws-access-key"
AWS_SECRET_ACCESS_KEY="your-aws-secret-key"
AWS_S3_BUCKET="your-bucket-name"
AWS_S3_REGION="us-east-1"
AWS_S3_ACL="public-read"

# Monitoring and Logging
LOG_LEVEL="info"
LOG_FORMAT="combined"
ENABLE_REQUEST_LOGGING=true
```

### Advanced Configuration

For production environments, consider these additional settings:

```bash
# ===========================================
# PRODUCTION CONFIGURATION
# ===========================================

# Security Headers
ENABLE_HELMET=true
ENABLE_CSRF=true
TRUST_PROXY=true

# Database Connection Pooling
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10
DATABASE_POOL_IDLE_TIMEOUT=30000

# Redis Configuration
REDIS_POOL_MIN=1
REDIS_POOL_MAX=10
REDIS_DB=0
REDIS_PASSWORD="your-redis-password"

# SSL Configuration
SSL_CERT_PATH="/path/to/cert.pem"
SSL_KEY_PATH="/path/to/key.pem"
FORCE_HTTPS=true

# Monitoring
HEALTH_CHECK_INTERVAL=30000
PERFORMANCE_MONITORING=true
ERROR_REPORTING_URL="https://your-error-service.com"

# Clustering
CLUSTER_MODE=true
CLUSTER_WORKERS=4

# Caching
CACHE_REDIS_URL="redis://localhost:6379/1"
CACHE_DEFAULT_TTL=3600
CACHE_MAX_MEMORY="100mb"
```

## Database Setup

### PostgreSQL Configuration

1. **Create Database User**
   ```sql
   CREATE USER commerce_user WITH PASSWORD 'secure_password';
   CREATE DATABASE commerce_db OWNER commerce_user;
   GRANT ALL PRIVILEGES ON DATABASE commerce_db TO commerce_user;
   ```

2. **Configure PostgreSQL**
   
   Edit `postgresql.conf`:
   ```conf
   # Memory settings
   shared_buffers = 256MB
   effective_cache_size = 1GB
   work_mem = 4MB
   
   # Connection settings
   max_connections = 100
   
   # Performance settings
   checkpoint_completion_target = 0.9
   wal_buffers = 16MB
   ```

3. **Run Migrations**
   ```bash
   npm run db:migrate
   ```

4. **Seed Data (Optional)**
   ```bash
   npm run db:seed
   ```

### Database Optimization

For production environments:

```sql
-- Create indexes for better performance
CREATE INDEX CONCURRENTLY idx_products_status ON products(status);
CREATE INDEX CONCURRENTLY idx_products_category ON products(category_id);
CREATE INDEX CONCURRENTLY idx_orders_customer ON orders(customer_id);
CREATE INDEX CONCURRENTLY idx_orders_status ON orders(status);

-- Update table statistics
ANALYZE;
```

## File Storage Configuration

### Local Storage (Default)

```bash
# Create upload directories
mkdir -p uploads/products
mkdir -p uploads/avatars
mkdir -p uploads/documents

# Set permissions
chmod 755 uploads/
chmod 755 uploads/products/
chmod 755 uploads/avatars/
chmod 755 uploads/documents/
```

### AWS S3 Storage

1. **Create S3 Bucket**
   ```bash
   aws s3 mb s3://your-commerce-bucket
   ```

2. **Configure Bucket Policy**
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "PublicReadGetObject",
         "Effect": "Allow",
         "Principal": "*",
         "Action": "s3:GetObject",
         "Resource": "arn:aws:s3:::your-commerce-bucket/*"
       }
     ]
   }
   ```

3. **Configure CORS**
   ```json
   [
     {
       "AllowedHeaders": ["*"],
       "AllowedMethods": ["GET", "POST", "PUT", "DELETE"],
       "AllowedOrigins": ["*"],
       "ExposeHeaders": ["ETag"]
     }
   ]
   ```

4. **Update Environment**
   ```bash
   STORAGE_TYPE=s3
   AWS_S3_BUCKET=your-commerce-bucket
   AWS_S3_REGION=us-east-1
   ```

## Payment Gateway Setup

### Stripe Configuration

1. **Get API Keys**
   - Log in to [Stripe Dashboard](https://dashboard.stripe.com)
   - Go to Developers > API keys
   - Copy your publishable and secret keys

2. **Configure Webhooks**
   - Go to Developers > Webhooks
   - Add endpoint: `https://yourdomain.com/api/v1/webhooks/stripe`
   - Select events: `payment_intent.succeeded`, `payment_intent.payment_failed`
   - Copy webhook signing secret

3. **Update Environment**
   ```bash
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_PUBLISHABLE_KEY=pk_live_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

### PayPal Configuration

1. **Create PayPal App**
   - Log in to [PayPal Developer](https://developer.paypal.com)
   - Create new app
   - Copy client ID and secret

2. **Update Environment**
   ```bash
   PAYPAL_CLIENT_ID=your-client-id
   PAYPAL_CLIENT_SECRET=your-client-secret
   PAYPAL_MODE=live  # or sandbox
   ```

## Production Deployment

### PM2 Ecosystem Configuration

Create `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'commerce-api',
    script: './dist/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'development',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    max_memory_restart: '500M',
    node_args: '--max-old-space-size=1024'
  }]
};
```

### Nginx Configuration

Create `/etc/nginx/sites-available/commerce-api`:

```nginx
upstream commerce_backend {
    server 127.0.0.1:3000;
    server 127.0.0.1:3001;
    server 127.0.0.1:3002;
    server 127.0.0.1:3003;
}

server {
    listen 80;
    server_name api.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";

    # API endpoints
    location / {
        proxy_pass http://commerce_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Static files
    location /uploads/ {
        alias /path/to/commerce-plugin/uploads/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

## Verification

After installation, verify everything is working correctly:

### 1. Health Check
```bash
curl http://localhost:3000/health

# Expected response
{
  "status": "healthy",
  "version": "1.0.0",
  "checks": {
    "database": "healthy",
    "redis": "healthy"
  }
}
```

### 2. API Endpoints
```bash
# Test product creation
curl -X POST http://localhost:3000/api/v1/products \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Product","sku":"TEST001","price":9.99}'

# Test product retrieval
curl http://localhost:3000/api/v1/products
```

### 3. Documentation Access
- Swagger UI: http://localhost:3000/api-docs
- ReDoc: http://localhost:3000/redoc

### 4. Database Verification
```bash
npm run db:studio
# Opens Prisma Studio at http://localhost:5555
```

### 5. Log Verification
```bash
# Check application logs
tail -f logs/combined.log

# Check PM2 logs (production)
pm2 logs commerce-api
```

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   ```bash
   # Check PostgreSQL status
   sudo systemctl status postgresql
   
   # Restart PostgreSQL
   sudo systemctl restart postgresql
   ```

2. **Port Already in Use**
   ```bash
   # Find process using port 3000
   lsof -ti:3000
   
   # Kill process
   kill -9 $(lsof -ti:3000)
   ```

3. **Permission Errors**
   ```bash
   # Fix upload directory permissions
   sudo chown -R $USER:$USER uploads/
   chmod -R 755 uploads/
   ```

4. **Memory Issues**
   ```bash
   # Increase Node.js memory limit
   node --max-old-space-size=2048 dist/index.js
   ```

### Getting Help

- Check [Troubleshooting Guide](../troubleshooting/common-issues.md)
- Review [Error Codes](../api/error-codes.md)
- Visit [GitHub Issues](https://github.com/your-org/commerce-plugin/issues)
- Contact [Support](mailto:api-support@newtravel.com)

---

*Installation complete! Next step: [Configuration Guide](./configuration.md)*