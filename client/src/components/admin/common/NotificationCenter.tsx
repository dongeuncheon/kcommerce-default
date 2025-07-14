import React, { useState } from 'react'
import { useQuery } from 'react-query'
import { Bell, Check, X, AlertCircle, Info, ShoppingCart, Package } from 'lucide-react'
import { format } from 'date-fns'
import { api } from '../../../services/api'

interface Notification {
  id: string
  type: 'info' | 'warning' | 'error' | 'success'
  category: 'order' | 'inventory' | 'customer' | 'system'
  title: string
  message: string
  isRead: boolean
  createdAt: string
  actionUrl?: string
  metadata?: Record<string, any>
}

export const NotificationCenter: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')

  // Fetch notifications
  const { data: notifications, isLoading } = useQuery<Notification[]>(
    ['notifications', filter],
    async () => {
      const response = await api.get('/api/admin/notifications', {
        params: { filter }
      })
      return response.data.data
    },
    {
      refetchInterval: 30000, // Refetch every 30 seconds
    }
  )

  const unreadCount = notifications?.filter(n => !n.isRead).length || 0

  const getIcon = (category: string) => {
    switch (category) {
      case 'order':
        return <ShoppingCart className="w-4 h-4" />
      case 'inventory':
        return <Package className="w-4 h-4" />
      case 'customer':
        return <Info className="w-4 h-4" />
      case 'system':
        return <AlertCircle className="w-4 h-4" />
      default:
        return <Bell className="w-4 h-4" />
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'error':
        return 'text-red-600 bg-red-50 border-red-200'
      case 'warning':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'success':
        return 'text-green-600 bg-green-50 border-green-200'
      default:
        return 'text-blue-600 bg-blue-50 border-blue-200'
    }
  }

  const markAsRead = async (notificationId: string) => {
    try {
      await api.patch(`/api/admin/notifications/${notificationId}/read`)
      // Optimistically update the notification
    } catch (error) {
      console.error('Failed to mark notification as read:', error)
    }
  }

  const markAllAsRead = async () => {
    try {
      await api.patch('/api/admin/notifications/read-all')
      // Refetch notifications
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error)
    }
  }

  return (
    <div className="relative">
      {/* Notification Bell */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        <Bell className="w-5 h-5 text-gray-600" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Panel */}
          <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-lg border z-50 max-h-96 overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  Notifications
                </h3>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              {/* Filter tabs */}
              <div className="flex space-x-4 mt-3">
                <button
                  onClick={() => setFilter('all')}
                  className={`text-sm font-medium ${
                    filter === 'all'
                      ? 'text-indigo-600 border-b-2 border-indigo-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setFilter('unread')}
                  className={`text-sm font-medium ${
                    filter === 'unread'
                      ? 'text-indigo-600 border-b-2 border-indigo-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Unread ({unreadCount})
                </button>
              </div>
              
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-indigo-600 hover:text-indigo-700 mt-2"
                >
                  Mark all as read
                </button>
              )}
            </div>

            {/* Notifications List */}
            <div className="max-h-80 overflow-y-auto">
              {isLoading ? (
                <div className="p-4 text-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-indigo-500 mx-auto"></div>
                </div>
              ) : notifications && notifications.length > 0 ? (
                <div className="divide-y divide-gray-200">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-4 hover:bg-gray-50 cursor-pointer ${
                        !notification.isRead ? 'bg-blue-50' : ''
                      }`}
                      onClick={() => {
                        if (!notification.isRead) {
                          markAsRead(notification.id)
                        }
                        if (notification.actionUrl) {
                          window.location.href = notification.actionUrl
                        }
                      }}
                    >
                      <div className="flex items-start space-x-3">
                        <div className={`p-1 rounded-full ${getTypeColor(notification.type)}`}>
                          {getIcon(notification.category)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {notification.title}
                            </p>
                            {!notification.isRead && (
                              <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                            )}
                          </div>
                          <p className="text-sm text-gray-500 mt-1">
                            {notification.message}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {format(new Date(notification.createdAt), 'MMM d, h:mm a')}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <Bell className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No notifications</p>
                </div>
              )}
            </div>

            {/* Footer */}
            {notifications && notifications.length > 0 && (
              <div className="p-3 border-t border-gray-200 bg-gray-50">
                <button
                  onClick={() => {
                    setIsOpen(false)
                    // Navigate to full notifications page
                  }}
                  className="w-full text-center text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  View all notifications
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}