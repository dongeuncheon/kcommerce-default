import { Request, Response } from 'express';
import { elasticsearchService } from '../../services/search/elasticsearchService';

class SearchController {
  // 상품 검색
  async searchProducts(req: Request, res: Response) {
    try {
      const searchQuery = {
        query: req.query.q as string || '',
        filters: {
          categories: req.query.categories ? 
            (req.query.categories as string).split(',') : undefined,
          priceRange: {
            min: req.query.minPrice ? parseFloat(req.query.minPrice as string) : undefined,
            max: req.query.maxPrice ? parseFloat(req.query.maxPrice as string) : undefined
          },
          inStock: req.query.inStock === 'true' ? true : 
                  req.query.inStock === 'false' ? false : undefined,
          tags: req.query.tags ? 
            (req.query.tags as string).split(',') : undefined,
          rating: req.query.rating ? parseFloat(req.query.rating as string) : undefined,
          attributes: req.query.attributes ? 
            JSON.parse(req.query.attributes as string) : undefined
        },
        sort: req.query.sortBy ? {
          field: (req.query.sortBy as string).split(':')[0],
          order: (req.query.sortBy as string).split(':')[1] as 'asc' | 'desc'
        } : undefined,
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
        facets: req.query.facets ? 
          (req.query.facets as string).split(',') : 
          ['categories', 'price', 'tags']
      };

      const results = await elasticsearchService.searchProducts(searchQuery);

      res.json({
        success: true,
        data: results
      });
    } catch (error: any) {
      console.error('Search error:', error);
      res.status(500).json({ 
        error: error.message || '검색 중 오류가 발생했습니다.' 
      });
    }
  }

  // 자동완성
  async autocomplete(req: Request, res: Response) {
    try {
      const query = req.query.q as string;
      if (!query) {
        return res.json({ success: true, data: [] });
      }

      const suggestions = await elasticsearchService.autocomplete(
        query,
        parseInt(req.query.limit as string) || 10
      );

      res.json({
        success: true,
        data: suggestions
      });
    } catch (error: any) {
      console.error('Autocomplete error:', error);
      res.status(500).json({ 
        error: error.message || '자동완성 조회 중 오류가 발생했습니다.' 
      });
    }
  }

  // 인기 검색어
  async getPopularSearches(req: Request, res: Response) {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const searches = await elasticsearchService.getPopularSearches(limit);

      res.json({
        success: true,
        data: searches
      });
    } catch (error: any) {
      console.error('Popular searches error:', error);
      res.status(500).json({ 
        error: error.message || '인기 검색어 조회 중 오류가 발생했습니다.' 
      });
    }
  }

  // 연관 검색어
  async getRelatedSearches(req: Request, res: Response) {
    try {
      const query = req.query.q as string;
      if (!query) {
        return res.json({ success: true, data: [] });
      }

      const related = await elasticsearchService.getRelatedSearches(query);

      res.json({
        success: true,
        data: related
      });
    } catch (error: any) {
      console.error('Related searches error:', error);
      res.status(500).json({ 
        error: error.message || '연관 검색어 조회 중 오류가 발생했습니다.' 
      });
    }
  }

  // 검색 인덱스 상태
  async getIndexStats(req: Request, res: Response) {
    try {
      const stats = await elasticsearchService.getIndexStats();

      res.json({
        success: true,
        data: stats
      });
    } catch (error: any) {
      console.error('Index stats error:', error);
      res.status(500).json({ 
        error: error.message || '인덱스 상태 조회 중 오류가 발생했습니다.' 
      });
    }
  }

  // 전체 재색인 (관리자)
  async reindexAll(req: Request, res: Response) {
    try {
      // 백그라운드에서 실행
      elasticsearchService.reindexAll().catch(console.error);

      res.json({
        success: true,
        message: '재색인이 시작되었습니다. 백그라운드에서 진행됩니다.'
      });
    } catch (error: any) {
      console.error('Reindex error:', error);
      res.status(500).json({ 
        error: error.message || '재색인 중 오류가 발생했습니다.' 
      });
    }
  }
}

export const searchController = new SearchController();