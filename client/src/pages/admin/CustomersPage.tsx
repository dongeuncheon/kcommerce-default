import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { useNavigate } from 'react-router-dom'
import { createColumnHelper } from '@tanstack/react-table'
import {
  Eye,
  Mail,
  Phone,
  Calendar,
  ShoppingBag,
  DollarSign,
  UserCheck,
  UserX,
  Download,
  Upload,
  Send,
} from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'react-hot-toast'
import { DataTable } from '../../components/admin/common/DataTable'
import { api } from '../../services/api'

interface Customer {
  id: string
  email: string
  firstName?: string
  lastName?: string
  phone?: string
  isActive: boolean
  isVerified: boolean
  createdAt: string
  updatedAt: string
  lastOrderAt?: string
  totalOrders: number
  totalSpent: number
  averageOrderValue: number
  tags?: string[]
}

const columnHelper = createColumnHelper<Customer>()

export const CustomersPage: React.FC = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([])
  const [emailModalOpen, setEmailModalOpen] = useState(false)

  // Fetch customers
  const { data: customers, isLoading, error } = useQuery<Customer[]>(
    'adminCustomers',
    async () => {
      const response = await api.get('/api/customers')
      return response.data.data
    }
  )

  // Update customer status mutation
  const updateStatusMutation = useMutation(
    async ({ customerId, isActive }: { customerId: string; isActive: boolean }) => {
      await api.patch(`/api/customers/${customerId}`, { isActive })
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('adminCustomers')
        toast.success('Customer status updated')
      },
      onError: () => {
        toast.error('Failed to update customer status')
      },
    }
  )

  const columns = [
    columnHelper.display({
      id: 'select',
      header: ({ table }) => (
        <input
          type="checkbox"
          checked={table.getIsAllRowsSelected()}
          onChange={table.getToggleAllRowsSelectedHandler()}
          className="rounded border-gray-300"
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
          className="rounded border-gray-300"
        />
      ),
    }),
    columnHelper.accessor((row) => `${row.firstName || ''} ${row.lastName || ''}`.trim() || 'Guest', {
      id: 'name',
      header: 'Customer',
      cell: (info) => (
        <div>
          <p className="font-medium text-gray-900">{info.getValue()}</p>
          <p className="text-sm text-gray-500">{info.row.original.email}</p>
        </div>
      ),
    }),
    columnHelper.accessor('isVerified', {
      header: 'Status',
      cell: (info) => {
        const isVerified = info.getValue()
        const isActive = info.row.original.isActive
        return (
          <div className="flex items-center space-x-2">
            {isVerified ? (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                <UserCheck className="w-3 h-3 mr-1" />
                Verified
              </span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                Unverified
              </span>
            )}
            {!isActive && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                <UserX className="w-3 h-3 mr-1" />
                Inactive
              </span>
            )}
          </div>
        )
      },
    }),
    columnHelper.accessor('totalOrders', {
      header: 'Orders',
      cell: (info) => (
        <div className="flex items-center space-x-2">
          <ShoppingBag className="w-4 h-4 text-gray-400" />
          <span>{info.getValue()}</span>
        </div>
      ),
    }),
    columnHelper.accessor('totalSpent', {
      header: 'Total Spent',
      cell: (info) => (
        <div className="flex items-center space-x-2">
          <DollarSign className="w-4 h-4 text-gray-400" />
          <span className="font-medium">${info.getValue().toFixed(2)}</span>
        </div>
      ),
    }),
    columnHelper.accessor('averageOrderValue', {
      header: 'Avg. Order',
      cell: (info) => `$${info.getValue().toFixed(2)}`,
    }),
    columnHelper.accessor('lastOrderAt', {
      header: 'Last Order',
      cell: (info) => {
        const date = info.getValue()
        return date ? format(new Date(date), 'MMM d, yyyy') : '-'
      },
    }),
    columnHelper.accessor('createdAt', {
      header: 'Joined',
      cell: (info) => format(new Date(info.getValue()), 'MMM d, yyyy'),
    }),
    columnHelper.display({
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex items-center space-x-2">
          <button
            onClick={() => navigate(`/admin/customers/${row.original.id}`)}
            className="p-1 text-gray-500 hover:text-gray-700"
            title="View details"
          >
            <Eye className="w-4 h-4" />
          </button>
          {row.original.phone && (
            <a
              href={`tel:${row.original.phone}`}
              className="p-1 text-gray-500 hover:text-gray-700"
              title="Call customer"
            >
              <Phone className="w-4 h-4" />
            </a>
          )}
          <a
            href={`mailto:${row.original.email}`}
            className="p-1 text-gray-500 hover:text-gray-700"
            title="Email customer"
          >
            <Mail className="w-4 h-4" />
          </a>
        </div>
      ),
    }),
  ]

  const handleBulkEmail = () => {
    if (selectedCustomers.length === 0) {
      toast.error('Please select customers first')
      return
    }
    setEmailModalOpen(true)
  }

  const actions = (
    <>
      {selectedCustomers.length > 0 && (
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600">
            {selectedCustomers.length} selected
          </span>
          <button
            onClick={handleBulkEmail}
            className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            <Send className="w-4 h-4 inline mr-1" />
            Send Email
          </button>
        </div>
      )}
      <button
        onClick={() => {
          // Handle import
          toast.success('Import feature coming soon')
        }}
        className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
      >
        <Upload className="w-4 h-4 mr-2" />
        Import
      </button>
      <button
        onClick={() => {
          // Handle export
          toast.success('Exporting customers...')
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
    total: customers?.length || 0,
    verified: customers?.filter((c) => c.isVerified).length || 0,
    active: customers?.filter((c) => c.isActive).length || 0,
    totalRevenue: customers?.reduce((sum, c) => sum + c.totalSpent, 0) || 0,
    avgOrderValue:
      customers?.reduce((sum, c) => sum + c.averageOrderValue, 0) /
        (customers?.length || 1) || 0,
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
        <p className="text-gray-600 mt-1">
          Manage your customer base and track their activity
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Total Customers</p>
          <p className="text-2xl font-bold">{stats.total}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Verified</p>
          <p className="text-2xl font-bold text-green-600">{stats.verified}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Active</p>
          <p className="text-2xl font-bold text-blue-600">{stats.active}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Total Revenue</p>
          <p className="text-2xl font-bold text-purple-600">
            ${stats.totalRevenue.toFixed(0)}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Avg. Order Value</p>
          <p className="text-2xl font-bold text-amber-600">
            ${stats.avgOrderValue.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Customers table */}
      <DataTable
        data={customers || []}
        columns={columns}
        loading={isLoading}
        error={error?.message}
        actions={actions}
        searchPlaceholder="Search customers..."
        onRowClick={(customer) => navigate(`/admin/customers/${customer.id}`)}
      />

      {/* Email modal */}
      {emailModalOpen && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Send Email to Customers</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Recipients
                </label>
                <p className="text-sm text-gray-600">
                  {selectedCustomers.length} customers selected
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Subject
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Enter email subject"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Message
                </label>
                <textarea
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Enter your message"
                />
              </div>
              <div className="flex justify-end space-x-4 pt-4">
                <button
                  onClick={() => setEmailModalOpen(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    toast.success('Email sent successfully')
                    setEmailModalOpen(false)
                    setSelectedCustomers([])
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Send Email
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}