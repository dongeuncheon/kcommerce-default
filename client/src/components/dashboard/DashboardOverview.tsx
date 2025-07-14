import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  ShoppingCart, 
  Users, 
  Package,
  AlertTriangle,
  DollarSign,
  BarChart3
} from 'lucide-react';
import { MetricCard } from './MetricCard';
import { RealtimeChart } from './RealtimeChart';
import { QuickStats } from './QuickStats';
import { RecentActivity } from './RecentActivity';
import { TopProducts } from './TopProducts';

interface DashboardMetrics {
  sales: {
    today: number;
    thisWeek: number;
    thisMonth: number;
    thisYear: number;
    growth: {
      daily: number;
      weekly: number;
      monthly: number;
    };
  };
  orders: {
    total: number;
    pending: number;
    processing: number;
    completed: number;
    cancelled: number;
    averageValue: number;
  };
  customers: {
    total: number;
    active: number;
    new: number;
    returning: number;
  };
  products: {
    total: number;
    lowStock: number;
    outOfStock: number;
    topSelling: Array<{
      id: string;
      name: string;
      sales: number;
      revenue: number;
    }>;
  };
  inventory: {
    totalValue: number;
    turnoverRate: number;
    alerts: number;
  };
}

export const DashboardOverview: React.FC = () => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // 실시간 데이터 업데이트
  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const response = await fetch('/api/v1/dashboard/metrics');
        const data = await response.json();
        
        if (data.success) {
          setMetrics(data.data);
          setLastUpdated(new Date());
        }
      } catch (error) {
        console.error('Failed to fetch dashboard metrics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();

    // 30초마다 업데이트
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg shadow p-6 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
              <div className="h-8 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-1/3"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">대시보드 데이터를 불러올 수 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>
          <p className="text-gray-500 text-sm mt-1">
            마지막 업데이트: {lastUpdated.toLocaleTimeString('ko-KR')}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 text-green-600">
            <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium">실시간</span>
          </div>
        </div>
      </div>

      {/* 핵심 메트릭스 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="오늘 매출"
          value={metrics.sales.today}
          format="currency"
          change={metrics.sales.growth.daily}
          icon={<DollarSign className="w-6 h-6" />}
          color="blue"
        />
        
        <MetricCard
          title="총 주문"
          value={metrics.orders.total}
          format="number"
          change={0} // 계산 필요
          icon={<ShoppingCart className="w-6 h-6" />}
          color="green"
        />
        
        <MetricCard
          title="활성 고객"
          value={metrics.customers.active}
          format="number"
          change={0} // 계산 필요
          icon={<Users className="w-6 h-6" />}
          color="purple"
        />
        
        <MetricCard
          title="재고 알림"
          value={metrics.inventory.alerts}
          format="number"
          change={0}
          icon={<AlertTriangle className="w-6 h-6" />}
          color="orange"
          alert={metrics.inventory.alerts > 0}
        />
      </div>

      {/* 차트 및 상세 정보 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 실시간 매출 차트 */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">실시간 매출</h3>
              <div className="flex items-center space-x-2">
                <BarChart3 className="w-5 h-5 text-gray-400" />
                <span className="text-sm text-gray-500">오늘</span>
              </div>
            </div>
            <RealtimeChart />
          </div>
        </div>

        {/* 빠른 통계 */}
        <div className="space-y-6">
          <QuickStats metrics={metrics} />
          <RecentActivity />
        </div>
      </div>

      {/* 하단 섹션 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 인기 상품 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">인기 상품</h3>
          <TopProducts products={metrics.products.topSelling} />
        </div>

        {/* 주문 현황 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">주문 현황</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                <span className="text-gray-600">대기중</span>
              </div>
              <span className="font-semibold">{metrics.orders.pending}</span>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
                <span className="text-gray-600">처리중</span>
              </div>
              <span className="font-semibold">{metrics.orders.processing}</span>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                <span className="text-gray-600">완료</span>
              </div>
              <span className="font-semibold">{metrics.orders.completed}</span>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                <span className="text-gray-600">취소</span>
              </div>
              <span className="font-semibold">{metrics.orders.cancelled}</span>
            </div>
          </div>
          
          <div className="mt-6 pt-4 border-t">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">평균 주문 금액</span>
              <span className="font-semibold">
                ₩{metrics.orders.averageValue.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};