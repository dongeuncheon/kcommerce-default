import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { useNavigate } from 'react-router-dom'
import { createColumnHelper } from '@tanstack/react-table'
import {
  Plus,
  Edit,
  Trash2,
  Archive,
  MoreVertical,
  Download,
  Upload,
  Eye,
  Package,
} from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'react-hot-toast'
import { DataTable } from '../../components/admin/common/DataTable'
import { Product } from '../../types/admin'
import { api } from '../../services/api'

const columnHelper = createColumnHelper<Product>()

export const ProductsPage: React.FC = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [productToDelete, setProductToDelete] = useState<Product | null>(null)

  // Fetch products
  const { data: products, isLoading, error } = useQuery<Product[]>(
    'adminProducts',
    async () => {
      const response = await api.get('/api/products')
      return response.data.data
    }
  )

  // Delete product mutation
  const deleteMutation = useMutation(
    async (productId: string) => {
      await api.delete(`/api/products/${productId}`)
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('adminProducts')
        toast.success('Product deleted successfully')
        setDeleteModalOpen(false)
        setProductToDelete(null)
      },
      onError: () => {
        toast.error('Failed to delete product')
      },
    }
  )

  // Bulk update mutation
  const bulkUpdateMutation = useMutation(
    async ({ ids, status }: { ids: string[]; status: string }) => {
      await api.patch('/api/products/bulk', { ids, status })
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('adminProducts')
        toast.success('Products updated successfully')
        setSelectedProducts([])
      },
      onError: () => {
        toast.error('Failed to update products')
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
    columnHelper.accessor('images', {
      header: 'Image',
      cell: (info) => {
        const primaryImage = info.getValue()?.find((img) => img.isPrimary)
        return primaryImage ? (
          <img
            src={primaryImage.url}
            alt={primaryImage.alt || ''}
            className="w-12 h-12 object-cover rounded"
          />
        ) : (
          <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center">
            <Package className="w-6 h-6 text-gray-400" />
          </div>
        )
      },
    }),
    columnHelper.accessor('name', {
      header: 'Product',
      cell: (info) => (
        <div>
          <p className="font-medium text-gray-900">{info.getValue()}</p>
          <p className="text-sm text-gray-500">SKU: {info.row.original.sku}</p>
        </div>
      ),
    }),
    columnHelper.accessor('status', {
      header: 'Status',
      cell: (info) => {
        const status = info.getValue()
        const statusColors = {
          PUBLISHED: 'bg-green-100 text-green-800',
          DRAFT: 'bg-yellow-100 text-yellow-800',
          ARCHIVED: 'bg-gray-100 text-gray-800',
        }
        return (
          <span
            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
              statusColors[status]
            }`}
          >
            {status}
          </span>
        )
      },
    }),
    columnHelper.accessor('price', {
      header: 'Price',
      cell: (info) => `$${info.getValue().toFixed(2)}`,
    }),
    columnHelper.accessor('quantity', {
      header: 'Stock',
      cell: (info) => {
        const quantity = info.getValue()
        const lowStock = info.row.original.lowStockThreshold
        return (
          <div className="flex items-center space-x-2">
            <span
              className={quantity <= lowStock ? 'text-red-600 font-medium' : ''}
            >
              {quantity}
            </span>
            {quantity <= lowStock && (
              <span className="text-xs text-red-600">Low</span>
            )}
          </div>
        )
      },
    }),
    columnHelper.accessor('category', {
      header: 'Category',
      cell: (info) => info.getValue()?.name || '-',
    }),
    columnHelper.accessor('updatedAt', {
      header: 'Last Updated',
      cell: (info) => format(new Date(info.getValue()), 'MMM d, yyyy'),
    }),
    columnHelper.display({
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex items-center space-x-2">
          <button
            onClick={() => navigate(`/admin/products/${row.original.id}`)}
            className="p-1 text-gray-500 hover:text-gray-700"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={() => navigate(`/admin/products/${row.original.id}/edit`)}
            className="p-1 text-gray-500 hover:text-gray-700"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setProductToDelete(row.original)
              setDeleteModalOpen(true)
            }}
            className="p-1 text-gray-500 hover:text-red-600"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    }),
  ]

  const handleBulkAction = (action: string) => {
    if (selectedProducts.length === 0) {
      toast.error('Please select products first')
      return
    }

    switch (action) {
      case 'delete':
        // Handle bulk delete
        break
      case 'publish':
        bulkUpdateMutation.mutate({ ids: selectedProducts, status: 'PUBLISHED' })
        break
      case 'archive':
        bulkUpdateMutation.mutate({ ids: selectedProducts, status: 'ARCHIVED' })
        break
    }
  }

  const actions = (
    <>
      {selectedProducts.length > 0 && (
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600">
            {selectedProducts.length} selected
          </span>
          <button
            onClick={() => handleBulkAction('publish')}
            className="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600"
          >
            Publish
          </button>
          <button
            onClick={() => handleBulkAction('archive')}
            className="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Archive
          </button>
          <button
            onClick={() => handleBulkAction('delete')}
            className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600"
          >
            Delete
          </button>
        </div>
      )}
      <button
        onClick={() => navigate('/admin/products/import')}
        className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
      >
        <Upload className="w-4 h-4 mr-2" />
        Import
      </button>
      <button
        onClick={() => {
          // Handle export
          toast.success('Export started')
        }}
        className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
      >
        <Download className="w-4 h-4 mr-2" />
        Export
      </button>
      <button
        onClick={() => navigate('/admin/products/new')}
        className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
      >
        <Plus className="w-4 h-4 mr-2" />
        Add Product
      </button>
    </>
  )

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Products</h1>
        <p className="text-gray-600 mt-1">
          Manage your product catalog and inventory
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Total Products</p>
          <p className="text-2xl font-bold">{products?.length || 0}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Published</p>
          <p className="text-2xl font-bold text-green-600">
            {products?.filter((p) => p.status === 'PUBLISHED').length || 0}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Low Stock</p>
          <p className="text-2xl font-bold text-yellow-600">
            {products?.filter((p) => p.quantity <= p.lowStockThreshold).length || 0}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Out of Stock</p>
          <p className="text-2xl font-bold text-red-600">
            {products?.filter((p) => p.quantity === 0).length || 0}
          </p>
        </div>
      </div>

      {/* Products table */}
      <DataTable
        data={products || []}
        columns={columns}
        loading={isLoading}
        error={error?.message}
        actions={actions}
        searchPlaceholder="Search products..."
      />

      {/* Delete confirmation modal */}
      {deleteModalOpen && productToDelete && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Delete Product</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete "{productToDelete.name}"? This action
              cannot be undone.
            </p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => {
                  setDeleteModalOpen(false)
                  setProductToDelete(null)
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(productToDelete.id)}
                disabled={deleteMutation.isLoading}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
              >
                {deleteMutation.isLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}