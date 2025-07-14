import { BaseModule } from '@/core/module/base.module';
import { Container } from '@/core/di/container';
import { CategoryRepository } from './category.repository';
import { CategoryService } from './category.service';
import { CategoryController } from './category.controller';
import type { ModuleMetadata } from '@/core/module/module.interface';

export class CategoryModule extends BaseModule {
  constructor() {
    const metadata: ModuleMetadata = {
      name: 'CategoryModule',
      version: '1.0.0',
      dependencies: ['DatabaseModule', 'CacheModule', 'LoggerModule'],
      exports: ['CategoryService', 'CategoryRepository']
    };
    super(metadata);
  }

  async register(container: Container): Promise<void> {
    // Register repository
    container.register(
      'CategoryRepository',
      CategoryRepository,
      { lifecycle: 'singleton' }
    );

    // Register service
    container.register(
      'CategoryService',
      CategoryService,
      { lifecycle: 'singleton' }
    );

    // Register controller
    container.register(
      'CategoryController',
      CategoryController,
      { lifecycle: 'singleton' }
    );

    this.logger.info('CategoryModule registered successfully');
  }

  async boot(): Promise<void> {
    // Register routes
    const server = this.container.resolve('Server');
    if (server) {
      CategoryController.registerRoutes(server);
      this.logger.info('Category routes registered');
    }

    // Any additional boot logic
    this.logger.info('CategoryModule booted successfully');
  }

  async shutdown(): Promise<void> {
    // Cleanup logic if needed
    this.logger.info('CategoryModule shut down');
  }
}