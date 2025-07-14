import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../../stores/authStore'

interface AdminGuardProps {
  children: React.ReactNode
  requiredRole?: 'ADMIN' | 'SUPER_ADMIN'
  requiredPermission?: string
}

export const AdminGuard: React.FC<AdminGuardProps> = ({
  children,
  requiredRole = 'ADMIN',
  requiredPermission,
}) => {
  const { user, isAuthenticated } = useAuthStore()
  const location = useLocation()

  // Check if user is authenticated
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Check if user has required role
  const hasRole = user.role === 'SUPER_ADMIN' || user.role === requiredRole

  if (!hasRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
              <svg
                className="h-6 w-6 text-red-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>
            <h3 className="mt-2 text-sm font-medium text-gray-900">Access Denied</h3>
            <p className="mt-1 text-sm text-gray-500">
              You don't have permission to access this page.
            </p>
            <div className="mt-6">
              <button
                onClick={() => window.history.back()}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // TODO: Check specific permissions if required
  if (requiredPermission) {
    // Implement permission checking logic here
    // For now, we'll assume all admin users have all permissions
  }

  return <>{children}</>
}