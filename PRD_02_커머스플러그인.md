# 📋 PRD-02: 커머스 베이스 플러그인

## 🎯 제품 개요
**재사용 가능한 범용 커머스 시스템**으로, 상품 관리, 주문 처리, 결제, 고객 관리 등 모든 쇼핑몰에 필요한 기본 기능을 제공합니다. 여행, 패션, 디지털 상품 등 다양한 도메인에서 확장하여 사용할 수 있습니다.

## 📋 주요 기능

### 1. 상품 관리 시스템
- **기본 상품 CRUD**: 생성, 조회, 수정, 삭제
- **카테고리 관리**: 계층형 카테고리, 태그 시스템
- **이미지 관리**: 다중 이미지, 썸네일 자동 생성
- **SEO 최적화**: 메타 태그, URL 슬러그
- **재고 관리**: 수량 추적, 재고 부족 알림

### 2. 가격 관리 시스템
- **기본 가격**: 정가, 할인가, 원가
- **동적 가격**: 시간별, 수량별 가격 변동
- **쿠폰 시스템**: 할인 쿠폰, 적용 조건
- **세금 계산**: 부가세, 지역별 세율
- **통화 지원**: 다중 통화, 환율 자동 업데이트

### 3. 주문 관리 시스템
- **주문 생성**: 장바구니에서 주문 변환
- **주문 상태**: 대기, 처리중, 배송중, 완료, 취소
- **주문 추적**: 실시간 상태 업데이트
- **부분 배송**: 여러 상품의 개별 배송
- **주문 히스토리**: 상태 변경 이력

### 4. 장바구니 시스템
- **실시간 동기화**: 멀티 디바이스 장바구니 동기화
- **게스트 장바구니**: 비회원 장바구니 지원
- **상품 옵션**: 색상, 사이즈, 수량 선택
- **자동 저장**: 세션 기반 임시 저장
- **만료 관리**: 장바구니 아이템 자동 정리

### 5. 결제 시스템
- **다중 결제 수단**: 카드, 계좌이체, 간편결제
- **PG 통합**: 토스페이먼츠, 이니시스, KCP
- **결제 상태 관리**: 대기, 완료, 실패, 환불
- **자동 영수증**: 이메일 영수증 발송
- **분할 결제**: 할부, 무이자 할부

### 6. 배송 관리 시스템
- **배송 방법**: 택배, 직접 배송, 픽업
- **배송비 계산**: 무게, 지역, 금액별 배송비
- **배송 추적**: 운송장 번호 연동
- **배송 일정**: 예상 배송일 계산
- **특수 배송**: 당일배송, 새벽배송

## 🏗️ 기술 아키텍처

### 데이터 모델

#### 상품 (Products)
```typescript
interface BaseProduct {
  id: string;
  title: string;
  description: string;
  slug: string;
  status: 'draft' | 'published' | 'archived';
  
  // 가격 정보
  pricing: {
    basePrice: number;
    comparePrice?: number;
    costPrice?: number;
    taxable: boolean;
    taxClass?: string;
  };
  
  // 재고 정보
  inventory: {
    tracked: boolean;
    quantity?: number;
    lowStockThreshold?: number;
    allowBackorders: boolean;
  };
  
  // 분류 및 태그
  categoryId: string;
  tags: string[];
  
  // 미디어
  images: ProductImage[];
  
  // 배송 정보
  shipping: {
    weight?: number;
    dimensions?: { length: number; width: number; height: number; };
    shippingClass?: string;
    requiresShipping: boolean;
  };
  
  // SEO
  seo: {
    metaTitle?: string;
    metaDescription?: string;
    focusKeyword?: string;
  };
  
  // 확장 필드
  attributes: Record<string, any>;
  
  createdAt: Date;
  updatedAt: Date;
}
```

#### 주문 (Orders)
```typescript
interface BaseOrder {
  id: string;
  orderNumber: string;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
  
  // 고객 정보
  customer: {
    id?: string;
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
  };
  
  // 주문 상품
  items: OrderItem[];
  
  // 금액 정보
  totals: {
    subtotal: number;
    shipping: number;
    tax: number;
    discount: number;
    total: number;
  };
  
  // 배송 정보
  shipping: {
    address: Address;
    method: string;
    cost: number;
    trackingNumber?: string;
    estimatedDelivery?: Date;
  };
  
  // 결제 정보
  payment: {
    method: string;
    status: 'pending' | 'paid' | 'failed' | 'refunded';
    transactionId?: string;
    gateway: string;
    paidAt?: Date;
  };
  
  // 할인 정보
  coupons: AppliedCoupon[];
  
  // 메모 및 이력
  notes: OrderNote[];
  statusHistory: OrderStatusChange[];
  
  createdAt: Date;
  updatedAt: Date;
}
```

