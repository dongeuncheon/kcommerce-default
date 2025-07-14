# Guest Cart Implementation Guide

## Overview

The Guest Cart system provides seamless shopping experience for non-authenticated users, allowing them to add items to their cart, persist cart data across sessions, and seamlessly transfer their cart when they decide to register or log in.

## Key Features

### 🛒 **Session-Based Cart Management**
- Automatic session ID generation for guest users
- Cart persistence across browser sessions via cookies
- Configurable session expiration (default: 7 days)
- Session activity tracking and analytics

### 🔄 **Seamless User Transition**
- Automatic cart transfer when guest becomes authenticated user
- Intelligent cart merging when user already has items
- No data loss during authentication flow
- Maintains cart items, quantities, and applied coupons

### 💾 **Local Storage Migration**
- Migrate cart data from client-side local storage to server
- Batch import of multiple items with validation
- Error handling for invalid products during migration
- Preserves coupon codes and cart settings

### 📊 **Analytics & Monitoring**
- Guest session statistics and metrics
- Session duration tracking
- Cart abandonment analysis
- Real-time monitoring of active guest sessions

## API Endpoints

### Core Guest Cart Operations

#### `GET /api/v1/carts/guest`
Get or create guest cart by session ID.

**Query Parameters:**
- `sessionId` (required): Guest session identifier

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "cart_123",
    "sessionId": "guest_1234567890_abc123",
    "userId": null,
    "items": [],
    "totals": { "total": 0, "subtotal": 0, "itemCount": 0 },
    "expiresAt": "2024-01-15T12:00:00Z"
  },
  "message": "Empty guest cart ready"
}
```

#### `POST /api/v1/carts/guest/quick-add`
Add item to guest cart (auto-creates cart if needed).

**Request Body:**
```json
{
  "sessionId": "guest_1234567890_abc123",
  "productId": "product_456",
  "variantId": "variant_789", // optional
  "quantity": 2
}
```

#### `GET /api/v1/carts/guest/:sessionId/summary`
Get lightweight cart summary for header/mini-cart display.

**Response:**
```json
{
  "success": true,
  "data": {
    "cartId": "cart_123",
    "itemCount": 3,
    "total": 89.97,
    "subtotal": 79.97,
    "currency": "USD",
    "isEmpty": false,
    "isExpired": false
  }
}
```

### Advanced Operations

#### `POST /api/v1/carts/guest/transfer`
Transfer guest cart to authenticated user.

**Request Body:**
```json
{
  "sessionId": "guest_1234567890_abc123",
  "userId": "user_456"
}
```

#### `POST /api/v1/carts/guest/migrate`
Migrate cart data from local storage.

**Request Body:**
```json
{
  "sessionId": "guest_1234567890_abc123",
  "cartData": {
    "items": [
      {
        "productId": "product_123",
        "variantId": "variant_456",
        "quantity": 2,
        "options": { "color": "red", "size": "M" }
      }
    ],
    "coupons": ["SAVE10", "FREESHIP"],
    "currency": "USD"
  }
}
```

### Session Management

#### `POST /api/v1/carts/guest/session/:sessionId/extend`
Extend guest session expiration.

**Request Body:**
```json
{
  "hours": 48  // 1-168 hours (max 1 week)
}
```

#### `GET /api/v1/carts/guest/session/:sessionId/info`
Get session information for debugging.

**Response:**
```json
{
  "success": true,
  "data": {
    "session": {
      "sessionId": "guest_1234567890_abc123",
      "lastActivity": "2024-01-14T10:30:00Z",
      "expiresAt": "2024-01-21T10:30:00Z"
    },
    "cart": { /* full cart object */ },
    "itemCount": 3,
    "isExpired": false,
    "lastActivity": "2024-01-14T10:30:00Z"
  }
}
```

## Client Integration Examples

### Frontend Implementation

```javascript
// Get or create guest cart
async function getGuestCart() {
  let sessionId = localStorage.getItem('guestSessionId')
  
  if (!sessionId) {
    sessionId = generateSessionId()
    localStorage.setItem('guestSessionId', sessionId)
  }
  
  const response = await fetch(`/api/v1/carts/guest?sessionId=${sessionId}`)
  return response.json()
}

// Add item to guest cart
async function addToGuestCart(productId, quantity = 1) {
  const sessionId = localStorage.getItem('guestSessionId')
  
  const response = await fetch('/api/v1/carts/guest/quick-add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId,
      productId,
      quantity
    })
  })
  
  return response.json()
}

