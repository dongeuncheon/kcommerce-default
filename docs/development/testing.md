# Testing Guide

This guide covers all aspects of testing in the NewTravel Commerce Plugin, from unit tests to end-to-end testing strategies.

## Table of Contents

- [Testing Philosophy](#testing-philosophy)
- [Test Structure](#test-structure)
- [Unit Testing](#unit-testing)
- [Integration Testing](#integration-testing)
- [End-to-End Testing](#end-to-end-testing)
- [API Testing](#api-testing)
- [Performance Testing](#performance-testing)
- [Test Data Management](#test-data-management)
- [Continuous Integration](#continuous-integration)

## Testing Philosophy

Our testing strategy follows the **testing pyramid** principle:

```
    /\
   /  \     E2E Tests (Few)
  /____\    - User journeys
 /      \   - Critical paths
/__________\ Integration Tests (More)
            - API endpoints
            - Database operations
            - Service interactions
           
=====================================
Unit Tests (Most)
- Pure functions
- Business logic
- Individual components
```

### Key Principles

1. **Fast Feedback**: Tests should run quickly during development
2. **Reliability**: Tests should be deterministic and not flaky
3. **Maintainability**: Tests should be easy to understand and update
4. **Coverage**: Critical business logic should have comprehensive coverage
5. **Isolation**: Tests should not depend on external services or other tests

## Test Structure

### Directory Structure

```
tests/
├── unit/                 # Unit tests
│   ├── services/         # Business logic tests
│   ├── utils/           # Utility function tests
│   └── middleware/      # Middleware tests
├── integration/         # Integration tests
│   ├── api/            # API endpoint tests
│   ├── database/       # Database operation tests
│   └── services/       # Service integration tests
├── e2e/                # End-to-end tests
│   ├── user-journeys/  # Complete user workflows
│   └── admin/          # Admin functionality tests
├── performance/        # Performance tests
├── fixtures/           # Test data
├── helpers/            # Test utilities
└── setup/              # Test configuration
```

### Naming Conventions

- **Unit tests**: `*.test.ts`
- **Integration tests**: `*.integration.test.ts`
- **E2E tests**: `*.e2e.test.ts`
- **Performance tests**: `*.perf.test.ts`

## Unit Testing

Unit tests focus on testing individual functions, classes, and modules in isolation.

### Test Framework Setup

We use **Jest** with **TypeScript** support:

```typescript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup/jest.setup.ts']
};
```

### Service Testing Example

```typescript
// tests/unit/services/productService.test.ts
import { ProductService } from '../../../src/services/productService';
import { PrismaClient } from '@prisma/client';
import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';

// Mock Prisma
jest.mock('../../../src/utils/database', () => ({
  prisma: mockDeep<PrismaClient>()
}));

const mockPrisma = prisma as DeepMockProxy<PrismaClient>;

describe('ProductService', () => {
  let productService: ProductService;

  beforeEach(() => {
    mockReset(mockPrisma);
    productService = new ProductService();
  });

  describe('createProduct', () => {
    it('should create a product with valid data', async () => {
      // Arrange
      const productData = {
        name: 'Test Product',
        sku: 'TEST001',
        price: 99.99,
        status: 'PUBLISHED' as const
      };

      const expectedProduct = {
        id: 'prod_123',
        ...productData,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.product.create.mockResolvedValue(expectedProduct);

      // Act
      const result = await productService.createProduct(productData);

      // Assert
      expect(result).toEqual(expectedProduct);
      expect(mockPrisma.product.create).toHaveBeenCalledWith({
        data: expect.objectContaining(productData)
      });
    });

    it('should throw error for duplicate SKU', async () => {
      // Arrange
      const productData = {
        name: 'Test Product',
        sku: 'DUPLICATE',
        price: 99.99,
        status: 'PUBLISHED' as const
      };

      const error = new Error('Unique constraint violation');
      mockPrisma.product.create.mockRejectedValue(error);

      // Act & Assert
      await expect(productService.createProduct(productData))
        .rejects
        .toThrow('Product with SKU DUPLICATE already exists');
    });
  });

  describe('updateProduct', () => {
    it('should update product price', async () => {
      // Arrange
      const productId = 'prod_123';
      const updateData = { price: 149.99 };
      
      const existingProduct = {
        id: productId,
        name: 'Test Product',
        sku: 'TEST001',
        price: 99.99,
        status: 'PUBLISHED' as const
      };

      const updatedProduct = { ...existingProduct, ...updateData };

      mockPrisma.product.findUnique.mockResolvedValue(existingProduct);
      mockPrisma.product.update.mockResolvedValue(updatedProduct);

      // Act
      const result = await productService.updateProduct(productId, updateData);

      // Assert
      expect(result.price).toBe(149.99);
      expect(mockPrisma.product.update).toHaveBeenCalledWith({
        where: { id: productId },
        data: updateData
      });
    });
  });

  describe('calculateDiscountedPrice', () => {
    it('should apply percentage discount correctly', () => {
      // Arrange
      const originalPrice = 100;
      const discount = { type: 'PERCENTAGE', value: 20 };

      // Act
      const result = productService.calculateDiscountedPrice(originalPrice, discount);

      // Assert
      expect(result).toBe(80);
    });

    it('should apply fixed amount discount correctly', () => {
      // Arrange
      const originalPrice = 100;
      const discount = { type: 'FIXED_AMOUNT', value: 15 };

      // Act
      const result = productService.calculateDiscountedPrice(originalPrice, discount);

      // Assert
      expect(result).toBe(85);
    });

    it('should not allow negative prices', () => {
      // Arrange
      const originalPrice = 20;
      const discount = { type: 'FIXED_AMOUNT', value: 30 };

      // Act
      const result = productService.calculateDiscountedPrice(originalPrice, discount);

      // Assert
      expect(result).toBe(0);
    });
  });
});
```

### Utility Testing Example

```typescript
// tests/unit/utils/security.test.ts
import { 
  hashPassword, 
  verifyPassword, 
  generateApiKey,
  validateInput 
} from '../../../src/utils/security';

describe('Security Utils', () => {
  describe('password hashing', () => {
    it('should hash password securely', async () => {
      const password = 'SecurePassword123!';
      const hashedPassword = await hashPassword(password);

      expect(hashedPassword).toBeDefined();
      expect(hashedPassword).not.toBe(password);
      expect(hashedPassword.length).toBeGreaterThan(50);
    });

    it('should verify correct password', async () => {
      const password = 'SecurePassword123!';
      const hashedPassword = await hashPassword(password);
      
      const isValid = await verifyPassword(password, hashedPassword);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'SecurePassword123!';
      const wrongPassword = 'WrongPassword123!';
      const hashedPassword = await hashPassword(password);
      
      const isValid = await verifyPassword(wrongPassword, hashedPassword);
      expect(isValid).toBe(false);
    });
  });

  describe('API key generation', () => {
    it('should generate unique API keys', () => {
      const key1 = generateApiKey();
      const key2 = generateApiKey();

      expect(key1).toBeDefined();
      expect(key2).toBeDefined();
      expect(key1).not.toBe(key2);
      expect(key1.length).toBe(32);
    });
  });

  describe('input validation', () => {
    it('should sanitize malicious input', () => {
      const maliciousInput = '<script>alert("xss")</script>';
      const sanitized = validateInput(maliciousInput);

      expect(sanitized).not.toContain('<script>');
      expect(sanitized).toBe('alert("xss")');
    });
  });
});
```

## Integration Testing

Integration tests verify that different parts of the system work correctly together.

### Database Integration Testing

```typescript
// tests/integration/database/product.integration.test.ts
import { PrismaClient } from '@prisma/client';
import { ProductService } from '../../../src/services/productService';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_TEST_URL
    }
  }
});

const productService = new ProductService();

describe('Product Database Integration', () => {
  beforeAll(async () => {
    // Setup test database
    await prisma.$connect();
  });

  afterAll(async () => {
    // Cleanup
    await prisma.product.deleteMany();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean data before each test
    await prisma.product.deleteMany();
  });

  it('should create and retrieve product', async () => {
    // Create product
    const productData = {
      name: 'Integration Test Product',
      sku: 'INT_TEST_001',
      price: 99.99,
      status: 'PUBLISHED' as const
    };

    const createdProduct = await productService.createProduct(productData);
    expect(createdProduct.id).toBeDefined();

    // Retrieve product
    const retrievedProduct = await productService.getProductById(createdProduct.id);
    expect(retrievedProduct).toMatchObject(productData);
  });

  it('should handle concurrent product creation', async () => {
    const promises = Array.from({ length: 10 }, (_, i) => 
      productService.createProduct({
        name: `Product ${i}`,
        sku: `SKU_${i}`,
        price: 99.99,
        status: 'PUBLISHED' as const
      })
    );

    const products = await Promise.all(promises);
    expect(products).toHaveLength(10);
    
    const productCount = await prisma.product.count();
    expect(productCount).toBe(10);
  });
});
```

### API Integration Testing

```typescript
// tests/integration/api/products.integration.test.ts
import request from 'supertest';
import app from '../../../src/index';
import { setupTestDatabase, cleanupTestDatabase } from '../../helpers/database';

describe('Products API Integration', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  describe('GET /api/v1/products', () => {
    it('should return paginated products', async () => {
      // Create test products
      await request(app)
        .post('/api/v1/products')
        .send({
          name: 'Test Product 1',
          sku: 'TEST001',
          price: 99.99,
          status: 'PUBLISHED'
        });

      await request(app)
        .post('/api/v1/products')
        .send({
          name: 'Test Product 2',
          sku: 'TEST002',
          price: 149.99,
          status: 'PUBLISHED'
        });

      // Test pagination
      const response = await request(app)
        .get('/api/v1/products?page=1&limit=1')
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.meta).toMatchObject({
        page: 1,
        limit: 1,
        total: 2,
        totalPages: 2,
        hasNextPage: true,
        hasPrevPage: false
      });
    });

    it('should filter products by category', async () => {
      // Create category
      const categoryResponse = await request(app)
        .post('/api/v1/categories')
        .send({
          name: 'Electronics',
          slug: 'electronics'
        });

      const categoryId = categoryResponse.body.data.id;

      // Create product in category
      await request(app)
        .post('/api/v1/products')
        .send({
          name: 'Laptop',
          sku: 'LAPTOP001',
          price: 999.99,
          status: 'PUBLISHED',
          categoryId
        });

      // Test filtering
      const response = await request(app)
        .get(`/api/v1/products?categoryId=${categoryId}`)
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].categoryId).toBe(categoryId);
    });
  });

  describe('POST /api/v1/products', () => {
    it('should create product with valid data', async () => {
      const productData = {
        name: 'New Product',
        sku: 'NEW001',
        price: 199.99,
        status: 'PUBLISHED',
        description: 'A new product for testing'
      };

      const response = await request(app)
        .post('/api/v1/products')
        .send(productData)
        .expect(201);

      expect(response.body.data).toMatchObject(productData);
      expect(response.body.data.id).toBeDefined();
    });

    it('should reject invalid data', async () => {
      const invalidData = {
        name: '', // Invalid: empty name
        price: -10, // Invalid: negative price
        status: 'INVALID_STATUS'
      };

      const response = await request(app)
        .post('/api/v1/products')
        .send(invalidData)
        .expect(400);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
```

## End-to-End Testing

E2E tests simulate real user interactions and test complete workflows.

### User Journey Testing

```typescript
// tests/e2e/user-journeys/complete-purchase.e2e.test.ts
import request from 'supertest';
import app from '../../../src/index';
import { setupE2EEnvironment, cleanupE2EEnvironment } from '../../helpers/e2e';

describe('Complete Purchase Journey', () => {
  let sessionCookie: string;
  let productId: string;
  let orderId: string;

  beforeAll(async () => {
    await setupE2EEnvironment();
  });

  afterAll(async () => {
    await cleanupE2EEnvironment();
  });

  it('should complete full purchase flow', async () => {
    // Step 1: Create product
    const productResponse = await request(app)
      .post('/api/v1/products')
      .send({
        name: 'E2E Test Product',
        sku: 'E2E001',
        price: 99.99,
        status: 'PUBLISHED',
        quantity: 10
      })
      .expect(201);

    productId = productResponse.body.data.id;

    // Step 2: Create cart session
    const cartResponse = await request(app)
      .get('/api/v1/carts')
      .expect(200);

    sessionCookie = cartResponse.headers['set-cookie'][0];

    // Step 3: Add product to cart
    await request(app)
      .post('/api/v1/carts/items')
      .set('Cookie', sessionCookie)
      .send({
        productId,
        quantity: 2
      })
      .expect(201);

    // Step 4: Verify cart contents
    const cartVerification = await request(app)
      .get('/api/v1/carts')
      .set('Cookie', sessionCookie)
      .expect(200);

    expect(cartVerification.body.data.items).toHaveLength(1);
    expect(cartVerification.body.data.items[0].quantity).toBe(2);
    expect(cartVerification.body.data.total).toBe(199.98);

    // Step 5: Create order
    const orderResponse = await request(app)
      .post('/api/v1/orders')
      .set('Cookie', sessionCookie)
      .send({
        shippingAddress: {
          firstName: 'E2E',
          lastName: 'Test',
          address1: '123 Test St',
          city: 'Test City',
          state: 'TS',
          zipCode: '12345',
          country: 'US'
        },
        billingAddress: {
          firstName: 'E2E',
          lastName: 'Test',
          address1: '123 Test St',
          city: 'Test City',
          state: 'TS',
          zipCode: '12345',
          country: 'US'
        },
        shippingMethod: 'standard',
        paymentMethod: 'stripe'
      })
      .expect(201);

    orderId = orderResponse.body.data.id;
    expect(orderResponse.body.data.status).toBe('PENDING');
    expect(orderResponse.body.data.total).toBe(199.98);

    // Step 6: Verify inventory reduction
    const productVerification = await request(app)
      .get(`/api/v1/products/${productId}`)
      .expect(200);

    expect(productVerification.body.data.quantity).toBe(8); // 10 - 2

    // Step 7: Verify cart is cleared
    const cartAfterOrder = await request(app)
      .get('/api/v1/carts')
      .set('Cookie', sessionCookie)
      .expect(200);

    expect(cartAfterOrder.body.data.items).toHaveLength(0);

    // Step 8: Process payment (simulate)
    await request(app)
      .put(`/api/v1/orders/${orderId}/status`)
      .send({
        status: 'PAID',
        paymentId: 'pi_test_payment'
      })
      .expect(200);

    // Step 9: Verify final order status
    const finalOrder = await request(app)
      .get(`/api/v1/orders/${orderId}`)
      .expect(200);

    expect(finalOrder.body.data.status).toBe('PAID');
  });
});
```

## API Testing

### Automated API Testing

```typescript
// tests/integration/api/api-contracts.test.ts
import request from 'supertest';
import app from '../../../src/index';
import { OpenAPIV3 } from 'openapi-types';
import * as fs from 'fs';
import * as path from 'path';

// Load OpenAPI specification
const openApiSpec: OpenAPIV3.Document = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../../../docs/api/openapi.json'), 'utf8')
);

describe('API Contract Testing', () => {
  describe('OpenAPI Specification Compliance', () => {
    it('should match OpenAPI spec for GET /api/v1/products', async () => {
      const response = await request(app)
        .get('/api/v1/products')
        .expect(200);

      // Validate response structure matches OpenAPI spec
      const productSchema = openApiSpec.components?.schemas?.Product;
      expect(productSchema).toBeDefined();

      // Validate each product in response
      response.body.data.forEach((product: any) => {
        expect(product).toHaveProperty('id');
        expect(product).toHaveProperty('name');
        expect(product).toHaveProperty('sku');
        expect(product).toHaveProperty('price');
        expect(typeof product.price).toBe('number');
      });
    });

    it('should return correct error format', async () => {
      const response = await request(app)
        .get('/api/v1/products/invalid-id')
        .expect(404);

      expect(response.body).toMatchObject({
        error: {
          code: expect.any(String),
          message: expect.any(String),
          timestamp: expect.any(String),
          requestId: expect.any(String)
        }
      });
    });
  });
});
```

## Performance Testing

### Load Testing

```typescript
// tests/performance/load.perf.test.ts
import { performance } from 'perf_hooks';
import request from 'supertest';
import app from '../../src/index';

describe('Performance Tests', () => {
  describe('Product API Performance', () => {
    it('should handle 100 concurrent requests', async () => {
      const startTime = performance.now();
      
      const promises = Array.from({ length: 100 }, () =>
        request(app).get('/api/v1/products')
      );

      const responses = await Promise.all(promises);
      const endTime = performance.now();

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Should complete within 5 seconds
      const duration = endTime - startTime;
      expect(duration).toBeLessThan(5000);

      console.log(`100 concurrent requests completed in ${duration.toFixed(2)}ms`);
    });

    it('should respond within acceptable time limits', async () => {
      const startTime = performance.now();
      
      await request(app)
        .get('/api/v1/products')
        .expect(200);

      const duration = performance.now() - startTime;
      
      // Single request should be fast
      expect(duration).toBeLessThan(200);
    });
  });

  describe('Database Performance', () => {
    it('should handle complex queries efficiently', async () => {
      const startTime = performance.now();

      await request(app)
        .get('/api/v1/products?search=test&minPrice=10&maxPrice=1000&sortBy=price&sortOrder=desc&page=1&limit=50')
        .expect(200);

      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(500);
    });
  });
});
```

## Test Data Management

### Test Fixtures

```typescript
// tests/fixtures/products.ts
export const productFixtures = {
  validProduct: {
    name: 'Test Product',
    sku: 'TEST001',
    price: 99.99,
    status: 'PUBLISHED' as const,
    description: 'A test product',
    quantity: 100
  },

  expensiveProduct: {
    name: 'Expensive Product',
    sku: 'EXP001',
    price: 9999.99,
    status: 'PUBLISHED' as const,
    quantity: 5
  },

  outOfStockProduct: {
    name: 'Out of Stock Product',
    sku: 'OOS001',
    price: 49.99,
    status: 'PUBLISHED' as const,
    quantity: 0
  }
};

export const categoryFixtures = {
  electronics: {
    name: 'Electronics',
    slug: 'electronics',
    description: 'Electronic devices',
    isActive: true
  },

  clothing: {
    name: 'Clothing',
    slug: 'clothing',
    description: 'Fashion and apparel',
    isActive: true
  }
};
```

### Database Helpers

```typescript
// tests/helpers/database.ts
import { PrismaClient } from '@prisma/client';
import { productFixtures, categoryFixtures } from '../fixtures';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_TEST_URL
    }
  }
});

export async function setupTestDatabase() {
  await prisma.$connect();
  await cleanupTestDatabase();
  return seedTestData();
}

export async function cleanupTestDatabase() {
  // Delete in correct order to handle foreign keys
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.customer.deleteMany();
}

export async function seedTestData() {
  // Create categories
  const electronicsCategory = await prisma.category.create({
    data: categoryFixtures.electronics
  });

  const clothingCategory = await prisma.category.create({
    data: categoryFixtures.clothing
  });

  // Create products
  const product1 = await prisma.product.create({
    data: {
      ...productFixtures.validProduct,
      categoryId: electronicsCategory.id
    }
  });

  const product2 = await prisma.product.create({
    data: {
      ...productFixtures.expensiveProduct,
      categoryId: electronicsCategory.id
    }
  });

  return {
    categories: { electronicsCategory, clothingCategory },
    products: { product1, product2 }
  };
}

export { prisma };
```

## Running Tests

### Test Scripts

```json
{
  "scripts": {
    "test": "jest",
    "test:unit": "jest --testPathPattern=unit",
    "test:integration": "jest --testPathPattern=integration",
    "test:e2e": "jest --testPathPattern=e2e",
    "test:performance": "jest --testPathPattern=performance",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:ci": "jest --ci --coverage --watchAll=false"
  }
}
```

### Running Different Test Types

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests
npm run test:integration

# Run E2E tests
npm run test:e2e

# Run with coverage
npm run test:coverage

# Watch mode for development
npm run test:watch

# Run specific test file
npm test -- products.test.ts

# Run tests matching pattern
npm test -- --testNamePattern="should create product"
```

## Continuous Integration

### GitHub Actions Configuration

```yaml
# .github/workflows/test.yml
name: Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: commerce_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379

    strategy:
      matrix:
        node-version: [18.x, 20.x]

    steps:
    - uses: actions/checkout@v3

    - name: Use Node.js ${{ matrix.node-version }}
      uses: actions/setup-node@v3
      with:
        node-version: ${{ matrix.node-version }}
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Run linting
      run: npm run lint

    - name: Run type checking
      run: npm run type-check

    - name: Setup test database
      env:
        DATABASE_TEST_URL: postgresql://postgres:postgres@localhost:5432/commerce_test
      run: npx prisma migrate deploy

    - name: Run unit tests
      run: npm run test:unit

    - name: Run integration tests
      env:
        DATABASE_TEST_URL: postgresql://postgres:postgres@localhost:5432/commerce_test
        REDIS_TEST_URL: redis://localhost:6379
      run: npm run test:integration

    - name: Run E2E tests
      env:
        DATABASE_TEST_URL: postgresql://postgres:postgres@localhost:5432/commerce_test
        REDIS_TEST_URL: redis://localhost:6379
      run: npm run test:e2e

    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage/lcov.info
        flags: unittests
        name: codecov-umbrella
```

## Best Practices

### 1. Test Organization

- **Arrange, Act, Assert**: Structure tests clearly
- **Descriptive names**: Test names should explain what they test
- **Single responsibility**: Each test should test one thing
- **Independent tests**: Tests shouldn't depend on each other

### 2. Mock Strategy

- **Mock external dependencies**: Database, APIs, file system
- **Don't mock what you own**: Test real business logic
- **Verify interactions**: Ensure mocks are called correctly
- **Reset mocks**: Clean state between tests

### 3. Test Data

- **Use factories**: Create reusable test data generators
- **Minimal data**: Only include necessary fields
- **Realistic data**: Use data that represents real usage
- **Clean up**: Remove test data after tests

### 4. Performance

- **Parallel execution**: Run tests concurrently when possible
- **Database optimization**: Use transactions for rollback
- **Selective testing**: Run relevant tests during development
- **CI optimization**: Cache dependencies and artifacts

## Troubleshooting

### Common Issues

1. **Flaky tests**: Usually caused by timing or external dependencies
2. **Slow tests**: Often due to real database calls or network requests
3. **Memory leaks**: Not properly cleaning up resources
4. **Test pollution**: Tests affecting each other's state

### Debug Tips

```bash
# Run tests with debug output
DEBUG=* npm test

# Run single test file with verbose output
npm test -- --verbose products.test.ts

# Run tests with Node.js inspector
node --inspect-brk node_modules/.bin/jest --runInBand

# Generate coverage report
npm run test:coverage
open coverage/lcov-report/index.html
```

---

*Testing is crucial for maintaining code quality and preventing regressions. Follow these practices to ensure your commerce system is reliable and maintainable.*