#### 장바구니 (Cart)
```typescript
interface BaseCart {
  id: string;
  sessionId?: string;
  customerId?: string;
  
  items: CartItem[];
  
  totals: {
    subtotal: number;
    shipping: number;
    tax: number;
    discount: number;
    total: number;
  };
  
  // 쿠폰 및 할인
  appliedCoupons: AppliedCoupon[];
  
  // 배송 정보
  shippingAddress?: Address;
  shippingMethod?: string;
  
  // 만료 관리
  expiresAt: Date;
  updatedAt: Date;
}
```

### API 설계

#### 상품 API
```typescript
// GET /api/commerce/products
interface ProductListAPI {
  products: BaseProduct[];
  pagination: PaginationInfo;
  filters: FilterInfo;
}

// GET /api/commerce/products/:id
interface ProductDetailAPI {
  product: BaseProduct;
  variants?: ProductVariant[];
  related?: BaseProduct[];
}

// POST /api/commerce/products
interface CreateProductAPI {
  product: Omit<BaseProduct, 'id' | 'createdAt' | 'updatedAt'>;
}
```

#### 주문 API
```typescript
// POST /api/commerce/orders
interface CreateOrderAPI {
  cartId: string;
  customer: CustomerInfo;
  shipping: ShippingInfo;
  payment: PaymentInfo;
}

// GET /api/commerce/orders/:id
interface OrderDetailAPI {
  order: BaseOrder;
  timeline: OrderTimeline[];
}

// PATCH /api/commerce/orders/:id/status
interface UpdateOrderStatusAPI {
  status: OrderStatus;
  note?: string;
  notifyCustomer?: boolean;
}
```

#### 장바구니 API
```typescript
// POST /api/commerce/cart/items
interface AddToCartAPI {
  productId: string;
  quantity: number;
  options?: Record<string, any>;
}

// GET /api/commerce/cart
interface GetCartAPI {
  cart: BaseCart;
  recommendations?: BaseProduct[];
}
```

### 확장 시스템

#### 플러그인 확장 인터페이스
```typescript
interface CommerceExtension {
  // 상품 확장
  extendProduct(product: BaseProduct): ExtendedProduct;
  
  // 주문 확장
  extendOrder(order: BaseOrder): ExtendedOrder;
  
  // 장바구니 확장
  extendCart(cart: BaseCart): ExtendedCart;
  
  // 커스텀 필드 정의
  getCustomFields(): CustomFieldDefinition[];
  
  // 커스텀 결제 로직
  processPayment?(paymentData: PaymentData): Promise<PaymentResult>;
  
  // 커스텀 배송 로직
  calculateShipping?(items: CartItem[], address: Address): Promise<ShippingOption[]>;
}
```

#### 이벤트 시스템
```typescript
interface CommerceEvents {
  // 상품 이벤트
  'product.created': (product: BaseProduct) => void;
  'product.updated': (product: BaseProduct, changes: Partial<BaseProduct>) => void;
  'product.deleted': (productId: string) => void;
  
  // 주문 이벤트
  'order.created': (order: BaseOrder) => void;
  'order.status_changed': (order: BaseOrder, oldStatus: OrderStatus) => void;
  'order.paid': (order: BaseOrder) => void;
  'order.shipped': (order: BaseOrder) => void;
  
  // 장바구니 이벤트
  'cart.item_added': (cart: BaseCart, item: CartItem) => void;
  'cart.item_removed': (cart: BaseCart, itemId: string) => void;
  'cart.checkout': (cart: BaseCart) => void;
}
```

## 🎨 UI 컴포넌트

### 공통 커머스 컴포넌트
- **ProductCard**: 상품 카드 (이미지, 제목, 가격)
- **ProductGrid**: 상품 그리드 레이아웃
- **ProductFilter**: 카테고리, 가격, 브랜드 필터
- **ProductSearch**: 실시간 검색, 자동완성
- **CartWidget**: 장바구니 요약, 미니 장바구니

