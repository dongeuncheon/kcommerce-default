import React, { useState } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { InquiryStatus } from '../../types/inquiry';
import { useAuthStore } from '../../stores/authStore';

interface InquiryDetailProps {
  inquiry: any;
  onReply?: (content: string) => Promise<void>;
  onStatusChange?: (status: InquiryStatus) => Promise<void>;
  onSatisfactionRate?: (rating: number, note?: string) => Promise<void>;
}

export function InquiryDetail({ inquiry, onReply, onStatusChange, onSatisfactionRate }: InquiryDetailProps) {
  const { user } = useAuthStore();
  const [replyContent, setReplyContent] = useState('');
  const [isReplying, setIsReplying] = useState(false);
  const [showSatisfaction, setShowSatisfaction] = useState(false);
  const [satisfaction, setSatisfaction] = useState({ rating: 0, note: '' });

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
  const isOwner = user?.id === inquiry.userId;
  const canReply = isAdmin && inquiry.status !== InquiryStatus.CLOSED;
  const canRate = (isOwner || (!inquiry.userId && inquiry.guestEmail)) && 
                  inquiry.status === InquiryStatus.ANSWERED && 
                  !inquiry.satisfaction;

  const handleReply = async () => {
    if (!replyContent.trim() || !onReply) return;

    setIsReplying(true);
    try {
      await onReply(replyContent);
      setReplyContent('');
    } catch (error) {
      console.error('Failed to submit reply:', error);
    } finally {
      setIsReplying(false);
    }
  };

  const handleSatisfactionSubmit = async () => {
    if (satisfaction.rating === 0 || !onSatisfactionRate) return;

    try {
      await onSatisfactionRate(satisfaction.rating, satisfaction.note);
      setShowSatisfaction(false);
    } catch (error) {
      console.error('Failed to submit satisfaction:', error);
    }
  };

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
      <span className={`px-3 py-1 text-sm font-medium rounded-full ${badge.className}`}>
        {badge.text}
      </span>
    );
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* 헤더 */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              {getStatusBadge(inquiry.status)}
              <span className="text-sm text-gray-500">
                {inquiry.type} / {inquiry.category}
              </span>
              {inquiry.isPrivate && (
                <span className="text-sm text-gray-500">🔒 비공개</span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              {inquiry.title}
            </h1>
            <div className="mt-2 text-sm text-gray-600">
              <span>작성자: {inquiry.user?.firstName || inquiry.guestName || '익명'}</span>
              <span className="mx-2">•</span>
              <span>{format(new Date(inquiry.createdAt), 'yyyy년 MM월 dd일 HH:mm', { locale: ko })}</span>
              <span className="mx-2">•</span>
              <span>조회수: {inquiry.viewCount}</span>
            </div>
          </div>
          
          {/* 관리자 액션 */}
          {isAdmin && onStatusChange && (
            <select
              value={inquiry.status}
              onChange={(e) => onStatusChange(e.target.value as InquiryStatus)}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm"
            >
              <option value={InquiryStatus.PENDING}>대기중</option>
              <option value={InquiryStatus.IN_PROGRESS}>처리중</option>
              <option value={InquiryStatus.ANSWERED}>답변완료</option>
              <option value={InquiryStatus.CLOSED}>종료</option>
              <option value={InquiryStatus.HOLD}>보류</option>
            </select>
          )}
        </div>

        {/* 관련 정보 */}
        {(inquiry.order || inquiry.product) && (
          <div className="mt-4 p-3 bg-gray-50 rounded-md text-sm">
            {inquiry.order && (
              <div>
                <span className="font-medium">관련 주문:</span> #{inquiry.order.orderNumber}
              </div>
            )}
            {inquiry.product && (
              <div>
                <span className="font-medium">관련 상품:</span> {inquiry.product.name}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 문의 내용 */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="prose max-w-none">
          <pre className="whitespace-pre-wrap font-sans">{inquiry.content}</pre>
        </div>
      </div>

      {/* 답변 목록 */}
      {inquiry.replies && inquiry.replies.length > 0 && (
        <div className="space-y-4 mb-6">
          <h2 className="text-lg font-semibold">답변</h2>
          {inquiry.replies.map((reply: any) => (
            <div key={reply.id} className="bg-blue-50 rounded-lg p-6">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <span className="font-medium text-blue-900">
                    {reply.user.firstName} {reply.user.lastName}
                  </span>
                  <span className="mx-2 text-blue-600">•</span>
                  <span className="text-sm text-blue-600">
                    {format(new Date(reply.createdAt), 'yyyy.MM.dd HH:mm', { locale: ko })}
                  </span>
                </div>
                {reply.isInternal && (
                  <span className="text-xs bg-gray-600 text-white px-2 py-1 rounded">
                    내부 메모
                  </span>
                )}
              </div>
              <div className="text-gray-800">
                <pre className="whitespace-pre-wrap font-sans">{reply.content}</pre>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 답변 작성 폼 (관리자용) */}
      {canReply && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">답변 작성</h2>
          <textarea
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={6}
            placeholder="답변 내용을 입력하세요..."
          />
          <div className="mt-4 flex justify-end">
            <button
              onClick={handleReply}
              disabled={isReplying || !replyContent.trim()}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-400"
            >
              {isReplying ? '답변 등록 중...' : '답변 등록'}
            </button>
          </div>
        </div>
      )}

      {/* 만족도 평가 */}
      {canRate && !showSatisfaction && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <button
            onClick={() => setShowSatisfaction(true)}
            className="w-full py-3 bg-green-500 text-white rounded-md hover:bg-green-600"
          >
            답변 만족도 평가하기
          </button>
        </div>
      )}

      {showSatisfaction && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">답변 만족도 평가</h3>
          <div className="flex justify-center gap-2 mb-4">
            {[1, 2, 3, 4, 5].map((rating) => (
              <button
                key={rating}
                onClick={() => setSatisfaction({ ...satisfaction, rating })}
                className={`text-3xl ${
                  satisfaction.rating >= rating ? 'text-yellow-400' : 'text-gray-300'
                } hover:text-yellow-400 transition-colors`}
              >
                ★
              </button>
            ))}
          </div>
          <textarea
            value={satisfaction.note}
            onChange={(e) => setSatisfaction({ ...satisfaction, note: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
            rows={3}
            placeholder="추가 의견을 남겨주세요 (선택)"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowSatisfaction(false)}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
            >
              취소
            </button>
            <button
              onClick={handleSatisfactionSubmit}
              disabled={satisfaction.rating === 0}
              className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:bg-gray-400"
            >
              평가 완료
            </button>
          </div>
        </div>
      )}

      {/* 기존 만족도 표시 */}
      {inquiry.satisfaction && (
        <div className="bg-green-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-2">만족도 평가</h3>
          <div className="flex items-center gap-2">
            <div className="text-yellow-400">
              {'★'.repeat(inquiry.satisfaction)}{'☆'.repeat(5 - inquiry.satisfaction)}
            </div>
            <span className="text-sm text-gray-600">
              ({inquiry.satisfaction}/5)
            </span>
          </div>
          {inquiry.satisfactionNote && (
            <p className="mt-2 text-gray-700">{inquiry.satisfactionNote}</p>
          )}
        </div>
      )}
    </div>
  );
}