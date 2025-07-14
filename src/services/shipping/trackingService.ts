import { PrismaClient } from '@prisma/client';
import { logger } from '../../utils/logger';
import {
  TrackingEvent,
  TrackingRequest,
  TrackingResponse,
  CarrierInfo,
  KOREAN_CARRIERS
} from '../../types/tracking';
import { CJLogisticsAPI } from './carriers/cjLogistics';
import { LogenAPI } from './carriers/logen';
import { HanjinAPI } from './carriers/hanjin';
import { KoreaPostAPI } from './carriers/koreaPost';

export class TrackingService {
  private prisma: PrismaClient;
  private carriers: Map<string, any>;

  constructor() {
    this.prisma = new PrismaClient();
    this.carriers = new Map();
    
    // Initialize carrier APIs
    this.carriers.set('kr.cjlogistics', new CJLogisticsAPI());
    this.carriers.set('kr.logen', new LogenAPI());
    this.carriers.set('kr.hanjin', new HanjinAPI());
    this.carriers.set('kr.epost', new KoreaPostAPI());
  }

  /**
   * 배송 조회
   */
  async trackShipment(request: TrackingRequest): Promise<TrackingResponse> {
    try {
      const carrier = this.getCarrierInfo(request.carrierId);
      
      if (!carrier) {
        return {
          success: false,
          carrier: {} as CarrierInfo,
          error: '지원하지 않는 택배사입니다.'
        };
      }

      if (!carrier.apiSupported) {
        return {
          success: false,
          carrier,
          error: '해당 택배사는 API 조회를 지원하지 않습니다.'
        };
      }

      const carrierAPI = this.carriers.get(request.carrierId);
      
      if (!carrierAPI) {
        return {
          success: false,
          carrier,
          error: '택배사 API가 구현되지 않았습니다.'
        };
      }

      // 택배사 API 호출
      const trackingData = await carrierAPI.track(request.trackingNumber);
      
      // DB에 조회 이력 저장
      await this.saveTrackingHistory(request, trackingData);
      
      return {
        success: true,
        carrier,
        trackingInfo: trackingData.info,
        trackingEvents: trackingData.events
      };
    } catch (error) {
      logger.error('Tracking failed', error);
      return {
        success: false,
        carrier: this.getCarrierInfo(request.carrierId) || {} as CarrierInfo,
        error: '배송 조회에 실패했습니다.'
      };
    }
  }

  /**
   * 택배사 정보 조회
   */
  getCarrierInfo(carrierId: string): CarrierInfo | undefined {
    return KOREAN_CARRIERS.find(c => c.id === carrierId);
  }

  /**
   * 모든 택배사 목록 조회
   */
  getAllCarriers(): CarrierInfo[] {
    return KOREAN_CARRIERS;
  }

  /**
   * 지원하는 택배사 목록 조회
   */
  getSupportedCarriers(): CarrierInfo[] {
    return KOREAN_CARRIERS.filter(c => c.apiSupported);
  }

  /**
   * 운송장 번호 유효성 검사
   */
  validateTrackingNumber(carrierId: string, trackingNumber: string): boolean {
    // 기본 검증: 숫자와 하이픈만 허용
    const basicPattern = /^[0-9\-]+$/;
    if (!basicPattern.test(trackingNumber)) {
      return false;
    }

    // 택배사별 특수 검증
    switch (carrierId) {
      case 'kr.cjlogistics':
        // CJ대한통운: 10자리 또는 12자리 숫자
        return /^\d{10}$|^\d{12}$/.test(trackingNumber.replace(/-/g, ''));
      
      case 'kr.logen':
        // 로젠택배: 11자리 숫자
        return /^\d{11}$/.test(trackingNumber.replace(/-/g, ''));
      
      case 'kr.hanjin':
        // 한진택배: 10자리 또는 12자리 숫자
        return /^\d{10}$|^\d{12}$/.test(trackingNumber.replace(/-/g, ''));
      
      case 'kr.epost':
        // 우체국택배: 13자리 숫자
        return /^\d{13}$/.test(trackingNumber.replace(/-/g, ''));
      
      default:
        // 기본: 10-20자리 숫자
        const numbers = trackingNumber.replace(/-/g, '');
        return numbers.length >= 10 && numbers.length <= 20;
    }
  }

