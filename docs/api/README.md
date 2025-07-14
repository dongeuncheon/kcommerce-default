# API Documentation

## Overview

The NewTravel Commerce Plugin provides a comprehensive RESTful API for all e-commerce operations. The API is built with OpenAPI 3.0 specification and includes interactive documentation.

## Access Points

### Interactive Documentation
- **Swagger UI**: [http://localhost:3000/api-docs](http://localhost:3000/api-docs)
- **ReDoc**: [http://localhost:3000/redoc](http://localhost:3000/redoc)
- **OpenAPI JSON**: [http://localhost:3000/api-docs.json](http://localhost:3000/api-docs.json)

### Base URL
```
Development: http://localhost:3000
Staging:     https://api-staging.newtravel.com
Production:  https://api.newtravel.com
```

## Authentication

The API supports multiple authentication methods:

### 1. JWT Bearer Tokens (Recommended)
For authenticated users and server-to-server communication:

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  https://api.newtravel.com/api/v1/products
```

### 2. Session Cookies
For web applications using session-based authentication:

```bash
curl -H "Cookie: sessionId=YOUR_SESSION_ID" \
  https://api.newtravel.com/api/v1/carts
```

### 3. API Keys
For server-to-server integration:

```bash
curl -H "X-API-Key: YOUR_API_KEY" \
  https://api.newtravel.com/api/v1/orders
```

## Rate Limiting

The API implements intelligent rate limiting with different limits for different endpoint categories:

| Endpoint Category | Rate Limit | Notes |
|------------------|------------|-------|
| Authentication | 5/minute | Login, registration |
| Payment | 10/minute | Payment processing |
| Search | 100/minute | Product search |
| General API | 1000/minute | Most endpoints |

Rate limiting is adaptive and may adjust based on:
- User behavior patterns
- System load
- Authentication status
- User tier/subscription level

### Rate Limit Headers
All responses include rate limiting information:

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1609459200
X-RateLimit-Retry-After: 60
```

## Versioning

The API uses URL versioning with the current version being `v1`:

```
/api/v1/products
/api/v1/categories
/api/v1/orders
```

### Version Support
- **v1**: Current stable version
- **v2**: In development (preview available)

### Deprecation Policy
- New versions are announced 6 months in advance
- Deprecated versions are supported for 12 months
- Breaking changes require a new version

## Common Patterns

### Pagination

All list endpoints support pagination:

```http
GET /api/v1/products?page=1&limit=20
```

**Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)

**Response:**
```json
{
  "data": [...],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 500,
    "totalPages": 25,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

### Filtering and Sorting

Most list endpoints support filtering and sorting:

```http
GET /api/v1/products?category=electronics&minPrice=100&sortBy=price&sortOrder=asc
```

### Search

Search functionality is available with various parameters:

```http
GET /api/v1/products?search=laptop&inStock=true&isFeatured=true
```

### Error Handling

All errors follow a consistent format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input parameters",
    "details": "Price must be a positive number",
    "timestamp": "2024-06-06T12:00:00Z",
    "requestId": "req_123456789"
  }
}
```

Common HTTP status codes:
- `200`: Success
- `201`: Created
- `400`: Bad Request
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found
- `409`: Conflict
- `422`: Validation Error
- `429`: Rate Limit Exceeded
- `500`: Internal Server Error

## API Endpoints

### Product Management
- [Products API](./endpoints/products.md)
- [Categories API](./endpoints/categories.md)
- [Product Options API](./endpoints/product-options.md)
- [Inventory API](./endpoints/inventory.md)

### Commerce Operations
- [Cart API](./endpoints/cart.md)
- [Orders API](./endpoints/orders.md)
- [Payment API](./endpoints/payment.md)
- [Shipping API](./endpoints/shipping.md)

### Customer Management
- [Customers API](./endpoints/customers.md)
- [Authentication API](./endpoints/auth.md)

### System & Admin
- [Admin API](./endpoints/admin.md)
- [Security API](./endpoints/security.md)
- [Health API](./endpoints/health.md)

## Code Examples

### JavaScript/Node.js

```javascript
// Using fetch API
const response = await fetch('https://api.newtravel.com/api/v1/products', {
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN',
    'Content-Type': 'application/json'
  }
});
const products = await response.json();

// Using axios
import axios from 'axios';

const client = axios.create({
  baseURL: 'https://api.newtravel.com/api/v1',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN'
  }
});

const products = await client.get('/products');
```

### Python

```python
import requests

headers = {
    'Authorization': 'Bearer YOUR_TOKEN',
    'Content-Type': 'application/json'
}

response = requests.get(
    'https://api.newtravel.com/api/v1/products',
    headers=headers
)
products = response.json()
```

### PHP

```php
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, 'https://api.newtravel.com/api/v1/products');
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Authorization: Bearer YOUR_TOKEN',
    'Content-Type: application/json'
]);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

$response = curl_exec($ch);
$products = json_decode($response, true);
curl_close($ch);
```

### cURL

```bash
# Get all products
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://api.newtravel.com/api/v1/products

# Create a new product
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"New Product","price":99.99,"sku":"NP001"}' \
  https://api.newtravel.com/api/v1/products

# Add item to cart
curl -X POST \
  -H "Cookie: sessionId=YOUR_SESSION" \
  -H "Content-Type: application/json" \
  -d '{"productId":"prod_123","quantity":2}' \
  https://api.newtravel.com/api/v1/carts/items
```

## SDKs and Client Libraries

### Official SDKs
- [JavaScript/TypeScript SDK](./sdks/javascript.md)
- [Python SDK](./sdks/python.md)
- [PHP SDK](./sdks/php.md)
- [Go SDK](./sdks/go.md)

### Community SDKs
- Ruby SDK (community maintained)
- Java SDK (community maintained)
- C# SDK (community maintained)

## Testing

### Postman Collections
Download our complete Postman collections:
- [Development Collection](./postman/development.json)
- [Production Collection](./postman/production.json)
- [Testing Collection](./postman/testing.json)

### Test Data
We provide test data for development:
- [Sample Products](./test-data/products.json)
- [Sample Categories](./test-data/categories.json)
- [Sample Orders](./test-data/orders.json)

## Performance

### Caching
- Most GET endpoints are cached for 5-60 minutes
- Cache headers are included in responses
- Use `Cache-Control: no-cache` to bypass cache

### Compression
- All responses support gzip compression
- Include `Accept-Encoding: gzip` header

### CDN
- Static assets are served from CDN
- Image optimization is automatic
- Global edge locations for reduced latency

## Webhooks

The API supports webhooks for real-time event notifications:

```json
{
  "event": "order.created",
  "data": {
    "orderId": "order_123",
    "customerId": "customer_456",
    "amount": 99.99
  },
  "timestamp": "2024-06-06T12:00:00Z"
}
```

See [Webhook Documentation](../integration/webhooks.md) for details.

## Support

### Documentation
- [Error Codes Reference](./error-codes.md)
- [Changelog](./changelog.md)
- [Migration Guides](./migrations/)

### Help & Support
- [GitHub Issues](https://github.com/your-org/commerce-plugin/issues)
- [API Support Email](mailto:api-support@newtravel.com)
- [Community Forum](https://community.newtravel.com)

---

*For detailed endpoint documentation, visit the [Interactive API Explorer](http://localhost:3000/api-docs)*