import React, { useState } from 'react'
import { useQuery } from 'react-query'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  Download,
  Filter,
  DollarSign,
  ShoppingCart,
  Users,
  Package,
} from 'lucide-react'
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns'
import { toast } from 'react-hot-toast'
import { api } from '../../services/api'

interface AnalyticsData {
  salesOverTime: Array<{
    date: string
    revenue: number
    orders: number
    customers: number
  }>
  productPerformance: Array<{
    id: string
    name: string
    sales: number
    revenue: number
    viewToCartRate: number
    cartToOrderRate: number
  }>
  customerSegments: Array<{
    segment: string
    count: number
    revenue: number
    averageOrderValue: number
  }>
  conversionFunnel: Array<{
    stage: string
    count: number
    rate: number
  }>
  topCategories: Array<{
    category: string
    revenue: number
    orders: number
  }>
}

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6']

export const AnalyticsPage: React.FC = () => {
  const [dateRange, setDateRange] = useState('30days')
  const [compareMode, setCompareMode] = useState(false)

  // Fetch analytics data
  const { data, isLoading, error } = useQuery<AnalyticsData>(
    ['analytics', dateRange],
    async () => {
      const endDate = new Date()
      let startDate: Date

      switch (dateRange) {
        case '7days':
          startDate = subDays(endDate, 7)
          break
        case '30days':
          startDate = subDays(endDate, 30)
          break
        case 'thisMonth':
          startDate = startOfMonth(endDate)
          break
        case '90days':
          startDate = subDays(endDate, 90)
          break
        default:
          startDate = subDays(endDate, 30)
      }

      const response = await api.get('/api/admin/analytics', {
        params: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          compareMode,
        },
      })
      return response.data.data
    }
  )

  const handleExport = (type: string) => {
    toast.success(`Exporting ${type} report...`)
    // Implement export functionality
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">Failed to load analytics data</p>
      </div>
    )
  }

  // Calculate summary metrics
  const summaryMetrics = {
    totalRevenue: data?.salesOverTime.reduce((sum, day) => sum + day.revenue, 0) || 0,
    totalOrders: data?.salesOverTime.reduce((sum, day) => sum + day.orders, 0) || 0,
    totalCustomers: data?.customerSegments.reduce((sum, seg) => sum + seg.count, 0) || 0,
    averageOrderValue:
      (data?.salesOverTime.reduce((sum, day) => sum + day.revenue, 0) || 0) /
      (data?.salesOverTime.reduce((sum, day) => sum + day.orders, 0) || 1),
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-600 mt-1">
            Track your store performance and gain insights
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg"
          >
            <option value="7days">Last 7 days</option>
            <option value="30days">Last 30 days</option>
            <option value="thisMonth">This month</option>
            <option value="90days">Last 90 days</option>
          </select>
          <button
            onClick={() => setCompareMode(!compareMode)}
            className={`px-4 py-2 rounded-lg ${
              compareMode
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Compare periods
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Revenue</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                ${summaryMetrics.totalRevenue.toLocaleString()}
              </p>
              <div className="mt-2 flex items-center text-sm">
                <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
                <span className="text-green-600">12.5%</span>
                <span className="text-gray-500 ml-1">vs last period</span>
              </div>
            </div>
            <div className="p-3 bg-indigo-100 rounded-full">
              <DollarSign className="w-6 h-6 text-indigo-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Orders</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {summaryMetrics.totalOrders}
              </p>
              <div className="mt-2 flex items-center text-sm">
                <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
                <span className="text-green-600">8.2%</span>
                <span className="text-gray-500 ml-1">vs last period</span>
              </div>
            </div>
            <div className="p-3 bg-purple-100 rounded-full">
              <ShoppingCart className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Customers</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {summaryMetrics.totalCustomers}
              </p>
              <div className="mt-2 flex items-center text-sm">
                <TrendingDown className="w-4 h-4 text-red-500 mr-1" />
                <span className="text-red-600">-2.4%</span>
                <span className="text-gray-500 ml-1">vs last period</span>
              </div>
            </div>
            <div className="p-3 bg-pink-100 rounded-full">
              <Users className="w-6 h-6 text-pink-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg. Order Value</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                ${summaryMetrics.averageOrderValue.toFixed(2)}
              </p>
              <div className="mt-2 flex items-center text-sm">
                <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
                <span className="text-green-600">5.7%</span>
                <span className="text-gray-500 ml-1">vs last period</span>
              </div>
            </div>
            <div className="p-3 bg-amber-100 rounded-full">
              <Package className="w-6 h-6 text-amber-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Revenue & Orders Chart */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Revenue & Orders</h3>
          <button
            onClick={() => handleExport('revenue')}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            <Download className="w-4 h-4 inline mr-1" />
            Export
          </button>
        </div>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={data?.salesOverTime}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickFormatter={(date) => format(new Date(date), 'MMM d')}
            />
            <YAxis yAxisId="left" orientation="left" stroke="#6366f1" />
            <YAxis yAxisId="right" orientation="right" stroke="#8b5cf6" />
            <Tooltip
              formatter={(value: number, name: string) => {
                if (name === 'Revenue') return `$${value.toLocaleString()}`
                return value
              }}
              labelFormatter={(date) => format(new Date(date), 'MMM d, yyyy')}
            />
            <Legend />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="revenue"
              stroke="#6366f1"
              strokeWidth={2}
              name="Revenue"
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="orders"
              stroke="#8b5cf6"
              strokeWidth={2}
              name="Orders"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Categories */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Top Categories</h3>
            <button
              onClick={() => handleExport('categories')}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              <Download className="w-4 h-4 inline mr-1" />
              Export
            </button>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data?.topCategories}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="category" />
              <YAxis />
              <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
              <Bar dataKey="revenue" fill="#6366f1" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Customer Segments */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Customer Segments</h3>
            <button
              onClick={() => handleExport('segments')}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              <Download className="w-4 h-4 inline mr-1" />
              Export
            </button>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={data?.customerSegments}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ segment, count }) => `${segment}: ${count}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="count"
              >
                {data?.customerSegments.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Product Performance Table */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Product Performance</h3>
          <button
            onClick={() => handleExport('products')}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            <Download className="w-4 h-4 inline mr-1" />
            Export
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Product
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sales
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Revenue
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  View to Cart
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cart to Order
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data?.productPerformance.slice(0, 10).map((product) => (
                <tr key={product.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {product.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {product.sales}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${product.revenue.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {product.viewToCartRate.toFixed(1)}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {product.cartToOrderRate.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Conversion Funnel */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Conversion Funnel</h3>
          <button
            onClick={() => handleExport('funnel')}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            <Download className="w-4 h-4 inline mr-1" />
            Export
          </button>
        </div>
        <div className="space-y-4">
          {data?.conversionFunnel.map((stage, index) => (
            <div key={stage.stage}>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-medium">{stage.stage}</span>
                <span className="text-gray-600">
                  {stage.count} ({stage.rate.toFixed(1)}%)
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-indigo-600 h-2 rounded-full"
                  style={{ width: `${stage.rate}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}