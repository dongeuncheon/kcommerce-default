import React from 'react';
import { TrackingForm } from '../components/tracking/TrackingForm';
import { TrackingResult } from '../components/tracking/TrackingResult';
import { useTracking } from '../hooks/useTracking';

export function TrackingPage() {
  const { trackingInfo, trackingEvents, clearTracking } = useTracking();

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <h1 className="text-3xl font-bold text-center mb-8">배송 조회</h1>
        
        {!trackingInfo ? (
          <TrackingForm />
        ) : (
          <TrackingResult
            trackingInfo={trackingInfo}
            trackingEvents={trackingEvents}
            onClose={clearTracking}
          />
        )}
      </div>
    </div>
  );
}