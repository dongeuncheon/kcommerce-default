# Building Your First Integration

This tutorial will walk you through building a complete e-commerce integration with the NewTravel Commerce Plugin, from setup to a working online store.

## What You'll Build

By the end of this tutorial, you'll have:

- A working product catalog
- Shopping cart functionality
- Order processing
- Payment integration
- A simple frontend interface

## Prerequisites

- Node.js 18+ installed
- Basic JavaScript/TypeScript knowledge
- Text editor or IDE
- PostgreSQL and Redis (or Docker)

## Step 1: Environment Setup

### 1.1 Clone and Install

```bash
# Clone the repository
git clone https://github.com/your-org/commerce-plugin.git
cd commerce-plugin

# Install dependencies
npm install

# Setup environment
cp .env.example .env
```

### 1.2 Configure Environment

Edit your `.env` file:

```bash
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/commerce_tutorial"

# Redis (optional for this tutorial)
REDIS_URL="redis://localhost:6379"

# Security
JWT_SECRET="your-super-secret-jwt-key-minimum-32-characters"
ENCRYPTION_KEY="your-32-character-encryption-key"

# Server
PORT=3000
NODE_ENV=development

# Payment (we'll configure later)
STRIPE_SECRET_KEY=""
STRIPE_PUBLISHABLE_KEY=""
```

### 1.3 Setup Database

```bash
# Create database
createdb commerce_tutorial

# Run migrations and seed data
npm run db:setup

# Start the server
npm run dev
```

Verify setup by visiting http://localhost:3000/health - you should see a healthy status.

## Step 2: Understanding the API

### 2.1 Explore the Documentation

Visit http://localhost:3000/api-docs to see the interactive API documentation.

### 2.2 Test Basic Endpoints

```bash
# Get all products
curl http://localhost:3000/api/v1/products

# Get categories
curl http://localhost:3000/api/v1/categories

# Check health
curl http://localhost:3000/health
```

## Step 3: Creating Your Product Catalog

### 3.1 Create Categories

Let's start by creating some product categories:

```bash
# Create Electronics category
curl -X POST http://localhost:3000/api/v1/categories \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Electronics",
    "description": "Electronic devices and accessories",
    "slug": "electronics",
    "isActive": true,
    "metaTitle": "Electronics | Your Store",
    "metaDescription": "Shop the latest electronic devices"
  }'

# Create Clothing category
curl -X POST http://localhost:3000/api/v1/categories \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Clothing",
    "description": "Fashion and apparel",
    "slug": "clothing",
    "isActive": true,
    "metaTitle": "Clothing | Your Store",
    "metaDescription": "Discover fashion trends and styles"
  }'
```

### 3.2 Create Products

Now let's add some products:

```bash
# Create a laptop product
curl -X POST http://localhost:3000/api/v1/products \
  -H "Content-Type: application/json" \
  -d '{
    "name": "MacBook Pro 16-inch",
    "description": "Powerful laptop for professionals with M2 Pro chip",
    "shortDescription": "Professional laptop with M2 Pro chip",
    "sku": "MBP-16-M2-512",
    "price": 2499.99,
    "comparePrice": 2799.99,
    "status": "PUBLISHED",
    "type": "SIMPLE",
    "trackQuantity": true,
    "quantity": 25,
    "lowStockThreshold": 5,
    "weight": 2140,
    "isFeatured": true,
    "requiresShipping": true,
    "categoryId": "YOUR_ELECTRONICS_CATEGORY_ID",
    "metaTitle": "MacBook Pro 16-inch | Best Professional Laptop",
    "metaDescription": "Get the powerful MacBook Pro with M2 Pro chip for professional work",
    "attributes": [
      {"name": "Brand", "value": "Apple"},
      {"name": "Screen Size", "value": "16 inches"},
      {"name": "Processor", "value": "M2 Pro"}
    ],
    "tags": ["laptop", "apple", "professional", "m2"]
  }'

# Create a t-shirt product
curl -X POST http://localhost:3000/api/v1/products \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Premium Cotton T-Shirt",
    "description": "Comfortable cotton t-shirt available in multiple colors",
    "shortDescription": "Premium cotton t-shirt",
    "sku": "TSHIRT-COTTON-001",
    "price": 29.99,
    "comparePrice": 39.99,
    "status": "PUBLISHED",
    "type": "VARIABLE",
    "trackQuantity": true,
    "quantity": 100,
    "lowStockThreshold": 10,
    "weight": 200,
    "isFeatured": false,
    "requiresShipping": true,
    "categoryId": "YOUR_CLOTHING_CATEGORY_ID",
    "variants": [
      {
        "name": "Small - Black",
        "sku": "TSHIRT-COTTON-001-S-BLK",
        "price": 29.99,
        "quantity": 20,
        "attributes": {"size": "S", "color": "Black"}
      },
      {
        "name": "Medium - Black",
        "sku": "TSHIRT-COTTON-001-M-BLK",
        "price": 29.99,
        "quantity": 25,
        "attributes": {"size": "M", "color": "Black"}
      },
      {
        "name": "Large - Blue",
        "sku": "TSHIRT-COTTON-001-L-BLU",
        "price": 29.99,
        "quantity": 30,
        "attributes": {"size": "L", "color": "Blue"}
      }
    ],
    "attributes": [
      {"name": "Material", "value": "100% Cotton"},
      {"name": "Care", "value": "Machine washable"}
    ],
    "tags": ["clothing", "t-shirt", "cotton", "casual"]
  }'
```

