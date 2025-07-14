import React from 'react';
import { ReportDashboard } from '../../components/reports/ReportDashboard';

export const ReportsPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">리포트 관리</h1>
          <p className="mt-2 text-gray-600">
            비즈니스 리포트를 생성하고 관리합니다. 다양한 형태의 분석 리포트를 자동으로 생성할 수 있습니다.
          </p>
        </div>
        
        <ReportDashboard />
      </div>
    </div>
  );
};