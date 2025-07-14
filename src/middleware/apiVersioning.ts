import { Request, Response, NextFunction } from 'express'
import { config } from '../config/config'
import { logger } from '../utils/logger'
import { createValidationError } from './error'

export interface VersionInfo {
  version: string
  deprecated: boolean
  deprecationDate?: string
  sunsetDate?: string
  replacedBy?: string
  changelog?: string
}

export interface ApiVersionContext {
  requestedVersion: string
  resolvedVersion: string
  isDeprecated: boolean
  deprecationWarning?: string
}

/**
 * API versioning middleware with comprehensive version management
 */
export const apiVersioning = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!config.api.enableVersioning) {
        return next()
      }

      const requestedVersion = extractVersionFromRequest(req)
      const resolvedVersion = resolveVersion(requestedVersion)

      // Validate version
      if (!isVersionSupported(resolvedVersion)) {
        const error = createValidationError(
          `API version '${requestedVersion}' is not supported`,
          {
            requestedVersion,
            supportedVersions: config.api.supportedVersions,
            defaultVersion: config.api.defaultVersion,
          },
        )
        return next(error)
      }

      // Check for deprecation
      const versionInfo = getVersionInfo(resolvedVersion)
      const apiContext: ApiVersionContext = {
        requestedVersion,
        resolvedVersion,
        isDeprecated: versionInfo.deprecated,
        deprecationWarning: versionInfo.deprecated ?
          `API version ${resolvedVersion} is deprecated. Please upgrade to ${versionInfo.replacedBy || 'the latest version'}.` :
          undefined,
      }

      // Add version context to request
      ;(req as any).apiVersion = apiContext

      // Set version headers
      res.setHeader('X-API-Version', resolvedVersion)
      res.setHeader('X-API-Supported-Versions', config.api.supportedVersions.join(', '))

      if (versionInfo.deprecated) {
        res.setHeader('X-API-Deprecated', 'true')
        res.setHeader('X-API-Deprecation-Warning', apiContext.deprecationWarning!)

        if (versionInfo.deprecationDate) {
          res.setHeader('X-API-Deprecation-Date', versionInfo.deprecationDate)
        }

        if (versionInfo.sunsetDate) {
          res.setHeader('X-API-Sunset-Date', versionInfo.sunsetDate)
        }

        if (versionInfo.replacedBy) {
          res.setHeader('X-API-Replacement-Version', versionInfo.replacedBy)
        }

        // Log deprecation usage for monitoring
        logger.warn('Deprecated API version accessed', {
          version: resolvedVersion,
          endpoint: req.originalUrl,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
          deprecationInfo: versionInfo,
        })
      }

      // Set version in response for tracking
      res.setHeader('X-API-Version-Resolved', resolvedVersion)

      next()
    } catch (error) {
      logger.error('API versioning middleware error', error)
      next(error)
    }
  }
}

/**
 * Extract version from request (header, query param, or URL path)
 */
