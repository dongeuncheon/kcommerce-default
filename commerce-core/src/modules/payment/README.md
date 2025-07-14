# Payment Module

A comprehensive payment system integration for Korean e-commerce with support for multiple payment gateways including Kakao Pay, Naver Pay, Toss Payments, NicePay, and Bank Transfer.

## Features

- **Multiple Korean Payment Gateways**: Support for Kakao Pay, Naver Pay, Toss Payments, NicePay, and Bank Transfer
- **Unified API**: Single interface for all payment operations across different gateways
- **Security Features**: PCI compliance, encryption, webhook verification, rate limiting
- **Order Integration**: Seamless integration with order management system
- **Webhook Handling**: Robust webhook processing with retry mechanism
- **Transaction Logging**: Comprehensive audit trails and security logging
- **Flexible Architecture**: Easy to add new payment gateways

## Installation

```bash
npm install
```

## Quick Start

```typescript
import { createPaymentModule, PaymentGateway } from './modules/payment';

// Configure payment module
const paymentModule = createPaymentModule({
  gateways: {
    [PaymentGateway.TOSS_PAY]: {
      gateway: PaymentGateway.TOSS_PAY,
      enabled: true,
      sandbox: true,
      credentials: {
        clientId: 'your_toss_client_id',
        secretKey: 'your_toss_secret_key',
      },
      supportedMethods: ['CREDIT_CARD', 'VIRTUAL_ACCOUNT'],
      supportedCurrencies: ['KRW'],
    },
    [PaymentGateway.KAKAO_PAY]: {
      gateway: PaymentGateway.KAKAO_PAY,
      enabled: true,
      sandbox: true,
      credentials: {
        clientId: 'your_kakao_cid',
        adminKey: 'your_kakao_admin_key',
      },
      supportedMethods: ['MOBILE_PAYMENT'],
      supportedCurrencies: ['KRW'],
    },
  },
  security: {
    encryptionKey: process.env.PAYMENT_ENCRYPTION_KEY,
    tokenSecret: process.env.PAYMENT_TOKEN_SECRET,
    webhookSecrets: {
      [PaymentGateway.TOSS_PAY]: process.env.TOSS_WEBHOOK_SECRET,
      [PaymentGateway.KAKAO_PAY]: process.env.KAKAO_WEBHOOK_SECRET,
    },
  },
});

// Use in Express app
app.use('/api/payments', paymentModule.getRouter());
```

## API Endpoints

### Payment Operations

- `POST /api/payments/initialize` - Initialize a payment
- `POST /api/payments/process` - Process payment callback
- `GET /api/payments/:id/verify` - Verify payment status
- `POST /api/payments/:id/refund` - Process refund
- `GET /api/payments/:id` - Get payment details

### Payment Queries

- `GET /api/payments/order/:orderId` - Get payments by order
- `GET /api/payments/customer/:customerId` - Get payments by customer

### Gateway Management

- `GET /api/payments/gateways` - Get available gateways
- `POST /api/payments/test` - Test gateway configuration
- `GET /api/payments/health` - Health check

### Webhooks

- `POST /api/payments/webhook/:gateway` - Handle gateway webhooks

### Order Integration (if enabled)

- `POST /api/payments/orders/:orderId/pay` - Process order payment
- `GET /api/payments/orders/:orderId/status` - Get order payment status
- `POST /api/payments/orders/:orderId/refund` - Process order refund
- `GET /api/payments/orders/:orderId/verify` - Verify order payment
- `GET /api/payments/orders/:orderId/history` - Get payment history

## Usage Examples

### Initialize Payment

```typescript
const paymentRequest = {
  orderId: 'ORDER_123',
  customerId: 'CUSTOMER_456',
  gateway: 'toss_pay',
  amount: 50000,
  currency: 'KRW',
  description: 'Product Purchase',
  returnUrl: 'https://yoursite.com/payment/success',
  cancelUrl: 'https://yoursite.com/payment/cancel',
  customerInfo: {
    name: '홍길동',
    email: 'customer@example.com',
    phone: '010-1234-5678',
  },
  items: [
    {
      id: 'PRODUCT_1',
      name: '상품명',
      quantity: 1,
      price: 50000,
    },
  ],
};

const response = await fetch('/api/payments/initialize', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(paymentRequest),
});

const result = await response.json();
// Redirect user to result.data.redirectUrl
```

### Process Payment Callback

```typescript
const processRequest = {
  paymentId: 'PAY_1640995200000_1234',
  gateway: 'toss_pay',
  gatewayData: {
    paymentKey: 'payment_key_from_gateway',
    orderId: 'ORDER_123',
    amount: 50000,
  },
};

const response = await fetch('/api/payments/process', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(processRequest),
});

const payment = await response.json();
```

### Process Refund

```typescript
const refundRequest = {
  amount: 25000, // Partial refund
  reason: '부분 환불 요청',
  bankInfo: {
    bankCode: '011',
    bankName: '농협은행',
    accountNumber: '123-456-789',
    accountHolder: '홍길동',
  },
};

const response = await fetch('/api/payments/PAY_1640995200000_1234/refund', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(refundRequest),
});

const refund = await response.json();
```

## Gateway-Specific Features

