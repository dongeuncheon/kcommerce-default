import React from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { InquiryStatus } from '../../types/inquiry';

interface Inquiry {
  id: string;
  type: string;
  category: string;
  title: string;
  status: InquiryStatus;
  priority: string;
  isPrivate: boolean;
  createdAt: string;
  _count?: {
    replies: number;
  };
}

interface InquiryListProps {
  inquiries: Inquiry[];
  showActions?: boolean;
}

export function InquiryList({ inquiries, showActions = false }: InquiryListProps) {
  const getStatusBadge = (status: InquiryStatus) => {
    const badges = {
      [InquiryStatus.PENDING]: { text: '대기중', className: 'bg-yellow-100 text-yellow-800' },
      [InquiryStatus.IN_PROGRESS]: { text: '처리중', className: 'bg-blue-100 text-blue-800' },
      [InquiryStatus.ANSWERED]: { text: '답변완료', className: 'bg-green-100 text-green-800' },
      [InquiryStatus.CLOSED]: { text: '종료', className: 'bg-gray-100 text-gray-800' },
      [InquiryStatus.HOLD]: { text: '보류', className: 'bg-orange-100 text-orange-800' }
    };
    
    const badge = badges[status];
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${badge.className}`}>
        {badge.text}
      </span>
    );
  };

  const getTypeBadge = (type: string) => {
    const typeLabels: Record<string, string> = {
      GENERAL: '일반',
      ORDER: '주문/배송',
      PRODUCT: '상품',
      EXCHANGE_RETURN: '교환/반품',
      PAYMENT: '결제',
      MEMBERSHIP: '회원정보',
      OTHER: '기타'
    };
    
    return typeLabels[type] || type;
  };

  if (inquiries.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">등록된 문의가 없습니다.</p>
        <Link
          to="/inquiries/new"
          className="mt-4 inline-block px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
        >
          문의하기
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-md">
      <ul className="divide-y divide-gray-200">
        {inquiries.map((inquiry) => (
          <li key={inquiry.id}>
            <Link
              to={`/inquiries/${inquiry.id}`}
              className="block hover:bg-gray-50 px-4 py-4 sm:px-6"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-600">
                      {getTypeBadge(inquiry.type)}
                    </span>
                    {inquiry.isPrivate && (
                      <span className="text-xs text-gray-500">
                        🔒 비공개
                      </span>
                    )}
                    {getStatusBadge(inquiry.status)}
                  </div>
                  <h3 className="text-base font-medium text-gray-900 truncate">
                    {inquiry.title}
                  </h3>
                  <div className="mt-1 flex items-center gap-4 text-sm text-gray-500">
                    <span>
                      {format(new Date(inquiry.createdAt), 'yyyy.MM.dd HH:mm', { locale: ko })}
                    </span>
                    {inquiry._count && inquiry._count.replies > 0 && (
                      <span>답변 {inquiry._count.replies}개</span>
                    )}
                  </div>
                </div>
                <div className="ml-4 flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}