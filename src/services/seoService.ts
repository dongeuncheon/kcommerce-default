import { AppError } from '../middleware/error'
import { logger } from '../utils/logger'

export interface SEOConfig {
  maxSlugLength: number
  maxMetaTitleLength: number
  maxMetaDescriptionLength: number
  defaultMetaTitle: string
  defaultMetaDescription: string
}

export interface SEOData {
  slug: string
  metaTitle: string
  metaDescription: string
  focusKeyword?: string
}

export interface SlugOptions {
  maxLength?: number
  suffix?: string
  allowDuplicates?: boolean
}

export class SEOService {
  private config: SEOConfig

  constructor(config?: Partial<SEOConfig>) {
    this.config = {
      maxSlugLength: 60,
      maxMetaTitleLength: 60,
      maxMetaDescriptionLength: 160,
      defaultMetaTitle: 'Commerce Store',
      defaultMetaDescription: 'High-quality products at great prices',
      ...config,
    }
  }

  /**
   * Generate a URL-friendly slug from a string
   */
  generateSlug(input: string, options: SlugOptions = {}): string {
    const {
      maxLength = this.config.maxSlugLength,
      suffix = '',
    } = options

    if (!input || typeof input !== 'string') {
      throw new AppError('Input is required for slug generation', 400)
    }

    let slug = input
      .toString()
      .toLowerCase()
      .trim()
      // Replace spaces with hyphens
      .replace(/\s+/g, '-')
      // Remove special characters except hyphens and alphanumeric
      .replace(/[^\w\-가-힣]/g, '')
      // Replace multiple consecutive hyphens with single hyphen
      .replace(/-+/g, '-')
      // Remove leading and trailing hyphens
      .replace(/^-+|-+$/g, '')

    // Add suffix if provided
    if (suffix) {
      slug = `${slug}-${suffix}`
    }

    // Truncate if too long
    if (slug.length > maxLength) {
      slug = slug.substring(0, maxLength).replace(/-[^-]*$/, '')
    }

    // Ensure slug is not empty
    if (!slug) {
      slug = 'item'
    }

    return slug
  }

  /**
   * Generate a unique slug by checking against existing slugs
   */
  generateUniqueSlug(
    input: string,
    existingSlugs: string[],
    options: SlugOptions = {},
  ): string {
    const baseSlug = this.generateSlug(input, options)

    if (!existingSlugs.includes(baseSlug)) {
      return baseSlug
    }

    // Generate numbered variations
    let counter = 1
    let uniqueSlug = `${baseSlug}-${counter}`

    while (existingSlugs.includes(uniqueSlug) && counter < 1000) {
      counter++
      uniqueSlug = `${baseSlug}-${counter}`
    }

    if (counter >= 1000) {
      // Use timestamp as fallback
      uniqueSlug = `${baseSlug}-${Date.now()}`
    }

    return uniqueSlug
  }

  /**
   * Generate meta title with proper length and formatting
   */
  generateMetaTitle(productName: string, categoryName?: string): string {
    if (!productName) {
      return this.config.defaultMetaTitle
    }

    let metaTitle = productName

    // Add category if provided and there's space
    if (categoryName && metaTitle.length + categoryName.length + 3 <= this.config.maxMetaTitleLength) {
      metaTitle = `${productName} | ${categoryName}`
    }

    // Add store name if there's space
    const storeName = this.config.defaultMetaTitle
    if (metaTitle.length + storeName.length + 3 <= this.config.maxMetaTitleLength) {
      metaTitle = `${metaTitle} | ${storeName}`
    }

    // Truncate if too long
    if (metaTitle.length > this.config.maxMetaTitleLength) {
      metaTitle = metaTitle.substring(0, this.config.maxMetaTitleLength - 3) + '...'
    }

    return metaTitle
  }

  /**
   * Generate meta description from product description
   */
  generateMetaDescription(
    productDescription?: string,
    productName?: string,
    price?: number,
  ): string {
    if (!productDescription && !productName) {
      return this.config.defaultMetaDescription
    }

    let metaDescription = ''

    // Start with product name if no description
    if (!productDescription && productName) {
      metaDescription = `Shop ${productName} at great prices.`
    } else if (productDescription) {
      // Clean up the description
      metaDescription = productDescription
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim()
    }

    // Add price if available and there's space
    if (price && metaDescription.length + 20 <= this.config.maxMetaDescriptionLength) {
      const priceText = ` Starting at $${price.toFixed(2)}.`
      if (metaDescription.length + priceText.length <= this.config.maxMetaDescriptionLength) {
        metaDescription += priceText
      }
    }

    // Truncate if too long
    if (metaDescription.length > this.config.maxMetaDescriptionLength) {
      metaDescription = metaDescription.substring(0, this.config.maxMetaDescriptionLength - 3) + '...'
    }

    return metaDescription || this.config.defaultMetaDescription
  }

