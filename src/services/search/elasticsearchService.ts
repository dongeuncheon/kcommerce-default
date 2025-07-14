// Mock implementation - Elasticsearch removed
import { PrismaClient } from '@prisma/client';
import { cacheService } from '../cacheService';

interface SearchQuery {
  query: string;
  filters?: {
    categories?: string[];
    priceRange?: { min?: number; max?: number };
    attributes?: Record<string, any>;
    inStock?: boolean;
    tags?: string[];
    rating?: number;
  };
  sort?: {
    field: string;
    order: 'asc' | 'desc';
  };
  page?: number;
  limit?: number;
  facets?: string[];
}

interface SearchResult {
  products: any[];
  total: number;
  facets: Record<string, any>;
  suggestions: string[];
  took: number;
}

export class ElasticsearchService {
  private prisma: PrismaClient;
  private readonly INDEX_NAME = 'products';
  private readonly KOREAN_ANALYZER = 'nori';
  
  // Mock data for popular searches
  private popularSearches = [
    '스마트폰', '노트북', '이어폰', '운동화', '가방',
    '시계', '화장품', '의류', '책상', '의자'
  ];

  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * 인덱스 초기화 (Mock)
   */
  private async initializeIndex() {
    // Mock implementation - no Elasticsearch operations
    console.log('Mock: Index initialization completed');
  }

  /**
   * 인덱스 생성 (Mock)
   */
  private async createIndex() {
    // Mock implementation - no actual index creation
    console.log('Mock: Index created with Korean analyzer settings');
  }

  /**
   * 상품 색인 (Mock)
   */
  async indexProduct(productId: string) {
    try {
      const product = await this.prisma.product.findUnique({
        where: { id: productId },
        include: {
          category: true,
          tags: {
            include: { tag: true }
          },
          attributes: true
        }
      });

      if (!product) return;

      // Mock implementation - just log the indexing action
      console.log(`Mock: Product ${productId} indexed successfully`);
      
      // Clear cache for this product
      await cacheService.delete(`product:${productId}`);
      
      return true;
    } catch (error) {
      console.error(`Mock: Failed to index product ${productId}:`, error);
      return false;
    }
  }

  /**
   * 상품 검색 (Mock with Prisma)
   */
  async searchProducts(searchQuery: SearchQuery): Promise<SearchResult> {
    const startTime = Date.now();
    const { query, filters, sort, page = 1, limit = 20, facets = [] } = searchQuery;
    const skip = (page - 1) * limit;

    // 캐시 확인
    const cacheKey = `search:${JSON.stringify(searchQuery)}`;
    const cached = await cacheService.get(cacheKey);
    if (cached) return cached;

    try {
      // Build Prisma where conditions
      const where: any = {
        status: 'PUBLISHED'
      };

      // Search query
      if (query) {
        where.OR = [
          { name: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
          { sku: { contains: query, mode: 'insensitive' } }
        ];
      }

      // Apply filters
      if (filters) {
        if (filters.categories?.length) {
          where.categoryId = { in: filters.categories };
        }

        if (filters.priceRange) {
          where.price = {};
          if (filters.priceRange.min) where.price.gte = filters.priceRange.min;
          if (filters.priceRange.max) where.price.lte = filters.priceRange.max;
        }

        if (filters.inStock !== undefined) {
          where.quantity = filters.inStock ? { gt: 0 } : { equals: 0 };
        }

        if (filters.rating) {
          where.averageRating = { gte: filters.rating };
        }
      }

      // Get total count
      const total = await this.prisma.product.count({ where });

      // Build order by
      const orderBy: any = {};
      if (sort) {
        orderBy[sort.field] = sort.order;
      } else {
        orderBy.createdAt = 'desc';
      }

      // Fetch products
      const products = await this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          category: true,
          tags: {
            include: { tag: true }
          },
          images: true
        }
      });

      // Format products with mock highlights
      const formattedProducts = products.map(product => ({
        ...product,
        _score: 1.0,
        highlights: query ? {
          name: product.name.includes(query) ? 
            [`<mark>${product.name}</mark>`] : undefined,
          description: product.description?.includes(query) ? 
            [`<mark>${product.description.substring(0, 150)}...</mark>`] : undefined
        } : {}
      }));

