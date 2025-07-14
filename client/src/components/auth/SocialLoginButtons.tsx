import React from 'react';

interface SocialLoginButtonsProps {
  onLogin?: (provider: 'naver' | 'kakao') => void;
}

export function SocialLoginButtons({ onLogin }: SocialLoginButtonsProps) {
  const handleSocialLogin = (provider: 'naver' | 'kakao') => {
    if (onLogin) {
      onLogin(provider);
    } else {
      // 직접 OAuth 엔드포인트로 리다이렉트
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      window.location.href = `${baseUrl}/api/v1/auth/${provider}`;
    }
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-white text-gray-500">간편 로그인</span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => handleSocialLogin('naver')}
        className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-[#03C75A] text-white rounded-md hover:bg-[#02B351] transition-colors"
      >
        <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none">
          <path
            d="M13.5 10.5V15H10.5L6.5 10V5H9.5L13.5 10.5Z"
            fill="white"
          />
        </svg>
        <span className="font-medium">네이버로 시작하기</span>
      </button>

      <button
        type="button"
        onClick={() => handleSocialLogin('kakao')}
        className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-[#FEE500] text-[#000000D9] rounded-md hover:bg-[#FDD800] transition-colors"
      >
        <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none">
          <path
            d="M10 3C5.58172 3 2 5.91015 2 9.5C2 11.6869 3.15308 13.6063 4.9178 14.7556L4.19904 17.332C4.13257 17.5667 4.37758 17.7719 4.58845 17.6509L7.76418 15.8072C8.48058 15.9339 9.22917 16 10 16C14.4183 16 18 13.0899 18 9.5C18 5.91015 14.4183 3 10 3Z"
            fill="#000000"
            fillOpacity="0.85"
          />
        </svg>
        <span className="font-medium">카카오로 시작하기</span>
      </button>

      <p className="text-xs text-gray-500 text-center mt-4">
        SNS 계정으로 간편하게 회원가입하고 로그인할 수 있습니다.
        <br />
        첫 로그인 시 자동으로 회원가입이 진행됩니다.
      </p>
    </div>
  );
}