import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { performanceMonitor, PerformanceMetrics } from '../monitoring/performance-monitor';
import { serviceRegistry, ServiceInstance } from '../microservices/base/service-registry';

export interface ScalingPolicy {
  name: string;
  targetMetric: string;
  minValue: number;
  maxValue: number;
  scaleUpThreshold: number;
  scaleDownThreshold: number;
  minInstances: number;
  maxInstances: number;
  cooldownPeriod: number; // milliseconds
  scalingStep: number; // 한 번에 몇 개씩 스케일링
}

export interface ScalingEvent {
  id: string;
  type: 'scale_up' | 'scale_down';
  service: string;
  reason: string;
  fromInstances: number;
  toInstances: number;
  timestamp: Date;
  metrics: any;
}

export interface ServiceScalingConfig {
  serviceName: string;
  policy: ScalingPolicy;
  currentInstances: number;
  targetInstances: number;
  lastScalingAction: Date | null;
  isEnabled: boolean;
}

export class AutoScaler extends EventEmitter {
  private scalingConfigs: Map<string, ServiceScalingConfig> = new Map();
  private scalingHistory: ScalingEvent[] = [];
  private isRunning = false;
  private checkInterval = 30000; // 30초마다 체크
  private maxHistorySize = 1000;

  // 스케일링 프로바이더 (실제 구현시 Docker, Kubernetes 등)
  private scalingProviders: Map<string, ScalingProvider> = new Map();

  constructor() {
    super();
    this.initializeDefaultPolicies();
    this.setupEventListeners();
  }

  /**
   * 자동 스케일링 시작
   */
  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    performanceMonitor.start();

    const interval = setInterval(async () => {
      if (!this.isRunning) {
        clearInterval(interval);
        return;
      }
      await this.evaluateScaling();
    }, this.checkInterval);

