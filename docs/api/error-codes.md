# API Error Codes Reference

This document provides comprehensive information about all error codes returned by the Commerce API.

## Error Response Format

All errors follow a consistent response format:

```json
{
  "success": false,
  "error": {
    "type": "ErrorType",
    "message": "Human readable error message",
    "code": "ERROR_CODE",
    "timestamp": "2024-01-01T00:00:00.000Z",
    "requestId": "req_1234567890_abcdef123",
    "details": {
      // Additional error-specific details
    },
    "documentation": "/docs/errors#error-type"
  }
}
```

## Error Categories

### Validation Errors (400)

#### INVALID_INPUT
- **Description**: General validation failure for request input
- **Example**: Missing required fields, invalid data types
- **Resolution**: Check the `details` field for specific validation errors

#### MISSING_FIELD
- **Description**: Required field is missing from request
- **Example**: `{ "field": "email", "message": "Email is required" }`
- **Resolution**: Include the missing field in your request

#### INVALID_FORMAT
- **Description**: Field value doesn't match expected format
- **Example**: Invalid email format, invalid phone number
- **Resolution**: Ensure field values match the expected format

#### FILE_TOO_LARGE
- **Description**: Uploaded file exceeds size limit
- **Details**: `{ "maxSize": 5242880, "received": 10485760 }`
- **Resolution**: Reduce file size or use a smaller file

#### INVALID_FILE_TYPE
- **Description**: Uploaded file type is not allowed
- **Details**: `{ "allowed": ["image/jpeg", "image/png"], "received": "text/plain" }`
- **Resolution**: Upload a file with an allowed MIME type

### Authentication Errors (401)

#### INVALID_CREDENTIALS
- **Description**: Login credentials are incorrect
- **Resolution**: Verify username/password and try again

#### TOKEN_EXPIRED
- **Description**: Authentication token has expired
- **Resolution**: Refresh your token or login again

#### TOKEN_INVALID
- **Description**: Authentication token is malformed or invalid
- **Resolution**: Obtain a new authentication token

### Authorization Errors (403)

#### INSUFFICIENT_PERMISSIONS
- **Description**: User lacks required permissions for this action
- **Resolution**: Contact administrator to request appropriate permissions

#### ACCESS_DENIED
- **Description**: Access to resource is denied
- **Resolution**: Ensure you have access rights to the requested resource

#### CSRF_TOKEN_MISSING
- **Description**: CSRF token is missing from request
- **Resolution**: Include valid CSRF token in request headers

#### CSRF_TOKEN_INVALID
- **Description**: CSRF token is invalid or expired
- **Resolution**: Obtain new CSRF token and retry request

### Not Found Errors (404)

#### NOT_FOUND
- **Description**: Requested resource does not exist
- **Details**: `{ "resource": "Product", "id": "123" }`
- **Resolution**: Verify resource ID and ensure resource exists

### Conflict Errors (409)

#### CONFLICT
- **Description**: Request conflicts with current state
- **Example**: Duplicate email during registration
- **Resolution**: Resolve the conflict and retry

### Rate Limiting Errors (429)

#### RATE_LIMIT_EXCEEDED
- **Description**: Request rate limit exceeded for your tier
- **Details**: `{ "tier": "basic", "limit": 100, "retryAfter": 60 }`
- **Resolution**: Wait before making additional requests or upgrade tier

#### TOO_MANY_REQUESTS
- **Description**: Too many requests in a short period
- **Headers**: `Retry-After: 60`
- **Resolution**: Implement exponential backoff retry strategy

### Business Logic Errors (422)

#### PRODUCT_OUT_OF_STOCK
- **Description**: Requested product is out of stock
- **Details**: `{ "productId": "123", "requestedQuantity": 5, "availableQuantity": 0 }`
- **Resolution**: Reduce quantity or choose different product

#### INVALID_QUANTITY
- **Description**: Invalid quantity specified
- **Details**: `{ "min": 1, "max": 10, "received": 15 }`
- **Resolution**: Specify quantity within allowed range

#### PAYMENT_FAILED
- **Description**: Payment processing failed
- **Details**: `{ "gateway": "stripe", "code": "card_declined" }`
- **Resolution**: Check payment details and try again

