import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { MiniCart } from '../cart/MiniCart'
import { SearchBar } from '../search/SearchBar'
import { Search, User, Menu, X } from 'lucide-react'

export const Header: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen)
  }

  return (
    <header className="sticky top-0 z-40 bg-white border-b">
      {/* Top Bar */}
      <div className="bg-gray-900 text-white text-sm">
        <div className="container py-2">
          <div className="flex items-center justify-between">
            <span>Free shipping on orders over ₩50,000</span>
            <div className="flex items-center gap-4">
              <Link to="/help" className="hover:text-gray-300">Help</Link>
              <Link to="/track" className="hover:text-gray-300">Track Order</Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Header */}
      <div className="container">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="text-2xl font-bold text-primary-600">
            Commerce
          </Link>

          {/* Search Bar - Desktop */}
          <div className="hidden md:block flex-1 max-w-xl mx-8">
            <SearchBar />
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            <Link to="/products" className="font-medium hover:text-primary-600">
              Products
            </Link>
            <Link to="/categories" className="font-medium hover:text-primary-600">
              Categories
            </Link>
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-4">
            {/* Mobile Search Toggle */}
            <button
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              className="md:hidden p-2 hover:text-primary-600"
            >
              <Search className="h-5 w-5" />
            </button>

            {/* Account */}
            <Link to="/account" className="p-2 hover:text-primary-600">
              <User className="h-5 w-5" />
            </Link>

            {/* Cart */}
            <MiniCart />

            {/* Mobile Menu Toggle */}
            <button
              onClick={toggleMobileMenu}
              className="md:hidden p-2 hover:text-primary-600"
            >
              {isMobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Search Bar */}
        {isSearchOpen && (
          <div className="md:hidden py-4 border-t animate-slide-in">
            <SearchBar />
          </div>
        )}
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t bg-white animate-slide-in">
          <nav className="container py-4">
            <ul className="space-y-2">
              <li>
                <Link
                  to="/products"
                  className="block py-2 font-medium hover:text-primary-600"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Products
                </Link>
              </li>
              <li>
                <Link
                  to="/categories"
                  className="block py-2 font-medium hover:text-primary-600"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Categories
                </Link>
              </li>
              <li>
                <Link
                  to="/deals"
                  className="block py-2 font-medium hover:text-primary-600"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Deals
                </Link>
              </li>
              <li>
                <Link
                  to="/about"
                  className="block py-2 font-medium hover:text-primary-600"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  About
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      )}
    </header>
  )
}