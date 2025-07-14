import { Router } from 'express';
import { searchController } from '../controllers/searchController';
import { auth, optionalAuth } from '../../middleware/auth';

const router = Router();

// 상품 검색
router.get('/products', optionalAuth, searchController.searchProducts);

// 자동완성
router.get('/autocomplete', searchController.autocomplete);

// 인기 검색어
router.get('/popular', searchController.getPopularSearches);

// 연관 검색어
router.get('/related', searchController.getRelatedSearches);

// 검색 인덱스 상태 (관리자)
router.get('/index/stats', searchController.getIndexStats);

// 전체 재색인 (관리자)
router.post('/index/reindex', searchController.reindexAll);

export default router;