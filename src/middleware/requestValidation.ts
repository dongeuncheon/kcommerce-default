import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import DOMPurify from 'isomorphic-dompurify'
import validator from 'validator'
import { logger } from '../utils/logger'
import { createValidationError, createSystemError } from './error'
import { config } from '../config/config'

export interface ValidationOptions {
  stripUnknown?: boolean
  allowHtml?: boolean
  maxDepth?: number
  customValidators?: Record<string, (_value: any) => boolean>
}

export interface SanitizationOptions {
  trimStrings?: boolean
  normalizeWhitespace?: boolean
  removeNullBytes?: boolean
  htmlSanitize?: boolean
  sqlInjectinPrevention?: boolean
  xssProtection?: boolean
}

/**
 * Request validation and sanitization middleware
 */
export const requestValidation = (
  schema?: z.ZodSchema,
  validationOptions: ValidationOptions = {},
  sanitizationOptions: SanitizationOptions = {},
) => {
  const defaultValidationOptions: ValidationOptions = {
    stripUnknown: true,
    allowHtml: false,
    maxDepth: 10,
    ...validationOptions,
  }

  const defaultSanitizationOptions: SanitizationOptions = {
    trimStrings: true,
    normalizeWhitespace: true,
    removeNullBytes: true,
    htmlSanitize: true,
    sqlInjectinPrevention: true,
    xssProtection: true,
    ...sanitizationOptions,
  }

  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      // Sanitize request data
      req.body = await sanitizeData(req.body, defaultSanitizationOptions)
      req.query = await sanitizeData(req.query, defaultSanitizationOptions)
      req.params = await sanitizeData(req.params, defaultSanitizationOptions)

      // Validate against schema if provided
      if (schema) {
        try {
          req.body = schema.parse(req.body)
        } catch (error) {
          if (error instanceof z.ZodError) {
            const validationError = createValidationError(
              'Request validation failed',
              {
                errors: error.errors.map(e => ({
                  field: e.path.join('.'),
                  message: e.message,
                  code: e.code,
                  received: (e as any).received,
                })),
                schema: schema.description || 'Request schema',
              },
            )
            return next(validationError)
          }
          throw error
        }
      }

      // Additional custom validations
      const customValidationResult = await performCustomValidations(req, defaultValidationOptions)
      if (!customValidationResult.isValid) {
        const error = createValidationError(
          'Custom validation failed',
          customValidationResult.errors,
        )
        return next(error)
      }

      // Security validations
      const securityValidationResult = await performSecurityValidations(req)
      if (!securityValidationResult.isValid) {
        logger.warn('Security validation failed', {
          ip: req.ip,
          endpoint: req.originalUrl,
          violations: securityValidationResult.violations,
          userAgent: req.headers['user-agent'],
        })

        const error = createValidationError(
          'Security validation failed',
          { violations: securityValidationResult.violations },
        )
        return next(error)
      }

      next()
    } catch (error) {
      logger.error('Request validation middleware error', error)
      next(createSystemError('Request validation system error'))
    }
  }
}

/**
 * Sanitize data recursively
 */
async function sanitizeData(data: any, options: SanitizationOptions): Promise<any> {
  if (data === null || data === undefined) {
    return data
  }

  if (typeof data === 'string') {
    return sanitizeString(data, options)
  }

  if (Array.isArray(data)) {
    return Promise.all(data.map(item => sanitizeData(item, options)))
  }

  if (typeof data === 'object') {
    const sanitized: any = {}
    for (const [key, value] of Object.entries(data)) {
      const sanitizedKey = sanitizeString(key, options)
      sanitized[sanitizedKey] = await sanitizeData(value, options)
    }
    return sanitized
  }

  return data
}

/**
 * Sanitize string values
 */
function sanitizeString(str: string, options: SanitizationOptions): string {
  let sanitized = str

  // Remove null bytes
  if (options.removeNullBytes) {
    sanitized = sanitized.replace(/\0/g, '')
  }

  // Trim whitespace
  if (options.trimStrings) {
    sanitized = sanitized.trim()
  }

  // Normalize whitespace
  if (options.normalizeWhitespace) {
    sanitized = sanitized.replace(/\s+/g, ' ')
  }

  // HTML sanitization
  if (options.htmlSanitize) {
    sanitized = DOMPurify.sanitize(sanitized, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: [],
      KEEP_CONTENT: true,
    })
  }

  // XSS protection
  if (options.xssProtection) {
    sanitized = sanitized
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .replace(/data:text\/html/gi, '')
  }

  // SQL injection prevention
  if (options.sqlInjectinPrevention) {
    const sqlPatterns = [
      /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b)/gi,
      /(;|\||&|\$|\?|<|>|'|"|`)/g,
    ]

    for (const pattern of sqlPatterns) {
      if (pattern.test(sanitized)) {
        logger.warn('Potential SQL injection detected in string', {
          original: str,
          sanitized,
          pattern: pattern.source,
        })
        // Remove potentially dangerous characters
        sanitized = sanitized.replace(pattern, '')
      }
    }
  }

  return sanitized
}

