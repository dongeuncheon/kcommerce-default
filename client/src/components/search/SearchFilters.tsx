import React, { useState } from 'react';
import { ChevronDown, ChevronUp, X } from 'lucide-react';

interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

interface PriceRange {
  min?: number;
  max?: number;
}

interface SearchFiltersProps {
  categories: FilterOption[];
  tags: FilterOption[];
  attributes: Record<string, FilterOption[]>;
  selectedFilters: {
    categories: string[];
    tags: string[];
    priceRange: PriceRange;
    attributes: Record<string, string[]>;
    inStock?: boolean;
    rating?: number;
  };
  onFilterChange: (filters: any) => void;
  onClearFilters: () => void;
}

export const SearchFilters: React.FC<SearchFiltersProps> = ({
  categories,
  tags,
  attributes,
  selectedFilters,
  onFilterChange,
  onClearFilters
}) => {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    categories: true,
    price: true,
    tags: false,
    attributes: false
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleCategoryToggle = (categoryId: string) => {
    const newCategories = selectedFilters.categories.includes(categoryId)
      ? selectedFilters.categories.filter(id => id !== categoryId)
      : [...selectedFilters.categories, categoryId];
    
    onFilterChange({
      ...selectedFilters,
      categories: newCategories
    });
  };

  const handleTagToggle = (tag: string) => {
    const newTags = selectedFilters.tags.includes(tag)
      ? selectedFilters.tags.filter(t => t !== tag)
      : [...selectedFilters.tags, tag];
    
    onFilterChange({
      ...selectedFilters,
      tags: newTags
    });
  };

  const handlePriceChange = (type: 'min' | 'max', value: string) => {
    const numValue = value ? parseInt(value) : undefined;
    onFilterChange({
      ...selectedFilters,
      priceRange: {
        ...selectedFilters.priceRange,
        [type]: numValue
      }
    });
  };

  const handleAttributeToggle = (attributeName: string, value: string) => {
    const currentValues = selectedFilters.attributes[attributeName] || [];
    const newValues = currentValues.includes(value)
      ? currentValues.filter(v => v !== value)
      : [...currentValues, value];
    
    onFilterChange({
      ...selectedFilters,
      attributes: {
        ...selectedFilters.attributes,
        [attributeName]: newValues
      }
    });
  };

  const handleStockToggle = () => {
    onFilterChange({
      ...selectedFilters,
      inStock: !selectedFilters.inStock
    });
  };

  const handleRatingChange = (rating: number) => {
    onFilterChange({
      ...selectedFilters,
      rating: selectedFilters.rating === rating ? undefined : rating
    });
  };

  const hasActiveFilters = 
    selectedFilters.categories.length > 0 ||
    selectedFilters.tags.length > 0 ||
    selectedFilters.priceRange.min !== undefined ||
    selectedFilters.priceRange.max !== undefined ||
    Object.keys(selectedFilters.attributes).some(key => selectedFilters.attributes[key].length > 0) ||
    selectedFilters.inStock ||
    selectedFilters.rating;

  return (
    <div className="bg-white rounded-lg shadow p-4">
      {/* 필터 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">필터</h3>
        {hasActiveFilters && (
          <button
            onClick={onClearFilters}
            className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
          >
            <X className="w-4 h-4 mr-1" />
            초기화
          </button>
        )}
      </div>

      {/* 카테고리 필터 */}
      <div className="mb-6">
        <button
          onClick={() => toggleSection('categories')}
          className="flex items-center justify-between w-full text-left font-medium mb-3"
        >
          <span>카테고리</span>
          {expandedSections.categories ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        
        {expandedSections.categories && (
          <div className="space-y-2">
            {categories.map(category => (
              <label key={category.value} className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedFilters.categories.includes(category.value)}
                  onChange={() => handleCategoryToggle(category.value)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="ml-2 text-sm">
                  {category.label}
                  {category.count !== undefined && (
                    <span className="text-gray-500 ml-1">({category.count})</span>
                  )}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* 가격 필터 */}
      <div className="mb-6">
        <button
          onClick={() => toggleSection('price')}
          className="flex items-center justify-between w-full text-left font-medium mb-3"
        >
          <span>가격</span>
          {expandedSections.price ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        
        {expandedSections.price && (
          <div className="flex items-center space-x-2">
            <input
              type="number"
              placeholder="최소"
              value={selectedFilters.priceRange.min || ''}
              onChange={(e) => handlePriceChange('min', e.target.value)}
              className="w-24 px-2 py-1 border rounded text-sm"
            />
            <span className="text-gray-500">~</span>
            <input
              type="number"
              placeholder="최대"
              value={selectedFilters.priceRange.max || ''}
              onChange={(e) => handlePriceChange('max', e.target.value)}
              className="w-24 px-2 py-1 border rounded text-sm"
            />
            <span className="text-sm text-gray-500">원</span>
          </div>
        )}
      </div>

      {/* 재고 필터 */}
      <div className="mb-6">
        <label className="flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={selectedFilters.inStock || false}
            onChange={handleStockToggle}
            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
          />
          <span className="ml-2 text-sm font-medium">재고 있음</span>
        </label>
      </div>

      {/* 평점 필터 */}
      <div className="mb-6">
        <h4 className="font-medium mb-3">평점</h4>
        <div className="space-y-2">
          {[4, 3, 2, 1].map(rating => (
            <label key={rating} className="flex items-center cursor-pointer">
              <input
                type="radio"
                name="rating"
                checked={selectedFilters.rating === rating}
                onChange={() => handleRatingChange(rating)}
                className="w-4 h-4 text-blue-600 focus:ring-blue-500"
              />
              <span className="ml-2 text-sm flex items-center">
                {[...Array(5)].map((_, i) => (
                  <span key={i} className={i < rating ? 'text-yellow-400' : 'text-gray-300'}>
                    ★
                  </span>
                ))}
                <span className="ml-1 text-gray-500">이상</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* 태그 필터 */}
      {tags.length > 0 && (
        <div className="mb-6">
          <button
            onClick={() => toggleSection('tags')}
            className="flex items-center justify-between w-full text-left font-medium mb-3"
          >
            <span>태그</span>
            {expandedSections.tags ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          
          {expandedSections.tags && (
            <div className="flex flex-wrap gap-2">
              {tags.map(tag => (
                <button
                  key={tag.value}
                  onClick={() => handleTagToggle(tag.value)}
                  className={`px-3 py-1 rounded-full text-sm transition-colors ${
                    selectedFilters.tags.includes(tag.value)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  {tag.label}
                  {tag.count !== undefined && (
                    <span className="ml-1">({tag.count})</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 속성 필터 */}
      {Object.keys(attributes).length > 0 && (
        <div>
          <button
            onClick={() => toggleSection('attributes')}
            className="flex items-center justify-between w-full text-left font-medium mb-3"
          >
            <span>상세 옵션</span>
            {expandedSections.attributes ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          
          {expandedSections.attributes && (
            <div className="space-y-4">
              {Object.entries(attributes).map(([name, values]) => (
                <div key={name}>
                  <h5 className="text-sm font-medium mb-2">{name}</h5>
                  <div className="space-y-1">
                    {values.map(option => (
                      <label key={option.value} className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={(selectedFilters.attributes[name] || []).includes(option.value)}
                          onChange={() => handleAttributeToggle(name, option.value)}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <span className="ml-2 text-sm">
                          {option.label}
                          {option.count !== undefined && (
                            <span className="text-gray-500 ml-1">({option.count})</span>
                          )}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};