import { api } from './api';

export interface SearchQuery {
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

export interface SearchResult {
  products: any[];
  total: number;
  facets: Record<string, any>;
  suggestions: string[];
  took: number;
}

class SearchService {
  /**
   * 상품 검색
   */
  async searchProducts(searchQuery: SearchQuery): Promise<SearchResult> {
    const params = new URLSearchParams();
    
    // 기본 검색어
    if (searchQuery.query) {
      params.append('q', searchQuery.query);
    }
    
    // 필터
    if (searchQuery.filters) {
      const { filters } = searchQuery;
      
      if (filters.categories?.length) {
        params.append('categories', filters.categories.join(','));
      }
      
      if (filters.priceRange?.min !== undefined) {
        params.append('minPrice', filters.priceRange.min.toString());
      }
      
      if (filters.priceRange?.max !== undefined) {
        params.append('maxPrice', filters.priceRange.max.toString());
      }
      
      if (filters.inStock !== undefined) {
        params.append('inStock', filters.inStock.toString());
      }
      
      if (filters.tags?.length) {
        params.append('tags', filters.tags.join(','));
      }
      
      if (filters.rating !== undefined) {
        params.append('rating', filters.rating.toString());
      }
      
      if (filters.attributes) {
        params.append('attributes', JSON.stringify(filters.attributes));
      }
    }
    
    // 정렬
    if (searchQuery.sort) {
      params.append('sortBy', `${searchQuery.sort.field}:${searchQuery.sort.order}`);
    }
    
    // 페이지네이션
    if (searchQuery.page) {
      params.append('page', searchQuery.page.toString());
    }
    
    if (searchQuery.limit) {
      params.append('limit', searchQuery.limit.toString());
    }
    
    // 패싯
    if (searchQuery.facets?.length) {
      params.append('facets', searchQuery.facets.join(','));
    }
    
    const response = await api.get(`/search/products?${params.toString()}`);
    return response.data.data;
  }

  /**
   * 자동완성
   */
  async autocomplete(query: string, limit: number = 10): Promise<string[]> {
    const response = await api.get('/search/autocomplete', {
      params: { q: query, limit }
    });
    return response.data.data;
  }

  /**
   * 인기 검색어
   */
  async getPopularSearches(limit: number = 10): Promise<string[]> {
    const response = await api.get('/search/popular', {
      params: { limit }
    });
    return response.data.data;
  }

  /**
   * 연관 검색어
   */
  async getRelatedSearches(query: string): Promise<string[]> {
    const response = await api.get('/search/related', {
      params: { q: query }
    });
    return response.data.data;
  }

  /**
   * 검색 인덱스 상태
   */
  async getIndexStats(): Promise<any> {
    const response = await api.get('/search/index/stats');
    return response.data.data;
  }

  /**
   * 전체 재색인
   */
  async reindexAll(): Promise<void> {
    await api.post('/search/index/reindex');
  }
}

export const searchService = new SearchService();