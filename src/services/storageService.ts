import AWS from 'aws-sdk'
import { promises as fs } from 'fs'
import path from 'path'
import { logger } from '../utils/logger'
import { AppError } from '../middleware/error'

export interface CloudStorageConfig {
  provider: 'aws' | 'local'
  aws?: {
    region: string
    accessKeyId: string
    secretAccessKey: string
    bucket: string
    endpoint?: string
  }
  local?: {
    uploadPath: string
    baseUrl: string
  }
}

export interface UploadResult {
  url: string
  key: string
  provider: string
}

export class StorageService {
  private s3?: AWS.S3
  private config: CloudStorageConfig

  constructor(config: CloudStorageConfig) {
    this.config = config

    if (config.provider === 'aws' && config.aws) {
      AWS.config.update({
        region: config.aws.region,
        accessKeyId: config.aws.accessKeyId,
        secretAccessKey: config.aws.secretAccessKey,
      })

      this.s3 = new AWS.S3({
        endpoint: config.aws.endpoint,
      })
    }
  }

  async uploadFile(
    buffer: Buffer,
    filename: string,
    contentType: string,
    folder: string = 'images',
  ): Promise<UploadResult> {
    const key = `${folder}/${Date.now()}-${filename}`

    if (this.config.provider === 'aws' && this.s3 && this.config.aws) {
      return this.uploadToS3(buffer, key, contentType)
    } else {
      return this.uploadToLocal(buffer, key, contentType)
    }
  }

  private async uploadToS3(
    buffer: Buffer,
    key: string,
    contentType: string,
  ): Promise<UploadResult> {
    if (!this.s3 || !this.config.aws) {
      throw new AppError('S3 not configured', 500)
    }

    try {
      const uploadParams: AWS.S3.PutObjectRequest = {
        Bucket: this.config.aws.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        ACL: 'public-read',
        CacheControl: 'max-age=31536000', // 1 year
      }

      const result = await this.s3.upload(uploadParams).promise()

      logger.info(`File uploaded to S3: ${key}`)

      return {
        url: result.Location,
        key,
        provider: 'aws',
      }
    } catch (error) {
      logger.error('S3 upload failed:', error)
      throw new AppError('Failed to upload file to S3', 500)
    }
  }

  private async uploadToLocal(
    buffer: Buffer,
    key: string,
    _contentType: string,
  ): Promise<UploadResult> {
    if (!this.config.local) {
      throw new AppError('Local storage not configured', 500)
    }

    try {
      const filePath = path.join(this.config.local.uploadPath, key)
      const dir = path.dirname(filePath)

      // Ensure directory exists
      await fs.mkdir(dir, { recursive: true })

      // Write file
      await fs.writeFile(filePath, buffer)

      const url = `${this.config.local.baseUrl}/${key}`

      logger.info(`File uploaded locally: ${key}`)

      return {
        url,
        key,
        provider: 'local',
      }
    } catch (error) {
      logger.error('Local upload failed:', error)
      throw new AppError('Failed to upload file locally', 500)
    }
  }

  async deleteFile(key: string): Promise<void> {
    if (this.config.provider === 'aws' && this.s3 && this.config.aws) {
      return this.deleteFromS3(key)
    } else {
      return this.deleteFromLocal(key)
    }
  }

  private async deleteFromS3(key: string): Promise<void> {
    if (!this.s3 || !this.config.aws) {
      throw new AppError('S3 not configured', 500)
    }

    try {
      await this.s3
        .deleteObject({
          Bucket: this.config.aws.bucket,
          Key: key,
        })
        .promise()

      logger.info(`File deleted from S3: ${key}`)
    } catch (error) {
      logger.error('S3 deletion failed:', error)
      throw new AppError('Failed to delete file from S3', 500)
    }
  }

  private async deleteFromLocal(key: string): Promise<void> {
    if (!this.config.local) {
      throw new AppError('Local storage not configured', 500)
    }

    try {
      const filePath = path.join(this.config.local.uploadPath, key)
      await fs.unlink(filePath)

      logger.info(`File deleted locally: ${key}`)
    } catch (error) {
      logger.error('Local deletion failed:', error)
      throw new AppError('Failed to delete file locally', 500)
    }
  }

  async copyFile(sourceKey: string, destinationKey: string): Promise<UploadResult> {
    if (this.config.provider === 'aws' && this.s3 && this.config.aws) {
      return this.copyInS3(sourceKey, destinationKey)
    } else {
      return this.copyInLocal(sourceKey, destinationKey)
    }
  }

  private async copyInS3(sourceKey: string, destinationKey: string): Promise<UploadResult> {
    if (!this.s3 || !this.config.aws) {
      throw new AppError('S3 not configured', 500)
    }

    try {
      await this.s3
        .copyObject({
          Bucket: this.config.aws.bucket,
          CopySource: `${this.config.aws.bucket}/${sourceKey}`,
          Key: destinationKey,
          ACL: 'public-read',
        })
        .promise()

      const url = `https://${this.config.aws.bucket}.s3.${this.config.aws.region}.amazonaws.com/${destinationKey}`

      logger.info(`File copied in S3: ${sourceKey} -> ${destinationKey}`)

      return {
        url,
        key: destinationKey,
        provider: 'aws',
      }
    } catch (error) {
      logger.error('S3 copy failed:', error)
      throw new AppError('Failed to copy file in S3', 500)
    }
  }

  private async copyInLocal(sourceKey: string, destinationKey: string): Promise<UploadResult> {
    if (!this.config.local) {
      throw new AppError('Local storage not configured', 500)
    }

    try {
      const sourcePath = path.join(this.config.local.uploadPath, sourceKey)
      const destinationPath = path.join(this.config.local.uploadPath, destinationKey)
      const dir = path.dirname(destinationPath)

      // Ensure directory exists
      await fs.mkdir(dir, { recursive: true })

      // Copy file
      await fs.copyFile(sourcePath, destinationPath)

      const url = `${this.config.local.baseUrl}/${destinationKey}`

      logger.info(`File copied locally: ${sourceKey} -> ${destinationKey}`)

      return {
        url,
        key: destinationKey,
        provider: 'local',
      }
    } catch (error) {
      logger.error('Local copy failed:', error)
      throw new AppError('Failed to copy file locally', 500)
    }
  }

  getFileUrl(key: string): string {
    if (this.config.provider === 'aws' && this.config.aws) {
      return `https://${this.config.aws.bucket}.s3.${this.config.aws.region}.amazonaws.com/${key}`
    } else if (this.config.local) {
      return `${this.config.local.baseUrl}/${key}`
    } else {
      throw new AppError('Storage not configured', 500)
    }
  }
}

// Create storage service instance based on environment
const storageConfig: CloudStorageConfig = {
  provider: (process.env.STORAGE_PROVIDER as 'aws' | 'local') || 'local',
  aws: process.env.AWS_S3_BUCKET
    ? {
      region: process.env.AWS_REGION || 'us-east-1',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      bucket: process.env.AWS_S3_BUCKET,
      endpoint: process.env.AWS_S3_ENDPOINT,
    }
    : undefined,
  local: {
    uploadPath: process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'),
    baseUrl: process.env.BASE_URL || 'http://localhost:3000/uploads',
  },
}

export const storageService = new StorageService(storageConfig)
