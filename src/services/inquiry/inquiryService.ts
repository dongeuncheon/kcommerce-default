import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { logger } from '../../utils/logger';
import {
  CreateInquiryDto,
  UpdateInquiryDto,
  CreateReplyDto,
  InquirySearchParams,
  InquiryStats,
  InquiryStatus,
  InquiryPriority
} from '../../types/inquiry';
import { NotificationService } from '../notificationService';

export class InquiryService {
  private prisma: PrismaClient;
  private notificationService: NotificationService;

  constructor() {
    this.prisma = new PrismaClient();
    this.notificationService = new NotificationService();
  }

  /**
   * 문의 생성
   */
  async createInquiry(data: CreateInquiryDto, userId?: string) {
    try {
      // 비회원 문의인 경우 비밀번호 해시
      let hashedPassword = undefined;
      if (!userId && data.guestPassword) {
        hashedPassword = await bcrypt.hash(data.guestPassword, 10);
      }

      const inquiry = await this.prisma.inquiry.create({
        data: {
          userId,
          guestName: !userId ? data.guestName : undefined,
          guestEmail: !userId ? data.guestEmail : undefined,
          guestPhone: !userId ? data.guestPhone : undefined,
          guestPassword: hashedPassword,
          type: data.type,
          category: data.category,
          orderId: data.orderId,
          productId: data.productId,
          title: data.title,
          content: data.content,
          isPrivate: data.isPrivate ?? true,
          attachments: data.attachments,
          priority: this.determinePriority(data)
        },
        include: {
          user: true,
          order: true,
          product: true
        }
      });

      // 관리자에게 알림 전송
      await this.notifyAdmins(inquiry);

      // 자동 응답 확인
      await this.checkAutoReply(inquiry);

      logger.info('Inquiry created', { inquiryId: inquiry.id });
      return inquiry;
    } catch (error) {
      logger.error('Failed to create inquiry', error);
      throw error;
    }
  }

  /**
   * 문의 목록 조회
   */
  async getInquiries(params: InquirySearchParams) {
    try {
      const {
        userId,
        status,
        type,
        category,
        priority,
        assignedToId,
        keyword,
        startDate,
        endDate,
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = params;

      const where: any = {};

      if (userId) where.userId = userId;
      if (status) where.status = status;
      if (type) where.type = type;
      if (category) where.category = category;
      if (priority) where.priority = priority;
      if (assignedToId) where.assignedToId = assignedToId;

      if (keyword) {
        where.OR = [
          { title: { contains: keyword, mode: 'insensitive' } },
          { content: { contains: keyword, mode: 'insensitive' } }
        ];
      }

      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = startDate;
        if (endDate) where.createdAt.lte = endDate;
      }

      const [inquiries, total] = await Promise.all([
        this.prisma.inquiry.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { [sortBy]: sortOrder },
          include: {
            user: true,
            assignedTo: true,
            replies: {
              include: { user: true }
            },
            _count: {
              select: { replies: true }
            }
          }
        }),
        this.prisma.inquiry.count({ where })
      ]);

