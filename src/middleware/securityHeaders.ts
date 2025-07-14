import { Request, Response, NextFunction } from 'express'
import helmet from 'helmet'
import { config } from '../config/config'
import { logger } from '../utils/logger'

/**
 * Security headers middleware with advanced configuration
 */
export const securityHeaders = () => {
  return helmet({
    // Content Security Policy
    contentSecurityPolicy: config.security.enableHelmet ? {
      useDefaults: false,
      directives: {
        defaultSrc: config.security.cspDirectives.defaultSrc,
        scriptSrc: [
          ...config.security.cspDirectives.scriptSrc,
          // Allow webpack dev server in development
          ...(config.nodeEnv === 'development' ? ['\'unsafe-eval\''] : []),
        ],
        styleSrc: config.security.cspDirectives.styleSrc,
        imgSrc: config.security.cspDirectives.imgSrc,
        connectSrc: ['\'self\'', 'https:'],
        fontSrc: ['\'self\'', 'https:', 'data:'],
        objectSrc: ['\'none\''],
        mediaSrc: ['\'self\''],
        frameSrc: ['\'none\''],
        childSrc: ['\'none\''],
        workerSrc: ['\'self\''],
        manifestSrc: ['\'self\''],
        baseUri: ['\'self\''],
        formAction: ['\'self\''],
        frameAncestors: ['\'none\''],
        upgradeInsecureRequests: config.nodeEnv === 'production' ? [] : null,
      },
      reportOnly: config.nodeEnv === 'development',
    } : false,

    // HTTP Strict Transport Security
    hsts: config.security.enableHsts ? {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    } : false,

    // X-Frame-Options
    frameguard: config.security.enableFrameGuard ? {
      action: 'deny',
    } : false,

    // X-Content-Type-Options
    noSniff: config.security.enableContentTypeNoSniff,

    // X-XSS-Protection
    xssFilter: config.security.enableXssProtection,

    // Referrer Policy
    referrerPolicy: {
      policy: ['strict-origin-when-cross-origin'],
    },

    // Cross-Origin policies
    crossOriginEmbedderPolicy: false, // Can cause issues with some integrations
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    crossOriginResourcePolicy: { policy: 'cross-origin' },

    // Remove X-Powered-By header
    hidePoweredBy: true,

    // Permissions Policy (formerly Feature Policy)
    permittedCrossDomainPolicies: false,
  })
}

/**
 * CSRF Protection middleware
 */
export const csrfProtection = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Skip CSRF for GET, HEAD, OPTIONS requests
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next()
    }

    // Skip CSRF for API requests with valid API key
    if ((req as any).apiClient) {
      return next()
    }

    // Skip CSRF for whitelisted origins
    const origin = req.headers.origin
    const allowedOrigins = config.cors.origin.split(',').map(o => o.trim())

    if (origin && allowedOrigins.includes(origin)) {
      return next()
    }

    // Check for CSRF token in header or body
    const csrfToken = req.headers['x-csrf-token'] ||
                     req.headers['x-xsrf-token'] ||
                     req.body?._csrf ||
                     req.query._csrf

    if (!csrfToken) {
      logger.warn('CSRF token missing', {
        ip: req.ip,
        endpoint: req.originalUrl,
        method: req.method,
        userAgent: req.headers['user-agent'],
      })

      return res.status(403).json({
        success: false,
        error: {
          type: 'CSRFError',
          message: 'CSRF token missing',
          code: 'CSRF_TOKEN_MISSING',
        },
      })
    }

    // In a real implementation, you would validate the CSRF token here
    // For now, we'll accept any non-empty token
    if (typeof csrfToken !== 'string' || csrfToken.length < 10) {
      logger.warn('Invalid CSRF token', {
        ip: req.ip,
        endpoint: req.originalUrl,
        method: req.method,
        tokenLength: csrfToken?.toString().length || 0,
      })

      return res.status(403).json({
        success: false,
        error: {
          type: 'CSRFError',
          message: 'Invalid CSRF token',
          code: 'CSRF_TOKEN_INVALID',
        },
      })
    }

    next()
  }
}

/**
 * Additional security headers
 */
export const additionalSecurityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Prevent MIME type confusion attacks
  res.setHeader('X-Content-Type-Options', 'nosniff')

  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY')

  // XSS protection (legacy but still useful)
  res.setHeader('X-XSS-Protection', '1; mode=block')

  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')

  // Permissions policy
  res.setHeader('Permissions-Policy', [
    'geolocation=()',
    'microphone=()',
    'camera=()',
    'magnetometer=()',
    'gyroscope=()',
    'fullscreen=(self)',
    'payment=(self)',
  ].join(', '))

  // Clear site data on logout (when applicable)
  if (req.path === '/api/auth/logout') {
    res.setHeader('Clear-Site-Data', '"cache", "cookies", "storage"')
  }

  // Cache control for sensitive pages
  if (req.path.includes('/admin') || req.path.includes('/profile')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    res.setHeader('Pragma', 'no-cache')
    res.setHeader('Expires', '0')
  }

  // HPKP (HTTP Public Key Pinning) - be very careful with this in production
  if (config.nodeEnv === 'production' && process.env.HPKP_ENABLED === 'true') {
    const hpkpHeader = [
      `pin-sha256="${process.env.HPKP_PIN1}"`,
      `pin-sha256="${process.env.HPKP_PIN2}"`,
      'max-age=5184000', // 60 days
      'includeSubDomains',
    ].join('; ')

    res.setHeader('Public-Key-Pins', hpkpHeader)
  }

  // Expect-CT header for Certificate Transparency
  if (config.nodeEnv === 'production') {
    res.setHeader('Expect-CT', 'max-age=86400, enforce')
  }

  next()
}