### 3.3 Verify Your Catalog

```bash
# List all products
curl http://localhost:3000/api/v1/products

# Filter by category
curl "http://localhost:3000/api/v1/products?categoryId=YOUR_ELECTRONICS_CATEGORY_ID"

# Search products
curl "http://localhost:3000/api/v1/products?search=macbook"
```

## Step 4: Implementing Shopping Cart

### 4.1 Understanding Guest Carts

The system supports guest shopping carts using sessions. Let's test this:

```bash
# Create a cart (this returns a session cookie)
curl -c cookies.txt -b cookies.txt http://localhost:3000/api/v1/carts

# Add product to cart
curl -X POST http://localhost:3000/api/v1/carts/items \
  -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "YOUR_LAPTOP_PRODUCT_ID",
    "quantity": 1
  }'

# Add t-shirt variant to cart
curl -X POST http://localhost:3000/api/v1/carts/items \
  -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "YOUR_TSHIRT_PRODUCT_ID",
    "variantId": "YOUR_VARIANT_ID",
    "quantity": 2
  }'

# View cart
curl -b cookies.txt http://localhost:3000/api/v1/carts
```

### 4.2 Cart Management Operations

```bash
# Update item quantity
curl -X PUT http://localhost:3000/api/v1/carts/items/ITEM_ID \
  -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"quantity": 3}'

# Remove item from cart
curl -X DELETE http://localhost:3000/api/v1/carts/items/ITEM_ID \
  -b cookies.txt

# Clear entire cart
curl -X DELETE http://localhost:3000/api/v1/carts \
  -b cookies.txt
```

## Step 5: Processing Orders

### 5.1 Create an Order

```bash
# Create order from cart
curl -X POST http://localhost:3000/api/v1/orders \
  -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{
    "shippingAddress": {
      "firstName": "John",
      "lastName": "Doe",
      "address1": "123 Main Street",
      "address2": "Apt 4B",
      "city": "New York",
      "state": "NY",
      "zipCode": "10001",
      "country": "US",
      "phone": "+1234567890"
    },
    "billingAddress": {
      "firstName": "John",
      "lastName": "Doe",
      "address1": "123 Main Street",
      "city": "New York",
      "state": "NY",
      "zipCode": "10001",
      "country": "US"
    },
    "shippingMethod": "standard",
    "paymentMethod": "stripe"
  }'
```

### 5.2 Order Management

```bash
# Get order details
curl http://localhost:3000/api/v1/orders/ORDER_ID

# Update order status (admin function)
curl -X PUT http://localhost:3000/api/v1/orders/ORDER_ID/status \
  -H "Content-Type: application/json" \
  -d '{
    "status": "PROCESSING",
    "trackingNumber": "TRK123456789"
  }'

# Get all orders
curl http://localhost:3000/api/v1/orders
```

## Step 6: Payment Integration

### 6.1 Setup Stripe

First, create a Stripe account and get your test keys:

1. Go to https://stripe.com and create an account
2. Get your test API keys from the dashboard
3. Update your `.env` file:

```bash
STRIPE_SECRET_KEY=sk_test_your_test_secret_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_test_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
```

### 6.2 Process Payments

