import React, { useState } from 'react'
import { Cart } from '@/types'
import { useCartStore } from '@/stores/cartStore'
import { Tag, Loader2 } from 'lucide-react'

interface CartSummaryProps {
  cart: Cart
  onCheckout: () => void
}

export const CartSummary: React.FC<CartSummaryProps> = ({ cart, onCheckout }) => {
  const { applyCoupon, removeCoupon } = useCartStore()
  const [couponCode, setCouponCode] = useState('')
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false)

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return
    
    setIsApplyingCoupon(true)
    await applyCoupon(couponCode.trim())
    setIsApplyingCoupon(false)
    setCouponCode('')
  }

  const handleRemoveCoupon = async () => {
    await removeCoupon()
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
    }).format(price)
  }

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title text-xl">Order Summary</h2>
      </div>
      
      <div className="card-content space-y-4">
        {/* Subtotal */}
        <div className="flex justify-between">
          <span className="text-gray-600">Subtotal</span>
          <span className="font-medium">{formatPrice(cart.subtotal)}</span>
        </div>

        {/* Shipping */}
        <div className="flex justify-between">
          <span className="text-gray-600">Shipping</span>
          <span className="font-medium">
            {cart.shipping === 0 ? 'Free' : formatPrice(cart.shipping)}
          </span>
        </div>

        {/* Tax */}
        {cart.tax > 0 && (
          <div className="flex justify-between">
            <span className="text-gray-600">Tax</span>
            <span className="font-medium">{formatPrice(cart.tax)}</span>
          </div>
        )}

        {/* Discount */}
        {cart.discount > 0 && (
          <div className="flex justify-between text-green-600">
            <span>Discount</span>
            <span>-{formatPrice(cart.discount)}</span>
          </div>
        )}

        {/* Coupon */}
        <div className="border-t pt-4">
          {cart.couponCode ? (
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-md">
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-800">
                  {cart.couponCode}
                </span>
              </div>
              <button
                onClick={handleRemoveCoupon}
                className="text-sm text-red-600 hover:text-red-700"
              >
                Remove
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  placeholder="Enter coupon code"
                  className="input flex-1"
                  disabled={isApplyingCoupon}
                />
                <button
                  onClick={handleApplyCoupon}
                  disabled={!couponCode.trim() || isApplyingCoupon}
                  className="btn-outline"
                >
                  {isApplyingCoupon ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Apply'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Total */}
        <div className="border-t pt-4">
          <div className="flex justify-between items-center">
            <span className="text-lg font-semibold">Total</span>
            <span className="text-2xl font-bold text-primary-600">
              {formatPrice(cart.total)}
            </span>
          </div>
          <p className="text-xs text-gray-600 mt-1">
            Including all taxes and fees
          </p>
        </div>

        {/* Checkout Button */}
        <button
          onClick={onCheckout}
          className="btn-primary w-full"
        >
          Proceed to Checkout
        </button>

        {/* Security Note */}
        <div className="text-center">
          <p className="text-xs text-gray-600">
            Secure checkout powered by
          </p>
          <div className="flex justify-center gap-2 mt-1">
            <span className="text-xs font-medium">SSL</span>
            <span className="text-xs font-medium">·</span>
            <span className="text-xs font-medium">PCI DSS</span>
          </div>
        </div>
      </div>
    </div>
  )
}