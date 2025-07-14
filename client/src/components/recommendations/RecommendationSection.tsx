import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Sparkles, TrendingUp, Users, Package } from 'lucide-react';
import { recommendationService } from '../../services/recommendationService';
import { ProductCard } from '../products/ProductCard';
import { useAuthStore } from '../../stores/authStore';

interface RecommendationSectionProps {
  title: string;
  algorithm: string;
  context?: any;
  limit?: number;
  className?: string;
}

const RecommendationSection: React.FC<RecommendationSectionProps> = ({
  title,
  algorithm,
  context,
  limit = 10,
  className = ''
}) => {
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const { user } = useAuthStore();
  const itemsPerPage = 5;

  useEffect(() => {
    loadRecommendations();
  }, [algorithm, context]);

  const loadRecommendations = async () => {
    try {
      setLoading(true);
      const response = await recommendationService.getRecommendations({
        userId: user?.id,
        algorithm,
        limit,
        context
      });
      setRecommendations(response.recommendations);
    } catch (error) {
      console.error('추천 로딩 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRecommendationClick = async (productId: string, position: number) => {
    // 추천 클릭 추적
    await recommendationService.trackClick({
      productId,
      algorithm,
      position
    });
  };

  const getAlgorithmIcon = () => {
    switch (algorithm) {
      case 'personalized':
        return <Sparkles className="w-5 h-5 text-blue-500" />;
      case 'trending':
        return <TrendingUp className="w-5 h-5 text-green-500" />;
      case 'similar_users':
        return <Users className="w-5 h-5 text-purple-500" />;
      default:
        return <Package className="w-5 h-5 text-gray-500" />;
    }
  };

  const nextPage = () => {
    if ((currentPage + 1) * itemsPerPage < recommendations.length) {
      setCurrentPage(currentPage + 1);
    }
  };

  const prevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  const visibleRecommendations = recommendations.slice(
    currentPage * itemsPerPage,
    (currentPage + 1) * itemsPerPage
  );

  if (loading) {
    return (
      <div className={`bg-white rounded-lg p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="space-y-3">
                <div className="h-40 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (recommendations.length === 0) {
    return null;
  }

  return (
    <div className={`bg-white rounded-lg p-6 ${className}`}>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          {getAlgorithmIcon()}
          <h2 className="text-xl font-bold text-gray-900">{title}</h2>
          <span className="text-sm text-gray-500">
            ({recommendations.length}개)
          </span>
        </div>
        
        {recommendations.length > itemsPerPage && (
          <div className="flex items-center space-x-2">
            <button
              onClick={prevPage}
              disabled={currentPage === 0}
              className="p-1 rounded-full hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-sm text-gray-600">
              {currentPage + 1} / {Math.ceil(recommendations.length / itemsPerPage)}
            </span>
            <button
              onClick={nextPage}
              disabled={(currentPage + 1) * itemsPerPage >= recommendations.length}
              className="p-1 rounded-full hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      {/* 추천 상품 그리드 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {visibleRecommendations.map((item, index) => (
          <div
            key={item.productId}
            onClick={() => handleRecommendationClick(
              item.productId, 
              currentPage * itemsPerPage + index
            )}
            className="relative"
          >
            <ProductCard product={item.product} />
            
            {/* 추천 점수 표시 (개발 모드) */}
            {process.env.NODE_ENV === 'development' && (
              <div className="absolute top-2 right-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded">
                {(item.score * 100).toFixed(1)}%
              </div>
            )}
            
            {/* 추천 이유 */}
            {item.reason && (
              <div className="mt-2 text-xs text-gray-600 line-clamp-2">
                {item.reason}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 더보기 버튼 */}
      {recommendations.length > visibleRecommendations.length && (
        <div className="mt-6 text-center">
          <button
            onClick={() => window.location.href = `/recommendations?algorithm=${algorithm}`}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            더 많은 추천 보기 →
          </button>
        </div>
      )}
    </div>
  );
};

export default RecommendationSection;