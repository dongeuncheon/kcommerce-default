# Commerce Core 설정 가이드

## 개요
Commerce Core는 단일 포트에서 프론트엔드와 백엔드 API가 모두 작동하는 통합 이커머스 플랫폼입니다.

## 구조
```
commerce-core/
├── src/                    # 백엔드 서버 코드
├── plugin/client/          # React 프론트엔드
├── dist/                   # 빌드된 서버 파일
└── scripts/                # 유틸리티 스크립트
```

## 개발 환경 설정

### 1. 의존성 설치
```bash
# 모든 의존성 설치 (서버 + 클라이언트)
npm run install:all
```

### 2. 개발 모드 실행

#### 옵션 A: 동시 실행 (권장)
```bash
npm run dev
```
이 명령어는 백엔드 서버(포트 3000)와 프론트엔드 개발 서버(포트 5173)를 동시에 실행합니다.

#### 옵션 B: 개별 실행
```bash
# 터미널 1: 백엔드 서버
npm run dev:api

# 터미널 2: 프론트엔드
npm run dev:client
```

### 3. 개발 환경 접속
- 프론트엔드: http://localhost:5173
- 백엔드 API: http://localhost:3000/api
- API 헬스체크: http://localhost:3000/api/health

## 프로덕션 배포

### 1. 빌드
```bash
# 서버와 클라이언트 모두 빌드
npm run build:all
```

### 2. 프로덕션 실행
```bash
# 단일 포트에서 모든 기능 실행
npm run start:prod
```

프로덕션 모드에서는 단일 포트(기본 3000)에서 모든 기능이 작동합니다:
- 프론트엔드: http://localhost:3000
- API: http://localhost:3000/api

## 환경 변수

`.env` 파일을 생성하여 다음 변수들을 설정할 수 있습니다:
```env
NODE_ENV=production
PORT=3000
CORS_ORIGIN=https://yourdomain.com
```

## API 엔드포인트

- `/api/health` - 헬스체크
- `/api/v1/products` - 상품 목록
- `/api/v1/categories` - 카테고리 목록
- `/api/v1/carts` - 장바구니
- `/api/v1/auth` - 인증

## 문제 해결

### 포트 충돌
서버가 자동으로 사용 가능한 포트를 찾습니다. 특정 포트를 강제하려면:
```bash
PORT=8080 npm start
```

### 빌드 오류
```bash
# 클린 빌드
rm -rf dist plugin/client/dist
npm run build:all
```

## 아키텍처 특징

1. **단일 포트 운영**: 프로덕션에서 하나의 포트로 모든 서비스 제공
2. **개발 환경 분리**: 개발시 프론트엔드와 백엔드 독립 실행
3. **자동 포트 감지**: 포트 충돌 시 자동으로 다른 포트 사용
4. **WebSocket 지원**: 실시간 기능을 위한 Socket.IO 통합