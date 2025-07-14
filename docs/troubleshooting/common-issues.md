# Common Issues & Troubleshooting

This guide covers the most common issues you might encounter when working with the NewTravel Commerce Plugin and their solutions.

## Table of Contents

- [Installation Issues](#installation-issues)
- [Database Issues](#database-issues)
- [Authentication Issues](#authentication-issues)
- [API Issues](#api-issues)
- [Performance Issues](#performance-issues)
- [File Upload Issues](#file-upload-issues)
- [Payment Issues](#payment-issues)
- [Development Issues](#development-issues)

## Installation Issues

### Issue: Node.js Version Compatibility

**Problem:**
```bash
Error: The engine "node" is incompatible with this module.
```

**Solution:**
```bash
# Check your Node.js version
node --version

# Install Node.js 18+ using nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18

# Or update using your package manager
# macOS with Homebrew
brew install node@18

# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### Issue: npm Installation Failures

**Problem:**
```bash
npm ERR! peer dep missing: react@^18.0.0
```

**Solution:**
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and package-lock.json
rm -rf node_modules package-lock.json

# Reinstall dependencies
npm install

# If peer dependency issues persist
npm install --legacy-peer-deps
```

### Issue: Permission Denied Errors

**Problem:**
```bash
EACCES: permission denied, mkdir '/usr/local/lib/node_modules'
```

**Solution:**
```bash
# Fix npm permissions (recommended)
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc

# Or use nvm (better approach)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
```

## Database Issues

### Issue: PostgreSQL Connection Failed

**Problem:**
```bash
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Solution:**

1. **Check if PostgreSQL is running:**
```bash
# On macOS
brew services list | grep postgresql
brew services start postgresql

# On Ubuntu/Debian
sudo systemctl status postgresql
sudo systemctl start postgresql

# On Windows
net start postgresql-x64-14
```

2. **Verify database exists:**
```bash
# Connect to PostgreSQL
psql -U postgres

# List databases
\l

# Create database if missing
CREATE DATABASE commerce_db;
```

3. **Check connection string:**
```bash
# Verify DATABASE_URL in .env
DATABASE_URL="postgresql://username:password@localhost:5432/commerce_db"

# Test connection
npm run db:studio
```

### Issue: Migration Failures

**Problem:**
```bash
Error: Migration failed. Rollback completed.
```

**Solution:**

1. **Check migration status:**
```bash
npx prisma migrate status
```

2. **Reset and retry:**
```bash
# Reset database (WARNING: This will delete all data)
npx prisma migrate reset

# Or manually fix and retry
npx prisma migrate resolve --applied 20230101000000_migration_name
npx prisma migrate deploy
```

3. **Manual intervention:**
```bash
# If stuck, manually fix in database
psql -U postgres -d commerce_db

# Check schema_migrations table
SELECT * FROM _prisma_migrations;

# Mark migration as applied if needed
INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) 
VALUES ('migration-id', 'checksum', NOW(), 'migration_name', '', NULL, NOW(), 1);
```

### Issue: Prisma Generate Errors

**Problem:**
```bash
Error: Generator "client" failed
```

**Solution:**
```bash
# Clear Prisma cache
rm -rf node_modules/.prisma
rm -rf node_modules/@prisma/client

# Regenerate Prisma client
npx prisma generate

# If still failing, reinstall Prisma
npm uninstall prisma @prisma/client
npm install prisma @prisma/client
npx prisma generate
```

## Authentication Issues

### Issue: JWT Token Invalid

**Problem:**
```json
{
  "error": {
    "code": "INVALID_TOKEN",
    "message": "JWT token is invalid or expired"
  }
}
```

**Solution:**

1. **Check JWT secret:**
```bash
# Ensure JWT_SECRET is set in .env
JWT_SECRET="your-super-secret-jwt-key-minimum-32-characters"

# Restart the server after changing
npm run dev
```

2. **Verify token format:**
```javascript
// Token should be in format: Bearer <token>
const token = request.headers.authorization?.replace('Bearer ', '');

// Check token expiration
const payload = jwt.decode(token);
console.log('Token expires at:', new Date(payload.exp * 1000));
```

3. **Debug token issues:**
```bash
# Test token with curl
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/v1/products

# Check server logs for detailed error
tail -f logs/error.log
```

### Issue: Session Cookie Not Working

**Problem:**
```bash
Session cookie not being set or maintained
```

**Solution:**

1. **Check session configuration:**
```typescript
// In sessionMiddleware.ts
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));
```

2. **CORS configuration:**
```typescript
app.use(cors({
  origin: 'http://localhost:3001', // Your frontend URL
  credentials: true // Important for cookies
}));
```

3. **Frontend cookie handling:**
```javascript
// Ensure credentials are included in requests
fetch('http://localhost:3000/api/v1/carts', {
  credentials: 'include' // Important for cookies
});
```

## API Issues

### Issue: CORS Errors

**Problem:**
```bash
Access to fetch at 'http://localhost:3000/api/v1/products' from origin 'http://localhost:3001' 
has been blocked by CORS policy
```

**Solution:**

1. **Configure CORS properly:**
```typescript
// In index.ts
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001', 
    'https://yourdomain.com'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
```

2. **Environment-specific CORS:**
```bash
# In .env
CORS_ORIGIN="http://localhost:3000,http://localhost:3001"
CORS_CREDENTIALS=true
```

### Issue: Rate Limiting Blocking Requests

**Problem:**
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests"
  }
}
```

**Solution:**

1. **Check rate limit headers:**
```bash
curl -I http://localhost:3000/api/v1/products

# Look for headers:
# X-RateLimit-Limit: 1000
# X-RateLimit-Remaining: 0
# X-RateLimit-Reset: 1640995200
```

2. **Adjust rate limits:**
```bash
# In .env
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=1000

# Or disable for development
RATE_LIMIT_ENABLED=false
```

3. **Whitelist IP addresses:**
```typescript
// In rateLimiter.ts
const whitelist = ['127.0.0.1', '::1', '192.168.1.100'];
if (whitelist.includes(req.ip)) {
  return next();
}
```

### Issue: Validation Errors

**Problem:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data"
  }
}
```

**Solution:**

1. **Check request format:**
```bash
# Ensure Content-Type header is set
curl -X POST http://localhost:3000/api/v1/products \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Product","price":9.99,"sku":"TEST001"}'
```

2. **Validate required fields:**
```typescript
// Check the schema in types/product.ts
const CreateProductSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  sku: z.string().min(1, 'SKU is required'),
  price: z.number().positive('Price must be positive')
});
```

3. **Debug validation:**
```typescript
// Add detailed validation logging
try {
  const validData = CreateProductSchema.parse(req.body);
} catch (error) {
  console.log('Validation error:', error.issues);
  return res.status(400).json({ error: error.issues });
}
```

## Performance Issues

### Issue: Slow API Responses

**Problem:**
```bash
API responses taking more than 5 seconds
```

**Solution:**

1. **Enable query logging:**
```bash
# In .env
DATABASE_ENABLE_QUERY_LOGGING=true
LOG_LEVEL=debug
```

2. **Check database performance:**
```sql
-- In PostgreSQL, check slow queries
SELECT query, mean_time, calls, total_time 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;

-- Check for missing indexes
SELECT schemaname, tablename, indexname, idx_tup_read, idx_tup_fetch 
FROM pg_stat_user_indexes 
WHERE idx_tup_read = 0;
```

3. **Optimize queries:**
```typescript
// Use select to limit fields
const products = await prisma.product.findMany({
  select: {
    id: true,
    name: true,
    price: true,
    // Don't select large fields like description
  },
  take: 20 // Limit results
});

// Use proper indexes
const products = await prisma.product.findMany({
  where: {
    status: 'PUBLISHED', // Ensure index on status
    categoryId: categoryId // Ensure index on categoryId
  }
});
```

### Issue: High Memory Usage

**Problem:**
```bash
Process killed due to out of memory (OOM)
```

**Solution:**

1. **Monitor memory usage:**
```bash
# Check current memory usage
ps aux | grep node

# Monitor in real-time
top -p $(pgrep node)

# Use PM2 monitoring
pm2 monit
```

2. **Increase Node.js memory limit:**
```bash
# In package.json
"scripts": {
  "start": "node --max-old-space-size=2048 dist/index.js"
}

# Or set environment variable
export NODE_OPTIONS="--max-old-space-size=2048"
```

3. **Optimize memory usage:**
```typescript
// Use streaming for large datasets
const stream = await prisma.product.findManyStream();

// Clear large objects from memory
let products = await getProducts();
// ... use products
products = null; // Help GC

// Use pagination
const products = await prisma.product.findMany({
  skip: page * limit,
  take: limit
});
```

## File Upload Issues

### Issue: File Upload Fails

**Problem:**
```bash
MulterError: File too large
```

**Solution:**

1. **Check upload limits:**
```bash
# In .env
UPLOAD_MAX_SIZE=10485760  # 10MB in bytes
UPLOAD_ALLOWED_TYPES="image/jpeg,image/png,image/gif"
```

2. **Configure multer:**
```typescript
// In upload.ts
const upload = multer({
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 5 // Max 5 files
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});
```

### Issue: S3 Upload Errors

**Problem:**
```bash
AccessDenied: User is not authorized to perform: s3:PutObject
```

**Solution:**

1. **Check AWS credentials:**
```bash
# In .env
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_S3_BUCKET=your-bucket-name
AWS_S3_REGION=us-east-1
```

2. **Verify S3 permissions:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::your-bucket-name/*"
    }
  ]
}
```

3. **Test S3 connection:**
```bash
# Using AWS CLI
aws s3 ls s3://your-bucket-name

# Test upload
aws s3 cp test.txt s3://your-bucket-name/test.txt
```

## Payment Issues

### Issue: Stripe Webhook Verification Failed

**Problem:**
```bash
Webhook signature verification failed
```

**Solution:**

1. **Check webhook secret:**
```bash
# In .env
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
```

2. **Verify webhook configuration:**
```typescript
// In stripe webhook handler
const sig = req.headers['stripe-signature'];
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

try {
  const event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  // Process event
} catch (err) {
  console.log('Webhook signature verification failed:', err.message);
  return res.status(400).send(`Webhook Error: ${err.message}`);
}
```

3. **Test webhook locally:**
```bash
# Install Stripe CLI
stripe listen --forward-to localhost:3000/api/v1/webhooks/stripe

# Test webhook
stripe trigger payment_intent.succeeded
```

## Development Issues

### Issue: Hot Reload Not Working

**Problem:**
```bash
Code changes not reflected in development server
```

**Solution:**

1. **Check nodemon configuration:**
```json
// In package.json
"scripts": {
  "dev": "nodemon --exec ts-node src/index.ts"
}

// Or create nodemon.json
{
  "watch": ["src"],
  "ext": "ts,js,json",
  "ignore": ["src/**/*.test.ts"],
  "exec": "ts-node src/index.ts"
}
```

2. **Clear TypeScript cache:**
```bash
# Clear tsc cache
rm -rf dist/
rm -rf node_modules/.cache/

# Restart development server
npm run dev
```

### Issue: Import Path Errors

**Problem:**
```bash
Cannot find module '../../../utils/logger'
```

**Solution:**

1. **Use path mapping:**
```json
// In tsconfig.json
{
  "compilerOptions": {
    "baseUrl": "./src",
    "paths": {
      "@/*": ["*"],
      "@/utils/*": ["utils/*"],
      "@/services/*": ["services/*"]
    }
  }
}
```

2. **Install path resolution:**
```bash
npm install --save-dev tsc-alias

# Update build script
"build": "tsc && tsc-alias"
```

## Getting Additional Help

### Log Analysis

```bash
# Check application logs
tail -f logs/combined.log

# Check error logs specifically
tail -f logs/error.log

# Check access logs
tail -f logs/access.log

# Filter logs by level
grep ERROR logs/combined.log
```

### Debug Mode

```bash
# Enable debug mode
DEBUG=* npm run dev

# Or specific modules
DEBUG=express:* npm run dev
```

### Health Check

```bash
# Comprehensive health check
curl http://localhost:3000/health

# Database health
curl http://localhost:3000/health/database

# Performance metrics
curl http://localhost:3000/health/performance
```

### Support Resources

1. **Documentation**: Check [API docs](../api/README.md)
2. **Error Codes**: Review [error codes reference](../api/error-codes.md)
3. **GitHub Issues**: Search [existing issues](https://github.com/your-org/commerce-plugin/issues)
4. **Community**: Join [discussions](https://github.com/your-org/commerce-plugin/discussions)
5. **Support**: Email [api-support@newtravel.com](mailto:api-support@newtravel.com)

---

*If you encounter an issue not covered here, please [create an issue](https://github.com/your-org/commerce-plugin/issues/new) with detailed information about your problem.*