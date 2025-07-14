import React, { useState, useEffect } from 'react';
import { 
  ShoppingCart, 
  User, 
  Package, 
  AlertTriangle, 
  CheckCircle,
  Clock
} from 'lucide-react';

interface ActivityItem {
  id: string;
  type: 'order' | 'user' | 'inventory' | 'alert';
  title: string;
  description: string;
  timestamp: Date;
  status?: 'success' | 'warning' | 'error' | 'info';
}

export const RecentActivity: React.FC = () => {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 실제로는 API에서 데이터를 가져와야 함
    const mockActivities: ActivityItem[] = [
      {
        id: '1',
        type: 'order',
        title: '새 주문 접수',
        description: '김철수님이 ₩125,000 주문을 완료했습니다',
        timestamp: new Date(Date.now() - 5 * 60 * 1000),
        status: 'success'
      },
      {
        id: '2',
        type: 'user',
        title: '신규 회원 가입',
        description: '이영희님이 회원가입을 완료했습니다',
        timestamp: new Date(Date.now() - 12 * 60 * 1000),
        status: 'info'
      },
      {
        id: '3',
        type: 'inventory',
        title: '재고 부족 알림',
        description: 'iPhone 14 Pro의 재고가 5개 이하입니다',
        timestamp: new Date(Date.now() - 25 * 60 * 1000),
        status: 'warning'
      },
      {
        id: '4',
        type: 'order',
        title: '주문 취소',
        description: '주문 #ORD-2024-001이 취소되었습니다',
        timestamp: new Date(Date.now() - 35 * 60 * 1000),
        status: 'error'
      },
      {
        id: '5',
        type: 'alert',
        title: '시스템 알림',
        description: '결제 게이트웨이 연결이 복구되었습니다',
        timestamp: new Date(Date.now() - 45 * 60 * 1000),
        status: 'success'
      }
    ];

    setTimeout(() => {
      setActivities(mockActivities);
      setLoading(false);
    }, 1000);

    // WebSocket으로 실시간 활동 업데이트
    const ws = new WebSocket(`ws://${window.location.host}`);
    
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      if (message.type === 'dashboard:newOrder') {
        const newActivity: ActivityItem = {
          id: Math.random().toString(),
          type: 'order',
          title: '새 주문 접수',
          description: `₩${message.data.total?.toLocaleString()} 주문이 접수되었습니다`,
          timestamp: new Date(),
          status: 'success'
        };
        
        setActivities(prev => [newActivity, ...prev.slice(0, 9)]);
      }
    };

    return () => ws.close();
  }, []);

  const getIcon = (type: string, status?: string) => {
    const baseClass = "w-5 h-5";
    
    switch (type) {
      case 'order':
        return <ShoppingCart className={`${baseClass} text-blue-500`} />;
      case 'user':
        return <User className={`${baseClass} text-green-500`} />;
      case 'inventory':
        return <Package className={`${baseClass} text-orange-500`} />;
      case 'alert':
        if (status === 'success') {
          return <CheckCircle className={`${baseClass} text-green-500`} />;
        }
        return <AlertTriangle className={`${baseClass} text-red-500`} />;
      default:
        return <Clock className={`${baseClass} text-gray-500`} />;
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'success':
        return 'border-l-green-400 bg-green-50';
      case 'warning':
        return 'border-l-orange-400 bg-orange-50';
      case 'error':
        return 'border-l-red-400 bg-red-50';
      case 'info':
      default:
        return 'border-l-blue-400 bg-blue-50';
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    
    if (minutes < 1) return '방금 전';
    if (minutes < 60) return `${minutes}분 전`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}시간 전`;
    
    const days = Math.floor(hours / 24);
    return `${days}일 전`;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">최근 활동</h3>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-1"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">최근 활동</h3>
        <div className="flex items-center space-x-2 text-green-600">
          <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse"></div>
          <span className="text-sm">실시간</span>
        </div>
      </div>
      
      <div className="space-y-3 max-h-80 overflow-y-auto">
        {activities.map((activity) => (
          <div
            key={activity.id}
            className={`border-l-4 pl-4 py-3 rounded-r-lg transition-all hover:shadow-sm ${getStatusColor(activity.status)}`}
          >
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 mt-0.5">
                {getIcon(activity.type, activity.status)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {activity.title}
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  {activity.description}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {formatTimestamp(activity.timestamp)}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {activities.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <Clock className="w-12 h-12 mx-auto mb-2 text-gray-300" />
          <p>최근 활동이 없습니다</p>
        </div>
      )}
      
      <div className="mt-4 pt-4 border-t">
        <button className="w-full text-sm text-blue-600 hover:text-blue-800 font-medium">
          모든 활동 보기
        </button>
      </div>
    </div>
  );
};