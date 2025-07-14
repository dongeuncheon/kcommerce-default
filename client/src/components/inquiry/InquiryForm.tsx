import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { inquiryService } from '../../services/inquiryService';
import { InquiryType, InquiryCategory } from '../../types/inquiry';

export function InquiryForm() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    type: InquiryType.GENERAL,
    category: InquiryCategory.OTHER,
    title: '',
    content: '',
    isPrivate: true,
    // 비회원 필드
    guestName: '',
    guestEmail: '',
    guestPhone: '',
    guestPassword: '',
    guestPasswordConfirm: ''
  });

  const inquiryTypes = [
    { value: InquiryType.GENERAL, label: '일반 문의' },
    { value: InquiryType.ORDER, label: '주문/배송' },
    { value: InquiryType.PRODUCT, label: '상품' },
    { value: InquiryType.EXCHANGE_RETURN, label: '교환/반품' },
    { value: InquiryType.PAYMENT, label: '결제' },
    { value: InquiryType.MEMBERSHIP, label: '회원정보' },
    { value: InquiryType.OTHER, label: '기타' }
  ];

  const inquiryCategories = [
    { value: InquiryCategory.BEFORE_ORDER, label: '구매 전 문의' },
    { value: InquiryCategory.ORDER_PAYMENT, label: '주문/결제' },
    { value: InquiryCategory.DELIVERY, label: '배송' },
    { value: InquiryCategory.RETURN_EXCHANGE, label: '반품/교환' },
    { value: InquiryCategory.PRODUCT_INFO, label: '상품정보' },
    { value: InquiryCategory.SITE_USAGE, label: '사이트이용' },
    { value: InquiryCategory.MEMBERSHIP, label: '회원' },
    { value: InquiryCategory.EVENT, label: '이벤트' },
    { value: InquiryCategory.OTHER, label: '기타' }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // 비회원인 경우 추가 검증
    if (!user) {
      if (!formData.guestEmail || !formData.guestPassword) {
        setError('비회원 문의 시 이메일과 비밀번호는 필수입니다.');
        return;
      }
      if (formData.guestPassword !== formData.guestPasswordConfirm) {
        setError('비밀번호가 일치하지 않습니다.');
        return;
      }
    }

    setIsLoading(true);

    try {
      const inquiry = await inquiryService.createInquiry({
        type: formData.type,
        category: formData.category,
        title: formData.title,
        content: formData.content,
        isPrivate: formData.isPrivate,
        guestName: !user ? formData.guestName : undefined,
        guestEmail: !user ? formData.guestEmail : undefined,
        guestPhone: !user ? formData.guestPhone : undefined,
        guestPassword: !user ? formData.guestPassword : undefined
      });

      // 성공 시 상세 페이지로 이동
      navigate(`/inquiries/${inquiry.id}`);
    } catch (err: any) {
      setError(err.message || '문의 등록에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6">1:1 문의하기</h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 비회원 정보 입력 */}
        {!user && (
          <div className="bg-gray-50 p-4 rounded-lg space-y-4">
            <h3 className="font-semibold text-gray-700">비회원 정보</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  이름
                </label>
                <input
                  type="text"
                  value={formData.guestName}
                  onChange={(e) => setFormData({ ...formData, guestName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  이메일 <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={formData.guestEmail}
                  onChange={(e) => setFormData({ ...formData, guestEmail: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required={!user}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  전화번호
                </label>
                <input
                  type="tel"
                  value={formData.guestPhone}
                  onChange={(e) => setFormData({ ...formData, guestPhone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  비밀번호 <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={formData.guestPassword}
                  onChange={(e) => setFormData({ ...formData, guestPassword: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required={!user}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  비밀번호 확인 <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={formData.guestPasswordConfirm}
                  onChange={(e) => setFormData({ ...formData, guestPasswordConfirm: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required={!user}
                />
              </div>
            </div>
            <p className="text-sm text-gray-600">
              * 비회원 문의 시 이메일과 비밀번호로 문의 내역을 확인할 수 있습니다.
            </p>
          </div>
        )}

        {/* 문의 유형 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              문의 유형 <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as InquiryType })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              {inquiryTypes.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              문의 카테고리 <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value as InquiryCategory })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              {inquiryCategories.map(category => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 제목 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            제목 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
            maxLength={200}
          />
        </div>

        {/* 내용 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            문의 내용 <span className="text-red-500">*</span>
          </label>
          <textarea
            value={formData.content}
            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={8}
            required
            minLength={10}
            maxLength={5000}
          />
          <p className="text-sm text-gray-500 mt-1">
            {formData.content.length}/5000
          </p>
        </div>

        {/* 공개 여부 */}
        <div className="flex items-center">
          <input
            type="checkbox"
            id="isPrivate"
            checked={formData.isPrivate}
            onChange={(e) => setFormData({ ...formData, isPrivate: e.target.checked })}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="isPrivate" className="ml-2 text-sm text-gray-700">
            비공개 문의 (관리자와 작성자만 열람 가능)
          </label>
        </div>

        {error && (
          <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        {/* 버튼 */}
        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-400"
          >
            {isLoading ? '등록 중...' : '문의 등록'}
          </button>
        </div>
      </form>
    </div>
  );
}