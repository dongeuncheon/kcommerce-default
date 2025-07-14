/**
 * Authentication Module
 * Module definition for authentication system
 */

import { BaseModule } from '../../core/module/base.module';
import { ModuleMetadata } from '../../core/module/module.interface';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repository';
import { DatabaseAdapter } from '../../adapters/database.adapter';
import { LoggerService } from '../../core/services/logger.service';
import { Container } from '../../core/di/container';
import { FastifyInstance } from 'fastify';
import { addAuthSchemas } from './auth.controller';

export class AuthModule extends BaseModule {
  static metadata: ModuleMetadata = {
    name: 'AuthModule',
    imports: [],
    providers: [
      AuthRepository,
      AuthService,
      AuthController
    ],
    exports: [AuthService, AuthRepository],
    controllers: [AuthController]
  };

  async onModuleInit(): Promise<void> {
    // Register providers
    this.registerRepository();
    this.registerService();
    this.registerController();
    
    // Initialize database tables
    await this.initializeTables();
    
    this.logger.info('Auth module initialized');
  }

  async registerRoutes(server: FastifyInstance): Promise<void> {
    // Add auth schemas
    addAuthSchemas(server);
    
    // Register auth routes
    const controller = Container.get(AuthController);
    await controller.register(server);
    
    this.logger.info('Auth routes registered');
  }

  private registerRepository(): void {
    Container.register(AuthRepository, {
      factory: (container) => {
        const adapter = container.get(DatabaseAdapter);
        return new AuthRepository(adapter);
      }
    });
  }

  private registerService(): void {
    Container.register(AuthService, {
      factory: (container) => {
        const repository = container.get(AuthRepository);
        const logger = container.get(LoggerService);
        return new AuthService(repository, logger);
      }
    });
  }

  private registerController(): void {
    Container.register(AuthController, {
      factory: (container) => {
        const service = container.get(AuthService);
        return new AuthController(service);
      }
    });
  }

  private async initializeTables(): Promise<void> {
    const adapter = Container.get(DatabaseAdapter);
    
    // Users table
    await adapter.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(36) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        phone_number VARCHAR(20) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(100) NOT NULL,
        korean_name VARCHAR(50),
        profile_image TEXT,
        birth_date DATE,
        gender ENUM('M', 'F', 'O'),
        role VARCHAR(50) DEFAULT 'customer',
        is_active BOOLEAN DEFAULT true,
        is_verified BOOLEAN DEFAULT false,
        email_verified BOOLEAN DEFAULT false,
        email_verified_at TIMESTAMP NULL,
        phone_verified BOOLEAN DEFAULT false,
        phone_verified_at TIMESTAMP NULL,
        two_factor_enabled BOOLEAN DEFAULT false,
        two_factor_secret VARCHAR(255),
        last_login TIMESTAMP NULL,
        last_login_ip VARCHAR(45),
        password_changed_at TIMESTAMP NULL,
        locked_until TIMESTAMP NULL,
        lock_reason TEXT,
        failed_login_attempts INT DEFAULT 0,
        marketing_consent BOOLEAN DEFAULT false,
        marketing_consent_date TIMESTAMP NULL,
        terms_accepted_at TIMESTAMP NOT NULL,
        privacy_accepted_at TIMESTAMP NOT NULL,
        customer_id VARCHAR(36),
        metadata JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP NULL,
        INDEX idx_email (email),
        INDEX idx_phone (phone_number),
        INDEX idx_role (role),
        INDEX idx_active (is_active),
        INDEX idx_customer (customer_id)
      )
    `);

    // Social accounts table
    await adapter.execute(`
      CREATE TABLE IF NOT EXISTS social_accounts (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        provider VARCHAR(50) NOT NULL,
        provider_id VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        name VARCHAR(100),
        profile_image TEXT,
        access_token TEXT,
        refresh_token TEXT,
        token_expires_at TIMESTAMP NULL,
        last_used TIMESTAMP NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_provider_account (provider, provider_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user (user_id),
        INDEX idx_provider (provider)
      )
    `);

    // User sessions table
    await adapter.execute(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        session_token TEXT NOT NULL,
        refresh_token TEXT NOT NULL,
        user_agent TEXT,
        ip_address VARCHAR(45),
        device_id VARCHAR(255),
        device_type VARCHAR(20),
        last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL,
        is_active BOOLEAN DEFAULT true,
        revoked_at TIMESTAMP NULL,
        revoke_reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user (user_id),
        INDEX idx_active (is_active),
        INDEX idx_expires (expires_at)
      )
    `);

