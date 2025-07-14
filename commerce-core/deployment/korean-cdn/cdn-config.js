/**
 * ==================================================
 * Korean CDN Configuration for E-commerce Core
 * Optimized for Korean Market Performance
 * ==================================================
 */

// Korean CDN Providers Configuration
const koreanCDNConfig = {
  // Primary CDN: Naver Cloud Platform CDN
  primary: {
    provider: 'naver-cloud-platform',
    enabled: true,
    endpoints: {
      global: 'https://kr.object.ncloudstorage.com',
      korea: 'https://kr-cdn.ncloudstorage.com',
      seoul: 'https://seoul.cdn.ncloud.com'
    },
    configuration: {
      // Korean-optimized cache rules
      cacheRules: [
        {
          path: '/static/images/*',
          ttl: 86400 * 30, // 30 days for images
          compress: true,
          headers: {
            'Cache-Control': 'public, max-age=2592000, immutable',
            'Vary': 'Accept-Encoding'
          }
        },
        {
          path: '/static/css/*',
          ttl: 86400 * 7, // 7 days for CSS
          compress: true,
          headers: {
            'Cache-Control': 'public, max-age=604800',
            'Content-Type': 'text/css; charset=utf-8'
          }
        },
        {
          path: '/static/js/*',
          ttl: 86400 * 7, // 7 days for JavaScript
          compress: true,
          headers: {
            'Cache-Control': 'public, max-age=604800',
            'Content-Type': 'application/javascript; charset=utf-8'
          }
        },
        {
          path: '/api/*',
          ttl: 300, // 5 minutes for API responses
          compress: true,
          headers: {
            'Cache-Control': 'public, max-age=300',
            'Vary': 'Accept-Language, Accept-Encoding'
          }
        },
        {
          path: '/products/images/*',
          ttl: 86400 * 14, // 14 days for product images
          compress: true,
          headers: {
            'Cache-Control': 'public, max-age=1209600',
            'Vary': 'Accept-Encoding'
          }
        }
      ],
      
      // Korean business hours optimization
      businessHoursOptimization: {
        enabled: true,
        peakHours: [
          { start: '12:00', end: '13:00', timezone: 'Asia/Seoul' }, // Lunch hour
          { start: '20:00', end: '22:00', timezone: 'Asia/Seoul' }  // Evening shopping
        ],
        weekendTraffic: {
          saturday: { multiplier: 1.5 },
          sunday: { multiplier: 1.2 }
        }
      },
      
      // Geographic optimization for Korea
      geoOptimization: {
        korea: {
          regions: ['Seoul', 'Busan', 'Incheon', 'Daegu', 'Daejeon', 'Gwangju'],
          primaryPOP: 'Seoul',
          fallbackPOP: 'Busan'
        }
      }
    }
  },

  // Secondary CDN: KT Cloud CDN
  secondary: {
    provider: 'kt-cloud',
    enabled: true,
    endpoints: {
      korea: 'https://cdn.kt.com',
      seoul: 'https://seoul-cdn.kt.com'
    },
    configuration: {
      failover: {
        enabled: true,
        healthCheckInterval: 30000,
        failureThreshold: 3
      }
    }
  },

  // Tertiary CDN: CloudFlare (Global with Korean optimization)
  tertiary: {
    provider: 'cloudflare',
    enabled: true,
    endpoints: {
      global: 'https://cdn.yourdomain.com',
      korea: 'https://kr-cdn.yourdomain.com'
    },
    configuration: {
      koreanOptimization: {
        rocketLoader: true,
        mirage: true,
        polishLevel: 'lossless'
      }
    }
  }
};

// Korean Image Optimization Configuration
const koreanImageConfig = {
  formats: {
    // WebP support for modern Korean browsers
    webp: {
      enabled: true,
      quality: 85,
      supportCheck: true
    },
    
    // AVIF for latest browsers
    avif: {
      enabled: true,
      quality: 80,
      supportCheck: true
    },
    
    // Fallback to JPEG/PNG
    fallback: {
      jpeg: { quality: 90 },
      png: { compression: 6 }
    }
  },
  
  // Responsive images for Korean devices
  responsiveBreakpoints: [
    { width: 320, suffix: '_mobile' },   // Korean mobile
    { width: 768, suffix: '_tablet' },   // Korean tablet
    { width: 1024, suffix: '_desktop' }, // Korean desktop
    { width: 1920, suffix: '_hd' }       // Korean HD displays
  ],
  
  // Korean product image optimization
  productImages: {
    thumbnail: { width: 200, height: 200, crop: 'fill' },
    medium: { width: 400, height: 400, crop: 'fill' },
    large: { width: 800, height: 800, crop: 'fill' },
    zoom: { width: 1200, height: 1200, crop: 'fit' }
  }
};

// Korean Font and Asset Configuration
const koreanAssetConfig = {
  fonts: {
    // Korean web fonts
    korean: [
      {
        name: 'Noto Sans KR',
        url: 'https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap',
        preload: true,
        fallback: ['Malgun Gothic', 'Apple SD Gothic Neo', 'sans-serif']
      },
      {
        name: 'Nanum Gothic',
        url: 'https://fonts.googleapis.com/css2?family=Nanum+Gothic:wght@400;700;800&display=swap',
        preload: false,
        fallback: ['Dotum', 'sans-serif']
      }
    ],
    
    // Font loading strategy
    loadingStrategy: {
      critical: 'preload', // For above-the-fold content
      nonCritical: 'async', // For below-the-fold content
      timeout: 3000 // Font loading timeout
    }
  },
  
  // Korean-specific assets
  koreanAssets: {
    icons: {
      kakaoPay: '/static/icons/kakao-pay.svg',
      naverPay: '/static/icons/naver-pay.svg',
      tossPay: '/static/icons/toss-pay.svg',
      koreanFlag: '/static/icons/kr-flag.svg'
    },
    
    banners: {
      koreanHolidays: '/static/banners/korean-holidays/',
      seasonalPromotions: '/static/banners/seasonal-kr/'
    }
  }
};

