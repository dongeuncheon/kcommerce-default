#!/bin/bash

# 통합 이커머스 플랫폼 실행 스크립트
# Commerce-Plugin 기반 1포트 통합 시스템

echo "🚀 통합 한국 이커머스 플랫폼 시작 중..."
echo "📍 1포트 통합 배포 (포트 3000)"
echo ""

# 현재 디렉토리 확인
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$SCRIPT_DIR"

# 환경 설정
export NODE_ENV=development
export PORT=3000
export PLUGIN_ENABLED=true
export CORE_INTEGRATION=true

echo "🔧 환경 설정:"
echo "   - NODE_ENV: $NODE_ENV"
echo "   - PORT: $PORT"
echo "   - PLUGIN_ENABLED: $PLUGIN_ENABLED"
echo "   - CORE_INTEGRATION: $CORE_INTEGRATION"
echo ""

# Commerce-Plugin 디렉토리로 이동
cd commerce-plugin

echo "📦 의존성 체크 중..."
if [ ! -d "node_modules" ]; then
    echo "⚠️  node_modules가 없습니다. npm install 실행 중..."
    npm install
fi

echo "📦 클라이언트 의존성 체크 중..."
cd client
if [ ! -d "node_modules" ]; then
    echo "⚠️  클라이언트 node_modules가 없습니다. npm install 실행 중..."
    npm install
fi

cd ..

echo ""
echo "🎯 통합 시스템 시작..."
echo "📌 접속 URL:"
echo "   🌐 웹사이트: http://localhost:3000"
echo "   🔧 API: http://localhost:3000/api"
echo "   📊 Admin: http://localhost:3000/admin"
echo "   🔍 API 문서: http://localhost:3000/api-docs"
echo "   🏥 Health: http://localhost:3000/health"
echo "   📈 Metrics: http://localhost:3000/metrics"
echo ""
echo "✨ 주요 기능:"
echo "   ✅ 한글화된 UI"
echo "   ✅ 한국 결제 시스템 (토스페이, 카카오페이)"
echo "   ✅ 한국 배송 시스템 (CJ대한통운, 로젠택배)"
echo "   ✅ 본인인증 시스템 (NICE, KMC, LGU+)"
echo "   ✅ AI 추천 엔진"
echo "   ✅ 실시간 재고 관리"
echo "   ✅ 어드민 대시보드"
echo "   ✅ 모니터링 & 분석"
echo ""

# 서버 시작
npm run dev