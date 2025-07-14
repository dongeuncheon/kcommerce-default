import React, { useState } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  BarChart3,
  Settings,
  Menu,
  X,
  ChevronDown,
  LogOut,
  User,
  Bell,
  Search,
} from 'lucide-react'
import { useAuthStore } from '../../../stores/authStore'
import { AdminRoute } from '../../../types/admin'
import { NotificationCenter } from '../common/NotificationCenter'

const adminRoutes: AdminRoute[] = [
  {
    path: '/admin',
    label: 'Dashboard',
    icon: 'LayoutDashboard',
  },
  {
    path: '/admin/products',
    label: 'Products',
    icon: 'Package',
    children: [
      { path: '/admin/products', label: 'All Products', icon: 'Package' },
      { path: '/admin/products/new', label: 'Add Product', icon: 'Plus' },
      { path: '/admin/categories', label: 'Categories', icon: 'Folder' },
      { path: '/admin/inventory', label: 'Inventory', icon: 'Archive' },
    ],
  },
  {
    path: '/admin/orders',
    label: 'Orders',
    icon: 'ShoppingCart',
  },
  {
    path: '/admin/customers',
    label: 'Customers',
    icon: 'Users',
  },
  {
    path: '/admin/analytics',
    label: 'Analytics',
    icon: 'BarChart3',
    children: [
      { path: '/admin/analytics/sales', label: 'Sales Report', icon: 'TrendingUp' },
      { path: '/admin/analytics/products', label: 'Product Performance', icon: 'Package' },
      { path: '/admin/analytics/customers', label: 'Customer Insights', icon: 'Users' },
    ],
  },
  {
    path: '/admin/settings',
    label: 'Settings',
    icon: 'Settings',
    children: [
      { path: '/admin/settings/general', label: 'General', icon: 'Settings' },
      { path: '/admin/settings/checkout', label: 'Checkout', icon: 'CreditCard' },
      { path: '/admin/settings/shipping', label: 'Shipping', icon: 'Truck' },
      { path: '/admin/settings/tax', label: 'Tax', icon: 'Receipt' },
      { path: '/admin/settings/email', label: 'Email', icon: 'Mail' },
      { path: '/admin/settings/users', label: 'Users & Roles', icon: 'Users' },
    ],
  },
]

const iconMap: { [key: string]: React.ComponentType<any> } = {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  BarChart3,
  Settings,
}

export const AdminLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [expandedMenus, setExpandedMenus] = useState<string[]>([])
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()

  const toggleMenu = (path: string) => {
    setExpandedMenus(prev =>
      prev.includes(path)
        ? prev.filter(p => p !== path)
        : [...prev, path]
    )
  }

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const renderMenuItem = (route: AdminRoute, depth = 0) => {
    const Icon = iconMap[route.icon] || Package
    const isActive = location.pathname === route.path
    const isExpanded = expandedMenus.includes(route.path)
    const hasChildren = route.children && route.children.length > 0

    return (
      <li key={route.path}>
        <div
          className={`
            flex items-center justify-between px-4 py-2 text-sm font-medium rounded-md cursor-pointer
            ${depth > 0 ? 'ml-8' : ''}
            ${isActive
              ? 'bg-indigo-100 text-indigo-700'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }
          `}
          onClick={() => {
            if (hasChildren) {
              toggleMenu(route.path)
            } else {
              navigate(route.path)
              setMobileMenuOpen(false)
            }
          }}
        >
          <div className="flex items-center">
            <Icon className="w-5 h-5 mr-3" />
            {sidebarOpen && <span>{route.label}</span>}
          </div>
          {sidebarOpen && hasChildren && (
            <ChevronDown
              className={`w-4 h-4 transition-transform ${
                isExpanded ? 'transform rotate-180' : ''
              }`}
            />
          )}
        </div>
        {sidebarOpen && hasChildren && isExpanded && (
          <ul className="mt-1 space-y-1">
            {route.children.map(child => renderMenuItem(child, depth + 1))}
          </ul>
        )}
      </li>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-md bg-white shadow-md"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 z-40 h-full bg-white shadow-lg transition-all duration-300
          ${sidebarOpen ? 'w-64' : 'w-16'}
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-4 py-6 border-b">
          {sidebarOpen && (
            <h2 className="text-xl font-bold text-gray-800">Admin Panel</h2>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="hidden lg:block p-1 rounded hover:bg-gray-100"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="mt-6">
          <ul className="space-y-1 px-2">
            {adminRoutes.map(route => renderMenuItem(route))}
          </ul>
        </nav>
      </aside>

      {/* Main content */}
      <div className={`transition-all duration-300 ${sidebarOpen ? 'lg:ml-64' : 'lg:ml-16'}`}>
        {/* Top bar */}
        <header className="bg-white shadow-sm border-b">
          <div className="flex items-center justify-between px-6 py-4">
            {/* Search */}
            <div className="flex-1 max-w-lg">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Right side */}
            <div className="flex items-center space-x-4">
              {/* Notifications */}
              <NotificationCenter />

              {/* User menu */}
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-100"
                >
                  <div className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <div className="hidden md:block text-left">
                    <p className="text-sm font-medium">{user?.firstName || 'Admin'}</p>
                    <p className="text-xs text-gray-500">{user?.email}</p>
                  </div>
                  <ChevronDown className="w-4 h-4" />
                </button>
                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border">
                    <Link
                      to="/admin/profile"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <User className="w-4 h-4 inline mr-2" />
                      Profile
                    </Link>
                    <Link
                      to="/admin/settings"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <Settings className="w-4 h-4 inline mr-2" />
                      Settings
                    </Link>
                    <hr className="my-1" />
                    <button
                      onClick={handleLogout}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <LogOut className="w-4 h-4 inline mr-2" />
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-6">
          <Outlet />
        </main>
      </div>

      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
    </div>
  )
}