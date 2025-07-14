# Customer Management Module

A comprehensive customer management system designed for Korean e-commerce platforms with full Korean localization, privacy compliance, and advanced customer analytics.

## Features

### Core Customer Management
- **Profile Management**: Complete customer profiles with Korean-specific fields
- **Email/Phone Validation**: Korean phone number and email validation
- **Privacy Compliance**: Full Korean privacy law (PIPA) compliance
- **Multi-tier System**: Flexible customer tier management with benefits
- **Segmentation**: Advanced customer segmentation based on behavior and demographics

### Korean-Specific Features
- **Korean Name Support**: Dedicated Korean name field (`koreanName`)
- **Korean Address Format**: Proper Korean address structure with 시/도, 시/군/구, 동/읍/면
- **Korean Phone Validation**: Support for all Korean phone formats (mobile, landline, VoIP)
- **Korean Zip Code**: 5-digit Korean postal code validation
- **Privacy Consent Management**: 개인정보 동의, 마케팅 동의, 제3자 정보제공 동의

### Address Management
- **Multiple Addresses**: Support for home, work, shipping, and billing addresses
- **Korean Address Structure**: Proper Korean address hierarchy
- **Default Address Management**: Set and manage default addresses
- **Delivery Instructions**: Custom delivery notes and instructions

### Loyalty Points System
- **Points Earning**: Automatic points calculation based on purchases
- **Points Redemption**: Flexible points redemption system
- **Points Expiration**: Configurable point expiration policies
- **Transaction History**: Complete points transaction tracking

### Customer Analytics
- **Purchase Behavior Analysis**: Detailed purchase pattern analysis
- **Lifetime Value Calculation**: Customer LTV prediction
- **Churn Prediction**: AI-based churn risk assessment
- **Segmentation Analytics**: Automatic customer segmentation
- **Marketing Campaign Tracking**: Campaign effectiveness measurement

### Customer Service Integration
- **Customer Notes**: Public and internal note management
- **Priority Management**: VIP, high, normal, low priority levels
- **Tag System**: Flexible customer tagging
- **Service History**: Complete customer service interaction history

## API Endpoints

### Customer CRUD Operations
```
GET    /api/customers                    # List customers with filters
POST   /api/customers                    # Create new customer
GET    /api/customers/:id                # Get customer details
PUT    /api/customers/:id                # Update customer
DELETE /api/customers/:id/deactivate     # Deactivate customer
DELETE /api/customers/:id                # Delete customer permanently
```

### Address Management
```
POST   /api/customers/:id/addresses              # Add new address
GET    /api/customers/:id/addresses              # List customer addresses
GET    /api/customers/:id/addresses/:addressId   # Get specific address
PUT    /api/customers/:id/addresses/:addressId   # Update address
DELETE /api/customers/:id/addresses/:addressId   # Delete address
PUT    /api/customers/:id/addresses/:addressId/default  # Set as default
```

### Loyalty Points
```
POST   /api/customers/:id/points         # Add loyalty points
GET    /api/customers/:id/points         # Get points history
POST   /api/customers/:id/points/redeem  # Redeem points
```

### Analytics & Insights
```
GET    /api/customers/:id/statistics     # Customer statistics
GET    /api/customers/:id/behavior       # Purchase behavior analysis
GET    /api/customers/:id/churn-prediction  # Churn risk assessment
GET    /api/customers/:id/lifetime-value # Calculate LTV
GET    /api/customers/analytics/overview # Overall customer analytics
```

### Customer Service
```
POST   /api/customers/:id/notes          # Add customer note
PUT    /api/customers/:id/priority       # Update priority
POST   /api/customers/:id/tags           # Add tags
DELETE /api/customers/:id/tags           # Remove tags
```

### Marketing Features
```
POST   /api/customers/marketing/eligible # Get marketing-eligible customers
```

### Data Management
```
GET    /api/customers/export             # Export customer data
POST   /api/customers/import             # Import customer data
```

### Utility Endpoints
```
GET    /api/customers/tiers              # List customer tiers
GET    /api/customers/segments           # List customer segments
```

## Database Schema

### Main Tables
- `customers` - Main customer information
- `customer_addresses` - Customer addresses with Korean format
- `customer_loyalty_points` - Points transaction history
- `customer_tiers` - Customer tier definitions
- `customer_segments` - Customer segment criteria

### Key Indexes
- Email and phone uniqueness
- Korean name search optimization
- Geographic distribution (city, district)
- Purchase behavior indexes
- Marketing consent tracking

## Usage Examples

### Creating a Customer
```typescript
const customer = await customerService.createCustomer({
  email: 'hong@naver.com',
  phone: '010-1234-5678',
  firstName: '길동',
  lastName: '홍',
  koreanName: '홍길동',
  dateOfBirth: new Date('1990-01-01'),
  gender: 'male',
  marketingPreferences: {
    email: true,
    sms: true,
    personalInfoConsent: true,
    marketingConsent: true
  }
});
```

### Adding Korean Address
```typescript
const address = await customerService.addAddress(customerId, {
  type: 'home',
  zipCode: '06292',
  address1: '서울특별시 강남구 테헤란로 123',
  address2: '456호',
  city: '서울특별시',
  district: '강남구',
  neighborhood: '역삼동',
  recipientName: '홍길동',
  recipientPhone: '010-1234-5678',
  deliveryNote: '경비실에 맡겨주세요'
});
```

