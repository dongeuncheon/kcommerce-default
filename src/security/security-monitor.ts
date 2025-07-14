import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { cacheService } from '../services/cacheService';
import { PrismaClient } from '@prisma/client';

export interface SecurityEvent {
  id: string;
  type: SecurityEventType;
  severity: SecuritySeverity;
  source: string;
  userId?: string;
  sessionId?: string;
  ip: string;
  userAgent?: string;
  timestamp: Date;
  data: any;
  fingerprint?: string;
}

export enum SecurityEventType {
  // 인증 관련
  LOGIN_FAILURE = 'login_failure',
  LOGIN_SUCCESS = 'login_success',
  BRUTE_FORCE_ATTEMPT = 'brute_force_attempt',
  ACCOUNT_LOCKOUT = 'account_lockout',
  PASSWORD_RESET_REQUEST = 'password_reset_request',
  
  // 권한 관련
  UNAUTHORIZED_ACCESS = 'unauthorized_access',
  PRIVILEGE_ESCALATION = 'privilege_escalation',
  ADMIN_ACCESS = 'admin_access',
  
  // 애플리케이션 보안
  SQL_INJECTION_ATTEMPT = 'sql_injection_attempt',
  XSS_ATTEMPT = 'xss_attempt',
  CSRF_ATTEMPT = 'csrf_attempt',
  SUSPICIOUS_PAYLOAD = 'suspicious_payload',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  
  // 사기 관련
  FRAUD_DETECTED = 'fraud_detected',
  SUSPICIOUS_TRANSACTION = 'suspicious_transaction',
  PAYMENT_FRAUD = 'payment_fraud',
  
  // 시스템 보안
  UNUSUAL_API_USAGE = 'unusual_api_usage',
  DATA_EXFILTRATION = 'data_exfiltration',
  SUSPICIOUS_FILE_ACCESS = 'suspicious_file_access',
  
  // 네트워크 보안
  DDoS_ATTEMPT = 'ddos_attempt',
  BOT_DETECTION = 'bot_detection',
  TOR_ACCESS = 'tor_access',
  VPN_ACCESS = 'vpn_access'
}

export enum SecuritySeverity {
  INFO = 'info',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface SecurityRule {
  id: string;
  name: string;
  type: SecurityEventType;
  condition: (event: SecurityEvent) => boolean;
  action: SecurityAction;
  threshold?: {
    count: number;
    timeWindow: number; // milliseconds
  };
  isActive: boolean;
}

export interface SecurityAction {
  type: 'block' | 'alert' | 'log' | 'throttle' | 'captcha';
  duration?: number; // for block/throttle
  message?: string;
  notifyAdmin?: boolean;
  escalate?: boolean;
}

export class SecurityMonitor extends EventEmitter {
  private prisma: PrismaClient;
  private rules: Map<string, SecurityRule> = new Map();
  private eventQueue: SecurityEvent[] = [];
  private processing = false;
  
  // 통계 및 메트릭스
  private stats = {
    totalEvents: 0,
    eventsByType: new Map<SecurityEventType, number>(),
    eventsBySeverity: new Map<SecuritySeverity, number>(),
    blockedIPs: new Set<string>(),
    suspiciousUsers: new Set<string>()
  };

  constructor() {
    super();
    this.prisma = new PrismaClient();
    this.initializeDefaultRules();
    this.startEventProcessor();
  }

  /**
   * 보안 이벤트 기록
   */
  async recordEvent(event: Omit<SecurityEvent, 'id' | 'timestamp' | 'fingerprint'>): Promise<void> {
    const securityEvent: SecurityEvent = {
      ...event,
      id: this.generateEventId(),
      timestamp: new Date(),
      fingerprint: this.generateFingerprint(event)
    };

    // 이벤트 큐에 추가
    this.eventQueue.push(securityEvent);
    
    // 통계 업데이트
    this.updateStats(securityEvent);

    // 이벤트 발행
    this.emit('securityEvent', securityEvent);

    logger.info(`Security event recorded: ${securityEvent.type} from ${securityEvent.ip}`);
  }

  /**
   * 보안 규칙 추가
   */
  addRule(rule: SecurityRule): void {
    this.rules.set(rule.id, rule);
    logger.info(`Security rule added: ${rule.name}`);
  }

  /**
   * 보안 규칙 제거
   */
  removeRule(ruleId: string): boolean {
    const removed = this.rules.delete(ruleId);
    if (removed) {
      logger.info(`Security rule removed: ${ruleId}`);
    }
    return removed;
  }

