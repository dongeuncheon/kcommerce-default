import { config } from '../config/config'
import { logger } from '../utils/logger'
import crypto from 'crypto'
import path from 'path'

export interface CDNAsset {
  originalUrl: string
  cdnUrl: string
  type: 'image' | 'video' | 'document' | 'other'
  size?: number
  etag?: string
  lastModified?: Date
}

export class CDNService {
  private baseUrl: string
  private enabled: boolean

  constructor() {
    this.enabled = config.cdn.enabled
    this.baseUrl = config.cdn.url || ''
  }

  /**
   * Check if CDN is enabled
   */
  isEnabled(): boolean {
    return this.enabled && !!this.baseUrl
  }

  /**
   * Generate CDN URL for an asset
   */
  getCDNUrl(assetPath: string, options?: {
    width?: number
    height?: number
    quality?: number
    format?: string
  }): string {
    if (!this.isEnabled()) {
      return assetPath
    }

    // Check if it's already a full URL
    if (assetPath.startsWith('http://') || assetPath.startsWith('https://')) {
      return assetPath
    }

    // Build CDN URL with transformations
    let cdnUrl = this.baseUrl.replace(/\/$/, '') + '/' + assetPath.replace(/^\//, '')

    // Add image transformation parameters if provided
    if (options && this.isImageAsset(assetPath)) {
      const params = new URLSearchParams()

      if (options.width) params.append('w', options.width.toString())
      if (options.height) params.append('h', options.height.toString())
      if (options.quality) params.append('q', options.quality.toString())
      if (options.format) params.append('f', options.format)

      if (params.toString()) {
        cdnUrl += '?' + params.toString()
      }
    }

    return cdnUrl
  }

  /**
   * Generate CDN URLs for responsive images
   */
  getResponsiveImageUrls(imagePath: string, options?: {
    sizes?: number[]
    quality?: number
    format?: string
  }): Record<string, string> {
    const defaultSizes = [320, 640, 768, 1024, 1280, 1920]
    const sizes = options?.sizes || defaultSizes

    const urls: Record<string, string> = {}

    sizes.forEach(size => {
      urls[`${size}w`] = this.getCDNUrl(imagePath, {
        width: size,
        quality: options?.quality || 85,
        format: options?.format,
      })
    })

    // Add original
    urls['original'] = this.getCDNUrl(imagePath)

    return urls
  }

  /**
   * Generate srcset attribute for responsive images
   */
  generateSrcSet(imagePath: string, options?: {
    sizes?: number[]
    quality?: number
  }): string {
    const urls = this.getResponsiveImageUrls(imagePath, options)

    return Object.entries(urls)
      .filter(([key]) => key !== 'original')
      .map(([key, url]) => `${url} ${key}`)
      .join(', ')
  }

  /**
   * Preload critical assets
   */
  generatePreloadLinks(assets: string[]): string[] {
    if (!this.isEnabled()) {
      return []
    }

    return assets.map(asset => {
      const cdnUrl = this.getCDNUrl(asset)
      const type = this.getAssetType(asset)

      let asType = 'fetch'
      if (type === 'image') asType = 'image'
      else if (asset.endsWith('.css')) asType = 'style'
      else if (asset.endsWith('.js')) asType = 'script'
      else if (asset.endsWith('.woff2')) asType = 'font'

      return `<link rel="preload" href="${cdnUrl}" as="${asType}"${asType === 'font' ? ' crossorigin' : ''}>`
    })
  }


  /**
   * Get asset type from path
   */
  private getAssetType(assetPath: string): string {
    const ext = path.extname(assetPath).toLowerCase()

    const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.ico']
    const videoExts = ['.mp4', '.webm', '.ogg', '.mov']
    const docExts = ['.pdf', '.doc', '.docx', '.xls', '.xlsx']

    if (imageExts.includes(ext)) return 'images'
    if (videoExts.includes(ext)) return 'videos'
    if (docExts.includes(ext)) return 'documents'

    return 'other'
  }

  /**
   * Check if asset is an image
   */
  private isImageAsset(assetPath: string): boolean {
    return this.getAssetType(assetPath) === 'images'
  }

  /**
   * Generate cache key for CDN assets
   */
  generateCacheKey(assetPath: string, version?: string): string {
    const hash = crypto
      .createHash('md5')
      .update(assetPath + (version || ''))
      .digest('hex')
      .substring(0, 8)

    return `${assetPath}?v=${hash}`
  }

  /**
   * Purge CDN cache for specific paths
   */
  async purgeCache(paths: string[]): Promise<boolean> {
    if (!this.isEnabled()) {
      return true
    }

    try {
      // This would typically call your CDN's API to purge cache
      // Example for Cloudflare, AWS CloudFront, etc.
      logger.info(`Purging CDN cache for ${paths.length} paths`)

      // Implement actual CDN purge logic here based on your CDN provider
      // For now, we'll just log
      paths.forEach(path => {
        logger.debug(`Purging cache for: ${path}`)
      })

      return true
    } catch (error) {
      logger.error('Failed to purge CDN cache:', error)
      return false
    }
  }

  /**
   * Get CDN analytics/metrics
   */
  async getMetrics(): Promise<{
    bandwidth: number
    requests: number
    cacheHitRate: number
    topAssets: Array<{ path: string; requests: number }>
  }> {
    // This would typically call your CDN's API to get metrics
    // For now, return mock data
    return {
      bandwidth: 0,
      requests: 0,
      cacheHitRate: 0,
      topAssets: [],
    }
  }

  /**
   * Configure CDN headers for optimal caching
   */
  getCDNHeaders(assetType: string): Record<string, string> {
    const headers: Record<string, string> = {
      'X-CDN-Enabled': this.isEnabled() ? 'true' : 'false',
    }

    if (assetType === 'images' || assetType === 'videos') {
      headers['Cache-Control'] = 'public, max-age=31536000, immutable' // 1 year
      headers['Vary'] = 'Accept-Encoding'
    } else if (assetType === 'documents') {
      headers['Cache-Control'] = 'public, max-age=86400' // 1 day
    } else {
      headers['Cache-Control'] = 'public, max-age=3600' // 1 hour
    }

    return headers
  }
}

// Export singleton instance
export const cdnService = new CDNService()

/**
 * Express middleware for CDN URL rewriting
 */
export function cdnMiddleware() {
  return (_req: any, res: any, next: Function) => {
    // Add CDN helper to response locals
    res.locals.cdn = {
      url: (path: string, options?: any) => cdnService.getCDNUrl(path, options),
      srcset: (path: string, options?: any) => cdnService.generateSrcSet(path, options),
      preload: (assets: string[]) => cdnService.generatePreloadLinks(assets),
    }

    // Override res.json to rewrite URLs in responses
    const originalJson = res.json.bind(res)
    res.json = function(data: any) {
      if (cdnService.isEnabled() && data) {
        data = rewriteUrlsInObject(data)
      }
      return originalJson(data)
    }

    next()
  }
}

/**
 * Recursively rewrite URLs in an object
 */
function rewriteUrlsInObject(obj: any): any {
  if (!obj || typeof obj !== 'object') {
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map(item => rewriteUrlsInObject(item))
  }

  const rewritten: any = {}

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key]

      // Check if this looks like an asset URL
      if (
        typeof value === 'string' &&
        (key.includes('url') || key.includes('image') || key.includes('src')) &&
        (value.startsWith('/uploads/') || value.startsWith('/assets/'))
      ) {
        rewritten[key] = cdnService.getCDNUrl(value)
      } else {
        rewritten[key] = rewriteUrlsInObject(value)
      }
    }
  }

  return rewritten
}
