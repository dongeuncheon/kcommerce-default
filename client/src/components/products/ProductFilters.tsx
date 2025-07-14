import React, { useState } from 'react'
import { FilterOptions } from '@/types'
import { useQuery } from 'react-query'
import { categoryService } from '@/services/categoryService'
import { X, Filter } from 'lucide-react'

interface ProductFiltersProps {
  filters: FilterOptions
  onFiltersChange: (filters: Partial<FilterOptions>) => void
}

export const ProductFilters: React.FC<ProductFiltersProps> = ({
  filters,
  onFiltersChange,
}) => {
  const [priceRange, setPriceRange] = useState({
    min: filters.minPrice || '',
    max: filters.maxPrice || '',
  })

  const { data: categoriesData } = useQuery('categories', categoryService.getCategories)
  const categories = categoriesData?.data || []

  const handlePriceChange = (type: 'min' | 'max', value: string) => {
    setPriceRange(prev => ({ ...prev, [type]: value }))
  }

  const applyPriceFilter = () => {
    onFiltersChange({
      minPrice: priceRange.min ? Number(priceRange.min) : undefined,
      maxPrice: priceRange.max ? Number(priceRange.max) : undefined,
    })
  }

  const clearFilters = () => {
    setPriceRange({ min: '', max: '' })
    onFiltersChange({
      search: undefined,
      category: undefined,
      minPrice: undefined,
      maxPrice: undefined,
      inStock: false,
    })
  }

  const hasActiveFilters = 
    filters.search || 
    filters.category || 
    filters.minPrice || 
    filters.maxPrice || 
    filters.inStock

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Filter className="h-5 w-5" />
          Filters
        </h2>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-sm text-primary-600 hover:text-primary-700"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Search */}
      <div>
        <label className="block text-sm font-medium mb-2">Search</label>
        <input
          type="text"
          value={filters.search || ''}
          onChange={(e) => onFiltersChange({ search: e.target.value })}
          placeholder="Search products..."
          className="input w-full"
        />
      </div>

      {/* Categories */}
      <div>
        <label className="block text-sm font-medium mb-2">Category</label>
        <select
          value={filters.category || ''}
          onChange={(e) => onFiltersChange({ category: e.target.value || undefined })}
          className="input w-full"
        >
          <option value="">All Categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      {/* Price Range */}
      <div>
        <label className="block text-sm font-medium mb-2">Price Range</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={priceRange.min}
            onChange={(e) => handlePriceChange('min', e.target.value)}
            placeholder="Min"
            className="input w-full"
            min="0"
          />
          <span className="text-gray-500">-</span>
          <input
            type="number"
            value={priceRange.max}
            onChange={(e) => handlePriceChange('max', e.target.value)}
            placeholder="Max"
            className="input w-full"
            min="0"
          />
        </div>
        <button
          onClick={applyPriceFilter}
          className="btn-primary btn-sm w-full mt-2"
        >
          Apply
        </button>
      </div>

      {/* Stock Status */}
      <div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={filters.inStock || false}
            onChange={(e) => onFiltersChange({ inStock: e.target.checked })}
            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          <span className="text-sm font-medium">In Stock Only</span>
        </label>
      </div>

      {/* Active Filters */}
      {hasActiveFilters && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Active Filters:</p>
          <div className="flex flex-wrap gap-2">
            {filters.search && (
              <span className="badge badge-secondary flex items-center gap-1">
                Search: {filters.search}
                <button
                  onClick={() => onFiltersChange({ search: undefined })}
                  className="ml-1"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {filters.category && (
              <span className="badge badge-secondary flex items-center gap-1">
                Category: {categories.find(c => c.id === filters.category)?.name}
                <button
                  onClick={() => onFiltersChange({ category: undefined })}
                  className="ml-1"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {(filters.minPrice || filters.maxPrice) && (
              <span className="badge badge-secondary flex items-center gap-1">
                Price: ₩{filters.minPrice || 0} - ₩{filters.maxPrice || '∞'}
                <button
                  onClick={() => {
                    setPriceRange({ min: '', max: '' })
                    onFiltersChange({ minPrice: undefined, maxPrice: undefined })
                  }}
                  className="ml-1"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {filters.inStock && (
              <span className="badge badge-secondary flex items-center gap-1">
                In Stock
                <button
                  onClick={() => onFiltersChange({ inStock: false })}
                  className="ml-1"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}