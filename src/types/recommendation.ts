export interface RecommendationRequest {
  userId: string;
  algorithm: RecommendationAlgorithm;
  limit?: number;
  offset?: number;
  categoryId?: string;
  excludeProductIds?: string[];
  context?: RecommendationContext;
}

export enum RecommendationAlgorithm {
  COLLABORATIVE = 'collaborative',
  CONTENT_BASED = 'content',
  HYBRID = 'hybrid',
  TRENDING = 'trending',
  PERSONALIZED = 'personalized',
  SIMILAR_USERS = 'similar_users',
  SIMILAR_PRODUCTS = 'similar_products'
}

export interface RecommendationContext {
  sessionId?: string;
  deviceType?: string;
  location?: string;
  timeOfDay?: string;
  dayOfWeek?: string;
  seasonality?: string;
  priceRange?: {
    min: number;
    max: number;
  };
}

export interface RecommendationResult {
  productId: string;
  score: number;
  reason?: string;
  algorithm: RecommendationAlgorithm;
}

export interface UserBehaviorData {
  userId: string;
  productId: string;
  action: UserActionType;
  timestamp: Date;
  weight: number;
  sessionId?: string;
  metadata?: any;
}

export enum UserActionType {
  VIEW = 'VIEW',
  CLICK = 'CLICK',
  ADD_TO_CART = 'ADD_TO_CART',
  REMOVE_FROM_CART = 'REMOVE_FROM_CART',
  PURCHASE = 'PURCHASE',
  REVIEW = 'REVIEW',
  WISHLIST_ADD = 'WISHLIST_ADD',
  WISHLIST_REMOVE = 'WISHLIST_REMOVE',
  SEARCH = 'SEARCH',
  SHARE = 'SHARE'
}

export const ACTION_WEIGHTS: Record<UserActionType, number> = {
  [UserActionType.VIEW]: 1,
  [UserActionType.CLICK]: 2,
  [UserActionType.ADD_TO_CART]: 3,
  [UserActionType.REMOVE_FROM_CART]: -2,
  [UserActionType.PURCHASE]: 5,
  [UserActionType.REVIEW]: 4,
  [UserActionType.WISHLIST_ADD]: 3,
  [UserActionType.WISHLIST_REMOVE]: -1,
  [UserActionType.SEARCH]: 1,
  [UserActionType.SHARE]: 3
};

export interface SimilarityMatrix {
  itemA: string;
  itemB: string;
  similarity: number;
  algorithm: string;
}

export interface ModelMetrics {
  precision: number;
  recall: number;
  f1Score: number;
  coverage: number;
  diversity: number;
  novelty: number;
  serendipity: number;
}

export interface TrainingConfig {
  minInteractions: number;
  minSimilarity: number;
  maxNeighbors: number;
  regularization: number;
  learningRate: number;
  iterations: number;
}