# 📋 데이터 계약 명세서

## 📋 개요
모든 모듈이 공유하는 표준 데이터 구조와 스키마 정의입니다. 타입 안전성과 데이터 일관성을 보장하여 모듈 간 원활한 데이터 교환을 지원합니다.

## 🎯 핵심 원칙
1. **타입 안전성**: 모든 데이터는 엄격한 TypeScript 타입 정의
2. **버전 호환성**: 스키마 변경 시 하위 호환성 보장
3. **유효성 검증**: Zod 스키마를 통한 런타임 검증
4. **문서화**: 모든 필드에 대한 명확한 설명

## 👤 사용자 관련 데이터

### User (사용자)
```typescript
interface User {
  id: string;                    // 사용자 고유 ID (UUID)
  email: string;                 // 이메일 주소 (로그인 ID)
  username: string;              // 사용자명 (고유)
  displayName: string;           // 표시명
  firstName?: string;            // 이름
  lastName?: string;             // 성
  avatar?: string;               // 프로필 이미지 URL
  phone?: string;                // 전화번호
  dateOfBirth?: string;          // 생년월일 (ISO 8601)
  gender?: 'male' | 'female' | 'other';
  
  // 시스템 필드
  roles: string[];               // 역할 목록
  permissions: string[];         // 권한 목록
  status: 'active' | 'inactive' | 'suspended' | 'pending';
  emailVerified: boolean;        // 이메일 인증 여부
  phoneVerified: boolean;        // 전화번호 인증 여부
  
  // 타임스탬프
  createdAt: string;             // 생성일시 (ISO 8601)
  updatedAt: string;             // 수정일시 (ISO 8601)
  lastLoginAt?: string;          // 마지막 로그인 (ISO 8601)
  
  // 설정
  preferences: UserPreferences;   // 사용자 설정
  metadata?: Record<string, any>; // 추가 메타데이터
}

interface UserPreferences {
  language: string;              // 언어 설정 (ko, en, ja 등)
  timezone: string;              // 시간대
  currency: string;              // 기본 통화
  newsletter: boolean;           // 뉴스레터 수신 동의
  notifications: {
    email: boolean;              // 이메일 알림
    sms: boolean;                // SMS 알림
    push: boolean;               // 푸시 알림
  };
  privacy: {
    profilePublic: boolean;      // 프로필 공개 여부
    showEmail: boolean;          // 이메일 공개 여부
  };
}
```

### UserSession (사용자 세션)
```typescript
interface UserSession {
  id: string;                    // 세션 ID
  userId: string;                // 사용자 ID
  deviceInfo: {
    userAgent: string;           // User Agent
    ip: string;                  // IP 주소
    location?: string;           // 위치 정보
  };
  createdAt: string;             // 세션 시작
  expiresAt: string;             // 세션 만료
  lastActivity: string;          // 마지막 활동
  isActive: boolean;             // 활성 상태
}
```

## 🛍️ Commerce 관련 데이터

### Product (상품)
```typescript
interface Product {
  id: string;                    // 상품 고유 ID
  sku: string;                   // 상품 코드 (고유)
  name: string;                  // 상품명
  description: string;           // 상품 설명
  shortDescription?: string;     // 간단 설명
  
  // 가격 정보
  price: number;                 // 기본 가격
  salePrice?: number;            // 할인 가격
  currency: string;              // 통화 (KRW, USD 등)
  
  // 분류
  category: string;              // 카테고리
  subcategory?: string;          // 서브카테고리
  brand?: string;                // 브랜드
  tags: string[];                // 태그 목록
  
  // 미디어
  images: ProductImage[];        // 상품 이미지들
  videos?: string[];             // 동영상 URL들
  
  // 재고 및 상태
  inventory: ProductInventory;   // 재고 정보
  status: 'draft' | 'active' | 'inactive' | 'discontinued';
  
  // SEO
  seo: {
    metaTitle?: string;          // 메타 제목
    metaDescription?: string;    // 메타 설명
    slug: string;                // URL 슬러그
  };
  
  // 시스템
  createdAt: string;
  updatedAt: string;
  createdBy: string;             // 생성자 ID
  metadata?: Record<string, any>;
}

interface ProductImage {
  id: string;
  url: string;
  alt: string;
  order: number;
  type: 'main' | 'gallery' | 'thumbnail';
}

interface ProductInventory {
  trackInventory: boolean;       // 재고 추적 여부
  quantity: number;              // 현재 재고량
  reservedQuantity: number;      // 예약된 재고량
  lowStockThreshold: number;     // 재고 부족 알림 기준
  allowBackorder: boolean;       // 품절시 주문 허용 여부
}
```

