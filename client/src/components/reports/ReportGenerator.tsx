import React, { useState, useEffect } from 'react';
import { FileText, Download, Calendar, Settings, PlayCircle, Eye } from 'lucide-react';

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  type: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';
  sections: any[];
  isActive: boolean;
}

interface GeneratedReport {
  id: string;
  templateId: string;
  name: string;
  type: string;
  format: string;
  filePath: string;
  generatedAt: Date;
  size: number;
  status: 'generating' | 'completed' | 'failed';
}

export const ReportGenerator: React.FC = () => {
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [reports, setReports] = useState<GeneratedReport[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [selectedFormat, setSelectedFormat] = useState<string>('pdf');
  const [customPeriod, setCustomPeriod] = useState({
    startDate: '',
    endDate: ''
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTemplates();
    loadReports();
  }, []);

  const loadTemplates = async () => {
    try {
      const response = await fetch('/api/v1/reports/templates');
      const data = await response.json();
      if (data.success) {
        setTemplates(data.data);
      }
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
  };

  const loadReports = async () => {
    try {
      const response = await fetch('/api/v1/reports');
      const data = await response.json();
      if (data.success) {
        setReports(data.data.reports);
      }
      setLoading(false);
    } catch (error) {
      console.error('Failed to load reports:', error);
      setLoading(false);
    }
  };

  const generateReport = async () => {
    if (!selectedTemplate) {
      alert('리포트 템플릿을 선택해주세요.');
      return;
    }

    setIsGenerating(true);
    try {
      const payload: any = {
        templateId: selectedTemplate,
        format: selectedFormat
      };

      if (customPeriod.startDate && customPeriod.endDate) {
        payload.startDate = customPeriod.startDate;
        payload.endDate = customPeriod.endDate;
      }

      const response = await fetch('/api/v1/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (data.success) {
        alert('리포트가 성공적으로 생성되었습니다.');
        loadReports(); // 리포트 목록 새로고침
      } else {
        alert(`리포트 생성에 실패했습니다: ${data.error}`);
      }
    } catch (error) {
      console.error('Report generation error:', error);
      alert('리포트 생성 중 오류가 발생했습니다.');
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadReport = async (reportId: string, reportName: string) => {
    try {
      const response = await fetch(`/api/v1/reports/${reportId}/download`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = reportName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        alert('리포트 다운로드에 실패했습니다.');
      }
    } catch (error) {
      console.error('Download error:', error);
      alert('다운로드 중 오류가 발생했습니다.');
    }
  };

  const previewReport = async (templateId: string) => {
    try {
      const queryParams = new URLSearchParams();
      if (customPeriod.startDate) queryParams.append('startDate', customPeriod.startDate);
      if (customPeriod.endDate) queryParams.append('endDate', customPeriod.endDate);

      const response = await fetch(`/api/v1/reports/templates/${templateId}/preview?${queryParams}`);
      const data = await response.json();
      
      if (data.success) {
        // 미리보기 모달이나 새 창으로 데이터 표시
        const previewWindow = window.open('', '_blank');
        if (previewWindow) {
          previewWindow.document.write(`
            <html>
              <head>
                <title>리포트 미리보기</title>
                <style>
                  body { font-family: Arial, sans-serif; padding: 20px; }
                  pre { background: #f5f5f5; padding: 15px; border-radius: 5px; overflow: auto; }
                </style>
              </head>
              <body>
                <h1>리포트 미리보기</h1>
                <pre>${JSON.stringify(data.data, null, 2)}</pre>
              </body>
            </html>
          `);
        }
      } else {
        alert('미리보기 생성에 실패했습니다.');
      }
    } catch (error) {
      console.error('Preview error:', error);
      alert('미리보기 중 오류가 발생했습니다.');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getReportTypeColor = (type: string): string => {
    const colors: Record<string, string> = {
      daily: 'bg-green-100 text-green-800',
      weekly: 'bg-blue-100 text-blue-800',
      monthly: 'bg-purple-100 text-purple-800',
      quarterly: 'bg-orange-100 text-orange-800',
      yearly: 'bg-red-100 text-red-800',
      custom: 'bg-gray-100 text-gray-800'
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  const getStatusColor = (status: string): string => {
    const colors: Record<string, string> = {
      generating: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 리포트 생성 섹션 */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center space-x-2 mb-6">
          <FileText className="w-6 h-6 text-blue-600" />
          <h2 className="text-xl font-semibold text-gray-900">리포트 생성</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 템플릿 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              리포트 템플릿
            </label>
            <select
              value={selectedTemplate}
              onChange={(e) => setSelectedTemplate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">템플릿을 선택하세요</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name} ({template.type})
                </option>
              ))}
            </select>
            {selectedTemplate && (
              <p className="mt-2 text-sm text-gray-600">
                {templates.find(t => t.id === selectedTemplate)?.description}
              </p>
            )}
          </div>

          {/* 포맷 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              출력 포맷
            </label>
            <select
              value={selectedFormat}
              onChange={(e) => setSelectedFormat(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="pdf">PDF</option>
              <option value="excel">Excel (XLSX)</option>
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
            </select>
          </div>

          {/* 기간 설정 */}
          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              사용자 정의 기간 (선택사항)
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">시작일</label>
                <input
                  type="date"
                  value={customPeriod.startDate}
                  onChange={(e) => setCustomPeriod(prev => ({ ...prev, startDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">종료일</label>
                <input
                  type="date"
                  value={customPeriod.endDate}
                  onChange={(e) => setCustomPeriod(prev => ({ ...prev, endDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 액션 버튼 */}
        <div className="flex justify-between items-center mt-6 pt-6 border-t">
          <button
            onClick={() => selectedTemplate && previewReport(selectedTemplate)}
            disabled={!selectedTemplate}
            className="flex items-center space-x-2 px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Eye className="w-4 h-4" />
            <span>미리보기</span>
          </button>

          <button
            onClick={generateReport}
            disabled={!selectedTemplate || isGenerating}
            className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <PlayCircle className="w-4 h-4" />
            <span>{isGenerating ? '생성 중...' : '리포트 생성'}</span>
          </button>
        </div>
      </div>

      {/* 최근 생성된 리포트 */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">최근 생성된 리포트</h3>
          <button
            onClick={loadReports}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            새로고침
          </button>
        </div>

        {reports.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-2 text-gray-300" />
            <p>생성된 리포트가 없습니다</p>
          </div>
        ) : (
          <div className="space-y-4">
            {reports.slice(0, 10).map((report) => (
              <div key={report.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <h4 className="font-medium text-gray-900">{report.name}</h4>
                    <span className={`px-2 py-1 text-xs rounded-full ${getReportTypeColor(report.type)}`}>
                      {report.type}
                    </span>
                    <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(report.status)}`}>
                      {report.status === 'generating' ? '생성중' : 
                       report.status === 'completed' ? '완료' : '실패'}
                    </span>
                  </div>
                  <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600">
                    <span>형식: {report.format.toUpperCase()}</span>
                    <span>크기: {formatFileSize(report.size)}</span>
                    <span>생성일: {new Date(report.generatedAt).toLocaleString('ko-KR')}</span>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {report.status === 'completed' && (
                    <button
                      onClick={() => downloadReport(report.id, `${report.name}.${report.format}`)}
                      className="flex items-center space-x-1 px-3 py-1 text-sm text-blue-600 border border-blue-200 rounded hover:bg-blue-50"
                    >
                      <Download className="w-4 h-4" />
                      <span>다운로드</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 사용 가능한 템플릿 */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center space-x-2 mb-6">
          <Settings className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">사용 가능한 템플릿</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => (
            <div 
              key={template.id} 
              className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                selectedTemplate === template.id 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => setSelectedTemplate(template.id)}
            >
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-gray-900">{template.name}</h4>
                <span className={`px-2 py-1 text-xs rounded-full ${getReportTypeColor(template.type)}`}>
                  {template.type}
                </span>
              </div>
              <p className="text-sm text-gray-600 mb-3">{template.description}</p>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{template.sections.length}개 섹션</span>
                <span className={template.isActive ? 'text-green-600' : 'text-red-600'}>
                  {template.isActive ? '활성' : '비활성'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};