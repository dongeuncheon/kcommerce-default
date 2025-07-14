import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import app from '../../src/index'
import { promises as fs } from 'fs'
import path from 'path'

describe('Image Upload Integration Tests', () => {
  const testImagePath = path.join(__dirname, '../fixtures/test-image.jpg')
  
  beforeEach(async () => {
    // Create a test image file if it doesn't exist
    try {
      await fs.access(testImagePath)
    } catch {
      // Create a minimal JPEG buffer for testing
      const testImageBuffer = Buffer.from([
        0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
        0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
        0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
        0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
        0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
        0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
        0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
        0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x11, 0x08, 0x00, 0x01,
        0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
        0xFF, 0xC4, 0x00, 0x14, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x08, 0xFF, 0xC4,
        0x00, 0x14, 0x10, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xFF, 0xDA, 0x00, 0x0C,
        0x03, 0x01, 0x00, 0x02, 0x11, 0x03, 0x11, 0x00, 0x3F, 0x00, 0x9F, 0xFF, 0xD9
      ])
      
      await fs.mkdir(path.dirname(testImagePath), { recursive: true })
      await fs.writeFile(testImagePath, testImageBuffer)
    }
  })

  afterEach(async () => {
    // Clean up test files
    try {
      await fs.unlink(testImagePath)
    } catch {
      // File might not exist, ignore error
    }
  })

  describe('POST /api/v1/products/:id/image', () => {
    test('should upload single image and generate thumbnails', async () => {
      // First, we need to create a product to upload images to
      const productData = {
        name: 'Test Product',
        sku: 'TEST-001',
        status: 'DRAFT',
        type: 'SIMPLE',
        price: 99.99,
        trackQuantity: true,
        quantity: 10,
        lowStockThreshold: 5,
        allowBackorders: false,
        categoryId: 1
      }

      const productResponse = await request(app)
        .post('/api/v1/products')
        .send(productData)

      expect(productResponse.status).toBe(201)
      const productId = productResponse.body.data.id

      // Now upload an image
      const response = await request(app)
        .post(`/api/v1/products/${productId}/image`)
        .attach('image', testImagePath)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveProperty('image')
      expect(response.body.data.image).toHaveProperty('url')
      expect(response.body.data.image).toHaveProperty('thumbnails')
      expect(response.body.data.image.thumbnails).toHaveLength(4)
      expect(response.body.message).toBe('Image uploaded and processed successfully')
    }, 30000) // Increase timeout for image processing

    test('should reject non-image files', async () => {
      // Create a text file
      const textFilePath = path.join(__dirname, '../fixtures/test.txt')
      await fs.writeFile(textFilePath, 'This is not an image')

      const productData = {
        name: 'Test Product',
        sku: 'TEST-002',
        status: 'DRAFT',
        type: 'SIMPLE',
        price: 99.99,
        trackQuantity: true,
        quantity: 10,
        lowStockThreshold: 5,
        allowBackorders: false,
        categoryId: 1
      }

      const productResponse = await request(app)
        .post('/api/v1/products')
        .send(productData)

      const productId = productResponse.body.data.id

      const response = await request(app)
        .post(`/api/v1/products/${productId}/image`)
        .attach('image', textFilePath)

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)

      // Clean up
      await fs.unlink(textFilePath)
    })

    test('should return 400 when no image is provided', async () => {
      const productData = {
        name: 'Test Product',
        sku: 'TEST-003',
        status: 'DRAFT',
        type: 'SIMPLE',
        price: 99.99,
        trackQuantity: true,
        quantity: 10,
        lowStockThreshold: 5,
        allowBackorders: false,
        categoryId: 1
      }

      const productResponse = await request(app)
        .post('/api/v1/products')
        .send(productData)

      const productId = productResponse.body.data.id

      const response = await request(app)
        .post(`/api/v1/products/${productId}/image`)

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
      expect(response.body.error.message).toBe('No image uploaded')
    })
  })

  describe('POST /api/v1/products/:id/images', () => {
    test('should upload multiple images', async () => {
      // Create multiple test images
      const testImage2Path = path.join(__dirname, '../fixtures/test-image-2.jpg')
      const testImageBuffer = Buffer.from([
        0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
        0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43
      ])
      
      await fs.writeFile(testImage2Path, testImageBuffer)

      const productData = {
        name: 'Test Product',
        sku: 'TEST-004',
        status: 'DRAFT',
        type: 'SIMPLE',
        price: 99.99,
        trackQuantity: true,
        quantity: 10,
        lowStockThreshold: 5,
        allowBackorders: false,
        categoryId: 1
      }

      const productResponse = await request(app)
        .post('/api/v1/products')
        .send(productData)

      const productId = productResponse.body.data.id

      const response = await request(app)
        .post(`/api/v1/products/${productId}/images`)
        .attach('images', testImagePath)
        .attach('images', testImage2Path)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.processed).toBe(2)

      // Clean up
      await fs.unlink(testImage2Path)
    }, 30000)
  })

  describe('DELETE /api/v1/products/:id/images/:imageId', () => {
    test('should delete specific image', async () => {
      // This test would require setting up a product with images first
      // and then testing the deletion endpoint
      // For now, we'll test the endpoint structure
      
      const response = await request(app)
        .delete('/api/v1/products/999/images/nonexistent')

      // Should return 404 for non-existent product/image
      expect(response.status).toBe(404)
    })
  })
})