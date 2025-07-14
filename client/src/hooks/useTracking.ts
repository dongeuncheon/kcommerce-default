import { useState, useEffect } from 'react';
import { trackingService } from '../services/trackingService';

interface TrackingInfo {
  carrierId: string;
  carrierName: string;
  trackingNumber: string;
  senderName?: string;
  receiverName?: string;
  itemName?: string;
  invoiceTime?: string;
  completeTime?: string;
  level: number;
  status: string;
}

interface TrackingEvent {
  time: string;
  location: string;
  description: string;
  status: string;
  manName?: string;
  manPic?: string;
}

interface Carrier {
  id: string;
  name: string;
  tel: string;
  homepage?: string;
  apiSupported: boolean;
}

export function useTracking() {
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [trackingInfo, setTrackingInfo] = useState<TrackingInfo | null>(null);
  const [trackingEvents, setTrackingEvents] = useState<TrackingEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 택배사 목록 로드
  useEffect(() => {
    loadCarriers();
  }, []);

  const loadCarriers = async () => {
    try {
      const data = await trackingService.getCarriers();
      setCarriers(data);
    } catch (err) {
      console.error('Failed to load carriers:', err);
    }
  };

  const trackShipment = async (carrierId: string, trackingNumber: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await trackingService.trackShipment(carrierId, trackingNumber);
      
      if (result.success) {
        setTrackingInfo(result.trackingInfo);
        setTrackingEvents(result.trackingEvents || []);
      } else {
        setError(result.error || '배송 조회에 실패했습니다.');
      }
    } catch (err: any) {
      setError(err.message || '배송 조회 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const validateTrackingNumber = async (carrierId: string, trackingNumber: string): Promise<boolean> => {
    try {
      const result = await trackingService.validateTrackingNumber(carrierId, trackingNumber);
      return result.valid;
    } catch (err) {
      return false;
    }
  };

  const calculateDeliveryTime = async (carrierId: string, from: string, to: string): Promise<Date | null> => {
    try {
      const result = await trackingService.calculateDeliveryTime(carrierId, from, to);
      return new Date(result.estimatedDelivery);
    } catch (err) {
      return null;
    }
  };

  const clearTracking = () => {
    setTrackingInfo(null);
    setTrackingEvents([]);
    setError(null);
  };

  return {
    carriers,
    trackingInfo,
    trackingEvents,
    isLoading,
    error,
    trackShipment,
    validateTrackingNumber,
    calculateDeliveryTime,
    clearTracking
  };
}