### 상품 상세 컴포넌트
- **ProductGallery**: 이미지 갤러리, 확대보기
- **ProductInfo**: 제목, 설명, 가격 정보
- **ProductOptions**: 옵션 선택 (색상, 사이즈 등)
- **AddToCartForm**: 수량 선택, 장바구니 추가
- **ProductReviews**: 리뷰 목록, 평점

### 주문 관련 컴포넌트
- **CheckoutForm**: 배송지, 결제 정보 입력
- **OrderSummary**: 주문 요약, 총액 계산
- **PaymentMethods**: 결제 수단 선택
- **OrderTracking**: 주문 상태, 배송 추적
- **OrderHistory**: 주문 내역 목록

### 관리자 컴포넌트
- **ProductManager**: 상품 목록, 편집, 삭제
- **OrderManager**: 주문 목록, 상태 관리
- **CustomerManager**: 고객 정보, 주문 이력
- **ReportDashboard**: 매출, 재고, 통계

## 🔌 플러그인 시스템

### 커머스 플러그인 인터페이스
```typescript
class CommercePlugin implements Plugin {
  name = 'commerce-base';
  version = '1.0.0';
  
  async install(context: PluginContext) {
    // 데이터베이스 스키마 생성
    await this.createTables(context.database);
    
    // 기본 설정값 추가
    await this.createSettings(context);
    
    // 기본 권한 생성
    await this.createPermissions(context);
  }
  
  getRoutes(): RouteDefinition[] {
    return [
      { path: '/shop', component: ProductList, layout: 'public' },
      { path: '/shop/:id', component: ProductDetail, layout: 'public' },
      { path: '/cart', component: Cart, layout: 'public' },
      { path: '/checkout', component: Checkout, layout: 'public' },
      { path: '/admin/products', component: ProductManager, layout: 'admin', permission: 'commerce.products.manage' },
      { path: '/admin/orders', component: OrderManager, layout: 'admin', permission: 'commerce.orders.manage' },
    ];
  }
  
  getMenuItems(): MenuItem[] {
    return [
      {
        id: 'commerce',
        label: '커머스',
        icon: 'ShoppingCart',
        children: [
          { id: 'products', label: '상품 관리', path: '/admin/products' },
          { id: 'orders', label: '주문 관리', path: '/admin/orders' },
          { id: 'customers', label: '고객 관리', path: '/admin/customers' },
          { id: 'coupons', label: '쿠폰 관리', path: '/admin/coupons' },
        ]
      }
    ];
  }
}
```

## 🚀 성능 최적화

### 캐싱 전략
- **상품 캐시**: 자주 조회되는 상품 정보 캐싱
- **가격 캐시**: 복잡한 가격 계산 결과 캐싱
- **재고 캐시**: 실시간 재고 정보 캐싱
- **검색 캐시**: 인기 검색어, 검색 결과 캐싱

### 데이터베이스 최적화
- **인덱싱**: 검색, 필터링용 복합 인덱스
- **파티셔닝**: 대용량 주문 데이터 월별 파티션
- **읽기 전용 복제본**: 조회 성능 향상
- **연결 풀링**: 데이터베이스 연결 최적화

## 🔒 보안 고려사항

### 결제 보안
- **PCI DSS 준수**: 카드 정보 처리 보안 표준
- **토큰화**: 결제 정보 암호화 저장
- **3D Secure**: 추가 인증 단계
- **사기 탐지**: 이상 거래 패턴 감지

### 데이터 보안
- **개인정보 암호화**: 고객 정보 암호화 저장
- **접근 로그**: 민감 데이터 접근 기록
- **GDPR 준수**: 데이터 삭제, 수정 권리
- **API 보안**: Rate limiting, 인증 토큰

## 🧪 테스트 전략

### 단위 테스트
- 상품 CRUD 로직 테스트
- 가격 계산 로직 테스트
- 재고 관리 로직 테스트
- 주문 상태 변경 테스트

### 통합 테스트
- 장바구니-주문 변환 테스트
- 결제 시스템 통합 테스트
- 배송 시스템 통합 테스트
- 이메일 알림 테스트

### E2E 테스트
- 상품 검색-구매 플로우
- 장바구니 추가-결제 플로우
- 관리자 상품 등록 플로우
- 주문 관리 플로우

이 커머스 베이스 플러그인은 여행, 패션, 디지털 상품 등 다양한 도메인에서 확장하여 사용할 수 있는 범용 커머스 시스템입니다.