import React from 'react'

export const ProductSkeleton: React.FC = () => {
  return (
    <div className="card overflow-hidden">
      {/* Image skeleton */}
      <div className="aspect-square bg-gray-200 animate-pulse" />
      
      {/* Content skeleton */}
      <div className="p-4 space-y-3">
        {/* Category */}
        <div className="h-3 w-20 bg-gray-200 rounded animate-pulse" />
        
        {/* Title */}
        <div className="space-y-2">
          <div className="h-4 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-3/4 bg-gray-200 rounded animate-pulse" />
        </div>
        
        {/* Description */}
        <div className="space-y-2">
          <div className="h-3 bg-gray-200 rounded animate-pulse" />
          <div className="h-3 w-5/6 bg-gray-200 rounded animate-pulse" />
        </div>
        
        {/* Price */}
        <div className="flex items-baseline gap-2">
          <div className="h-5 w-24 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-16 bg-gray-200 rounded animate-pulse" />
        </div>
        
        {/* Stock status */}
        <div className="h-3 w-20 bg-gray-200 rounded animate-pulse" />
      </div>
    </div>
  )
}