/**
 * CORS preflight handling with security considerations
 */
export const corsSecurityMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin
  const allowedOrigins = config.cors.origin.split(',').map(o => o.trim())

  // Log suspicious origin requests
  if (origin && !allowedOrigins.includes(origin)) {
    logger.warn('Request from unallowed origin', {
      origin,
      ip: req.ip,
      endpoint: req.originalUrl,
      userAgent: req.headers['user-agent'],
    })
  }

  // Set CORS headers for allowed origins
  if (!origin || allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || allowedOrigins[0])
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'X-CSRF-Token',
      'X-XSRF-Token',
      'X-API-Key',
    ].join(', '))
    res.setHeader('Access-Control-Max-Age', '86400') // 24 hours
  }

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  next()
}

/**
 * Request sanitization middleware
 */
export const requestSanitizer = (req: Request, res: Response, next: NextFunction): void => {
  try {
    // Sanitize query parameters
    if (req.query) {
      for (const [key, value] of Object.entries(req.query)) {
        if (typeof value === 'string') {
          // Basic XSS prevention
          req.query[key] = value
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+\s*=/gi, '')
        }
      }
    }

    // Sanitize body (for form data)
    if (req.body && typeof req.body === 'object') {
      sanitizeObject(req.body)
    }

    // Check for suspicious patterns in URL
    const suspiciousPatterns = [
      /\.\./g, // Directory traversal
      /<script/gi, // Script tags
      /javascript:/gi, // JavaScript protocol
      /vbscript:/gi, // VBScript protocol
      /data:text\/html/gi, // Data URL with HTML
      /%3Cscript/gi, // URL encoded script
      /\bunion\b.*\bselect\b/gi, // SQL injection
      /\bdrop\b.*\btable\b/gi, // SQL injection
    ]

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(req.originalUrl)) {
        logger.warn('Suspicious URL pattern detected', {
          url: req.originalUrl,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
          pattern: pattern.source,
        })

        res.status(400).json({
          success: false,
          error: {
            type: 'SecurityError',
            message: 'Suspicious request pattern detected',
            code: 'SUSPICIOUS_PATTERN',
          },
        })
        return
      }
    }

    next()
  } catch (error) {
    logger.error('Request sanitization failed', error)
    next()
  }
}

/**
 * Recursively sanitize object properties
 */
function sanitizeObject(obj: any): void {
  if (!obj || typeof obj !== 'object') return

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      obj[key] = value
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '')
        .trim()
    } else if (typeof value === 'object' && value !== null) {
      sanitizeObject(value)
    }
  }
}

/**
 * IP-based security middleware
 */
export const ipSecurityMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const clientIP = req.ip

  // Block known malicious IPs (this would typically come from a database or external service)
  const blockedIPs: string[] = [
    // Add known malicious IPs here
  ]

  if (blockedIPs.includes(clientIP || '')) {
    logger.warn('Blocked IP attempted access', {
      ip: clientIP,
      endpoint: req.originalUrl,
      userAgent: req.headers['user-agent'],
    })

    res.status(403).json({
      success: false,
      error: {
        type: 'SecurityError',
        message: 'Access denied',
        code: 'IP_BLOCKED',
      },
    })
    return
  }

  // Check for proxy headers that might indicate tunneling
  const suspiciousHeaders = [
    'x-forwarded-for',
    'x-real-ip',
    'x-cluster-client-ip',
    'cf-connecting-ip',
  ]

  let proxyCount = 0
  for (const header of suspiciousHeaders) {
    if (req.headers[header]) {
      proxyCount++
    }
  }

  // Log if too many proxy headers (might indicate tunneling)
  if (proxyCount > 2) {
    logger.warn('Multiple proxy headers detected', {
      ip: clientIP,
      headers: Object.fromEntries(
        suspiciousHeaders.map(h => [h, req.headers[h]]).filter(([, v]) => v),
      ),
      endpoint: req.originalUrl,
    })
  }

  next()
}

/**
 * Combined security middleware
 */
export const combinedSecurityMiddleware = [
  corsSecurityMiddleware,
  securityHeaders(),
  additionalSecurityHeaders,
  requestSanitizer,
  ipSecurityMiddleware,
  ...(config.security.enableCsrf ? [csrfProtection()] : []),
]