```bash
# Create payment intent
curl -X POST http://localhost:3000/api/v1/payments/intent \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "YOUR_ORDER_ID",
    "paymentMethod": "stripe",
    "currency": "usd"
  }'

# This returns a client_secret that you use on the frontend
```

### 6.3 Test Payment Flow

Create a simple HTML file to test payments:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Test Payment</title>
    <script src="https://js.stripe.com/v3/"></script>
</head>
<body>
    <div id="card-element"></div>
    <button id="pay-button">Pay Now</button>

    <script>
        const stripe = Stripe('pk_test_your_publishable_key');
        const elements = stripe.elements();
        const cardElement = elements.create('card');
        cardElement.mount('#card-element');

        document.getElementById('pay-button').addEventListener('click', async () => {
            const { error, paymentIntent } = await stripe.confirmCardPayment(
                'CLIENT_SECRET_FROM_API', {
                    payment_method: {
                        card: cardElement
                    }
                }
            );

            if (error) {
                console.error('Payment failed:', error);
            } else {
                console.log('Payment succeeded:', paymentIntent);
            }
        });
    </script>
</body>
</html>
```

## Step 7: Building a Simple Frontend

### 7.1 Create a Basic Store Interface

Create an `index.html` file:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>My Commerce Store</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .product { border: 1px solid #ddd; padding: 20px; margin: 10px; display: inline-block; }
        .cart { position: fixed; top: 10px; right: 10px; background: #f0f0f0; padding: 10px; }
        button { background: #007cba; color: white; border: none; padding: 10px; cursor: pointer; }
        button:hover { background: #005a87; }
    </style>
</head>
<body>
    <div class="cart">
        <h3>Cart (<span id="cart-count">0</span>)</h3>
        <div id="cart-items"></div>
        <button onclick="checkout()" id="checkout-btn" style="display:none;">Checkout</button>
    </div>

    <h1>My Commerce Store</h1>
    <div id="products"></div>

    <script>
        const API_BASE = 'http://localhost:3000/api/v1';
        let cart = [];

        // Load products
        async function loadProducts() {
            try {
                const response = await fetch(`${API_BASE}/products`);
                const data = await response.json();
                displayProducts(data.data);
            } catch (error) {
                console.error('Error loading products:', error);
            }
        }

        // Display products
        function displayProducts(products) {
            const container = document.getElementById('products');
            container.innerHTML = products.map(product => `
                <div class="product">
                    <h3>${product.name}</h3>
                    <p>${product.shortDescription || product.description}</p>
                    <p><strong>$${product.price}</strong></p>
                    <p>Stock: ${product.quantity}</p>
                    <button onclick="addToCart('${product.id}', '${product.name}', ${product.price})">
                        Add to Cart
                    </button>
                </div>
            `).join('');
        }

        // Add to cart
        async function addToCart(productId, productName, price) {
            try {
                const response = await fetch(`${API_BASE}/carts/items`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include',
                    body: JSON.stringify({
                        productId: productId,
                        quantity: 1
                    })
                });

                if (response.ok) {
                    cart.push({ productId, productName, price, quantity: 1 });
                    updateCartDisplay();
                    alert('Product added to cart!');
                } else {
                    alert('Failed to add product to cart');
                }
            } catch (error) {
                console.error('Error adding to cart:', error);
            }
        }

        // Update cart display
        function updateCartDisplay() {
            document.getElementById('cart-count').textContent = cart.length;
            const cartItems = document.getElementById('cart-items');
            cartItems.innerHTML = cart.map(item => `
                <div>${item.productName} - $${item.price}</div>
            `).join('');
            
            document.getElementById('checkout-btn').style.display = 
                cart.length > 0 ? 'block' : 'none';
        }

        // Checkout
        async function checkout() {
            try {
                const response = await fetch(`${API_BASE}/orders`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include',
                    body: JSON.stringify({
                        shippingAddress: {
                            firstName: "John",
                            lastName: "Doe",
                            address1: "123 Main St",
                            city: "New York",
                            state: "NY",
                            zipCode: "10001",
                            country: "US",
                            phone: "+1234567890"
                        },
                        billingAddress: {
                            firstName: "John",
                            lastName: "Doe",
                            address1: "123 Main St",
                            city: "New York",
                            state: "NY",
                            zipCode: "10001",
                            country: "US"
                        },
                        shippingMethod: "standard",
                        paymentMethod: "stripe"
                    })
                });

                if (response.ok) {
                    const order = await response.json();
                    alert(`Order created! Order ID: ${order.data.id}`);
                    cart = [];
                    updateCartDisplay();
                } else {
                    alert('Checkout failed');
                }
            } catch (error) {
                console.error('Checkout error:', error);
            }
        }

        // Load products on page load
        loadProducts();
    </script>
</body>
</html>
```

