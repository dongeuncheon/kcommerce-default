import React, { useState, useEffect } from 'react';
import { authService } from '../../services/authService';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface LinkedAccount {
  provider: string;
  connectedAt: string;
  profile: any;
}

export function LinkedAccounts() {
  const [accounts, setAccounts] = useState<LinkedAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [unlinkingProvider, setUnlinkingProvider] = useState<string | null>(null);

  useEffect(() => {
    loadLinkedAccounts();
  }, []);

  const loadLinkedAccounts = async () => {
    try {
      const data = await authService.getLinkedAccounts();
      setAccounts(data);
    } catch (error) {
      console.error('Failed to load linked accounts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnlink = async (provider: string) => {
    if (!confirm(`정말 ${getProviderName(provider)} 계정 연결을 해제하시겠습니까?`)) {
      return;
    }

    setUnlinkingProvider(provider);
    try {
      await authService.unlinkOAuthAccount(provider);
      await loadLinkedAccounts();
    } catch (error: any) {
      alert(error.message || '계정 연결 해제에 실패했습니다.');
    } finally {
      setUnlinkingProvider(null);
    }
  };

  const handleLink = (provider: string) => {
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    window.location.href = `${baseUrl}/api/v1/auth/${provider}`;
  };

  const getProviderName = (provider: string) => {
    return provider === 'naver' ? '네이버' : '카카오';
  };

  const getProviderIcon = (provider: string) => {
    if (provider === 'naver') {
      return (
        <div className="w-10 h-10 bg-[#03C75A] rounded-lg flex items-center justify-center">
          <svg className="w-6 h-6" viewBox="0 0 20 20" fill="none">
            <path
              d="M13.5 10.5V15H10.5L6.5 10V5H9.5L13.5 10.5Z"
              fill="white"
            />
          </svg>
        </div>
      );
    } else {
      return (
        <div className="w-10 h-10 bg-[#FEE500] rounded-lg flex items-center justify-center">
          <svg className="w-6 h-6" viewBox="0 0 20 20" fill="none">
            <path
              d="M10 3C5.58172 3 2 5.91015 2 9.5C2 11.6869 3.15308 13.6063 4.9178 14.7556L4.19904 17.332C4.13257 17.5667 4.37758 17.7719 4.58845 17.6509L7.76418 15.8072C8.48058 15.9339 9.22917 16 10 16C14.4183 16 18 13.0899 18 9.5C18 5.91015 14.4183 3 10 3Z"
              fill="#000000"
              fillOpacity="0.85"
            />
          </svg>
        </div>
      );
    }
  };

  const allProviders = ['naver', 'kakao'];
  const linkedProviders = accounts.map(acc => acc.provider);
  const unlinkedProviders = allProviders.filter(p => !linkedProviders.includes(p));

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-20 bg-gray-200 rounded-lg mb-3"></div>
        <div className="h-20 bg-gray-200 rounded-lg"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold mb-4">연결된 SNS 계정</h3>

      {/* 연결된 계정 */}
      {accounts.length > 0 && (
        <div className="space-y-3">
          {accounts.map((account) => (
            <div
              key={account.provider}
              className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center gap-3">
                {getProviderIcon(account.provider)}
                <div>
                  <p className="font-medium">{getProviderName(account.provider)}</p>
                  <p className="text-sm text-gray-600">
                    {format(new Date(account.connectedAt), 'yyyy년 MM월 dd일', { locale: ko })} 연결됨
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleUnlink(account.provider)}
                disabled={unlinkingProvider === account.provider}
                className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
              >
                {unlinkingProvider === account.provider ? '해제 중...' : '연결 해제'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 연결 가능한 계정 */}
      {unlinkedProviders.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-gray-600 mt-6">연결 가능한 계정</p>
          {unlinkedProviders.map((provider) => (
            <div
              key={provider}
              className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
            >
              <div className="flex items-center gap-3">
                {getProviderIcon(provider)}
                <div>
                  <p className="font-medium">{getProviderName(provider)}</p>
                  <p className="text-sm text-gray-500">계정을 연결하면 간편하게 로그인할 수 있습니다</p>
                </div>
              </div>
              <button
                onClick={() => handleLink(provider)}
                className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
              >
                연결하기
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-500 mt-4">
        SNS 계정을 연결하면 비밀번호 없이 간편하게 로그인할 수 있습니다.
        연결을 해제해도 회원 정보는 유지됩니다.
      </p>
    </div>
  );
}