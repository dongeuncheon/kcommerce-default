import swaggerJSDoc from 'swagger-jsdoc';
import fs from 'fs';
import path from 'path';
import { logger } from '../src/utils/logger';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'NewTravel Commerce Plugin API',
      version: '1.0.0',
      description: `
# NewTravel Commerce Plugin API

A comprehensive, production-ready commerce system providing a complete set of e-commerce APIs.

## Features

- **Product Management**: Complete product catalog with variants, options, and inventory tracking
- **Shopping Cart**: Real-time cart synchronization with guest and authenticated user support
- **Order Management**: Full order lifecycle from creation to fulfillment
- **Payment Processing**: Multi-gateway payment integration with security features
- **Inventory Management**: Real-time stock tracking with low-stock alerts
- **Category Management**: Hierarchical product categorization
- **Pricing Management**: Dynamic pricing with promotions and discounts
- **Security**: Enterprise-grade security with rate limiting and validation
- **Performance**: Optimized queries, caching, and CDN integration
- **Real-time Features**: WebSocket support for live cart and order updates

## Authentication

This API supports multiple authentication methods:
- JWT Bearer tokens for authenticated users
- Session-based authentication for guest users
- API key authentication for server-to-server communication

## Rate Limiting

API endpoints are protected with intelligent rate limiting:
- Authentication endpoints: 5 requests per minute
- Payment endpoints: 10 requests per minute
- Search endpoints: 100 requests per minute
- General API endpoints: 1000 requests per minute

Rate limits are adaptive and may adjust based on user behavior and system load.

## Error Handling

All API responses follow a consistent error format:

\`\`\`json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": "Additional error details",
    "timestamp": "2024-01-01T00:00:00Z",
    "requestId": "unique-request-id"
  }
}
\`\`\`

## Performance

- All list endpoints support pagination
- Responses include caching headers
- Large payloads are compressed
- Database queries are optimized with proper indexing

## Real-time Features

WebSocket connections are available for:
- Cart synchronization across devices
- Order status updates
- Inventory level changes
- Price updates

Connect to: \`ws://localhost:3000/socket.io\`
`,
      termsOfService: 'https://newtravel.com/terms',
      contact: {
        name: 'NewTravel API Support',
        url: 'https://newtravel.com/support',
        email: 'api-support@newtravel.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server'
      },
      {
        url: 'https://api-staging.newtravel.com',
        description: 'Staging server'
      },
      {
        url: 'https://api.newtravel.com',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token for authenticated users'
        },
        sessionAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'sessionId',
          description: 'Session cookie for guest users'
        },
        apiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'API key for server-to-server communication'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          required: ['code', 'message'],
          properties: {
            code: {
              type: 'string',
              description: 'Error code for programmatic handling'
            },
            message: {
              type: 'string',
              description: 'Human-readable error message'
            },
            details: {
              type: 'string',
              description: 'Additional error details'
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              description: 'Error timestamp'
            },
            requestId: {
              type: 'string',
              description: 'Unique request identifier for debugging'
            }
          }
        },
        PaginationMeta: {
          type: 'object',
          properties: {
            page: {
              type: 'integer',
              description: 'Current page number'
            },
            limit: {
              type: 'integer',
              description: 'Items per page'
            },
            total: {
              type: 'integer',
              description: 'Total number of items'
            },
            totalPages: {
              type: 'integer',
              description: 'Total number of pages'
            },
            hasNextPage: {
              type: 'boolean',
              description: 'Whether there are more pages'
            },
            hasPrevPage: {
              type: 'boolean',
              description: 'Whether there are previous pages'
            }
          }
        }
      },
      responses: {
        BadRequest: {
          description: 'Bad Request - Invalid input parameters',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                code: 'INVALID_INPUT',
                message: 'Invalid request parameters',
                details: 'The provided data does not meet validation requirements',
                timestamp: '2024-01-01T00:00:00Z',
                requestId: 'req_123456789'
              }
            }
          }
        },
        Unauthorized: {
          description: 'Unauthorized - Authentication required',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                code: 'UNAUTHORIZED',
                message: 'Authentication required',
                details: 'Please provide valid authentication credentials',
                timestamp: '2024-01-01T00:00:00Z',
                requestId: 'req_123456789'
              }
            }
          }
        },
        Forbidden: {
          description: 'Forbidden - Insufficient permissions',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                code: 'FORBIDDEN',
                message: 'Insufficient permissions',
                details: 'You do not have permission to access this resource',
                timestamp: '2024-01-01T00:00:00Z',
                requestId: 'req_123456789'
              }
            }
          }
        },
        NotFound: {
          description: 'Not Found - Resource does not exist',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                code: 'NOT_FOUND',
                message: 'Resource not found',
                details: 'The requested resource does not exist',
                timestamp: '2024-01-01T00:00:00Z',
                requestId: 'req_123456789'
              }
            }
          }
        },
        TooManyRequests: {
          description: 'Too Many Requests - Rate limit exceeded',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                code: 'RATE_LIMIT_EXCEEDED',
                message: 'Rate limit exceeded',
                details: 'Please try again later',
                timestamp: '2024-01-01T00:00:00Z',
                requestId: 'req_123456789'
              }
            }
          }
        },
        InternalServerError: {
          description: 'Internal Server Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                code: 'INTERNAL_ERROR',
                message: 'Internal server error',
                details: 'An unexpected error occurred',
                timestamp: '2024-01-01T00:00:00Z',
                requestId: 'req_123456789'
              }
            }
          }
        }
      }
    },
    tags: [
      {
        name: 'Products',
        description: 'Product catalog management'
      },
      {
        name: 'Categories',
        description: 'Product category management'
      },
      {
        name: 'Cart',
        description: 'Shopping cart operations'
      },
      {
        name: 'Orders',
        description: 'Order management'
      },
      {
        name: 'Payment',
        description: 'Payment processing'
      },
      {
        name: 'Inventory',
        description: 'Stock and inventory management'
      },
      {
        name: 'Pricing',
        description: 'Pricing and promotions'
      },
      {
        name: 'Customers',
        description: 'Customer management'
      },
      {
        name: 'Shipping',
        description: 'Shipping and delivery options'
      },
      {
        name: 'Security',
        description: 'Security and fraud prevention'
      },
      {
        name: 'Admin',
        description: 'Administrative operations'
      },
      {
        name: 'Health',
        description: 'System health and monitoring'
      }
    ]
  },
  apis: [
    './src/api/routes/*.ts',
    './src/api/controllers/*.ts',
    './src/types/*.ts'
  ]
};

async function generateOpenAPISpec() {
  try {
    logger.info('Generating OpenAPI specification...');
    
    const specs = swaggerJSDoc(options);
    
    // Ensure docs/api directory exists
    const docsDir = path.join(__dirname, '../docs/api');
    if (!fs.existsSync(docsDir)) {
      fs.mkdirSync(docsDir, { recursive: true });
    }
    
    // Write OpenAPI spec in JSON format
    const jsonPath = path.join(docsDir, 'openapi.json');
    fs.writeFileSync(jsonPath, JSON.stringify(specs, null, 2));
    logger.info(`OpenAPI JSON specification written to ${jsonPath}`);
    
    // Write OpenAPI spec in YAML format
    const yaml = require('js-yaml');
    const yamlPath = path.join(docsDir, 'openapi.yaml');
    fs.writeFileSync(yamlPath, yaml.dump(specs));
    logger.info(`OpenAPI YAML specification written to ${yamlPath}`);
    
    logger.info('OpenAPI specification generated successfully!');
    
  } catch (error) {
    logger.error('Failed to generate OpenAPI specification:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  generateOpenAPISpec();
}

export { generateOpenAPISpec };