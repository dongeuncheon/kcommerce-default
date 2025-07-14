import React, { useState } from 'react';
import { useTracking } from '../../hooks/useTracking';

interface Carrier {
  id: string;
  name: string;
  tel: string;
  apiSupported: boolean;
}

export function TrackingForm() {
  const { carriers, trackShipment, isLoading } = useTracking();
  const [carrierId, setCarrierId] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!carrierId || !trackingNumber) {
      setError('택배사와 운송장 번호를 입력해주세요.');
      return;
    }

    try {
      await trackShipment(carrierId, trackingNumber);
    } catch (err: any) {
      setError(err.message || '배송 조회에 실패했습니다.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6">배송 조회</h2>
      
      <div className="mb-4">
        <label htmlFor="carrier" className="block text-sm font-medium text-gray-700 mb-2">
          택배사 선택
        </label>
        <select
          id="carrier"
          value={carrierId}
          onChange={(e) => setCarrierId(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">택배사를 선택하세요</option>
          {carriers
            .filter((carrier: Carrier) => carrier.apiSupported)
            .map((carrier: Carrier) => (
              <option key={carrier.id} value={carrier.id}>
                {carrier.name}
              </option>
            ))}
        </select>
      </div>

      <div className="mb-6">
        <label htmlFor="trackingNumber" className="block text-sm font-medium text-gray-700 mb-2">
          운송장 번호
        </label>
        <input
          type="text"
          id="trackingNumber"
          value={trackingNumber}
          onChange={(e) => setTrackingNumber(e.target.value)}
          placeholder="운송장 번호를 입력하세요"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading}
        className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        {isLoading ? '조회 중...' : '조회하기'}
      </button>

      <div className="mt-4 text-sm text-gray-600">
        <p>• 운송장 번호는 숫자만 입력해주세요.</p>
        <p>• 택배사에 따라 조회 가능 기간이 다를 수 있습니다.</p>
      </div>
    </form>
  );
}