import React from 'react'
import { Link } from 'react-router-dom'
import { Home, Search } from 'lucide-react'

export const NotFoundPage: React.FC = () => {
  return (
    <div className="container py-20">
      <div className="max-w-2xl mx-auto text-center">
        <h1 className="text-9xl font-bold text-gray-200 mb-4">404</h1>
        <h2 className="text-3xl font-bold text-gray-900 mb-4">
          Page Not Found
        </h2>
        <p className="text-lg text-gray-600 mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/" className="btn-primary flex items-center justify-center gap-2">
            <Home className="h-5 w-5" />
            Back to Home
          </Link>
          <Link to="/products" className="btn-outline flex items-center justify-center gap-2">
            <Search className="h-5 w-5" />
            Browse Products
          </Link>
        </div>
        
        <div className="mt-12 p-6 bg-gray-50 rounded-lg">
          <h3 className="font-semibold mb-2">Looking for something specific?</h3>
          <p className="text-sm text-gray-600 mb-4">
            Try searching for it or check out our popular categories:
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            <Link to="/products?category=electronics" className="text-sm text-primary-600 hover:underline">
              Electronics
            </Link>
            <span className="text-gray-400">•</span>
            <Link to="/products?category=fashion" className="text-sm text-primary-600 hover:underline">
              Fashion
            </Link>
            <span className="text-gray-400">•</span>
            <Link to="/products?category=home" className="text-sm text-primary-600 hover:underline">
              Home & Garden
            </Link>
            <span className="text-gray-400">•</span>
            <Link to="/products?category=sports" className="text-sm text-primary-600 hover:underline">
              Sports
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}