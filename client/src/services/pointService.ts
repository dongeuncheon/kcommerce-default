import { api } from './api';

interface PointBalance {
  totalPoints: number;
  availablePoints: number;
  pendingPoints: number;
  usedPoints: number;
  expiredPoints: number;
}

interface PointTransaction {
  id: string;
  type: 'EARNED' | 'USED' | 'EXPIRED' | 'CANCELLED' | 'ADJUSTED';
  amount: number;
  balance: number;
  reason: string;
  reasonCode: string;
  relatedId?: string;
  relatedType?: 'ORDER' | 'REVIEW' | 'EVENT' | 'ADMIN';
  expiresAt?: string;
  createdAt: string;
}

interface PointHistoryQuery {
  userId?: string;
  type?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

interface PointHistoryResponse {
  transactions: PointTransaction[];
  total: number;
  page: number;
  limit: number;
}

export const pointService = {
  /**
   * 포인트 잔액 조회
   */
  getBalance: async (userId?: string): Promise<PointBalance> => {
    const url = userId ? `/api/v1/points/balance/${userId}` : '/api/v1/points/balance';
    const response = await api.get(url);
    return response.data.balance;
  },

  /**
   * 포인트 내역 조회
   */
  getHistory: async (query: PointHistoryQuery): Promise<PointHistoryResponse> => {
    const url = query.userId 
      ? `/api/v1/points/history/${query.userId}`
      : '/api/v1/points/history';
    
    const response = await api.get(url, { params: query });
    return response.data;
  },

  /**
   * 포인트 사용
   */
  usePoints: async (amount: number, orderId: string): Promise<PointTransaction> => {
    const response = await api.post('/api/v1/points/use', {
      amount,
      orderId
    });
    return response.data.transaction;
  },

  /**
   * 사용 가능한 최대 포인트 계산
   */
  calculateUsablePoints: async (orderAmount: number): Promise<{
    availablePoints: number;
    maxUsablePoints: number;
  }> => {
    const response = await api.get('/api/v1/points/usable', {
      params: { orderAmount }
    });
    return response.data;
  },

  /**
   * 포인트 적립 (관리자용)
   */
  earnPoints: async (data: {
    userId: string;
    amount: number;
    reason: string;
    reasonCode: string;
    relatedId?: string;
    relatedType?: string;
  }): Promise<PointTransaction> => {
    const response = await api.post('/api/v1/points/earn', data);
    return response.data.transaction;
  },

  /**
   * 포인트 조정 (관리자용)
   */
  adjustPoints: async (
    userId: string,
    amount: number,
    reason: string
  ): Promise<PointTransaction> => {
    const response = await api.post('/api/v1/points/adjust', {
      userId,
      amount,
      reason
    });
    return response.data.transaction;
  }
};