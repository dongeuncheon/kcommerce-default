export interface TrackingInfo {
  carrierId: string;
  carrierName: string;
  trackingNumber: string;
  senderName?: string;
  receiverName?: string;
  itemName?: string;
  invoiceTime?: Date;
  completeTime?: Date;
  level: TrackingLevel;
  status: string;
}

export interface TrackingEvent {
  time: Date;
  location: string;
  description: string;
  status: TrackingStatus;
  tel?: string;
  manName?: string;
  manPic?: string;
}

export enum TrackingLevel {
  READY = 1,           // 배송준비중
  PICKUP = 2,          // 집화완료
  IN_TRANSIT = 3,      // 배송중
  DELIVERY_START = 4,  // 배송출발
  COMPLETE = 5,        // 배송완료
  NOT_FOUND = 6        // 운송장없음
}

export enum TrackingStatus {
  INFORMATION_RECEIVED = 'information_received',
  AT_PICKUP = 'at_pickup',
  IN_TRANSIT = 'in_transit',
  OUT_FOR_DELIVERY = 'out_for_delivery',
  DELIVERED = 'delivered',
  DELIVERY_FAILED = 'delivery_failed',
  EXCEPTION = 'exception'
}

export interface CarrierInfo {
  id: string;
  name: string;
  tel: string;
  homepage?: string;
  apiSupported: boolean;
}

export const KOREAN_CARRIERS: CarrierInfo[] = [
  { id: 'kr.cjlogistics', name: 'CJ대한통운', tel: '1588-1255', homepage: 'https://www.cjlogistics.com', apiSupported: true },
  { id: 'kr.logen', name: '로젠택배', tel: '1588-9988', homepage: 'https://www.ilogen.com', apiSupported: true },
  { id: 'kr.hanjin', name: '한진택배', tel: '1588-0011', homepage: 'https://www.hanjin.co.kr', apiSupported: true },
  { id: 'kr.epost', name: '우체국택배', tel: '1588-1300', homepage: 'https://www.epost.go.kr', apiSupported: true },
  { id: 'kr.lotte', name: '롯데택배', tel: '1588-2121', homepage: 'https://www.lotteglogis.com', apiSupported: true },
  { id: 'kr.cvsnet', name: 'CU편의점택배', tel: '1577-1287', homepage: 'https://www.cupost.co.kr', apiSupported: true },
  { id: 'kr.gspostbox', name: 'GS편의점택배', tel: '1577-1287', homepage: 'https://www.gspostbox.com', apiSupported: true },
  { id: 'kr.kdexp', name: '경동택배', tel: '1899-5368', homepage: 'https://kdexp.com', apiSupported: true },
  { id: 'kr.daesin', name: '대신택배', tel: '043-222-4582', homepage: 'https://www.ds3211.co.kr', apiSupported: false },
  { id: 'kr.ilyanglogis', name: '일양로지스', tel: '1588-0002', homepage: 'https://www.ilyanglogis.com', apiSupported: false }
];

export interface TrackingRequest {
  carrierId: string;
  trackingNumber: string;
}

export interface TrackingResponse {
  success: boolean;
  carrier: CarrierInfo;
  trackingInfo?: TrackingInfo;
  trackingEvents?: TrackingEvent[];
  error?: string;
}