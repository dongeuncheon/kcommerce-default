import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  AlertCircle, 
  Users, 
  ShoppingCart, 
  Package, 
  TrendingUp,
  Clock,
  RefreshCw
} from 'lucide-react';

interface DashboardData {
  timestamp: string;
  uptime: number;
  summary: {
    totalRequests: number;
    blockedRequests: number;
    activeUsers: number;
    totalErrors: number;
    criticalErrors: number;
    openCircuitBreakers: number;
  };
  health: {
    rateLimiting: { status: string; blockRate: number };
    circuitBreakers: { status: string; openCount: number };
    errors: { status: string; hourlyRate: number };
  };
  recentActivity: {
    topAbusers: any[];
    topErrorEndpoints: any[];
    recentErrors: number;
  };
  system: {
    memory: { used: number; total: number };
    cpu: any;
  };
}

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboard = async () => {
    try {
      setRefreshing(true);
      const response = await api.get('/admin/dashboard');
      setDashboard(response.data);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load dashboard');
      if (err.response?.status === 401) {
        navigate('/login');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600';
      case 'warning': return 'text-yellow-600';
      case 'critical': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  if (loading && !dashboard) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-gray-600 mt-2">System overview and monitoring</p>
          </div>
          <Button 
            onClick={fetchDashboard} 
            disabled={refreshing}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {dashboard && (
          <>
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{dashboard.summary.totalRequests.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">
                    {dashboard.summary.blockedRequests} blocked
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Users</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{dashboard.summary.activeUsers}</div>
                  <p className="text-xs text-muted-foreground">Currently active</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Errors</CardTitle>
                  <AlertCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{dashboard.summary.totalErrors}</div>
                  <p className="text-xs text-red-600">
                    {dashboard.summary.criticalErrors} critical
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Uptime</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatUptime(dashboard.uptime)}</div>
                  <p className="text-xs text-muted-foreground">Since last restart</p>
                </CardContent>
              </Card>
            </div>

            {/* Health Status */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>System Health</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <h4 className="font-medium mb-2">Rate Limiting</h4>
                    <p className={`font-semibold ${getStatusColor(dashboard.health.rateLimiting.status)}`}>
                      {dashboard.health.rateLimiting.status.toUpperCase()}
                    </p>
                    <p className="text-sm text-gray-600">
                      Block rate: {(dashboard.health.rateLimiting.blockRate * 100).toFixed(2)}%
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Circuit Breakers</h4>
                    <p className={`font-semibold ${getStatusColor(dashboard.health.circuitBreakers.status)}`}>
                      {dashboard.health.circuitBreakers.status.toUpperCase()}
                    </p>
                    <p className="text-sm text-gray-600">
                      {dashboard.health.circuitBreakers.openCount} open
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Error Rate</h4>
                    <p className={`font-semibold ${getStatusColor(dashboard.health.errors.status)}`}>
                      {dashboard.health.errors.status.toUpperCase()}
                    </p>
                    <p className="text-sm text-gray-600">
                      {dashboard.health.errors.hourlyRate} errors/hour
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* System Resources */}
            <Card>
              <CardHeader>
                <CardTitle>System Resources</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium">Memory Usage</span>
                      <span className="text-sm text-gray-600">
                        {dashboard.system.memory.used}MB / {dashboard.system.memory.total}MB
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${(dashboard.system.memory.used / dashboard.system.memory.total) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <div className="mt-8 flex gap-4">
              <Button variant="outline" onClick={() => navigate('/admin/rate-limits')}>
                Manage Rate Limits
              </Button>
              <Button variant="outline" onClick={() => navigate('/admin/circuit-breakers')}>
                Circuit Breakers
              </Button>
              <Button variant="outline" onClick={() => navigate('/admin/errors')}>
                Error Logs
              </Button>
              <Button variant="outline" onClick={() => navigate('/admin/api-versions')}>
                API Versions
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}