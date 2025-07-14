import React from 'react'
import { Link } from 'react-router-dom'
import { Product } from '@/types'
import { useCartStore } from '@/stores/cartStore'
import { ShoppingCart, Heart } from 'lucide-react'

interface ProductCardProps {
  product: Product
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const { addItem, getItem } = useCartStore()
  const cartItem = getItem(product.id)

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault()
    addItem(product.id)
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
    }).format(price)
  }

  const getDiscountPercentage = () => {
    if (!product.comparePrice || product.comparePrice <= product.price) return 0
    return Math.round(((product.comparePrice - product.price) / product.comparePrice) * 100)
  }

  const discountPercentage = getDiscountPercentage()
  const primaryImage = product.images?.find(img => img.isPrimary) || product.images?.[0]

  return (
    <Link to={`/products/${product.slug}`} className="group">
      <div className="card overflow-hidden transition-all duration-200 hover:shadow-lg">
        {/* Image */}
        <div className="relative aspect-square overflow-hidden bg-gray-100">
          {primaryImage ? (
            <img
              src={primaryImage.url}
              alt={primaryImage.alt || product.name}
              className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <span className="text-gray-400">No image</span>
            </div>
          )}
          
          {/* Badges */}
          <div className="absolute left-2 top-2 flex flex-col gap-1">
            {discountPercentage > 0 && (
              <span className="badge-primary text-xs">
                -{discountPercentage}%
              </span>
            )}
            {product.quantity <= product.lowStockThreshold && product.trackQuantity && (
              <span className="badge-secondary text-xs">
                Low Stock
              </span>
            )}
          </div>

          {/* Quick Actions */}
          <div className="absolute bottom-2 right-2 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              onClick={handleAddToCart}
              className="btn-primary btn-sm rounded-full p-2"
              disabled={product.trackQuantity && product.quantity === 0}
            >
              <ShoppingCart className="h-4 w-4" />
            </button>
            <button className="btn-secondary btn-sm rounded-full p-2">
              <Heart className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Category */}
          {product.category && (
            <p className="text-xs text-gray-500 mb-1">
              {product.category.name}
            </p>
          )}

          {/* Title */}
          <h3 className="font-medium text-gray-900 line-clamp-2 mb-2">
            {product.name}
          </h3>

          {/* Description */}
          {product.shortDescription && (
            <p className="text-sm text-gray-600 line-clamp-2 mb-3">
              {product.shortDescription}
            </p>
          )}

          {/* Price */}
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-semibold text-gray-900">
              {formatPrice(product.price)}
            </span>
            {product.comparePrice && product.comparePrice > product.price && (
              <span className="text-sm text-gray-500 line-through">
                {formatPrice(product.comparePrice)}
              </span>
            )}
          </div>

          {/* Stock Status */}
          {product.trackQuantity && (
            <p className="mt-2 text-sm">
              {product.quantity === 0 ? (
                <span className="text-red-600">Out of stock</span>
              ) : product.quantity <= product.lowStockThreshold ? (
                <span className="text-yellow-600">
                  Only {product.quantity} left in stock
                </span>
              ) : (
                <span className="text-green-600">In stock</span>
              )}
            </p>
          )}

          {/* Cart Status */}
          {cartItem && (
            <p className="mt-2 text-sm text-primary-600">
              {cartItem.quantity} in cart
            </p>
          )}
        </div>
      </div>
    </Link>
  )
}