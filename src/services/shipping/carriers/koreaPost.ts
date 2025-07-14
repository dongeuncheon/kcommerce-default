// import axios from 'axios';
import { logger } from '../../../utils/logger';
import { TrackingInfo, TrackingEvent, TrackingLevel, TrackingStatus } from '../../../types/tracking';

export class KoreaPostAPI {
  // private apiUrl = 'https://service.epost.go.kr/trace.RetrieveDomRigiTraceList.comm';
  // private apiKey = process.env.KOREA_POST_API_KEY || '';

  async track(trackingNumber: string): Promise<{
    info: TrackingInfo;
    events: TrackingEvent[];
  }> {
    try {
      logger.info('Korea Post tracking', { trackingNumber });

      // 모의 응답 데이터
      const mockData = this.generateMockData(trackingNumber);
      
      return mockData;
    } catch (error) {
      logger.error('Korea Post tracking failed', error);
      throw new Error('우체국택배 배송 조회 실패');
    }
  }

  private generateMockData(trackingNumber: string): {
    info: TrackingInfo;
    events: TrackingEvent[];
  } {
    const now = new Date();
    const pickupTime = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const transit1Time = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const transit2Time = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
    const deliveryTime = new Date(now.getTime() - 3 * 60 * 60 * 1000);

    return {
      info: {
        carrierId: 'kr.epost',
        carrierName: '우체국택배',
        trackingNumber,
        senderName: '**마켓',
        receiverName: '최*민',
        itemName: '도서/문구',
        invoiceTime: pickupTime,
        completeTime: deliveryTime,
        level: TrackingLevel.COMPLETE,
        status: '배송완료'
      },
      events: [
        {
          time: deliveryTime,
          location: '대구 중구 우체국',
          description: '배송완료',
          status: TrackingStatus.DELIVERED,
          manName: '정*호'
        },
        {
          time: transit2Time,
          location: '대구우편집중국',
          description: '도착',
          status: TrackingStatus.IN_TRANSIT
        },
        {
          time: transit1Time,
          location: '대전우편집중국',
          description: '발송',
          status: TrackingStatus.IN_TRANSIT
        },
        {
          time: pickupTime,
          location: '서울중앙우체국',
          description: '접수',
          status: TrackingStatus.AT_PICKUP
        }
      ]
    };
  }

  /**
   * 실제 API 구현 예시 (참고용)
   */
  /*
  private async realAPICall(trackingNumber: string): Promise<any> {
    const response = await axios.post(
      this.apiUrl,
      new URLSearchParams({
        _csrf: '', // CSRF 토큰 필요
        displayHeader: '',
        sid1: trackingNumber
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-API-Key': this.apiKey
        }
      }
    );

    return response.data;
  }
  */
}