    // Verification codes table
    await adapter.execute(`
      CREATE TABLE IF NOT EXISTS verification_codes (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        type ENUM('email', 'phone', 'two_factor') NOT NULL,
        code VARCHAR(10) NOT NULL,
        identifier VARCHAR(255),
        expires_at TIMESTAMP NOT NULL,
        attempts INT DEFAULT 0,
        max_attempts INT DEFAULT 3,
        verified BOOLEAN DEFAULT false,
        verified_at TIMESTAMP NULL,
        ip_address VARCHAR(45),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_type (user_id, type),
        INDEX idx_code (code),
        INDEX idx_expires (expires_at)
      )
    `);

    // Password reset tokens table
    await adapter.execute(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        token VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        used BOOLEAN DEFAULT false,
        used_at TIMESTAMP NULL,
        requested_ip VARCHAR(45),
        used_ip VARCHAR(45),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_token (token),
        INDEX idx_expires (expires_at)
      )
    `);

    // Login attempts table
    await adapter.execute(`
      CREATE TABLE IF NOT EXISTS login_attempts (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36),
        identifier VARCHAR(255) NOT NULL,
        ip_address VARCHAR(45) NOT NULL,
        user_agent TEXT,
        success BOOLEAN NOT NULL,
        failure_reason VARCHAR(255),
        attempted_at TIMESTAMP NOT NULL,
        location JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_identifier (identifier),
        INDEX idx_ip (ip_address),
        INDEX idx_attempted (attempted_at),
        INDEX idx_success (success)
      )
    `);

    // Auth audit logs table
    await adapter.execute(`
      CREATE TABLE IF NOT EXISTS auth_audit_logs (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36),
        action VARCHAR(50) NOT NULL,
        ip_address VARCHAR(45),
        user_agent TEXT,
        success BOOLEAN NOT NULL,
        details JSON,
        error TEXT,
        performed_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user (user_id),
        INDEX idx_action (action),
        INDEX idx_performed (performed_at)
      )
    `);

    // Trusted devices table
    await adapter.execute(`
      CREATE TABLE IF NOT EXISTS trusted_devices (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        device_id VARCHAR(255) NOT NULL,
        device_name VARCHAR(100),
        device_type VARCHAR(20) NOT NULL,
        user_agent TEXT NOT NULL,
        trust_token VARCHAR(255) NOT NULL,
        last_used TIMESTAMP NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        is_active BOOLEAN DEFAULT true,
        ip_address VARCHAR(45),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_user_device (user_id, device_id),
        INDEX idx_user (user_id),
        INDEX idx_device (device_id),
        INDEX idx_expires (expires_at)
      )
    `);

    // API keys table
    await adapter.execute(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        name VARCHAR(100) NOT NULL,
        key_hash VARCHAR(255) NOT NULL,
        key_prefix VARCHAR(8) NOT NULL,
        permissions JSON NOT NULL,
        last_used TIMESTAMP NULL,
        expires_at TIMESTAMP NULL,
        is_active BOOLEAN DEFAULT true,
        ip_whitelist JSON,
        rate_limit INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user (user_id),
        INDEX idx_prefix (key_prefix),
        INDEX idx_active (is_active)
      )
    `);

    // Two-factor backup codes table
    await adapter.execute(`
      CREATE TABLE IF NOT EXISTS two_factor_backup_codes (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        code VARCHAR(20) NOT NULL,
        used BOOLEAN DEFAULT false,
        used_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user (user_id),
        INDEX idx_code (code)
      )
    `);

    // Security questions table (Korean feature)
    await adapter.execute(`
      CREATE TABLE IF NOT EXISTS security_questions (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        question VARCHAR(255) NOT NULL,
        answer_hash VARCHAR(255) NOT NULL,
        is_active BOOLEAN DEFAULT true,
        last_verified TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user (user_id)
      )
    `);

    this.logger.info('Auth database tables initialized');
  }
}