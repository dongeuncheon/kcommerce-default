import type { IRepository } from './repository.interface';
import type { DatabaseAdapter } from '@/adapters/types/database.adapter';
import type { PaginationResult, QueryOptions } from '@/types/common';

/**
 * Base repository implementation with common CRUD operations
 * @template T - Entity type
 */
export abstract class BaseRepository<T extends { id: string }>
  implements IRepository<T>
{
  constructor(
    protected readonly adapter: DatabaseAdapter,
    protected readonly collectionName: string,
  ) {}

  /**
   * Convert database document to entity
   * @param data - Raw database document
   * @returns Entity instance
   */
  protected abstract toEntity(data: any): T;

  /**
   * Convert entity to database document
   * @param entity - Entity instance
   * @returns Database document
   */
  protected abstract toDocument(entity: Partial<T>): any;

  /**
   * Validate entity data before save
   * @param data - Entity data
   * @throws Error if validation fails
   */
  protected abstract validate(data: Partial<T>): void;

  /**
   * Get entity name for error messages
   */
  protected get entityName(): string {
    return this.collectionName.slice(0, -1); // Remove 's' from plural
  }

  async create(data: Partial<T>): Promise<T> {
    try {
      this.validate(data);
      const document = this.toDocument(data);

      // Use adapter's raw method for insert
      const result = await this.adapter.raw(
        `INSERT INTO ${this.collectionName} SET ?`,
        [document],
      );

      if (
        !result ||
        !Array.isArray(result) ||
        !result[0] ||
        !('rows' in result[0]) ||
        !(result[0] as any).rows?.[0]
      ) {
        throw new Error(`Failed to create ${this.entityName}`);
      }

      return this.toEntity((result[0] as any).rows[0]);
    } catch (error) {
      throw this.handleError(error as Error, 'create');
    }
  }

  async findById(id: string): Promise<T | null> {
    try {
      const result = await this.adapter.raw(
        `SELECT * FROM ${this.collectionName} WHERE id = ? LIMIT 1`,
        [id],
      );

      if (
        !result ||
        !Array.isArray(result) ||
        !result[0] ||
        !('rows' in result[0]) ||
        !(result[0] as any).rows?.[0]
      ) {
        return null;
      }

      return this.toEntity((result[0] as any).rows[0]);
    } catch (error) {
      throw this.handleError(error as Error, 'findById');
    }
  }

  async findOne(filter: Partial<T>): Promise<T | null> {
    try {
      const { clause, params } = this.buildWhereClause(filter);
      const query = `SELECT * FROM ${this.collectionName} ${clause} LIMIT 1`;

      const result = await this.adapter.raw(query, params);

      if (
        !result ||
        !Array.isArray(result) ||
        !result[0] ||
        !('rows' in result[0]) ||
        !(result[0] as any).rows?.[0]
      ) {
        return null;
      }

      return this.toEntity((result[0] as any).rows[0]);
    } catch (error) {
      throw this.handleError(error as Error, 'findOne');
    }
  }

  async findMany(
    filter?: Partial<T>,
    options?: QueryOptions,
  ): Promise<PaginationResult<T>> {
    try {
      const limit = options?.limit || 20;
      const offset = options?.offset || 0;
      const sortBy = options?.sortBy || 'created_at';
      const sortOrder = options?.sortOrder || 'desc';

      // Build WHERE clause
      const { clause, params } = filter
        ? this.buildWhereClause(filter)
        : { clause: '', params: [] };

      // Count total
      const countQuery = `SELECT COUNT(*) as count FROM ${this.collectionName} ${clause}`;
      const countResult = await this.adapter.raw(
        countQuery,
        params,
      );
      const total =
        (countResult &&
          Array.isArray(countResult) &&
          countResult[0] &&
          'rows' in countResult[0] &&
          (countResult[0] as any).rows?.[0]?.count) ||
        0;

      // Get data
      const dataQuery = `
        SELECT * FROM ${this.collectionName} 
        ${clause} 
        ORDER BY ${sortBy} ${sortOrder} 
        LIMIT ? OFFSET ?
      `;
      const dataResult = await this.adapter.raw(dataQuery, [
        ...params,
        limit,
        offset,
      ]);

      const data = (
        dataResult &&
        Array.isArray(dataResult) &&
        dataResult[0] &&
        'rows' in dataResult[0]
          ? (dataResult[0] as any).rows || []
          : []
      ).map((row: any) => this.toEntity(row));

      return {
        data,
        total,
        page: Math.floor(offset / limit) + 1,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: offset + limit < total,
        hasPrev: offset > 0,
      };
    } catch (error) {
      throw this.handleError(error as Error, 'findMany');
    }
  }

  async update(id: string, data: Partial<T>): Promise<T> {
    try {
      const existing = await this.findById(id);
      if (!existing) {
        throw new Error(`${this.entityName} not found`);
      }

      const merged = { ...existing, ...data };
      this.validate(merged);

      const document = this.toDocument(data);
      const fields = Object.keys(document)
        .map((key) => `${key} = ?`)
        .join(', ');
      const values = Object.values(document);

      await this.adapter.raw(
        `UPDATE ${this.collectionName} SET ${fields}, updated_at = NOW() WHERE id = ?`,
        [...values, id],
      );

      const updated = await this.findById(id);
      if (!updated) {
        throw new Error(`Failed to update ${this.entityName}`);
      }

      return updated;
    } catch (error) {
      throw this.handleError(error as Error, 'update');
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const result = await this.adapter.raw(
        `DELETE FROM ${this.collectionName} WHERE id = ?`,
        [id],
      );

      return Boolean(
        result &&
          Array.isArray(result) &&
          result.length > 0 &&
          result[0] &&
          typeof result[0] === 'object' &&
          'affectedRows' in result[0] &&
          (result[0] as any).affectedRows > 0,
      );
    } catch (error) {
      throw this.handleError(error as Error, 'delete');
    }
  }

  async createMany(data: Partial<T>[]): Promise<T[]> {
    try {
      const created: T[] = [];

      // Use transaction for bulk insert
      const operations = data.map(item => ({
        type: 'create' as const,
        collection: this.collectionName,
        data: this.toDocument(item)
      }));
      const results = await this.adapter.transaction(operations);
      return results as T[];

      return created;
    } catch (error) {
      throw this.handleError(error as Error, 'createMany');
    }
  }

  async updateMany(filter: Partial<T>, data: Partial<T>): Promise<number> {
    try {
      const { clause, params } = this.buildWhereClause(filter);
      const document = this.toDocument(data);
      const fields = Object.keys(document)
        .map((key) => `${key} = ?`)
        .join(', ');
      const values = Object.values(document);

      const result = await this.adapter.raw(
        `UPDATE ${this.collectionName} SET ${fields}, updated_at = NOW() ${clause}`,
        [...values, ...params],
      );

      return (
        Number(
          result &&
            Array.isArray(result) &&
            result.length > 0 &&
            result[0] &&
            typeof result[0] === 'object' &&
            'affectedRows' in result[0] &&
            (result[0] as any).affectedRows,
        ) || 0
      );
    } catch (error) {
      throw this.handleError(error as Error, 'updateMany');
    }
  }

  async deleteMany(filter: Partial<T>): Promise<number> {
    try {
      const { clause, params } = this.buildWhereClause(filter);

      const result = await this.adapter.raw(
        `DELETE FROM ${this.collectionName} ${clause}`,
        params,
      );

      return (
        Number(
          result &&
            Array.isArray(result) &&
            result.length > 0 &&
            result[0] &&
            typeof result[0] === 'object' &&
            'affectedRows' in result[0] &&
            (result[0] as any).affectedRows,
        ) || 0
      );
    } catch (error) {
      throw this.handleError(error as Error, 'deleteMany');
    }
  }

  async count(filter?: Partial<T>): Promise<number> {
    try {
      const { clause, params } = filter
        ? this.buildWhereClause(filter)
        : { clause: '', params: [] };

      const result = await this.adapter.raw(
        `SELECT COUNT(*) as count FROM ${this.collectionName} ${clause}`,
        params,
      );

      return (
        (result &&
          Array.isArray(result) &&
          result[0] &&
          'rows' in result[0] &&
          (result[0] as any).rows?.[0]?.count) ||
        0
      );
    } catch (error) {
      throw this.handleError(error as Error, 'count');
    }
  }

  async exists(filter: Partial<T>): Promise<boolean> {
    try {
      const count = await this.count(filter);
      return count > 0;
    } catch (error) {
      throw this.handleError(error as Error, 'exists');
    }
  }

  async withTransaction<R>(
    callback: (repo: IRepository<T>) => Promise<R>,
  ): Promise<R> {
    const transaction = await this.adapter.beginTransaction();
    try {
      const result = await callback(this);
      await this.adapter.commitTransaction(transaction);
      return result;
    } catch (error) {
      await this.adapter.rollbackTransaction(transaction);
      throw error;
    }
  }

  /**
   * Build WHERE clause from filter object
   */
  protected buildWhereClause(filter: Partial<T>): {
    clause: string;
    params: any[];
  } {
    const conditions: string[] = [];
    const params: any[] = [];

    Object.entries(filter).forEach(([key, value]) => {
      if (value === null || value === undefined) {
        conditions.push(`${key} IS NULL`);
      } else if (Array.isArray(value)) {
        const placeholders = value.map(() => '?').join(',');
        conditions.push(`${key} IN (${placeholders})`);
        params.push(...value);
      } else if (typeof value === 'object' && value !== null) {
        // Handle complex filters
        const filterObj = value;
        if ('$gte' in filterObj) {
          conditions.push(`${key} >= ?`);
          params.push(filterObj.$gte);
        }
        if ('$lte' in filterObj) {
          conditions.push(`${key} <= ?`);
          params.push(filterObj.$lte);
        }
        if ('$gt' in filterObj) {
          conditions.push(`${key} > ?`);
          params.push(filterObj.$gt);
        }
        if ('$lt' in filterObj) {
          conditions.push(`${key} < ?`);
          params.push(filterObj.$lt);
        }
        if ('$ne' in filterObj) {
          conditions.push(`${key} != ?`);
          params.push(filterObj.$ne);
        }
        if ('$like' in filterObj) {
          conditions.push(`${key} LIKE ?`);
          params.push(filterObj.$like);
        }
        if ('$in' in filterObj) {
          const placeholders = filterObj.$in.map(() => '?').join(',');
          conditions.push(`${key} IN (${placeholders})`);
          params.push(...filterObj.$in);
        }
      } else {
        conditions.push(`${key} = ?`);
        params.push(value);
      }
    });

    return {
      clause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
      params,
    };
  }

  /**
   * Handle and format errors
   */
  protected handleError(error: Error, operation: string): Error {
    const message = `${this.entityName} repository ${operation} failed: ${error.message}`;
    const repoError = new Error(message);
    repoError.stack = error.stack;
    return repoError;
  }

  /**
   * Generate unique ID
   */
  protected generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get current timestamp
   */
  protected now(): Date {
    return new Date();
  }
}