### Kakao Pay (카카오페이)
- Mobile-first payment experience
- QR code support
- Card and KakaoPay Money integration
- Real-time payment status updates

### Naver Pay (네이버페이)
- Integrated with Naver ecosystem
- Multiple payment methods (card, points, etc.)
- Merchant dashboard integration
- Advanced fraud detection

### Toss Payments (토스페이먼츠)
- Modern payment UX/UI
- Virtual account support
- Comprehensive payment methods
- Real-time webhooks

### NicePay (나이스페이)
- Traditional Korean payment gateway
- Credit/debit card processing
- Virtual account integration
- Enterprise-grade security

### Bank Transfer (무통장입금)
- Traditional Korean payment method
- Virtual account generation
- Deposit confirmation tracking
- Multiple bank support

## Security Features

### PCI Compliance
- Sensitive data encryption
- Card number tokenization
- Secure data transmission
- Audit logging

### Payment Token Security
- HMAC-signed tokens
- Time-based expiration
- Tamper-proof design
- Secure verification

### Webhook Security
- Signature verification
- IP whitelist support
- Replay attack prevention
- Rate limiting

### Rate Limiting
- Payment initialization limits
- Webhook processing limits
- Customer-based limiting
- IP-based restrictions

## Order Integration

The payment module seamlessly integrates with order management:

```typescript
// Order status updates based on payment events
payment.completed → order.confirmed
payment.failed → order.cancelled
payment.refunded → order.refunded

// Automatic inventory management
payment.completed → inventory.decrease
payment.refunded → inventory.increase

// Customer notifications
payment.completed → send confirmation email
payment.failed → send failure notification
```

## Error Handling

The module provides comprehensive error handling:

```typescript
try {
  const payment = await paymentService.initializePayment(request);
} catch (error) {
  if (error.code === 'INVALID_GATEWAY') {
    // Handle invalid gateway
  } else if (error.code === 'INSUFFICIENT_FUNDS') {
    // Handle insufficient funds
  } else if (error.code === 'NETWORK_ERROR') {
    // Handle network issues
  }
}
```

## Monitoring and Logging

### Security Audit Logs
```typescript
// Get audit logs
const logs = await fetch('/api/payments/security/audit?startDate=2023-01-01');

// Filter by gateway
const kakaoLogs = await fetch('/api/payments/security/audit?gateway=kakao_pay');

// Filter by event type
const failedLogins = await fetch('/api/payments/security/audit?event=WEBHOOK_SIGNATURE_INVALID');
```

### Webhook Statistics
```typescript
// Get webhook stats
const stats = await fetch('/api/payments/webhooks/stats');
// Returns: totalEvents, processedEvents, failedEvents, retryQueueSize, gatewayBreakdown
```

### Payment Analytics
```typescript
// Get payment statistics
const paymentStats = await paymentRepository.getPaymentStats({
  startDate: new Date('2023-01-01'),
  endDate: new Date('2023-12-31'),
  gateway: 'toss_pay',
});
// Returns: totalCount, totalAmount, statusBreakdown, gatewayBreakdown, averageAmount
```

## Configuration

### Environment Variables

```bash
# Security
PAYMENT_ENCRYPTION_KEY=your_256_bit_encryption_key
PAYMENT_TOKEN_SECRET=your_token_signing_secret

# Kakao Pay
KAKAO_PAY_CID=your_kakao_cid
KAKAO_PAY_ADMIN_KEY=your_kakao_admin_key
KAKAO_WEBHOOK_SECRET=your_kakao_webhook_secret

# Naver Pay
NAVER_PAY_CLIENT_ID=your_naver_client_id
NAVER_PAY_CLIENT_SECRET=your_naver_client_secret
NAVER_PAY_MERCHANT_ID=your_naver_merchant_id
NAVER_WEBHOOK_SECRET=your_naver_webhook_secret

# Toss Payments
TOSS_PAY_CLIENT_ID=your_toss_client_id
TOSS_PAY_SECRET_KEY=your_toss_secret_key
TOSS_WEBHOOK_SECRET=your_toss_webhook_secret

# NicePay
NICE_PAY_MERCHANT_ID=your_nice_merchant_id
NICE_PAY_MERCHANT_KEY=your_nice_merchant_key
NICE_PAY_CANCEL_PASSWORD=your_nice_cancel_password
NICE_WEBHOOK_SECRET=your_nice_webhook_secret

# Database
DATABASE_URL=your_database_connection_string
```

## Testing

### Gateway Testing
```typescript
// Test all gateways
const testResults = await Promise.all([
  fetch('/api/payments/test', { 
    method: 'POST', 
    body: JSON.stringify({ gateway: 'kakao_pay' }) 
  }),
  fetch('/api/payments/test', { 
    method: 'POST', 
    body: JSON.stringify({ gateway: 'toss_pay' }) 
  }),
]);
```

### Mock Payments
```typescript
// Use sandbox mode for testing
const paymentModule = createPaymentModule({
  gateways: {
    [PaymentGateway.TOSS_PAY]: {
      gateway: PaymentGateway.TOSS_PAY,
      enabled: true,
      sandbox: true, // Enable sandbox mode
      credentials: { /* test credentials */ },
    },
  },
});
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Implement your changes
4. Add tests
5. Submit a pull request

## License

MIT License

## Support

For questions and support, please create an issue in the repository.