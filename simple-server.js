const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 4000;

// Middleware
app.use(cors({
  origin: ['http://localhost:5174', 'http://localhost:4000'],
  credentials: true
}));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'client/dist')));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: '🇰🇷 한국 이커머스 플랫폼 서버가 정상 작동 중입니다',
    timestamp: new Date().toISOString(),
    port: PORT
  });
});

// API Routes for testing
app.get('/api/v1/categories', (req, res) => {
  res.json([
    { id: 1, name: '패션', description: '의류, 신발, 액세서리' },
    { id: 2, name: '전자제품', description: '스마트폰, 노트북, 가전제품' },
    { id: 3, name: '뷰티', description: '화장품, 스킨케어, 향수' },
    { id: 4, name: '식품', description: '신선식품, 가공식품, 건강식품' },
    { id: 5, name: '생활용품', description: '주방용품, 청소용품, 수납용품' }
  ]);
});

app.get('/api/v1/products', (req, res) => {
  res.json([
    { 
      id: 1, 
      name: '프리미엄 한국 김치 1kg', 
      price: 25000, 
      category: '식품',
      description: '전통 방식으로 만든 프리미엄 김치',
      image: '/images/kimchi.jpg'
    },
    { 
      id: 2, 
      name: '한국산 고품질 쌀 10kg', 
      price: 45000, 
      category: '식품',
      description: '2024년 햅쌀, 친환경 재배',
      image: '/images/rice.jpg'
    },
    { 
      id: 3, 
      name: 'K-뷰티 스킨케어 세트', 
      price: 89000, 
      category: '뷰티',
      description: '한국 화장품 베스트셀러 세트',
      image: '/images/skincare.jpg'
    }
  ]);
});

// Serve React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`
🚀 한국 이커머스 플랫폼이 시작되었습니다!
📍 서버 주소: http://localhost:${PORT}
📱 클라이언트: http://localhost:5174
🕐 시작 시간: ${new Date().toLocaleString('ko-KR')}
  `);
});