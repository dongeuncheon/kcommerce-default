import React from 'react'
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
  Package,
  ShoppingCart,
  Users,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  Clock,
  Activity,
  Eye,
  RefreshCw
} from 'lucide-react'
import { format, subDays, startOfDay } from 'date-fns'
import { ko } from 'date-fns/locale'
import { adminService, DashboardMetrics, SalesData, TopProduct, RecentOrder, InventoryAlert } from '../../services/adminService'

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981']

const MetricCard: React.FC<{
  title: string
  value: string | number
  change?: number
  icon: React.ReactNode
  color: string
  loading?: boolean
}> = ({ title, value, change, icon, color, loading }) => {
  const isPositive = change && change > 0

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="h-4 bg-gray-200 rounded animate-pulse mb-3"></div>
            <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
          </div>
          <div className={`p-3 rounded-full ${color} opacity-50`}>{icon}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
          {change !== undefined && (
            <div className="mt-2 flex items-center text-sm">
              {isPositive ? (
                <ArrowUpRight className="h-4 w-4 text-green-500 mr-1" />
              ) : (
                <ArrowDownRight className="h-4 w-4 text-red-500 mr-1" />
              )}
              <span className={isPositive ? 'text-green-600' : 'text-red-600'}>
                {Math.abs(change)}%
              </span>
              <span className="text-gray-500 ml-1">전월 대비</span>
            </div>
          )}
        </div>
        <div className={`p-3 rounded-full ${color}`}>{icon}</div>
      </div>
    </div>
  )
}

const QuickActionCard: React.FC<{
  title: string
  description: string
  icon: React.ReactNode
  color: string
  onClick: () => void
}> = ({ title, description, icon, color, onClick }) => (
  <div 
    onClick={onClick}
    className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow cursor-pointer group"
  >
    <div className="flex items-center">
      <div className={`p-2 rounded-lg ${color} group-hover:scale-110 transition-transform`}>
        {icon}
      </div>
      <div className="ml-3">
        <h3 className="text-sm font-medium text-gray-900">{title}</h3>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
    </div>
  </div>
)

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

const formatNumber = (num: number): string => {
  return new Intl.NumberFormat('ko-KR').format(num)
}

