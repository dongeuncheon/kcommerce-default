export interface PointBalance {
  totalPoints: number;
  availablePoints: number;
  pendingPoints: number;
  usedPoints: number;
  expiredPoints: number;
}

export interface PointTransaction {
  id: string;
  type: 'EARNED' | 'USED' | 'EXPIRED' | 'CANCELLED' | 'ADJUSTED';
  amount: number;
  balance: number;
  reason: string;
  reasonCode: string;
  relatedId?: string;
  relatedType?: 'ORDER' | 'REVIEW' | 'EVENT' | 'ADMIN';
  expiresAt?: Date;
  createdAt: Date;
}

export interface PointPolicy {
  // 적립 정책
  orderEarnRate: number;          // 주문 금액 대비 적립률 (%)
  reviewEarnPoints: number;       // 리뷰 작성 적립 포인트
  signupBonusPoints: number;      // 회원가입 보너스
  
  // 등급별 적립률
  membershipRates: {
    BRONZE: number;
    SILVER: number;
    GOLD: number;
    VIP: number;
  };
  
  // 사용 정책
  minimumUseAmount: number;       // 최소 사용 포인트
  maximumUseRate: number;         // 주문 금액 대비 최대 사용률 (%)
  
  // 만료 정책
  expirationDays: number;         // 포인트 만료 일수
  expirationNotifyDays: number;   // 만료 알림 일수
}

export interface EarnPointsRequest {
  userId: string;
  amount: number;
  reason: string;
  reasonCode: 'ORDER_COMPLETE' | 'REVIEW_WRITE' | 'EVENT' | 'SIGNUP' | 'ADMIN_GRANT';
  relatedId?: string;
  relatedType?: 'ORDER' | 'REVIEW' | 'EVENT' | 'ADMIN';
  expiresAt?: Date;
}

export interface UsePointsRequest {
  userId: string;
  amount: number;
  orderId: string;
}

export interface PointHistoryQuery {
  userId: string;
  type?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}