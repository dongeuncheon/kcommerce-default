import React from 'react';
import { Package, AlertTriangle, TrendingUp, Users } from 'lucide-react';

interface QuickStatsProps {
  metrics: {
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
  };
}

export const QuickStats: React.FC<QuickStatsProps> = ({ metrics }) => {
  const stats = [
    {
      title: '이번 주 매출',
      value: `₩${metrics.sales.thisWeek.toLocaleString()}`,
      change: metrics.sales.growth.weekly,
      icon: <TrendingUp className="w-5 h-5" />,
      color: 'blue'
    },
    {
      title: '신규 고객',
      value: metrics.customers.new.toString(),
      change: 0, // 계산 필요
      icon: <Users className="w-5 h-5" />,
      color: 'green'
    },
    {
      title: '재고 부족',
      value: metrics.products.lowStock.toString(),
      change: 0,
      icon: <Package className="w-5 h-5" />,
      color: 'orange',
      alert: metrics.products.lowStock > 0
    },
    {
      title: '품절 상품',
      value: metrics.products.outOfStock.toString(),
      change: 0,
      icon: <AlertTriangle className="w-5 h-5" />,
      color: 'red',
      alert: metrics.products.outOfStock > 0
    }
  ];

  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    orange: 'bg-orange-50 text-orange-600',
    red: 'bg-red-50 text-red-600'
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">빠른 통계</h3>
      
      <div className="space-y-4">
        {stats.map((stat, index) => (
          <div key={index} className={`flex items-center justify-between p-3 rounded-lg ${
            stat.alert ? 'bg-red-50 border border-red-200' : 'bg-gray-50'
          }`}>
            <div className="flex items-center space-x-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                stat.alert ? 'bg-red-100 text-red-600' : colorClasses[stat.color as keyof typeof colorClasses]
              }`}>
                {stat.icon}
              </div>
              <div>
                <p className="text-sm text-gray-600">{stat.title}</p>
                <p className="font-semibold text-gray-900">{stat.value}</p>
              </div>
            </div>
            
            {stat.change !== 0 && (
              <div className={`text-sm font-medium ${
                stat.change >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {stat.change >= 0 ? '+' : ''}{stat.change.toFixed(1)}%
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 추가 인사이트 */}
      <div className="mt-6 pt-4 border-t">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-600">재고 총 가치</p>
            <p className="font-semibold">₩{metrics.inventory.totalValue.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-gray-600">활성 고객</p>
            <p className="font-semibold">{metrics.customers.active}</p>
          </div>
        </div>
      </div>
    </div>
  );
};