# 🚀 통합 서버 가이드 (Unified Server Guide)

이 프로젝트는 **Next.js 스타일의 통합 서버**로 구성되어, 하나의 서버에서 프론트엔드와 백엔드를 모두 처리합니다.

## 📁 프로젝트 구조

```
commerce-plugin/
├── src/                    # 백엔드 소스 코드
│   ├── api/               # API 엔드포인트
│   ├── services/          # 비즈니스 로직
│   └── index.ts           # 서버 진입점
├── client/                 # 프론트엔드 (React + Vite)
│   ├── src/               # React 컴포넌트
│   └── dist/              # 빌드된 정적 파일 (프로덕션)
└── dist/                   # 백엔드 빌드 결과
```

## 🛠️ 설치 방법

### 1. 전체 의존성 설치
```bash
cd /Users/default/Desktop/이커머스/commerce-plugin
npm run install:all
```

### 2. 환경 변수 설정
```bash
cp .env.example .env
# .env 파일을 열어 필요한 설정값 입력
```

## 🏃‍♂️ 실행 방법

### 개발 모드
```bash
npm run dev
```
- **서버**: http://localhost:3000
- **프론트엔드**: http://localhost:5173 (Vite 개발 서버)
- API 요청은 자동으로 프록시됩니다

### 프로덕션 모드
```bash
# 빌드
npm run build

# 실행
npm start
```
- **통합 서버**: http://localhost:3000
- 모든 요청이 하나의 서버에서 처리됩니다

### 프리뷰 모드 (빌드 후 테스트)
```bash
npm run preview
```

## 🔧 작동 원리

### 개발 환경
1. Express 서버가 3000 포트에서 API 요청 처리
2. Vite 개발 서버가 5173 포트에서 프론트엔드 처리
3. API 요청은 Vite 프록시를 통해 Express로 전달

### 프로덕션 환경
1. React 앱이 빌드되어 `client/dist`에 저장
2. Express 서버가 정적 파일 서빙 + API 처리
3. 모든 라우트가 하나의 서버(3000 포트)에서 처리

## 📡 API 엔드포인트

모든 API는 `/api` 프리픽스를 사용합니다:
- `/api/v1/products` - 상품 API
- `/api/v1/orders` - 주문 API
- `/api/v1/auth` - 인증 API
- `/health` - 헬스체크
- `/metrics` - 메트릭스

## 🌐 프론트엔드 라우팅

SPA(Single Page Application) 방식으로 작동:
- `/` - 홈페이지
- `/products` - 상품 목록
- `/cart` - 장바구니
- `/admin/*` - 관리자 페이지

## 🔍 디버깅

### 서버 로그 확인
```bash
# 개발 모드에서는 콘솔에 직접 출력
# 프로덕션에서는 로그 파일 확인
tail -f logs/app.log
```

### 포트 충돌 해결
```bash
# 3000 포트 사용 중인 프로세스 확인
lsof -i :3000

# 프로세스 종료
kill -9 [PID]
```

## 🐳 Docker 실행

```bash
# 개발 환경
docker-compose -f docker-compose.dev.yml up

# 프로덕션 환경
docker-compose -f docker-compose.production.yml up -d
```

## 🚨 주의사항

1. **환경 변수**: 프로덕션 환경에서는 반드시 `NODE_ENV=production` 설정
2. **빌드 순서**: 프론트엔드를 먼저 빌드한 후 백엔드를 빌드해야 함
3. **정적 파일**: `uploads/` 폴더는 파일 업로드용으로 예약됨
4. **API 프록시**: 개발 시 모든 `/api` 요청은 자동으로 백엔드로 프록시됨

## 📚 추가 명령어

```bash
# 타입 체크
npm run type-check

# 린트
npm run lint

# 테스트
npm run test

# 데이터베이스 마이그레이션
npm run db:migrate

# 데이터베이스 시드
npm run db:seed
```

## 🆘 문제 해결

### "Cannot find module" 오류
```bash
npm run build:server
```

### 프론트엔드가 보이지 않음
```bash
npm run build:client
```

### 데이터베이스 연결 오류
```bash
# PostgreSQL이 실행 중인지 확인
docker-compose up -d postgres
```

이제 **하나의 명령어로 전체 애플리케이션을 실행**할 수 있습니다! 🎉