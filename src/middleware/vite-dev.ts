import { Express } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';

export async function setupViteDevServer(app: Express) {
  // Vite를 미들웨어로 통합
  const vite = await createViteServer({
    root: path.join(process.cwd(), 'client'),
    server: { 
      middlewareMode: true,
      hmr: {
        port: 3001 // HMR용 별도 포트
      }
    },
    appType: 'spa'
  });

  // Vite 미들웨어 사용
  app.use(vite.middlewares);

  // HTML 파일 처리
  app.use('*', async (req, res, next) => {
    // API 라우트는 스킵
    if (req.originalUrl.startsWith('/api') || 
        req.originalUrl.startsWith('/health') || 
        req.originalUrl.startsWith('/metrics') ||
        req.originalUrl.startsWith('/uploads')) {
      return next();
    }

    try {
      const url = req.originalUrl;
      
      // index.html 읽기
      let template = await vite.transformIndexHtml(
        url,
        `<!DOCTYPE html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Commerce Platform</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`
      );

      res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });

  return vite;
}