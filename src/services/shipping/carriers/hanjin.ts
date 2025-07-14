// import axios from 'axios';
import { logger } from '../../../utils/logger';
import { TrackingInfo, TrackingEvent, TrackingLevel, TrackingStatus } from '../../../types/tracking';

export class HanjinAPI {
  // private apiUrl = 'https://www.hanjin.co.kr/kor/CMS/DeliveryMgr/WaybillResult.do';
  // private apiKey = process.env.HANJIN_API_KEY || '';

  async track(trackingNumber: string): Promise<{
    info: TrackingInfo;
    events: TrackingEvent[];
  }> {
    try {
      logger.info('Hanjin tracking', { trackingNumber });

      // 모의 응답 데이터
      const mockData = this.generateMockData(trackingNumber);
      
      return mockData;
    } catch (error) {
      logger.error('Hanjin tracking failed', error);
      throw new Error('한진택배 배송 조회 실패');
    }
  }

  private generateMockData(trackingNumber: string): {
    info: TrackingInfo;
    events: TrackingEvent[];
  } {
    const now = new Date();
    const pickupTime = new Date(now.getTime() - 2.5 * 24 * 60 * 60 * 1000);
    const transit1Time = new Date(now.getTime() - 1.5 * 24 * 60 * 60 * 1000);
    const transit2Time = new Date(now.getTime() - 20 * 60 * 60 * 1000);
    const deliveryStartTime = new Date(now.getTime() - 6 * 60 * 60 * 1000);

    return {
      info: {
        carrierId: 'kr.hanjin',
        carrierName: '한진택배',
        trackingNumber,
        senderName: '**쇼핑',
        receiverName: '박*영',
        itemName: '전자제품',
        invoiceTime: pickupTime,
        level: TrackingLevel.DELIVERY_START,
        status: '배송출발'
      },
      events: [
        {
          time: deliveryStartTime,
          location: '인천 계양구',
          description: '배송기사 인수',
          status: TrackingStatus.OUT_FOR_DELIVERY,
          manName: '이*철',
          manPic: '010-****-3456'
        },
        {
          time: transit2Time,
          location: '인천HUB',
          description: 'HUB 도착',
          status: TrackingStatus.IN_TRANSIT
        },
        {
          time: transit1Time,
          location: '대전HUB',
          description: '간선 하차',
          status: TrackingStatus.IN_TRANSIT
        },
        {
          time: pickupTime,
          location: '서울 강북구',
          description: '화물 접수',
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
        wblnumText2: trackingNumber,
        mCode: '5',
        schLang: 'KR'
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