import * as net from 'net';

/**
 * 사용 가능한 포트를 자동으로 찾아주는 유틸리티
 */
export async function findAvailablePort(startPort: number = 3000, maxAttempts: number = 100): Promise<number> {
  for (let port = startPort; port < startPort + maxAttempts; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`사용 가능한 포트를 찾을 수 없습니다. (${startPort} - ${startPort + maxAttempts})`);
}

/**
 * 특정 포트가 사용 가능한지 확인
 */
function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    
    server.once('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        resolve(false);
      } else {
        resolve(false);
      }
    });
    
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    
    server.listen(port);
  });
}

/**
 * 환경변수 또는 기본값으로부터 포트를 가져오고, 사용 불가능한 경우 자동으로 다른 포트 찾기
 */
export async function getPort(preferredPort?: number): Promise<number> {
  const envPort = process.env.PORT ? parseInt(process.env.PORT, 10) : undefined;
  const startPort = preferredPort || envPort || 3000;
  
  // 먼저 선호하는 포트가 사용 가능한지 확인
  if (await isPortAvailable(startPort)) {
    return startPort;
  }
  
  console.log(`포트 ${startPort}가 사용 중입니다. 다른 포트를 찾는 중...`);
  
  // 사용 가능한 포트 찾기
  const availablePort = await findAvailablePort(startPort + 1);
  console.log(`사용 가능한 포트를 찾았습니다: ${availablePort}`);
  
  return availablePort;
}