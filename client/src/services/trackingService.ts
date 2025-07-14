import { api } from './api';

interface TrackingResponse {
  success: boolean;
  carrier?: any;
  trackingInfo?: any;
  trackingEvents?: any[];
  error?: string;
}

interface ValidateResponse {
  success: boolean;
  data: {
    valid: boolean;
  };
}

interface EstimateResponse {
  success: boolean;
  data: {
    estimatedDelivery: string;
  };
}

class TrackingService {
  async getCarriers(supportedOnly?: boolean) {
    const params = supportedOnly ? '?supported=true' : '';
    const response = await api.get(`/tracking/carriers${params}`);
    return response.data.data;
  }

  async trackShipment(carrierId: string, trackingNumber: string): Promise<TrackingResponse> {
    const response = await api.get('/tracking/track', {
      params: { carrierId, trackingNumber }
    });
    return response.data;
  }

  async validateTrackingNumber(carrierId: string, trackingNumber: string): Promise<{ valid: boolean }> {
    const response = await api.get<ValidateResponse>('/tracking/validate', {
      params: { carrierId, trackingNumber }
    });
    return response.data.data;
  }

  async calculateDeliveryTime(carrierId: string, from: string, to: string): Promise<{ estimatedDelivery: string }> {
    const response = await api.get<EstimateResponse>('/tracking/estimate', {
      params: { carrierId, from, to }
    });
    return response.data.data;
  }

  async updateShipmentStatus(shipmentId: string) {
    const response = await api.post('/tracking/update-status', { shipmentId });
    return response.data;
  }
}

export const trackingService = new TrackingService();