    logger.info('Auto scaler started');
  }

  /**
   * 자동 스케일링 중지
   */
  stop(): void {
    this.isRunning = false;
    logger.info('Auto scaler stopped');
  }

  /**
   * 서비스 스케일링 설정 추가
   */
  addServiceConfig(config: Omit<ServiceScalingConfig, 'currentInstances' | 'targetInstances' | 'lastScalingAction'>): void {
    const fullConfig: ServiceScalingConfig = {
      ...config,
      currentInstances: this.getCurrentInstanceCount(config.serviceName),
      targetInstances: this.getCurrentInstanceCount(config.serviceName),
      lastScalingAction: null
    };

    this.scalingConfigs.set(config.serviceName, fullConfig);
    
    // 스케일링 프로바이더 등록
    if (!this.scalingProviders.has(config.serviceName)) {
      this.scalingProviders.set(config.serviceName, new DockerScalingProvider(config.serviceName));
    }

    logger.info(`Scaling configuration added for service: ${config.serviceName}`);
  }

  /**
   * 스케일링 평가 및 실행
   */
  private async evaluateScaling(): Promise<void> {
    const currentMetrics = performanceMonitor.getCurrentMetrics();
    if (!currentMetrics) return;

    for (const [serviceName, config] of this.scalingConfigs.entries()) {
      if (!config.isEnabled) continue;

      try {
        await this.evaluateServiceScaling(serviceName, config, currentMetrics);
      } catch (error) {
        logger.error(`Failed to evaluate scaling for ${serviceName}:`, error);
      }
    }
  }

  /**
   * 개별 서비스 스케일링 평가
   */
  private async evaluateServiceScaling(
    serviceName: string,
    config: ServiceScalingConfig,
    metrics: PerformanceMetrics
  ): Promise<void> {
    // 쿨다운 기간 확인
    if (config.lastScalingAction) {
      const timeSinceLastAction = Date.now() - config.lastScalingAction.getTime();
      if (timeSinceLastAction < config.policy.cooldownPeriod) {
        return;
      }
    }

    // 현재 인스턴스 수 업데이트
    config.currentInstances = this.getCurrentInstanceCount(serviceName);

    // 메트릭 값 추출
    const metricValue = this.getMetricValue(metrics, config.policy.targetMetric);
    
    // 스케일링 결정
    const decision = this.makeScalingDecision(config, metricValue);
    
    if (decision !== 'none') {
      await this.executeScaling(serviceName, config, decision, metricValue, metrics);
    }
  }

  /**
   * 스케일링 결정 로직
   */
  private makeScalingDecision(config: ServiceScalingConfig, metricValue: number): 'up' | 'down' | 'none' {
    const { policy, currentInstances } = config;

    // 스케일 업 조건
    if (metricValue > policy.scaleUpThreshold && currentInstances < policy.maxInstances) {
      return 'up';
    }

    // 스케일 다운 조건
    if (metricValue < policy.scaleDownThreshold && currentInstances > policy.minInstances) {
      return 'down';
    }

    return 'none';
  }

  /**
   * 스케일링 실행
   */
  private async executeScaling(
    serviceName: string,
    config: ServiceScalingConfig,
    direction: 'up' | 'down',
    metricValue: number,
    metrics: PerformanceMetrics
  ): Promise<void> {
    const currentInstances = config.currentInstances;
    let targetInstances: number;

    if (direction === 'up') {
      targetInstances = Math.min(
        currentInstances + config.policy.scalingStep,
        config.policy.maxInstances
      );
    } else {
      targetInstances = Math.max(
        currentInstances - config.policy.scalingStep,
        config.policy.minInstances
      );
    }

    if (targetInstances === currentInstances) {
      return; // 변경사항 없음
    }

    try {
      // 실제 스케일링 실행
      const provider = this.scalingProviders.get(serviceName);
      if (!provider) {
        throw new Error(`No scaling provider found for ${serviceName}`);
      }

      await provider.scale(targetInstances);

      // 설정 업데이트
      config.targetInstances = targetInstances;
      config.lastScalingAction = new Date();

      // 이벤트 기록
      const scalingEvent: ScalingEvent = {
        id: this.generateEventId(),
        type: direction === 'up' ? 'scale_up' : 'scale_down',
        service: serviceName,
        reason: `${config.policy.targetMetric} = ${metricValue} (threshold: ${direction === 'up' ? config.policy.scaleUpThreshold : config.policy.scaleDownThreshold})`,
        fromInstances: currentInstances,
        toInstances: targetInstances,
        timestamp: new Date(),
        metrics: { [config.policy.targetMetric]: metricValue }
      };

      this.recordScalingEvent(scalingEvent);

      logger.info(`Scaling ${direction}: ${serviceName} from ${currentInstances} to ${targetInstances} instances`);
      
      // 스케일링 완료 대기
      await this.waitForScalingCompletion(serviceName, targetInstances);

    } catch (error) {
      logger.error(`Failed to scale ${serviceName}:`, error);
      
      // 실패 이벤트 기록
      const failureEvent: ScalingEvent = {
        id: this.generateEventId(),
        type: direction === 'up' ? 'scale_up' : 'scale_down',
        service: serviceName,
        reason: `Scaling failed: ${error.message}`,
        fromInstances: currentInstances,
        toInstances: currentInstances,
        timestamp: new Date(),
        metrics: { error: error.message }
      };

      this.recordScalingEvent(failureEvent);
    }
  }

  /**
   * 스케일링 완료 대기
   */
  private async waitForScalingCompletion(serviceName: string, targetInstances: number): Promise<void> {
    const maxWaitTime = 300000; // 5분 최대 대기
    const checkInterval = 10000; // 10초마다 확인
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      const currentInstances = this.getCurrentInstanceCount(serviceName);
      
      if (currentInstances === targetInstances) {
        logger.info(`Scaling completed for ${serviceName}: ${targetInstances} instances running`);
        return;
      }

      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }

    logger.warn(`Scaling completion timeout for ${serviceName} (target: ${targetInstances})`);
  }

  /**
   * 수동 스케일링
   */
  async manualScale(serviceName: string, targetInstances: number, reason: string = 'Manual scaling'): Promise<void> {
    const config = this.scalingConfigs.get(serviceName);
    if (!config) {
      throw new Error(`No scaling configuration found for ${serviceName}`);
    }

    const currentInstances = this.getCurrentInstanceCount(serviceName);
    
    if (targetInstances < config.policy.minInstances || targetInstances > config.policy.maxInstances) {
      throw new Error(`Target instances ${targetInstances} is outside allowed range [${config.policy.minInstances}, ${config.policy.maxInstances}]`);
    }

    const provider = this.scalingProviders.get(serviceName);
    if (!provider) {
      throw new Error(`No scaling provider found for ${serviceName}`);
    }

    await provider.scale(targetInstances);

    // 설정 업데이트
    config.currentInstances = currentInstances;
    config.targetInstances = targetInstances;
    config.lastScalingAction = new Date();

    // 이벤트 기록
    const scalingEvent: ScalingEvent = {
      id: this.generateEventId(),
      type: targetInstances > currentInstances ? 'scale_up' : 'scale_down',
      service: serviceName,
      reason,
      fromInstances: currentInstances,
      toInstances: targetInstances,
      timestamp: new Date(),
      metrics: { manual: true }
    };

    this.recordScalingEvent(scalingEvent);

    logger.info(`Manual scaling: ${serviceName} from ${currentInstances} to ${targetInstances} instances`);
  }

  /**
   * 예측 기반 스케일링
   */
  async predictiveScale(serviceName: string): Promise<void> {
    const config = this.scalingConfigs.get(serviceName);
    if (!config) return;

    // 과거 메트릭 데이터 분석
    const history = performanceMonitor.getMetricsHistory(100); // 최근 100개 데이터포인트
    if (history.length < 10) return; // 충분한 데이터 없음

    // 트렌드 분석
    const metricValues = history.map(m => this.getMetricValue(m, config.policy.targetMetric));
    const trend = this.calculateTrend(metricValues);
    
    // 예측 값 계산 (단순 선형 예측)
    const predictedValue = metricValues[metricValues.length - 1] + (trend * 5); // 5주기 후 예측

    // 예측 기반 스케일링 결정
    const currentInstances = config.currentInstances;
    let targetInstances = currentInstances;

    if (predictedValue > config.policy.scaleUpThreshold * 0.8) { // 80% 도달 시 미리 스케일업
      targetInstances = Math.min(currentInstances + 1, config.policy.maxInstances);
    } else if (predictedValue < config.policy.scaleDownThreshold * 1.2) { // 120% 이하로 예측 시 스케일다운
      targetInstances = Math.max(currentInstances - 1, config.policy.minInstances);
    }

    if (targetInstances !== currentInstances) {
      await this.manualScale(serviceName, targetInstances, `Predictive scaling: predicted ${config.policy.targetMetric} = ${predictedValue.toFixed(2)}`);
    }
  }

  /**
   * 기본 스케일링 정책 초기화
   */
  private initializeDefaultPolicies(): void {
    // API 서버 스케일링 정책
    this.addServiceConfig({
      serviceName: 'commerce-api',
      policy: {
        name: 'API Server Auto Scaling',
        targetMetric: 'cpu.usage',
        minValue: 0,
        maxValue: 100,
        scaleUpThreshold: 70,
        scaleDownThreshold: 30,
        minInstances: 2,
        maxInstances: 10,
        cooldownPeriod: 300000, // 5분
        scalingStep: 1
      },
      isEnabled: true
    });

    // 데이터베이스 스케일링 정책 (읽기 전용 복제본)
    this.addServiceConfig({
      serviceName: 'postgres-read',
      policy: {
        name: 'Database Read Replica Scaling',
        targetMetric: 'database.connections',
        minValue: 0,
        maxValue: 1000,
        scaleUpThreshold: 80,
        scaleDownThreshold: 20,
        minInstances: 1,
        maxInstances: 5,
        cooldownPeriod: 600000, // 10분
        scalingStep: 1
      },
      isEnabled: true
    });

    // Redis 캐시 스케일링 정책
    this.addServiceConfig({
      serviceName: 'redis-cache',
      policy: {
        name: 'Redis Cache Scaling',
        targetMetric: 'cache.operations',
        minValue: 0,
        maxValue: 10000,
        scaleUpThreshold: 8000,
        scaleDownThreshold: 2000,
        minInstances: 1,
        maxInstances: 3,
        cooldownPeriod: 300000, // 5분
        scalingStep: 1
      },
      isEnabled: false // 기본적으로 비활성화
    });
  }

  /**
   * 이벤트 리스너 설정
   */
  private setupEventListeners(): void {
    // 성능 모니터 이벤트 리스닝
    performanceMonitor.on('metricsCollected', (metrics: PerformanceMetrics) => {
      this.emit('metricsReceived', metrics);
    });

    performanceMonitor.on('alertTriggered', (alert: any) => {
      // 알림 기반 즉시 스케일링
      this.handlePerformanceAlert(alert);
    });
  }

  /**
   * 성능 알림 처리
   */
  private async handlePerformanceAlert(alert: any): Promise<void> {
    // 크리티컬 알림 시 즉시 스케일링
    if (alert.threshold.severity === 'critical') {
      for (const [serviceName, config] of this.scalingConfigs.entries()) {
        if (config.isEnabled && alert.threshold.metric.includes(config.policy.targetMetric)) {
          try {
            const currentInstances = config.currentInstances;
            const targetInstances = Math.min(currentInstances + 2, config.policy.maxInstances);
            
            if (targetInstances > currentInstances) {
              await this.manualScale(serviceName, targetInstances, `Emergency scaling due to critical alert: ${alert.message}`);
            }
          } catch (error) {
            logger.error(`Emergency scaling failed for ${serviceName}:`, error);
          }
        }
      }
    }
  }

  /**
   * 스케일링 이벤트 기록
   */
  private recordScalingEvent(event: ScalingEvent): void {
    this.scalingHistory.push(event);
    
    if (this.scalingHistory.length > this.maxHistorySize) {
      this.scalingHistory.shift();
    }

    this.emit('scalingEvent', event);
  }

  /**
   * 트렌드 계산 (단순 선형 회귀)
   */
  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;

    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = values;

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    return slope;
  }

  /**
   * 메트릭 값 추출
   */
  private getMetricValue(metrics: PerformanceMetrics, path: string): number {
    const parts = path.split('.');
    let value: any = metrics;
    
    for (const part of parts) {
      value = value?.[part];
    }
    
    return typeof value === 'number' ? value : 0;
  }

  /**
   * 현재 인스턴스 수 조회
   */
  private getCurrentInstanceCount(serviceName: string): number {
    const instances = serviceRegistry.getHealthyServices(serviceName);
    return instances.length;
  }

  /**
   * 이벤트 ID 생성
   */
  private generateEventId(): string {
    return `scale_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 스케일링 히스토리 조회
   */
  getScalingHistory(serviceName?: string): ScalingEvent[] {
    if (serviceName) {
      return this.scalingHistory.filter(event => event.service === serviceName);
    }
    return [...this.scalingHistory];
  }

  /**
   * 서비스 스케일링 상태 조회
   */
  getScalingStatus(): ServiceScalingConfig[] {
    return Array.from(this.scalingConfigs.values());
  }

  /**
   * 스케일링 설정 업데이트
   */
  updateServiceConfig(serviceName: string, updates: Partial<ServiceScalingConfig>): void {
    const config = this.scalingConfigs.get(serviceName);
    if (!config) {
      throw new Error(`No scaling configuration found for ${serviceName}`);
    }

    Object.assign(config, updates);
    logger.info(`Scaling configuration updated for ${serviceName}`);
  }
}

/**
 * 스케일링 프로바이더 인터페이스
 */
interface ScalingProvider {
  scale(targetInstances: number): Promise<void>;
  getCurrentInstances(): Promise<number>;
}

/**
 * Docker 스케일링 프로바이더 (예시)
 */
class DockerScalingProvider implements ScalingProvider {
  constructor(private serviceName: string) {}

  async scale(targetInstances: number): Promise<void> {
    // 실제 구현시 Docker API 호출
    logger.info(`Docker scaling ${this.serviceName} to ${targetInstances} instances`);
    
    // 시뮬레이션
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  async getCurrentInstances(): Promise<number> {
    // 실제 구현시 Docker API에서 조회
    return serviceRegistry.getHealthyServices(this.serviceName).length;
  }
}

export const autoScaler = new AutoScaler();