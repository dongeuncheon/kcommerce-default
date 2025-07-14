import React, { useState, useEffect } from 'react';
import { Star, ThumbsUp, ThumbsDown, MessageCircle, Flag, Filter } from 'lucide-react';
import { reviewService } from '../../services/reviewService';
import { Review, ReviewQueryDto } from '../../types/review';
import ReviewCard from './ReviewCard';
import ReviewFilters from './ReviewFilters';
import ReviewStatistics from './ReviewStatistics';

interface ReviewListProps {
  productId: string;
  canWrite?: boolean;
  onWriteReview?: () => void;
}

const ReviewList: React.FC<ReviewListProps> = ({ 
  productId, 
  canWrite = false, 
  onWriteReview 
}) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0
  });
  const [filters, setFilters] = useState<ReviewQueryDto>({
    page: 1,
    limit: 10,
    sortBy: 'latest'
  });
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadReviews();
  }, [productId, filters]);

  const loadReviews = async () => {
    try {
      setLoading(true);
      const response = await reviewService.getProductReviews(productId, filters);
      setReviews(response.reviews);
      setPagination(response.pagination);
    } catch (error) {
      console.error('리뷰 로딩 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (newFilters: Partial<ReviewQueryDto>) => {
    setFilters(prev => ({
      ...prev,
      ...newFilters,
      page: 1 // 필터 변경시 첫 페이지로
    }));
  };

  const handlePageChange = (page: number) => {
    setFilters(prev => ({ ...prev, page }));
  };

  const handleVote = async (reviewId: string, isHelpful: boolean) => {
    try {
      await reviewService.voteReview(reviewId, isHelpful);
      // 투표 후 리뷰 목록 새로고침
      loadReviews();
    } catch (error) {
      console.error('투표 실패:', error);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="bg-gray-200 h-32 rounded-lg"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 리뷰 통계 */}
      <ReviewStatistics productId={productId} />

      {/* 리뷰 작성 버튼 */}
      {canWrite && (
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-gray-900">구매하신 상품은 어떠셨나요?</h3>
              <p className="text-sm text-gray-600">다른 고객들에게 도움이 되는 리뷰를 남겨주세요.</p>
            </div>
            <button
              onClick={onWriteReview}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              리뷰 작성하기
            </button>
          </div>
        </div>
      )}

      {/* 필터 및 정렬 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <span className="text-gray-700">총 {pagination.total}개의 리뷰</span>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
          >
            <Filter size={16} />
            <span>필터</span>
          </button>
        </div>

        <select
          value={filters.sortBy}
          onChange={(e) => handleFilterChange({ sortBy: e.target.value as any })}
          className="border border-gray-300 rounded-lg px-3 py-2"
        >
          <option value="latest">최신순</option>
          <option value="oldest">등록순</option>
          <option value="rating_high">평점 높은순</option>
          <option value="rating_low">평점 낮은순</option>
          <option value="helpful">도움순</option>
        </select>
      </div>

      {/* 필터 패널 */}
      {showFilters && (
        <ReviewFilters
          filters={filters}
          onFilterChange={handleFilterChange}
          onClose={() => setShowFilters(false)}
        />
      )}

      {/* 리뷰 목록 */}
      <div className="space-y-4">
        {reviews.length === 0 ? (
          <div className="text-center py-12">
            <Star className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              아직 리뷰가 없습니다
            </h3>
            <p className="text-gray-600">
              첫 번째 리뷰를 작성해보세요!
            </p>
          </div>
        ) : (
          reviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              onVote={handleVote}
            />
          ))
        )}
      </div>

      {/* 페이지네이션 */}
      {pagination.totalPages > 1 && (
        <div className="flex justify-center items-center space-x-2">
          <button
            onClick={() => handlePageChange(pagination.page - 1)}
            disabled={pagination.page === 1}
            className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            이전
          </button>

          {[...Array(Math.min(5, pagination.totalPages))].map((_, i) => {
            const page = i + Math.max(1, pagination.page - 2);
            if (page > pagination.totalPages) return null;
            
            return (
              <button
                key={page}
                onClick={() => handlePageChange(page)}
                className={`px-3 py-2 border rounded-lg ${
                  page === pagination.page
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
              >
                {page}
              </button>
            );
          })}

          <button
            onClick={() => handlePageChange(pagination.page + 1)}
            disabled={pagination.page === pagination.totalPages}
            className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
};

export default ReviewList;