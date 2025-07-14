/**
 * Dependency Injection Container Interface
 */

/**
 * Service identifier type
 */
export type ServiceIdentifier<T = unknown> = string | symbol | Constructor<T>;

/**
 * Constructor type
 */
export type Constructor<T = {}> = new (...args: any[]) => T;

/**
 * Factory function type
 */
export type Factory<T> = (container: IContainer) => T;

/**
 * Service lifecycle
 */
export enum LifetimeScope {
  /**
   * New instance created every time
   */
  Transient = 'transient',
  /**
   * Single instance per container
   */
  Singleton = 'singleton',
  /**
   * Single instance per scope
   */
  Scoped = 'scoped',
}

/**
 * Service definition
 */
export interface ServiceDefinition {
  implementation: new (...args: any[]) => any;
  lifetime: LifetimeScope;
  dependencies: (string | symbol)[];
}

/**
 * Dependency injection container interface
 */
export interface IContainer {
  /**
   * Register a service with the container
   */
  register<T>(
    token: string | symbol,
    implementation: new (...args: any[]) => T,
    lifetime?: LifetimeScope
  ): void;

  /**
   * Resolve a service from the container
   */
  resolve<T>(token: string | symbol): T;

  /**
   * Check if a service is registered
   */
  isRegistered(token: string | symbol): boolean;

  /**
   * Auto register a class based on metadata
   */
  autoRegister(target: any): void;
}