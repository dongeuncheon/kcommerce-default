# Commerce Core System

A modern, modular e-commerce platform built with TypeScript, Express/Fastify, and Next.js.

## Overview

Commerce Core is a comprehensive e-commerce solution designed with modularity, scalability, and developer experience in mind. It provides a robust foundation for building custom e-commerce applications with features like product management, shopping cart, checkout, payment processing, and order management.

## Key Features

- **Product Management**: Comprehensive product catalog with variants, categories, and inventory tracking
- **Shopping Cart**: Persistent cart management with session support
- **Checkout Process**: Multi-step checkout with address management and payment options
- **Payment Integration**: Support for multiple payment gateways (Stripe, PayPal, etc.)
- **Order Management**: Complete order lifecycle management with status tracking
- **Customer Management**: User accounts, order history, and wishlist functionality
- **Inventory Management**: Real-time inventory tracking and stock alerts
- **Promotions & Discounts**: Flexible promotion engine with coupon support
- **Multi-currency Support**: Handle multiple currencies with automatic conversion
- **Tax Calculation**: Configurable tax rules by region
- **Shipping Integration**: Multiple shipping providers and rate calculation
- **Analytics & Reporting**: Built-in analytics for sales and customer insights

## Architecture

The Commerce Core system follows a modular architecture:

- **Core**: Foundation services (DI container, repository pattern, caching)
- **Modules**: Self-contained commerce features (products, cart, checkout, orders)
- **Adapters**: Database and external service integrations
- **Security**: Authentication, authorization, and security middleware
- **Client**: Next.js frontend application

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Database (PostgreSQL, MySQL, or MongoDB)
- Redis (optional, for caching)

### Installation

```bash
# Install dependencies
npm install

# Install client dependencies
cd client && npm install && cd ..

# Copy and configure environment files
cp .env.example .env
cp config/default.json config/development.json

# Run database migrations
npm run migrate

# Start development servers
npm run dev
```

### Configuration

1. Update `.env` with your database credentials and API keys
2. Configure payment gateways in `config/development.json`
3. Set up shipping providers and tax rules

## Project Structure

```
03-commerce-core/
├── src/                    # Server source code
│   ├── core/              # Core system components
│   ├── modules/           # Commerce modules
│   │   ├── product/       # Product management
│   │   ├── cart/          # Shopping cart
│   │   ├── checkout/      # Checkout process
│   │   ├── order/         # Order management
│   │   ├── payment/       # Payment processing
│   │   ├── customer/      # Customer management
│   │   ├── inventory/     # Inventory tracking
│   │   └── shipping/      # Shipping integration
│   ├── adapters/          # Database adapters
│   ├── security/          # Security middleware
│   └── types/             # TypeScript types
├── client/                # Next.js frontend
│   ├── src/
│   │   ├── app/          # App router pages
│   │   ├── components/    # React components
│   │   └── lib/          # Client utilities
├── config/               # Configuration files
├── docs/                 # Documentation
└── tests/                # Test suites
```

## Development

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

### Code Quality

```bash
# Run linter
npm run lint

# Format code
npm run format
```

## API Documentation

API documentation is available at `/api/docs` when running in development mode.

## Contributing

Please read our contributing guidelines before submitting pull requests.

## License

MIT License - see LICENSE file for details

## Support

For questions and support, please refer to our documentation or open an issue.