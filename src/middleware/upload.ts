import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { Request } from 'express'
import { config } from '../config/config'
import { AppError } from './error'
import { imageService } from '../services/imageService'
import { logger } from '../utils/logger'

// Ensure upload directory exists
const uploadDir = config.upload.uploadPath
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

// Configure storage
const storage = multer.diskStorage({
  destination: (_req: Request, file: any, cb) => {
    // Create subdirectories based on file type
    const subDir = file.mimetype.startsWith('image/') ? 'images' : 'files'
    const fullPath = path.join(uploadDir, subDir)

    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true })
    }

    cb(null, fullPath)
  },
  filename: (_req: Request, file: any, cb) => {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    const ext = path.extname(file.originalname)
    const name = path.basename(file.originalname, ext)
    const sanitizedName = name.replace(/[^a-zA-Z0-9]/g, '_')

    cb(null, `${sanitizedName}_${uniqueSuffix}${ext}`)
  },
})

// File filter
const fileFilter = (_req: Request, file: any, cb: multer.FileFilterCallback) => {
  if (config.upload.allowedTypes.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new AppError(`File type ${file.mimetype} is not allowed`, 400))
  }
}

// Create multer instance
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.upload.maxFileSize,
    files: 10, // Maximum 10 files per request
  },
})

// Upload middleware for single file
export const uploadSingle = (fieldName: string) => upload.single(fieldName)

// Upload middleware for multiple files
export const uploadMultiple = (fieldName: string, maxCount: number = 10) =>
  upload.array(fieldName, maxCount)

// Upload middleware for multiple fields
export const uploadFields = (fields: Array<{ name: string; maxCount: number }>) =>
  upload.fields(fields)

// Helper function to get file URL
export const getFileUrl = (req: Request, filePath: string): string => {
  const relativePath = path.relative(config.upload.uploadPath, filePath)
  return `${req.protocol}://${req.get('host')}/uploads/${relativePath.replace(/\\/g, '/')}`
}

// Helper function to delete file
export const deleteFile = (filePath: string): void => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
  } catch (error) {
    logger.error('Error deleting file:', error)
  }
}

// Memory storage for image processing
const memoryStorage = multer.memoryStorage()

// Create multer instance for image processing (memory storage)
export const imageUpload = multer({
  storage: memoryStorage,
  fileFilter: (_req: Request, file: any, cb: multer.FileFilterCallback) => {
    try {
      imageService.validateImageFile(file)
      cb(null, true)
    } catch (error) {
      cb(error as Error)
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 10, // Maximum 10 files per request
  },
})

// Image upload middleware for single image
export const uploadSingleImage = (fieldName: string) => imageUpload.single(fieldName)

// Image upload middleware for multiple images
export const uploadMultipleImages = (fieldName: string, maxCount: number = 10) =>
  imageUpload.array(fieldName, maxCount)
