/**
 * Authentication Configuration
 * Default configuration values for the auth module
 */

export interface AuthConfig {
  jwt: {
    secret: string;
    accessTokenExpiry: string;
    refreshTokenExpiry: string;
    issuer: string;
    audience: string;
  };
  bcrypt: {
    rounds: number;
  };
  session: {
    maxConcurrentSessions: number;
    sessionTimeout: number; // milliseconds
    refreshThreshold: number; // milliseconds before expiry to allow refresh
  };
  security: {
    maxLoginAttempts: number;
    lockoutDuration: number; // milliseconds
    passwordResetExpiry: number; // milliseconds
    verificationCodeExpiry: number; // milliseconds
    verificationCodeLength: number;
    twoFactorWindow: number; // TOTP window
  };
  rateLimit: {
    login: {
      windowMs: number;
      maxAttempts: number;
      blockDuration: number;
    };
    register: {
      windowMs: number;
      maxAttempts: number;
      blockDuration: number;
    };
    passwordReset: {
      windowMs: number;
      maxAttempts: number;
      blockDuration: number;
    };
    verification: {
      windowMs: number;
      maxAttempts: number;
      blockDuration: number;
    };
  };
  passwordPolicy: {
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
    preventCommonPasswords: boolean;
    preventUserInfo: boolean;
    commonPasswords: string[];
  };
  socialLogin: {
    kakao: {
      clientId: string;
      clientSecret: string;
      redirectUri: string;
      scope: string[];
    };
    naver: {
      clientId: string;
      clientSecret: string;
      redirectUri: string;
      scope: string[];
    };
    google: {
      clientId: string;
      clientSecret: string;
      redirectUri: string;
      scope: string[];
    };
  };
  sms: {
    provider: 'aligo' | 'popbill' | 'twilio';
    aligo?: {
      apiKey: string;
      userId: string;
      sender: string;
    };
    popbill?: {
      linkId: string;
      secretKey: string;
      sender: string;
    };
    twilio?: {
      accountSid: string;
      authToken: string;
      from: string;
    };
  };
  email: {
    provider: 'sendgrid' | 'ses' | 'smtp';
    from: string;
    fromName: string;
    sendgrid?: {
      apiKey: string;
    };
    ses?: {
      region: string;
      accessKeyId: string;
      secretAccessKey: string;
    };
    smtp?: {
      host: string;
      port: number;
      secure: boolean;
      auth: {
        user: string;
        pass: string;
      };
    };
  };
}

export const defaultAuthConfig: AuthConfig = {
  jwt: {
    secret: process.env.JWT_SECRET || 'change-this-secret-in-production',
    accessTokenExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshTokenExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
    issuer: process.env.JWT_ISSUER || 'commerce-core',
    audience: process.env.JWT_AUDIENCE || 'commerce-app'
  },
  bcrypt: {
    rounds: parseInt(process.env.BCRYPT_ROUNDS || '10')
  },
  session: {
    maxConcurrentSessions: parseInt(process.env.MAX_SESSIONS || '5'),
    sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
    refreshThreshold: 5 * 60 * 1000 // 5 minutes
  },
  security: {
    maxLoginAttempts: 5,
    lockoutDuration: 30 * 60 * 1000, // 30 minutes
    passwordResetExpiry: 60 * 60 * 1000, // 1 hour
    verificationCodeExpiry: 5 * 60 * 1000, // 5 minutes
    verificationCodeLength: 6,
    twoFactorWindow: 2
  },
  rateLimit: {
    login: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxAttempts: 5,
      blockDuration: 30 * 60 * 1000 // 30 minutes
    },
    register: {
      windowMs: 60 * 60 * 1000, // 1 hour
      maxAttempts: 3,
      blockDuration: 24 * 60 * 60 * 1000 // 24 hours
    },
    passwordReset: {
      windowMs: 60 * 60 * 1000, // 1 hour
      maxAttempts: 3,
      blockDuration: 6 * 60 * 60 * 1000 // 6 hours
    },
    verification: {
      windowMs: 5 * 60 * 1000, // 5 minutes
      maxAttempts: 3,
      blockDuration: 15 * 60 * 1000 // 15 minutes
    }
  },
  passwordPolicy: {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    preventCommonPasswords: true,
    preventUserInfo: true,
    commonPasswords: [
      'password',
      '12345678',
      'qwerty123',
      'admin123',
      'password123',
      'korea123',
      'seoul123'
    ]
  },
  socialLogin: {
    kakao: {
      clientId: process.env.KAKAO_CLIENT_ID || '',
      clientSecret: process.env.KAKAO_CLIENT_SECRET || '',
      redirectUri: process.env.KAKAO_REDIRECT_URI || 'http://localhost:3000/auth/kakao/callback',
      scope: ['profile', 'account_email']
    },
    naver: {
      clientId: process.env.NAVER_CLIENT_ID || '',
      clientSecret: process.env.NAVER_CLIENT_SECRET || '',
      redirectUri: process.env.NAVER_REDIRECT_URI || 'http://localhost:3000/auth/naver/callback',
      scope: ['profile', 'email']
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback',
      scope: ['profile', 'email']
    }
  },
  sms: {
    provider: (process.env.SMS_PROVIDER as any) || 'aligo',
    aligo: {
      apiKey: process.env.ALIGO_API_KEY || '',
      userId: process.env.ALIGO_USER_ID || '',
      sender: process.env.ALIGO_SENDER || ''
    },
    popbill: {
      linkId: process.env.POPBILL_LINK_ID || '',
      secretKey: process.env.POPBILL_SECRET_KEY || '',
      sender: process.env.POPBILL_SENDER || ''
    },
    twilio: {
      accountSid: process.env.TWILIO_ACCOUNT_SID || '',
      authToken: process.env.TWILIO_AUTH_TOKEN || '',
      from: process.env.TWILIO_FROM || ''
    }
  },
  email: {
    provider: (process.env.EMAIL_PROVIDER as any) || 'smtp',
    from: process.env.EMAIL_FROM || 'noreply@commerce.com',
    fromName: process.env.EMAIL_FROM_NAME || 'Commerce Platform',
    sendgrid: {
      apiKey: process.env.SENDGRID_API_KEY || ''
    },
    ses: {
      region: process.env.AWS_REGION || 'ap-northeast-2',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
    },
    smtp: {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || ''
      }
    }
  }
};

/**
 * Get auth configuration
 * Merges environment variables with defaults
 */
export function getAuthConfig(): AuthConfig {
  try {
    // Try to load from config file
    const config = require('config');
    return config.get('auth') || defaultAuthConfig;
  } catch {
    // Fallback to default config
    return defaultAuthConfig;
  }
}