  /**
   * Extract focus keyword from product name or description
   */
  extractFocusKeyword(productName: string, _description?: string): string {
    if (!productName) {
      return ''
    }

    // Use the first 2-3 meaningful words from product name
    const words = productName
      .toLowerCase()
      .replace(/[^\w\s가-힣]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 2) // Filter out short words

    // Take first 2-3 words
    const focusKeyword = words.slice(0, 3).join(' ')

    return focusKeyword || productName.toLowerCase()
  }

  /**
   * Generate complete SEO data for a product
   */
  generateProductSEO(
    productName: string,
    description?: string,
    categoryName?: string,
    price?: number,
    existingSlugs: string[] = [],
  ): SEOData {
    try {
      const slug = this.generateUniqueSlug(productName, existingSlugs)
      const metaTitle = this.generateMetaTitle(productName, categoryName)
      const metaDescription = this.generateMetaDescription(description, productName, price)
      const focusKeyword = this.extractFocusKeyword(productName, description)

      logger.info(`Generated SEO data for product: ${productName}`)

      return {
        slug,
        metaTitle,
        metaDescription,
        focusKeyword,
      }
    } catch (error) {
      logger.error('Failed to generate SEO data:', error)
      throw new AppError('Failed to generate SEO data', 500)
    }
  }

  /**
   * Validate SEO data
   */
  validateSEOData(seoData: Partial<SEOData>): { isValid: boolean; errors: string[] } {
    const errors: string[] = []

    if (seoData.slug) {
      if (seoData.slug.length > this.config.maxSlugLength) {
        errors.push(`Slug must be ${this.config.maxSlugLength} characters or less`)
      }
      if (!/^[a-z0-9가-힣-]+$/.test(seoData.slug)) {
        errors.push('Slug can only contain lowercase letters, numbers, Korean characters, and hyphens')
      }
      if (seoData.slug.startsWith('-') || seoData.slug.endsWith('-')) {
        errors.push('Slug cannot start or end with a hyphen')
      }
    }

    if (seoData.metaTitle && seoData.metaTitle.length > this.config.maxMetaTitleLength) {
      errors.push(`Meta title must be ${this.config.maxMetaTitleLength} characters or less`)
    }

    if (seoData.metaDescription && seoData.metaDescription.length > this.config.maxMetaDescriptionLength) {
      errors.push(`Meta description must be ${this.config.maxMetaDescriptionLength} characters or less`)
    }

    return {
      isValid: errors.length === 0,
      errors,
    }
  }

  /**
   * Generate category slug
   */
  generateCategorySlug(categoryName: string, existingSlugs: string[] = []): string {
    return this.generateUniqueSlug(categoryName, existingSlugs, {
      maxLength: 50, // Shorter for categories
    })
  }

  /**
   * Generate tag slug
   */
  generateTagSlug(tagName: string, existingSlugs: string[] = []): string {
    return this.generateUniqueSlug(tagName, existingSlugs, {
      maxLength: 30, // Shorter for tags
    })
  }

  /**
   * Generate breadcrumb schema
   */
  generateBreadcrumbSchema(breadcrumbs: Array<{ name: string; url: string }>): object {
    return {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: breadcrumbs.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        item: item.url,
      })),
    }
  }

  /**
   * Generate product schema markup
   */
  generateProductSchema(product: {
    name: string
    description?: string
    price: number
    currency: string
    brand?: string
    sku: string
    images?: string[]
    rating?: number
    reviewCount?: number
  }): object {
    const schema: any = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.name,
      sku: product.sku,
      offers: {
        '@type': 'Offer',
        price: product.price,
        priceCurrency: product.currency,
        availability: 'https://schema.org/InStock',
      },
    }

    if (product.description) {
      schema.description = product.description
    }

    if (product.brand) {
      schema.brand = {
        '@type': 'Brand',
        name: product.brand,
      }
    }

    if (product.images && product.images.length > 0) {
      schema.image = product.images
    }

    if (product.rating && product.reviewCount) {
      schema.aggregateRating = {
        '@type': 'AggregateRating',
        ratingValue: product.rating,
        reviewCount: product.reviewCount,
      }
    }

    return schema
  }
}

// Create service instance
export const seoService = new SEOService({
  defaultMetaTitle: process.env.STORE_NAME || 'Commerce Store',
  defaultMetaDescription: process.env.STORE_DESCRIPTION || 'High-quality products at great prices',
})
