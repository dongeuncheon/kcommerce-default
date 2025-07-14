import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { InquiryDetail } from '../components/inquiry/InquiryDetail';
import { inquiryService } from '../services/inquiryService';
import { InquiryStatus } from '../types/inquiry';

export function InquiryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [inquiry, setInquiry] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);

  useEffect(() => {
    if (id) {
      loadInquiry();
    }
  }, [id]);

  const loadInquiry = async (pwd?: string) => {
    setIsLoading(true);
    setError('');
    
    try {
      const data = await inquiryService.getInquiry(id!, pwd);
      setInquiry(data);
      setShowPasswordPrompt(false);
    } catch (err: any) {
      if (err.response?.status === 403 && !pwd) {
        // 비회원 문의인 경우 비밀번호 입력 필요
        setShowPasswordPrompt(true);
        setIsLoading(false);
        return;
      }
      setError(err.response?.data?.error || '문의를 불러올 수 없습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password) {
      loadInquiry(password);
    }
  };

  const handleReply = async (content: string) => {
    try {
      const reply = await inquiryService.createReply(id!, { content });
      // 문의 다시 로드
      await loadInquiry();
    } catch (err) {
      console.error('Failed to create reply:', err);
      throw err;
    }
  };

  const handleStatusChange = async (status: InquiryStatus) => {
    try {
      await inquiryService.updateInquiry(id!, { status });
      setInquiry({ ...inquiry, status });
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const handleSatisfactionRate = async (rating: number, note?: string) => {
    try {
      await inquiryService.rateSatisfaction(id!, rating, note);
      // 문의 다시 로드
      await loadInquiry();
    } catch (err) {
      console.error('Failed to rate satisfaction:', err);
      throw err;
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      </div>
    );
  }

  if (showPasswordPrompt) {
    return (
      <div className="max-w-md mx-auto p-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold mb-4">비회원 문의 확인</h2>
          <p className="text-gray-600 mb-4">
            문의 등록 시 입력한 비밀번호를 입력해주세요.
          </p>
          <form onSubmit={handlePasswordSubmit}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
              autoFocus
            />
            {error && (
              <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                {error}
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => navigate('/inquiries')}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
              >
                취소
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
              >
                확인
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
        <button
          onClick={() => navigate('/inquiries')}
          className="mt-4 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
        >
          목록으로 돌아가기
        </button>
      </div>
    );
  }

  if (!inquiry) {
    return null;
  }

  return (
    <InquiryDetail
      inquiry={inquiry}
      onReply={handleReply}
      onStatusChange={handleStatusChange}
      onSatisfactionRate={handleSatisfactionRate}
    />
  );
}