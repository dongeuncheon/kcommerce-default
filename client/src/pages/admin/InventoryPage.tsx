import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { createColumnHelper } from '@tanstack/react-table'
import {
  Package,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Edit,
  Plus,
  Minus,
  RotateCcw,
  Download,
  Upload,
} from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'react-hot-toast'
import { DataTable } from '../../components/admin/common/DataTable'
import { Product } from '../../types/admin'
import { api } from '../../services/api'

interface InventoryItem extends Product {
  reservedQuantity: number
  availableQuantity: number
  reorderPoint: number
  lastRestocked?: string
  turnoverRate: number
}

interface StockAdjustment {
  id: string
  productId: string
  type: 'IN' | 'OUT' | 'ADJUSTMENT'
  quantity: number
  reason: string
  notes?: string
  createdAt: string
  createdBy: string
}

const columnHelper = createColumnHelper<InventoryItem>()

export const InventoryPage: React.FC = () => {
  const queryClient = useQueryClient()
  const [adjustmentModalOpen, setAdjustmentModalOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<InventoryItem | null>(null)
  const [adjustmentForm, setAdjustmentForm] = useState({
    type: 'ADJUSTMENT' as 'IN' | 'OUT' | 'ADJUSTMENT',
    quantity: 0,
    reason: '',
    notes: '',
  })

  // Fetch inventory data
  const { data: inventory, isLoading, error } = useQuery<InventoryItem[]>(
    'adminInventory',
    async () => {
      const response = await api.get('/api/admin/inventory')
      return response.data.data
    }
  )

  // Fetch stock adjustments
  const { data: adjustments } = useQuery<StockAdjustment[]>(
    'stockAdjustments',
    async () => {
      const response = await api.get('/api/admin/inventory/adjustments')
      return response.data.data
    }
  )

  // Stock adjustment mutation
  const adjustmentMutation = useMutation(
    async (data: {
      productId: string
      type: string
      quantity: number
      reason: string
      notes?: string
    }) => {
      await api.post('/api/admin/inventory/adjust', data)
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('adminInventory')
        queryClient.invalidateQueries('stockAdjustments')
        toast.success('Stock adjusted successfully')
        setAdjustmentModalOpen(false)
        setSelectedProduct(null)
        setAdjustmentForm({
          type: 'ADJUSTMENT',
          quantity: 0,
          reason: '',
          notes: '',
        })
      },
      onError: () => {
        toast.error('Failed to adjust stock')
      },
    }
  )

  const getStockStatus = (item: InventoryItem) => {
    if (item.availableQuantity <= 0) {
      return { status: 'out-of-stock', color: 'text-red-600', icon: AlertTriangle }
    } else if (item.availableQuantity <= item.lowStockThreshold) {
      return { status: 'low-stock', color: 'text-yellow-600', icon: AlertTriangle }
    } else if (item.availableQuantity <= item.reorderPoint) {
      return { status: 'reorder', color: 'text-orange-600', icon: Package }
    }
    return { status: 'in-stock', color: 'text-green-600', icon: Package }
  }

  const columns = [
    columnHelper.accessor('images', {
      header: 'Product',
      cell: (info) => {
        const primaryImage = info.getValue()?.find((img) => img.isPrimary)
        return (
          <div className="flex items-center space-x-3">
            {primaryImage ? (
              <img
                src={primaryImage.url}
                alt={primaryImage.alt || ''}
                className="w-10 h-10 object-cover rounded"
              />
            ) : (
              <div className="w-10 h-10 bg-gray-200 rounded flex items-center justify-center">
                <Package className="w-5 h-5 text-gray-400" />
              </div>
            )}
            <div>
              <p className="font-medium text-gray-900">{info.row.original.name}</p>
              <p className="text-sm text-gray-500">SKU: {info.row.original.sku}</p>
            </div>
          </div>
        )
      },
    }),
    columnHelper.accessor('availableQuantity', {
      header: 'Available',
      cell: (info) => {
        const item = info.row.original
        const { status, color, icon: Icon } = getStockStatus(item)
        return (
          <div className="flex items-center space-x-2">
            <Icon className={`w-4 h-4 ${color}`} />
            <span className={`font-medium ${color}`}>{info.getValue()}</span>
          </div>
        )
      },
    }),
    columnHelper.accessor('reservedQuantity', {
      header: 'Reserved',
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor('quantity', {
      header: 'Total Stock',
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor('lowStockThreshold', {
      header: 'Low Stock Alert',
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor('reorderPoint', {
      header: 'Reorder Point',
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor('turnoverRate', {
      header: 'Turnover',
      cell: (info) => {
        const rate = info.getValue()
        return (
          <div className="flex items-center space-x-1">
            {rate > 0 ? (
              <TrendingUp className="w-4 h-4 text-green-500" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-500" />
            )}
            <span>{rate.toFixed(1)}%</span>
          </div>
        )
      },
    }),
    columnHelper.accessor('lastRestocked', {
      header: 'Last Restocked',
      cell: (info) => {
        const date = info.getValue()
        return date ? format(new Date(date), 'MMM d, yyyy') : '-'
      },
    }),
    columnHelper.display({
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex items-center space-x-2">
          <button
            onClick={() => {
              setSelectedProduct(row.original)
              setAdjustmentForm({ ...adjustmentForm, type: 'IN' })
              setAdjustmentModalOpen(true)
            }}
            className="p-1 text-green-600 hover:text-green-700"
            title="Add stock"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setSelectedProduct(row.original)
              setAdjustmentForm({ ...adjustmentForm, type: 'OUT' })
              setAdjustmentModalOpen(true)
            }}
            className="p-1 text-red-600 hover:text-red-700"
            title="Remove stock"
          >
            <Minus className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setSelectedProduct(row.original)
              setAdjustmentForm({ ...adjustmentForm, type: 'ADJUSTMENT' })
              setAdjustmentModalOpen(true)
            }}
            className="p-1 text-gray-600 hover:text-gray-700"
            title="Adjust stock"
          >
            <Edit className="w-4 h-4" />
          </button>
        </div>
      ),
    }),
  ]

  const handleStockAdjustment = () => {
    if (!selectedProduct) return

    const quantity = adjustmentForm.type === 'OUT' ? -Math.abs(adjustmentForm.quantity) : Math.abs(adjustmentForm.quantity)

    adjustmentMutation.mutate({
      productId: selectedProduct.id,
      type: adjustmentForm.type,
      quantity,
      reason: adjustmentForm.reason,
      notes: adjustmentForm.notes,
    })
  }

  const actions = (
    <>
      <button
        onClick={() => {
          // Handle bulk stock import
          toast.success('Import feature coming soon')
        }}
        className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
      >
        <Upload className="w-4 h-4 mr-2" />
        Import Stock
      </button>
      <button
        onClick={() => {
          // Handle export
          toast.success('Exporting inventory...')
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
    totalProducts: inventory?.length || 0,
    lowStock: inventory?.filter((item) => item.availableQuantity <= item.lowStockThreshold).length || 0,
    outOfStock: inventory?.filter((item) => item.availableQuantity === 0).length || 0,
    reorderNeeded: inventory?.filter((item) => item.availableQuantity <= item.reorderPoint).length || 0,
    totalValue: inventory?.reduce((sum, item) => sum + (item.price * item.quantity), 0) || 0,
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Inventory Management</h1>
        <p className="text-gray-600 mt-1">
          Monitor stock levels and manage inventory adjustments
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Total Products</p>
          <p className="text-2xl font-bold">{stats.totalProducts}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Low Stock</p>
          <p className="text-2xl font-bold text-yellow-600">{stats.lowStock}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Out of Stock</p>
          <p className="text-2xl font-bold text-red-600">{stats.outOfStock}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Reorder Needed</p>
          <p className="text-2xl font-bold text-orange-600">{stats.reorderNeeded}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Total Value</p>
          <p className="text-2xl font-bold text-green-600">
            ${stats.totalValue.toFixed(0)}
          </p>
        </div>
      </div>

      {/* Inventory table */}
      <DataTable
        data={inventory || []}
        columns={columns}
        loading={isLoading}
        error={error?.message}
        actions={actions}
        searchPlaceholder="Search inventory..."
      />

      {/* Recent adjustments */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Stock Adjustments</h3>
        <div className="space-y-3">
          {adjustments?.slice(0, 5).map((adjustment) => (
            <div key={adjustment.id} className="flex items-center justify-between py-2 border-b">
              <div>
                <p className="font-medium text-gray-900">
                  {adjustment.type === 'IN' ? 'Stock Added' : adjustment.type === 'OUT' ? 'Stock Removed' : 'Stock Adjusted'}
                </p>
                <p className="text-sm text-gray-500">
                  {adjustment.quantity > 0 ? '+' : ''}{adjustment.quantity} units - {adjustment.reason}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">
                  {format(new Date(adjustment.createdAt), 'MMM d, h:mm a')}
                </p>
                <p className="text-xs text-gray-400">by {adjustment.createdBy}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stock adjustment modal */}
      {adjustmentModalOpen && selectedProduct && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">
              Adjust Stock - {selectedProduct.name}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Current Stock: {selectedProduct.quantity}
                </label>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Adjustment Type
                </label>
                <select
                  value={adjustmentForm.type}
                  onChange={(e) =>
                    setAdjustmentForm({
                      ...adjustmentForm,
                      type: e.target.value as 'IN' | 'OUT' | 'ADJUSTMENT',
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="IN">Add Stock</option>
                  <option value="OUT">Remove Stock</option>
                  <option value="ADJUSTMENT">Manual Adjustment</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quantity
                </label>
                <input
                  type="number"
                  value={adjustmentForm.quantity}
                  onChange={(e) =>
                    setAdjustmentForm({
                      ...adjustmentForm,
                      quantity: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  min="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason
                </label>
                <select
                  value={adjustmentForm.reason}
                  onChange={(e) =>
                    setAdjustmentForm({ ...adjustmentForm, reason: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Select reason</option>
                  <option value="restock">Restock</option>
                  <option value="damaged">Damaged</option>
                  <option value="returned">Returned</option>
                  <option value="theft">Theft</option>
                  <option value="correction">Inventory Correction</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={adjustmentForm.notes}
                  onChange={(e) =>
                    setAdjustmentForm({ ...adjustmentForm, notes: e.target.value })
                  }
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end space-x-4 pt-4">
                <button
                  onClick={() => {
                    setAdjustmentModalOpen(false)
                    setSelectedProduct(null)
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleStockAdjustment}
                  disabled={
                    !adjustmentForm.reason || adjustmentForm.quantity === 0 || adjustmentMutation.isLoading
                  }
                  className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
                >
                  {adjustmentMutation.isLoading ? 'Adjusting...' : 'Adjust Stock'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}