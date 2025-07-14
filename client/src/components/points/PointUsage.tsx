import React, { useState, useEffect } from 'react';
import { Coins, Info, AlertCircle } from 'lucide-react';
import { pointService } from '../../services/pointService';
import { formatNumber } from '../../utils/format';

interface PointUsageProps {
  orderAmount: number;
  onPointsChange: (points: number) => void;
  maxUsablePoints?: number;
}

export const PointUsage: React.FC<PointUsageProps> = ({
  orderAmount,
  onPointsChange,
  maxUsablePoints
}) => {
  const [availablePoints, setAvailablePoints] = useState(0);
  const [usePoints, setUsePoints] = useState(0);
  const [maxPoints, setMaxPoints] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchPointInfo();
  }, [orderAmount]);

  const fetchPointInfo = async () => {
    try {
      setIsLoading(true);
      const balance = await pointService.getBalance();
      const maxUsable = await pointService.calculateUsablePoints(orderAmount);
      
      setAvailablePoints(balance.availablePoints);
      setMaxPoints(Math.min(
        maxUsablePoints || maxUsable.maxUsablePoints,
        balance.availablePoints
      ));
    } catch (err) {
      setError('포인트 정보를 불러올 수 없습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePointsChange = (value: string) => {
    const points = parseInt(value) || 0;
    
    if (points > maxPoints) {
      setError(`최대 ${formatNumber(maxPoints)}P까지 사용 가능합니다.`);
      setUsePoints(maxPoints);
      onPointsChange(maxPoints);
    } else if (points > 0 && points < 1000) {
      setError('최소 1,000P부터 사용 가능합니다.');
      setUsePoints(points);
      onPointsChange(0);
    } else {
      setError(null);
      setUsePoints(points);
      onPointsChange(points);
    }
  };

  const handleUseAll = () => {
    setUsePoints(maxPoints);
    onPointsChange(maxPoints);
    setError(null);
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg p-4 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
        <div className="h-10 bg-gray-200 rounded"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <Coins className="w-5 h-5 text-yellow-500" />
          <h3 className="font-medium">포인트 사용</h3>
        </div>
        <div className="text-sm text-gray-600">
          보유: {formatNumber(availablePoints)}P
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex space-x-2">
          <div className="relative flex-1">
            <input
              type="number"
              value={usePoints || ''}
              onChange={(e) => handlePointsChange(e.target.value)}
              placeholder="0"
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                error ? 'border-red-300' : 'border-gray-300'
              }`}
              disabled={availablePoints === 0}
            />
            <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
              P
            </span>
          </div>
          <button
            onClick={handleUseAll}
            disabled={availablePoints === 0 || maxPoints === 0}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              availablePoints === 0 || maxPoints === 0
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            모두 사용
          </button>
        </div>

        {error && (
          <div className="flex items-start space-x-1 text-red-600">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {availablePoints > 0 && (
          <div className="bg-gray-50 rounded-lg p-3 space-y-2">
            <div className="flex items-start space-x-1 text-gray-600">
              <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p>• 최소 1,000P부터 사용 가능합니다.</p>
                <p>• 주문 금액의 50%까지 사용 가능합니다.</p>
                {maxPoints > 0 && (
                  <p className="font-medium text-blue-600">
                    • 이 주문에서 최대 {formatNumber(maxPoints)}P 사용 가능
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {usePoints > 0 && !error && (
          <div className="border-t pt-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">포인트 할인</span>
              <span className="font-medium text-red-600">
                -{formatNumber(usePoints)}원
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};