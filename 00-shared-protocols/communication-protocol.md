# 🔗 모듈 간 통신 프로토콜

## 📋 개요
모든 모듈이 표준화된 방식으로 통신할 수 있도록 하는 프로토콜입니다. 이벤트 버스, API 게이트웨이, 데이터 계약을 통해 모듈 간 안전하고 효율적인 통신을 보장합니다.

## 🎯 핵심 원칙
1. **비동기 통신**: 모든 모듈 간 통신은 비동기로 처리
2. **타입 안전성**: 모든 메시지와 데이터는 엄격한 타입 체크
3. **오류 복구**: 통신 실패 시 자동 재시도 및 fallback
4. **확장성**: 새로운 모듈 추가 시에도 기존 통신에 영향 없음

## 🚌 이벤트 버스 시스템

### 이벤트 구조
```typescript
interface SystemEvent {
  id: string;                    // 이벤트 고유 ID
  type: string;                  // 이벤트 타입
  source: string;                // 발생 모듈
  target?: string | string[];    // 대상 모듈 (미지정시 브로드캐스트)
  data: any;                     // 이벤트 데이터
  timestamp: string;             // 발생 시간
  version: string;               // 이벤트 스키마 버전
  priority: 'low' | 'normal' | 'high' | 'critical';
  metadata?: Record<string, any>; // 추가 메타데이터
}
```

### 표준 이벤트 네이밍
```typescript
// 패턴: [MODULE].[ENTITY].[ACTION]
const EventTypes = {
  // CMS 코어 이벤트
  CMS_USER_CREATED: 'cms.user.created',
  CMS_USER_UPDATED: 'cms.user.updated',
  CMS_USER_DELETED: 'cms.user.deleted',
  CMS_CONTENT_PUBLISHED: 'cms.content.published',
  CMS_PERMISSION_CHANGED: 'cms.permission.changed',

  // Commerce 플러그인 이벤트
  COMMERCE_PRODUCT_CREATED: 'commerce.product.created',
  COMMERCE_ORDER_PLACED: 'commerce.order.placed',
  COMMERCE_PAYMENT_PROCESSED: 'commerce.payment.processed',
  COMMERCE_INVENTORY_UPDATED: 'commerce.inventory.updated',

  // Travel 플러그인 이벤트
  TRAVEL_BOOKING_CREATED: 'travel.booking.created',
  TRAVEL_BOOKING_CONFIRMED: 'travel.booking.confirmed',
  TRAVEL_BOOKING_CANCELLED: 'travel.booking.cancelled',
  TRAVEL_PRODUCT_REGISTERED: 'travel.product.registered',

  // 시스템 이벤트
  SYSTEM_MODULE_LOADED: 'system.module.loaded',
  SYSTEM_MODULE_ERROR: 'system.module.error',
  SYSTEM_HEALTH_CHECK: 'system.health.check'
} as const;
```

### 이벤트 발행
```typescript
class EventBus {
  async emit(event: SystemEvent): Promise<void> {
    // 이벤트 유효성 검증
    await this.validateEvent(event);
    
    // 이벤트 저장 (감사 로그)
    await this.storeEvent(event);
    
    // 대상 모듈들에게 이벤트 전달
    await this.deliverEvent(event);
  }

  async on(eventType: string, handler: EventHandler): Promise<void> {
    // 이벤트 핸들러 등록
  }

  async off(eventType: string, handler: EventHandler): Promise<void> {
    // 이벤트 핸들러 해제
  }
}
```

## 🌐 API 게이트웨이

### API 엔드포인트 구조
```typescript
// 패턴: /api/v1/[module]/[resource]/[action]
const ApiEndpoints = {
  // CMS API
  '/api/v1/cms/users': ['GET', 'POST'],
  '/api/v1/cms/users/:id': ['GET', 'PUT', 'DELETE'],
  '/api/v1/cms/content': ['GET', 'POST'],
  '/api/v1/cms/permissions': ['GET', 'POST'],

  // Commerce API
  '/api/v1/commerce/products': ['GET', 'POST'],
  '/api/v1/commerce/orders': ['GET', 'POST'],
  '/api/v1/commerce/payments': ['POST'],

  // Travel API
  '/api/v1/travel/products': ['GET', 'POST'],
  '/api/v1/travel/bookings': ['GET', 'POST'],
  '/api/v1/travel/bookings/:id': ['GET', 'PUT', 'DELETE']
};
```

### API 요청/응답 표준
```typescript
interface ApiRequest {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  headers: Record<string, string>;
  query?: Record<string, any>;
  body?: any;
  user?: User;
  permissions?: string[];
}

interface ApiResponse {
  success: boolean;
  data?: any;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    pagination?: PaginationInfo;
    filters?: any;
    timestamp: string;
  };
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}
```

