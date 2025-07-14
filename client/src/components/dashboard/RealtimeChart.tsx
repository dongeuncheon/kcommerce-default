import React, { useState, useEffect, useRef } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface ChartDataPoint {
  timestamp: Date;
  value: number;
}

export const RealtimeChart: React.FC = () => {
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('today');
  const [loading, setLoading] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);

  // 초기 데이터 로드
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/v1/dashboard/sales/realtime?period=${period}`);
        const data = await response.json();
        
        if (data.success) {
          setChartData(data.data.sales);
        }
      } catch (error) {
        console.error('Failed to fetch chart data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, [period]);

  // WebSocket 연결
  useEffect(() => {
    const connectWebSocket = () => {
      const ws = new WebSocket(`ws://${window.location.host}`);
      
      ws.onopen = () => {
        console.log('Dashboard WebSocket connected');
        // 대시보드 구독
        ws.send(JSON.stringify({ type: 'subscribe:dashboard' }));
      };

      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        
        if (message.type === 'dashboard:newOrder') {
          // 새 주문 시 차트 업데이트
          updateChartWithNewOrder(message.data);
        }
      };

      ws.onclose = () => {
        console.log('Dashboard WebSocket disconnected');
        // 3초 후 재연결 시도
        setTimeout(connectWebSocket, 3000);
      };

      wsRef.current = ws;
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const updateChartWithNewOrder = (orderData: any) => {
    const now = new Date();
    setChartData(prev => {
      const updated = [...prev];
      const lastIndex = updated.length - 1;
      
      if (lastIndex >= 0) {
        updated[lastIndex] = {
          ...updated[lastIndex],
          value: updated[lastIndex].value + (orderData.total || 0)
        };
      }
      
      return updated;
    });
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      intersect: false,
      mode: 'index' as const
    },
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: 'white',
        bodyColor: 'white',
        borderColor: 'rgba(59, 130, 246, 0.5)',
        borderWidth: 1,
        callbacks: {
          title: (context: any) => {
            const date = new Date(context[0].label);
            return date.toLocaleString('ko-KR');
          },
          label: (context: any) => {
            return `매출: ₩${context.raw.toLocaleString()}`;
          }
        }
      }
    },
    scales: {
      x: {
        display: true,
        grid: {
          display: false
        },
        ticks: {
          callback: function(value: any, index: number) {
            const data = chartData[index];
            if (!data) return '';
            
            const date = new Date(data.timestamp);
            if (period === 'today') {
              return date.getHours() + ':00';
            } else if (period === 'week') {
              return date.toLocaleDateString('ko-KR', { weekday: 'short' });
            } else {
              return date.getDate() + '일';
            }
          }
        }
      },
      y: {
        display: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.05)'
        },
        ticks: {
          callback: function(value: any) {
            return '₩' + value.toLocaleString();
          }
        }
      }
    },
    elements: {
      point: {
        radius: 0,
        hoverRadius: 8
      },
      line: {
        tension: 0.3
      }
    }
  };

  const chartDataConfig = {
    labels: chartData.map(point => point.timestamp.toISOString()),
    datasets: [
      {
        label: '매출',
        data: chartData.map(point => point.value),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        borderWidth: 2
      }
    ]
  };

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 기간 선택 */}
      <div className="flex space-x-2">
        {[
          { key: 'today', label: '오늘' },
          { key: 'week', label: '이번 주' },
          { key: 'month', label: '이번 달' }
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setPeriod(key as any)}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              period === key
                ? 'bg-blue-100 text-blue-700 font-medium'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 차트 */}
      <div className="h-64">
        <Line data={chartDataConfig} options={chartOptions} />
      </div>

      {/* 실시간 표시 */}
      <div className="flex items-center justify-between text-sm text-gray-500">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span>실시간 업데이트</span>
        </div>
        <span>
          총 매출: ₩{chartData.reduce((sum, point) => sum + point.value, 0).toLocaleString()}
        </span>
      </div>
    </div>
  );
};