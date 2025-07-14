import { Express } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';

export async function setupViteDevServer(app: Express) {
  // Vite를 미들웨어로 통합 - plugin의 client 폴더 사용
  const vite = await createViteServer({
    root: path.join(process.cwd(), 'plugin/client'),
    server: { 
      middlewareMode: true
    },
    appType: 'spa'
  });

  // Vite 미들웨어 사용 (이것이 모든 정적 자산과 HMR을 처리)
  app.use(vite.middlewares);

  return vite;
}