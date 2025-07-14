import { describe, test, expect, beforeEach } from 'vitest'
import { SEOService } from '../../../src/services/seoService'

describe('SEOService', () => {
  let seoService: SEOService

  beforeEach(() => {
    seoService = new SEOService()
  })

  describe('generateSlug', () => {
    test('should generate basic slug from string', () => {
      const result = seoService.generateSlug('Hello World Product')
      expect(result).toBe('hello-world-product')
    })

    test('should handle special characters', () => {
      const result = seoService.generateSlug('Product! with @special #characters')
      expect(result).toBe('product-with-special-characters')
    })

    test('should handle Korean characters', () => {
      const result = seoService.generateSlug('한국어 제품명')
      expect(result).toBe('한국어-제품명')
    })

    test('should remove multiple consecutive hyphens', () => {
      const result = seoService.generateSlug('Product---with---many---hyphens')
      expect(result).toBe('product-with-many-hyphens')
    })

    test('should truncate long slugs', () => {
      const longText = 'This is a very long product name that should be truncated to fit within the maximum length limit for SEO purposes'
      const result = seoService.generateSlug(longText, { maxLength: 30 })
      expect(result.length).toBeLessThanOrEqual(30)
      expect(result).not.toEndWith('-')
    })

    test('should add suffix when provided', () => {
      const result = seoService.generateSlug('Product Name', { suffix: '2024' })
      expect(result).toBe('product-name-2024')
    })

    test('should return default slug for empty input', () => {
      const result = seoService.generateSlug('')
      expect(result).toBe('item')
    })
  })

  describe('generateUniqueSlug', () => {
    test('should return original slug if not in existing list', () => {
      const existingSlugs = ['other-product', 'another-item']
      const result = seoService.generateUniqueSlug('New Product', existingSlugs)
      expect(result).toBe('new-product')
    })

    test('should append number if slug exists', () => {
      const existingSlugs = ['new-product', 'new-product-1']
      const result = seoService.generateUniqueSlug('New Product', existingSlugs)
      expect(result).toBe('new-product-2')
    })

    test('should find next available number', () => {
      const existingSlugs = ['product', 'product-1', 'product-2', 'product-4']
      const result = seoService.generateUniqueSlug('Product', existingSlugs)
      expect(result).toBe('product-3')
    })
  })

  describe('generateMetaTitle', () => {
    test('should generate basic meta title', () => {
      const result = seoService.generateMetaTitle('Awesome Product')
      expect(result).toContain('Awesome Product')
    })

    test('should include category when provided', () => {
      const result = seoService.generateMetaTitle('Awesome Product', 'Electronics')
      expect(result).toContain('Electronics')
    })

    test('should truncate if too long', () => {
      const longProductName = 'This is an extremely long product name that will definitely exceed the maximum meta title length limit'
      const result = seoService.generateMetaTitle(longProductName)
      expect(result.length).toBeLessThanOrEqual(60)
      expect(result).toEndWith('...')
    })

    test('should return default title for empty input', () => {
      const result = seoService.generateMetaTitle('')
      expect(result).toBe('Commerce Store')
    })
  })

  describe('generateMetaDescription', () => {
    test('should generate description from product description', () => {
      const productDescription = 'This is a great product with amazing features and benefits.'
      const result = seoService.generateMetaDescription(productDescription)
      expect(result).toContain('great product')
    })

    test('should strip HTML tags', () => {
      const htmlDescription = '<p>This is a <strong>great</strong> product</p>'
      const result = seoService.generateMetaDescription(htmlDescription)
      expect(result).not.toContain('<p>')
      expect(result).not.toContain('<strong>')
      expect(result).toContain('great')
    })

    test('should include price when provided', () => {
      const result = seoService.generateMetaDescription(
        'Great product',
        'Product Name',
        29.99
      )
      expect(result).toContain('29.99')
    })

    test('should truncate if too long', () => {
      const longDescription = 'This is an extremely long product description that goes on and on about various features and benefits and specifications that will definitely exceed the maximum meta description length limit for SEO purposes and search engine display'
      const result = seoService.generateMetaDescription(longDescription)
      expect(result.length).toBeLessThanOrEqual(160)
      expect(result).toEndWith('...')
    })

    test('should return default description for empty input', () => {
      const result = seoService.generateMetaDescription()
      expect(result).toBe('High-quality products at great prices')
    })
  })

  describe('extractFocusKeyword', () => {
    test('should extract focus keyword from product name', () => {
      const result = seoService.extractFocusKeyword('Wireless Bluetooth Headphones')
      expect(result).toBe('wireless bluetooth headphones')
    })

    test('should filter out short words', () => {
      const result = seoService.extractFocusKeyword('The Best TV in Market')
      expect(result).toBe('best market')
    })

    test('should limit to 3 words', () => {
      const result = seoService.extractFocusKeyword('Super Amazing Wireless Bluetooth Gaming Headphones')
      expect(result.split(' ')).toHaveLength(3)
    })

    test('should handle special characters', () => {
      const result = seoService.extractFocusKeyword('Product! with @special #characters')
      expect(result).toBe('product with special')
    })
  })

  describe('generateProductSEO', () => {
    test('should generate complete SEO data', () => {
      const existingSlugs = ['other-product']
      const result = seoService.generateProductSEO(
        'Amazing Wireless Headphones',
        'High-quality wireless headphones with noise cancellation.',
        'Electronics',
        99.99,
        existingSlugs
      )

      expect(result).toHaveProperty('slug')
      expect(result).toHaveProperty('metaTitle')
      expect(result).toHaveProperty('metaDescription')
      expect(result).toHaveProperty('focusKeyword')

      expect(result.slug).toBe('amazing-wireless-headphones')
      expect(result.metaTitle).toContain('Amazing Wireless Headphones')
      expect(result.metaDescription).toContain('wireless headphones')
      expect(result.focusKeyword).toContain('amazing')
    })

    test('should handle Korean product names', () => {
      const result = seoService.generateProductSEO(
        '무선 블루투스 헤드폰',
        '고품질 무선 헤드폰입니다.',
        '전자제품',
        150000
      )

      expect(result.slug).toBe('무선-블루투스-헤드폰')
      expect(result.metaTitle).toContain('무선 블루투스 헤드폰')
    })
  })

  describe('validateSEOData', () => {
    test('should validate correct SEO data', () => {
      const seoData = {
        slug: 'valid-product-slug',
        metaTitle: 'Valid Product Title',
        metaDescription: 'This is a valid meta description for the product.',
        focusKeyword: 'valid product'
      }

      const result = seoService.validateSEOData(seoData)
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    test('should reject slug with invalid characters', () => {
      const seoData = {
        slug: 'invalid_slug!@#'
      }

      const result = seoService.validateSEOData(seoData)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Slug can only contain lowercase letters, numbers, Korean characters, and hyphens')
    })

    test('should reject slug starting or ending with hyphen', () => {
      const seoData = {
        slug: '-invalid-slug-'
      }

      const result = seoService.validateSEOData(seoData)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Slug cannot start or end with a hyphen')
    })

    test('should reject meta title that is too long', () => {
      const seoData = {
        metaTitle: 'This is an extremely long meta title that exceeds the maximum allowed length for SEO purposes'
      }

      const result = seoService.validateSEOData(seoData)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Meta title must be 60 characters or less')
    })

    test('should reject meta description that is too long', () => {
      const seoData = {
        metaDescription: 'This is an extremely long meta description that goes on and on about various features and benefits that will definitely exceed the maximum allowed length for meta descriptions in search engine results'
      }

      const result = seoService.validateSEOData(seoData)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Meta description must be 160 characters or less')
    })
  })

  describe('generateProductSchema', () => {
    test('should generate basic product schema', () => {
      const product = {
        name: 'Test Product',
        price: 99.99,
        currency: 'USD',
        sku: 'TEST-001'
      }

      const schema = seoService.generateProductSchema(product)
      
      expect(schema).toHaveProperty('@context', 'https://schema.org')
      expect(schema).toHaveProperty('@type', 'Product')
      expect(schema).toHaveProperty('name', 'Test Product')
      expect(schema).toHaveProperty('sku', 'TEST-001')
      expect(schema).toHaveProperty('offers')
    })

    test('should include optional fields when provided', () => {
      const product = {
        name: 'Test Product',
        description: 'A great test product',
        price: 99.99,
        currency: 'USD',
        sku: 'TEST-001',
        brand: 'Test Brand',
        images: ['image1.jpg', 'image2.jpg'],
        rating: 4.5,
        reviewCount: 10
      }

      const schema = seoService.generateProductSchema(product) as any
      
      expect(schema.description).toBe('A great test product')
      expect(schema.brand.name).toBe('Test Brand')
      expect(schema.image).toEqual(['image1.jpg', 'image2.jpg'])
      expect(schema.aggregateRating.ratingValue).toBe(4.5)
      expect(schema.aggregateRating.reviewCount).toBe(10)
    })
  })

  describe('generateBreadcrumbSchema', () => {
    test('should generate breadcrumb schema', () => {
      const breadcrumbs = [
        { name: 'Home', url: '/' },
        { name: 'Electronics', url: '/electronics' },
        { name: 'Headphones', url: '/electronics/headphones' }
      ]

      const schema = seoService.generateBreadcrumbSchema(breadcrumbs) as any
      
      expect(schema['@context']).toBe('https://schema.org')
      expect(schema['@type']).toBe('BreadcrumbList')
      expect(schema.itemListElement).toHaveLength(3)
      expect(schema.itemListElement[0].position).toBe(1)
      expect(schema.itemListElement[0].name).toBe('Home')
    })
  })
})