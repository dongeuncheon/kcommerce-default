import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';

export function OAuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuthStore();
  const [error, setError] = useState('');

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    const token = searchParams.get('token');
    const provider = searchParams.get('provider');
    const error = searchParams.get('error');
    const message = searchParams.get('message');

    if (error) {
      setError(message || 'SNS 로그인에 실패했습니다.');
      setTimeout(() => {
        navigate('/login');
      }, 3000);
      return;
    }

    if (!token || !provider) {
      setError('잘못된 인증 정보입니다.');
      setTimeout(() => {
        navigate('/login');
      }, 3000);
      return;
    }

    try {
      // 토큰을 저장하고 사용자 정보를 가져옴
      await login(token);
      
      // 성공 메시지와 함께 홈으로 이동
      const providerName = provider === 'naver' ? '네이버' : '카카오';
      console.log(`${providerName} 로그인 성공`);
      
      // 이전 페이지가 있으면 그곳으로, 없으면 홈으로
      const redirectTo = sessionStorage.getItem('redirectAfterLogin') || '/';
      sessionStorage.removeItem('redirectAfterLogin');
      navigate(redirectTo);
    } catch (err: any) {
      setError(err.message || 'SNS 로그인 처리 중 오류가 발생했습니다.');
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-md text-center">
        {error ? (
          <>
            <div className="text-red-500">
              <svg
                className="mx-auto h-12 w-12"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h2 className="mt-4 text-xl font-semibold text-gray-900">
              로그인 실패
            </h2>
            <p className="mt-2 text-gray-600">{error}</p>
            <p className="mt-4 text-sm text-gray-500">
              잠시 후 로그인 페이지로 이동합니다...
            </p>
          </>
        ) : (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
            <h2 className="mt-4 text-xl font-semibold text-gray-900">
              로그인 처리중
            </h2>
            <p className="mt-2 text-gray-600">
              SNS 로그인을 처리하고 있습니다...
            </p>
          </>
        )}
      </div>
    </div>
  );
}