### 7.2 Test Your Store

1. Open the HTML file in your browser
2. You should see your products displayed
3. Click "Add to Cart" to add products
4. Click "Checkout" to create an order

## Step 8: Advanced Features

### 8.1 Real-time Cart Updates

Add WebSocket support for real-time cart synchronization:

```javascript
// Add to your HTML
const socket = io('http://localhost:3000');

socket.on('cart:updated', (data) => {
    console.log('Cart updated:', data);
    // Update cart display
});

socket.on('cart:item_added', (data) => {
    console.log('Item added to cart:', data);
});
```

### 8.2 Product Search

Add search functionality:

```javascript
// Add search function
async function searchProducts(query) {
    try {
        const response = await fetch(`${API_BASE}/products?search=${encodeURIComponent(query)}`);
        const data = await response.json();
        displayProducts(data.data);
    } catch (error) {
        console.error('Search error:', error);
    }
}

// Add to HTML
// <input type="text" id="search" placeholder="Search products..." />
// <button onclick="searchProducts(document.getElementById('search').value)">Search</button>
```

### 8.3 Category Filtering

Add category navigation:

```javascript
// Load categories
async function loadCategories() {
    try {
        const response = await fetch(`${API_BASE}/categories`);
        const data = await response.json();
        displayCategories(data.data);
    } catch (error) {
        console.error('Error loading categories:', error);
    }
}

// Filter by category
async function filterByCategory(categoryId) {
    try {
        const response = await fetch(`${API_BASE}/products?categoryId=${categoryId}`);
        const data = await response.json();
        displayProducts(data.data);
    } catch (error) {
        console.error('Filter error:', error);
    }
}
```

## Step 9: Testing and Debugging

### 9.1 API Testing with Postman

Import the [Postman collection](../api/postman/development.json) to test all endpoints systematically.

### 9.2 Error Handling

Add proper error handling to your frontend:

```javascript
async function apiCall(url, options = {}) {
    try {
        const response = await fetch(url, {
            ...options,
            credentials: 'include'
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'API call failed');
        }
        
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        alert(`Error: ${error.message}`);
        throw error;
    }
}
```

### 9.3 Debugging Tips

1. **Check browser console** for JavaScript errors
2. **Monitor network tab** for API calls
3. **Use API documentation** at http://localhost:3000/api-docs
4. **Check server logs** for backend errors
5. **Verify database state** using Prisma Studio

## Step 10: Next Steps

Congratulations! You've built a working e-commerce integration. Here are some next steps:

### 10.1 Enhanced Frontend

- Use a modern framework (React, Vue, Angular)
- Add responsive design
- Implement user authentication
- Add product images
- Create admin dashboard

### 10.2 Additional Features

- Product reviews and ratings
- Wishlist functionality
- Email notifications
- Inventory alerts
- Analytics and reporting

### 10.3 Production Deployment

- Set up production database
- Configure SSL certificates
- Implement monitoring
- Set up CI/CD pipeline
- Configure caching

### 10.4 Learning Resources

- [Advanced Tutorials](../tutorials/)
- [API Reference](../api/README.md)
- [Architecture Guide](../architecture/README.md)
- [Deployment Guide](../deployment/README.md)

## Troubleshooting

### Common Issues

1. **CORS errors**: Check CORS configuration in `.env`
2. **Database connection**: Verify `DATABASE_URL`
3. **Session issues**: Ensure cookies are enabled
4. **Payment errors**: Check Stripe keys and webhook setup

### Getting Help

- [Troubleshooting Guide](../troubleshooting/common-issues.md)
- [Error Codes Reference](../api/error-codes.md)
- [GitHub Issues](https://github.com/your-org/commerce-plugin/issues)
- [Community Forum](https://github.com/your-org/commerce-plugin/discussions)

---

*You've successfully built your first e-commerce integration! The system is now ready for customization and scaling to meet your specific needs.*