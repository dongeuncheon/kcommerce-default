import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, TrendingUp } from 'lucide-react';
import { searchService } from '../../services/searchService';
import { useDebounce } from '../../hooks/useDebounce';

export const SearchBar: React.FC = () => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [popularSearches, setPopularSearches] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const searchRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const debouncedQuery = useDebounce(query, 300);

  // 자동완성 검색
  useEffect(() => {
    if (debouncedQuery.length >= 2) {
      setLoading(true);
      searchService.autocomplete(debouncedQuery)
        .then(setSuggestions)
        .finally(() => setLoading(false));
    } else {
      setSuggestions([]);
    }
  }, [debouncedQuery]);

  // 인기 검색어 로드
  useEffect(() => {
    searchService.getPopularSearches()
      .then(setPopularSearches)
      .catch(console.error);
  }, []);

  // 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = (searchQuery: string = query) => {
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setQuery('');
      setShowDropdown(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const highlightMatch = (text: string, query: string) => {
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return (
      <>
        {parts.map((part, index) =>
          part.toLowerCase() === query.toLowerCase() ? (
            <mark key={index} className="bg-yellow-200 font-semibold">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </>
    );
  };

  return (
    <div ref={searchRef} className="relative w-full max-w-2xl">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setShowDropdown(true)}
          onKeyDown={handleKeyDown}
          placeholder="상품명, 브랜드, 카테고리 검색"
          className="w-full px-4 py-3 pl-12 pr-10 text-gray-700 bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
        />
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* 검색 드롭다운 */}
      {showDropdown && (query || popularSearches.length > 0) && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
          {/* 자동완성 제안 */}
          {suggestions.length > 0 && (
            <div className="p-3 border-b">
              <h3 className="text-sm font-semibold text-gray-600 mb-2">추천 검색어</h3>
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => handleSearch(suggestion)}
                  className="block w-full text-left px-3 py-2 hover:bg-gray-100 rounded"
                >
                  <Search className="inline-block w-4 h-4 mr-2 text-gray-400" />
                  {highlightMatch(suggestion, query)}
                </button>
              ))}
            </div>
          )}

          {/* 인기 검색어 */}
          {!query && popularSearches.length > 0 && (
            <div className="p-3">
              <h3 className="text-sm font-semibold text-gray-600 mb-2 flex items-center">
                <TrendingUp className="w-4 h-4 mr-1" />
                인기 검색어
              </h3>
              <div className="flex flex-wrap gap-2">
                {popularSearches.map((term, index) => (
                  <button
                    key={index}
                    onClick={() => handleSearch(term)}
                    className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-sm"
                  >
                    {index + 1}. {term}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 로딩 상태 */}
          {loading && (
            <div className="p-3 text-center text-gray-500">
              <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-gray-900"></div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};