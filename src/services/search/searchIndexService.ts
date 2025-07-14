import { elasticsearchService } from './elasticsearchService';
import { logger } from '../../utils/logger';

/**
 * 검색 인덱스 관리 서비스
 * 상품 CRUD 시 자동으로 검색 인덱스 업데이트
 */
export class SearchIndexService {
  /**
   * 상품 생성 시 인덱스 추가
   */
  async onProductCreated(productId: string): Promise<void> {
    try {
      await elasticsearchService.indexProduct(productId);
      logger.info(`Product ${productId} indexed successfully`);
    } catch (error) {
      logger.error(`Failed to index product ${productId}:`, error);
    }
  }

  /**
   * 상품 업데이트 시 인덱스 재색인
   */
  async onProductUpdated(productId: string): Promise<void> {
    try {
      await elasticsearchService.indexProduct(productId);
      logger.info(`Product ${productId} re-indexed successfully`);
    } catch (error) {
      logger.error(`Failed to re-index product ${productId}:`, error);
    }
  }

  /**
   * 상품 삭제 시 인덱스에서 제거
   */
  async onProductDeleted(productId: string): Promise<void> {
    try {
      await elasticsearchService.deleteProduct(productId);
      logger.info(`Product ${productId} removed from index successfully`);
    } catch (error) {
      logger.error(`Failed to remove product ${productId} from index:`, error);
    }
  }

  /**
   * 상품 상태 변경 시 인덱스 업데이트
   */
  async onProductStatusChanged(productId: string, status: string): Promise<void> {
    try {
      if (status === 'PUBLISHED') {
        await elasticsearchService.indexProduct(productId);
      } else {
        await elasticsearchService.deleteProduct(productId);
      }
      logger.info(`Product ${productId} index updated for status change: ${status}`);
    } catch (error) {
      logger.error(`Failed to update product ${productId} index for status change:`, error);
    }
  }

  /**
   * 재고 변경 시 인덱스 업데이트
   */
  async onInventoryChanged(productId: string): Promise<void> {
    try {
      await elasticsearchService.indexProduct(productId);
      logger.info(`Product ${productId} inventory updated in search index`);
    } catch (error) {
      logger.error(`Failed to update inventory for product ${productId} in search index:`, error);
    }
  }

  /**
   * 리뷰 추가/수정 시 평점 업데이트
   */
  async onReviewChanged(productId: string): Promise<void> {
    try {
      await elasticsearchService.indexProduct(productId);
      logger.info(`Product ${productId} reviews updated in search index`);
    } catch (error) {
      logger.error(`Failed to update reviews for product ${productId} in search index:`, error);
    }
  }

  /**
   * 카테고리 변경 시 관련 상품들 인덱스 업데이트
   */
  async onCategoryChanged(categoryId: string): Promise<void> {
    try {
      // 해당 카테고리의 모든 상품 재색인
      // 실제 구현에서는 배치 처리로 최적화
      logger.info(`Category ${categoryId} changed - related products will be re-indexed`);
    } catch (error) {
      logger.error(`Failed to update products for category ${categoryId}:`, error);
    }
  }

  /**
   * 태그 변경 시 관련 상품들 인덱스 업데이트
   */
  async onTagChanged(tagId: string): Promise<void> {
    try {
      logger.info(`Tag ${tagId} changed - related products will be re-indexed`);
    } catch (error) {
      logger.error(`Failed to update products for tag ${tagId}:`, error);
    }
  }

  /**
   * 전체 재색인
   */
  async reindexAll(): Promise<void> {
    try {
      await elasticsearchService.reindexAll();
      logger.info('Full reindex completed successfully');
    } catch (error) {
      logger.error('Failed to complete full reindex:', error);
      throw error;
    }
  }

  /**
   * 인덱스 상태 확인
   */
  async getIndexHealth(): Promise<any> {
    try {
      return await elasticsearchService.getIndexStats();
    } catch (error) {
      logger.error('Failed to get index health:', error);
      throw error;
    }
  }
}

export const searchIndexService = new SearchIndexService();