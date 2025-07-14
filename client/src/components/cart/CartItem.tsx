import React from 'react'
import { Link } from 'react-router-dom'
import { CartItem as CartItemType } from '@/types'
import { useCartStore } from '@/stores/cartStore'
import { Minus, Plus, X, Loader2 } from 'lucide-react'

interface CartItemProps {
  item: CartItemType
}

export const CartItem: React.FC<CartItemProps> = ({ item }) => {
  const { updateItem, removeItem } = useCartStore()
  const [isUpdating, setIsUpdating] = React.useState(false)
  const [isRemoving, setIsRemoving] = React.useState(false)

  const handleQuantityChange = async (quantity: number) => {
    if (quantity < 1 || isUpdating) return
    
    setIsUpdating(true)
    await updateItem(item.id, quantity)
    setIsUpdating(false)
  }

  const handleRemove = async () => {
    if (isRemoving) return
    
    setIsRemoving(true)
    await removeItem(item.id)
    setIsRemoving(false)
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
    }).format(price)
  }

  const primaryImage = item.product.images?.find(img => img.isPrimary) || item.product.images?.[0]
  const maxQuantity = item.product.trackQuantity ? item.product.quantity : 99
  const isOutOfStock = item.product.trackQuantity && item.product.quantity === 0
  const isLowStock = item.product.trackQuantity && 
    item.product.quantity > 0 && 
    item.product.quantity < item.quantity

  return (
    <div className={`card p-4 ${isOutOfStock ? 'opacity-60' : ''}`}>
      <div className="flex gap-4">
        {/* Image */}
        <Link 
          to={`/products/${item.product.slug}`}
          className="flex-shrink-0"
        >
          <div className="h-24 w-24 overflow-hidden rounded-md bg-gray-100">
            {primaryImage ? (
              <img
                src={primaryImage.url}
                alt={primaryImage.alt || item.product.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <span className="text-xs text-gray-400">No image</span>
              </div>
            )}
          </div>
        </Link>

        {/* Content */}
        <div className="flex flex-1 flex-col">
          <div className="flex justify-between">
            <div className="flex-1">
              <Link 
                to={`/products/${item.product.slug}`}
                className="font-medium text-gray-900 hover:text-primary-600"
              >
                {item.product.name}
              </Link>
              <p className="text-sm text-gray-600 mt-1">
                {formatPrice(item.price)} each
              </p>
              
              {/* Stock warnings */}
              {isOutOfStock && (
                <p className="text-sm text-red-600 mt-1">Out of stock</p>
              )}
              {isLowStock && (
                <p className="text-sm text-yellow-600 mt-1">
                  Only {item.product.quantity} left in stock
                </p>
              )}
            </div>

            {/* Remove button */}
            <button
              onClick={handleRemove}
              disabled={isRemoving}
              className="ml-4 text-gray-400 hover:text-red-600"
            >
              {isRemoving ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <X className="h-5 w-5" />
              )}
            </button>
          </div>

          <div className="mt-4 flex items-center justify-between">
            {/* Quantity selector */}
            <div className="flex items-center">
              <button
                onClick={() => handleQuantityChange(item.quantity - 1)}
                disabled={item.quantity <= 1 || isUpdating || isOutOfStock}
                className="btn-outline h-8 w-8 p-0"
              >
                <Minus className="h-4 w-4" />
              </button>
              
              <input
                type="number"
                value={item.quantity}
                onChange={(e) => {
                  const value = Number(e.target.value)
                  if (value > 0 && value <= maxQuantity) {
                    handleQuantityChange(value)
                  }
                }}
                disabled={isUpdating || isOutOfStock}
                className="input mx-2 h-8 w-16 text-center"
                min="1"
                max={maxQuantity}
              />
              
              <button
                onClick={() => handleQuantityChange(item.quantity + 1)}
                disabled={item.quantity >= maxQuantity || isUpdating || isOutOfStock}
                className="btn-outline h-8 w-8 p-0"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            {/* Subtotal */}
            <div className="text-right">
              <p className="text-sm text-gray-600">Subtotal</p>
              <p className="font-semibold text-gray-900">
                {formatPrice(item.subtotal)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}