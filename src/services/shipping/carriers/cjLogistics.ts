// import axios from 'axios';
import { logger } from '../../../utils/logger';
import { TrackingInfo, TrackingEvent, TrackingLevel, TrackingStatus } from '../../../types/tracking';

export class CJLogisticsAPI {
  // private apiUrl = 'https://www.cjlogistics.com/ko/tool/parcel/tracking';
  // private apiKey = process.env.CJ_LOGISTICS_API_KEY || '';

  async track(trackingNumber: string): Promise<{
    info: TrackingInfo;
    events: TrackingEvent[];
  }> {
    try {
      // CJ대한통운 API 호출 (실제 구현 시 공식 API 사용)
      // 현재는 모의 데이터 반환
      logger.info('CJ Logistics tracking', { trackingNumber });

      // 모의 응답 데이터
      const mockData = this.generateMockData(trackingNumber);
      
      return mockData;
    } catch (error) {
      logger.error('CJ Logistics tracking failed', error);
      throw new Error('CJ대한통운 배송 조회 실패');
    }
  }

  /**
   * 모의 데이터 생성 (실제 구현 시 삭제)
   */
  private generateMockData(trackingNumber: string): {
    info: TrackingInfo;
    events: TrackingEvent[];
  } {
    const now = new Date();
    const pickupTime = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000); // 2일 전
    const transit1Time = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000); // 1일 전
    const transit2Time = new Date(now.getTime() - 12 * 60 * 60 * 1000); // 12시간 전
    const deliveryTime = new Date(now.getTime() - 2 * 60 * 60 * 1000); // 2시간 전

    return {
      info: {
        carrierId: 'kr.cjlogistics',
        carrierName: 'CJ대한통운',
        trackingNumber,
        senderName: '**커머스',
        receiverName: '홍*동',
        itemName: '의류',
        invoiceTime: pickupTime,
        completeTime: deliveryTime,
        level: TrackingLevel.COMPLETE,
        status: '배송완료'
      },
      events: [
        {
          time: deliveryTime,
          location: '서울 강남구',
          description: '배송이 완료되었습니다.',
          status: TrackingStatus.DELIVERED,
          manName: '김*수',
          manPic: '010-****-5678'
        },
        {
          time: transit2Time,
          location: '서울 강남대리점',
          description: '배송 출발',
          status: TrackingStatus.OUT_FOR_DELIVERY,
          manName: '김*수',
          manPic: '010-****-5678'
        },
        {
          time: transit1Time,
          location: '옥천HUB',
          description: '간선 상차',
          status: TrackingStatus.IN_TRANSIT
        },
        {
          time: pickupTime,
          location: '대전 유성구',
          description: '집화 처리',
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
      {
        paramInvcNo: trackingNumber
      },
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