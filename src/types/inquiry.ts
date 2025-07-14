export interface CreateInquiryDto {
  // User info (for guest inquiries)
  guestName?: string;
  guestEmail?: string;
  guestPhone?: string;
  guestPassword?: string;
  
  // Inquiry details
  type: InquiryType;
  category: InquiryCategory;
  orderId?: string;
  productId?: string;
  title: string;
  content: string;
  isPrivate?: boolean;
  attachments?: InquiryAttachment[];
}

export interface UpdateInquiryDto {
  title?: string;
  content?: string;
  status?: InquiryStatus;
  priority?: InquiryPriority;
  assignedToId?: string;
  attachments?: InquiryAttachment[];
}

export interface CreateReplyDto {
  content: string;
  isInternal?: boolean;
  attachments?: InquiryAttachment[];
}

export interface InquirySearchParams {
  userId?: string;
  status?: InquiryStatus;
  type?: InquiryType;
  category?: InquiryCategory;
  priority?: InquiryPriority;
  assignedToId?: string;
  keyword?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'priority';
  sortOrder?: 'asc' | 'desc';
}

export interface InquiryAttachment {
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
}

export interface InquiryStats {
  total: number;
  pending: number;
  inProgress: number;
  answered: number;
  closed: number;
  avgResponseTime: number;
  satisfactionRate: number;
}

export interface InquiryTemplate {
  id: string;
  name: string;
  category: InquiryCategory;
  content: string;
  isActive: boolean;
  usageCount: number;
}

export enum InquiryType {
  GENERAL = 'GENERAL',
  ORDER = 'ORDER',
  PRODUCT = 'PRODUCT',
  EXCHANGE_RETURN = 'EXCHANGE_RETURN',
  PAYMENT = 'PAYMENT',
  MEMBERSHIP = 'MEMBERSHIP',
  OTHER = 'OTHER'
}

export enum InquiryCategory {
  BEFORE_ORDER = 'BEFORE_ORDER',
  ORDER_PAYMENT = 'ORDER_PAYMENT',
  DELIVERY = 'DELIVERY',
  RETURN_EXCHANGE = 'RETURN_EXCHANGE',
  PRODUCT_INFO = 'PRODUCT_INFO',
  SITE_USAGE = 'SITE_USAGE',
  MEMBERSHIP = 'MEMBERSHIP',
  EVENT = 'EVENT',
  OTHER = 'OTHER'
}

export enum InquiryStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  ANSWERED = 'ANSWERED',
  CLOSED = 'CLOSED',
  HOLD = 'HOLD'
}

export enum InquiryPriority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  URGENT = 'URGENT'
}