// Transfer cart on user login
async function transferGuestCart(userId) {
  const sessionId = localStorage.getItem('guestSessionId')
  
  if (!sessionId) return null
  
  const response = await fetch('/api/v1/carts/guest/transfer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId,
      userId
    })
  })
  
  if (response.ok) {
    localStorage.removeItem('guestSessionId')
  }
  
  return response.json()
}
```

### React Hook Example

```javascript
import { useState, useEffect } from 'react'

export function useGuestCart() {
  const [cart, setCart] = useState(null)
  const [sessionId, setSessionId] = useState(null)
  
  useEffect(() => {
    initializeGuestCart()
  }, [])
  
  async function initializeGuestCart() {
    let guestSessionId = localStorage.getItem('guestSessionId')
    
    if (!guestSessionId) {
      guestSessionId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      localStorage.setItem('guestSessionId', guestSessionId)
    }
    
    setSessionId(guestSessionId)
    
    try {
      const response = await fetch(`/api/v1/carts/guest?sessionId=${guestSessionId}`)
      const data = await response.json()
      setCart(data.data)
    } catch (error) {
      console.error('Failed to initialize guest cart:', error)
    }
  }
  
  async function addItem(productId, quantity = 1) {
    try {
      const response = await fetch('/api/v1/carts/guest/quick-add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          productId,
          quantity
        })
      })
      
      const data = await response.json()
      setCart(data.data)
      return data
    } catch (error) {
      console.error('Failed to add item to cart:', error)
      throw error
    }
  }
  
  return { cart, sessionId, addItem, initializeGuestCart }
}
```

## Session Middleware

The system includes automatic session management middleware that:

- **Auto-creates sessions** for guest users
- **Tracks activity** across cart operations
- **Sets secure cookies** for session persistence
- **Handles session expiration** gracefully
- **Supports authentication transition** seamlessly

### Middleware Configuration

```javascript
// Applied globally
app.use(sessionMiddleware({
  autoCreate: true,      // Auto-create sessions for guests
  trackActivity: true,   // Track user activity
  extendOnActivity: false // Don't auto-extend on activity
}))

// Applied to cart routes specifically
app.use('/api/v1/carts', cartSessionMiddleware(), cartRoutes)
```

## Best Practices

### 1. **Session ID Management**
- Store session ID in localStorage for persistence
- Include session ID in all cart API requests
- Clear session ID on user authentication

### 2. **Error Handling**
- Handle session expiration gracefully
- Provide fallback for network failures
- Validate session before critical operations

### 3. **Performance**
- Use cart summary endpoint for lightweight operations
- Cache cart data on client side
- Implement optimistic updates for better UX

### 4. **Analytics**
- Track guest cart abandonment rates
- Monitor session duration patterns
- Analyze conversion from guest to user

### 5. **Security**
- Set secure cookies in production
- Validate session IDs server-side
- Implement rate limiting for cart operations

## Monitoring & Analytics

### Guest Session Statistics

```javascript
// Get guest session metrics
const response = await fetch('/api/v1/carts/guest/stats?hours=24')
const stats = await response.json()

console.log(stats.data)
// {
//   activeGuestSessions: 150,
//   activeCarts: 89,
//   averageSessionDuration: 45, // minutes
//   newSessionsInPeriod: 67
// }
```

### Common Monitoring Queries

1. **Cart Abandonment Rate**: Compare created vs transferred carts
2. **Session Duration**: Track average time from creation to last activity
3. **Conversion Rate**: Guest carts that convert to user accounts
4. **Popular Products**: Most added items in guest carts

## Migration from Local Storage

For existing applications with client-side cart storage:

```javascript
async function migrateLocalStorageCart() {
  const localCart = JSON.parse(localStorage.getItem('cart') || '{}')
  
  if (!localCart.items || localCart.items.length === 0) {
    return null
  }
  
  const sessionId = getOrCreateSessionId()
  
  const response = await fetch('/api/v1/carts/guest/migrate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId,
      cartData: {
        items: localCart.items,
        coupons: localCart.coupons || [],
        currency: localCart.currency || 'USD'
      }
    })
  })
  
  if (response.ok) {
    localStorage.removeItem('cart') // Clear old local storage
  }
  
  return response.json()
}
```

## Testing

The system includes comprehensive test coverage:

- **Integration tests** for all API endpoints
- **Unit tests** for session management logic
- **End-to-end tests** for complete guest shopping flow
- **Performance tests** for session cleanup and analytics

Run tests with:
```bash
npm run test:integration -- --testPathPattern=guestCart
npm run test:unit -- --testPathPattern=sessionService
```