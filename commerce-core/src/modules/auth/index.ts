/**
 * Authentication Module
 * Export all authentication components
 */

export * from './auth.types';
export * from './auth.entity';
export * from './auth.repository';
export * from './auth.service';
export * from './auth.controller';
export * from './auth.middleware';

// Module registration
import { Container } from '../../core/di/container';
import { DatabaseAdapter } from '../../adapters/database.adapter';
import { LoggerService } from '../../core/services/logger.service';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';

export function registerAuthModule(): void {
  // Register repository
  Container.register(AuthRepository, {
    factory: (container) => {
      const adapter = container.get(DatabaseAdapter);
      return new AuthRepository(adapter);
    }
  });

  // Register service
  Container.register(AuthService, {
    factory: (container) => {
      const repository = container.get(AuthRepository);
      const logger = container.get(LoggerService);
      return new AuthService(repository, logger);
    }
  });

  // Register controller
  Container.register(AuthController, {
    factory: (container) => {
      const service = container.get(AuthService);
      return new AuthController(service);
    }
  });
}