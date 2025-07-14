import React, { useEffect, useState } from 'react';
import { 
  ArrowUpCircle, 
  ArrowDownCircle, 
  XCircle, 
  RefreshCw,
  Settings,
  Calendar,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { pointService } from '../../services/pointService';
import { formatNumber, formatDate } from '../../utils/format';

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

interface PointHistoryProps {
  userId?: string;
  limit?: number;
  showPagination?: boolean;
}

export const PointHistory: React.FC<PointHistoryProps> = ({
  userId,
  limit = 20,
  showPagination = true
}) => {
  const [transactions, setTransactions] = useState<PointTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState<string>('');

  useEffect(() => {
    fetchHistory();
  }, [userId, page, filter]);

  const fetchHistory = async () => {
    try {
      setIsLoading(true);
      const data = await pointService.getHistory({
        userId,
        type: filter || undefined,
        page,
        limit
      });
      setTransactions(data.transactions);
      setTotal(data.total);
    } catch (err) {
      setError('포인트 내역을 불러올 수 없습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'EARNED':
        return <ArrowDownCircle className="w-5 h-5 text-green-600" />;
      case 'USED':
        return <ArrowUpCircle className="w-5 h-5 text-blue-600" />;
      case 'EXPIRED':
        return <XCircle className="w-5 h-5 text-gray-600" />;
      case 'CANCELLED':
        return <RefreshCw className="w-5 h-5 text-orange-600" />;
      case 'ADJUSTED':
        return <Settings className="w-5 h-5 text-purple-600" />;
      default:
        return null;
    }
  };

  const getTypeLabel = (type: string) => {
    const labels = {
      'EARNED': '적립',
      'USED': '사용',
      'EXPIRED': '만료',
      'CANCELLED': '취소',
      'ADJUSTED': '조정'
    };
    return labels[type] || type;
  };

  const totalPages = Math.ceil(total / limit);

  if (isLoading && transactions.length === 0) {
    return (
      <div className="bg-white rounded-lg p-6">
        <div className="animate-pulse space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex justify-between">
              <div className="h-4 bg-gray-200 rounded w-1/3"></div>
              <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm">
      <div className="p-6 border-b">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">포인트 내역</h3>
        
        <div className="flex space-x-2 mb-4">
          <button
            onClick={() => { setFilter(''); setPage(1); }}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              filter === '' 
                ? 'bg-blue-100 text-blue-700' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            전체
          </button>
          <button
            onClick={() => { setFilter('EARNED'); setPage(1); }}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              filter === 'EARNED' 
                ? 'bg-green-100 text-green-700' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            적립
          </button>
          <button
            onClick={() => { setFilter('USED'); setPage(1); }}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              filter === 'USED' 
                ? 'bg-blue-100 text-blue-700' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            사용
          </button>
        </div>
      </div>

      {error ? (
        <div className="p-6 text-center text-red-600">{error}</div>
      ) : transactions.length === 0 ? (
        <div className="p-12 text-center">
          <Coins className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">포인트 내역이 없습니다.</p>
        </div>
      ) : (
        <>
          <div className="divide-y">
            {transactions.map((transaction) => (
              <div key={transaction.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    {getIcon(transaction.type)}
                    <div>
                      <p className="font-medium text-gray-900">
                        {transaction.reason}
                      </p>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-xs text-gray-500">
                          {formatDate(transaction.createdAt)}
                        </span>
                        {transaction.expiresAt && (
                          <>
                            <span className="text-xs text-gray-400">•</span>
                            <span className="text-xs text-orange-600">
                              {formatDate(transaction.expiresAt)} 만료
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <p className={`font-semibold ${
                      transaction.amount > 0 
                        ? 'text-green-600' 
                        : 'text-blue-600'
                    }`}>
                      {transaction.amount > 0 ? '+' : ''}{formatNumber(transaction.amount)}P
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      잔액 {formatNumber(transaction.balance)}P
                    </p>
                  </div>
                </div>
                
                <div className="mt-2 flex items-center space-x-2">
                  <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                    transaction.type === 'EARNED' ? 'bg-green-100 text-green-800' :
                    transaction.type === 'USED' ? 'bg-blue-100 text-blue-800' :
                    transaction.type === 'EXPIRED' ? 'bg-gray-100 text-gray-800' :
                    transaction.type === 'CANCELLED' ? 'bg-orange-100 text-orange-800' :
                    'bg-purple-100 text-purple-800'
                  }`}>
                    {getTypeLabel(transaction.type)}
                  </span>
                  
                  {transaction.relatedType && (
                    <span className="text-xs text-gray-500">
                      {transaction.relatedType === 'ORDER' && '주문'}
                      {transaction.relatedType === 'REVIEW' && '리뷰'}
                      {transaction.relatedType === 'EVENT' && '이벤트'}
                      {transaction.relatedType === 'ADMIN' && '관리자'}
                      {transaction.relatedId && ` #${transaction.relatedId.slice(-6)}`}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {showPagination && totalPages > 1 && (
            <div className="p-4 border-t flex items-center justify-between">
              <p className="text-sm text-gray-600">
                총 {total}개 중 {(page - 1) * limit + 1}-{Math.min(page * limit, total)}
              </p>
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className={`p-1 rounded ${
                    page === 1 
                      ? 'text-gray-300 cursor-not-allowed' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                
                <span className="text-sm text-gray-600">
                  {page} / {totalPages}
                </span>
                
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className={`p-1 rounded ${
                    page === totalPages 
                      ? 'text-gray-300 cursor-not-allowed' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};