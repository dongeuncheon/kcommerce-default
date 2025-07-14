import { Request, Response } from 'express';
import { reportGenerationService, ReportFormat, ReportType } from '../../services/analytics/reportGenerationService';
import { logger } from '../../utils/logger';
import fs from 'fs/promises';
import path from 'path';

export class ReportController {
  /**
   * 리포트 생성
   */
  async generateReport(req: Request, res: Response) {
    try {
      const { 
        templateId, 
        format = 'pdf',
        startDate,
        endDate,
        options = {}
      } = req.body;

      if (!templateId) {
        return res.status(400).json({
          success: false,
          error: 'templateId는 필수 파라미터입니다.'
        });
      }

      // 유효한 포맷 확인
      const validFormats: ReportFormat[] = ['pdf', 'excel', 'csv', 'json'];
      if (!validFormats.includes(format)) {
        return res.status(400).json({
          success: false,
          error: '지원되지 않는 포맷입니다. (pdf, excel, csv, json 중 선택)'
        });
      }

      // 커스텀 기간 설정
      let customPeriod = undefined;
      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          return res.status(400).json({
            success: false,
            error: '올바른 날짜 형식이 아닙니다.'
          });
        }

        if (start >= end) {
          return res.status(400).json({
            success: false,
            error: '시작일은 종료일보다 이전이어야 합니다.'
          });
        }

        customPeriod = { startDate: start, endDate: end };
      }

      const report = await reportGenerationService.generateReport(
        templateId,
        format,
        customPeriod,
        options
      );

