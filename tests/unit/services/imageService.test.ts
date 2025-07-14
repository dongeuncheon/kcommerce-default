import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { promises as fs } from 'fs'
import path from 'path'
import sharp from 'sharp'
import { ImageService } from '../../../src/services/imageService'

// Mock dependencies
vi.mock('sharp')
vi.mock('fs', () => ({
  promises: {
    access: vi.fn(),
    mkdir: vi.fn(),
    stat: vi.fn(),
    unlink: vi.fn(),
  }
}))

const mockSharp = vi.mocked(sharp)
const mockFs = vi.mocked(fs)

describe('ImageService', () => {
  let imageService: ImageService
  const testBuffer = Buffer.from('test image data')
  const testFilename = 'test-image.jpg'

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock sharp instance
    const mockSharpInstance = {
      metadata: vi.fn(),
      resize: vi.fn().mockReturnThis(),
      jpeg: vi.fn().mockReturnThis(),
      toFile: vi.fn(),
    }
    
    mockSharp.mockReturnValue(mockSharpInstance as any)
    
    // Mock file system operations
    mockFs.access.mockResolvedValue(undefined)
    mockFs.mkdir.mockResolvedValue(undefined)
    mockFs.stat.mockResolvedValue({ size: 1024 } as any)
    
    imageService = new ImageService()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('processImage', () => {
    test('should process image and generate thumbnails successfully', async () => {
      // Setup mocks
      const mockMetadata = {
        width: 1920,
        height: 1080,
        format: 'jpeg'
      }
      
      const mockSharpInstance = mockSharp() as any
      mockSharpInstance.metadata.mockResolvedValue(mockMetadata)
      mockSharpInstance.toFile.mockResolvedValue(undefined)

      // Test image processing
      const result = await imageService.processImage(testBuffer, testFilename)

      expect(result).toHaveProperty('originalPath')
      expect(result).toHaveProperty('thumbnails')
      expect(result).toHaveProperty('metadata')
      expect(result.thumbnails).toHaveLength(4) // thumb, small, medium, large
      expect(result.metadata.width).toBe(1920)
      expect(result.metadata.height).toBe(1080)
    })

    test('should handle invalid image metadata', async () => {
      const mockSharpInstance = mockSharp() as any
      mockSharpInstance.metadata.mockResolvedValue({ width: null, height: null })

      await expect(
        imageService.processImage(testBuffer, testFilename)
      ).rejects.toThrow('Invalid image metadata')
    })

    test('should apply custom processing options', async () => {
      const mockMetadata = {
        width: 1920,
        height: 1080,
        format: 'jpeg'
      }
      
      const mockSharpInstance = mockSharp() as any
      mockSharpInstance.metadata.mockResolvedValue(mockMetadata)
      mockSharpInstance.toFile.mockResolvedValue(undefined)

      const options = {
        quality: 90,
        format: 'png' as const,
        maxWidth: 1024,
        maxHeight: 768
      }

      await imageService.processImage(testBuffer, testFilename, options)

      expect(mockSharpInstance.resize).toHaveBeenCalledWith(
        options.maxWidth,
        options.maxHeight,
        expect.objectContaining({
          fit: 'inside',
          withoutEnlargement: true
        })
      )
    })
  })

  describe('deleteImage', () => {
    test('should delete original image and thumbnails', async () => {
      const imagePath = '/uploads/test-image-123456.jpg'
      mockFs.unlink.mockResolvedValue(undefined)

      await imageService.deleteImage(imagePath)

      // Should delete original + 4 thumbnails = 5 unlink calls
      expect(mockFs.unlink).toHaveBeenCalledTimes(5)
      expect(mockFs.unlink).toHaveBeenCalledWith(imagePath)
    })

    test('should handle missing thumbnail files gracefully', async () => {
      const imagePath = '/uploads/test-image-123456.jpg'
      mockFs.unlink
        .mockResolvedValueOnce(undefined) // Original image
        .mockRejectedValueOnce(new Error('File not found')) // First thumbnail
        .mockResolvedValueOnce(undefined) // Second thumbnail
        .mockResolvedValueOnce(undefined) // Third thumbnail
        .mockResolvedValueOnce(undefined) // Fourth thumbnail

      await expect(imageService.deleteImage(imagePath)).resolves.not.toThrow()
    })
  })

  describe('validateImageFile', () => {
    test('should validate allowed image types', () => {
      const validFile = {
        mimetype: 'image/jpeg',
        size: 1024 * 1024, // 1MB
      } as Express.Multer.File

      expect(() => imageService.validateImageFile(validFile)).not.toThrow()
    })

    test('should reject invalid file types', () => {
      const invalidFile = {
        mimetype: 'application/pdf',
        size: 1024 * 1024,
      } as Express.Multer.File

      expect(() => imageService.validateImageFile(invalidFile)).toThrow(
        'Invalid file type. Only JPEG, PNG, and WebP are allowed.'
      )
    })

    test('should reject files that are too large', () => {
      const largeFile = {
        mimetype: 'image/jpeg',
        size: 15 * 1024 * 1024, // 15MB
      } as Express.Multer.File

      expect(() => imageService.validateImageFile(largeFile)).toThrow(
        'File size too large. Maximum size is 10MB.'
      )
    })
  })

  describe('URL generation', () => {
    test('should generate correct image URL', () => {
      const imagePath = '/uploads/test-image-123456.jpg'
      const url = imageService.getImageUrl(imagePath)

      expect(url).toBe('/uploads/test-image-123456.jpg')
    })

    test('should generate correct thumbnail URL', () => {
      const imagePath = '/uploads/test-image-123456.jpg'
      const thumbnailUrl = imageService.getThumbnailUrl(imagePath, 'medium')

      expect(thumbnailUrl).toBe('/uploads/test-image-medium.jpg')
    })
  })

  describe('getImageInfo', () => {
    test('should return image metadata', async () => {
      const mockMetadata = {
        width: 1920,
        height: 1080,
        format: 'jpeg',
        density: 72
      }
      
      const mockSharpInstance = mockSharp() as any
      mockSharpInstance.metadata.mockResolvedValue(mockMetadata)

      const result = await imageService.getImageInfo('/path/to/image.jpg')

      expect(result).toEqual(mockMetadata)
      expect(mockSharp).toHaveBeenCalledWith('/path/to/image.jpg')
    })

    test('should handle image metadata errors', async () => {
      const mockSharpInstance = mockSharp() as any
      mockSharpInstance.metadata.mockRejectedValue(new Error('Invalid image'))

      await expect(
        imageService.getImageInfo('/path/to/invalid.jpg')
      ).rejects.toThrow('Failed to get image information')
    })
  })
})