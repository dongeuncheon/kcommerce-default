/**
 * Base entity interface
 */
export interface IBaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  page?: number;
  limit?: number;
}

/**
 * Sort options
 */
export interface SortOptions {
  field: string;
  direction: 'asc' | 'desc';
}

/**
 * Query options combining pagination and sorting
 */
export interface QueryOptions extends PaginationOptions {
  orderBy?: SortOptions[];
  where?: Record<string, any>;
  select?: string[];
  include?: string[];
}

/**
 * Paginated result
 */
export interface PaginationResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * API Response
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  meta?: Record<string, any>;
}

/**
 * User interface for auth context
 */
export interface IUser extends IBaseEntity {
  email: string;
  name: string;
  role: string;
  isActive: boolean;
}

/**
 * Request user
 */
export interface RequestUser {
  id: string;
  email: string;
  role: string;
}