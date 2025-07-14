import React, { useEffect, useState } from 'react';
import { Coins, TrendingUp, Clock, AlertCircle } from 'lucide-react';
import { pointService } from '../../services/pointService';
import { formatNumber } from '../../utils/format';

interface PointBalanceProps {
  userId?: string;
  showDetails?: boolean;
  onPointsChange?: (balance: number) => void;
}

export const PointBalance: React.FC<PointBalanceProps> = ({
  userId,
  showDetails = true,
  onPointsChange
}) => {
  const [balance, setBalance] = useState({
    totalPoints: 0,
    availablePoints: 0,
    pendingPoints: 0,
    usedPoints: 0,
    expiredPoints: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchBalance();
  }, [userId]);

  const fetchBalance = async () => {
    try {
      setIsLoading(true);
      const data = await pointService.getBalance(userId);
      setBalance(data);
      onPointsChange?.(data.availablePoints);
    } catch (err) {
      setError('포인트 정보를 불러올 수 없습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg p-6 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="h-8 bg-gray-200 rounded w-1/2"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 rounded-lg p-4 flex items-center space-x-2">
        <AlertCircle className="w-5 h-5 text-red-600" />
        <span className="text-sm text-red-600">{error}</span>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">내 포인트</h3>
          <Coins className="w-6 h-6 text-yellow-500" />
        </div>

        <div className="mb-6">
          <p className="text-sm text-gray-600 mb-1">사용 가능 포인트</p>
          <p className="text-3xl font-bold text-gray-900">
            {formatNumber(balance.availablePoints)}
            <span className="text-base font-normal text-gray-600 ml-1">P</span>
          </p>
        </div>

        {showDetails && (
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center space-x-2 mb-1">
                <TrendingUp className="w-4 h-4 text-green-600" />
                <span className="text-xs text-gray-600">총 적립</span>
              </div>
              <p className="text-lg font-semibold text-gray-900">
                {formatNumber(balance.totalPoints)}P
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center space-x-2 mb-1">
                <Clock className="w-4 h-4 text-orange-600" />
                <span className="text-xs text-gray-600">대기중</span>
              </div>
              <p className="text-lg font-semibold text-gray-900">
                {formatNumber(balance.pendingPoints)}P
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center space-x-2 mb-1">
                <Coins className="w-4 h-4 text-blue-600" />
                <span className="text-xs text-gray-600">사용</span>
              </div>
              <p className="text-lg font-semibold text-gray-900">
                {formatNumber(balance.usedPoints)}P
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center space-x-2 mb-1">
                <AlertCircle className="w-4 h-4 text-gray-600" />
                <span className="text-xs text-gray-600">만료</span>
              </div>
              <p className="text-lg font-semibold text-gray-900">
                {formatNumber(balance.expiredPoints)}P
              </p>
            </div>
          </div>
        )}
      </div>

      {balance.availablePoints > 0 && (
        <div className="bg-yellow-50 px-6 py-3 border-t border-yellow-100">
          <p className="text-xs text-yellow-800">
            포인트는 적립일로부터 1년 후 자동 소멸됩니다.
          </p>
        </div>
      )}
    </div>
  );
};