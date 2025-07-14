// import axios from 'axios';
import { logger } from '../../../utils/logger';
import { TrackingInfo, TrackingEvent, TrackingLevel, TrackingStatus } from '../../../types/tracking';

export class LogenAPI {
  // private apiUrl = 'https://www.ilogen.com/web/personal/trace';
  // private apiKey = process.env.LOGEN_API_KEY || '';

  async track(trackingNumber: string): Promise<{
    info: TrackingInfo;
    events: TrackingEvent[];
  }> {
    try {
      logger.info('Logen tracking', { trackingNumber });

      // 모의 응답 데이터
      const mockData = this.generateMockData(trackingNumber);
      
      return mockData;
    } catch (error) {
      logger.error('Logen tracking failed', error);
      throw new Error('로젠택배 배송 조회 실패');
    }
  }

  private generateMockData(trackingNumber: string): {
    info: TrackingInfo;
    events: TrackingEvent[];
  } {
    const now = new Date();
    const pickupTime = new Date(now.getTime() - 1.5 * 24 * 60 * 60 * 1000);
    const transitTime = new Date(now.getTime() - 8 * 60 * 60 * 1000);

    return {
      info: {
        carrierId: 'kr.logen',
        carrierName: '로젠택배',
        trackingNumber,
        senderName: '**몰',
        receiverName: '김*희',
        itemName: '생활용품',
        invoiceTime: pickupTime,
        level: TrackingLevel.IN_TRANSIT,
        status: '배송중'
      },
      events: [
        {
          time: transitTime,
          location: '동서울터미널',
          description: '터미널 도착',
          status: TrackingStatus.IN_TRANSIT
        },
        {
          time: pickupTime,
          location: '부산 해운대구',
          description: '택배 접수',
          status: TrackingStatus.AT_PICKUP
        }
      ]
    };
  }
}