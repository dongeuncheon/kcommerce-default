import React from 'react'
import { Link } from 'react-router-dom'
import { ShoppingCart } from 'lucide-react'

export const EmptyCart: React.FC = () => {
  return (
    <div className="container py-16">
      <div className="mx-auto max-w-md text-center">
        <div className="mb-6 flex justify-center">
          <div className="rounded-full bg-gray-100 p-6">
            <ShoppingCart className="h-12 w-12 text-gray-400" />
          </div>
        </div>
        
        <h1 className="mb-2 text-2xl font-bold text-gray-900">
          Your cart is empty
        </h1>
        
        <p className="mb-8 text-gray-600">
          Looks like you haven't added anything to your cart yet.
        </p>
        
        <Link to="/products" className="btn-primary">
          Start Shopping
        </Link>
        
        <div className="mt-8 space-y-2">
          <h2 className="text-lg font-semibold">Need help?</h2>
          <p className="text-sm text-gray-600">
            Check out our{' '}
            <Link to="/help" className="text-primary-600 hover:underline">
              help center
            </Link>{' '}
            or contact our{' '}
            <Link to="/support" className="text-primary-600 hover:underline">
              customer support
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}