### System Errors (500)

#### DATABASE_ERROR
- **Description**: Database operation failed
- **Resolution**: Retry request or contact support if problem persists

#### EXTERNAL_SERVICE_ERROR
- **Description**: External service is unavailable
- **Details**: `{ "service": "payment_gateway", "timeout": true }`
- **Resolution**: Retry request or try again later

#### CONFIGURATION_ERROR
- **Description**: System configuration error
- **Resolution**: Contact system administrator

#### SYSTEM_ERROR
- **Description**: General system error
- **Resolution**: Retry request or contact support

### Service Unavailable (503)

#### SERVICE_UNAVAILABLE
- **Description**: Service is temporarily unavailable
- **Headers**: `Retry-After: 30`
- **Resolution**: Wait and retry request

#### CIRCUIT_BREAKER_OPEN
- **Description**: Circuit breaker is open for this service
- **Details**: `{ "service": "payment", "retryAfter": 60 }`
- **Resolution**: Wait for circuit breaker to close

## Security Errors

#### SUSPICIOUS_ACTIVITY
- **Description**: Suspicious activity detected
- **Resolution**: Contact support if you believe this is an error

#### IP_BLOCKED
- **Description**: Your IP address has been blocked
- **Resolution**: Contact support to resolve the block

#### SUSPICIOUS_PATTERN
- **Description**: Request contains suspicious patterns
- **Resolution**: Review request content and remove suspicious elements

## Retry Strategies

### Exponential Backoff
For rate limiting and temporary failures:
```
delay = min(base_delay * (2 ^ attempt), max_delay)
```

### Linear Backoff
For service unavailable errors:
```
delay = base_delay * attempt
```

### Immediate Retry
For validation errors (after fixing the issue):
- No delay required
- Fix validation errors and retry immediately

## Error Handling Best Practices

### Client Implementation
```javascript
async function apiRequest(url, options, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      if (response.ok) {
        return await response.json();
      }
      
      const error = await response.json();
      
      // Handle specific error types
      switch (error.error.code) {
        case 'RATE_LIMIT_EXCEEDED':
          const retryAfter = parseInt(response.headers.get('Retry-After')) || 60;
          await sleep(retryAfter * 1000);
          continue;
          
        case 'TOKEN_EXPIRED':
          await refreshToken();
          continue;
          
        case 'VALIDATION_ERROR':
          // Don't retry validation errors
          throw error;
          
        default:
          if (attempt === maxRetries) throw error;
          await sleep(Math.pow(2, attempt) * 1000); // Exponential backoff
      }
    } catch (networkError) {
      if (attempt === maxRetries) throw networkError;
      await sleep(Math.pow(2, attempt) * 1000);
    }
  }
}
```

### Error Logging
Always log errors with context:
```javascript
logger.error('API request failed', {
  url,
  method,
  statusCode: error.status,
  errorCode: error.error.code,
  requestId: error.error.requestId,
  userAction: 'checkout_attempt'
});
```

## Status Code Summary

| Status | Category | Description |
|--------|----------|-------------|
| 400 | Client Error | Bad Request - Validation failed |
| 401 | Client Error | Unauthorized - Authentication required |
| 403 | Client Error | Forbidden - Access denied |
| 404 | Client Error | Not Found - Resource doesn't exist |
| 409 | Client Error | Conflict - Resource conflict |
| 422 | Client Error | Unprocessable Entity - Business logic error |
| 429 | Client Error | Too Many Requests - Rate limited |
| 500 | Server Error | Internal Server Error |
| 502 | Server Error | Bad Gateway - Upstream service error |
| 503 | Server Error | Service Unavailable - Temporary unavailability |
| 504 | Server Error | Gateway Timeout - Upstream timeout |

## Getting Help

If you encounter errors not covered in this documentation:

1. Check the error `details` field for additional context
2. Use the `requestId` when contacting support
3. Review the `documentation` URL for specific error guidance
4. Check system status page for known issues

For persistent issues, contact our support team with:
- Request ID
- Timestamp
- Full error response
- Steps to reproduce