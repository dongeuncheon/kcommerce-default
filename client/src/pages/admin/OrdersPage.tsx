import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { useNavigate } from 'react-router-dom'
import { createColumnHelper } from '@tanstack/react-table'
import {
  Eye,
  Download,
  Printer,
  RefreshCw,
  Package,
  Truck,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  Filter,
} from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'react-hot-toast'
import { DataTable } from '../../components/admin/common/DataTable'
import { Order, OrderStatus, PaymentStatus, FulfillmentStatus } from '../../types/admin'
import { api } from '../../services/api'

const columnHelper = createColumnHelper<Order>()

export const OrdersPage: React.FC = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all')
  const [dateFilter, setDateFilter] = useState<string>('all')

  // Fetch orders
  const { data: orders, isLoading, error } = useQuery<Order[]>(
    ['adminOrders', statusFilter, dateFilter],
    async () => {
      const params: any = {}
      if (statusFilter !== 'all') params.status = statusFilter
      if (dateFilter !== 'all') params.dateRange = dateFilter
      
      const response = await api.get('/api/orders', { params })
      return response.data.data
    }
  )

  // Update order status mutation
  const updateStatusMutation = useMutation(
    async ({ orderId, status }: { orderId: string; status: OrderStatus }) => {
      await api.patch(`/api/orders/${orderId}/status`, { status })
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('adminOrders')
        toast.success('Order status updated')
      },
      onError: () => {
        toast.error('Failed to update order status')
      },
    }
  )

  const getStatusIcon = (status: OrderStatus) => {
    switch (status) {
      case 'PENDING':
        return <Clock className="w-4 h-4" />
      case 'PROCESSING':
        return <RefreshCw className="w-4 h-4" />
      case 'SHIPPED':
        return <Truck className="w-4 h-4" />
      case 'DELIVERED':
        return <CheckCircle className="w-4 h-4" />
      case 'CANCELLED':
        return <XCircle className="w-4 h-4" />
      default:
        return <Package className="w-4 h-4" />
    }
  }

  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800'
      case 'PROCESSING':
        return 'bg-blue-100 text-blue-800'
      case 'SHIPPED':
        return 'bg-purple-100 text-purple-800'
      case 'DELIVERED':
        return 'bg-green-100 text-green-800'
      case 'CANCELLED':
        return 'bg-red-100 text-red-800'
      case 'REFUNDED':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getPaymentStatusColor = (status: PaymentStatus) => {
    switch (status) {
      case 'PAID':
        return 'text-green-600'
      case 'PENDING':
        return 'text-yellow-600'
      case 'FAILED':
        return 'text-red-600'
      case 'REFUNDED':
        return 'text-gray-600'
      default:
        return 'text-gray-600'
    }
  }

  const columns = [
    columnHelper.accessor('orderNumber', {
      header: 'Order',
      cell: (info) => (
        <div>
          <p className="font-medium text-gray-900">#{info.getValue()}</p>
          <p className="text-sm text-gray-500">
            {format(new Date(info.row.original.createdAt), 'MMM d, yyyy h:mm a')}
          </p>
        </div>
      ),
    }),
    columnHelper.accessor('customerEmail', {
      header: 'Customer',
      cell: (info) => (
        <div>
          <p className="font-medium text-gray-900">
            {info.row.original.customerFirstName} {info.row.original.customerLastName}
          </p>
          <p className="text-sm text-gray-500">{info.getValue()}</p>
        </div>
      ),
    }),
    columnHelper.accessor('status', {
      header: 'Status',
      cell: (info) => {
        const status = info.getValue()
        return (
          <div className="flex items-center space-x-2">
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                status
              )}`}
            >
              {getStatusIcon(status)}
              <span className="ml-1">{status}</span>
            </span>
          </div>
        )
      },
    }),
    columnHelper.accessor('paymentStatus', {
      header: 'Payment',
      cell: (info) => {
        const status = info.getValue()
        return (
          <div className="flex items-center space-x-2">
            <DollarSign className={`w-4 h-4 ${getPaymentStatusColor(status)}`} />
            <span className={`text-sm font-medium ${getPaymentStatusColor(status)}`}>
              {status}
            </span>
          </div>
        )
      },
    }),
    columnHelper.accessor('items', {
      header: 'Items',
      cell: (info) => {
        const items = info.getValue()
        const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0)
        return (
          <div>
            <p className="font-medium">{totalQuantity} items</p>
            <p className="text-sm text-gray-500">{items.length} products</p>
          </div>
        )
      },
    }),
    columnHelper.accessor('total', {
      header: 'Total',
      cell: (info) => (
        <span className="font-medium">${info.getValue().toFixed(2)}</span>
      ),
    }),
    columnHelper.accessor('fulfillmentStatus', {
      header: 'Fulfillment',
      cell: (info) => {
        const status = info.getValue()
        const trackingNumber = info.row.original.trackingNumber
        return (
          <div>
            <p className="text-sm">{status}</p>
            {trackingNumber && (
              <p className="text-xs text-gray-500">Track: {trackingNumber}</p>
            )}
          </div>
        )
      },
    }),
    columnHelper.display({
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex items-center space-x-2">
          <button
            onClick={() => navigate(`/admin/orders/${row.original.id}`)}
            className="p-1 text-gray-500 hover:text-gray-700"
            title="View details"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              // Handle print invoice
              toast.success('Printing invoice...')
            }}
            className="p-1 text-gray-500 hover:text-gray-700"
            title="Print invoice"
          >
            <Printer className="w-4 h-4" />
          </button>
          <select
            value={row.original.status}
            onChange={(e) =>
              updateStatusMutation.mutate({
                orderId: row.original.id,
                status: e.target.value as OrderStatus,
              })
            }
            className="text-sm border border-gray-300 rounded px-2 py-1"
            onClick={(e) => e.stopPropagation()}
          >
            <option value="PENDING">Pending</option>
            <option value="PROCESSING">Processing</option>
            <option value="SHIPPED">Shipped</option>
            <option value="DELIVERED">Delivered</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      ),
    }),
  ]

  const actions = (
    <>
      <select
        value={dateFilter}
        onChange={(e) => setDateFilter(e.target.value)}
        className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
      >
        <option value="all">All time</option>
        <option value="today">Today</option>
        <option value="week">This week</option>
        <option value="month">This month</option>
        <option value="year">This year</option>
      </select>
      <select
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value as OrderStatus | 'all')}
        className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
      >
        <option value="all">All status</option>
        <option value="PENDING">Pending</option>
        <option value="PROCESSING">Processing</option>
        <option value="SHIPPED">Shipped</option>
        <option value="DELIVERED">Delivered</option>
        <option value="CANCELLED">Cancelled</option>
      </select>
      <button
        onClick={() => {
          // Handle export
          toast.success('Exporting orders...')
        }}
        className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
      >
        <Download className="w-4 h-4 mr-2" />
        Export
      </button>
    </>
  )

  // Calculate stats
  const stats = {
    total: orders?.length || 0,
    pending: orders?.filter((o) => o.status === 'PENDING').length || 0,
    processing: orders?.filter((o) => o.status === 'PROCESSING').length || 0,
    shipped: orders?.filter((o) => o.status === 'SHIPPED').length || 0,
    revenue: orders?.reduce((sum, o) => sum + o.total, 0) || 0,
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
        <p className="text-gray-600 mt-1">Manage and track customer orders</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Total Orders</p>
          <p className="text-2xl font-bold">{stats.total}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Pending</p>
          <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Processing</p>
          <p className="text-2xl font-bold text-blue-600">{stats.processing}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Shipped</p>
          <p className="text-2xl font-bold text-purple-600">{stats.shipped}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Revenue</p>
          <p className="text-2xl font-bold text-green-600">
            ${stats.revenue.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Orders table */}
      <DataTable
        data={orders || []}
        columns={columns}
        loading={isLoading}
        error={error?.message}
        actions={actions}
        searchPlaceholder="Search orders..."
        onRowClick={(order) => navigate(`/admin/orders/${order.id}`)}
      />
    </div>
  )
}