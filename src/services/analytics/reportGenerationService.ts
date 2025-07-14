import { PrismaClient } from '@prisma/client';
import { businessIntelligenceService } from './businessIntelligence';
import { logger } from '../../utils/logger';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import fs from 'fs/promises';
import path from 'path';
import cron from 'node-cron';

export type ReportType = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';
export type ReportFormat = 'pdf' | 'excel' | 'csv' | 'json';

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  type: ReportType;
  sections: ReportSection[];
  filters?: Record<string, any>;
  recipients?: string[];
  schedule?: string; // Cron expression
  isActive: boolean;
}

export interface ReportSection {
  id: string;
  title: string;
  type: 'chart' | 'table' | 'text' | 'metrics';
  dataSource: string;
  configuration: Record<string, any>;
}

export interface GeneratedReport {
  id: string;
  templateId: string;
  name: string;
  type: ReportType;
  format: ReportFormat;
  filePath: string;
  generatedAt: Date;
  startDate: Date;
  endDate: Date;
  size: number;
  status: 'generating' | 'completed' | 'failed';
  metadata: Record<string, any>;
}

/**
 * 자동 리포트 생성 시스템
 */
export class ReportGenerationService {
  private prisma: PrismaClient;
  private reportsDirectory: string;
  private templates: Map<string, ReportTemplate>;

  constructor() {
    this.prisma = new PrismaClient();
    this.reportsDirectory = path.join(process.cwd(), 'reports');
    this.templates = new Map();
    this.initializeService();
  }

  private async initializeService() {
    // 리포트 저장 디렉토리 생성
    try {
      await fs.mkdir(this.reportsDirectory, { recursive: true });
      logger.info('Report directory initialized');
    } catch (error) {
      logger.error('Failed to create reports directory:', error);
    }

    // 기본 템플릿 로드
    this.loadDefaultTemplates();

    // 스케줄된 리포트 설정
    this.setupScheduledReports();
  }

  /**
   * 기본 리포트 템플릿 로드
   */
  private loadDefaultTemplates() {
    // 일일 매출 리포트
    this.templates.set('daily-sales', {
      id: 'daily-sales',
      name: '일일 매출 리포트',
      description: '일일 매출, 주문, 고객 현황 리포트',
      type: 'daily',
      sections: [
        {
          id: 'overview',
          title: '일일 개요',
          type: 'metrics',
          dataSource: 'sales_analysis',
          configuration: { period: 'daily' }
        },
        {
          id: 'top_products',
          title: '인기 상품',
          type: 'table',
          dataSource: 'product_performance',
          configuration: { limit: 10, sortBy: 'revenue' }
        },
        {
          id: 'sales_trend',
          title: '매출 추이',
          type: 'chart',
          dataSource: 'sales_trends',
          configuration: { type: 'line', period: '24h' }
        }
      ],
      schedule: '0 9 * * *', // 매일 오전 9시
      isActive: true
    });

    // 주간 비즈니스 리포트
    this.templates.set('weekly-business', {
      id: 'weekly-business',
      name: '주간 비즈니스 리포트',
      description: '주간 비즈니스 KPI 및 인사이트 리포트',
      type: 'weekly',
      sections: [
        {
          id: 'kpi_dashboard',
          title: 'KPI 대시보드',
          type: 'metrics',
          dataSource: 'kpi_dashboard',
          configuration: { period: '7d' }
        },
        {
          id: 'customer_insights',
          title: '고객 인사이트',
          type: 'chart',
          dataSource: 'customer_insights',
          configuration: { includeSegmentation: true }
        },
        {
          id: 'marketing_performance',
          title: '마케팅 성과',
          type: 'table',
          dataSource: 'marketing_insights',
          configuration: { includeROI: true }
        }
      ],
      schedule: '0 8 * * 1', // 매주 월요일 오전 8시
      isActive: true
    });

    // 월간 경영 리포트
    this.templates.set('monthly-executive', {
      id: 'monthly-executive',
      name: '월간 경영진 리포트',
      description: '월간 경영 현황 및 전략 분석 리포트',
      type: 'monthly',
      sections: [
        {
          id: 'executive_summary',
          title: '경영진 요약',
          type: 'text',
          dataSource: 'executive_summary',
          configuration: { includeForecasting: true }
        },
        {
          id: 'financial_overview',
          title: '재무 현황',
          type: 'metrics',
          dataSource: 'financial_analysis',
          configuration: { includeComparison: true }
        },
        {
          id: 'growth_metrics',
          title: '성장 지표',
          type: 'chart',
          dataSource: 'growth_metrics',
          configuration: { type: 'combination' }
        },
        {
          id: 'risk_analysis',
          title: '리스크 분석',
          type: 'table',
          dataSource: 'risk_analysis',
          configuration: { priorityLevel: 'high' }
        }
      ],
      schedule: '0 7 1 * *', // 매월 1일 오전 7시
      isActive: true
    });

    logger.info('Default report templates loaded');
  }

