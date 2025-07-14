import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Grid, List, SlidersHorizontal } from 'lucide-react';
import { SearchBar } from '../components/search/SearchBar';
import { SearchFilters } from '../components/search/SearchFilters';
import { SearchResults } from '../components/search/SearchResults';
import { searchService } from '../services/searchService';

export const SearchPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [products, setProducts] = useState<any[]>([]);
  const [facets, setFacets] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  
  const query = searchParams.get('q') || '';
  const page = parseInt(searchParams.get('page') || '1');
  const sortBy = searchParams.get('sortBy') || '';
  
  // 필터 상태
  const [filters, setFilters] = useState({
    categories: searchParams.getAll('category'),
    tags: searchParams.getAll('tag'),
    priceRange: {
      min: searchParams.get('minPrice') ? parseInt(searchParams.get('minPrice')!) : undefined,
      max: searchParams.get('maxPrice') ? parseInt(searchParams.get('maxPrice')!) : undefined,
    },
    attributes: {} as Record<string, string[]>,
    inStock: searchParams.get('inStock') === 'true',
    rating: searchParams.get('rating') ? parseInt(searchParams.get('rating')!) : undefined
  });

  // URL 파라미터 업데이트
  const updateUrlParams = (newFilters: any, newSortBy?: string, newPage?: number) => {
    const params = new URLSearchParams();
    
    if (query) params.set('q', query);
    if (newPage && newPage > 1) params.set('page', newPage.toString());
    if (newSortBy || sortBy) params.set('sortBy', newSortBy || sortBy);
    
    // 필터 파라미터 설정
    newFilters.categories.forEach((cat: string) => params.append('category', cat));
    newFilters.tags.forEach((tag: string) => params.append('tag', tag));
    
    if (newFilters.priceRange.min) params.set('minPrice', newFilters.priceRange.min.toString());
    if (newFilters.priceRange.max) params.set('maxPrice', newFilters.priceRange.max.toString());
    if (newFilters.inStock) params.set('inStock', 'true');
    if (newFilters.rating) params.set('rating', newFilters.rating.toString());
    
    Object.entries(newFilters.attributes).forEach(([key, values]) => {
      (values as string[]).forEach(value => params.append(`attr_${key}`, value));
    });
    
    setSearchParams(params);
  };

  // 검색 실행
  useEffect(() => {
    if (!query) {
      navigate('/');
      return;
    }

    const searchProducts = async () => {
      setLoading(true);
      
      try {
        const searchQuery = {
          query,
          filters: {
            categories: filters.categories,
            priceRange: filters.priceRange,
            inStock: filters.inStock || undefined,
            tags: filters.tags,
            rating: filters.rating,
            attributes: filters.attributes
          },
          sortBy: sortBy || undefined,
          page,
          limit: 20,
          facets: ['categories', 'price', 'tags', 'attributes']
        };

        const result = await searchService.searchProducts(searchQuery);
        
        setProducts(result.products);
        setFacets(result.facets);
        setTotal(result.total);
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setLoading(false);
      }
    };

    searchProducts();
  }, [query, filters, sortBy, page]);

  // 필터 변경 핸들러
  const handleFilterChange = (newFilters: any) => {
    setFilters(newFilters);
    updateUrlParams(newFilters, sortBy, 1); // 필터 변경 시 첫 페이지로
  };

  // 정렬 변경 핸들러
  const handleSortChange = (newSortBy: string) => {
    updateUrlParams(filters, newSortBy, 1);
  };

  // 페이지 변경 핸들러
  const handlePageChange = (newPage: number) => {
    updateUrlParams(filters, sortBy, newPage);
    window.scrollTo(0, 0);
  };

  // 필터 초기화
  const handleClearFilters = () => {
    const clearedFilters = {
      categories: [],
      tags: [],
      priceRange: {},
      attributes: {},
      inStock: false,
      rating: undefined
    };
    setFilters(clearedFilters);
    updateUrlParams(clearedFilters, sortBy, 1);
  };

  // Facet 데이터 처리
  const processedFacets = {
    categories: (facets.categories?.buckets || []).map((bucket: any) => ({
      value: bucket.key,
      label: bucket.key, // 실제로는 카테고리 이름을 가져와야 함
      count: bucket.doc_count
    })),
    tags: (facets.tags?.buckets || []).map((bucket: any) => ({
      value: bucket.key,
      label: bucket.key,
      count: bucket.doc_count
    })),
    attributes: {} // 속성별로 처리 필요
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 검색바 */}
      <div className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <SearchBar />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* 검색 결과 헤더 */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-2">
            "{query}" 검색 결과
          </h1>
          <p className="text-gray-600">
            총 {total.toLocaleString()}개의 상품을 찾았습니다.
          </p>
        </div>

        <div className="flex gap-6">
          {/* 사이드바 필터 (데스크톱) */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <SearchFilters
              categories={processedFacets.categories}
              tags={processedFacets.tags}
              attributes={processedFacets.attributes}
              selectedFilters={filters}
              onFilterChange={handleFilterChange}
              onClearFilters={handleClearFilters}
            />
          </aside>

          {/* 메인 컨텐츠 */}
          <main className="flex-1">
            {/* 정렬 및 뷰 모드 */}
            <div className="bg-white rounded-lg shadow p-4 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  {/* 모바일 필터 토글 */}
                  <button
                    onClick={() => setShowMobileFilters(!showMobileFilters)}
                    className="lg:hidden flex items-center text-gray-600 hover:text-gray-900"
                  >
                    <SlidersHorizontal className="w-5 h-5 mr-2" />
                    필터
                  </button>

                  {/* 정렬 */}
                  <select
                    value={sortBy}
                    onChange={(e) => handleSortChange(e.target.value)}
                    className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">관련도순</option>
                    <option value="price:asc">낮은 가격순</option>
                    <option value="price:desc">높은 가격순</option>
                    <option value="createdAt:desc">최신순</option>
                    <option value="popularity:desc">인기순</option>
                    <option value="rating:desc">평점순</option>
                  </select>
                </div>

                {/* 뷰 모드 토글 */}
                <div className="flex space-x-2">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 rounded ${
                      viewMode === 'grid'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    <Grid className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 rounded ${
                      viewMode === 'list'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    <List className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* 모바일 필터 (토글 시 표시) */}
            {showMobileFilters && (
              <div className="lg:hidden mb-6">
                <SearchFilters
                  categories={processedFacets.categories}
                  tags={processedFacets.tags}
                  attributes={processedFacets.attributes}
                  selectedFilters={filters}
                  onFilterChange={handleFilterChange}
                  onClearFilters={handleClearFilters}
                />
              </div>
            )}

            {/* 검색 결과 */}
            <SearchResults
              products={products}
              loading={loading}
              viewMode={viewMode}
            />

            {/* 페이지네이션 */}
            {totalPages > 1 && (
              <div className="mt-8 flex justify-center">
                <nav className="flex space-x-2">
                  <button
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page === 1}
                    className="px-4 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                  >
                    이전
                  </button>
                  
                  {[...Array(Math.min(totalPages, 10))].map((_, i) => {
                    const pageNum = i + 1;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        className={`px-4 py-2 border rounded-lg ${
                          page === pageNum
                            ? 'bg-blue-600 text-white'
                            : 'hover:bg-gray-100'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  
                  <button
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page === totalPages}
                    className="px-4 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                  >
                    다음
                  </button>
                </nav>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};