export const DashboardPage: React.FC = () => {
  // 대시보드 메트릭 조회
  const { data: metrics, isLoading: metricsLoading, error: metricsError } = useQuery(
    'dashboard-metrics',
    adminService.getDashboardMetrics,
    {
      refetchInterval: 5 * 60 * 1000, // 5분마다 새로고침
      staleTime: 2 * 60 * 1000, // 2분간 캐시 유지
    }
  )

  // 판매 데이터 조회 (최근 30일)
  const { data: salesData, isLoading: salesLoading } = useQuery(
    'sales-data',
    () => adminService.getSalesData(30),
    {
      refetchInterval: 10 * 60 * 1000, // 10분마다 새로고침
    }
  )

  // 인기 상품 조회
  const { data: topProducts, isLoading: topProductsLoading } = useQuery(
    'top-products',
    () => adminService.getTopProducts(5),
    {
      refetchInterval: 15 * 60 * 1000, // 15분마다 새로고침
    }
  )

  // 최근 주문 조회
  const { data: recentOrders, isLoading: recentOrdersLoading } = useQuery(
    'recent-orders',
    () => adminService.getRecentOrders(5),
    {
      refetchInterval: 5 * 60 * 1000, // 5분마다 새로고침
    }
  )

  // 재고 알림 조회
  const { data: inventoryAlerts, isLoading: inventoryAlertsLoading } = useQuery(
    'inventory-alerts',
    adminService.getInventoryAlerts,
    {
      refetchInterval: 5 * 60 * 1000, // 5분마다 새로고침
    }
  )

  // 시스템 상태 조회
  const { data: systemHealth } = useQuery(
    'system-health',
    adminService.getSystemHealth,
    {
      refetchInterval: 30 * 1000, // 30초마다 새로고침
    }
  )

  // 주문 상태별 분포 데이터
  const orderStatusData = [
    { name: '주문확인', value: 25, color: '#f59e0b' },
    { name: '준비중', value: 30, color: '#6366f1' },
    { name: '배송중', value: 35, color: '#8b5cf6' },
    { name: '배송완료', value: 80, color: '#10b981' },
    { name: '취소/환불', value: 5, color: '#ef4444' },
  ]

  // 빠른 작업 함수들
  const quickActions = [
    {
      title: '새 상품 등록',
      description: '상품을 추가하세요',
      icon: <Package className="h-5 w-5 text-white" />,
      color: 'bg-blue-500',
      onClick: () => window.location.href = '/admin/products?action=create'
    },
    {
      title: '주문 관리',
      description: '새 주문을 확인하세요',
      icon: <ShoppingCart className="h-5 w-5 text-white" />,
      color: 'bg-green-500',
      onClick: () => window.location.href = '/admin/orders'
    },
    {
      title: '고객 관리',
      description: '고객 정보를 관리하세요',
      icon: <Users className="h-5 w-5 text-white" />,
      color: 'bg-purple-500',
      onClick: () => window.location.href = '/admin/customers'
    },
    {
      title: '재고 확인',
      description: '재고 현황을 확인하세요',
      icon: <Activity className="h-5 w-5 text-white" />,
      color: 'bg-orange-500',
      onClick: () => window.location.href = '/admin/inventory'
    }
  ]

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">📊 관리자 대시보드</h1>
          <p className="text-gray-600 mt-1">
            실시간 비즈니스 현황을 한눈에 확인하세요
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="text-sm text-gray-500">
            마지막 업데이트: {format(new Date(), 'yyyy-MM-dd HH:mm', { locale: ko })}
          </div>
          <button 
            onClick={() => window.location.reload()} 
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* 시스템 상태 알림 */}
      {systemHealth && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center">
            <Activity className="h-5 w-5 text-green-500 mr-2" />
            <div className="flex-1">
              <p className="text-sm font-medium text-green-800">
                시스템 정상 운영 중 (가동시간: {systemHealth.uptime})
              </p>
              <p className="text-xs text-green-600 mt-1">
                메모리: {systemHealth.memory?.used} / {systemHealth.memory?.total} | 
                CPU: {systemHealth.cpu} | 
                DB: {systemHealth.database} | 
                Redis: {systemHealth.redis}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 주요 메트릭 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="총 매출"
          value={metrics ? formatCurrency(metrics.totalRevenue) : '-'}
          change={metrics?.revenueChange}
          icon={<DollarSign className="h-6 w-6 text-white" />}
          color="bg-green-100 text-green-600"
          loading={metricsLoading}
        />
        <MetricCard
          title="총 주문수"
          value={metrics ? formatNumber(metrics.totalOrders) : '-'}
          change={metrics?.ordersChange}
          icon={<ShoppingCart className="h-6 w-6 text-white" />}
          color="bg-blue-100 text-blue-600"
          loading={metricsLoading}
        />
        <MetricCard
          title="고객수"
          value={metrics ? formatNumber(metrics.totalCustomers) : '-'}
          change={metrics?.customersChange}
          icon={<Users className="h-6 w-6 text-white" />}
          color="bg-purple-100 text-purple-600"
          loading={metricsLoading}
        />
        <MetricCard
          title="상품수"
          value={metrics ? formatNumber(metrics.totalProducts) : '-'}
          change={metrics?.productsChange}
          icon={<Package className="h-6 w-6 text-white" />}
          color="bg-orange-100 text-orange-600"
          loading={metricsLoading}
        />
      </div>

      {/* 빠른 작업 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">⚡ 빠른 작업</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action, index) => (
            <QuickActionCard key={index} {...action} />
          ))}
        </div>
      </div>

      {/* 차트 영역 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 매출 추이 차트 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">📈 매출 추이 (최근 30일)</h2>
          {salesLoading ? (
            <div className="h-80 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : salesData && salesData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={salesData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(date) => format(new Date(date), 'MM/dd', { locale: ko })}
                />
                <YAxis tickFormatter={(value) => `${(value / 10000).toFixed(0)}만원`} />
                <Tooltip 
                  labelFormatter={(date) => format(new Date(date), 'yyyy년 MM월 dd일', { locale: ko })}
                  formatter={(value: number) => [formatCurrency(value), '매출']}
                />
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#6366f1" 
                  fill="#6366f1" 
                  fillOpacity={0.1}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-80 flex items-center justify-center text-gray-500">
              데이터가 없습니다
            </div>
          )}
        </div>

        {/* 주문 상태 분포 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">📦 주문 상태 분포</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={orderStatusData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={120}
                paddingAngle={5}
                dataKey="value"
              >
                {orderStatusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => [`${value}건`, '주문수']} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 하단 정보 영역 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 인기 상품 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">🔥 인기 상품</h2>
          {topProductsLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-200 rounded animate-pulse"></div>
              ))}
            </div>
          ) : topProducts && topProducts.length > 0 ? (
            <div className="space-y-3">
              {topProducts.map((product, index) => (
                <div key={product.id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                      <span className="text-sm font-semibold text-primary-600">#{index + 1}</span>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                      <p className="text-xs text-gray-500">{product.category}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">{formatCurrency(product.revenue)}</p>
                    <p className="text-xs text-gray-500">{product.sales}개 판매</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8">
              데이터가 없습니다
            </div>
          )}
        </div>

        {/* 최근 주문 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">🛒 최근 주문</h2>
          {recentOrdersLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-200 rounded animate-pulse"></div>
              ))}
            </div>
          ) : recentOrders && recentOrders.length > 0 ? (
            <div className="space-y-3">
              {recentOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-900">주문 #{order.id}</p>
                    <p className="text-xs text-gray-500">{order.customerName}</p>
                    <p className="text-xs text-gray-400">
                      {format(new Date(order.createdAt), 'MM/dd HH:mm', { locale: ko })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">{formatCurrency(order.total)}</p>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      order.status === '배송완료' ? 'bg-green-100 text-green-800' :
                      order.status === '배송중' ? 'bg-blue-100 text-blue-800' :
                      order.status === '주문확인' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {order.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8">
              주문이 없습니다
            </div>
          )}
        </div>

        {/* 재고 알림 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">⚠️ 재고 알림</h2>
          {inventoryAlertsLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-200 rounded animate-pulse"></div>
              ))}
            </div>
          ) : inventoryAlerts && inventoryAlerts.length > 0 ? (
            <div className="space-y-3">
              {inventoryAlerts.map((alert) => (
                <div key={alert.productId} className={`p-3 rounded-lg border ${
                  alert.status === 'out_of_stock' 
                    ? 'bg-red-50 border-red-200' 
                    : 'bg-yellow-50 border-yellow-200'
                }`}>
                  <div className="flex items-center">
                    <AlertTriangle className={`h-4 w-4 mr-2 ${
                      alert.status === 'out_of_stock' ? 'text-red-500' : 'text-yellow-500'
                    }`} />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{alert.productName}</p>
                      <p className="text-xs text-gray-600">
                        현재 재고: {alert.currentStock}개 
                        {alert.status === 'out_of_stock' ? ' (품절)' : ` (최소 ${alert.lowStockThreshold}개 필요)`}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8">
              재고 알림이 없습니다
            </div>
          )}
        </div>
      </div>
    </div>
  )
}