/**
 * Perform custom validations
 */
async function performCustomValidations(
  req: Request,
  options: ValidationOptions,
): Promise<{ isValid: boolean; errors: any[] }> {
  const errors: any[] = []

  // Check object depth
  if (options.maxDepth) {
    const bodyDepth = getObjectDepth(req.body)
    if (bodyDepth > options.maxDepth) {
      errors.push({
        field: 'body',
        message: `Object depth exceeds maximum allowed depth of ${options.maxDepth}`,
        received: bodyDepth,
        code: 'MAX_DEPTH_EXCEEDED',
      })
    }
  }

  // Custom validators
  if (options.customValidators) {
    for (const [field, validator] of Object.entries(options.customValidators)) {
      const value = getNestedValue(req.body, field)
      if (value !== undefined && !validator(value)) {
        errors.push({
          field,
          message: `Custom validation failed for field ${field}`,
          received: value,
          code: 'CUSTOM_VALIDATION_FAILED',
        })
      }
    }
  }

  // Email validation for email fields
  const emailFields = findEmailFields(req.body)
  for (const field of emailFields) {
    const email = getNestedValue(req.body, field)
    if (email && !validator.isEmail(email)) {
      errors.push({
        field,
        message: 'Invalid email format',
        received: email,
        code: 'INVALID_EMAIL',
      })
    }
  }

  // URL validation for URL fields
  const urlFields = findUrlFields(req.body)
  for (const field of urlFields) {
    const url = getNestedValue(req.body, field)
    if (url && !validator.isURL(url)) {
      errors.push({
        field,
        message: 'Invalid URL format',
        received: url,
        code: 'INVALID_URL',
      })
    }
  }

  return { isValid: errors.length === 0, errors }
}

/**
 * Perform security validations
 */
async function performSecurityValidations(
  req: Request,
): Promise<{ isValid: boolean; violations: string[] }> {
  const violations: string[] = []

  // Check for suspicious patterns in request body
  const bodyString = JSON.stringify(req.body)

  const suspiciousPatterns = [
    { pattern: /<script/gi, name: 'script_tag' },
    { pattern: /javascript:/gi, name: 'javascript_protocol' },
    { pattern: /vbscript:/gi, name: 'vbscript_protocol' },
    { pattern: /on\w+\s*=/gi, name: 'event_handler' },
    { pattern: /data:text\/html/gi, name: 'data_html_url' },
    { pattern: /\.\.\//g, name: 'directory_traversal' },
    { pattern: /\bunion\b.*\bselect\b/gi, name: 'sql_union_injection' },
    { pattern: /\bdrop\b.*\btable\b/gi, name: 'sql_drop_injection' },
    { pattern: /'.*or.*1.*=.*1/gi, name: 'sql_or_injection' },
    { pattern: /\bexec\b|\bexecute\b/gi, name: 'sql_exec_injection' },
  ]

  for (const { pattern, name } of suspiciousPatterns) {
    if (pattern.test(bodyString)) {
      violations.push(name)
    }
  }

  // Check request size
  const bodySize = Buffer.byteLength(bodyString, 'utf8')
  const maxBodySize = 10 * 1024 * 1024 // 10MB

  if (bodySize > maxBodySize) {
    violations.push('oversized_request')
  }

  // Check for excessive array lengths
  const arrays = findArrays(req.body)
  for (const array of arrays) {
    if (array.length > 1000) {
      violations.push('excessive_array_length')
    }
  }

  // Check for deeply nested objects
  const maxDepth = 20
  if (getObjectDepth(req.body) > maxDepth) {
    violations.push('excessive_nesting')
  }

  return { isValid: violations.length === 0, violations }
}

/**
 * Get object depth
 */
function getObjectDepth(obj: any, depth = 0): number {
  if (obj === null || typeof obj !== 'object') {
    return depth
  }

  let maxDepth = depth
  for (const value of Object.values(obj)) {
    const currentDepth = getObjectDepth(value, depth + 1)
    maxDepth = Math.max(maxDepth, currentDepth)
  }

  return maxDepth
}

/**
 * Find email fields in object
 */
function findEmailFields(obj: any, prefix = ''): string[] {
  const emailFields: string[] = []

  if (typeof obj !== 'object' || obj === null) {
    return emailFields
  }

  for (const [key, value] of Object.entries(obj)) {
    const fieldPath = prefix ? `${prefix}.${key}` : key

    if (key.toLowerCase().includes('email')) {
      emailFields.push(fieldPath)
    }

    if (typeof value === 'object' && value !== null) {
      emailFields.push(...findEmailFields(value, fieldPath))
    }
  }

  return emailFields
}

/**
 * Find URL fields in object
 */
function findUrlFields(obj: any, prefix = ''): string[] {
  const urlFields: string[] = []

  if (typeof obj !== 'object' || obj === null) {
    return urlFields
  }

  for (const [key, value] of Object.entries(obj)) {
    const fieldPath = prefix ? `${prefix}.${key}` : key

    if (key.toLowerCase().includes('url') || key.toLowerCase().includes('link')) {
      urlFields.push(fieldPath)
    }

    if (typeof value === 'object' && value !== null) {
      urlFields.push(...findUrlFields(value, fieldPath))
    }
  }

  return urlFields
}

/**
 * Find arrays in object
 */
function findArrays(obj: any): any[][] {
  const arrays: any[][] = []

  if (Array.isArray(obj)) {
    arrays.push(obj)
  } else if (typeof obj === 'object' && obj !== null) {
    for (const value of Object.values(obj)) {
      arrays.push(...findArrays(value))
    }
  }

  return arrays
}

/**
 * Get nested value from object
 */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj)
}

