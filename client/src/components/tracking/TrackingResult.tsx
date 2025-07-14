import React from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

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

interface TrackingResultProps {
  trackingInfo: TrackingInfo;
  trackingEvents: TrackingEvent[];
  onClose: () => void;
}

export function TrackingResult({ trackingInfo, trackingEvents, onClose }: TrackingResultProps) {
  const getStatusColor = (level: number) => {
    switch (level) {
      case 1: return 'bg-gray-500';
      case 2: return 'bg-yellow-500';
      case 3: return 'bg-blue-500';
      case 4: return 'bg-indigo-500';
      case 5: return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'at_pickup':
        return '📦';
      case 'in_transit':
        return '🚚';
      case 'out_for_delivery':
        return '🏃';
      case 'delivered':
        return '✅';
      default:
        return '📍';
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-2xl font-bold mb-2">배송 조회 결과</h2>
          <p className="text-gray-600">{trackingInfo.carrierName} - {trackingInfo.trackingNumber}</p>
        </div>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700"
        >
          ✕
        </button>
      </div>

      {/* 배송 정보 요약 */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold mb-1">현재 상태</h3>
            <p className={`inline-block px-3 py-1 rounded-full text-white text-sm ${getStatusColor(trackingInfo.level)}`}>
              {trackingInfo.status}
            </p>
          </div>
          {trackingInfo.level === 5 && trackingInfo.completeTime && (
            <div className="text-right">
              <p className="text-sm text-gray-600">배송 완료일</p>
              <p className="font-semibold">
                {format(new Date(trackingInfo.completeTime), 'yyyy년 MM월 dd일', { locale: ko })}
              </p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          {trackingInfo.senderName && (
            <div>
              <p className="text-gray-600">보내는 분</p>
              <p className="font-medium">{trackingInfo.senderName}</p>
            </div>
          )}
          {trackingInfo.receiverName && (
            <div>
              <p className="text-gray-600">받는 분</p>
              <p className="font-medium">{trackingInfo.receiverName}</p>
            </div>
          )}
          {trackingInfo.itemName && (
            <div>
              <p className="text-gray-600">상품명</p>
              <p className="font-medium">{trackingInfo.itemName}</p>
            </div>
          )}
          {trackingInfo.invoiceTime && (
            <div>
              <p className="text-gray-600">접수일시</p>
              <p className="font-medium">
                {format(new Date(trackingInfo.invoiceTime), 'MM/dd HH:mm', { locale: ko })}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 배송 진행 상황 */}
      <div>
        <h3 className="text-lg font-semibold mb-4">배송 진행 상황</h3>
        <div className="space-y-4">
          {trackingEvents.map((event, index) => (
            <div key={index} className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 flex items-center justify-center text-xl">
                  {getStatusIcon(event.status)}
                </div>
              </div>
              <div className="flex-grow">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">{event.description}</p>
                    <p className="text-sm text-gray-600">{event.location}</p>
                    {event.manName && (
                      <p className="text-sm text-gray-500">
                        담당: {event.manName} {event.manPic && `(${event.manPic})`}
                      </p>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">
                    {format(new Date(event.time), 'MM/dd HH:mm', { locale: ko })}
                  </p>
                </div>
                {index < trackingEvents.length - 1 && (
                  <div className="ml-5 mt-2 mb-2 border-l-2 border-gray-300 h-8"></div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 택배사 연락처 */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg text-sm">
        <p className="font-medium text-blue-900">택배사 고객센터</p>
        <p className="text-blue-800">
          {trackingInfo.carrierName} 고객센터로 문의해주세요.
        </p>
      </div>
    </div>
  );
}