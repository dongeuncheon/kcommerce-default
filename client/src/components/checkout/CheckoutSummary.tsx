import React from 'react'
import { Cart } from '@/types'
import { Package } from 'lucide-react'

interface CheckoutSummaryProps {
  cart: Cart
}

export const CheckoutSummary: React.FC<CheckoutSummaryProps> = ({ cart }) => {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
    }).format(price)
  }

  return (
    <div className="card sticky top-4">
      <div className="card-header">
        <h2 className="card-title flex items-center gap-2">
          <Package className="h-5 w-5" />
          Order Summary
        </h2>
      </div>
      
      <div className="card-content space-y-4">
        {/* Items */}
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {cart.items.map((item) => {
            const primaryImage = item.product.images?.find(img => img.isPrimary) || item.product.images?.[0]
            
            return (
              <div key={item.id} className="flex gap-3">
                {/* Image */}
                <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded bg-gray-100">
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

                {/* Content */}
                <div className="flex-1">
                  <h4 className="text-sm font-medium line-clamp-1">
                    {item.product.name}
                  </h4>
                  <p className="text-sm text-gray-600">
                    {item.quantity} × {formatPrice(item.price)}
                  </p>
                </div>

                {/* Price */}
                <div className="text-right">
                  <p className="text-sm font-medium">
                    {formatPrice(item.subtotal)}
                  </p>
                </div>
              </div>
            )
          })}
        </div>

        <div className="border-t pt-4 space-y-2">
          {/* Subtotal */}
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Subtotal</span>
            <span>{formatPrice(cart.subtotal)}</span>
          </div>

          {/* Shipping */}
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Shipping</span>
            <span>
              {cart.shipping === 0 ? 'Free' : formatPrice(cart.shipping)}
            </span>
          </div>

          {/* Tax */}
          {cart.tax > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Tax</span>
              <span>{formatPrice(cart.tax)}</span>
            </div>
          )}

          {/* Discount */}
          {cart.discount > 0 && (
            <div className="flex justify-between text-sm text-green-600">
              <span>Discount</span>
              <span>-{formatPrice(cart.discount)}</span>
            </div>
          )}

          {/* Coupon */}
          {cart.couponCode && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">
                Coupon ({cart.couponCode})
              </span>
              <span className="text-green-600">Applied</span>
            </div>
          )}

          {/* Total */}
          <div className="border-t pt-2">
            <div className="flex justify-between items-center">
              <span className="font-semibold">Total</span>
              <span className="text-xl font-bold text-primary-600">
                {formatPrice(cart.total)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}