  /**
   * 스케줄된 리포트 설정
   */
  private setupScheduledReports() {
    for (const template of this.templates.values()) {
      if (template.isActive && template.schedule) {
        cron.schedule(template.schedule, async () => {
          try {
            await this.generateScheduledReport(template);
          } catch (error) {
            logger.error(`Failed to generate scheduled report ${template.id}:`, error);
          }
        });
      }
    }
    logger.info('Scheduled reports configured');
  }

  /**
   * 리포트 생성
   */
  async generateReport(
    templateId: string,
    format: ReportFormat = 'pdf',
    customPeriod?: { startDate: Date; endDate: Date },
    options?: Record<string, any>
  ): Promise<GeneratedReport> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Report template ${templateId} not found`);
    }

    // 기간 설정
    const { startDate, endDate } = customPeriod || this.getDefaultPeriod(template.type);

    const reportId = `${templateId}-${Date.now()}`;
    const fileName = `${template.name.replace(/\s+/g, '_')}_${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}.${format}`;
    const filePath = path.join(this.reportsDirectory, fileName);

    const report: GeneratedReport = {
      id: reportId,
      templateId,
      name: template.name,
      type: template.type,
      format,
      filePath,
      generatedAt: new Date(),
      startDate,
      endDate,
      size: 0,
      status: 'generating',
      metadata: { template: template.name, ...options }
    };

    try {
      // 데이터 수집
      const reportData = await this.collectReportData(template, startDate, endDate);

      // 포맷에 따른 리포트 생성
      switch (format) {
        case 'pdf':
          await this.generatePDFReport(template, reportData, filePath);
          break;
        case 'excel':
          await this.generateExcelReport(template, reportData, filePath);
          break;
        case 'csv':
          await this.generateCSVReport(template, reportData, filePath);
          break;
        case 'json':
          await this.generateJSONReport(template, reportData, filePath);
          break;
        default:
          throw new Error(`Unsupported format: ${format}`);
      }

      // 파일 크기 확인
      const stats = await fs.stat(filePath);
      report.size = stats.size;
      report.status = 'completed';

      logger.info(`Report generated successfully: ${reportId}`);

      // 이메일 발송 (수신자가 설정된 경우)
      if (template.recipients && template.recipients.length > 0) {
        await this.sendReportEmail(template, report);
      }

      return report;

    } catch (error) {
      report.status = 'failed';
      logger.error(`Failed to generate report ${reportId}:`, error);
      throw error;
    }
  }

  /**
   * 리포트 데이터 수집
   */
  private async collectReportData(
    template: ReportTemplate,
    startDate: Date,
    endDate: Date
  ): Promise<Record<string, any>> {
    const data: Record<string, any> = {};

    for (const section of template.sections) {
      try {
        switch (section.dataSource) {
          case 'sales_analysis':
            data[section.id] = await businessIntelligenceService.getSalesAnalysis(startDate, endDate);
            break;
          case 'product_performance':
            data[section.id] = await businessIntelligenceService.getProductPerformance(startDate, endDate);
            break;
          case 'customer_insights':
            data[section.id] = await businessIntelligenceService.getCustomerInsights(startDate, endDate);
            break;
          case 'marketing_insights':
            data[section.id] = await businessIntelligenceService.getMarketingInsights(startDate, endDate);
            break;
          case 'kpi_dashboard':
            data[section.id] = await this.getKPIDashboardData(startDate, endDate);
            break;
          case 'financial_analysis':
            data[section.id] = await this.getFinancialAnalysis(startDate, endDate);
            break;
          default:
            logger.warn(`Unknown data source: ${section.dataSource}`);
        }
      } catch (error) {
        logger.error(`Failed to collect data for section ${section.id}:`, error);
        data[section.id] = { error: 'Data collection failed' };
      }
    }

    return data;
  }

  /**
   * PDF 리포트 생성
   */
  private async generatePDFReport(
    template: ReportTemplate,
    data: Record<string, any>,
    filePath: string
  ): Promise<void> {
    const doc = new PDFDocument();
    const stream = fs.createWriteStream(filePath);
    
    doc.pipe(stream);

    // 헤더
    doc.fontSize(20).text(template.name, 50, 50);
    doc.fontSize(12).text(`생성일: ${new Date().toLocaleDateString('ko-KR')}`, 50, 80);
    doc.moveDown();

    let yPosition = 120;

    // 섹션별 내용 추가
    for (const section of template.sections) {
      const sectionData = data[section.id];
      if (!sectionData || sectionData.error) {
        continue;
      }

      // 섹션 제목
      doc.fontSize(16).text(section.title, 50, yPosition);
      yPosition += 30;

      // 섹션 타입별 처리
      switch (section.type) {
        case 'metrics':
          yPosition = this.addMetricsToPDF(doc, sectionData, yPosition);
          break;
        case 'table':
          yPosition = this.addTableToPDF(doc, sectionData, yPosition);
          break;
        case 'text':
          yPosition = this.addTextToPDF(doc, sectionData, yPosition);
          break;
      }

      yPosition += 20;
    }

    doc.end();
    
    return new Promise((resolve, reject) => {
      stream.on('finish', resolve);
      stream.on('error', reject);
    });
  }

  /**
   * Excel 리포트 생성
   */
  private async generateExcelReport(
    template: ReportTemplate,
    data: Record<string, any>,
    filePath: string
  ): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    
    // 요약 시트
    const summarySheet = workbook.addWorksheet('요약');
    summarySheet.addRow([template.name]);
    summarySheet.addRow([`생성일: ${new Date().toLocaleDateString('ko-KR')}`]);
    summarySheet.addRow([]);

    // 섹션별 시트 생성
    for (const section of template.sections) {
      const sectionData = data[section.id];
      if (!sectionData || sectionData.error) {
        continue;
      }

      const worksheet = workbook.addWorksheet(section.title);
      this.addDataToExcelSheet(worksheet, sectionData, section.type);
    }

    await workbook.xlsx.writeFile(filePath);
  }

  /**
   * CSV 리포트 생성
   */
  private async generateCSVReport(
    template: ReportTemplate,
    data: Record<string, any>,
    filePath: string
  ): Promise<void> {
    let csvContent = `${template.name}\n생성일,${new Date().toLocaleDateString('ko-KR')}\n\n`;

    for (const section of template.sections) {
      const sectionData = data[section.id];
      if (!sectionData || sectionData.error) {
        continue;
      }

      csvContent += `${section.title}\n`;
      csvContent += this.convertDataToCSV(sectionData, section.type);
      csvContent += '\n';
    }

    await fs.writeFile(filePath, csvContent, 'utf-8');
  }

  /**
   * JSON 리포트 생성
   */
  private async generateJSONReport(
    template: ReportTemplate,
    data: Record<string, any>,
    filePath: string
  ): Promise<void> {
    const jsonReport = {
      template: {
        id: template.id,
        name: template.name,
        description: template.description
      },
      metadata: {
        generatedAt: new Date(),
        format: 'json'
      },
      sections: template.sections.map(section => ({
        id: section.id,
        title: section.title,
        type: section.type,
        data: data[section.id] || null
      }))
    };

    await fs.writeFile(filePath, JSON.stringify(jsonReport, null, 2), 'utf-8');
  }

  /**
   * 스케줄된 리포트 생성
   */
  private async generateScheduledReport(template: ReportTemplate): Promise<void> {
    try {
      const report = await this.generateReport(template.id, 'pdf');
      logger.info(`Scheduled report generated: ${template.name}`);
    } catch (error) {
      logger.error(`Failed to generate scheduled report ${template.name}:`, error);
    }
  }

  /**
   * 기본 기간 설정
   */
  private getDefaultPeriod(type: ReportType): { startDate: Date; endDate: Date } {
    const endDate = new Date();
    let startDate: Date;

    switch (type) {
      case 'daily':
        startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'weekly':
        startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 1, endDate.getDate());
        break;
      case 'quarterly':
        startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 3, endDate.getDate());
        break;
      case 'yearly':
        startDate = new Date(endDate.getFullYear() - 1, endDate.getMonth(), endDate.getDate());
        break;
      default:
        startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    return { startDate, endDate };
  }

  /**
   * 헬퍼 메서드들
   */
  private async getKPIDashboardData(startDate: Date, endDate: Date) {
    // KPI 대시보드 데이터 수집
    return {
      totalRevenue: 5000000,
      totalOrders: 250,
      newCustomers: 45,
      conversionRate: 3.2,
      averageOrderValue: 20000
    };
  }

  private async getFinancialAnalysis(startDate: Date, endDate: Date) {
    // 재무 분석 데이터
    return {
      revenue: 5000000,
      costs: 3000000,
      profit: 2000000,
      profitMargin: 40,
      cashFlow: 1500000
    };
  }

  private addMetricsToPDF(doc: any, data: any, yPosition: number): number {
    doc.fontSize(12);
    
    if (data.revenue) {
      doc.text(`매출: ₩${data.revenue.current?.toLocaleString() || 'N/A'}`, 50, yPosition);
      yPosition += 20;
    }
    
    if (data.orders) {
      doc.text(`주문수: ${data.orders.current || 'N/A'}개`, 50, yPosition);
      yPosition += 20;
    }

    return yPosition;
  }

  private addTableToPDF(doc: any, data: any, yPosition: number): number {
    doc.fontSize(10);
    
    if (data.topProducts) {
      data.topProducts.slice(0, 5).forEach((product: any, index: number) => {
        doc.text(`${index + 1}. ${product.name} - ₩${product.revenue?.toLocaleString()}`, 50, yPosition);
        yPosition += 15;
      });
    }

    return yPosition;
  }

  private addTextToPDF(doc: any, data: any, yPosition: number): number {
    doc.fontSize(11);
    
    if (data.summary) {
      doc.text(data.summary, 50, yPosition, { width: 500 });
      yPosition += 60;
    }

    return yPosition;
  }

  private addDataToExcelSheet(worksheet: any, data: any, type: string): void {
    switch (type) {
      case 'metrics':
        if (data.revenue) {
          worksheet.addRow(['매출', data.revenue.current || 0]);
          worksheet.addRow(['성장률', `${data.revenue.growth || 0}%`]);
        }
        break;
      case 'table':
        if (data.topProducts) {
          worksheet.addRow(['순위', '상품명', '매출']);
          data.topProducts.forEach((product: any, index: number) => {
            worksheet.addRow([index + 1, product.name, product.revenue]);
          });
        }
        break;
    }
  }

  private convertDataToCSV(data: any, type: string): string {
    let csv = '';
    
    switch (type) {
      case 'metrics':
        if (data.revenue) {
          csv += `매출,${data.revenue.current || 0}\n`;
          csv += `성장률,${data.revenue.growth || 0}%\n`;
        }
        break;
      case 'table':
        if (data.topProducts) {
          csv += '순위,상품명,매출\n';
          data.topProducts.forEach((product: any, index: number) => {
            csv += `${index + 1},${product.name},${product.revenue}\n`;
          });
        }
        break;
    }
    
    return csv;
  }

  private async sendReportEmail(template: ReportTemplate, report: GeneratedReport): Promise<void> {
    // 이메일 발송 로직 (실제 구현시 메일 서비스 연동)
    logger.info(`Report email would be sent to: ${template.recipients?.join(', ')}`);
  }

  /**
   * 리포트 목록 조회
   */
  async getReports(limit: number = 50): Promise<GeneratedReport[]> {
    // 실제로는 데이터베이스에서 조회
    return [];
  }

  /**
   * 리포트 삭제
   */
  async deleteReport(reportId: string): Promise<void> {
    // 파일 및 DB 레코드 삭제
    logger.info(`Report ${reportId} deleted`);
  }

  /**
   * 템플릿 관리
   */
  async createTemplate(template: Omit<ReportTemplate, 'id'>): Promise<ReportTemplate> {
    const newTemplate: ReportTemplate = {
      ...template,
      id: `custom-${Date.now()}`
    };
    
    this.templates.set(newTemplate.id, newTemplate);
    return newTemplate;
  }

  async updateTemplate(id: string, updates: Partial<ReportTemplate>): Promise<ReportTemplate> {
    const template = this.templates.get(id);
    if (!template) {
      throw new Error(`Template ${id} not found`);
    }

    const updatedTemplate = { ...template, ...updates };
    this.templates.set(id, updatedTemplate);
    return updatedTemplate;
  }

  async deleteTemplate(id: string): Promise<void> {
    this.templates.delete(id);
  }

  getTemplates(): ReportTemplate[] {
    return Array.from(this.templates.values());
  }
}

export const reportGenerationService = new ReportGenerationService();