export interface CreateReviewDto {
  productId: string;
  orderId?: string;
  orderItemId?: string;
  rating: number;
  title?: string;
  comment?: string;
  pros?: string;
  cons?: string;
  qualityRating?: number;
  valueRating?: number;
  deliveryRating?: number;
  images?: string[];
  videos?: string[];
}

export interface UpdateReviewDto {
  title?: string;
  comment?: string;
  pros?: string;
  cons?: string;
  rating?: number;
  qualityRating?: number;
  valueRating?: number;
  deliveryRating?: number;
  images?: string[];
  videos?: string[];
}

export interface CreateReviewReplyDto {
  content: string;
}

export interface ReviewSearchParams {
  productId?: string;
  userId?: string;
  rating?: number;
  reviewType?: ReviewType;
  isVerified?: boolean;
  isBest?: boolean;
  hasImages?: boolean;
  hasVideos?: boolean;
  startDate?: Date;
  endDate?: Date;
  sortBy?: 'createdAt' | 'rating' | 'helpfulCount' | 'viewCount';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface ReviewStats {
  totalCount: number;
  averageRating: number;
  ratingDistribution: Record<number, number>;
  verifiedCount: number;
  photoReviewCount: number;
  videoReviewCount: number;
  qualityAverage?: number;
  valueAverage?: number;
  deliveryAverage?: number;
}

export interface ReviewReward {
  basePoints: number;
  photoBonus: number;
  videoBonus: number;
  lengthBonus: number;
  totalPoints: number;
}

export enum ReviewType {
  GENERAL = 'GENERAL',
  PHOTO = 'PHOTO',
  VIDEO = 'VIDEO',
  EXPERIENCE = 'EXPERIENCE'
}

export interface ReviewVoteDto {
  isHelpful: boolean;
}

export interface BestReviewCriteria {
  minRating: number;
  minLength: number;
  minHelpfulCount: number;
  hasImages: boolean;
  isVerified: boolean;
}