      return {
        inquiries,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Failed to get inquiries', error);
      throw error;
    }
  }

  /**
   * 문의 상세 조회
   */
  async getInquiry(id: string, userId?: string, guestPassword?: string) {
    try {
      const inquiry = await this.prisma.inquiry.findUnique({
        where: { id },
        include: {
          user: true,
          order: true,
          product: true,
          assignedTo: true,
          replies: {
            where: { isInternal: false },
            orderBy: { createdAt: 'asc' },
            include: { user: true }
          }
        }
      });

      if (!inquiry) {
        throw new Error('문의를 찾을 수 없습니다.');
      }

      // 접근 권한 확인
      if (!await this.canAccessInquiry(inquiry, userId, guestPassword)) {
        throw new Error('문의 조회 권한이 없습니다.');
      }

      // 조회수 증가
      await this.prisma.inquiry.update({
        where: { id },
        data: { viewCount: { increment: 1 } }
      });

      return inquiry;
    } catch (error) {
      logger.error('Failed to get inquiry', error);
      throw error;
    }
  }

  /**
   * 문의 수정
   */
  async updateInquiry(id: string, data: UpdateInquiryDto, userId?: string) {
    try {
      const inquiry = await this.prisma.inquiry.findUnique({
        where: { id }
      });

      if (!inquiry) {
        throw new Error('문의를 찾을 수 없습니다.');
      }

      // 권한 확인 (작성자 또는 관리자)
      if (inquiry.userId !== userId && !await this.isAdmin(userId)) {
        throw new Error('문의 수정 권한이 없습니다.');
      }

      const updatedInquiry = await this.prisma.inquiry.update({
        where: { id },
        data: {
          ...data,
          assignedAt: data.assignedToId ? new Date() : undefined
        },
        include: {
          user: true,
          assignedTo: true
        }
      });

      // 상태 변경 시 알림
      if (data.status && data.status !== inquiry.status) {
        await this.notifyStatusChange(updatedInquiry);
      }

      logger.info('Inquiry updated', { inquiryId: id });
      return updatedInquiry;
    } catch (error) {
      logger.error('Failed to update inquiry', error);
      throw error;
    }
  }

  /**
   * 문의 답변 작성
   */
  async createReply(inquiryId: string, data: CreateReplyDto, userId: string) {
    try {
      // 관리자 권한 확인
      if (!await this.isAdmin(userId)) {
        throw new Error('답변 작성 권한이 없습니다.');
      }

      const reply = await this.prisma.inquiryReply.create({
        data: {
          inquiryId,
          userId,
          content: data.content,
          isInternal: data.isInternal ?? false,
          attachments: data.attachments
        },
        include: {
          user: true
        }
      });

      // 문의 상태 업데이트
      if (!data.isInternal) {
        await this.prisma.inquiry.update({
          where: { id: inquiryId },
          data: { 
            status: InquiryStatus.ANSWERED,
            assignedToId: userId
          }
        });

        // 사용자에게 알림
        await this.notifyReply(inquiryId, reply);
      }

      logger.info('Reply created', { inquiryId, replyId: reply.id });
      return reply;
    } catch (error) {
      logger.error('Failed to create reply', error);
      throw error;
    }
  }

  /**
   * 문의 통계
   */
  async getInquiryStats(userId?: string): Promise<InquiryStats> {
    try {
      const where = userId ? { assignedToId: userId } : {};

      const [
        total,
        statusCounts,
        avgResponseTime,
        satisfactionData
      ] = await Promise.all([
        this.prisma.inquiry.count({ where }),
        this.prisma.inquiry.groupBy({
          by: ['status'],
          where,
          _count: true
        }),
        this.calculateAvgResponseTime(where),
        this.calculateSatisfactionRate(where)
      ]);

      const stats: InquiryStats = {
        total,
        pending: 0,
        inProgress: 0,
        answered: 0,
        closed: 0,
        avgResponseTime,
        satisfactionRate: satisfactionData
      };

      statusCounts.forEach(item => {
        switch (item.status) {
          case InquiryStatus.PENDING:
            stats.pending = item._count;
            break;
          case InquiryStatus.IN_PROGRESS:
            stats.inProgress = item._count;
            break;
          case InquiryStatus.ANSWERED:
            stats.answered = item._count;
            break;
          case InquiryStatus.CLOSED:
            stats.closed = item._count;
            break;
        }
      });

      return stats;
    } catch (error) {
      logger.error('Failed to get inquiry stats', error);
      throw error;
    }
  }

  /**
   * 자동 응답 템플릿 관리
   */
  async getTemplates(category?: string) {
    try {
      const where: any = { isActive: true };
      if (category) where.category = category;

      return await this.prisma.inquiryTemplate.findMany({
        where,
        orderBy: { usageCount: 'desc' }
      });
    } catch (error) {
      logger.error('Failed to get templates', error);
      throw error;
    }
  }

  async createTemplate(data: {
    name: string;
    category: string;
    content: string;
  }) {
    try {
      return await this.prisma.inquiryTemplate.create({ data });
    } catch (error) {
      logger.error('Failed to create template', error);
      throw error;
    }
  }

  /**
   * 문의 만족도 평가
   */
  async rateSatisfaction(inquiryId: string, rating: number, note?: string) {
    try {
      const inquiry = await this.prisma.inquiry.update({
        where: { id: inquiryId },
        data: {
          satisfaction: rating,
          satisfactionNote: note
        }
      });

      logger.info('Satisfaction rated', { inquiryId, rating });
      return inquiry;
    } catch (error) {
      logger.error('Failed to rate satisfaction', error);
      throw error;
    }
  }

  /**
   * Private methods
   */
  private async canAccessInquiry(inquiry: any, userId?: string, guestPassword?: string): Promise<boolean> {
    // 관리자는 모든 문의 접근 가능
    if (userId && await this.isAdmin(userId)) {
      return true;
    }

    // 회원 문의
    if (inquiry.userId) {
      return inquiry.userId === userId;
    }

    // 비회원 문의
    if (inquiry.guestPassword && guestPassword) {
      return await bcrypt.compare(guestPassword, inquiry.guestPassword);
    }

    return false;
  }

  private async isAdmin(userId?: string): Promise<boolean> {
    if (!userId) return false;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    });

    return user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
  }

  private determinePriority(data: CreateInquiryDto): InquiryPriority {
    // 교환/반품 문의는 높은 우선순위
    if (data.type === 'EXCHANGE_RETURN') {
      return InquiryPriority.HIGH;
    }

    // 결제 문의는 긴급
    if (data.type === 'PAYMENT') {
      return InquiryPriority.URGENT;
    }

    // 주문 관련 문의는 보통보다 높음
    if (data.type === 'ORDER' || data.orderId) {
      return InquiryPriority.HIGH;
    }

    return InquiryPriority.NORMAL;
  }

  private async checkAutoReply(inquiry: any) {
    // TODO: 자동 응답 로직 구현
    // 카테고리별 자동 응답 템플릿 확인
    // FAQ 기반 자동 응답
  }

  private async notifyAdmins(inquiry: any) {
    // 관리자에게 새 문의 알림
    const admins = await this.prisma.user.findMany({
      where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } }
    });

    for (const admin of admins) {
      await this.notificationService.sendNotification({
        userId: admin.id,
        type: 'NEW_INQUIRY',
        title: '새로운 1:1 문의',
        message: `${inquiry.title} - ${inquiry.type}`,
        data: { inquiryId: inquiry.id }
      });
    }
  }

  private async notifyStatusChange(inquiry: any) {
    if (inquiry.userId) {
      await this.notificationService.sendNotification({
        userId: inquiry.userId,
        type: 'INQUIRY_STATUS_CHANGE',
        title: '문의 상태 변경',
        message: `문의 "${inquiry.title}"의 상태가 ${inquiry.status}로 변경되었습니다.`,
        data: { inquiryId: inquiry.id }
      });
    } else if (inquiry.guestEmail) {
      // 비회원 이메일 알림
      await this.notificationService.sendEmail({
        to: inquiry.guestEmail,
        subject: '문의 상태 변경 안내',
        template: 'inquiry-status-change',
        data: {
          inquiryTitle: inquiry.title,
          status: inquiry.status
        }
      });
    }
  }

  private async notifyReply(inquiryId: string, reply: any) {
    const inquiry = await this.prisma.inquiry.findUnique({
      where: { id: inquiryId }
    });

    if (!inquiry) return;

    if (inquiry.userId) {
      await this.notificationService.sendNotification({
        userId: inquiry.userId,
        type: 'INQUIRY_REPLY',
        title: '문의 답변이 등록되었습니다',
        message: inquiry.title,
        data: { inquiryId }
      });
    } else if (inquiry.guestEmail) {
      await this.notificationService.sendEmail({
        to: inquiry.guestEmail,
        subject: '문의 답변 안내',
        template: 'inquiry-reply',
        data: {
          inquiryTitle: inquiry.title,
          replyContent: reply.content
        }
      });
    }
  }

  private async calculateAvgResponseTime(where: any): Promise<number> {
    const inquiries = await this.prisma.inquiry.findMany({
      where: {
        ...where,
        status: { in: [InquiryStatus.ANSWERED, InquiryStatus.CLOSED] }
      },
      include: {
        replies: {
          where: { isInternal: false },
          orderBy: { createdAt: 'asc' },
          take: 1
        }
      }
    });

    if (inquiries.length === 0) return 0;

    const responseTimes = inquiries
      .filter(i => i.replies.length > 0)
      .map(i => {
        const firstReply = i.replies[0];
        return firstReply.createdAt.getTime() - i.createdAt.getTime();
      });

    if (responseTimes.length === 0) return 0;

    const avgTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    return Math.round(avgTime / (1000 * 60 * 60)); // Convert to hours
  }

  private async calculateSatisfactionRate(where: any): Promise<number> {
    const inquiries = await this.prisma.inquiry.findMany({
      where: {
        ...where,
        satisfaction: { not: null }
      },
      select: { satisfaction: true }
    });

    if (inquiries.length === 0) return 0;

    const totalSatisfaction = inquiries.reduce((sum, i) => sum + (i.satisfaction || 0), 0);
    return Math.round((totalSatisfaction / (inquiries.length * 5)) * 100);
  }
}