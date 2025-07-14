/**
 * Commerce-Core 통합 모듈
 * Commerce-Plugin에 Commerce-Core의 기능을 추가 통합
 */

import express from 'express';
import { logger } from '../utils/logger';

export interface CoreIntegrationConfig {
  enableCoreRoutes: boolean;
  coreApiPrefix: string;
  enableSampleData: boolean;
}

/**
 * Commerce-Core의 샘플 상품 데이터 (한글화)
 */
const koreanSampleProducts = [
  {
    id: 'kr-001',
    name: '삼성 갤럭시 S24 Ultra 256GB',
    price: 1299000,
    originalPrice: 1599000,
    currency: 'KRW',
    description: '최신 AI 기능이 탑재된 프리미엄 스마트폰. S펜과 함께 제공되며, 200MP 카메라로 선명한 사진 촬영이 가능합니다.',
    image: '/uploads/products/galaxy-s24-ultra.jpg',
    images: [
      '/uploads/products/galaxy-s24-ultra-1.jpg',
      '/uploads/products/galaxy-s24-ultra-2.jpg',
      '/uploads/products/galaxy-s24-ultra-3.jpg'
    ],
    stock: 50,
    category: 'electronics',
    subcategory: 'smartphones',
    brand: '삼성전자',
    rating: 4.8,
    reviewCount: 328,
    tags: ['스마트폰', '갤럭시', 'AI카메라', 'S펜'],
    specifications: {
      display: '6.8인치 Dynamic AMOLED 2X',
      camera: '200MP + 50MP + 12MP + 10MP',
      storage: '256GB',
      ram: '12GB',
      battery: '5000mAh',
      os: 'Android 14'
    },
    shipping: {
      free: true,
      estimatedDays: '1-2',
      weight: 232,
      dimensions: '162.3 x 79.0 x 8.6'
    }
  },
  {
    id: 'kr-002', 
    name: 'LG 그램 17인치 노트북 17Z90R',
    price: 1890000,
    originalPrice: 2290000,
    currency: 'KRW',
    description: '초경량 17인치 대화면 노트북. 무게 1.35kg의 휴대성과 17인치 대화면을 동시에 만족하는 프리미엄 노트북입니다.',
    image: '/uploads/products/lg-gram-17.jpg',
    images: [
      '/uploads/products/lg-gram-17-1.jpg',
      '/uploads/products/lg-gram-17-2.jpg'
    ],
    stock: 30,
    category: 'electronics',
    subcategory: 'laptops',
    brand: 'LG전자',
    rating: 4.6,
    reviewCount: 189,
    tags: ['노트북', '그램', '초경량', '대화면'],
    specifications: {
      display: '17인치 WQXGA IPS',
      processor: 'Intel Core i7-1360P',
      storage: '512GB NVMe SSD',
      ram: '16GB LPDDR5',
      graphics: 'Intel Iris Xe',
      weight: '1.35kg'
    },
    shipping: {
      free: true,
      estimatedDays: '2-3',
      weight: 1350,
      dimensions: '380.0 x 260.0 x 17.8'
    }
  },
  {
    id: 'kr-003',
    name: '삼성 비스포크 4도어 냉장고 RF85C9013AP',
    price: 2590000,
    originalPrice: 3190000,
    currency: 'KRW',
    description: '맞춤형 디자인과 스마트 기능을 갖춘 프리미엄 냉장고. 컬러를 자유롭게 선택할 수 있으며, SmartThings 앱으로 원격 제어가 가능합니다.',
    image: '/uploads/products/bespoke-fridge.jpg',
    images: [
      '/uploads/products/bespoke-fridge-1.jpg',
      '/uploads/products/bespoke-fridge-2.jpg',
      '/uploads/products/bespoke-fridge-3.jpg'
    ],
    stock: 15,
    category: 'appliances',
    subcategory: 'refrigerators',
    brand: '삼성전자',
    rating: 4.9,
    reviewCount: 456,
    tags: ['냉장고', '비스포크', '4도어', '스마트가전'],
    specifications: {
      capacity: '846L',
      type: '4도어',
      energyRating: '1등급',
      features: ['UV 살균', '트리플 쿨링', '맞춤형 온도'],
      connectivity: 'SmartThings',
      warranty: '3년'
    },
    shipping: {
      free: true,
      estimatedDays: '7-14',
      installation: true,
      weight: 145000,
      dimensions: '912 x 716 x 1853'
    }
  }
];

/**
 * Commerce-Core 기능들을 Commerce-Plugin에 통합
 */
