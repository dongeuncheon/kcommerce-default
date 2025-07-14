import compression from 'compression'
import { Request, Response } from 'express'
import { config } from '../config/config'

/**
 * Configure compression middleware with optimal settings
 */
export function configureCompression() {
  return compression({
    // Enable/disable compression based on config
    filter: (req: Request, res: Response) => {
      if (!config.performance.enableCompression) {
        return false
      }

      // Don't compress for requests with 'x-no-compression' header
      if (req.headers['x-no-compression']) {
        return false
      }

      // Use compression filter's default logic
      return compression.filter(req, res)
    },

    // Compression level (0-9, where 9 is maximum compression)
    level: config.performance.compressionLevel,

    // Threshold: minimum response size in bytes to compress
    threshold: 1024, // 1KB

    // Memory level (1-9, where 9 uses maximum memory for optimal compression)
    memLevel: 8,

    // Strategy
    strategy: 0, // Default strategy

    // Window bits
    windowBits: 15,

    // Chunk size
    chunkSize: 16 * 1024, // 16KB
  })
}

/**
 * Brotli compression middleware for better compression ratios
 */
export function brotliCompression() {
  const zlib = require('zlib')

  return (_req: Request, res: Response, next: Function) => {
    // Skip if compression is disabled
    if (!config.performance.enableCompression) {
      return next()
    }

    // Check if client accepts br encoding
    const acceptEncoding = _req.headers['accept-encoding'] || ''
    if (!acceptEncoding.includes('br')) {
      return next()
    }

    const originalSend = res.send.bind(res)
    const originalJson = res.json.bind(res)
    const originalEnd = res.end.bind(res)

    // Helper function to compress and send
    const compressAndSend = (data: any, isJson: boolean = false) => {
      // Skip small responses
      const dataStr = isJson ? JSON.stringify(data) : data
      if (!dataStr || dataStr.length < 1024) {
        return isJson ? originalJson(data) : originalSend(data)
      }

      // Set headers
      res.setHeader('Content-Encoding', 'br')
      res.removeHeader('Content-Length')
      res.setHeader('Vary', 'Accept-Encoding')

      // Compress with Brotli
      return zlib.brotliCompress(dataStr, {
        params: {
          [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT,
          [zlib.constants.BROTLI_PARAM_QUALITY]: config.performance.compressionLevel,
        },
      }, (err: Error, compressed: Buffer) => {
        if (err) {
          // Fall back to uncompressed on error
          res.removeHeader('Content-Encoding')
          return isJson ? originalJson(data) : originalSend(data)
        }

        res.setHeader('Content-Length', compressed.length)
        return originalEnd(compressed)
      })
    }

    // Override send method
    res.send = function(data: any) {
      compressAndSend(data, false)
      return res
    }

    // Override json method
    res.json = function(data: any) {
      res.setHeader('Content-Type', 'application/json')
      compressAndSend(data, true)
      return res
    }

    next()
  }
}

/**
 * Static file compression configuration
 */
export function staticCompression() {
  return {
    // Pre-compress static files
    preCompressed: true,

    // Compression options for different file types
    extensions: {
      // Text files
      '.html': { level: 9 },
      '.css': { level: 9 },
      '.js': { level: 9 },
      '.json': { level: 9 },
      '.xml': { level: 9 },
      '.svg': { level: 9 },

      // Images (already compressed formats)
      '.jpg': false,
      '.jpeg': false,
      '.png': false,
      '.gif': false,
      '.webp': false,

      // Other binary formats
      '.pdf': { level: 6 },
      '.woff': false,
      '.woff2': false,
    },
  }
}
