import { BaseModule } from '@/core/module/base.module';
import { Container } from '@/core/di/container';
import { ProductRepository } from './product.repository';
import { ProductService } from './product.service';
import { ProductController } from './product.controller';
import type { ModuleMetadata } from '@/core/module/module.interface';

export class ProductModule extends BaseModule {
  constructor() {
    const metadata: ModuleMetadata = {
      name: 'ProductModule',
      version: '1.0.0',
      dependencies: ['DatabaseModule', 'CacheModule', 'LoggerModule', 'CategoryModule'],
      exports: ['ProductService', 'ProductRepository']
    };
    super(metadata);
  }

  async register(container: Container): Promise<void> {
    // Register repository
    container.register(
      'ProductRepository',
      ProductRepository,
      { lifecycle: 'singleton' }
    );

    // Register service
    container.register(
      'ProductService',
      ProductService,
      { lifecycle: 'singleton' }
    );

    // Register controller
    container.register(
      'ProductController',
      ProductController,
      { lifecycle: 'singleton' }
    );

    this.logger.info('ProductModule registered successfully');
  }

  async boot(): Promise<void> {
    // Register routes
    const server = this.container.resolve('Server');
    if (server) {
      ProductController.registerRoutes(server);
      this.logger.info('Product routes registered');
    }

    // Any additional boot logic
    this.logger.info('ProductModule booted successfully');
  }

  async shutdown(): Promise<void> {
    // Cleanup logic if needed
    this.logger.info('ProductModule shut down');
  }
}