### Order (주문)
```typescript
interface Order {
  id: string;                    // 주문 고유 ID
  orderNumber: string;           // 주문 번호 (사용자용)
  userId: string;                // 주문자 ID
  
  // 주문 항목
  items: OrderItem[];            // 주문 상품들
  
  // 금액 정보
  subtotal: number;              // 상품 금액 합계
  discountAmount: number;        // 할인 금액
  taxAmount: number;             // 세금
  shippingAmount: number;        // 배송비
  totalAmount: number;           // 최종 결제 금액
  currency: string;              // 통화
  
  // 상태
  status: OrderStatus;           // 주문 상태
  paymentStatus: PaymentStatus;  // 결제 상태
  fulfillmentStatus: FulfillmentStatus; // 배송 상태
  
  // 주소 정보
  shippingAddress: Address;      // 배송 주소
  billingAddress: Address;       // 청구 주소
  
  // 결제 정보
  paymentMethod: PaymentMethod;  // 결제 수단
  
  // 배송 정보
  shippingMethod: ShippingMethod; // 배송 방법
  trackingNumber?: string;       // 운송장 번호
  
  // 타임스탬프
  createdAt: string;
  updatedAt: string;
  shippedAt?: string;            // 배송일
  deliveredAt?: string;          // 배송완료일
  
  // 기타
  notes?: string;                // 주문 메모
  metadata?: Record<string, any>;
}

interface OrderItem {
  id: string;                    // 주문 항목 ID
  productId: string;             // 상품 ID
  variantId?: string;            // 상품 변형 ID
  quantity: number;              // 수량
  unitPrice: number;             // 단가
  totalPrice: number;            // 총 가격
  productSnapshot: {             // 주문 당시 상품 정보
    name: string;
    sku: string;
    image: string;
  };
  options?: Record<string, any>; // 선택한 옵션들
}

type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded' | 'partially_refunded';
type FulfillmentStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'returned';
```

### Payment (결제)
```typescript
interface Payment {
  id: string;                    // 결제 ID
  orderId: string;               // 주문 ID
  amount: number;                // 결제 금액
  currency: string;              // 통화
  method: PaymentMethod;         // 결제 수단
  status: PaymentStatus;         // 결제 상태
  
  // 결제사 정보
  gateway: string;               // 결제 게이트웨이
  transactionId: string;         // 거래 ID
  gatewayResponse?: any;         // 결제사 응답
  
  // 타임스탬프
  createdAt: string;
  processedAt?: string;          // 처리완료일
  
  metadata?: Record<string, any>;
}

interface PaymentMethod {
  type: 'card' | 'bank_transfer' | 'digital_wallet' | 'crypto';
  details: {
    // 카드 결제
    cardLast4?: string;          // 카드 마지막 4자리
    cardBrand?: string;          // 카드 브랜드
    
    // 계좌이체
    bankName?: string;           // 은행명
    accountLast4?: string;       // 계좌 마지막 4자리
    
    // 디지털 지갑
    walletType?: string;         // 지갑 유형 (PayPal, Apple Pay 등)
  };
}
```

## ✈️ Travel 관련 데이터

