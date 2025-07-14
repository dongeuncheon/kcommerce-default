import type { IBaseEntity } from '../common';

/**
 * Base entity class implementing common fields
 */
export abstract class BaseEntity implements IBaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;

  constructor() {
    this.id = this.generateId();
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  /**
   * Generate unique ID (can be overridden by subclasses)
   */
  protected generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Update the updatedAt timestamp
   */
  touch(): void {
    this.updatedAt = new Date();
  }
}