      res.json({
        success: true,
        data: report
      });
    } catch (error: any) {
      logger.error('Report generation error:', error);
      res.status(500).json({
        success: false,
        error: error.message || '리포트 생성 중 오류가 발생했습니다.'
      });
    }
  }

  /**
   * 리포트 다운로드
   */
  async downloadReport(req: Request, res: Response) {
    try {
      const { reportId } = req.params;

      if (!reportId) {
        return res.status(400).json({
          success: false,
          error: 'reportId는 필수 파라미터입니다.'
        });
      }

      // 실제로는 DB에서 리포트 정보 조회
      // 여기서는 간단히 파일 경로 구성
      const reportsDirectory = path.join(process.cwd(), 'reports');
      const files = await fs.readdir(reportsDirectory);
      
      const reportFile = files.find(file => file.includes(reportId));
      if (!reportFile) {
        return res.status(404).json({
          success: false,
          error: '리포트를 찾을 수 없습니다.'
        });
      }

      const filePath = path.join(reportsDirectory, reportFile);
      const stats = await fs.stat(filePath);

      if (!stats.isFile()) {
        return res.status(404).json({
          success: false,
          error: '리포트 파일을 찾을 수 없습니다.'
        });
      }

      // 파일 다운로드
      const fileExtension = path.extname(reportFile);
      const contentType = this.getContentType(fileExtension);

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${reportFile}"`);
      res.setHeader('Content-Length', stats.size);

      const fileBuffer = await fs.readFile(filePath);
      res.send(fileBuffer);

    } catch (error: any) {
      logger.error('Report download error:', error);
      res.status(500).json({
        success: false,
        error: '리포트 다운로드 중 오류가 발생했습니다.'
      });
    }
  }

  /**
   * 리포트 목록 조회
   */
  async getReports(req: Request, res: Response) {
    try {
      const { 
        page = '1', 
        limit = '20',
        type,
        format,
        startDate,
        endDate
      } = req.query;

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);

      if (pageNum < 1 || limitNum < 1 || limitNum > 100) {
        return res.status(400).json({
          success: false,
          error: '올바른 페이지 정보를 입력하세요.'
        });
      }

      // 필터 조건 구성
      const filters: any = {};
      if (type) filters.type = type;
      if (format) filters.format = format;
      if (startDate) filters.startDate = new Date(startDate as string);
      if (endDate) filters.endDate = new Date(endDate as string);

      const reports = await reportGenerationService.getReports(limitNum);

      // 실제로는 DB에서 페이징 처리된 결과 반환
      const totalReports = reports.length;
      const totalPages = Math.ceil(totalReports / limitNum);
      const startIndex = (pageNum - 1) * limitNum;
      const endIndex = startIndex + limitNum;
      const paginatedReports = reports.slice(startIndex, endIndex);

      res.json({
        success: true,
        data: {
          reports: paginatedReports,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: totalReports,
            totalPages,
            hasNext: pageNum < totalPages,
            hasPrev: pageNum > 1
          }
        }
      });
    } catch (error: any) {
      logger.error('Get reports error:', error);
      res.status(500).json({
        success: false,
        error: '리포트 목록 조회 중 오류가 발생했습니다.'
      });
    }
  }

  /**
   * 리포트 상세 조회
   */
  async getReportById(req: Request, res: Response) {
    try {
      const { reportId } = req.params;

      if (!reportId) {
        return res.status(400).json({
          success: false,
          error: 'reportId는 필수 파라미터입니다.'
        });
      }

      // 실제로는 DB에서 리포트 정보 조회
      const mockReport = {
        id: reportId,
        templateId: 'daily-sales',
        name: '일일 매출 리포트',
        type: 'daily',
        format: 'pdf',
        filePath: `/reports/daily-sales-${reportId}.pdf`,
        generatedAt: new Date(),
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
        endDate: new Date(),
        size: 1024000,
        status: 'completed',
        metadata: { template: '일일 매출 리포트' }
      };

      res.json({
        success: true,
        data: mockReport
      });
    } catch (error: any) {
      logger.error('Get report by ID error:', error);
      res.status(500).json({
        success: false,
        error: '리포트 조회 중 오류가 발생했습니다.'
      });
    }
  }

  /**
   * 리포트 삭제
   */
  async deleteReport(req: Request, res: Response) {
    try {
      const { reportId } = req.params;

      if (!reportId) {
        return res.status(400).json({
          success: false,
          error: 'reportId는 필수 파라미터입니다.'
        });
      }

      await reportGenerationService.deleteReport(reportId);

      res.json({
        success: true,
        message: '리포트가 성공적으로 삭제되었습니다.'
      });
    } catch (error: any) {
      logger.error('Delete report error:', error);
      res.status(500).json({
        success: false,
        error: error.message || '리포트 삭제 중 오류가 발생했습니다.'
      });
    }
  }

  /**
   * 리포트 템플릿 목록 조회
   */
  async getTemplates(req: Request, res: Response) {
    try {
      const templates = reportGenerationService.getTemplates();

      res.json({
        success: true,
        data: templates
      });
    } catch (error: any) {
      logger.error('Get templates error:', error);
      res.status(500).json({
        success: false,
        error: '템플릿 목록 조회 중 오류가 발생했습니다.'
      });
    }
  }

  /**
   * 리포트 템플릿 생성
   */
  async createTemplate(req: Request, res: Response) {
    try {
      const {
        name,
        description,
        type,
        sections,
        filters,
        recipients,
        schedule,
        isActive = true
      } = req.body;

      if (!name || !type || !sections) {
        return res.status(400).json({
          success: false,
          error: 'name, type, sections는 필수 파라미터입니다.'
        });
      }

      // 유효한 타입 확인
      const validTypes: ReportType[] = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom'];
      if (!validTypes.includes(type)) {
        return res.status(400).json({
          success: false,
          error: '지원되지 않는 리포트 타입입니다.'
        });
      }

      const template = await reportGenerationService.createTemplate({
        name,
        description,
        type,
        sections,
        filters,
        recipients,
        schedule,
        isActive
      });

      res.status(201).json({
        success: true,
        data: template
      });
    } catch (error: any) {
      logger.error('Create template error:', error);
      res.status(500).json({
        success: false,
        error: '템플릿 생성 중 오류가 발생했습니다.'
      });
    }
  }

  /**
   * 리포트 템플릿 수정
   */
  async updateTemplate(req: Request, res: Response) {
    try {
      const { templateId } = req.params;
      const updates = req.body;

      if (!templateId) {
        return res.status(400).json({
          success: false,
          error: 'templateId는 필수 파라미터입니다.'
        });
      }

      const template = await reportGenerationService.updateTemplate(templateId, updates);

      res.json({
        success: true,
        data: template
      });
    } catch (error: any) {
      logger.error('Update template error:', error);
      res.status(500).json({
        success: false,
        error: error.message || '템플릿 수정 중 오류가 발생했습니다.'
      });
    }
  }

  /**
   * 리포트 템플릿 삭제
   */
  async deleteTemplate(req: Request, res: Response) {
    try {
      const { templateId } = req.params;

      if (!templateId) {
        return res.status(400).json({
          success: false,
          error: 'templateId는 필수 파라미터입니다.'
        });
      }

      await reportGenerationService.deleteTemplate(templateId);

      res.json({
        success: true,
        message: '템플릿이 성공적으로 삭제되었습니다.'
      });
    } catch (error: any) {
      logger.error('Delete template error:', error);
      res.status(500).json({
        success: false,
        error: error.message || '템플릿 삭제 중 오류가 발생했습니다.'
      });
    }
  }

  /**
   * 리포트 미리보기
   */
  async previewReport(req: Request, res: Response) {
    try {
      const { templateId } = req.params;
      const { startDate, endDate } = req.query;

      if (!templateId) {
        return res.status(400).json({
          success: false,
          error: 'templateId는 필수 파라미터입니다.'
        });
      }

      // JSON 형태로 리포트 데이터 생성
      let customPeriod = undefined;
      if (startDate && endDate) {
        customPeriod = {
          startDate: new Date(startDate as string),
          endDate: new Date(endDate as string)
        };
      }

      const report = await reportGenerationService.generateReport(
        templateId,
        'json',
        customPeriod
      );

      // JSON 파일 읽기
      const fs = await import('fs/promises');
      const jsonContent = await fs.readFile(report.filePath, 'utf-8');
      const reportData = JSON.parse(jsonContent);

      // 임시 파일 삭제
      await fs.unlink(report.filePath);

      res.json({
        success: true,
        data: reportData
      });
    } catch (error: any) {
      logger.error('Preview report error:', error);
      res.status(500).json({
        success: false,
        error: '리포트 미리보기 중 오류가 발생했습니다.'
      });
    }
  }

  /**
   * 헬퍼 메서드: 파일 확장자에 따른 Content-Type 반환
   */
  private getContentType(extension: string): string {
    const contentTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.csv': 'text/csv',
      '.json': 'application/json'
    };

    return contentTypes[extension.toLowerCase()] || 'application/octet-stream';
  }

  /**
   * 대시보드 요약 정보
   */
  async getDashboardSummary(req: Request, res: Response) {
    try {
      const { period = '30' } = req.query;
      const days = parseInt(period as string);

      // 최근 생성된 리포트들의 요약 정보
      const recentReports = await reportGenerationService.getReports(10);
      
      const summary = {
        totalReports: recentReports.length,
        recentReports: recentReports.slice(0, 5),
        reportsByType: this.groupReportsByType(recentReports),
        reportsByFormat: this.groupReportsByFormat(recentReports),
        totalSize: recentReports.reduce((sum, report) => sum + report.size, 0),
        availableTemplates: reportGenerationService.getTemplates().length
      };

      res.json({
        success: true,
        data: summary
      });
    } catch (error: any) {
      logger.error('Get dashboard summary error:', error);
      res.status(500).json({
        success: false,
        error: '대시보드 요약 정보 조회 중 오류가 발생했습니다.'
      });
    }
  }

  private groupReportsByType(reports: any[]): Record<string, number> {
    return reports.reduce((acc, report) => {
      acc[report.type] = (acc[report.type] || 0) + 1;
      return acc;
    }, {});
  }

  private groupReportsByFormat(reports: any[]): Record<string, number> {
    return reports.reduce((acc, report) => {
      acc[report.format] = (acc[report.format] || 0) + 1;
      return acc;
    }, {});
  }
}

export const reportController = new ReportController();