import 'reflect-metadata';
import express from 'express';
import { config } from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { getPort } from './utils/port-finder';
import path from 'path';

// Load environment variables
config();

// Plugin Integration Setup
const PLUGIN_ENABLED = process.env.PLUGIN_ENABLED !== 'false';
let pluginApp: express.Application | null = null;

// Dynamic Plugin Import
async function loadPlugin() {
  if (!PLUGIN_ENABLED) return null;
  
  try {
    // Plugin 폴더의 Express 앱을 동적으로 로드
    const pluginIndexPath = path.resolve(__dirname, '../plugin/src/index.ts');
    const { default: plugin } = await import(pluginIndexPath);
    console.log('✅ Plugin loaded successfully');
    return plugin;
  } catch (error) {
    console.warn('⚠️ Plugin load failed, running without plugin:', error.message);
    return null;
  }
}

const app = express();
const server = createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // React 앱을 위해 비활성화
}));

// Compression
app.use(compression());

// CORS
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? process.env.CORS_ORIGIN : '*',
  credentials: true
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Static files
app.use('/uploads', express.static('uploads'));

// API Routes
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0'
  });
});

app.get('/api', (req, res) => {
  res.json({
    message: 'Commerce Core API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      products: '/api/v1/products',
      categories: '/api/v1/categories',
      cart: '/api/v1/carts',
      orders: '/api/v1/orders',
      customers: '/api/v1/customers',
      auth: '/api/v1/auth'
    }
  });
});

// Products API
app.get('/api/v1/products', (req, res) => {
  res.json({
    data: {
      products: [
        {
          id: '1',
          name: '갤럭시 S24 Ultra',
          price: 1299000,
          originalPrice: 1599000,
          currency: 'KRW',
          description: '최신 AI 기능이 탑재된 프리미엄 스마트폰',
          image: 'https://via.placeholder.com/400',
          stock: 50,
          category: 'electronics',
          rating: 4.8,
          reviewCount: 128
        },
        {
          id: '2',
          name: 'LG 그램 17인치',
          price: 1890000,
          originalPrice: 2290000,
          currency: 'KRW',
          description: '초경량 대화면 노트북',
          image: 'https://via.placeholder.com/400',
          stock: 30,
          category: 'electronics',
          rating: 4.6,
          reviewCount: 89
        },
        {
          id: '3',
          name: '삼성 비스포크 냉장고',
          price: 2590000,
          originalPrice: 3190000,
          currency: 'KRW',
          description: '맞춤형 디자인 냉장고',
          image: 'https://via.placeholder.com/400',
          stock: 15,
          category: 'appliances',
          rating: 4.9,
          reviewCount: 256
        }
      ],
      total: 3,
      page: 1,
      limit: 20
    }
  });
});

// Categories API
app.get('/api/v1/categories', (req, res) => {
  res.json({
    data: {
      categories: [
        { id: '1', name: '전자제품', slug: 'electronics', count: 150 },
        { id: '2', name: '가전제품', slug: 'appliances', count: 85 },
        { id: '3', name: '패션', slug: 'fashion', count: 320 },
        { id: '4', name: '뷰티', slug: 'beauty', count: 210 },
        { id: '5', name: '식품', slug: 'food', count: 180 }
      ]
    }
  });
});

// Cart API
app.get('/api/v1/carts/current', (req, res) => {
  res.json({
    data: {
      id: 'guest-cart-123',
      items: [],
      subtotal: 0,
      tax: 0,
      shipping: 0,
      total: 0,
      currency: 'KRW'
    }
  });
});

// Auth API
app.post('/api/v1/auth/login', (req, res) => {
  res.json({
    data: {
      token: 'dummy-jwt-token',
      user: {
        id: '1',
        name: '테스트 사용자',
        email: 'test@example.com'
      }
    }
  });
});

// WebSocket 연결 처리
io.on('connection', (socket) => {
  console.log('새로운 WebSocket 연결:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('WebSocket 연결 해제:', socket.id);
  });
  
  socket.on('join-room', (room) => {
    socket.join(room);
    console.log(`Socket ${socket.id} joined room ${room}`);
  });
});

// 프로덕션/개발 환경에 관계없이 정적 파일 서빙
function setupStaticFiles() {
  const clientBuildPath = path.resolve(__dirname, '../plugin/client/dist');
  
  // 정적 파일 서빙
  app.use(express.static(clientBuildPath));
  
  // SPA 라우팅을 위한 fallback
  app.get('*', (req, res, next) => {
    // API 라우트는 제외
    if (req.path.startsWith('/api') || 
        req.path.startsWith('/socket.io') ||
        req.path.startsWith('/uploads')) {
      return next();
    }
    
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  });
}

// Start server
async function startServer() {
  try {
    const PORT = await getPort();

    // 개발 환경에서도 Vite 없이 빌드된 파일 사용
    if (process.env.NODE_ENV !== 'production') {
      try {
        const vite = require('vite');
        
        // Vite 서버를 미들웨어 모드로 생성
        const viteServer = await vite.createServer({
          root: path.resolve(__dirname, '../plugin/client'),
          server: { 
            middlewareMode: true,
            hmr: {
              port: PORT + 1  // HMR은 메인 포트 + 1 사용
            }
          },
          appType: 'spa'
        });
        
        // Vite 미들웨어 사용
        app.use(viteServer.middlewares);
        
        // SPA를 위한 HTML 서빙
        app.get('*', async (req, res, next) => {
          // API 라우트는 제외
          if (req.path.startsWith('/api') || 
              req.path.startsWith('/socket.io') ||
              req.path.startsWith('/uploads')) {
            return next();
          }
          
          try {
            const html = await viteServer.transformIndexHtml(req.url, `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="Commerce - Your trusted online shopping destination" />
    <meta name="csrf-token" content="" />
    
    <!-- Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    
    <title>Commerce - Online Shopping</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
            `);
            res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
          } catch (e) {
            next(e);
          }
        });
        
        console.log('✅ Vite 개발 서버가 통합되었습니다.');
      } catch (error) {
        console.error('❌ Vite 설정 실패:', error);
        console.log('🔄 빌드된 파일로 서빙합니다.');
        setupStaticFiles();
      }
    } else {
      setupStaticFiles();
    }

    // 404 에러 핸들러 (API 라우트만)
    app.use('/api/*', (req, res) => {
      res.status(404).json({
        error: 'Not Found',
        message: `API Route ${req.originalUrl} not found`,
        timestamp: new Date().toISOString()
      });
    });

    // 전역 에러 핸들러
    app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      console.error('Server Error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    });
    
    server.listen(PORT, () => {
      console.log(`
🚀 Commerce Core Server Started!
📍 Environment: ${process.env.NODE_ENV || 'development'}
🌐 Server: http://localhost:${PORT}
📚 API: http://localhost:${PORT}/api
🏥 Health: http://localhost:${PORT}/api/health
🔌 WebSocket: ws://localhost:${PORT}
🎨 Frontend: http://localhost:${PORT}

✨ 단일 포트에서 모든 기능이 실행됩니다!
      `);
    });
  } catch (error) {
    console.error('서버 시작 실패:', error);
    process.exit(1);
  }
}

startServer();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM 신호를 받았습니다. 서버를 종료합니다...');
  server.close(() => {
    console.log('서버가 종료되었습니다.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT 신호를 받았습니다. 서버를 종료합니다...');
  server.close(() => {
    console.log('서버가 종료되었습니다.');
    process.exit(0);
  });
});

export default app;