      // Generate mock facets
      const mockFacets: any = {};
      
      if (facets.includes('categories')) {
        const categories = await this.prisma.category.findMany({
          select: { id: true, name: true }
        });
        mockFacets.categories = {
          buckets: categories.slice(0, 10).map(cat => ({
            key: cat.id,
            doc_count: Math.floor(Math.random() * 50) + 1
          }))
        };
      }

      if (facets.includes('price')) {
        mockFacets.price_ranges = {
          buckets: [
            { key: '*-10000', doc_count: 15 },
            { key: '10000-50000', doc_count: 25 },
            { key: '50000-100000', doc_count: 20 },
            { key: '100000-500000', doc_count: 10 },
            { key: '500000-*', doc_count: 5 }
          ]
        };
      }

      // Generate suggestions
      const suggestions = query ? this.generateSuggestions(query) : [];

      const result: SearchResult = {
        products: formattedProducts,
        total,
        facets: mockFacets,
        suggestions,
        took: Date.now() - startTime
      };

      // 캐시 저장 (5분)
      await cacheService.set(cacheKey, result, 300);

      return result;
    } catch (error) {
      console.error('Search error:', error);
      return {
        products: [],
        total: 0,
        facets: {},
        suggestions: [],
        took: Date.now() - startTime
      };
    }
  }

  /**
   * Generate search suggestions
   */
  private generateSuggestions(query: string): string[] {
    const suggestions = [
      query + ' 추천',
      query + ' 인기',
      query + ' 세일',
      query + ' 신상품',
      query + ' 베스트'
    ];
    return suggestions.slice(0, 5);
  }

  /**
   * 자동완성 검색 (Mock)
   */
  async autocomplete(query: string, limit: number = 10): Promise<string[]> {
    try {
      // Simple autocomplete using Prisma
      const products = await this.prisma.product.findMany({
        where: {
          status: 'PUBLISHED',
          name: {
            startsWith: query,
            mode: 'insensitive'
          }
        },
        select: { name: true },
        take: limit,
        distinct: ['name']
      });

      const results = products.map(p => p.name);
      
      // Add some common suggestions
      if (results.length < limit) {
        const commonSuggestions = [
          query + ' 추천',
          query + ' 인기상품',
          query + ' 세일',
          query + ' 신상품'
        ].filter(s => s.toLowerCase().startsWith(query.toLowerCase()));
        
        results.push(...commonSuggestions.slice(0, limit - results.length));
      }

      return results.slice(0, limit);
    } catch (error) {
      console.error('Autocomplete error:', error);
      return [];
    }
  }

  /**
   * 인기 검색어 (Mock)
   */
  async getPopularSearches(limit: number = 10): Promise<string[]> {
    // Return mock popular searches
    return this.popularSearches.slice(0, limit);
  }

  /**
   * 연관 검색어 (Mock)
   */
  async getRelatedSearches(query: string): Promise<string[]> {
    try {
      // Find products matching the query
      const products = await this.prisma.product.findMany({
        where: {
          status: 'PUBLISHED',
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } }
          ]
        },
        select: {
          tags: {
            include: { tag: true }
          }
        },
        take: 10
      });

      // Extract unique tags
      const tagSet = new Set<string>();
      products.forEach(product => {
        product.tags.forEach(pt => {
          tagSet.add(pt.tag.name);
        });
      });

      // Add some generic related terms
      const relatedTerms = [
        query + ' 추천',
        query + ' 인기',
        query + ' 할인',
        '저렴한 ' + query,
        '최고급 ' + query
      ];

      return [...Array.from(tagSet), ...relatedTerms].slice(0, 10);
    } catch (error) {
      console.error('Related searches error:', error);
      return [];
    }
  }

  /**
   * 전체 재색인 (Mock)
   */
  async reindexAll() {
    try {
      const products = await this.prisma.product.findMany({
        where: { status: 'PUBLISHED' },
        select: { id: true }
      });

      console.log(`Mock: Reindexing ${products.length} products...`);

      // Clear all search-related caches
      await cacheService.deletePattern('search:*');
      await cacheService.deletePattern('product:*');

      console.log('Mock: Reindexing completed successfully');
      return true;
    } catch (error) {
      console.error('Mock: Reindexing failed:', error);
      return false;
    }
  }

  /**
   * 카테고리 경로 생성
   */
  private async getCategoryPath(categoryId: string | null): Promise<string[]> {
    if (!categoryId) return [];

    const path: string[] = [];
    let currentId = categoryId;

    while (currentId) {
      const category = await this.prisma.category.findUnique({
        where: { id: currentId },
        select: { name: true, parentId: true }
      });

      if (!category) break;
      
      path.unshift(category.name);
      currentId = category.parentId;
    }

    return path;
  }

  /**
   * 기본 검색 (Mock)
   */
  async search(query: string, options?: any): Promise<any> {
    // Delegate to searchProducts with default options
    return this.searchProducts({
      query,
      page: options?.page || 1,
      limit: options?.limit || 20,
      filters: options?.filters || {},
      sort: options?.sort,
      facets: options?.facets || []
    });
  }

  /**
   * 검색 제안 가져오기 (Mock)
   */
  async getSuggestions(query: string): Promise<string[]> {
    // Combine autocomplete and related searches
    const [autocompleteResults, relatedSearches] = await Promise.all([
      this.autocomplete(query, 5),
      this.getRelatedSearches(query)
    ]);

    const combined = [...new Set([...autocompleteResults, ...relatedSearches])];
    return combined.slice(0, 10);
  }

  /**
   * 상품 인덱스 업데이트 (Mock)
   */
  async updateProductIndex(productId: string, updates: any) {
    try {
      // Mock implementation - just clear cache
      await cacheService.delete(`product:${productId}`);
      await cacheService.deletePattern('search:*');
      console.log(`Mock: Product ${productId} index updated`);
      return true;
    } catch (error) {
      console.error(`Mock: Failed to update product index ${productId}:`, error);
      return false;
    }
  }

  /**
   * 상품 인덱스 삭제 (Mock) - Alias for deleteProduct
   */
  async deleteProductIndex(productId: string) {
    return this.deleteProduct(productId);
  }

  /**
   * 대량 상품 색인 (Mock)
   */
  async bulkIndexProducts(productIds: string[]) {
    try {
      console.log(`Mock: Bulk indexing ${productIds.length} products...`);
      
      // Clear relevant caches
      await cacheService.deletePattern('search:*');
      
      let successCount = 0;
      let failCount = 0;

      for (const productId of productIds) {
        try {
          await this.indexProduct(productId);
          successCount++;
        } catch (error) {
          console.error(`Mock: Failed to index product ${productId}:`, error);
          failCount++;
        }
      }

      console.log(`Mock: Bulk indexing completed. Success: ${successCount}, Failed: ${failCount}`);
      
      return {
        total: productIds.length,
        success: successCount,
        failed: failCount
      };
    } catch (error) {
      console.error('Mock: Bulk indexing failed:', error);
      return {
        total: productIds.length,
        success: 0,
        failed: productIds.length
      };
    }
  }

  /**
   * 상품 삭제 (Mock)
   */
  async deleteProduct(productId: string) {
    try {
      // Clear cache for this product
      await cacheService.delete(`product:${productId}`);
      console.log(`Mock: Product ${productId} removed from index`);
      return true;
    } catch (error) {
      console.error(`Mock: Failed to delete product ${productId}:`, error);
      return false;
    }
  }

  /**
   * 인덱스 상태 확인 (Mock)
   */
  async getIndexStats() {
    try {
      const productCount = await this.prisma.product.count({
        where: { status: 'PUBLISHED' }
      });

      return {
        documentCount: productCount,
        sizeInBytes: productCount * 1024, // Mock size calculation
        health: 'green' // Always return healthy status
      };
    } catch (error) {
      console.error('Mock: Failed to get index stats:', error);
      return {
        documentCount: 0,
        sizeInBytes: 0,
        health: 'red'
      };
    }
  }
}

export const elasticsearchService = new ElasticsearchService();