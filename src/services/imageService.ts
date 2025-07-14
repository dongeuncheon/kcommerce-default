import sharp from 'sharp'
import { promises as fs } from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { AppError } from '../middleware/error'
import { logger } from '../utils/logger'

export interface ImageProcessingOptions {
  quality?: number
  format?: 'jpeg' | 'png' | 'webp'
  maxWidth?: number
  maxHeight?: number
}

export interface ThumbnailConfig {
  width: number
  height: number
  suffix: string
}

export interface ProcessedImage {
  originalPath: string
  thumbnails: Array<{
    path: string
    width: number
    height: number
    size: number
  }>
  metadata: {
    width: number
    height: number
    format: string
    size: number
  }
}

export class ImageService {
  private readonly uploadDir: string
  private readonly thumbnailConfigs: ThumbnailConfig[] = [
    { width: 150, height: 150, suffix: 'thumb' },
    { width: 300, height: 300, suffix: 'small' },
    { width: 600, height: 600, suffix: 'medium' },
    { width: 1200, height: 1200, suffix: 'large' },
  ]

  constructor() {
    this.uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads')
    this.ensureUploadDirExists()
  }

  private async ensureUploadDirExists(): Promise<void> {
    try {
      await fs.access(this.uploadDir)
    } catch {
      await fs.mkdir(this.uploadDir, { recursive: true })
      logger.info(`Created upload directory: ${this.uploadDir}`)
    }
  }

  async processImage(
    buffer: Buffer,
    _filename: string,
    options: ImageProcessingOptions = {},
  ): Promise<ProcessedImage> {
    try {
      const {
        quality = 80,
        format = 'jpeg',
        maxWidth = 2048,
        maxHeight = 2048,
      } = options

      // Generate unique filename
      const ext = format === 'jpeg' ? 'jpg' : format
      const uniqueFilename = `${uuidv4()}-${Date.now()}.${ext}`
      const originalPath = path.join(this.uploadDir, uniqueFilename)

      // Process main image
      const sharpInstance = sharp(buffer)
      const metadata = await sharpInstance.metadata()

      if (!metadata.width || !metadata.height) {
        throw new AppError('Invalid image metadata', 400)
      }

      // Resize if necessary and save original
      await sharpInstance
        .resize(maxWidth, maxHeight, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality })
        .toFile(originalPath)

      // Generate thumbnails
      const thumbnails = await Promise.all(
        this.thumbnailConfigs.map(async (config) => {
          const thumbnailFilename = `${path.parse(uniqueFilename).name}-${config.suffix}.${ext}`
          const thumbnailPath = path.join(this.uploadDir, thumbnailFilename)

          await sharp(buffer)
            .resize(config.width, config.height, {
              fit: 'cover',
              position: 'center',
            })
            .jpeg({ quality })
            .toFile(thumbnailPath)

          const stats = await fs.stat(thumbnailPath)

          return {
            path: thumbnailPath,
            width: config.width,
            height: config.height,
            size: stats.size,
          }
        }),
      )

      const originalStats = await fs.stat(originalPath)

      return {
        originalPath,
        thumbnails,
        metadata: {
          width: metadata.width,
          height: metadata.height,
          format: metadata.format || 'unknown',
          size: originalStats.size,
        },
      }
    } catch (error) {
      logger.error('Image processing failed:', error)
      throw new AppError('Failed to process image', 500)
    }
  }

  async deleteImage(imagePath: string): Promise<void> {
    try {
      // Delete original image
      await fs.unlink(imagePath)

      // Delete thumbnails
      const parsedPath = path.parse(imagePath)
      const baseFilename = parsedPath.name.split('-')[0] // Remove timestamp

      for (const config of this.thumbnailConfigs) {
        const thumbnailPath = path.join(
          parsedPath.dir,
          `${baseFilename}-${config.suffix}${parsedPath.ext}`,
        )

        try {
          await fs.unlink(thumbnailPath)
        } catch (error) {
          // Log but don't throw if thumbnail doesn't exist
          logger.warn(`Failed to delete thumbnail: ${thumbnailPath}`, error)
        }
      }

      logger.info(`Deleted image and thumbnails: ${imagePath}`)
    } catch (error) {
      logger.error('Failed to delete image:', error)
      throw new AppError('Failed to delete image', 500)
    }
  }

  async getImageInfo(imagePath: string): Promise<sharp.Metadata> {
    try {
      return await sharp(imagePath).metadata()
    } catch (error) {
      logger.error('Failed to get image info:', error)
      throw new AppError('Failed to get image information', 500)
    }
  }

  validateImageFile(file: any): boolean {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp']
    const maxSize = 10 * 1024 * 1024 // 10MB

    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new AppError('Invalid file type. Only JPEG, PNG, and WebP are allowed.', 400)
    }

    if (file.size > maxSize) {
      throw new AppError('File size too large. Maximum size is 10MB.', 400)
    }

    return true
  }

  getImageUrl(imagePath: string): string {
    const relativePath = path.relative(this.uploadDir, imagePath)
    return `/uploads/${relativePath}`
  }

  getThumbnailUrl(imagePath: string, size: 'thumb' | 'small' | 'medium' | 'large'): string {
    const parsedPath = path.parse(imagePath)
    const baseFilename = parsedPath.name.split('-')[0] // Remove timestamp
    const thumbnailFilename = `${baseFilename}-${size}${parsedPath.ext}`
    return `/uploads/${thumbnailFilename}`
  }
}

export const imageService = new ImageService()