### API 미들웨어 체인
```typescript
const middlewareChain = [
  corsMiddleware,           // CORS 처리
  authenticationMiddleware, // 인증 확인
  authorizationMiddleware,  // 권한 확인
  validationMiddleware,     // 입력 유효성 검증
  rateLimitMiddleware,      // 요청 제한
  loggingMiddleware,        // 로깅
  moduleRoutingMiddleware   // 모듈별 라우팅
];
```

## 📋 데이터 계약 (Data Contracts)

### 공통 데이터 타입
```typescript
interface User {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatar?: string;
  roles: string[];
  permissions: string[];
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  isActive: boolean;
  metadata?: Record<string, any>;
}

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  category: string;
  tags: string[];
  images: string[];
  status: 'draft' | 'active' | 'inactive' | 'archived';
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  metadata?: Record<string, any>;
}

interface Order {
  id: string;
  userId: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  currency: string;
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  shippingAddress: Address;
  billingAddress: Address;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
}

interface OrderItem {
  productId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  options?: Record<string, any>;
}

interface Address {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
}
```

### Travel 전용 데이터 타입
```typescript
interface TravelProduct extends Product {
  type: 'flight' | 'hotel' | 'package' | 'activity';
  destination: string;
  duration: number; // 일수
  maxCapacity: number;
  availableDates: string[];
  inclusions: string[];
  exclusions: string[];
  itinerary?: ItineraryItem[];
  cancellationPolicy: CancellationPolicy;
}

interface TravelBooking extends Order {
  travelDate: string;
  returnDate?: string;
  travelers: Traveler[];
  specialRequests?: string;
  confirmationCode: string;
  vouchers: string[];
}

interface Traveler {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  passportNumber?: string;
  passportExpiry?: string;
  nationality: string;
  contactInfo: {
    email: string;
    phone: string;
  };
}

interface ItineraryItem {
  day: number;
  title: string;
  description: string;
  activities: string[];
  meals: string[];
  accommodation?: string;
}

interface CancellationPolicy {
  freeCancellationUntil?: string;
  cancellationFees: {
    daysBeforeTravel: number;
    feePercentage: number;
  }[];
}
```

## 🔒 보안 및 인증

### JWT 토큰 구조
```typescript
interface JwtPayload {
  sub: string;      // 사용자 ID
  iss: string;      // 발행자 (모듈명)
  aud: string[];    // 대상 모듈들
  exp: number;      // 만료 시간
  iat: number;      // 발행 시간
  permissions: string[];
  roles: string[];
  sessionId: string;
}
```

### 권한 확인 시스템
```typescript
interface PermissionCheck {
  userId: string;
  resource: string;
  action: string;
  context?: any;
}

interface PermissionResult {
  allowed: boolean;
  reason?: string;
  conditions?: Record<string, any>;
}
```

## 📊 모니터링 및 로깅

### 로그 구조
```typescript
interface SystemLog {
  id: string;
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  module: string;
  component: string;
  message: string;
  data?: any;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  error?: {
    name: string;
    message: string;
    stack: string;
  };
}
```

### 성능 메트릭
```typescript
interface PerformanceMetrics {
  module: string;
  endpoint?: string;
  operation: string;
  duration: number;
  memoryUsage: number;
  cpuUsage: number;
  timestamp: string;
  success: boolean;
  errorCode?: string;
}
```

## 🔄 상태 동기화

### 상태 변경 이벤트
```typescript
interface StateChangeEvent extends SystemEvent {
  type: 'state.changed';
  data: {
    entity: string;
    entityId: string;
    changes: Record<string, any>;
    previousState?: any;
    newState: any;
  };
}
```

### 캐시 무효화
```typescript
interface CacheInvalidationEvent extends SystemEvent {
  type: 'cache.invalidate';
  data: {
    keys: string[];
    pattern?: string;
    reason: string;
  };
}
```

## 🧪 테스트 지원

### Mock 이벤트 생성
```typescript
class MockEventGenerator {
  static createUserEvent(action: string, userData: Partial<User>): SystemEvent {
    return {
      id: uuidv4(),
      type: `cms.user.${action}`,
      source: 'cms-core',
      data: userData,
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      priority: 'normal'
    };
  }
}
```

### 통신 테스트 도구
```typescript
class CommunicationTester {
  async testEventFlow(from: string, to: string, eventType: string): Promise<boolean> {
    // 이벤트 전송 테스트
  }

  async testApiEndpoint(endpoint: string, method: string): Promise<ApiResponse> {
    // API 엔드포인트 테스트
  }
}
```

이 통신 프로토콜을 준수하면 모든 모듈이 원활하게 소통할 수 있습니다! 🔗