### TravelProduct (여행 상품)
```typescript
interface TravelProduct extends Product {
  type: TravelProductType;       // 여행 상품 유형
  destination: Destination;      // 목적지 정보
  duration: number;              // 여행 기간 (일수)
  maxCapacity: number;           // 최대 수용 인원
  minCapacity: number;           // 최소 출발 인원
  
  // 날짜 및 가용성
  availableDates: AvailableDate[]; // 가능한 출발일들
  seasonality: Seasonality[];    // 시즌별 가격
  
  // 포함/불포함 사항
  inclusions: string[];          // 포함 사항
  exclusions: string[];          // 불포함 사항
  
  // 일정
  itinerary: ItineraryItem[];    // 여행 일정
  
  // 정책
  cancellationPolicy: CancellationPolicy; // 취소 정책
  
  // 추가 정보
  difficulty?: 'easy' | 'moderate' | 'difficult'; // 난이도 (액티비티)
  ageRestriction?: {             // 연령 제한
    min?: number;
    max?: number;
  };
  requirements?: string[];       // 필요 조건들
}

type TravelProductType = 'flight' | 'hotel' | 'package' | 'activity' | 'car_rental' | 'cruise' | 'tour';

interface Destination {
  country: string;               // 국가
  city: string;                  // 도시
  region?: string;               // 지역
  coordinates?: {                // 좌표
    latitude: number;
    longitude: number;
  };
  timezone: string;              // 시간대
}

interface AvailableDate {
  date: string;                  // 출발일 (ISO 8601)
  availableSlots: number;        // 남은 자리
  price: number;                 // 해당 날짜 가격
  status: 'available' | 'limited' | 'sold_out' | 'cancelled';
}

interface Seasonality {
  startDate: string;             // 시즌 시작
  endDate: string;               // 시즌 종료
  multiplier: number;            // 가격 배수
  name: string;                  // 시즌명 (성수기, 비수기 등)
}

interface ItineraryItem {
  day: number;                   // 일차
  title: string;                 // 일정 제목
  description: string;           // 상세 설명
  activities: Activity[];        // 활동들
  meals: Meal[];                 // 식사
  accommodation?: Accommodation; // 숙박
  transportation?: Transportation; // 교통
  freeTime?: string;             // 자유시간 설명
}

interface Activity {
  name: string;                  // 활동명
  description: string;           // 설명
  duration: number;              // 소요시간 (분)
  location: string;              // 위치
  included: boolean;             // 포함 여부
  optional?: boolean;            // 선택 여부
  additionalCost?: number;       // 추가 비용
}

interface Meal {
  type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  included: boolean;             // 포함 여부
  description?: string;          // 설명
  restaurant?: string;           // 레스토랑명
  dietaryOptions?: string[];     // 식단 옵션들
}

interface Accommodation {
  name: string;                  // 숙박시설명
  type: 'hotel' | 'resort' | 'guesthouse' | 'camping' | 'other';
  rating?: number;               // 등급
  roomType: string;              // 객실 유형
  checkIn: string;               // 체크인 시간
  checkOut: string;              // 체크아웃 시간
  amenities: string[];           // 편의시설
}

interface Transportation {
  type: 'flight' | 'bus' | 'train' | 'car' | 'boat' | 'walking';
  from: string;                  // 출발지
  to: string;                    // 도착지
  departureTime?: string;        // 출발 시간
  arrivalTime?: string;          // 도착 시간
  duration: number;              // 소요시간 (분)
  details?: string;              // 추가 정보
}

interface CancellationPolicy {
  freeCancellationUntil?: string; // 무료 취소 가능일
  cancellationFees: CancellationFee[];
  refundPolicy: string;          // 환불 정책 설명
  nonRefundable: boolean;        // 환불 불가 여부
}

interface CancellationFee {
  daysBeforeTravel: number;      // 여행 며칠 전
  feeType: 'percentage' | 'fixed'; // 수수료 유형
  amount: number;                // 수수료 금액/비율
  description: string;           // 설명
}
```

### TravelBooking (여행 예약)
```typescript
interface TravelBooking extends Order {
  // 여행 특화 정보
  travelDate: string;            // 여행 시작일
  returnDate?: string;           // 여행 종료일 (왕복의 경우)
  travelers: Traveler[];         // 여행자 정보
  
  // 예약 정보
  confirmationCode: string;      // 예약 확인번호
  vouchers: TravelVoucher[];     // 바우처들
  
  // 특별 요청사항
  specialRequests?: SpecialRequest[];
  
  // 여행 관련 문서
  documents: TravelDocument[];   // 필요 서류들
  
  // 보험
  insurance?: TravelInsurance;   // 여행자 보험
}

interface Traveler {
  id: string;                    // 여행자 ID
  type: 'adult' | 'child' | 'infant'; // 여행자 구분
  title: 'mr' | 'ms' | 'mrs' | 'dr'; // 호칭
  firstName: string;             // 이름
  lastName: string;              // 성
  dateOfBirth: string;           // 생년월일
  gender: 'male' | 'female';     // 성별
  nationality: string;           // 국적
  
  // 여권 정보
  passport?: {
    number: string;              // 여권번호
    issueDate: string;           // 발급일
    expiryDate: string;          // 만료일
    issuingCountry: string;      // 발급국
  };
  
  // 연락처
  contactInfo: {
    email?: string;              // 이메일
    phone?: string;              // 전화번호
    emergencyContact?: {         // 비상연락처
      name: string;
      relationship: string;
      phone: string;
    };
  };
  
  // 특별 요구사항
  dietaryRequirements?: string[]; // 식단 요구사항
  medicalConditions?: string[];  // 의료 조건
  accessibilityNeeds?: string[]; // 접근성 요구사항
}

interface TravelVoucher {
  id: string;                    // 바우처 ID
  type: string;                  // 바우처 유형
  description: string;           // 설명
  qrCode?: string;               // QR 코드
  validFrom: string;             // 유효 시작일
  validUntil: string;            // 유효 종료일
  usageInstructions: string;     // 사용 방법
  status: 'active' | 'used' | 'expired' | 'cancelled';
}

interface SpecialRequest {
  type: string;                  // 요청 유형
  description: string;           // 상세 설명
  approved: boolean;             // 승인 여부
  additionalCost: number;        // 추가 비용
  notes?: string;                // 처리 메모
}

interface TravelDocument {
  type: 'passport' | 'visa' | 'vaccination' | 'insurance' | 'other';
  name: string;                  // 문서명
  required: boolean;             // 필수 여부
  description: string;           // 설명
  deadline?: string;             // 제출 마감일
  status: 'pending' | 'submitted' | 'approved' | 'rejected';
}

interface TravelInsurance {
  provider: string;              // 보험사
  policyNumber: string;          // 보험증서번호
  coverage: InsuranceCoverage;   // 보장 내용
  premium: number;               // 보험료
  validFrom: string;             // 보장 시작일
  validUntil: string;            // 보장 종료일
}

interface InsuranceCoverage {
  medical: number;               // 의료비 보장
  evacuation: number;            // 긴급 후송비
  baggage: number;               // 휴대품 손해
  tripCancellation: number;      // 여행 취소비
  tripDelay: number;             // 여행 지연비
}
```

