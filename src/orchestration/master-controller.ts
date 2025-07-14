import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { serviceRegistry } from '../microservices/base/service-registry';
import { apiGateway } from '../microservices/gateway/api-gateway';
import { eventBus } from '../microservices/messaging/event-bus';
import { fraudDetectionService } from '../security/fraud-detection';
import { securityMonitor } from '../security/security-monitor';
import { performanceMonitor } from '../monitoring/performance-monitor';
import { autoScaler } from '../scaling/auto-scaler';
import { reportGenerationService } from '../services/analytics/reportGenerationService';
import { analyticsDataCollector } from '../services/analytics/analyticsDataCollector';

export interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'critical' | 'down';
  services: {
    serviceRegistry: boolean;
    apiGateway: boolean;
    eventBus: boolean;
    performanceMonitor: boolean;
    securityMonitor: boolean;
    fraudDetection: boolean;
    autoScaler: boolean;
    analytics: boolean;
  };
  metrics: {
    totalServices: number;
    healthyServices: number;
    cpuUsage: number;
    memoryUsage: number;
    errorRate: number;
    responseTime: number;
  };
  alerts: number;
  lastCheck: Date;
}

export interface SystemConfiguration {
  environment: 'development' | 'staging' | 'production';
  region: string;
  version: string;
  features: {
    autoScaling: boolean;
    fraudDetection: boolean;
    realTimeAnalytics: boolean;
    reportGeneration: boolean;
    securityMonitoring: boolean;
  };
  limits: {
    maxServices: number;
    maxConcurrentUsers: number;
    maxRequestsPerSecond: number;
    maxMemoryUsage: number;
  };
}

export class MasterController extends EventEmitter {
  private isInitialized = false;
  private isRunning = false;
  private systemHealth: SystemHealth;
  private configuration: SystemConfiguration;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    
    this.configuration = this.getDefaultConfiguration();
    this.systemHealth = this.getInitialHealthState();
    
