import express from 'express';
import path from 'path';

export function setupStaticFiles(app: express.Application) {
  // 프로덕션 환경에서 빌드된 React 앱 서빙
  const clientBuildPath = path.join(process.cwd(), 'client/dist');
  app.use(express.static(clientBuildPath));

  // 모든 라우트를 React 앱으로 리다이렉트 (SPA 지원)
  app.get('*', (req, res, next) => {
    // API 라우트는 제외
    if (req.path.startsWith('/api') || 
        req.path.startsWith('/health') || 
        req.path.startsWith('/metrics') ||
        req.path.startsWith('/uploads') ||
        req.path.startsWith('/socket.io')) {
      return next();
    }
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  });
}