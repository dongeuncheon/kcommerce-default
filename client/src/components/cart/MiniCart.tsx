import React, { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useCartStore } from '@/stores/cartStore'
import { ShoppingCart, X } from 'lucide-react'
import { CartItem } from '@/types'

export const MiniCart: React.FC = () => {
  const { cart, getItemCount } = useCartStore()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const itemCount = getItemCount()

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
    }).format(price)
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-700 hover:text-primary-600"
      >
        <ShoppingCart className="h-6 w-6" />
        {itemCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary-600 text-xs font-bold text-white">
            {itemCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 w-96 animate-slide-in">
          <div className="card shadow-lg">
            <div className="card-header flex items-center justify-between">
              <h3 className="font-semibold">Shopping Cart</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="card-content p-0">
              {!cart || cart.items.length === 0 ? (
                <div className="p-8 text-center">
                  <ShoppingCart className="mx-auto mb-4 h-12 w-12 text-gray-300" />
                  <p className="text-gray-600">Your cart is empty</p>
                  <Link
                    to="/products"
                    onClick={() => setIsOpen(false)}
                    className="btn-primary btn-sm mt-4"
                  >
                    Start Shopping
                  </Link>
                </div>
              ) : (
                <>
                  {/* Cart Items */}
                  <div className="max-h-96 overflow-y-auto p-4">
                    <div className="space-y-3">
                      {cart.items.slice(0, 5).map((item) => (
                        <MiniCartItem key={item.id} item={item} />
                      ))}
                      {cart.items.length > 5 && (
                        <p className="text-center text-sm text-gray-600">
                          And {cart.items.length - 5} more items...
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="border-t p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <span className="font-semibold">Total:</span>
                      <span className="text-xl font-bold text-primary-600">
                        {formatPrice(cart.total)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Link
                        to="/cart"
                        onClick={() => setIsOpen(false)}
                        className="btn-outline text-center"
                      >
                        View Cart
                      </Link>
                      <Link
                        to="/checkout"
                        onClick={() => setIsOpen(false)}
                        className="btn-primary text-center"
                      >
                        Checkout
                      </Link>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface MiniCartItemProps {
  item: CartItem
}

const MiniCartItem: React.FC<MiniCartItemProps> = ({ item }) => {
  const { removeItem } = useCartStore()
  const primaryImage = item.product.images?.find(img => img.isPrimary) || item.product.images?.[0]

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
    }).format(price)
  }

  return (
    <div className="flex gap-3">
      {/* Image */}
      <Link to={`/products/${item.product.slug}`} className="flex-shrink-0">
        <div className="h-16 w-16 overflow-hidden rounded bg-gray-100">
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
        <Link
          to={`/products/${item.product.slug}`}
          className="text-sm font-medium text-gray-900 hover:text-primary-600 line-clamp-1"
        >
          {item.product.name}
        </Link>
        <div className="mt-1 flex items-center justify-between">
          <span className="text-sm text-gray-600">
            {item.quantity} × {formatPrice(item.price)}
          </span>
          <span className="text-sm font-medium">
            {formatPrice(item.subtotal)}
          </span>
        </div>
      </div>

      {/* Remove button */}
      <button
        onClick={() => removeItem(item.id)}
        className="flex-shrink-0 text-gray-400 hover:text-red-600"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}