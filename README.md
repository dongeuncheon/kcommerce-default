# Commerce Base Plugin

A reusable universal commerce system that provides all essential features needed for online shopping platforms including product management, order processing, payment, and customer management.

## Features

- **Product Management**: Complete CRUD operations with hierarchical categories and tagging
- **Shopping Cart**: Real-time synchronization across devices with guest support
- **Order Management**: Full order lifecycle tracking with status management
- **Payment Processing**: Multiple payment methods and gateway integration
- **Shipping Management**: Flexible shipping options with cost calculation
- **Customer Management**: Profile and order history management

## Technology Stack

### Backend
- **Runtime**: Node.js v18+ with TypeScript
- **Framework**: Express.js with plugin architecture
- **Database**: PostgreSQL (primary) with multi-adapter support
- **ORM**: Prisma for type-safe database operations
- **Caching**: Redis for sessions and performance
- **Authentication**: JWT with bcrypt password hashing

### API & Communication
- **REST API**: Express-based RESTful endpoints
- **GraphQL**: Optional Apollo Server integration
- **WebSocket**: Real-time features with Socket.io
- **Documentation**: OpenAPI/Swagger integration

### Security & Performance
- **Security**: Helmet.js, CORS, rate limiting
- **Monitoring**: Winston logging, Prometheus metrics
- **Testing**: Jest with comprehensive test coverage
- **Build**: TypeScript compilation with esbuild

## Project Structure

```
├── src/                 # Source code
│   ├── modules/        # Core commerce modules
│   ├── plugins/        # Plugin system
│   ├── api/           # API routes and controllers
│   └── types/         # TypeScript type definitions
├── tests/              # Test files
│   ├── unit/          # Unit tests
│   ├── integration/   # Integration tests
│   └── e2e/           # End-to-end tests
├── docs/               # Documentation
│   ├── api/           # API documentation
│   └── guides/        # User guides
└── scripts/            # Build and deployment scripts
```

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- PostgreSQL (v13 or higher)
- npm or yarn

### Installation

1. Clone the repository
```bash
git clone <repository-url>
cd 02-commerce-plugin
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables
```bash
cp .env.example .env
```

4. Run database migrations
```bash
npm run migrate
```

5. Start the development server
```bash
npm run dev
```

## Development

### Running Tests

```bash
# Run all tests
npm test

# Run unit tests
npm run test:unit

# Run integration tests
npm run test:integration

# Run e2e tests
npm run test:e2e
```

### Building

```bash
npm run build
```

## Plugin Architecture

This commerce system is built with a plugin-based architecture that allows for easy extension and customization:

- **Module System**: Each commerce feature is implemented as a module
- **Plugin Interface**: Standardized interface for extending functionality
- **Event System**: Event-driven architecture for loose coupling
- **Data Models**: Extensible data models with custom fields support

## API Documentation

API documentation is available at `/docs/api` when running the development server.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For support and questions, please open an issue in the repository.