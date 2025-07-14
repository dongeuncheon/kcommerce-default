/**
 * Korean-specific validation utilities for customer management
 */

/**
 * Validates Korean phone number formats
 * Supports mobile, landline, VoIP, and customer service numbers
 */
export function validateKoreanPhone(phone: string): { isValid: boolean; type?: string; formatted?: string } {
  const cleanPhone = phone.replace(/[\s-]/g, '');
  
  const patterns = [
    { pattern: /^01[016789]\d{7,8}$/, type: 'mobile', format: (p: string) => `${p.slice(0,3)}-${p.slice(3,7)}-${p.slice(7)}` },
    { pattern: /^02\d{7,8}$/, type: 'seoul_landline', format: (p: string) => `02-${p.slice(2,6)}-${p.slice(6)}` },
    { pattern: /^0[3-6]\d{8,9}$/, type: 'area_landline', format: (p: string) => `${p.slice(0,3)}-${p.slice(3,7)}-${p.slice(7)}` },
    { pattern: /^070\d{8}$/, type: 'voip', format: (p: string) => `070-${p.slice(3,7)}-${p.slice(7)}` },
    { pattern: /^1588\d{4}$/, type: 'customer_service', format: (p: string) => `1588-${p.slice(4)}` },
    { pattern: /^080\d{7}$/, type: 'toll_free', format: (p: string) => `080-${p.slice(3,6)}-${p.slice(6)}` }
  ];

  for (const { pattern, type, format } of patterns) {
    if (pattern.test(cleanPhone)) {
      return {
        isValid: true,
        type,
        formatted: format(cleanPhone)
      };
    }
  }

  return { isValid: false };
}

/**
 * Validates Korean postal code (5-digit format introduced in 2015)
 */
export function validateKoreanZipCode(zipCode: string): { isValid: boolean; formatted?: string } {
  const cleanZipCode = zipCode.replace(/\s/g, '');
  
  if (/^\d{5}$/.test(cleanZipCode)) {
    return {
      isValid: true,
      formatted: cleanZipCode
    };
  }

  return { isValid: false };
}

/**
 * Validates Korean name (Hangul characters)
 */
export function validateKoreanName(name: string): { isValid: boolean; normalized?: string } {
  // Korean Hangul Unicode range: AC00-D7AF
  const hangulPattern = /^[가-힣\s]{2,20}$/;
  
  if (hangulPattern.test(name.trim())) {
    return {
      isValid: true,
      normalized: name.trim().replace(/\s+/g, ' ')
    };
  }

  return { isValid: false };
}

/**
 * Validates Korean resident registration number (주민등록번호)
 * Note: This is for validation only - storing RRN should be avoided due to privacy laws
 */
export function validateKoreanRRN(rrn: string): { isValid: boolean; birthDate?: Date; gender?: 'male' | 'female' } {
  const cleanRRN = rrn.replace(/[-\s]/g, '');
  
  if (!/^\d{13}$/.test(cleanRRN)) {
    return { isValid: false };
  }

  const yearPrefix = cleanRRN.substring(0, 2);
  const month = parseInt(cleanRRN.substring(2, 4));
  const day = parseInt(cleanRRN.substring(4, 6));
  const genderCode = parseInt(cleanRRN.substring(6, 7));

  // Validate month and day
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return { isValid: false };
  }

  // Determine century and gender
  let year: number;
  let gender: 'male' | 'female';

  if (genderCode === 1 || genderCode === 2) {
    year = 1900 + parseInt(yearPrefix);
    gender = genderCode === 1 ? 'male' : 'female';
  } else if (genderCode === 3 || genderCode === 4) {
    year = 2000 + parseInt(yearPrefix);
    gender = genderCode === 3 ? 'male' : 'female';
  } else {
    return { isValid: false };
  }

  // Validate checksum
  const checksum = calculateRRNChecksum(cleanRRN.substring(0, 12));
  if (checksum !== parseInt(cleanRRN.substring(12, 13))) {
    return { isValid: false };
  }

  const birthDate = new Date(year, month - 1, day);
  
  return {
    isValid: true,
    birthDate,
    gender
  };
}

/**
 * Calculates RRN checksum
 */
function calculateRRNChecksum(rrn: string): number {
  const weights = [2, 3, 4, 5, 6, 7, 8, 9, 2, 3, 4, 5];
  let sum = 0;

  for (let i = 0; i < 12; i++) {
    sum += parseInt(rrn[i]) * weights[i];
  }

  return (11 - (sum % 11)) % 10;
}

/**
 * Validates Korean business registration number (사업자등록번호)
 */