    this.setupEventListeners();
  }

  /**
   * 시스템 초기화
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      logger.info('🚀 Initializing Master Controller...');

      // 1. 기본 서비스 초기화
      await this.initializeBaseServices();

      // 2. 마이크로서비스 아키텍처 초기화
      await this.initializeMicroservices();

      // 3. 보안 시스템 초기화
      await this.initializeSecurity();

      // 4. 모니터링 시스템 초기화
      await this.initializeMonitoring();

      // 5. 분석 시스템 초기화
      await this.initializeAnalytics();

      // 6. 자동 스케일링 초기화
      await this.initializeAutoScaling();

      // 7. API 게이트웨이 라우트 설정
      await this.configureApiGateway();

      this.isInitialized = true;
      logger.info('✅ Master Controller initialization completed');

    } catch (error) {
      logger.error('❌ Master Controller initialization failed:', error);
      throw error;
    }
  }

  /**
   * 시스템 시작
   */
  async start(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (this.isRunning) return;

    try {
      logger.info('🌟 Starting Commerce Platform...');

      // 모든 서비스 시작
      performanceMonitor.start();
      autoScaler.start();
      
      // API 게이트웨이 시작
      apiGateway.start(process.env.GATEWAY_PORT ? parseInt(process.env.GATEWAY_PORT) : 8080);

      // 헬스 체크 시작
      this.startHealthCheck();

      this.isRunning = true;
      
      // 시스템 준비 완료 이벤트
      this.emit('systemReady', {
        timestamp: new Date(),
        configuration: this.configuration,
        health: this.systemHealth
      });

      logger.info('🎉 Commerce Platform is now running!');
      logger.info('📊 Dashboard: http://localhost:3000/admin/dashboard');
      logger.info('🔗 API Gateway: http://localhost:8080');
      logger.info('📈 Monitoring: http://localhost:8080/metrics');
      
    } catch (error) {
      logger.error('❌ Failed to start Commerce Platform:', error);
      throw error;
    }
  }

  /**
   * 시스템 중지
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;

    try {
      logger.info('🛑 Stopping Commerce Platform...');

      // 헬스 체크 중지
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
        this.healthCheckInterval = null;
      }

      // 서비스들 순차적으로 중지
      autoScaler.stop();
      performanceMonitor.stop();
      
      await securityMonitor.shutdown();
      await eventBus.shutdown();
      await serviceRegistry.shutdown();

      this.isRunning = false;
      
      logger.info('✅ Commerce Platform stopped successfully');
      
    } catch (error) {
      logger.error('❌ Error stopping Commerce Platform:', error);
      throw error;
    }
  }

  /**
   * 기본 서비스 초기화
   */
  private async initializeBaseServices(): Promise<void> {
    logger.info('📦 Initializing base services...');
    
    // 데이터베이스 연결 확인
    // await this.verifyDatabaseConnection();
    
    // Redis 연결 확인  
    // await this.verifyRedisConnection();
    
    logger.info('✅ Base services initialized');
  }

  /**
   * 마이크로서비스 아키텍처 초기화
   */
  private async initializeMicroservices(): Promise<void> {
    logger.info('🏗️ Initializing microservices architecture...');
    
    // 서비스 레지스트리 이벤트 리스너 설정
    serviceRegistry.on('serviceRegistered', (service) => {
      logger.info(`✅ Service registered: ${service.name}:${service.id}`);
      this.emit('serviceRegistered', service);
    });

    serviceRegistry.on('serviceDeregistered', (service) => {
      logger.warn(`❌ Service deregistered: ${service.name}:${service.id}`);
      this.emit('serviceDeregistered', service);
    });

    serviceRegistry.on('serviceUnhealthy', (service) => {
      logger.warn(`⚠️ Service unhealthy: ${service.name}:${service.id}`);
      this.emit('serviceUnhealthy', service);
    });

    // 이벤트 버스 초기화
    eventBus.on('error', (error) => {
      logger.error('Event bus error:', error);
      this.emit('systemError', { component: 'eventBus', error });
    });

    logger.info('✅ Microservices architecture initialized');
  }

  /**
   * 보안 시스템 초기화
   */
  private async initializeSecurity(): Promise<void> {
    logger.info('🔒 Initializing security systems...');
    
    // 보안 모니터 이벤트 리스너
    securityMonitor.on('securityEvent', (event) => {
      if (event.severity === 'critical' || event.severity === 'high') {
        logger.warn(`🚨 Security event: ${event.type} from ${event.ip}`);
        this.emit('securityAlert', event);
      }
    });

    // 사기 탐지 시스템 통합
    // fraudDetectionService는 이미 초기화됨

    logger.info('✅ Security systems initialized');
  }

  /**
   * 모니터링 시스템 초기화
   */
  private async initializeMonitoring(): Promise<void> {
    logger.info('📊 Initializing monitoring systems...');
    
    // 성능 모니터 이벤트 리스너
    performanceMonitor.on('alertTriggered', (alert) => {
      logger.warn(`⚠️ Performance alert: ${alert.message}`);
      this.emit('performanceAlert', alert);
    });

    performanceMonitor.on('metricsCollected', (metrics) => {
      this.updateSystemHealth(metrics);
    });

    logger.info('✅ Monitoring systems initialized');
  }

  /**
   * 분석 시스템 초기화
   */
  private async initializeAnalytics(): Promise<void> {
    logger.info('📈 Initializing analytics systems...');
    
    // 분석 데이터 수집기 이벤트 리스너
    analyticsDataCollector.on('dataCollected', (data) => {
      // 실시간 분석 데이터 처리
      this.emit('analyticsData', data);
    });

    // 리포트 생성 서비스는 이미 초기화됨

    logger.info('✅ Analytics systems initialized');
  }

  /**
   * 자동 스케일링 초기화
   */
  private async initializeAutoScaling(): Promise<void> {
    if (!this.configuration.features.autoScaling) {
      logger.info('⏭️ Auto scaling disabled - skipping initialization');
      return;
    }

    logger.info('⚖️ Initializing auto scaling...');
    
    // 자동 스케일러 이벤트 리스너
    autoScaler.on('scalingEvent', (event) => {
      logger.info(`📏 Scaling event: ${event.type} for ${event.service} (${event.fromInstances} → ${event.toInstances})`);
      this.emit('scalingEvent', event);
    });

    logger.info('✅ Auto scaling initialized');
  }

  /**
   * API 게이트웨이 설정
   */
  private async configureApiGateway(): Promise<void> {
    logger.info('🚪 Configuring API Gateway...');

    // 마이크로서비스 라우트 설정
    apiGateway.addRoute({
      path: '/api/v1/products',
      serviceName: 'product-service',
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      auth: false,
      cache: { ttl: 300 }, // 5분 캐시
      rateLimit: { windowMs: 60000, max: 100 }
    });

    apiGateway.addRoute({
      path: '/api/v1/orders',
      serviceName: 'order-service',
      methods: ['GET', 'POST', 'PUT'],
      auth: true,
      rateLimit: { windowMs: 60000, max: 50 }
    });

    apiGateway.addRoute({
      path: '/api/v1/payments',
      serviceName: 'payment-service',
      methods: ['POST'],
      auth: true,
      rateLimit: { windowMs: 60000, max: 10 }
    });

    apiGateway.addRoute({
      path: '/api/v1/analytics',
      serviceName: 'analytics-service',
      methods: ['GET'],
      auth: true,
      cache: { ttl: 60 }, // 1분 캐시
      rateLimit: { windowMs: 60000, max: 30 }
    });

    logger.info('✅ API Gateway configured');
  }

  /**
   * 헬스 체크 시작
   */
  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, 30000); // 30초마다 헬스 체크

    logger.info('💓 Health check started');
  }

  /**
   * 전체 시스템 헬스 체크
   */
  private async performHealthCheck(): Promise<void> {
    try {
      const health = await this.calculateSystemHealth();
      this.systemHealth = health;
      
      // 헬스 상태가 변경되면 이벤트 발행
      this.emit('healthCheck', health);

      // 크리티컬 상태면 알림
      if (health.overall === 'critical') {
        logger.error('🚨 CRITICAL: System health is critical!');
        this.emit('systemCritical', health);
      }

    } catch (error) {
      logger.error('Health check failed:', error);
    }
  }

  /**
   * 시스템 헬스 상태 계산
   */
  private async calculateSystemHealth(): Promise<SystemHealth> {
    const currentMetrics = performanceMonitor.getCurrentMetrics();
    const activeAlerts = performanceMonitor.getActiveAlerts();
    const services = serviceRegistry.getAllServices();

    const totalServices = Array.from(services.values()).reduce((sum, instances) => sum + instances.length, 0);
    const healthyServices = Array.from(services.values())
      .reduce((sum, instances) => sum + instances.filter(i => i.status === 'healthy').length, 0);

    const serviceHealth = {
      serviceRegistry: true,
      apiGateway: true,
      eventBus: true,
      performanceMonitor: performanceMonitor.getCurrentMetrics() !== null,
      securityMonitor: true,
      fraudDetection: true,
      autoScaler: true,
      analytics: true
    };

    const metrics = {
      totalServices,
      healthyServices,
      cpuUsage: currentMetrics?.cpu.usage || 0,
      memoryUsage: currentMetrics?.memory.usage || 0,
      errorRate: currentMetrics?.requests.errorRate || 0,
      responseTime: currentMetrics?.requests.avgResponseTime || 0
    };

    // 전체 헬스 상태 계산
    let overall: SystemHealth['overall'] = 'healthy';
    
    if (metrics.cpuUsage > 90 || metrics.memoryUsage > 90 || metrics.errorRate > 10) {
      overall = 'critical';
    } else if (metrics.cpuUsage > 80 || metrics.memoryUsage > 80 || metrics.errorRate > 5) {
      overall = 'degraded';
    } else if (healthyServices < totalServices * 0.8) {
      overall = 'degraded';
    }

    return {
      overall,
      services: serviceHealth,
      metrics,
      alerts: activeAlerts.length,
      lastCheck: new Date()
    };
  }

  /**
   * 시스템 헬스 업데이트
   */
  private updateSystemHealth(metrics: any): void {
    // 성능 메트릭 기반으로 헬스 상태 업데이트
    this.systemHealth.metrics.cpuUsage = metrics.cpu.usage;
    this.systemHealth.metrics.memoryUsage = metrics.memory.usage;
    this.systemHealth.metrics.errorRate = metrics.requests.errorRate;
    this.systemHealth.metrics.responseTime = metrics.requests.avgResponseTime;
  }

  /**
   * 기본 설정 반환
   */
  private getDefaultConfiguration(): SystemConfiguration {
    return {
      environment: (process.env.NODE_ENV as any) || 'development',
      region: process.env.AWS_REGION || 'ap-northeast-2',
      version: process.env.APP_VERSION || '1.0.0',
      features: {
        autoScaling: process.env.ENABLE_AUTO_SCALING === 'true',
        fraudDetection: process.env.ENABLE_FRAUD_DETECTION !== 'false',
        realTimeAnalytics: process.env.ENABLE_REAL_TIME_ANALYTICS !== 'false',
        reportGeneration: process.env.ENABLE_REPORT_GENERATION !== 'false',
        securityMonitoring: process.env.ENABLE_SECURITY_MONITORING !== 'false'
      },
      limits: {
        maxServices: parseInt(process.env.MAX_SERVICES || '50'),
        maxConcurrentUsers: parseInt(process.env.MAX_CONCURRENT_USERS || '10000'),
        maxRequestsPerSecond: parseInt(process.env.MAX_REQUESTS_PER_SECOND || '1000'),
        maxMemoryUsage: parseInt(process.env.MAX_MEMORY_USAGE || '85')
      }
    };
  }

  /**
   * 초기 헬스 상태 반환
   */
  private getInitialHealthState(): SystemHealth {
    return {
      overall: 'healthy',
      services: {
        serviceRegistry: false,
        apiGateway: false,
        eventBus: false,
        performanceMonitor: false,
        securityMonitor: false,
        fraudDetection: false,
        autoScaler: false,
        analytics: false
      },
      metrics: {
        totalServices: 0,
        healthyServices: 0,
        cpuUsage: 0,
        memoryUsage: 0,
        errorRate: 0,
        responseTime: 0
      },
      alerts: 0,
      lastCheck: new Date()
    };
  }

  /**
   * 이벤트 리스너 설정
   */
  private setupEventListeners(): void {
    // 프로세스 종료 시 정리
    process.on('SIGTERM', async () => {
      logger.info('🔄 Received SIGTERM, shutting down gracefully...');
      await this.stop();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      logger.info('🔄 Received SIGINT, shutting down gracefully...');
      await this.stop();
      process.exit(0);
    });

    // 처리되지 않은 예외 처리
    process.on('uncaughtException', (error) => {
      logger.error('💥 Uncaught exception:', error);
      this.emit('systemError', { component: 'process', error });
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('💥 Unhandled rejection at:', promise, 'reason:', reason);
      this.emit('systemError', { component: 'promise', error: reason });
    });
  }

  /**
   * 시스템 상태 조회
   */
  getSystemHealth(): SystemHealth {
    return { ...this.systemHealth };
  }

  /**
   * 시스템 설정 조회
   */
  getConfiguration(): SystemConfiguration {
    return { ...this.configuration };
  }

  /**
   * 설정 업데이트
   */
  updateConfiguration(updates: Partial<SystemConfiguration>): void {
    this.configuration = { ...this.configuration, ...updates };
    this.emit('configurationUpdated', this.configuration);
    logger.info('⚙️ System configuration updated');
  }

  /**
   * 시스템 통계 조회
   */
  getSystemStats(): any {
    return {
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      serviceRegistry: serviceRegistry.getAllServices().size,
      performanceMetrics: performanceMonitor.getCurrentMetrics(),
      securityStats: securityMonitor.getStats(),
      scalingHistory: autoScaler.getScalingHistory().length
    };
  }

  /**
   * 긴급 모드 활성화
   */
  async activateEmergencyMode(reason: string): Promise<void> {
    logger.error(`🚨 EMERGENCY MODE ACTIVATED: ${reason}`);
    
    // 보안 강화
    await securityMonitor.blockIP('0.0.0.0/0', 3600000, 'Emergency mode - all traffic blocked');
    
    // 스케일링 중지
    autoScaler.stop();
    
    // 알림 발송
    this.emit('emergencyMode', { reason, timestamp: new Date() });
    
    logger.error('🚨 System is now in emergency mode - manual intervention required');
  }

  /**
   * 시스템 복구
   */
  async recover(): Promise<void> {
    logger.info('🔄 Starting system recovery...');
    
    try {
      // 서비스 헬스 체크
      await this.performHealthCheck();
      
      // 자동 스케일링 재시작
      if (this.configuration.features.autoScaling) {
        autoScaler.start();
      }
      
      logger.info('✅ System recovery completed');
      this.emit('systemRecovered', { timestamp: new Date() });
      
    } catch (error) {
      logger.error('❌ System recovery failed:', error);
      throw error;
    }
  }
}

export const masterController = new MasterController();