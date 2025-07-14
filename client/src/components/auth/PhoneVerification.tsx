import React, { useState, useEffect } from 'react';
import { Phone, Lock, CheckCircle, AlertCircle } from 'lucide-react';
import { verificationService } from '../../services/verificationService';
import toast from 'react-hot-toast';

interface PhoneVerificationProps {
  type: 'SIGNUP' | 'LOGIN' | 'FIND_PASSWORD' | 'PAYMENT' | 'CHANGE_INFO';
  onVerified?: (phone: string) => void;
  defaultPhone?: string;
}

export const PhoneVerification: React.FC<PhoneVerificationProps> = ({
  type,
  onVerified,
  defaultPhone = ''
}) => {
  const [phone, setPhone] = useState(defaultPhone);
  const [code, setCode] = useState('');
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 7) {
      return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    }
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhone(e.target.value);
    setPhone(formatted);
    setError('');
  };

  const sendVerificationCode = async () => {
    const phoneNumbers = phone.replace(/-/g, '');
    
    if (!phoneNumbers || phoneNumbers.length < 10) {
      setError('올바른 휴대폰 번호를 입력해주세요.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await verificationService.sendCode({
        phone: phoneNumbers,
        type
      });

      if (response.success) {
        setIsCodeSent(true);
        setCountdown(180); // 3분
        toast.success('인증번호가 발송되었습니다.');
      } else {
        setError(response.error || '인증번호 발송에 실패했습니다.');
      }
    } catch (error) {
      setError('인증번호 발송 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const verifyCode = async () => {
    if (!code || code.length !== 6) {
      setError('6자리 인증번호를 입력해주세요.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await verificationService.verifyCode({
        phone: phone.replace(/-/g, ''),
        code
      });

      if (response.verified) {
        setIsVerified(true);
        toast.success('휴대폰 인증이 완료되었습니다.');
        onVerified?.(phone.replace(/-/g, ''));
      } else {
        setError(response.message || '인증번호가 일치하지 않습니다.');
      }
    } catch (error) {
      setError('인증 확인 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const resendCode = () => {
    setCode('');
    setIsCodeSent(false);
    sendVerificationCode();
  };

  if (isVerified) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center space-x-2">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <div>
            <p className="font-medium text-green-900">휴대폰 인증 완료</p>
            <p className="text-sm text-green-700">{phone}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          휴대폰 번호
        </label>
        <div className="flex space-x-2">
          <div className="relative flex-1">
            <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="tel"
              value={phone}
              onChange={handlePhoneChange}
              placeholder="010-0000-0000"
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isCodeSent || isLoading}
              maxLength={13}
            />
          </div>
          <button
            onClick={sendVerificationCode}
            disabled={isCodeSent || isLoading || !phone}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              isCodeSent || isLoading || !phone
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isLoading ? '발송중...' : isCodeSent ? '발송됨' : '인증번호 받기'}
          </button>
        </div>
      </div>

      {isCodeSent && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            인증번호
          </label>
          <div className="flex space-x-2">
            <div className="relative flex-1">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={code}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '');
                  setCode(value.slice(0, 6));
                  setError('');
                }}
                placeholder="6자리 인증번호"
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isLoading}
                maxLength={6}
              />
              {countdown > 0 && (
                <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-gray-500">
                  {Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, '0')}
                </span>
              )}
            </div>
            <button
              onClick={verifyCode}
              disabled={isLoading || !code || countdown === 0}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                isLoading || !code || countdown === 0
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              {isLoading ? '확인중...' : '인증하기'}
            </button>
          </div>
          
          {countdown === 0 && (
            <button
              onClick={resendCode}
              className="mt-2 text-sm text-blue-600 hover:text-blue-700"
            >
              인증번호 재발송
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-start space-x-2 text-red-600">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p className="text-sm">{error}</p>
        </div>
      )}
    </div>
  );
};