export function integrateCoreFeatures(app: express.Application, config: CoreIntegrationConfig) {
  logger.info('🔄 Commerce-Core 기능 통합 시작...');

  if (config.enableCoreRoutes) {
    setupCoreRoutes(app, config);
  }

  if (config.enableSampleData) {
    setupSampleDataRoutes(app, config);
  }

  logger.info('✅ Commerce-Core 기능 통합 완료');
}

/**
 * Core 라우트 설정
 */
function setupCoreRoutes(app: express.Application, config: CoreIntegrationConfig) {
  const prefix = config.coreApiPrefix || '/core';

  // Core Health Check
  app.get(`${prefix}/health`, (req, res) => {
    res.json({
      status: 'ok',
      service: 'commerce-core-integrated',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0-integrated',
      features: {
        sampleData: config.enableSampleData,
        coreRoutes: config.enableCoreRoutes
      }
    });
  });

  // Core API 정보
  app.get(`${prefix}/info`, (req, res) => {
    res.json({
      message: '통합된 Commerce Core API',
      version: '1.0.0',
      integration: 'commerce-plugin',
      endpoints: {
        health: `${prefix}/health`,
        sampleProducts: `${prefix}/sample/products`,
        sampleCategories: `${prefix}/sample/categories`
      },
      features: [
        '샘플 상품 데이터 (한글)',
        '기본 카테고리 구조',
        '통합 API 엔드포인트'
      ]
    });
  });

  logger.info(`📍 Core 라우트 설정 완료: ${prefix}`);
}

/**
 * 샘플 데이터 라우트 설정
 */
function setupSampleDataRoutes(app: express.Application, config: CoreIntegrationConfig) {
  const prefix = config.coreApiPrefix || '/core';

  // 한글화된 샘플 상품 데이터
  app.get(`${prefix}/sample/products`, (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const category = req.query.category as string;

    let filteredProducts = koreanSampleProducts;
    
    if (category) {
      filteredProducts = koreanSampleProducts.filter(p => p.category === category);
    }

    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedProducts = filteredProducts.slice(startIndex, endIndex);

    res.json({
      success: true,
      data: {
        products: paginatedProducts,
        pagination: {
          total: filteredProducts.length,
          page,
          limit,
          pages: Math.ceil(filteredProducts.length / limit)
        }
      },
      message: '샘플 상품 데이터 (한글화)'
    });
  });

  // 한글화된 카테고리 데이터
  app.get(`${prefix}/sample/categories`, (req, res) => {
    res.json({
      success: true,
      data: {
        categories: [
          { 
            id: 'electronics', 
            name: '전자제품', 
            slug: 'electronics', 
            count: 2,
            description: '스마트폰, 노트북, 태블릿 등 전자기기',
            subcategories: [
              { id: 'smartphones', name: '스마트폰', count: 1 },
              { id: 'laptops', name: '노트북', count: 1 },
              { id: 'tablets', name: '태블릿', count: 0 }
            ]
          },
          { 
            id: 'appliances', 
            name: '가전제품', 
            slug: 'appliances', 
            count: 1,
            description: '냉장고, 세탁기, 에어컨 등 생활가전',
            subcategories: [
              { id: 'refrigerators', name: '냉장고', count: 1 },
              { id: 'washers', name: '세탁기', count: 0 },
              { id: 'airconditioners', name: '에어컨', count: 0 }
            ]
          },
          { 
            id: 'fashion', 
            name: '패션의류', 
            slug: 'fashion', 
            count: 0,
            description: '의류, 신발, 액세서리',
            subcategories: [
              { id: 'clothing', name: '의류', count: 0 },
              { id: 'shoes', name: '신발', count: 0 },
              { id: 'accessories', name: '액세서리', count: 0 }
            ]
          },
          { 
            id: 'beauty', 
            name: '뷰티', 
            slug: 'beauty', 
            count: 0,
            description: '화장품, 스킨케어, 향수',
            subcategories: [
              { id: 'skincare', name: '스킨케어', count: 0 },
              { id: 'makeup', name: '메이크업', count: 0 },
              { id: 'fragrance', name: '향수', count: 0 }
            ]
          },
          { 
            id: 'food', 
            name: '식품', 
            slug: 'food', 
            count: 0,
            description: '신선식품, 가공식품, 건강식품',
            subcategories: [
              { id: 'fresh', name: '신선식품', count: 0 },
              { id: 'processed', name: '가공식품', count: 0 },
              { id: 'health', name: '건강식품', count: 0 }
            ]
          }
        ]
      },
      message: '한글화된 카테고리 데이터'
    });
  });

  logger.info(`📦 샘플 데이터 라우트 설정 완료: ${prefix}/sample`);
}

export default {
  integrateCoreFeatures,
  koreanSampleProducts
};