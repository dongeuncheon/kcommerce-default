#!/bin/bash

echo "🚀 간단한 Commerce Plugin 시작"
echo "============================="

# 색상 정의
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

# 모든 관련 프로세스 종료
echo -e "${BLUE}기존 프로세스 정리...${NC}"
pkill -f "node.*commerce" 2>/dev/null
pkill -f "vite" 2>/dev/null
pkill -f "tsx" 2>/dev/null
sleep 2

# 포트 강제 해제
lsof -ti:3000,5173,8080 | xargs kill -9 2>/dev/null || true
sleep 1

echo -e "${GREEN}백엔드 서버 시작 중...${NC}"
# 환경변수 설정하여 데이터베이스 연결 건너뛰기
export NODE_ENV=development
export PORT=3000
export SKIP_DB=true

# 백엔드 시작 (백그라운드)
npm run dev > backend.log 2>&1 &
BACKEND_PID=$!

# 백엔드 시작 대기
echo "백엔드 시작 대기 중..."
for i in {1..10}; do
  if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ 백엔드 준비 완료!${NC}"
    break
  fi
  echo "대기 중... ($i/10)"
  sleep 2
done

echo -e "${GREEN}프론트엔드 서버 시작 중...${NC}"
cd client
npm run dev > ../frontend.log 2>&1 &
FRONTEND_PID=$!

sleep 3

# 프론트엔드 포트 확인
FRONTEND_PORT=5173
if ! curl -s http://localhost:5173 > /dev/null 2>&1; then
  FRONTEND_PORT=5174
fi

echo ""
echo "================================"
echo -e "${GREEN}✅ 서버 시작 완료!${NC}"
echo ""
echo "📡 백엔드: http://localhost:3000"
echo "🌐 프론트엔드: http://localhost:$FRONTEND_PORT"
echo "📚 API 문서: http://localhost:3000/api-docs"
echo ""
echo "🔗 지금 바로 접속: http://localhost:$FRONTEND_PORT"
echo ""
echo "종료하려면 Ctrl+C를 누르세요"
echo "================================"

# 종료 시 프로세스 정리
trap 'echo -e "\n${BLUE}서버 종료 중...${NC}"; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit' INT

# 대기
wait