  /**
   * IP 차단
   */
  async blockIP(ip: string, duration: number = 3600000, reason: string = 'Security violation'): Promise<void> {
    const blockKey = `security:blocked_ip:${ip}`;
    const blockData = {
      ip,
      reason,
      blockedAt: new Date(),
      expiresAt: new Date(Date.now() + duration)
    };

    await cacheService.set(blockKey, blockData, Math.floor(duration / 1000));
    this.stats.blockedIPs.add(ip);

    logger.warn(`IP blocked: ${ip} for ${duration}ms - ${reason}`);

    await this.recordEvent({
      type: SecurityEventType.UNAUTHORIZED_ACCESS,
      severity: SecuritySeverity.HIGH,
      source: 'security_monitor',
      ip,
      data: { action: 'ip_blocked', reason, duration }
    });
  }

  /**
   * 사용자 계정 일시 정지
   */
  async suspendUser(userId: string, duration: number = 3600000, reason: string = 'Security violation'): Promise<void> {
    const suspensionKey = `security:suspended_user:${userId}`;
    const suspensionData = {
      userId,
      reason,
      suspendedAt: new Date(),
      expiresAt: new Date(Date.now() + duration)
    };

    await cacheService.set(suspensionKey, suspensionData, Math.floor(duration / 1000));
    this.stats.suspiciousUsers.add(userId);

    logger.warn(`User suspended: ${userId} for ${duration}ms - ${reason}`);

    await this.recordEvent({
      type: SecurityEventType.ACCOUNT_LOCKOUT,
      severity: SecuritySeverity.HIGH,
      source: 'security_monitor',
      userId,
      ip: 'system',
      data: { action: 'user_suspended', reason, duration }
    });
  }

  /**
   * IP 차단 상태 확인
   */
  async isIPBlocked(ip: string): Promise<boolean> {
    const blockKey = `security:blocked_ip:${ip}`;
    const blockData = await cacheService.get(blockKey);
    return !!blockData;
  }

  /**
   * 사용자 정지 상태 확인
   */
  async isUserSuspended(userId: string): Promise<boolean> {
    const suspensionKey = `security:suspended_user:${userId}`;
    const suspensionData = await cacheService.get(suspensionKey);
    return !!suspensionData;
  }

