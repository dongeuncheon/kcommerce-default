import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from 'react-query'
import { Product, FilterOptions } from '@/types'
import { productService } from '@/services/productService'
import { ProductCard } from './ProductCard'
import { ProductFilters } from './ProductFilters'
import { ProductSkeleton } from './ProductSkeleton'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export const ProductList: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const [filters, setFilters] = useState<FilterOptions>({
    search: searchParams.get('search') || undefined,
    category: searchParams.get('category') || undefined,
    minPrice: searchParams.get('minPrice') ? Number(searchParams.get('minPrice')) : undefined,
    maxPrice: searchParams.get('maxPrice') ? Number(searchParams.get('maxPrice')) : undefined,
    inStock: searchParams.get('inStock') === 'true',
    sortBy: (searchParams.get('sortBy') as any) || 'createdAt',
    sortOrder: (searchParams.get('sortOrder') as any) || 'desc',
    page: Number(searchParams.get('page')) || 1,
    limit: Number(searchParams.get('limit')) || 12,
  })

  const { data, isLoading, error } = useQuery(
    ['products', filters],
    () => productService.getProducts(filters),
    {
      keepPreviousData: true,
    }
  )

  useEffect(() => {
    // Update URL params when filters change
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.set(key, value.toString())
      }
    })
    setSearchParams(params)
  }, [filters, setSearchParams])

  const handleFilterChange = (newFilters: Partial<FilterOptions>) => {
    setFilters(prev => ({ ...prev, ...newFilters, page: 1 }))
  }

  const handlePageChange = (page: number) => {
    setFilters(prev => ({ ...prev, page }))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Failed to load products</p>
      </div>
    )
  }

  const products = data?.data || []
  const pagination = data?.pagination
  const totalPages = pagination?.totalPages || 1
  const currentPage = pagination?.page || 1

  return (
    <div className="container py-8">
      <div className="lg:grid lg:grid-cols-4 lg:gap-8">
        {/* Filters */}
        <div className="mb-8 lg:mb-0">
          <ProductFilters
            filters={filters}
            onFiltersChange={handleFilterChange}
          />
        </div>

        {/* Products */}
        <div className="lg:col-span-3">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-2xl font-bold">Products</h1>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">
                {pagination?.total || 0} products found
              </span>
              <select
                value={filters.sortBy}
                onChange={(e) => handleFilterChange({ sortBy: e.target.value as any })}
                className="input input-sm"
              >
                <option value="createdAt">Newest</option>
                <option value="name">Name</option>
                <option value="price">Price</option>
              </select>
              <select
                value={filters.sortOrder}
                onChange={(e) => handleFilterChange({ sortOrder: e.target.value as any })}
                className="input input-sm"
              >
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
            </div>
          </div>

          {/* Product Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[...Array(12)].map((_, index) => (
                <ProductSkeleton key={index} />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600">No products found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="btn-outline btn-sm"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              {[...Array(totalPages)].map((_, index) => {
                const page = index + 1
                if (
                  page === 1 ||
                  page === totalPages ||
                  (page >= currentPage - 2 && page <= currentPage + 2)
                ) {
                  return (
                    <button
                      key={page}
                      onClick={() => handlePageChange(page)}
                      className={`btn-sm ${
                        page === currentPage ? 'btn-primary' : 'btn-outline'
                      }`}
                    >
                      {page}
                    </button>
                  )
                } else if (
                  page === currentPage - 3 ||
                  page === currentPage + 3
                ) {
                  return <span key={page}>...</span>
                }
                return null
              })}

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="btn-outline btn-sm"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}