import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCartStore } from '@/stores/cartStore'
import { CartItem } from './CartItem'
import { CartSummary } from './CartSummary'
import { EmptyCart } from './EmptyCart'
import { ShoppingBag, ArrowLeft, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

export const Cart: React.FC = () => {
  const navigate = useNavigate()
  const { cart, isLoading, fetchCart, clearCart } = useCartStore()
  const [isClearing, setIsClearing] = useState(false)

  useEffect(() => {
    fetchCart()
  }, [fetchCart])

  const handleClearCart = async () => {
    if (!cart || cart.items.length === 0) return
    
    if (window.confirm('Are you sure you want to clear your cart?')) {
      setIsClearing(true)
      await clearCart()
      setIsClearing(false)
    }
  }

  const handleCheckout = () => {
    if (!cart || cart.items.length === 0) {
      toast.error('Your cart is empty')
      return
    }

    // Check if any items are out of stock
    const outOfStockItems = cart.items.filter(item => 
      item.product.trackQuantity && item.product.quantity === 0
    )

    if (outOfStockItems.length > 0) {
      toast.error('Please remove out of stock items before checkout')
      return
    }

    navigate('/checkout')
  }

  if (isLoading && !cart) {
    return <CartSkeleton />
  }

  if (!cart || cart.items.length === 0) {
    return <EmptyCart />
  }

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <ShoppingBag className="h-8 w-8" />
          Shopping Cart
          <span className="text-gray-600 text-lg font-normal">
            ({cart.items.length} {cart.items.length === 1 ? 'item' : 'items'})
          </span>
        </h1>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Cart Items */}
        <div className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <Link
              to="/products"
              className="flex items-center gap-2 text-primary-600 hover:text-primary-700"
            >
              <ArrowLeft className="h-4 w-4" />
              Continue Shopping
            </Link>
            
            <button
              onClick={handleClearCart}
              disabled={isClearing}
              className="text-sm text-red-600 hover:text-red-700"
            >
              {isClearing ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Clearing...
                </span>
              ) : (
                'Clear Cart'
              )}
            </button>
          </div>

          <div className="space-y-4">
            {cart.items.map((item) => (
              <CartItem key={item.id} item={item} />
            ))}
          </div>
        </div>

        {/* Cart Summary */}
        <div className="lg:col-span-1">
          <div className="sticky top-4">
            <CartSummary cart={cart} onCheckout={handleCheckout} />
          </div>
        </div>
      </div>
    </div>
  )
}

const CartSkeleton: React.FC = () => {
  return (
    <div className="container py-8">
      <div className="mb-8">
        <div className="h-10 w-64 bg-gray-200 rounded animate-pulse" />
      </div>
      
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="card p-4">
              <div className="flex gap-4">
                <div className="h-24 w-24 bg-gray-200 rounded animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-5 w-3/4 bg-gray-200 rounded animate-pulse" />
                  <div className="h-4 w-1/4 bg-gray-200 rounded animate-pulse" />
                  <div className="h-8 w-32 bg-gray-200 rounded animate-pulse mt-4" />
                </div>
              </div>
            </div>
          ))}
        </div>
        
        <div className="lg:col-span-1">
          <div className="card p-6 space-y-4">
            <div className="h-6 w-32 bg-gray-200 rounded animate-pulse" />
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex justify-between">
                  <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
                  <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
                </div>
              ))}
            </div>
            <div className="h-12 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  )
}