#!/bin/bash

echo "🚀 Commerce Plugin 시작 스크립트"
echo "================================"

# 색상 정의
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 포트 설정 (고정)
BACKEND_PORT=3000
FRONTEND_PORT=5173

# 기존 프로세스 종료
echo -e "${BLUE}기존 프로세스 정리 중...${NC}"
pkill -f "node.*commerce-plugin" 2>/dev/null
pkill -f "vite" 2>/dev/null
sleep 2

# 백엔드 서버 시작
echo -e "${GREEN}백엔드 서버 시작 (포트: $BACKEND_PORT)${NC}"
export PORT=$BACKEND_PORT
npm run dev &
BACKEND_PID=$!

# 백엔드가 시작될 때까지 대기
echo "백엔드 서버 시작 대기 중..."
sleep 5

# 프론트엔드 서버 시작
echo -e "${GREEN}프론트엔드 서버 시작 (포트: $FRONTEND_PORT)${NC}"
cd client
export BACKEND_PORT=$BACKEND_PORT
npm run dev &
FRONTEND_PID=$!

# 서버 정보 출력
echo ""
echo "================================"
echo -e "${GREEN}✅ 서버가 시작되었습니다!${NC}"
echo ""
echo "📡 백엔드 API: http://localhost:$BACKEND_PORT"
echo "🌐 프론트엔드: http://localhost:$FRONTEND_PORT"
echo "📚 API 문서: http://localhost:$BACKEND_PORT/api-docs"
echo ""
echo "로그인 계정:"
echo "- 관리자: admin@example.com / admin123"
echo "- 사용자: user@example.com / user123"
echo ""
echo "종료하려면 Ctrl+C를 누르세요"
echo "================================"

# 프로세스 대기
wait $BACKEND_PID $FRONTEND_PID