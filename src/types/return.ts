export interface CreateReturnDto {
  orderId: string;
  orderItemIds: string[];
  type: ReturnType;
  reason: ReturnReason;
  reasonDetail?: string;
  attachments?: ReturnAttachment[];
}

export interface UpdateReturnDto {
  status?: ReturnStatus;
  rejectionReason?: string;
  notes?: string;
  pickupDate?: Date;
  pickupCarrier?: string;
  pickupTrackingNo?: string;
  returnCarrier?: string;
  returnTrackingNo?: string;
  exchangeItems?: ExchangeItem[];
}

export interface ProcessRefundDto {
  refundAmount: number;
  refundMethod: RefundMethod;
  transactionId?: string;
}

export interface ReturnSearchParams {
  userId?: string;
  orderId?: string;
  status?: ReturnStatus;
  type?: ReturnType;
  reason?: ReturnReason;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
  sortBy?: 'requestedAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

export interface ReturnAttachment {
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
}

export interface ExchangeItem {
  productId: string;
  variantId?: string;
  quantity: number;
}

export interface ReturnStats {
  total: number;
  requested: number;
  approved: number;
  rejected: number;
  processing: number;
  completed: number;
  avgProcessingTime: number;
  totalRefundAmount: number;
  byReason: Record<string, number>;
}

export interface ReturnPolicyConfig {
  id: string;
  name: string;
  description?: string;
  returnWindow: number;
  exchangeWindow: number;
  returnFee: number;
  exchangeFee: number;
  restockingFee: number;
  autoApprove: boolean;
  autoApproveReasons: ReturnReason[];
  maxAutoApproveAmount?: number;
  requirePhotos: boolean;
  requireOriginalPackaging: boolean;
  allowPartialReturn: boolean;
}

export enum ReturnType {
  EXCHANGE = 'EXCHANGE',
  REFUND = 'REFUND',
  PARTIAL_REFUND = 'PARTIAL_REFUND'
}

export enum ReturnStatus {
  REQUESTED = 'REQUESTED',
  PENDING_REVIEW = 'PENDING_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  PICKUP_SCHEDULED = 'PICKUP_SCHEDULED',
  IN_TRANSIT = 'IN_TRANSIT',
  RECEIVED = 'RECEIVED',
  INSPECTING = 'INSPECTING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

export enum ReturnReason {
  DEFECTIVE = 'DEFECTIVE',
  WRONG_ITEM = 'WRONG_ITEM',
  NOT_AS_DESCRIBED = 'NOT_AS_DESCRIBED',
  CHANGE_OF_MIND = 'CHANGE_OF_MIND',
  SIZE_ISSUE = 'SIZE_ISSUE',
  COLOR_ISSUE = 'COLOR_ISSUE',
  DELIVERY_DAMAGE = 'DELIVERY_DAMAGE',
  MISSING_PARTS = 'MISSING_PARTS',
  OTHER = 'OTHER'
}

export enum RefundMethod {
  ORIGINAL_PAYMENT = 'ORIGINAL_PAYMENT',
  STORE_CREDIT = 'STORE_CREDIT',
  BANK_TRANSFER = 'BANK_TRANSFER',
  POINTS = 'POINTS'
}