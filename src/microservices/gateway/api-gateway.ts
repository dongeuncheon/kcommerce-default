import express, { Request, Response, NextFunction } from 'express';
import { createProxyMiddleware, Options } from 'http-proxy-middleware';
import rateLimit from 'express-rate-limit';
import { serviceRegistry, ServiceInstance } from '../base/service-registry';
import { logger } from '../../utils/logger';
import { cacheService } from '../../services/cacheService';
import jwt from 'jsonwebtoken';

interface RouteConfig {
  path: string;
  serviceName: string;
  methods?: string[];
  rateLimit?: {
    windowMs: number;
    max: number;
  };
  auth?: boolean;
  cache?: {
    ttl: number;
    key?: string;
  };
  retry?: {
    attempts: number;
    delay: number;
  };
}

export class ApiGateway {
  private app: express.Application;
  private routes: Map<string, RouteConfig> = new Map();
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();

  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupDefaultRoutes();
  }

  private setupMiddleware(): void {
    // CORS 설정
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    });

    // 로깅 미들웨어
    this.app.use((req, res, next) => {
      logger.info(`Gateway: ${req.method} ${req.path} from ${req.ip}`);
      next();
    });

    // 글로벌 레이트 리미팅
    this.app.use(rateLimit({
      windowMs: 15 * 60 * 1000, // 15분
      max: 1000, // 요청 제한
      message: 'Too many requests from this IP'
    }));
  }

  /**
   * 라우트 등록
   */
  addRoute(config: RouteConfig): void {
    this.routes.set(config.path, config);

    // 서킷 브레이커 초기화
    if (!this.circuitBreakers.has(config.serviceName)) {
      this.circuitBreakers.set(config.serviceName, new CircuitBreaker({
        failureThreshold: 5,
        resetTimeout: 30000
      }));
    }

    // 라우트별 레이트 리미팅 설정
    if (config.rateLimit) {
      this.app.use(config.path, rateLimit({
        windowMs: config.rateLimit.windowMs,
        max: config.rateLimit.max,
        message: `Rate limit exceeded for ${config.path}`
      }));
    }

    // 인증 미들웨어
    if (config.auth) {
      this.app.use(config.path, this.authMiddleware);
    }

    // 캐시 미들웨어
    if (config.cache) {
      this.app.use(config.path, this.cacheMiddleware(config.cache));
    }

    // 프록시 미들웨어 설정
    const proxyOptions: Options = {
      target: '', // 동적으로 설정
      changeOrigin: true,
      pathRewrite: {
        [`^${config.path}`]: ''
      },
      router: async (req) => {
        return await this.getServiceTarget(config.serviceName);
      },
      onError: (err, req, res) => {
        logger.error(`Proxy error for ${config.serviceName}:`, err);
        if (!res.headersSent) {
          res.status(503).json({
            error: 'Service temporarily unavailable',
            serviceName: config.serviceName
          });
        }
      },
      onProxyReq: (proxyReq, req, res) => {
        // 요청 로깅
        logger.debug(`Proxying ${req.method} ${req.url} to ${config.serviceName}`);
        
        // 트레이싱 헤더 추가
        proxyReq.setHeader('X-Gateway-Request-ID', this.generateRequestId());
        proxyReq.setHeader('X-Gateway-Service', config.serviceName);
      },
      onProxyRes: (proxyRes, req, res) => {
        // 응답 로깅
        logger.debug(`Response from ${config.serviceName}: ${proxyRes.statusCode}`);
        
        // 캐시 헤더 추가
        if (config.cache && proxyRes.statusCode === 200) {
          proxyRes.headers['X-Cache-TTL'] = config.cache.ttl.toString();
        }
      }
    };

    // 서킷 브레이커와 재시도 로직 추가
    this.app.use(config.path, async (req, res, next) => {
      const circuitBreaker = this.circuitBreakers.get(config.serviceName);
      
      if (circuitBreaker && circuitBreaker.isOpen()) {
        return res.status(503).json({
          error: 'Service circuit breaker is open',
          serviceName: config.serviceName
        });
      }

      try {
        await this.executeWithRetry(req, res, next, config);
      } catch (error) {
        if (circuitBreaker) {
          circuitBreaker.recordFailure();
        }
        throw error;
      }
    });

    this.app.use(config.path, createProxyMiddleware(proxyOptions));

    logger.info(`Route registered: ${config.path} -> ${config.serviceName}`);
  }

  /**
   * 인증 미들웨어
   */
  private authMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        res.status(401).json({ error: 'Authentication token required' });
        return;
      }

      // JWT 토큰 검증
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
      (req as any).user = decoded;
      
      next();
    } catch (error) {
      res.status(401).json({ error: 'Invalid authentication token' });
    }
  };

  /**
   * 캐시 미들웨어
   */
  private cacheMiddleware = (cacheConfig: { ttl: number; key?: string }) => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      // GET 요청만 캐시
      if (req.method !== 'GET') {
        return next();
      }

      const cacheKey = cacheConfig.key || `gateway:${req.originalUrl}:${JSON.stringify(req.query)}`;
      
      try {
        const cached = await cacheService.get(cacheKey);
        if (cached) {
          res.setHeader('X-Cache', 'HIT');
          res.json(cached);
          return;
        }

        // 응답 캐싱을 위한 response 래핑
        const originalSend = res.send;
        res.send = function(body: any) {
          if (res.statusCode === 200) {
            cacheService.set(cacheKey, body, cacheConfig.ttl).catch(err => {
              logger.warn('Cache set failed:', err);
            });
          }
          res.setHeader('X-Cache', 'MISS');
          return originalSend.call(this, body);
        };

        next();
      } catch (error) {
        logger.warn('Cache middleware error:', error);
        next();
      }
    };
  };

  /**
   * 재시도 로직과 함께 요청 실행
   */
  private async executeWithRetry(
    req: Request, 
    res: Response, 
    next: NextFunction, 
    config: RouteConfig
  ): Promise<void> {
    const maxAttempts = config.retry?.attempts || 1;
    const delay = config.retry?.delay || 1000;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const service = await this.selectHealthyService(config.serviceName);
        if (!service) {
          throw new Error(`No healthy service instances for ${config.serviceName}`);
        }

        // 서킷 브레이커 성공 기록
        const circuitBreaker = this.circuitBreakers.get(config.serviceName);
        if (circuitBreaker) {
          circuitBreaker.recordSuccess();
        }

        next();
        return;
      } catch (error) {
        logger.warn(`Attempt ${attempt}/${maxAttempts} failed for ${config.serviceName}:`, error);
        
        if (attempt === maxAttempts) {
          res.status(503).json({
            error: 'Service unavailable after retries',
            serviceName: config.serviceName,
            attempts: maxAttempts
          });
          return;
        }

        // 지연 후 재시도
        await new Promise(resolve => setTimeout(resolve, delay * attempt));
      }
    }
  }

  /**
   * 서비스 타겟 URL 가져오기
   */
  private async getServiceTarget(serviceName: string): Promise<string> {
    const service = await this.selectHealthyService(serviceName);
    if (!service) {
      throw new Error(`No healthy service instances for ${serviceName}`);
    }
    
    return `${service.protocol}://${service.host}:${service.port}`;
  }

  /**
   * 건강한 서비스 인스턴스 선택
   */
  private async selectHealthyService(serviceName: string): Promise<ServiceInstance | null> {
    return serviceRegistry.selectService(serviceName, 'round-robin');
  }

  /**
   * 기본 라우트 설정
   */
  private setupDefaultRoutes(): void {
    // 헬스체크 엔드포인트
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: Array.from(this.routes.keys())
      });
    });

    // 서비스 디스커버리 엔드포인트
    this.app.get('/services', (req, res) => {
      const services = serviceRegistry.getAllServices();
      const serviceList: any = {};
      
      for (const [name, instances] of services.entries()) {
        serviceList[name] = instances.map(instance => ({
          id: instance.id,
          status: instance.status,
          host: instance.host,
          port: instance.port,
          lastHeartbeat: instance.lastHeartbeat
        }));
      }
      
      res.json(serviceList);
    });

    // 메트릭스 엔드포인트
    this.app.get('/metrics', (req, res) => {
      const metrics = {
        totalRoutes: this.routes.size,
        circuitBreakers: Array.from(this.circuitBreakers.entries()).map(([name, cb]) => ({
          service: name,
          state: cb.getState(),
          failures: cb.getFailureCount()
        }))
      };
      
      res.json(metrics);
    });
  }

  /**
   * 요청 ID 생성
   */
  private generateRequestId(): string {
    return `gw-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 게이트웨이 시작
   */
  start(port: number = 8080): void {
    this.app.listen(port, () => {
      logger.info(`API Gateway started on port ${port}`);
    });
  }

  /**
   * Express 앱 반환 (테스트용)
   */
  getApp(): express.Application {
    return this.app;
  }
}

/**
 * 서킷 브레이커 클래스
 */
class CircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failures: number = 0;
  private lastFailureTime: number = 0;
  private readonly failureThreshold: number;
  private readonly resetTimeout: number;

  constructor(options: { failureThreshold: number; resetTimeout: number }) {
    this.failureThreshold = options.failureThreshold;
    this.resetTimeout = options.resetTimeout;
  }

  isOpen(): boolean {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime >= this.resetTimeout) {
        this.state = 'HALF_OPEN';
        return false;
      }
      return true;
    }
    return false;
  }

  recordSuccess(): void {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  recordFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }

  getState(): string {
    return this.state;
  }

  getFailureCount(): number {
    return this.failures;
  }
}

export const apiGateway = new ApiGateway();