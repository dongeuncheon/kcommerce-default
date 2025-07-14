import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from 'react-query'
import { Toaster } from 'react-hot-toast'
import { Layout } from './components/layout/Layout'
import { AdminLayout } from './components/admin/layout/AdminLayout'
import { AdminGuard } from './components/admin/common/AdminGuard'
import { HomePage } from './pages/HomePage'
import { ProductsPage } from './pages/ProductsPage'
import { ProductDetailPage } from './pages/ProductDetailPage'
import { CartPage } from './pages/CartPage'
import { CheckoutPage } from './pages/CheckoutPage'
import { SearchPage } from './pages/SearchPage'
import { NotFoundPage } from './pages/NotFoundPage'
import LoginPage from './pages/LoginPage'
// Admin pages
import AdminDashboardPage from './pages/AdminDashboardPage'
import { ProductsPage as AdminProductsPage } from './pages/admin/ProductsPage'
import { OrdersPage } from './pages/admin/OrdersPage'
import { CustomersPage } from './pages/admin/CustomersPage'
import { AnalyticsPage } from './pages/admin/AnalyticsPage'
import { InventoryPage } from './pages/admin/InventoryPage'
import { SettingsPage } from './pages/admin/SettingsPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<Layout><HomePage /></Layout>} />
          <Route path="/products" element={<Layout><ProductsPage /></Layout>} />
          <Route path="/products/:slug" element={<Layout><ProductDetailPage /></Layout>} />
          <Route path="/cart" element={<Layout><CartPage /></Layout>} />
          <Route path="/checkout" element={<Layout><CheckoutPage /></Layout>} />
          <Route path="/search" element={<Layout><SearchPage /></Layout>} />
          <Route path="/login" element={<LoginPage />} />
          
          {/* Admin routes */}
          <Route path="/admin" element={
            <AdminGuard requiredRole="ADMIN">
              <AdminLayout />
            </AdminGuard>
          }>
            <Route index element={<AdminDashboardPage />} />
            <Route path="dashboard" element={<AdminDashboardPage />} />
            <Route path="products" element={<AdminProductsPage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="customers" element={<CustomersPage />} />
            <Route path="inventory" element={<InventoryPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="analytics/sales" element={<AnalyticsPage />} />
            <Route path="analytics/products" element={<AnalyticsPage />} />
            <Route path="analytics/customers" element={<AnalyticsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="settings/general" element={<SettingsPage />} />
            <Route path="settings/checkout" element={<SettingsPage />} />
            <Route path="settings/shipping" element={<SettingsPage />} />
            <Route path="settings/tax" element={<SettingsPage />} />
            <Route path="settings/email" element={<SettingsPage />} />
            <Route path="settings/users" element={<SettingsPage />} />
          </Route>
          
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#363636',
              color: '#fff',
            },
            success: {
              style: {
                background: '#10b981',
              },
            },
            error: {
              style: {
                background: '#ef4444',
              },
            },
          }}
        />
      </Router>
    </QueryClientProvider>
  )
}

export default App