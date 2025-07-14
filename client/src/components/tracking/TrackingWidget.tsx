import React from 'react';
import { useTracking } from '../../hooks/useTracking';

interface TrackingWidgetProps {
  orderId: string;
  trackingNumber: string;
  carrierId: string;
  carrierName: string;
}

export function TrackingWidget({ orderId, trackingNumber, carrierId, carrierName }: TrackingWidgetProps) {
  const { trackShipment, isLoading } = useTracking();

  const handleTrack = async () => {
    if (trackingNumber && carrierId) {
      await trackShipment(carrierId, trackingNumber);
    }
  };

  return (
    <div className="p-4 border border-gray-200 rounded-lg">
      <h4 className="font-semibold mb-2">배송 정보</h4>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">택배사</span>
          <span className="font-medium">{carrierName}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">운송장 번호</span>
          <span className="font-medium">{trackingNumber}</span>
        </div>
        <button
          onClick={handleTrack}
          disabled={isLoading}
          className="w-full mt-3 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
        >
          {isLoading ? '조회 중...' : '배송 조회'}
        </button>
      </div>
    </div>
  );
}