### Managing Loyalty Points
```typescript
// Add points for purchase
await customerService.addLoyaltyPoints(customerId, {
  points: 1000,
  transactionType: 'earned',
  transactionAmount: 100000,
  description: '구매 적립',
  orderId: 'order_123'
});

// Redeem points
await customerService.redeemLoyaltyPoints(customerId, 500, '할인 사용');
```

### Customer Analytics
```typescript
// Get customer statistics
const stats = await customerService.getCustomerStatistics(customerId);

// Predict churn risk
const churnPrediction = await customerService.predictCustomerChurn(customerId);

// Calculate lifetime value
const ltv = await customerService.calculateCustomerLifetimeValue(customerId);
```

### Marketing Campaign Targeting
```typescript
const eligibleCustomers = await customerService.getMarketingEligibleCustomers({
  channel: 'email',
  segments: ['active', 'vip'],
  minSpent: 100000,
  tier: 'gold'
});
```

## Korean Validation Features

### Phone Number Validation
- Mobile: `010-1234-5678`, `010-123-4567`
- Seoul landline: `02-1234-5678`
- Area landlines: `031-123-4567`
- VoIP: `070-1234-5678`
- Customer service: `1588-1234`
- Toll-free: `080-123-4567`

### Address Validation
- 5-digit postal codes (new Korean format)
- Proper Korean administrative divisions
- Delivery instruction support

### Privacy Compliance
- 개인정보 수집·이용 동의 (Personal Information Consent)
- 마케팅 활용 동의 (Marketing Consent)
- 제3자 정보제공 동의 (Third Party Consent)
- IP address tracking for consent records
- Minor consent handling (under 14 years)

## Customer Tiers

### Default Tiers
1. **브론즈 (Bronze)** - 0-99,999원
2. **실버 (Silver)** - 100,000-499,999원 (5% 할인, 무료배송)
3. **골드 (Gold)** - 500,000-999,999원 (10% 할인, 무료배송, 생일쿠폰)
4. **플래티넘 (Platinum)** - 1,000,000-4,999,999원 (15% 할인, 전용상담)
5. **다이아몬드 (Diamond)** - 5,000,000원+ (20% 할인, VIP 이벤트)

### Tier Benefits
- Discount percentages
- Points multipliers
- Free shipping thresholds
- Exclusive events access
- Dedicated customer service

## Customer Segments

### Default Segments
- **신규고객** (New Customers) - 가입 후 30일 이내
- **활성고객** (Active Customers) - 최근 3개월 내 주문
- **VIP고객** (VIP Customers) - 고액 구매 고객
- **휴면고객** (Dormant Customers) - 6개월 이상 주문 없음
- **충성고객** (Loyal Customers) - 10회 이상 구매

### Segmentation Criteria
- Purchase frequency and recency
- Total spending amounts
- Order count thresholds
- Category preferences
- Geographic location
- Engagement levels

## Performance Optimization

### Database Optimizations
- Proper indexing for Korean text search
- Partitioning for large customer bases
- Optimized queries for analytics
- Efficient loyalty points calculations

### Caching Strategy
- Customer profile caching
- Frequently accessed analytics
- Tier and segment definitions
- Marketing eligibility lists

### Search Optimization
- Korean name phonetic search
- Email domain optimization
- Geographic search indexes
- Tag-based filtering

## Security & Privacy

### Data Protection
- Personal information encryption
- Secure consent management
- Audit trail for data access
- GDPR/PIPA compliance features

### Access Control
- Role-based customer data access
- API rate limiting
- Secure customer authentication
- PII masking for non-privileged users

## Integration Points

### Order System Integration
- Automatic tier updates based on purchases
- Points earning from orders
- Customer statistics updates
- Purchase behavior tracking

### Marketing System Integration
- Segmentation-based campaigns
- Consent verification
- Campaign effectiveness tracking
- Personalization data

### Customer Service Integration
- Unified customer view
- Service ticket integration
- Communication history
- Priority-based routing

## Testing

The module includes comprehensive tests covering:
- Korean validation functions
- Customer CRUD operations
- Address management
- Loyalty points system
- Analytics calculations
- Privacy compliance
- Edge cases and error handling

Run tests with:
```bash
npm test src/modules/customer/
```

## Migration Guide

When deploying the customer module:

1. Run database migrations to create tables
2. Import existing customer data using the import API
3. Configure default tiers and segments
4. Set up privacy consent workflows
5. Configure Korean address validation rules
6. Test phone number validation for your specific requirements

## Configuration

### Environment Variables
- `CUSTOMER_WELCOME_POINTS` - Points awarded on registration (default: 1000)
- `CUSTOMER_POINTS_EXPIRY_DAYS` - Points expiration period (default: 365)
- `CUSTOMER_TIER_UPDATE_FREQUENCY` - How often to recalculate tiers (default: daily)

### Module Configuration
- Default tier thresholds
- Segment criteria definitions
- Points calculation rules
- Privacy consent requirements

## Support

For questions or issues with the customer management module, please refer to the main project documentation or create an issue in the project repository.