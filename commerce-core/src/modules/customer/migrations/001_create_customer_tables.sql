-- Customer management system tables
-- Created for comprehensive customer management with Korean-specific features

-- Customer tiers table
CREATE TABLE IF NOT EXISTS customer_tiers (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  nameKo VARCHAR(100) NOT NULL COMMENT '한글 등급명',
  minSpent DECIMAL(15,2) NOT NULL COMMENT '최소 구매금액',
  maxSpent DECIMAL(15,2) NULL COMMENT '최대 구매금액',
  benefits JSON NOT NULL DEFAULT ('[]') COMMENT '혜택 목록',
  discountPercentage DECIMAL(5,2) NOT NULL DEFAULT 0 COMMENT '할인율',
  pointsMultiplier DECIMAL(3,2) NOT NULL DEFAULT 1.00 COMMENT '포인트 적립 배수',
  color VARCHAR(7) NOT NULL DEFAULT '#6B7280' COMMENT '등급 색상',
  priority INT NOT NULL DEFAULT 0 COMMENT '우선순위',
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_tiers_priority (priority),
  INDEX idx_tiers_min_spent (minSpent),
  INDEX idx_tiers_max_spent (maxSpent)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Customer segments table
CREATE TABLE IF NOT EXISTS customer_segments (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  nameKo VARCHAR(100) NOT NULL COMMENT '한글 세그먼트명',
  description TEXT NOT NULL COMMENT '세그먼트 설명',
  criteria JSON NOT NULL COMMENT '세그먼트 기준',
  color VARCHAR(7) NOT NULL DEFAULT '#6B7280' COMMENT '세그먼트 색상',
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_segments_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Main customers table
CREATE TABLE IF NOT EXISTS customers (
  id VARCHAR(36) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20) UNIQUE NOT NULL,
  
  -- Personal information
  firstName VARCHAR(100) NOT NULL COMMENT '이름',
  lastName VARCHAR(100) NOT NULL COMMENT '성',
  koreanName VARCHAR(100) NULL COMMENT '한글명',
  dateOfBirth DATE NULL COMMENT '생년월일',
  gender ENUM('male','female','other') NULL COMMENT '성별',
  
  -- Account information
  isActive BOOLEAN NOT NULL DEFAULT TRUE COMMENT '활성 상태',
  isVerified BOOLEAN NOT NULL DEFAULT FALSE COMMENT '인증 상태',
  emailVerified BOOLEAN NOT NULL DEFAULT FALSE COMMENT '이메일 인증',
  phoneVerified BOOLEAN NOT NULL DEFAULT FALSE COMMENT '전화번호 인증',
  
  -- Tier and segmentation
  tierId VARCHAR(36) NULL COMMENT '고객 등급 ID',
  segments JSON NOT NULL DEFAULT ('[]') COMMENT '세그먼트 목록',
  tags JSON NOT NULL DEFAULT ('[]') COMMENT '태그 목록',
  
  -- Marketing preferences (Korean privacy compliance)
  marketingEmail BOOLEAN NOT NULL DEFAULT TRUE COMMENT '이메일 마케팅 수신 동의',
  marketingSms BOOLEAN NOT NULL DEFAULT TRUE COMMENT 'SMS 마케팅 수신 동의',
  marketingPush BOOLEAN NOT NULL DEFAULT TRUE COMMENT '푸시 알림 수신 동의',
  marketingDirectMail BOOLEAN NOT NULL DEFAULT FALSE COMMENT '우편 마케팅 수신 동의',
  marketingConsent BOOLEAN NOT NULL DEFAULT FALSE COMMENT '마케팅 활용 동의',
  personalInfoConsent BOOLEAN NOT NULL DEFAULT FALSE COMMENT '개인정보 수집 이용 동의',
  thirdPartyConsent BOOLEAN NOT NULL DEFAULT FALSE COMMENT '제3자 정보 제공 동의',
  consentDate DATETIME NOT NULL COMMENT '동의 일시',
  consentIp VARCHAR(45) NULL COMMENT '동의 IP 주소',
  
  -- Preferences
  language VARCHAR(5) NOT NULL DEFAULT 'ko' COMMENT '언어 설정',
  timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Seoul' COMMENT '시간대',
  currency VARCHAR(3) NOT NULL DEFAULT 'KRW' COMMENT '통화',
  
  -- Customer service
  notes JSON NOT NULL DEFAULT ('[]') COMMENT '고객 메모',
  internalNotes JSON NOT NULL DEFAULT ('[]') COMMENT '내부 메모',
  priority ENUM('low','normal','high','vip') NOT NULL DEFAULT 'normal' COMMENT '우선순위',
  
  -- Metadata
  source VARCHAR(50) NOT NULL DEFAULT 'website' COMMENT '가입 경로',
  referralCode VARCHAR(50) NULL COMMENT '추천 코드',
  referredBy VARCHAR(36) NULL COMMENT '추천인 고객 ID',
  lastLoginAt DATETIME NULL COMMENT '마지막 로그인',
  
  -- Statistics (computed fields - updated by triggers/jobs)
  totalOrders INT NOT NULL DEFAULT 0 COMMENT '총 주문 수',
  totalSpent DECIMAL(15,2) NOT NULL DEFAULT 0 COMMENT '총 구매금액',
  averageOrderValue DECIMAL(15,2) NOT NULL DEFAULT 0 COMMENT '평균 주문금액',
  lastOrderDate DATETIME NULL COMMENT '마지막 주문일',
  firstOrderDate DATETIME NULL COMMENT '첫 주문일',
  lifetimeValue DECIMAL(15,2) NOT NULL DEFAULT 0 COMMENT '고객 생애 가치',
  loyaltyPoints INT NOT NULL DEFAULT 0 COMMENT '보유 포인트',
  daysSinceLastOrder INT NULL COMMENT '마지막 주문 이후 일수',
  daysSinceRegistration INT NOT NULL DEFAULT 0 COMMENT '가입 이후 일수',
  
  -- Timestamps
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Indexes
  INDEX idx_customers_email (email),
  INDEX idx_customers_phone (phone),
  INDEX idx_customers_active (isActive),
  INDEX idx_customers_tier (tierId),
  INDEX idx_customers_source (source),
  INDEX idx_customers_created (createdAt),
  INDEX idx_customers_last_order (lastOrderDate),
  INDEX idx_customers_total_spent (totalSpent),
  INDEX idx_customers_priority (priority),
  INDEX idx_customers_korean_name (koreanName),
  INDEX idx_customers_referral (referredBy),
  INDEX idx_customers_consent (personalInfoConsent, marketingConsent),
  INDEX idx_customers_verification (emailVerified, phoneVerified),
  
  -- Foreign keys
  CONSTRAINT fk_customers_tier 
    FOREIGN KEY (tierId) REFERENCES customer_tiers(id) 
    ON DELETE SET NULL,
  CONSTRAINT fk_customers_referrer 
    FOREIGN KEY (referredBy) REFERENCES customers(id) 
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Customer addresses table (Korean address format)
CREATE TABLE IF NOT EXISTS customer_addresses (
  id VARCHAR(36) PRIMARY KEY,
  customerId VARCHAR(36) NOT NULL,
  type ENUM('home','work','shipping','billing') NOT NULL COMMENT '주소 유형',
  isDefault BOOLEAN NOT NULL DEFAULT FALSE COMMENT '기본 주소 여부',
  
  -- Korean address fields
  zipCode VARCHAR(10) NOT NULL COMMENT '우편번호 (5자리)',
  address1 VARCHAR(255) NOT NULL COMMENT '기본 주소',
  address2 VARCHAR(255) NULL COMMENT '상세 주소',
  city VARCHAR(50) NOT NULL COMMENT '시/도',
  district VARCHAR(50) NOT NULL COMMENT '시/군/구',
  neighborhood VARCHAR(50) NULL COMMENT '동/읍/면',
  
  -- Additional fields
  recipientName VARCHAR(100) NOT NULL COMMENT '수령인명',
  recipientPhone VARCHAR(20) NOT NULL COMMENT '수령인 전화번호',
  deliveryNote TEXT NULL COMMENT '배송 메모',
  
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Indexes
  INDEX idx_addresses_customer (customerId),
  INDEX idx_addresses_type (type),
  INDEX idx_addresses_default (isDefault),
  INDEX idx_addresses_city (city),
  INDEX idx_addresses_district (district),
  INDEX idx_addresses_zipcode (zipCode),
  
  -- Foreign keys
  CONSTRAINT fk_addresses_customer 
    FOREIGN KEY (customerId) REFERENCES customers(id) 
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Customer loyalty points table
CREATE TABLE IF NOT EXISTS customer_loyalty_points (
  id VARCHAR(36) PRIMARY KEY,
  customerId VARCHAR(36) NOT NULL,
  points INT NOT NULL COMMENT '포인트 금액',
  transactionType ENUM('earned','redeemed','expired','adjusted') NOT NULL COMMENT '거래 유형',
  transactionAmount DECIMAL(15,2) NOT NULL COMMENT '거래 금액',
  orderId VARCHAR(36) NULL COMMENT '관련 주문 ID',
  description TEXT NOT NULL COMMENT '포인트 설명',
  expiresAt DATETIME NULL COMMENT '만료일',
  
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Indexes
  INDEX idx_loyalty_customer (customerId),
  INDEX idx_loyalty_type (transactionType),
  INDEX idx_loyalty_order (orderId),
  INDEX idx_loyalty_expires (expiresAt),
  INDEX idx_loyalty_created (createdAt),
  
  -- Foreign keys
  CONSTRAINT fk_loyalty_customer 
    FOREIGN KEY (customerId) REFERENCES customers(id) 
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default customer tiers
INSERT INTO customer_tiers (id, name, nameKo, minSpent, maxSpent, benefits, discountPercentage, pointsMultiplier, color, priority) VALUES
('tier_bronze', 'Bronze', '브론즈', 0, 99999, '["기본 포인트 적립"]', 0, 1.0, '#CD7F32', 1),
('tier_silver', 'Silver', '실버', 100000, 499999, '["5% 할인", "무료배송"]', 5, 1.2, '#C0C0C0', 2),
('tier_gold', 'Gold', '골드', 500000, 999999, '["10% 할인", "무료배송", "생일 쿠폰"]', 10, 1.5, '#FFD700', 3),
('tier_platinum', 'Platinum', '플래티넘', 1000000, 4999999, '["15% 할인", "무료배송", "생일 쿠폰", "전용 상담"]', 15, 2.0, '#E5E4E2', 4),
('tier_diamond', 'Diamond', '다이아몬드', 5000000, NULL, '["20% 할인", "무료배송", "생일 쿠폰", "전용 상담", "VIP 이벤트"]', 20, 3.0, '#B9F2FF', 5);

-- Insert default customer segments
INSERT INTO customer_segments (id, name, nameKo, description, criteria, color) VALUES
('seg_new', 'New Customers', '신규 고객', '가입 후 30일 이내 고객', '{"registeredDaysAgo": 30, "maxOrderCount": 1}', '#10B981'),
('seg_active', 'Active Customers', '활성 고객', '최근 3개월 내 주문 고객', '{"lastOrderDaysAgo": 90, "minOrderCount": 2}', '#3B82F6'),
('seg_vip', 'VIP Customers', 'VIP 고객', '고액 구매 고객', '{"minTotalSpent": 1000000}', '#8B5CF6'),
('seg_dormant', 'Dormant Customers', '휴면 고객', '6개월 이상 주문 없는 고객', '{"lastOrderDaysAgo": 180}', '#EF4444'),
('seg_loyal', 'Loyal Customers', '충성 고객', '10회 이상 구매한 고객', '{"minOrderCount": 10}', '#F59E0B');

-- Create triggers for updating customer statistics
DELIMITER //

CREATE TRIGGER update_customer_registration_days
  BEFORE UPDATE ON customers
  FOR EACH ROW
BEGIN
  SET NEW.daysSinceRegistration = DATEDIFF(NOW(), NEW.createdAt);
  
  IF NEW.lastOrderDate IS NOT NULL THEN
    SET NEW.daysSinceLastOrder = DATEDIFF(NOW(), NEW.lastOrderDate);
  END IF;
END//

CREATE TRIGGER update_customer_registration_days_insert
  BEFORE INSERT ON customers
  FOR EACH ROW
BEGIN
  SET NEW.daysSinceRegistration = 0;
END//

DELIMITER ;

-- Create a view for customer summary
CREATE VIEW customer_summary AS
SELECT 
  c.id,
  c.email,
  c.phone,
  CONCAT(c.firstName, ' ', c.lastName) AS fullName,
  c.koreanName,
  c.isActive,
  c.totalOrders,
  c.totalSpent,
  c.loyaltyPoints,
  ct.name AS tierName,
  ct.nameKo AS tierNameKo,
  c.lastOrderDate,
  c.createdAt,
  c.priority,
  c.source
FROM customers c
LEFT JOIN customer_tiers ct ON c.tierId = ct.id;