function extractVersionFromRequest(req: Request): string {
  // 1. Check Accept header (e.g., "application/vnd.api+json;version=2")
  const acceptHeader = req.headers.accept
  if (acceptHeader) {
    const versionMatch = acceptHeader.match(/version=([^;,\s]+)/)
    if (versionMatch) {
      return versionMatch[1]
    }
  }

  // 2. Check X-API-Version header
  const versionHeader = req.headers['x-api-version'] as string
  if (versionHeader) {
    return versionHeader
  }

  // 3. Check query parameter
  const queryVersion = req.query.version as string
  if (queryVersion) {
    return queryVersion
  }

  // 4. Check URL path (e.g., /api/v2/products)
  const urlMatch = req.path.match(/^\/api\/v(\d+(?:\.\d+)?)\//)
  if (urlMatch) {
    return urlMatch[1]
  }

  // 5. Default version
  return config.api.defaultVersion
}

/**
 * Resolve version to supported version (handle aliases, etc.)
 */
function resolveVersion(requestedVersion: string): string {
  // Handle version aliases
  const versionAliases: Record<string, string> = {
    'latest': getLatestVersion(),
    'stable': getStableVersion(),
    'beta': getBetaVersion(),
  }

  if (versionAliases[requestedVersion]) {
    return versionAliases[requestedVersion]
  }

  // Handle version ranges (e.g., ">=1.0")
  if (requestedVersion.startsWith('>=')) {
    const minVersion = requestedVersion.substring(2)
    return findCompatibleVersion(minVersion) || config.api.defaultVersion
  }

  return requestedVersion
}

/**
 * Check if version is supported
 */
function isVersionSupported(version: string): boolean {
  return config.api.supportedVersions.includes(version)
}

/**
 * Get version information including deprecation status
 */
function getVersionInfo(version: string): VersionInfo {
  const versionInfoMap: Record<string, VersionInfo> = {
    'v1': {
      version: 'v1',
      deprecated: config.api.deprecationNoticeVersions.includes('v1'),
      deprecationDate: '2024-01-01',
      sunsetDate: '2024-12-31',
      replacedBy: 'v2',
      changelog: '/docs/changelog#v1',
    },
    'v2': {
      version: 'v2',
      deprecated: config.api.deprecationNoticeVersions.includes('v2'),
      changelog: '/docs/changelog#v2',
    },
  }

  return versionInfoMap[version] || {
    version,
    deprecated: false,
  }
}

/**
 * Get latest version
 */
function getLatestVersion(): string {
  const versions = config.api.supportedVersions
    .filter(v => !config.api.deprecationNoticeVersions.includes(v))
    .sort((a, b) => compareVersions(b, a))

  return versions[0] || config.api.defaultVersion
}

/**
 * Get stable version (latest non-beta)
 */
function getStableVersion(): string {
  const stableVersions = config.api.supportedVersions
    .filter(v => !v.includes('beta') && !v.includes('alpha') && !config.api.deprecationNoticeVersions.includes(v))
    .sort((a, b) => compareVersions(b, a))

  return stableVersions[0] || config.api.defaultVersion
}

/**
 * Get beta version
 */
function getBetaVersion(): string {
  const betaVersions = config.api.supportedVersions
    .filter(v => v.includes('beta'))
    .sort((a, b) => compareVersions(b, a))

  return betaVersions[0] || getLatestVersion()
}

/**
 * Find compatible version for minimum version requirement
 */
function findCompatibleVersion(minVersion: string): string | null {
  const compatibleVersions = config.api.supportedVersions
    .filter(v => compareVersions(v, minVersion) >= 0)
    .sort((a, b) => compareVersions(a, b))

  return compatibleVersions[0] || null
}

/**
 * Compare two version strings
 */
function compareVersions(a: string, b: string): number {
  const aParts = a.replace(/^v/, '').split('.').map(n => parseInt(n) || 0)
  const bParts = b.replace(/^v/, '').split('.').map(n => parseInt(n) || 0)

  const maxLength = Math.max(aParts.length, bParts.length)

  for (let i = 0; i < maxLength; i++) {
    const aPart = aParts[i] || 0
    const bPart = bParts[i] || 0

    if (aPart > bPart) return 1
    if (aPart < bPart) return -1
  }

  return 0
}

/**
 * Version-specific route middleware
 */
export const versionedRoute = (version: string, handler: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const apiContext = (req as any).apiVersion as ApiVersionContext

    if (!apiContext || apiContext.resolvedVersion !== version) {
      return next() // Skip this handler
    }

    return handler(req, res, next)
  }
}

/**
 * Multi-version route handler
 */
export const multiVersionRoute = (handlers: Record<string, Function>, fallback?: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const apiContext = (req as any).apiVersion as ApiVersionContext
    const version = apiContext?.resolvedVersion || config.api.defaultVersion

    const handler = handlers[version] || fallback

    if (!handler) {
      const error = createValidationError(
        `No handler available for API version ${version}`,
        {
          version,
          availableVersions: Object.keys(handlers),
        },
      )
      return next(error)
    }

    return handler(req, res, next)
  }
}

/**
 * Version migration helper
 */
export const versionMigration = (fromVersion: string, toVersion: string, migrator: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const apiContext = (req as any).apiVersion as ApiVersionContext

    if (apiContext?.resolvedVersion === fromVersion) {
      try {
        // Apply migration to request/response
        migrator(req, res)

        // Update version context
        apiContext.resolvedVersion = toVersion
        res.setHeader('X-API-Version-Migrated-From', fromVersion)
        res.setHeader('X-API-Version-Migrated-To', toVersion)

        logger.debug('Version migration applied', {
          from: fromVersion,
          to: toVersion,
          endpoint: req.originalUrl,
        })
      } catch (error) {
        logger.error('Version migration failed', {
          from: fromVersion,
          to: toVersion,
          error,
          endpoint: req.originalUrl,
        })
        return next(error)
      }
    }

    next()
  }
}

/**
 * API version analytics middleware
 */
export const versionAnalytics = () => {
  const versionUsage: Record<string, { count: number; lastUsed: string }> = {}

  return (req: Request, _res: Response, next: NextFunction) => {
    const apiContext = (req as any).apiVersion as ApiVersionContext

    if (apiContext) {
      const version = apiContext.resolvedVersion

      if (!versionUsage[version]) {
        versionUsage[version] = { count: 0, lastUsed: new Date().toISOString() }
      }

      versionUsage[version].count++
      versionUsage[version].lastUsed = new Date().toISOString()

      // Store analytics in request for potential logging
      ;(req as any).versionAnalytics = { versionUsage }
    }

    next()
  }
}

/**
 * Get version usage statistics
 */
export const getVersionStatistics = () => {
  // In a real implementation, this would come from persistent storage
  return {
    supportedVersions: config.api.supportedVersions,
    defaultVersion: config.api.defaultVersion,
    deprecatedVersions: config.api.deprecationNoticeVersions,
    // usage would come from analytics
    usage: {},
  }
}
