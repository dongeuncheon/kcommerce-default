import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { InquiryList } from '../components/inquiry/InquiryList';
import { inquiryService } from '../services/inquiryService';
import { InquiryStatus, InquiryType } from '../types/inquiry';

export function InquiryListPage() {
  const [inquiries, setInquiries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: '',
    type: '',
    keyword: ''
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });

  useEffect(() => {
    loadInquiries();
  }, [filters, pagination.page]);

  const loadInquiries = async () => {
    setIsLoading(true);
    try {
      const params = {
        ...filters,
        page: pagination.page,
        limit: pagination.limit
      };
      
      // 빈 문자열 필터 제거
      Object.keys(params).forEach(key => {
        if (params[key] === '') delete params[key];
      });
      
      const result = await inquiryService.getInquiries(params);
      setInquiries(result.data);
      setPagination(result.pagination);
    } catch (error) {
      console.error('Failed to load inquiries:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPagination({ ...pagination, page: 1 });
    loadInquiries();
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">1:1 문의</h1>
        <p className="text-gray-600">궁금하신 사항을 문의해주세요.</p>
      </div>

      {/* 필터 */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <form onSubmit={handleSearch} className="flex flex-wrap gap-4">
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">전체 상태</option>
            <option value={InquiryStatus.PENDING}>대기중</option>
            <option value={InquiryStatus.IN_PROGRESS}>처리중</option>
            <option value={InquiryStatus.ANSWERED}>답변완료</option>
            <option value={InquiryStatus.CLOSED}>종료</option>
          </select>

          <select
            value={filters.type}
            onChange={(e) => setFilters({ ...filters, type: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">전체 유형</option>
            <option value={InquiryType.GENERAL}>일반 문의</option>
            <option value={InquiryType.ORDER}>주문/배송</option>
            <option value={InquiryType.PRODUCT}>상품</option>
            <option value={InquiryType.EXCHANGE_RETURN}>교환/반품</option>
            <option value={InquiryType.PAYMENT}>결제</option>
            <option value={InquiryType.MEMBERSHIP}>회원정보</option>
            <option value={InquiryType.OTHER}>기타</option>
          </select>

          <div className="flex-1 flex gap-2">
            <input
              type="text"
              value={filters.keyword}
              onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
              placeholder="제목 또는 내용 검색"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
            >
              검색
            </button>
          </div>

          <Link
            to="/inquiries/new"
            className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
          >
            문의하기
          </Link>
        </form>
      </div>

      {/* 문의 목록 */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      ) : (
        <>
          <InquiryList inquiries={inquiries} />

          {/* 페이지네이션 */}
          {pagination.totalPages > 1 && (
            <div className="mt-6 flex justify-center">
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                <button
                  onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                  disabled={pagination.page === 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:bg-gray-100"
                >
                  이전
                </button>
                
                {[...Array(pagination.totalPages)].map((_, i) => (
                  <button
                    key={i + 1}
                    onClick={() => setPagination({ ...pagination, page: i + 1 })}
                    className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                      pagination.page === i + 1
                        ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                        : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
                
                <button
                  onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                  disabled={pagination.page === pagination.totalPages}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:bg-gray-100"
                >
                  다음
                </button>
              </nav>
            </div>
          )}
        </>
      )}
    </div>
  );
}