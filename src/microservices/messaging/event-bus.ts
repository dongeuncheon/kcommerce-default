import { EventEmitter } from 'events';
import Redis from 'ioredis';
import { logger } from '../../utils/logger';

export interface DomainEvent {
  id: string;
  type: string;
  aggregateId: string;
  aggregateType: string;
  version: number;
  data: any;
  metadata?: {
    userId?: string;
    correlationId?: string;
    causationId?: string;
    timestamp: Date;
  };
}

export interface EventHandler {
  eventType: string;
  handler: (event: DomainEvent) => Promise<void>;
  options?: {
    retry?: number;
    delay?: number;
    deadLetterQueue?: boolean;
  };
}

export interface MessagePattern {
  pattern: string;
  handler: (data: any) => Promise<any>;
}

export class EventBus extends EventEmitter {
  private redis: Redis;
  private subscribers: Map<string, EventHandler[]> = new Map();
  private messagePatterns: Map<string, MessagePattern> = new Map();
  private retryQueues: Map<string, DomainEvent[]> = new Map();
  private deadLetterQueue: DomainEvent[] = [];

  constructor(redisConfig?: any) {
    super();
    this.redis = new Redis(redisConfig || {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      retryDelayOnFailover: 100,
      enableReadyCheck: false,
      maxRetriesPerRequest: null
    });

    this.setupRedisListeners();
  }

  private setupRedisListeners(): void {
    this.redis.on('connect', () => {
      logger.info('Event bus connected to Redis');
    });

    this.redis.on('error', (error) => {
      logger.error('Event bus Redis error:', error);
    });

    // 이벤트 구독 처리
    this.redis.on('message', async (channel, message) => {
      try {
        const event: DomainEvent = JSON.parse(message);
        await this.handleEvent(event);
      } catch (error) {
        logger.error('Failed to handle Redis message:', error);
      }
    });
  }

  /**
   * 도메인 이벤트 발행
   */
  async publish(event: DomainEvent): Promise<void> {
    try {
      // 메타데이터 설정
      if (!event.metadata) {
        event.metadata = {
          timestamp: new Date()
        };
      }

      // 로컬 이벤트 처리
      this.emit(event.type, event);

      // Redis를 통한 분산 이벤트 발행
      await this.redis.publish(`events:${event.type}`, JSON.stringify(event));
      
      // 이벤트 저장 (이벤트 소싱용)
      await this.storeEvent(event);

      logger.debug(`Event published: ${event.type} (${event.id})`);
    } catch (error) {
      logger.error('Failed to publish event:', error);
      throw error;
    }
  }

  /**
   * 이벤트 구독
   */
  async subscribe(eventType: string, handler: EventHandler): Promise<void> {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, []);
      