// CDN Security Configuration for Korean Market
const koreanSecurityConfig = {
  // CORS for Korean domains
  cors: {
    allowedOrigins: [
      'https://yourdomain.com',
      'https://yourdomain.kr',
      'https://shop.yourdomain.kr',
      'https://m.yourdomain.kr'
    ],
    allowedMethods: ['GET', 'HEAD', 'OPTIONS'],
    allowedHeaders: ['Accept', 'Accept-Language', 'Accept-Encoding'],
    maxAge: 86400
  },
  
  // Anti-hotlinking for Korean content
  hotlinkProtection: {
    enabled: true,
    allowedReferers: [
      'yourdomain.com',
      'yourdomain.kr',
      '*.yourdomain.kr'
    ],
    blockDirectAccess: false
  },
  
  // Rate limiting for Korean traffic patterns
  rateLimiting: {
    rules: [
      {
        pattern: '/api/*',
        limit: 1000,
        window: 3600,
        action: 'throttle'
      },
      {
        pattern: '/products/images/*',
        limit: 5000,
        window: 3600,
        action: 'allow'
      }
    ]
  }
};

// Performance Monitoring for Korean Market
const koreanMonitoringConfig = {
  realUserMonitoring: {
    enabled: true,
    sampleRate: 0.1, // 10% sampling
    koreanMetrics: {
      businessHours: true,
      mobilePerformance: true,
      paymentFlowPerformance: true
    }
  },
  
  syntheticMonitoring: {
    enabled: true,
    locations: ['Seoul', 'Busan', 'Incheon'],
    intervals: {
      peak: 60, // 1 minute during peak hours
      normal: 300, // 5 minutes during normal hours
      offPeak: 900 // 15 minutes during off-peak hours
    }
  },
  
  alerts: {
    responseTime: {
      warning: 1000, // 1 second
      critical: 3000  // 3 seconds
    },
    availability: {
      warning: 99.5,  // 99.5%
      critical: 99.0  // 99.0%
    }
  }
};

// CDN Purge Strategy for Korean Content
const koreanPurgeConfig = {
  automatic: {
    // Auto-purge on content updates
    productUpdates: {
      enabled: true,
      delay: 60, // 1 minute delay
      patterns: [
        '/products/{productId}/*',
        '/api/products/{productId}',
        '/static/product-images/{productId}/*'
      ]
    },
    
    // Purge during Korean business hours maintenance
    scheduledPurge: {
      enabled: true,
      schedule: '0 3 * * *', // 3 AM KST daily
      patterns: [
        '/static/css/*',
        '/static/js/*',
        '/api/categories'
      ]
    }
  },
  
  manual: {
    // Emergency purge for Korean market
    emergency: {
      enabled: true,
      patterns: [
        '/*', // Full purge
        '/api/*', // API purge
        '/static/*' // Static assets purge
      ]
    }
  }
};

// Export configuration
module.exports = {
  cdnConfig: koreanCDNConfig,
  imageConfig: koreanImageConfig,
  assetConfig: koreanAssetConfig,
  securityConfig: koreanSecurityConfig,
  monitoringConfig: koreanMonitoringConfig,
  purgeConfig: koreanPurgeConfig,
  
  // Utility functions
  utils: {
    // Get optimal CDN endpoint based on user location
    getOptimalEndpoint: (userLocation = 'Korea') => {
      if (userLocation.includes('Korea') || userLocation.includes('Seoul')) {
        return koreanCDNConfig.primary.endpoints.korea;
      }
      return koreanCDNConfig.primary.endpoints.global;
    },
    
    // Check if current time is Korean business hours
    isKoreanBusinessHours: () => {
      const now = new Date();
      const seoulTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
      const hour = seoulTime.getHours();
      
      // Regular business hours: 9 AM - 6 PM
      const isBusinessHours = hour >= 9 && hour < 18;
      
      // Peak hours: 12-1 PM (lunch) and 8-10 PM (evening shopping)
      const isPeakHours = (hour >= 12 && hour < 13) || (hour >= 20 && hour < 22);
      
      return { isBusinessHours, isPeakHours };
    },
    
    // Generate responsive image URLs
    generateResponsiveImageUrls: (imagePath, baseUrl) => {
      const urls = {};
      koreanImageConfig.responsiveBreakpoints.forEach(breakpoint => {
        const fileName = imagePath.replace(/(\.[^.]+)$/, `${breakpoint.suffix}$1`);
        urls[breakpoint.width] = `${baseUrl}${fileName}`;
      });
      return urls;
    },
    
    // Get cache TTL based on content type and Korean business patterns
    getCacheTTL: (contentType, isBusinessHours = false) => {
      const multiplier = isBusinessHours ? 0.5 : 1; // Shorter cache during business hours
      
      const baseTTL = {
        'image': 86400 * 30, // 30 days
        'css': 86400 * 7,    // 7 days
        'js': 86400 * 7,     // 7 days
        'api': 300,          // 5 minutes
        'html': 60           // 1 minute
      };
      
      return Math.floor((baseTTL[contentType] || 300) * multiplier);
    }
  }
};