  /**
   * 배송 상태 업데이트
   */
  async updateShipmentStatus(shipmentId: string): Promise<void> {
    try {
      const shipment = await this.prisma.shipment.findUnique({
        where: { id: shipmentId }
      });

      if (!shipment || !shipment.trackingNumber || !shipment.carrier) {
        return;
      }

      const trackingResult = await this.trackShipment({
        carrierId: shipment.carrier,
        trackingNumber: shipment.trackingNumber
      });

      if (trackingResult.success && trackingResult.trackingInfo) {
        // 배송 상태 업데이트
        const newStatus = this.mapTrackingLevelToStatus(trackingResult.trackingInfo.level);
        
        if (newStatus !== shipment.status) {
          await this.prisma.shipment.update({
            where: { id: shipmentId },
            data: {
              status: newStatus as any
            }
          });

          // 배송 이벤트 저장
          if (trackingResult.trackingEvents) {
            for (const event of trackingResult.trackingEvents) {
              await this.saveTrackingEvent(shipmentId, event);
            }
          }
        }
      }
    } catch (error) {
      logger.error('Failed to update shipment status', error);
    }
  }

  /**
   * 배송 이벤트 저장
   */
  private async saveTrackingEvent(shipmentId: string, event: TrackingEvent): Promise<void> {
    try {
      // 중복 체크
      const existing = await this.prisma.trackingEvent.findFirst({
        where: {
          shipmentId,
          timestamp: event.time,
          description: event.description
        }
      });

      if (!existing) {
        await this.prisma.trackingEvent.create({
          data: {
            shipmentId,
            status: event.status,
            location: event.location,
            description: event.description,
            timestamp: event.time,
            metadata: {
              tel: event.tel,
              manName: event.manName,
              manPic: event.manPic
            }
          }
        });
      }
    } catch (error) {
      logger.error('Failed to save tracking event', error);
    }
  }

  /**
   * 조회 이력 저장
   */
  private async saveTrackingHistory(request: TrackingRequest, result: any): Promise<void> {
    try {
      // TODO: 조회 이력 테이블 추가 시 구현
      logger.info('Tracking history', {
        carrierId: request.carrierId,
        trackingNumber: request.trackingNumber,
        success: result.info ? true : false
      });
    } catch (error) {
      logger.error('Failed to save tracking history', error);
    }
  }

  /**
   * 트래킹 레벨을 배송 상태로 매핑
   */
  private mapTrackingLevelToStatus(level: number): string {
    switch (level) {
      case 1: return 'READY';
      case 2: return 'PICKUP';
      case 3: return 'IN_TRANSIT';
      case 4: return 'OUT_FOR_DELIVERY';
      case 5: return 'DELIVERED';
      default: return 'PENDING';
    }
  }

  /**
   * 배송 예상 시간 계산
   */
  calculateEstimatedDelivery(_carrierId: string, fromLocation: string, toLocation: string): Date {
    // 기본값: 3일
    let days = 3;

    // 지역별 예상 시간 (간단한 예시)
    const isJeju = toLocation.includes('제주');
    const isIsland = toLocation.includes('울릉') || toLocation.includes('백령');
    
    if (isIsland) {
      days = 5;
    } else if (isJeju) {
      days = 4;
    } else {
      // 같은 지역은 1-2일, 다른 지역은 2-3일
      const fromRegion = fromLocation.split(' ')[0];
      const toRegion = toLocation.split(' ')[0];
      
      if (fromRegion === toRegion) {
        days = 1;
      } else {
        days = 2;
      }
    }

    const estimatedDate = new Date();
    estimatedDate.setDate(estimatedDate.getDate() + days);
    
    return estimatedDate;
  }
}