      // Redis 채널 구독
      await this.redis.subscribe(`events:${eventType}`);
    }

    this.subscribers.get(eventType)!.push(handler);
    
    // 로컬 이벤트 리스너 등록
    this.on(eventType, async (event: DomainEvent) => {
      await this.executeHandler(handler, event);
    });

    logger.info(`Subscribed to event: ${eventType}`);
  }

  /**
   * 메시지 패턴 등록 (Request-Response)
   */
  registerMessagePattern(pattern: string, handler: MessagePattern): void {
    this.messagePatterns.set(pattern, handler);
    logger.info(`Message pattern registered: ${pattern}`);
  }

  /**
   * 메시지 전송 (Request-Response)
   */
  async sendMessage(pattern: string, data: any, timeout: number = 5000): Promise<any> {
    const correlationId = this.generateId();
    const responseChannel = `response:${correlationId}`;

    return new Promise(async (resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.redis.unsubscribe(responseChannel);
        reject(new Error(`Message timeout for pattern: ${pattern}`));
      }, timeout);

      // 응답 구독
      await this.redis.subscribe(responseChannel);
      
      this.redis.once('message', (channel, message) => {
        if (channel === responseChannel) {
          clearTimeout(timeoutHandle);
          this.redis.unsubscribe(responseChannel);
          
          try {
            const response = JSON.parse(message);
            if (response.error) {
              reject(new Error(response.error));
            } else {
              resolve(response.data);
            }
          } catch (error) {
            reject(error);
          }
        }
      });

      // 메시지 전송
      await this.redis.publish(`patterns:${pattern}`, JSON.stringify({
        correlationId,
        data,
        responseChannel
      }));
    });
  }

  /**
   * 이벤트 핸들러 실행
   */
  private async executeHandler(handler: EventHandler, event: DomainEvent): Promise<void> {
    const maxRetries = handler.options?.retry || 3;
    const delay = handler.options?.delay || 1000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await handler.handler(event);
        
        // 성공시 재시도 큐에서 제거
        this.removeFromRetryQueue(handler.eventType, event.id);
        return;
      } catch (error) {
        logger.warn(`Handler failed (attempt ${attempt}/${maxRetries}):`, error);
        
        if (attempt === maxRetries) {
          // 최대 재시도 후 실패
          await this.handleFailedEvent(handler, event, error);
        } else {
          // 재시도 대기
          await new Promise(resolve => setTimeout(resolve, delay * attempt));
        }
      }
    }
  }

  /**
   * 실패한 이벤트 처리
   */
  private async handleFailedEvent(handler: EventHandler, event: DomainEvent, error: any): Promise<void> {
    logger.error(`Event handler failed after retries: ${handler.eventType}`, error);

    if (handler.options?.deadLetterQueue) {
      // 데드 레터 큐에 추가
      this.deadLetterQueue.push({
        ...event,
        metadata: {
          ...event.metadata,
          error: error.message,
          failedAt: new Date()
        }
      });
    }

    // 실패 이벤트 발행
    await this.publish({
      id: this.generateId(),
      type: 'EventHandlerFailed',
      aggregateId: event.aggregateId,
      aggregateType: 'EventBus',
      version: 1,
      data: {
        originalEvent: event,
        handlerType: handler.eventType,
        error: error.message
      }
    });
  }

  /**
   * 이벤트 처리 (Redis 메시지)
   */
  private async handleEvent(event: DomainEvent): Promise<void> {
    const handlers = this.subscribers.get(event.type) || [];
    
    // 병렬로 모든 핸들러 실행
    const promises = handlers.map(handler => this.executeHandler(handler, event));
    
    try {
      await Promise.allSettled(promises);
    } catch (error) {
      logger.error('Event handling error:', error);
    }
  }

  /**
   * 이벤트 저장 (이벤트 소싱)
   */
  private async storeEvent(event: DomainEvent): Promise<void> {
    try {
      const eventKey = `event_store:${event.aggregateType}:${event.aggregateId}`;
      await this.redis.zadd(eventKey, event.version, JSON.stringify(event));
      
      // 글로벌 이벤트 로그
      await this.redis.lpush('event_log', JSON.stringify(event));
      await this.redis.ltrim('event_log', 0, 10000); // 최대 10,000개 유지
    } catch (error) {
      logger.error('Failed to store event:', error);
    }
  }

  /**
   * 이벤트 히스토리 조회
   */
  async getEventHistory(aggregateType: string, aggregateId: string, fromVersion?: number): Promise<DomainEvent[]> {
    try {
      const eventKey = `event_store:${aggregateType}:${aggregateId}`;
      const start = fromVersion || 0;
      const events = await this.redis.zrangebyscore(eventKey, start, '+inf');
      
      return events.map(eventStr => JSON.parse(eventStr));
    } catch (error) {
      logger.error('Failed to get event history:', error);
      return [];
    }
  }

  /**
   * 재시도 큐에서 이벤트 제거
   */
  private removeFromRetryQueue(eventType: string, eventId: string): void {
    const queue = this.retryQueues.get(eventType);
    if (queue) {
      const index = queue.findIndex(event => event.id === eventId);
      if (index !== -1) {
        queue.splice(index, 1);
      }
    }
  }

  /**
   * 데드 레터 큐 조회
   */
  getDeadLetterQueue(): DomainEvent[] {
    return [...this.deadLetterQueue];
  }

  /**
   * 데드 레터 큐 정리
   */
  clearDeadLetterQueue(): void {
    this.deadLetterQueue.length = 0;
  }

  /**
   * 재시도 큐의 이벤트 재처리
   */
  async reprocessFailedEvents(eventType?: string): Promise<void> {
    const queues = eventType 
      ? [eventType].filter(type => this.retryQueues.has(type))
      : Array.from(this.retryQueues.keys());

    for (const type of queues) {
      const events = this.retryQueues.get(type) || [];
      const handlers = this.subscribers.get(type) || [];

      for (const event of events) {
        for (const handler of handlers) {
          await this.executeHandler(handler, event);
        }
      }
    }
  }

  /**
   * 메트릭스 조회
   */
  getMetrics(): any {
    return {
      subscribers: this.subscribers.size,
      messagePatterns: this.messagePatterns.size,
      retryQueues: Array.from(this.retryQueues.entries()).map(([type, events]) => ({
        eventType: type,
        queueSize: events.length
      })),
      deadLetterQueueSize: this.deadLetterQueue.length
    };
  }

  /**
   * ID 생성
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 이벤트 버스 종료
   */
  async shutdown(): Promise<void> {
    await this.redis.disconnect();
    this.removeAllListeners();
    logger.info('Event bus shutdown completed');
  }
}

export const eventBus = new EventBus();