/**
 * File upload validation middleware
 */
export const fileUploadValidation = (options: {
  maxFileSize?: number
  allowedMimeTypes?: string[]
  maxFiles?: number
} = {}) => {
  const {
    maxFileSize = config.upload.maxFileSize,
    allowedMimeTypes = config.upload.allowedTypes,
    maxFiles = 10,
  } = options

  return (req: Request, _res: Response, next: NextFunction) => {
    const files = req.files as any[] | undefined

    if (!files || files.length === 0) {
      return next()
    }

    const errors: any[] = []

    // Check number of files
    if (files.length > maxFiles) {
      errors.push({
        field: 'files',
        message: `Too many files. Maximum ${maxFiles} files allowed`,
        received: files.length,
        code: 'TOO_MANY_FILES',
      })
    }

    // Validate each file
    files.forEach((file, index) => {
      // Check file size
      if (file.size > maxFileSize) {
        errors.push({
          field: `files[${index}]`,
          message: `File too large. Maximum size is ${maxFileSize} bytes`,
          received: file.size,
          code: 'FILE_TOO_LARGE',
        })
      }

      // Check MIME type
      if (!allowedMimeTypes.includes(file.mimetype)) {
        errors.push({
          field: `files[${index}]`,
          message: `Invalid file type. Allowed types: ${allowedMimeTypes.join(', ')}`,
          received: file.mimetype,
          code: 'INVALID_FILE_TYPE',
        })
      }

      // Check file name for security
      if (file.originalname.includes('..') || file.originalname.includes('/')) {
        errors.push({
          field: `files[${index}]`,
          message: 'Invalid file name',
          received: file.originalname,
          code: 'INVALID_FILE_NAME',
        })
      }
    })

    if (errors.length > 0) {
      const error = createValidationError('File validation failed', { files: errors })
      return next(error)
    }

    next()
  }
}

/**
 * Content-Type validation middleware
 */
export const contentTypeValidation = (allowedTypes: string[] = ['application/json']) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const contentType = req.headers['content-type']

    if (req.method === 'GET' || req.method === 'DELETE') {
      return next()
    }

    if (!contentType) {
      const error = createValidationError('Content-Type header is required')
      return next(error)
    }

    const baseContentType = contentType.split(';')[0].trim()

    if (!allowedTypes.includes(baseContentType)) {
      const error = createValidationError(
        'Invalid Content-Type',
        {
          received: baseContentType,
          allowed: allowedTypes,
        },
      )
      return next(error)
    }

    next()
  }
}
