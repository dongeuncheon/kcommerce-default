import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';

export interface ServiceConfig {
  name: string;
  version: string;
  host: string;
  port: number;
  protocol: 'http' | 'https' | 'grpc';
  healthCheckPath?: string;
  metadata?: Record<string, any>;
}

export interface ServiceInstance extends ServiceConfig {
  id: string;
  status: ServiceStatus;
  lastHeartbeat: Date;
  registeredAt: Date;
}

export enum ServiceStatus {
  HEALTHY = 'healthy',
  UNHEALTHY = 'unhealthy',
  STARTING = 'starting',
  STOPPING = 'stopping',
  STOPPED = 'stopped'
}

export class ServiceRegistry extends EventEmitter {
  private services: Map<string, ServiceInstance[]> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private readonly HEALTH_CHECK_INTERVAL = 30000; // 30초
  private readonly HEARTBEAT_TIMEOUT = 60000; // 60초

  constructor() {
    super();
    this.startHealthCheck();
  }

  /**
   * 서비스 등록
   */
  async register(config: ServiceConfig): Promise<string> {
    const instanceId = this.generateInstanceId();
    const instance: ServiceInstance = {
      ...config,
      id: instanceId,
      status: ServiceStatus.STARTING,
      lastHeartbeat: new Date(),
      registeredAt: new Date()
    };

    if (!this.services.has(config.name)) {
      this.services.set(config.name, []);
    }

    this.services.get(config.name)!.push(instance);
    
    logger.info(`Service registered: ${config.name}:${instanceId} at ${config.host}:${config.port}`);
    this.emit('serviceRegistered', instance);

    // 헬스체크 후 HEALTHY로 변경
    setTimeout(async () => {
      const healthy = await this.checkServiceHealth(instance);
      if (healthy) {
        instance.status = ServiceStatus.HEALTHY;
        this.emit('serviceHealthy', instance);
      }
    }, 5000);

    return instanceId;
  }

  /**
   * 서비스 등록 해제
   */
  async deregister(serviceName: string, instanceId: string): Promise<boolean> {
    const instances = this.services.get(serviceName);
    if (!instances) return false;

    const index = instances.findIndex(instance => instance.id === instanceId);
    if (index === -1) return false;

    const instance = instances[index];
    instance.status = ServiceStatus.STOPPING;
    
    instances.splice(index, 1);
    
    if (instances.length === 0) {
      this.services.delete(serviceName);
    }

    logger.info(`Service deregistered: ${serviceName}:${instanceId}`);
    this.emit('serviceDeregistered', instance);
    
    return true;
  }

  /**
   * 서비스 인스턴스 조회
   */
  getService(serviceName: string): ServiceInstance[] {
    return this.services.get(serviceName) || [];
  }

  /**
   * 건강한 서비스 인스턴스만 조회
   */
  getHealthyServices(serviceName: string): ServiceInstance[] {
    const instances = this.getService(serviceName);
    return instances.filter(instance => instance.status === ServiceStatus.HEALTHY);
  }

  /**
   * 로드 밸런싱을 위한 서비스 선택
   */
  selectService(serviceName: string, strategy: 'round-robin' | 'random' | 'least-connections' = 'round-robin'): ServiceInstance | null {
    const healthyServices = this.getHealthyServices(serviceName);
    if (healthyServices.length === 0) return null;

    switch (strategy) {
      case 'random':
        return healthyServices[Math.floor(Math.random() * healthyServices.length)];
      case 'round-robin':
        // 간단한 라운드로빈 구현
        const index = Date.now() % healthyServices.length;
        return healthyServices[index];
      default:
        return healthyServices[0];
    }
  }

  /**
   * 모든 서비스 목록 조회
   */
  getAllServices(): Map<string, ServiceInstance[]> {
    return new Map(this.services);
  }

  /**
   * 하트비트 업데이트
   */
  heartbeat(serviceName: string, instanceId: string): boolean {
    const instances = this.services.get(serviceName);
    if (!instances) return false;

    const instance = instances.find(inst => inst.id === instanceId);
    if (!instance) return false;

    instance.lastHeartbeat = new Date();
    
    if (instance.status === ServiceStatus.UNHEALTHY) {
      instance.status = ServiceStatus.HEALTHY;
      this.emit('serviceRecovered', instance);
    }

    return true;
  }

  /**
   * 헬스체크 시작
   */
  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, this.HEALTH_CHECK_INTERVAL);
  }

  /**
   * 모든 서비스 헬스체크 수행
   */
  private async performHealthChecks(): Promise<void> {
    const now = new Date();
    
    for (const [serviceName, instances] of this.services.entries()) {
      for (const instance of instances) {
        // 하트비트 타임아웃 체크
        const timeSinceHeartbeat = now.getTime() - instance.lastHeartbeat.getTime();
        
        if (timeSinceHeartbeat > this.HEARTBEAT_TIMEOUT) {
          if (instance.status === ServiceStatus.HEALTHY) {
            instance.status = ServiceStatus.UNHEALTHY;
            logger.warn(`Service unhealthy due to heartbeat timeout: ${serviceName}:${instance.id}`);
            this.emit('serviceUnhealthy', instance);
          }
          continue;
        }

        // 실제 헬스체크 수행
        if (instance.healthCheckPath) {
          const healthy = await this.checkServiceHealth(instance);
          
          if (!healthy && instance.status === ServiceStatus.HEALTHY) {
            instance.status = ServiceStatus.UNHEALTHY;
            logger.warn(`Service unhealthy: ${serviceName}:${instance.id}`);
            this.emit('serviceUnhealthy', instance);
          } else if (healthy && instance.status === ServiceStatus.UNHEALTHY) {
            instance.status = ServiceStatus.HEALTHY;
            logger.info(`Service recovered: ${serviceName}:${instance.id}`);
            this.emit('serviceRecovered', instance);
          }
        }
      }
    }
  }

  /**
   * 개별 서비스 헬스체크
   */
  private async checkServiceHealth(instance: ServiceInstance): Promise<boolean> {
    if (!instance.healthCheckPath) return true;

    try {
      const url = `${instance.protocol}://${instance.host}:${instance.port}${instance.healthCheckPath}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(5000)
      });
      
      return response.ok;
    } catch (error) {
      logger.debug(`Health check failed for ${instance.name}:${instance.id}:`, error);
      return false;
    }
  }

  /**
   * 인스턴스 ID 생성
   */
  private generateInstanceId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 서비스 레지스트리 종료
   */
  async shutdown(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    // 모든 서비스를 STOPPED 상태로 변경
    for (const [serviceName, instances] of this.services.entries()) {
      for (const instance of instances) {
        instance.status = ServiceStatus.STOPPED;
        this.emit('serviceStopped', instance);
      }
    }

    this.services.clear();
    logger.info('Service registry shutdown completed');
  }
}

export const serviceRegistry = new ServiceRegistry();