import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  FileText, 
  Calendar, 
  TrendingUp, 
  Download,
  Clock,
  Target,
  Database
} from 'lucide-react';
import { ReportGenerator } from './ReportGenerator';

interface DashboardSummary {
  totalReports: number;
  recentReports: any[];
  reportsByType: Record<string, number>;
  reportsByFormat: Record<string, number>;
  totalSize: number;
  availableTemplates: number;
}

export const ReportDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'generator' | 'templates'>('overview');
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (activeTab === 'overview') {
      loadDashboardSummary();
    }
  }, [activeTab]);

  const loadDashboardSummary = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/v1/reports/dashboard');
      const data = await response.json();
      if (data.success) {
        setSummary(data.data);
      }
    } catch (error) {
      console.error('Failed to load dashboard summary:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getTypeDisplayName = (type: string): string => {
    const names: Record<string, string> = {
      daily: '일일',
      weekly: '주간',
      monthly: '월간',
      quarterly: '분기',
      yearly: '연간',
      custom: '사용자 정의'
    };
    return names[type] || type;
  };

  const getFormatDisplayName = (format: string): string => {
    const names: Record<string, string> = {
      pdf: 'PDF',
      excel: 'Excel',
      csv: 'CSV',
      json: 'JSON'
    };
    return names[format] || format.toUpperCase();
  };

  const renderOverview = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      );
    }

    if (!summary) {
      return (
        <div className="text-center py-8 text-gray-500">
          <FileText className="w-12 h-12 mx-auto mb-2 text-gray-300" />
          <p>대시보드 데이터를 불러올 수 없습니다</p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* 주요 메트릭 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <FileText className="w-8 h-8 text-blue-600" />
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-900">{summary.totalReports}</h3>
                <p className="text-sm text-gray-600">총 리포트 수</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Target className="w-8 h-8 text-green-600" />
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-900">{summary.availableTemplates}</h3>
                <p className="text-sm text-gray-600">사용 가능한 템플릿</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Database className="w-8 h-8 text-purple-600" />
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-900">{formatFileSize(summary.totalSize)}</h3>
                <p className="text-sm text-gray-600">총 파일 크기</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <TrendingUp className="w-8 h-8 text-orange-600" />
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-900">{summary.recentReports.length}</h3>
                <p className="text-sm text-gray-600">최근 리포트</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 리포트 타입별 분포 */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">리포트 타입별 분포</h3>
            <div className="space-y-3">
              {Object.entries(summary.reportsByType).map(([type, count]) => {
                const total = Object.values(summary.reportsByType).reduce((a, b) => a + b, 0);
                const percentage = total > 0 ? (count / total) * 100 : 0;
                
                return (
                  <div key={type} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                      <span className="text-sm font-medium text-gray-700">{getTypeDisplayName(type)}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                      <span className="text-sm text-gray-600 w-8">{count}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 포맷별 분포 */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">포맷별 분포</h3>
            <div className="space-y-3">
              {Object.entries(summary.reportsByFormat).map(([format, count]) => {
                const total = Object.values(summary.reportsByFormat).reduce((a, b) => a + b, 0);
                const percentage = total > 0 ? (count / total) * 100 : 0;
                
                return (
                  <div key={format} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      <span className="text-sm font-medium text-gray-700">{getFormatDisplayName(format)}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-green-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                      <span className="text-sm text-gray-600 w-8">{count}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 최근 리포트 */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">최근 생성된 리포트</h3>
            <button
              onClick={loadDashboardSummary}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              새로고침
            </button>
          </div>

          {summary.recentReports.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>최근 생성된 리포트가 없습니다</p>
            </div>
          ) : (
            <div className="space-y-3">
              {summary.recentReports.map((report, index) => (
                <div key={index} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <FileText className="w-5 h-5 text-gray-400" />
                    <div>
                      <h4 className="font-medium text-gray-900">{report.name}</h4>
                      <div className="flex items-center space-x-2 text-sm text-gray-600">
                        <span>{getTypeDisplayName(report.type)}</span>
                        <span>•</span>
                        <span>{getFormatDisplayName(report.format)}</span>
                        <span>•</span>
                        <span>{formatFileSize(report.size)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <Clock className="w-4 h-4" />
                    <span>{new Date(report.generatedAt).toLocaleDateString('ko-KR')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* 탭 네비게이션 */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'overview'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center space-x-2">
              <BarChart3 className="w-4 h-4" />
              <span>개요</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('generator')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'generator'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center space-x-2">
              <FileText className="w-4 h-4" />
              <span>리포트 생성</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'templates'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4" />
              <span>템플릿 관리</span>
            </div>
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'generator' && <ReportGenerator />}
          {activeTab === 'templates' && (
            <div className="text-center py-8 text-gray-500">
              <Calendar className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>템플릿 관리 기능은 준비 중입니다</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};