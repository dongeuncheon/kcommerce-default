# 개발 환경 실행 가이드

## 개발 서버 실행 방법

개발 중에는 백엔드와 프론트엔드를 별도로 실행합니다.

### 1. 백엔드 API 서버 실행

```bash
# commerce-core 디렉토리에서
npm run dev
```

백엔드 서버는 자동으로 사용 가능한 포트를 찾아서 실행됩니다.
(기본: 3000, 사용 중이면 3001, 3002... 순서로 찾음)

### 2. 프론트엔드 개발 서버 실행 (새 터미널에서)

```bash
# commerce-core/plugin/client 디렉토리에서
cd plugin/client
npm run dev
```

프론트엔드는 http://localhost:5173 에서 실행됩니다.

## 접속 정보

- **프론트엔드**: http://localhost:5173
- **백엔드 API**: http://localhost:3000/api (포트는 백엔드 서버 실행 시 확인)
- **API 헬스체크**: http://localhost:3000/api/health

## 주의사항

- 두 개의 터미널이 필요합니다 (백엔드용, 프론트엔드용)
- 프론트엔드의 API 요청은 Vite 프록시를 통해 백엔드로 전달됩니다
- 백엔드 포트가 변경되면 `plugin/client/vite.config.ts`의 프록시 설정을 업데이트해야 합니다

## 프로덕션 빌드

프로덕션에서는 통합 서버로 실행됩니다:

```bash
# 프론트엔드 빌드
cd plugin/client
npm run build

# 백엔드에서 통합 실행
cd ../..
npm run build
npm start
```