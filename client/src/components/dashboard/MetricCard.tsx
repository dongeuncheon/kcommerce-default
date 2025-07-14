import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: number;
  format: 'currency' | 'number' | 'percentage';
  change?: number;
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'purple' | 'orange' | 'red';
  alert?: boolean;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  format,
  change,
  icon,
  color,
  alert = false
}) => {
  const formatValue = (val: number, fmt: string) => {
    switch (fmt) {
      case 'currency':
        return `₩${val.toLocaleString()}`;
      case 'percentage':
        return `${val.toFixed(1)}%`;
      case 'number':
      default:
        return val.toLocaleString();
    }
  };

  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
    red: 'bg-red-50 text-red-600'
  };

  const iconBg = alert ? 'bg-red-50 text-red-600' : colorClasses[color];

  return (
    <div className={`bg-white rounded-lg shadow p-6 ${alert ? 'ring-2 ring-red-200' : ''}`}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm text-gray-600 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-900">
            {formatValue(value, format)}
          </p>
          
          {change !== undefined && (
            <div className="flex items-center mt-2">
              {change >= 0 ? (
                <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-500 mr-1" />
              )}
              <span className={`text-sm font-medium ${
                change >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {change >= 0 ? '+' : ''}{change.toFixed(1)}%
              </span>
              <span className="text-xs text-gray-500 ml-1">전일 대비</span>
            </div>
          )}
        </div>
        
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${iconBg}`}>
          {icon}
        </div>
      </div>
    </div>
  );
};