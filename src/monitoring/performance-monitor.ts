import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import os from 'os';
import { logger } from '../utils/logger';
import { cacheService } from '../services/cacheService';

export interface PerformanceMetrics {
  timestamp: Date;
  
  // System metrics
  cpu: {
    usage: number; // percentage
    loadAverage: number[];
    coreCount: number;
  };
  
  memory: {
    used: number; // bytes
    free: number; // bytes
    total: number; // bytes
    heapUsed: number; // bytes
    heapTotal: number; // bytes
    usage: number; // percentage
  };
  
  // Application metrics
  requests: {
    total: number;
    perSecond: number;
    avgResponseTime: number;
    errorRate: number;
  };
  
  // Database metrics
  database: {
    connections: number;
    activeQueries: number;
    avgQueryTime: number;
    slowQueries: number;
  };
  
  // Cache metrics
  cache: {
    hitRate: number;
    missRate: number;
    evictions: number;
    operations: number;
  };
  
  // Custom business metrics
  business: {
    activeUsers: number;
    ordersPerMinute: number;
    revenue: number;
    conversionRate: number;
  };
}

export interface AlertThreshold {
  metric: string;
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'ne';
  value: number;
  severity: 'info' | 'warning' | 'error' | 'critical';
  duration?: number; // ms - threshold must be breached for this duration
}

export interface PerformanceAlert {
  id: string;
  threshold: AlertThreshold;
  currentValue: number;
  triggeredAt: Date;
  message: string;
  acknowledged: boolean;
}

export class PerformanceMonitor extends EventEmitter {
  private isRunning = false;
  private collectInterval = 30000; // 30초마다 수집
  private metricsHistory: PerformanceMetrics[] = [];
  private maxHistorySize = 1440; // 12시간분 (30초 * 1440 = 12시간)
  
  // 성능 카운터
  private counters = {
    requests: 0,
    errors: 0,
    responses: new Map<string, number>(),
    queryTimes: new Map<string, number[]>(),
    cacheOperations: { hits: 0, misses: 0, evictions: 0, total: 0 }
  };
  
  // 알림 임계값
  private alertThresholds: AlertThreshold[] = [];
  private activeAlerts: Map<string, PerformanceAlert> = new Map();
  
  // 자동 스케일링 설정
  private autoScaling = {
    enabled: false,
    minInstances: 1,
    maxInstances: 10,
    scaleUpThreshold: 80, // CPU 80% 이상
    scaleDownThreshold: 30, // CPU 30% 이하
    cooldownPeriod: 300000 // 5분
  };

  constructor() {
    super();
    this.initializeDefaultThresholds();
  }

  /**
   * 모니터링 시작
   */
  start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.collectMetrics();
    
    const interval = setInterval(() => {
      if (!this.isRunning) {
        clearInterval(interval);
        return;
      }
      this.collectMetrics();
    }, this.collectInterval);
    