  /**
   * 브루트 포스 공격 탐지
   */
  async detectBruteForce(ip: string, userId?: string): Promise<boolean> {
    const timeWindow = 15 * 60 * 1000; // 15분
    const threshold = 5; // 15분 내 5회 실패

    const key = userId ? `brute_force:user:${userId}` : `brute_force:ip:${ip}`;
    
    try {
      const attempts = await cacheService.get(key) || 0;
      const newAttempts = attempts + 1;
      
      await cacheService.set(key, newAttempts, Math.floor(timeWindow / 1000));
      
      if (newAttempts >= threshold) {
        await this.recordEvent({
          type: SecurityEventType.BRUTE_FORCE_ATTEMPT,
          severity: SecuritySeverity.HIGH,
          source: 'brute_force_detector',
          userId,
          ip,
          data: { attempts: newAttempts, threshold }
        });
        
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error('Brute force detection failed:', error);
      return false;
    }
  }

  /**
   * DDoS 공격 탐지
   */
  async detectDDoS(ip: string): Promise<boolean> {
    const timeWindow = 60 * 1000; // 1분
    const threshold = 100; // 1분 내 100회 요청

    const key = `ddos:${ip}`;
    
    try {
      const requests = await cacheService.get(key) || 0;
      const newRequests = requests + 1;
      
      await cacheService.set(key, newRequests, Math.floor(timeWindow / 1000));
      
      if (newRequests >= threshold) {
        await this.recordEvent({
          type: SecurityEventType.DDoS_ATTEMPT,
          severity: SecuritySeverity.CRITICAL,
          source: 'ddos_detector',
          ip,
          data: { requests: newRequests, threshold }
        });
        
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error('DDoS detection failed:', error);
      return false;
    }
  }

  /**
   * SQL 인젝션 탐지
   */
  detectSQLInjection(input: string, ip: string, userId?: string): boolean {
    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/i,
      /(\b(OR|AND)\s+\d+\s*=\s*\d+)/i,
      /([\'\"])\s*(OR|AND)\s+\1\s*=\s*\1/i,
      /(\bUNION\s+SELECT\b)/i,
      /(\b(CONCAT|SUBSTRING|ASCII|CHAR)\s*\()/i
    ];

    const detected = sqlPatterns.some(pattern => pattern.test(input));
    
    if (detected) {
      this.recordEvent({
        type: SecurityEventType.SQL_INJECTION_ATTEMPT,
        severity: SecuritySeverity.HIGH,
        source: 'sql_injection_detector',
        userId,
        ip,
        data: { input: input.substring(0, 200), patterns: 'SQL injection patterns' }
      });
    }
    
    return detected;
  }

  /**
   * XSS 탐지
   */
  detectXSS(input: string, ip: string, userId?: string): boolean {
    const xssPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe[^>]*>.*?<\/iframe>/gi,
      /<object[^>]*>.*?<\/object>/gi,
      /eval\s*\(/gi,
      /expression\s*\(/gi
    ];

    const detected = xssPatterns.some(pattern => pattern.test(input));
    
    if (detected) {
      this.recordEvent({
        type: SecurityEventType.XSS_ATTEMPT,
        severity: SecuritySeverity.HIGH,
        source: 'xss_detector',
        userId,
        ip,
        data: { input: input.substring(0, 200), patterns: 'XSS patterns' }
      });
    }
    
    return detected;
  }

  /**
   * 기본 보안 규칙 초기화
   */
  private initializeDefaultRules(): void {
    // 브루트 포스 차단 규칙
    this.addRule({
      id: 'brute_force_block',
      name: 'Brute Force IP Block',
      type: SecurityEventType.BRUTE_FORCE_ATTEMPT,
      condition: (event) => event.severity === SecuritySeverity.HIGH,
      action: {
        type: 'block',
        duration: 3600000, // 1시간
        message: 'IP blocked due to brute force attempts',
        notifyAdmin: true
      },
      isActive: true
    });

    // DDoS 차단 규칙
    this.addRule({
      id: 'ddos_block',
      name: 'DDoS IP Block',
      type: SecurityEventType.DDoS_ATTEMPT,
      condition: (event) => event.severity === SecuritySeverity.CRITICAL,
      action: {
        type: 'block',
        duration: 7200000, // 2시간
        message: 'IP blocked due to DDoS attempts',
        notifyAdmin: true,
        escalate: true
      },
      isActive: true
    });

    // SQL 인젝션 차단 규칙
    this.addRule({
      id: 'sql_injection_block',
      name: 'SQL Injection Block',
      type: SecurityEventType.SQL_INJECTION_ATTEMPT,
      condition: (event) => event.severity === SecuritySeverity.HIGH,
      action: {
        type: 'block',
        duration: 1800000, // 30분
        message: 'Access blocked due to SQL injection attempt',
        notifyAdmin: true
      },
      isActive: true
    });

    // 사기 탐지 알림 규칙
    this.addRule({
      id: 'fraud_alert',
      name: 'Fraud Detection Alert',
      type: SecurityEventType.FRAUD_DETECTED,
      condition: (event) => event.severity === SecuritySeverity.HIGH || event.severity === SecuritySeverity.CRITICAL,
      action: {
        type: 'alert',
        message: 'High-risk fraud detected',
        notifyAdmin: true,
        escalate: true
      },
      isActive: true
    });
  }

  /**
   * 이벤트 프로세서 시작
   */
  private startEventProcessor(): void {
    setInterval(async () => {
      if (this.processing || this.eventQueue.length === 0) return;
      
      this.processing = true;
      
      try {
        const events = this.eventQueue.splice(0, 100); // 한 번에 100개씩 처리
        await this.processEvents(events);
      } catch (error) {
        logger.error('Event processing failed:', error);
      } finally {
        this.processing = false;
      }
    }, 1000);
  }

  /**
   * 이벤트 배치 처리
   */
  private async processEvents(events: SecurityEvent[]): Promise<void> {
    for (const event of events) {
      await this.processEvent(event);
    }
  }

  /**
   * 개별 이벤트 처리
   */
  private async processEvent(event: SecurityEvent): Promise<void> {
    try {
      // 데이터베이스에 이벤트 저장
      await this.storeEvent(event);
      
      // 활성 규칙 확인 및 적용
      for (const rule of this.rules.values()) {
        if (rule.isActive && rule.type === event.type && rule.condition(event)) {
          await this.executeRule(rule, event);
        }
      }
      
      // 임계값 기반 규칙 확인
      await this.checkThresholdRules(event);
      
    } catch (error) {
      logger.error('Event processing error:', error);
    }
  }

  /**
   * 보안 규칙 실행
   */
  private async executeRule(rule: SecurityRule, event: SecurityEvent): Promise<void> {
    try {
      switch (rule.action.type) {
        case 'block':
          if (event.ip !== 'system') {
            await this.blockIP(event.ip, rule.action.duration, rule.action.message);
          }
          break;
          
        case 'alert':
          await this.sendAlert(rule, event);
          break;
          
        case 'throttle':
          await this.throttleRequest(event.ip, rule.action.duration);
          break;
      }
      
      if (rule.action.notifyAdmin) {
        await this.notifyAdmin(rule, event);
      }
      
      if (rule.action.escalate) {
        await this.escalateIncident(rule, event);
      }
      
    } catch (error) {
      logger.error('Rule execution failed:', error);
    }
  }

  /**
   * 임계값 규칙 확인
   */
  private async checkThresholdRules(event: SecurityEvent): Promise<void> {
    for (const rule of this.rules.values()) {
      if (!rule.threshold || !rule.isActive) continue;
      
      const key = `threshold:${rule.id}:${event.fingerprint}`;
      const count = await cacheService.get(key) || 0;
      const newCount = count + 1;
      
      await cacheService.set(key, newCount, Math.floor(rule.threshold.timeWindow / 1000));
      
      if (newCount >= rule.threshold.count) {
        await this.executeRule(rule, event);
      }
    }
  }

  /**
   * 이벤트 저장
   */
  private async storeEvent(event: SecurityEvent): Promise<void> {
    try {
      // 실제 구현시 Prisma를 사용하여 데이터베이스에 저장
      // await this.prisma.securityEvent.create({ data: event });
      
      // 로그에도 기록
      logger.info(`Security event stored: ${event.id}`);
    } catch (error) {
      logger.error('Failed to store security event:', error);
    }
  }

  /**
   * 알림 전송
   */
  private async sendAlert(rule: SecurityRule, event: SecurityEvent): Promise<void> {
    // 실제 구현시 이메일, 슬랙 등으로 알림 전송
    logger.warn(`SECURITY ALERT: ${rule.name} - ${JSON.stringify(event)}`);
  }

  /**
   * 관리자 알림
   */
  private async notifyAdmin(rule: SecurityRule, event: SecurityEvent): Promise<void> {
    // 실제 구현시 관리자에게 즉시 알림
    logger.error(`ADMIN NOTIFICATION: ${rule.name} triggered for event ${event.id}`);
  }

  /**
   * 인시던트 에스컬레이션
   */
  private async escalateIncident(rule: SecurityRule, event: SecurityEvent): Promise<void> {
    // 실제 구현시 보안팀이나 상급자에게 에스컬레이션
    logger.error(`INCIDENT ESCALATION: ${rule.name} - Critical security event detected`);
  }

  /**
   * 요청 스로틀링
   */
  private async throttleRequest(ip: string, duration?: number): Promise<void> {
    const throttleKey = `throttle:${ip}`;
    const throttleDuration = duration || 60000; // 기본 1분
    
    await cacheService.set(throttleKey, true, Math.floor(throttleDuration / 1000));
  }

  /**
   * 통계 업데이트
   */
  private updateStats(event: SecurityEvent): void {
    this.stats.totalEvents++;
    this.stats.eventsByType.set(event.type, (this.stats.eventsByType.get(event.type) || 0) + 1);
    this.stats.eventsBySeverity.set(event.severity, (this.stats.eventsBySeverity.get(event.severity) || 0) + 1);
  }

  /**
   * 보안 통계 조회
   */
  getStats(): any {
    return {
      totalEvents: this.stats.totalEvents,
      eventsByType: Object.fromEntries(this.stats.eventsByType),
      eventsBySeverity: Object.fromEntries(this.stats.eventsBySeverity),
      blockedIPsCount: this.stats.blockedIPs.size,
      suspiciousUsersCount: this.stats.suspiciousUsers.size,
      activeRules: this.rules.size
    };
  }

  /**
   * 이벤트 ID 생성
   */
  private generateEventId(): string {
    return `sec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 이벤트 지문 생성
   */
  private generateFingerprint(event: any): string {
    const hash = require('crypto').createHash('md5');
    hash.update(`${event.type}:${event.ip}:${event.userId || 'anonymous'}`);
    return hash.digest('hex');
  }

  /**
   * 보안 모니터 종료
   */
  async shutdown(): Promise<void> {
    // 남은 이벤트 처리
    if (this.eventQueue.length > 0) {
      await this.processEvents(this.eventQueue);
    }
    
    this.removeAllListeners();
    logger.info('Security monitor shutdown completed');
  }
}

export const securityMonitor = new SecurityMonitor();