## 🏢 공통 데이터

### Address (주소)
```typescript
interface Address {
  id?: string;                   // 주소 ID
  type?: 'home' | 'work' | 'billing' | 'shipping' | 'other';
  firstName?: string;            // 받는 사람 이름
  lastName?: string;             // 받는 사람 성
  company?: string;              // 회사명
  street1: string;               // 주소 1
  street2?: string;              // 주소 2 (상세 주소)
  city: string;                  // 도시
  state: string;                 // 주/도
  postalCode: string;            // 우편번호
  country: string;               // 국가 (ISO 3166-1 alpha-2)
  phone?: string;                // 전화번호
  isDefault?: boolean;           // 기본 주소 여부
}
```

### ShippingMethod (배송 방법)
```typescript
interface ShippingMethod {
  id: string;                    // 배송 방법 ID
  name: string;                  // 배송 방법명
  description: string;           // 설명
  cost: number;                  // 배송비
  estimatedDays: number;         // 예상 배송일
  trackingAvailable: boolean;    // 배송 추적 가능 여부
  restrictions?: {               // 제한사항
    maxWeight?: number;          // 최대 중량
    maxDimensions?: Dimensions;  // 최대 크기
    regions?: string[];          // 배송 가능 지역
  };
}

interface Dimensions {
  length: number;
  width: number;
  height: number;
  unit: 'cm' | 'inch';
}
```

## 🔒 시스템 데이터

### AuditLog (감사 로그)
```typescript
interface AuditLog {
  id: string;                    // 로그 ID
  entityType: string;            // 엔티티 유형
  entityId: string;              // 엔티티 ID
  action: string;                // 수행된 액션
  userId?: string;               // 수행한 사용자 ID
  sessionId?: string;            // 세션 ID
  changes?: {                    // 변경사항
    before?: any;                // 변경 전
    after?: any;                 // 변경 후
  };
  metadata?: Record<string, any>; // 추가 메타데이터
  timestamp: string;             // 수행 시간
  ipAddress?: string;            // IP 주소
  userAgent?: string;            // User Agent
}
```

### SystemHealth (시스템 상태)
```typescript
interface SystemHealth {
  module: string;                // 모듈명
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheck: string;             // 마지막 체크 시간
  metrics: {
    uptime: number;              // 가동 시간 (초)
    memoryUsage: number;         // 메모리 사용률 (%)
    cpuUsage: number;            // CPU 사용률 (%)
    diskUsage: number;           // 디스크 사용률 (%)
    responseTime: number;        // 응답 시간 (ms)
  };
  issues: string[];              // 발견된 문제들
}
```

## 📝 Zod 스키마 예시
```typescript
import { z } from 'zod';

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  username: z.string().min(3).max(30),
  displayName: z.string().min(1).max(100),
  avatar: z.string().url().optional(),
  roles: z.array(z.string()),
  permissions: z.array(z.string()),
  status: z.enum(['active', 'inactive', 'suspended', 'pending']),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  metadata: z.record(z.any()).optional()
});

export const ProductSchema = z.object({
  id: z.string().uuid(),
  sku: z.string().min(1),
  name: z.string().min(1).max(200),
  description: z.string(),
  price: z.number().positive(),
  currency: z.string().length(3),
  category: z.string(),
  tags: z.array(z.string()),
  status: z.enum(['draft', 'active', 'inactive', 'discontinued']),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});
```

이 데이터 계약을 준수하면 모든 모듈이 일관된 데이터 구조로 안전하게 소통할 수 있습니다! 📋