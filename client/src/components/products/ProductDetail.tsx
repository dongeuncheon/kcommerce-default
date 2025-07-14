import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from 'react-query'
import { productService } from '@/services/productService'
import { useCartStore } from '@/stores/cartStore'
import { 
  ShoppingCart, 
  Heart, 
  Share2, 
  Check, 
  Truck, 
  Shield, 
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus
} from 'lucide-react'
import { ProductCard } from './ProductCard'

export const ProductDetail: React.FC = () => {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { addItem, getItem } = useCartStore()
  const [quantity, setQuantity] = useState(1)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)

  const { data, isLoading, error } = useQuery(
    ['product', slug],
    () => productService.getProductBySlug(slug!),
    {
      enabled: !!slug,
    }
  )

  const { data: relatedData } = useQuery(
    ['related-products', data?.data?.id],
    () => productService.getRelatedProducts(data?.data?.id!),
    {
      enabled: !!data?.data?.id,
    }
  )

  if (isLoading) {
    return <ProductDetailSkeleton />
  }

  if (error || !data?.data) {
    return (
      <div className="container py-12 text-center">
        <p className="text-red-600 mb-4">Product not found</p>
        <button onClick={() => navigate('/products')} className="btn-primary">
          Back to Products
        </button>
      </div>
    )
  }

  const product = data.data
  const relatedProducts = relatedData?.data || []
  const cartItem = getItem(product.id)
  const isInStock = !product.trackQuantity || product.quantity > 0
  const maxQuantity = product.trackQuantity ? product.quantity : 99

  const handleAddToCart = () => {
    addItem(product.id, quantity)
  }

  const handleQuantityChange = (value: number) => {
    if (value >= 1 && value <= maxQuantity) {
      setQuantity(value)
    }
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

  return (
    <div className="container py-8">
      {/* Breadcrumb */}
      <nav className="mb-8">
        <ol className="flex items-center space-x-2 text-sm text-gray-600">
          <li>
            <button onClick={() => navigate('/')} className="hover:text-primary-600">
              Home
            </button>
          </li>
          <li>/</li>
          <li>
            <button onClick={() => navigate('/products')} className="hover:text-primary-600">
              Products
            </button>
          </li>
          {product.category && (
            <>
              <li>/</li>
              <li>
                <button 
                  onClick={() => navigate(`/products?category=${product.category.id}`)} 
                  className="hover:text-primary-600"
                >
                  {product.category.name}
                </button>
              </li>
            </>
          )}
          <li>/</li>
          <li className="text-gray-900">{product.name}</li>
        </ol>
      </nav>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Images */}
        <div className="space-y-4">
          {/* Main Image */}
          <div className="relative aspect-square overflow-hidden rounded-lg bg-gray-100">
            {product.images && product.images.length > 0 ? (
              <>
                <img
                  src={product.images[selectedImageIndex].url}
                  alt={product.images[selectedImageIndex].alt || product.name}
                  className="h-full w-full object-cover"
                />
                {product.images.length > 1 && (
                  <>
                    <button
                      onClick={() => setSelectedImageIndex(prev => 
                        prev === 0 ? product.images.length - 1 : prev - 1
                      )}
                      className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-2 shadow-md hover:bg-white"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => setSelectedImageIndex(prev => 
                        prev === product.images.length - 1 ? 0 : prev + 1
                      )}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-2 shadow-md hover:bg-white"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </>
                )}
              </>
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <span className="text-gray-400">No image available</span>
              </div>
            )}
          </div>

          {/* Thumbnails */}
          {product.images && product.images.length > 1 && (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {product.images.map((image, index) => (
                <button
                  key={image.id}
                  onClick={() => setSelectedImageIndex(index)}
                  className={`relative aspect-square overflow-hidden rounded-md border-2 ${
                    index === selectedImageIndex ? 'border-primary-500' : 'border-gray-200'
                  }`}
                >
                  <img
                    src={image.url}
                    alt={image.alt || `${product.name} ${index + 1}`}
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="space-y-6">
          {/* Title & Category */}
          <div>
            {product.category && (
              <p className="text-sm text-gray-600 mb-2">{product.category.name}</p>
            )}
            <h1 className="text-3xl font-bold text-gray-900">{product.name}</h1>
          </div>

          {/* Price */}
          <div className="space-y-2">
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-bold text-gray-900">
                {formatPrice(product.price)}
              </span>
              {product.comparePrice && product.comparePrice > product.price && (
                <>
                  <span className="text-xl text-gray-500 line-through">
                    {formatPrice(product.comparePrice)}
                  </span>
                  <span className="badge-primary">
                    {discountPercentage}% OFF
                  </span>
                </>
              )}
            </div>
            <p className="text-sm text-gray-600">
              SKU: {product.sku}
            </p>
          </div>

          {/* Description */}
          {product.description && (
            <div className="prose prose-sm max-w-none">
              <p>{product.description}</p>
            </div>
          )}

          {/* Stock Status */}
          {product.trackQuantity && (
            <div className="flex items-center gap-2">
              {isInStock ? (
                <>
                  <Check className="h-5 w-5 text-green-600" />
                  <span className="text-green-600">
                    {product.quantity > 10 
                      ? 'In Stock' 
                      : `Only ${product.quantity} left in stock`}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-red-600">Out of Stock</span>
                </>
              )}
            </div>
          )}

          {/* Quantity & Add to Cart */}
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium">Quantity:</label>
              <div className="flex items-center">
                <button
                  onClick={() => handleQuantityChange(quantity - 1)}
                  disabled={quantity <= 1}
                  className="btn-outline h-10 w-10 rounded-r-none"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => handleQuantityChange(Number(e.target.value))}
                  className="input h-10 w-16 rounded-none text-center"
                  min="1"
                  max={maxQuantity}
                />
                <button
                  onClick={() => handleQuantityChange(quantity + 1)}
                  disabled={quantity >= maxQuantity}
                  className="btn-outline h-10 w-10 rounded-l-none"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleAddToCart}
                disabled={!isInStock}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                <ShoppingCart className="h-5 w-5" />
                Add to Cart
              </button>
              <button className="btn-outline">
                <Heart className="h-5 w-5" />
              </button>
              <button className="btn-outline">
                <Share2 className="h-5 w-5" />
              </button>
            </div>

            {cartItem && (
              <p className="text-sm text-primary-600">
                You have {cartItem.quantity} of this item in your cart
              </p>
            )}
          </div>

          {/* Features */}
          <div className="border-t pt-6 space-y-3">
            <div className="flex items-center gap-3">
              <Truck className="h-5 w-5 text-gray-600" />
              <span className="text-sm">Free shipping on orders over ₩50,000</span>
            </div>
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-gray-600" />
              <span className="text-sm">Secure payment guaranteed</span>
            </div>
            <div className="flex items-center gap-3">
              <RefreshCw className="h-5 w-5 text-gray-600" />
              <span className="text-sm">30-day return policy</span>
            </div>
          </div>
        </div>
      </div>

      {/* Related Products */}
      {relatedProducts.length > 0 && (
        <div className="mt-16">
          <h2 className="text-2xl font-bold mb-8">You May Also Like</h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {relatedProducts.slice(0, 4).map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const ProductDetailSkeleton: React.FC = () => {
  return (
    <div className="container py-8">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="aspect-square bg-gray-200 rounded-lg animate-pulse" />
          <div className="grid grid-cols-4 gap-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="aspect-square bg-gray-200 rounded animate-pulse" />
            ))}
          </div>
        </div>
        <div className="space-y-6">
          <div className="space-y-2">
            <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
            <div className="h-8 w-3/4 bg-gray-200 rounded animate-pulse" />
          </div>
          <div className="h-10 w-40 bg-gray-200 rounded animate-pulse" />
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-3/4 bg-gray-200 rounded animate-pulse" />
          </div>
          <div className="h-12 bg-gray-200 rounded animate-pulse" />
        </div>
      </div>
    </div>
  )
}