export function validateKoreanBusinessNumber(businessNumber: string): { isValid: boolean; formatted?: string } {
  const clean = businessNumber.replace(/[-\s]/g, '');
  
  if (!/^\d{10}$/.test(clean)) {
    return { isValid: false };
  }

  // Validate checksum
  const weights = [1, 3, 7, 1, 3, 7, 1, 3, 5];
  let sum = 0;

  for (let i = 0; i < 9; i++) {
    sum += parseInt(clean[i]) * weights[i];
  }

  const checksum = (10 - (sum % 10)) % 10;
  
  if (checksum !== parseInt(clean[9])) {
    return { isValid: false };
  }

  return {
    isValid: true,
    formatted: `${clean.slice(0, 3)}-${clean.slice(3, 5)}-${clean.slice(5)}`
  };
}

/**
 * Formats Korean address for display
 */
export function formatKoreanAddress(address: {
  zipCode: string;
  address1: string;
  address2?: string;
  city: string;
  district: string;
  neighborhood?: string;
}): string {
  const parts = [
    `(${address.zipCode})`,
    address.city,
    address.district,
    address.neighborhood,
    address.address1,
    address.address2
  ].filter(Boolean);

  return parts.join(' ');
}

/**
 * Validates Korean email domains commonly used in Korea
 */
export function validateKoreanEmail(email: string): { isValid: boolean; provider?: string; isKoreanProvider?: boolean } {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailPattern.test(email)) {
    return { isValid: false };
  }

  const domain = email.split('@')[1].toLowerCase();
  
  const koreanProviders = [
    'naver.com', 'hanmail.net', 'daum.net', 'nate.com',
    'korea.com', 'kakao.com', 'knu.ac.kr', 'snu.ac.kr',
    'yonsei.ac.kr', 'sogang.ac.kr', 'inha.ac.kr',
    'samsung.com', 'lg.com', 'sk.com', 'kt.com'
  ];

  const isKoreanProvider = koreanProviders.includes(domain);
  
  return {
    isValid: true,
    provider: domain,
    isKoreanProvider
  };
}

/**
 * Checks if text contains Korean characters
 */
export function containsKorean(text: string): boolean {
  return /[가-힣]/.test(text);
}

/**
 * Validates Korean bank account number
 */
export function validateKoreanBankAccount(bankCode: string, accountNumber: string): { isValid: boolean; bank?: string } {
  const bankMap: { [key: string]: { name: string; accountPattern: RegExp } } = {
    '004': { name: 'KB국민은행', accountPattern: /^\d{6,14}$/ },
    '020': { name: '우리은행', accountPattern: /^\d{6,14}$/ },
    '088': { name: '신한은행', accountPattern: /^\d{6,14}$/ },
    '003': { name: '중소기업은행', accountPattern: /^\d{6,14}$/ },
    '011': { name: 'NH농협은행', accountPattern: /^\d{6,14}$/ },
    '032': { name: '부산은행', accountPattern: /^\d{6,14}$/ },
    '045': { name: '새마을금고', accountPattern: /^\d{6,14}$/ },
    '048': { name: '신협중앙회', accountPattern: /^\d{6,14}$/ },
    '090': { name: '카카오뱅크', accountPattern: /^\d{10,13}$/ },
    '089': { name: 'K뱅크', accountPattern: /^\d{10,13}$/ },
    '092': { name: '토스뱅크', accountPattern: /^\d{10,13}$/ }
  };

  const bank = bankMap[bankCode];
  if (!bank) {
    return { isValid: false };
  }

  const cleanAccountNumber = accountNumber.replace(/[-\s]/g, '');
  
  return {
    isValid: bank.accountPattern.test(cleanAccountNumber),
    bank: bank.name
  };
}

/**
 * Korean privacy law compliance checker
 */
export function checkPrivacyCompliance(consents: {
  personalInfoConsent: boolean;
  marketingConsent?: boolean;
  thirdPartyConsent?: boolean;
  minorConsent?: boolean;
  age?: number;
}): { isCompliant: boolean; missingConsents: string[]; warnings: string[] } {
  const missingConsents: string[] = [];
  const warnings: string[] = [];

  // Required: Personal information collection and use consent
  if (!consents.personalInfoConsent) {
    missingConsents.push('개인정보 수집·이용 동의');
  }

  // For minors (under 14), parental consent is required
  if (consents.age && consents.age < 14 && !consents.minorConsent) {
    missingConsents.push('법정대리인 동의');
  }

  // Marketing consent is optional but should be explicit
  if (consents.marketingConsent === undefined) {
    warnings.push('마케팅 활용 동의 여부가 명시되지 않음');
  }

  // Third party provision consent is optional but should be explicit if needed
  if (consents.thirdPartyConsent === undefined) {
    warnings.push('제3자 정보제공 동의 여부가 명시되지 않음');
  }

  return {
    isCompliant: missingConsents.length === 0,
    missingConsents,
    warnings
  };
}