    logger.info('Performance monitoring started');
  }

  /**
   * 모니터링 중지
   */
  stop(): void {
    this.isRunning = false;
    logger.info('Performance monitoring stopped');
  }

  /**
   * 메트릭 수집
   */
  private async collectMetrics(): Promise<void> {
    try {
      const metrics: PerformanceMetrics = {
        timestamp: new Date(),
        cpu: this.getCPUMetrics(),
        memory: this.getMemoryMetrics(),
        requests: this.getRequestMetrics(),
        database: await this.getDatabaseMetrics(),
        cache: await this.getCacheMetrics(),
        business: await this.getBusinessMetrics()
      };

      // 히스토리에 추가
      this.metricsHistory.push(metrics);
      if (this.metricsHistory.length > this.maxHistorySize) {
        this.metricsHistory.shift();
      }

      // 알림 확인
      await this.checkAlerts(metrics);

      // 자동 스케일링 확인
      await this.checkAutoScaling(metrics);

      // 이벤트 발행
      this.emit('metricsCollected', metrics);

      // 메트릭 저장
      await this.storeMetrics(metrics);

    } catch (error) {
      logger.error('Failed to collect metrics:', error);
    }
  }

  /**
   * CPU 메트릭 수집
   */
  private getCPUMetrics(): PerformanceMetrics['cpu'] {
    const cpus = os.cpus();
    const loadAvg = os.loadavg();
    
    // CPU 사용률 계산 (단순화된 버전)
    let totalIdle = 0;
    let totalTick = 0;
    
    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times];
      }
      totalIdle += cpu.times.idle;
    });
    
    const usage = 100 - ~~(100 * totalIdle / totalTick);

    return {
      usage,
      loadAverage: loadAvg,
      coreCount: cpus.length
    };
  }

  /**
   * 메모리 메트릭 수집
   */
  private getMemoryMetrics(): PerformanceMetrics['memory'] {
    const totalMem = os.totalmem();
    const freeMem = os.freememory();
    const usedMem = totalMem - freeMem;
    
    const memUsage = process.memoryUsage();
    
    return {
      used: usedMem,
      free: freeMem,
      total: totalMem,
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      usage: (usedMem / totalMem) * 100
    };
  }

  /**
   * 요청 메트릭 수집
   */
  private getRequestMetrics(): PerformanceMetrics['requests'] {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // 최근 1분간의 응답 시간 계산
    const recentResponses = Array.from(this.counters.responses.entries())
      .filter(([timestamp]) => parseInt(timestamp) > oneMinuteAgo)
      .map(([, time]) => time);
    
    const avgResponseTime = recentResponses.length > 0 
      ? recentResponses.reduce((sum, time) => sum + time, 0) / recentResponses.length 
      : 0;
    
    const perSecond = recentResponses.length / 60;
    const errorRate = this.counters.errors / Math.max(this.counters.requests, 1) * 100;

    return {
      total: this.counters.requests,
      perSecond,
      avgResponseTime,
      errorRate
    };
  }

  /**
   * 데이터베이스 메트릭 수집
   */
  private async getDatabaseMetrics(): Promise<PerformanceMetrics['database']> {
    try {
      // Prisma 연결 풀 정보 (실제 구현시 Prisma metrics 사용)
      const connections = 10; // 현재 활성 연결 수
      const activeQueries = 2; // 현재 실행 중인 쿼리 수
      
      // 최근 쿼리 시간 분석
      const queryTimes = Array.from(this.counters.queryTimes.values()).flat();
      const avgQueryTime = queryTimes.length > 0 
        ? queryTimes.reduce((sum, time) => sum + time, 0) / queryTimes.length 
        : 0;
      
      const slowQueries = queryTimes.filter(time => time > 1000).length;

      return {
        connections,
        activeQueries,
        avgQueryTime,
        slowQueries
      };
    } catch (error) {
      logger.warn('Failed to collect database metrics:', error);
      return {
        connections: 0,
        activeQueries: 0,
        avgQueryTime: 0,
        slowQueries: 0
      };
    }
  }

  /**
   * 캐시 메트릭 수집
   */
  private async getCacheMetrics(): Promise<PerformanceMetrics['cache']> {
    try {
      const { hits, misses, evictions, total } = this.counters.cacheOperations;
      const hitRate = total > 0 ? (hits / total) * 100 : 0;
      const missRate = total > 0 ? (misses / total) * 100 : 0;

      return {
        hitRate,
        missRate,
        evictions,
        operations: total
      };
    } catch (error) {
      logger.warn('Failed to collect cache metrics:', error);
      return {
        hitRate: 0,
        missRate: 0,
        evictions: 0,
        operations: 0
      };
    }
  }

  /**
   * 비즈니스 메트릭 수집
   */
  private async getBusinessMetrics(): Promise<PerformanceMetrics['business']> {
    try {
      // 실제 구현시 데이터베이스에서 조회
      const activeUsers = await this.getActiveUsersCount();
      const ordersPerMinute = await this.getOrdersPerMinute();
      const revenue = await this.getCurrentRevenue();
      const conversionRate = await this.getConversionRate();

      return {
        activeUsers,
        ordersPerMinute,
        revenue,
        conversionRate
      };
    } catch (error) {
      logger.warn('Failed to collect business metrics:', error);
      return {
        activeUsers: 0,
        ordersPerMinute: 0,
        revenue: 0,
        conversionRate: 0
      };
    }
  }

  /**
   * 요청 기록
   */
  recordRequest(responseTime: number, isError: boolean = false): void {
    this.counters.requests++;
    this.counters.responses.set(Date.now().toString(), responseTime);
    
    if (isError) {
      this.counters.errors++;
    }
    
    // 오래된 응답 시간 데이터 정리 (5분 이상)
    const fiveMinutesAgo = Date.now() - 300000;
    for (const [timestamp] of this.counters.responses.entries()) {
      if (parseInt(timestamp) < fiveMinutesAgo) {
        this.counters.responses.delete(timestamp);
      }
    }
  }

  /**
   * 데이터베이스 쿼리 기록
   */
  recordDatabaseQuery(queryType: string, duration: number): void {
    if (!this.counters.queryTimes.has(queryType)) {
      this.counters.queryTimes.set(queryType, []);
    }
    
    const times = this.counters.queryTimes.get(queryType)!;
    times.push(duration);
    
    // 최근 100개만 유지
    if (times.length > 100) {
      times.shift();
    }
  }

  /**
   * 캐시 작업 기록
   */
  recordCacheOperation(type: 'hit' | 'miss' | 'eviction'): void {
    this.counters.cacheOperations.total++;
    
    switch (type) {
      case 'hit':
        this.counters.cacheOperations.hits++;
        break;
      case 'miss':
        this.counters.cacheOperations.misses++;
        break;
      case 'eviction':
        this.counters.cacheOperations.evictions++;
        break;
    }
  }

  /**
   * 알림 임계값 추가
   */
  addAlertThreshold(threshold: AlertThreshold): void {
    this.alertThresholds.push(threshold);
    logger.info(`Alert threshold added: ${threshold.metric} ${threshold.operator} ${threshold.value}`);
  }

  /**
   * 알림 확인
   */
  private async checkAlerts(metrics: PerformanceMetrics): Promise<void> {
    for (const threshold of this.alertThresholds) {
      const currentValue = this.getMetricValue(metrics, threshold.metric);
      const isTriggered = this.evaluateThreshold(currentValue, threshold);
      
      const alertId = `${threshold.metric}_${threshold.operator}_${threshold.value}`;
      
      if (isTriggered && !this.activeAlerts.has(alertId)) {
        // 새 알림 생성
        const alert: PerformanceAlert = {
          id: alertId,
          threshold,
          currentValue,
          triggeredAt: new Date(),
          message: `${threshold.metric} is ${currentValue} (threshold: ${threshold.operator} ${threshold.value})`,
          acknowledged: false
        };
        
        this.activeAlerts.set(alertId, alert);
        this.emit('alertTriggered', alert);
        
        await this.sendAlert(alert);
        
      } else if (!isTriggered && this.activeAlerts.has(alertId)) {
        // 알림 해제
        const alert = this.activeAlerts.get(alertId)!;
        this.activeAlerts.delete(alertId);
        this.emit('alertResolved', alert);
      }
    }
  }

  /**
   * 자동 스케일링 확인
   */
  private async checkAutoScaling(metrics: PerformanceMetrics): Promise<void> {
    if (!this.autoScaling.enabled) return;
    
    const cpuUsage = metrics.cpu.usage;
    const memoryUsage = metrics.memory.usage;
    
    // 스케일 업 조건
    if (cpuUsage > this.autoScaling.scaleUpThreshold || memoryUsage > 85) {
      await this.triggerScaleUp(metrics);
    }
    
    // 스케일 다운 조건
    if (cpuUsage < this.autoScaling.scaleDownThreshold && memoryUsage < 50) {
      await this.triggerScaleDown(metrics);
    }
  }

  /**
   * 스케일 업 트리거
   */
  private async triggerScaleUp(metrics: PerformanceMetrics): Promise<void> {
    logger.info(`Triggering scale up: CPU ${metrics.cpu.usage}%, Memory ${metrics.memory.usage}%`);
    this.emit('scaleUp', { reason: 'high_resource_usage', metrics });
    
    // 실제 구현시 Kubernetes, Docker Swarm, AWS Auto Scaling 등 호출
  }

  /**
   * 스케일 다운 트리거
   */
  private async triggerScaleDown(metrics: PerformanceMetrics): Promise<void> {
    logger.info(`Triggering scale down: CPU ${metrics.cpu.usage}%, Memory ${metrics.memory.usage}%`);
    this.emit('scaleDown', { reason: 'low_resource_usage', metrics });
    
    // 실제 구현시 스케일링 플랫폼 호출
  }

  /**
   * 기본 알림 임계값 초기화
   */
  private initializeDefaultThresholds(): void {
    this.addAlertThreshold({
      metric: 'cpu.usage',
      operator: 'gte',
      value: 80,
      severity: 'warning'
    });
    
    this.addAlertThreshold({
      metric: 'cpu.usage',
      operator: 'gte',
      value: 95,
      severity: 'critical'
    });
    
    this.addAlertThreshold({
      metric: 'memory.usage',
      operator: 'gte',
      value: 85,
      severity: 'warning'
    });
    
    this.addAlertThreshold({
      metric: 'requests.errorRate',
      operator: 'gte',
      value: 5,
      severity: 'error'
    });
    
    this.addAlertThreshold({
      metric: 'requests.avgResponseTime',
      operator: 'gte',
      value: 2000,
      severity: 'warning'
    });
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
   * 임계값 평가
   */
  private evaluateThreshold(value: number, threshold: AlertThreshold): boolean {
    switch (threshold.operator) {
      case 'gt': return value > threshold.value;
      case 'gte': return value >= threshold.value;
      case 'lt': return value < threshold.value;
      case 'lte': return value <= threshold.value;
      case 'eq': return value === threshold.value;
      case 'ne': return value !== threshold.value;
      default: return false;
    }
  }

  /**
   * 알림 전송
   */
  private async sendAlert(alert: PerformanceAlert): Promise<void> {
    // 실제 구현시 이메일, 슬랙, SMS 등으로 알림
    logger.warn(`PERFORMANCE ALERT: ${alert.message}`);
  }

  /**
   * 메트릭 저장
   */
  private async storeMetrics(metrics: PerformanceMetrics): Promise<void> {
    try {
      // Redis에 최근 메트릭 저장
      await cacheService.set('performance:latest', metrics, 300);
      
      // 시계열 데이터로 저장 (실제 구현시 InfluxDB, Prometheus 등 사용)
      const key = `performance:${metrics.timestamp.getTime()}`;
      await cacheService.set(key, metrics, 3600);
    } catch (error) {
      logger.error('Failed to store metrics:', error);
    }
  }

  /**
   * 현재 메트릭 조회
   */
  getCurrentMetrics(): PerformanceMetrics | null {
    return this.metricsHistory.length > 0 
      ? this.metricsHistory[this.metricsHistory.length - 1]
      : null;
  }

  /**
   * 메트릭 히스토리 조회
   */
  getMetricsHistory(limit?: number): PerformanceMetrics[] {
    if (limit && limit < this.metricsHistory.length) {
      return this.metricsHistory.slice(-limit);
    }
    return [...this.metricsHistory];
  }

  /**
   * 활성 알림 조회
   */
  getActiveAlerts(): PerformanceAlert[] {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * 자동 스케일링 설정
   */
  configureAutoScaling(config: Partial<typeof this.autoScaling>): void {
    this.autoScaling = { ...this.autoScaling, ...config };
    logger.info('Auto scaling configuration updated:', this.autoScaling);
  }

  // === 헬퍼 메서드들 ===

  private async getActiveUsersCount(): Promise<number> {
    // 실제 구현시 세션 스토어나 데이터베이스에서 조회
    return Math.floor(Math.random() * 1000);
  }

  private async getOrdersPerMinute(): Promise<number> {
    // 실제 구현시 최근 1분간 주문 수 조회
    return Math.floor(Math.random() * 10);
  }

  private async getCurrentRevenue(): Promise<number> {
    // 실제 구현시 오늘 매출 조회
    return Math.floor(Math.random() * 1000000);
  }

  private async getConversionRate(): Promise<number> {
    // 실제 구현시 전환율 계산
    return Math.random() * 5;
  }
}

export const performanceMonitor = new PerformanceMonitor();