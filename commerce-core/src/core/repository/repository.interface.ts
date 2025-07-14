import type { PaginationResult, QueryOptions } from '@/types/common';

/**
 * Base repository interface for common CRUD operations
 * @template T - Entity type
 */
export interface IRepository<T> {
  /**
   * Create a new entity
   * @param data - Entity data
   * @returns Created entity
   */
  create(data: Partial<T>): Promise<T>;

  /**
   * Find entity by ID
   * @param id - Entity ID
   * @returns Entity or null if not found
   */
  findById(id: string): Promise<T | null>;

  /**
   * Find one entity by filter
   * @param filter - Query filter
   * @returns Entity or null if not found
   */
  findOne(filter: Partial<T>): Promise<T | null>;

  /**
   * Find multiple entities
   * @param filter - Query filter
   * @param options - Query options (pagination, sorting)
   * @returns Paginated results
   */
  findMany(
    filter?: Partial<T>,
    options?: QueryOptions,
  ): Promise<PaginationResult<T>>;

  /**
   * Update entity by ID
   * @param id - Entity ID
   * @param data - Update data
   * @returns Updated entity
   */
  update(id: string, data: Partial<T>): Promise<T>;

  /**
   * Delete entity by ID
   * @param id - Entity ID
   * @returns True if deleted, false otherwise
   */
  delete(id: string): Promise<boolean>;

  /**
   * Create multiple entities
   * @param data - Array of entity data
   * @returns Created entities
   */
  createMany(data: Partial<T>[]): Promise<T[]>;

  /**
   * Update multiple entities
   * @param filter - Query filter
   * @param data - Update data
   * @returns Number of updated entities
   */
  updateMany(filter: Partial<T>, data: Partial<T>): Promise<number>;

  /**
   * Delete multiple entities
   * @param filter - Query filter
   * @returns Number of deleted entities
   */
  deleteMany(filter: Partial<T>): Promise<number>;

  /**
   * Count entities
   * @param filter - Query filter
   * @returns Entity count
   */
  count(filter?: Partial<T>): Promise<number>;

  /**
   * Check if entity exists
   * @param filter - Query filter
   * @returns True if exists, false otherwise
   */
  exists(filter: Partial<T>): Promise<boolean>;

  /**
   * Execute operations within a transaction
   * @param callback - Transaction callback
   * @returns Transaction result
   */
  withTransaction<R>(
    callback: (repo: IRepository<T>) => Promise<R>,
  ): Promise<R>;
}

/**
 * Read-only repository interface for query operations
 * @template T - Entity type
 */
export interface IReadRepository<T> {
  findById(id: string): Promise<T | null>;
  findOne(filter: Partial<T>): Promise<T | null>;
  findMany(
    filter?: Partial<T>,
    options?: QueryOptions,
  ): Promise<PaginationResult<T>>;
  count(filter?: Partial<T>): Promise<number>;
  exists(filter: Partial<T>): Promise<boolean>;
}

/**
 * Write-only repository interface for mutation operations
 * @template T - Entity type
 */
export interface IWriteRepository<T> {
  create(data: Partial<T>): Promise<T>;
  update(id: string, data: Partial<T>): Promise<T>;
  delete(id: string): Promise<boolean>;
  createMany(data: Partial<T>[]): Promise<T[]>;
  updateMany(filter: Partial<T>, data: Partial<T>): Promise<number>;
  deleteMany(filter: Partial<T>): Promise<number>;
}

/**
 * Repository factory interface
 */
export interface IRepositoryFactory {
  /**
   * Create a repository instance for the given entity type
   * @param entityName - Entity name
   * @returns Repository instance
   */
  create<T>(entityName: string): IRepository<T>;
}

/**
 * Unit of Work interface for managing transactions
 */
export interface IUnitOfWork {
  /**
   * Begin a new transaction
   */
  begin(): Promise<void>;

  /**
   * Commit the current transaction
   */
  commit(): Promise<void>;

  /**
   * Rollback the current transaction
   */
  rollback(): Promise<void>;

  /**
   * Get repository for entity type
   * @param entityName - Entity name
   * @returns Repository instance
   */
  getRepository<T>(entityName: string): IRepository<T>;

  /**
   * Execute operations within a transaction
   * @param callback - Transaction callback
   * @returns Transaction result
   */
  execute<R>(callback: (uow: IUnitOfWork) => Promise<R>): Promise<R>;
}
