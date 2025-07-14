import React, { useState } from 'react';
import { Star, ThumbsUp, ThumbsDown, MessageCircle, Flag, Image as ImageIcon, Play } from 'lucide-react';
import { Review } from '../../types/review';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';

interface ReviewCardProps {
  review: Review;
  onVote: (reviewId: string, isHelpful: boolean) => void;
  onReport?: (reviewId: string) => void;
}

const ReviewCard: React.FC<ReviewCardProps> = ({ review, onVote, onReport }) => {
  const [showFullContent, setShowFullContent] = useState(false);
  const [imageViewIndex, setImageViewIndex] = useState<number | null>(null);

  const renderStars = (rating: number) => {
    return [...Array(5)].map((_, i) => (
      <Star
        key={i}
        size={16}
        className={`${
          i < rating ? 'text-yellow-400 fill-current' : 'text-gray-300'
        }`}
      />
    ));
  };

  const renderDetailRatings = () => {
    const ratings = [
      { label: '품질', value: review.qualityRating },
      { label: '가성비', value: review.valueRating },
      { label: '배송', value: review.deliveryRating }
    ];

    return (
      <div className="grid grid-cols-3 gap-4 mt-3">
        {ratings.map(({ label, value }) => {
          if (!value) return null;
          return (
            <div key={label} className="text-center">
              <div className="text-xs text-gray-600 mb-1">{label}</div>
              <div className="flex justify-center space-x-0.5">
                {renderStars(value)}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderImages = () => {
    if (!review.images || review.images.length === 0) return null;

    return (
      <div className="flex space-x-2 mt-3">
        {review.images.map((image, index) => (
          <div
            key={index}
            className="relative w-20 h-20 bg-gray-100 rounded-lg overflow-hidden cursor-pointer hover:opacity-80"
            onClick={() => setImageViewIndex(index)}
          >
            <img
              src={image}
              alt={`리뷰 이미지 ${index + 1}`}
              className="w-full h-full object-cover"
            />
            <div className="absolute top-1 right-1 bg-black bg-opacity-50 text-white rounded-full p-1">
              <ImageIcon size={12} />
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderVideos = () => {
    if (!review.videos || review.videos.length === 0) return null;

    return (
      <div className="flex space-x-2 mt-3">
        {review.videos.map((video, index) => (
          <div
            key={index}
            className="relative w-32 h-20 bg-gray-100 rounded-lg overflow-hidden cursor-pointer hover:opacity-80"
          >
            <video className="w-full h-full object-cover">
              <source src={video} />
            </video>
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-40">
              <Play className="text-white" size={24} />
            </div>
          </div>
        ))}
      </div>
    );
  };

  const getReviewTypeLabel = (type: string) => {
    const labels = {
      GENERAL: '일반',
      PHOTO: '포토',
      VIDEO: '동영상',
      EXPERIENCE: '체험단'
    };
    return labels[type as keyof typeof labels] || type;
  };

  const shouldTruncate = review.comment && review.comment.length > 200;
  const displayContent = showFullContent || !shouldTruncate 
    ? review.comment 
    : review.comment?.substring(0, 200) + '...';

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
      {/* 리뷰 헤더 */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
            {review.user.profileImage ? (
              <img
                src={review.user.profileImage}
                alt={review.user.nickname}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <span className="text-gray-600 font-medium">
                {review.user.nickname[0].toUpperCase()}
              </span>
            )}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-medium text-gray-900">{review.user.nickname}</span>
              {review.isVerified && (
                <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                  구매확인
                </span>
              )}
              {review.isBest && (
                <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full">
                  베스트
                </span>
              )}
              <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full">
                {getReviewTypeLabel(review.reviewType)}
              </span>
            </div>
            <div className="flex items-center space-x-2 mt-1">
              <div className="flex space-x-0.5">
                {renderStars(review.rating)}
              </div>
              <span className="text-sm text-gray-500">
                {formatDistanceToNow(new Date(review.createdAt), { 
                  addSuffix: true, 
                  locale: ko 
                })}
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={() => onReport?.(review.id)}
          className="text-gray-400 hover:text-gray-600"
        >
          <Flag size={16} />
        </button>
      </div>

      {/* 상세 평점 */}
      {(review.qualityRating || review.valueRating || review.deliveryRating) && (
        renderDetailRatings()
      )}

      {/* 리뷰 제목 */}
      {review.title && (
        <h4 className="font-medium text-gray-900 mb-2">{review.title}</h4>
      )}

      {/* 리뷰 내용 */}
      {review.comment && (
        <div className="mb-3">
          <p className="text-gray-700 whitespace-pre-wrap">{displayContent}</p>
          {shouldTruncate && (
            <button
              onClick={() => setShowFullContent(!showFullContent)}
              className="text-blue-600 text-sm mt-1 hover:underline"
            >
              {showFullContent ? '접기' : '더보기'}
            </button>
          )}
        </div>
      )}

      {/* 장점/단점 */}
      {(review.pros || review.cons) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
          {review.pros && (
            <div className="bg-green-50 p-3 rounded-lg">
              <div className="font-medium text-green-800 mb-1">👍 좋은 점</div>
              <p className="text-green-700 text-sm">{review.pros}</p>
            </div>
          )}
          {review.cons && (
            <div className="bg-red-50 p-3 rounded-lg">
              <div className="font-medium text-red-800 mb-1">👎 아쉬운 점</div>
              <p className="text-red-700 text-sm">{review.cons}</p>
            </div>
          )}
        </div>
      )}

      {/* 이미지 */}
      {renderImages()}

      {/* 비디오 */}
      {renderVideos()}

      {/* 포인트 정보 */}
      {review.pointsEarned && (
        <div className="bg-blue-50 p-2 rounded text-sm text-blue-700 mt-3">
          💰 이 리뷰로 {review.pointsEarned}P를 적립받았습니다
          {review.photoBonus && ` (포토리뷰 보너스 +${review.photoBonus}P)`}
        </div>
      )}

      {/* 리뷰 답글 */}
      {review.replies && review.replies.length > 0 && (
        <div className="mt-4 space-y-3">
          {review.replies.map((reply) => (
            <div key={reply.id} className="bg-gray-50 p-3 rounded-lg ml-4">
              <div className="flex items-center space-x-2 mb-2">
                <span className="font-medium text-gray-900">{reply.user.nickname}</span>
                {reply.user.role === 'ADMIN' && (
                  <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full">
                    관리자
                  </span>
                )}
                {reply.user.role === 'SELLER' && (
                  <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                    판매자
                  </span>
                )}
                <span className="text-sm text-gray-500">
                  {formatDistanceToNow(new Date(reply.createdAt), { 
                    addSuffix: true, 
                    locale: ko 
                  })}
                </span>
              </div>
              <p className="text-gray-700">{reply.content}</p>
            </div>
          ))}
        </div>
      )}

      {/* 도움됨 버튼 */}
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => onVote(review.id, true)}
            className="flex items-center space-x-2 text-gray-600 hover:text-green-600 transition-colors"
          >
            <ThumbsUp size={16} />
            <span className="text-sm">도움됨 {review.helpfulCount}</span>
          </button>
          <button
            onClick={() => onVote(review.id, false)}
            className="flex items-center space-x-2 text-gray-600 hover:text-red-600 transition-colors"
          >
            <ThumbsDown size={16} />
            <span className="text-sm">안도움됨 {review.notHelpfulCount}</span>
          </button>
        </div>

        <div className="text-sm text-gray-500">
          조회 {review.viewCount}
        </div>
      </div>

      {/* 이미지 확대 모달 */}
      {imageViewIndex !== null && review.images && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-75 flex items-center justify-center p-4">
          <div className="relative max-w-4xl max-h-full">
            <img
              src={review.images[imageViewIndex]}
              alt={`리뷰 이미지 ${imageViewIndex + 1}`}
              className="max-w-full max-h-full object-contain"
            />
            <button
              onClick={() => setImageViewIndex(null)}
              className="absolute top-4 right-4 text-white bg-black bg-opacity-50 rounded-full p-2 hover:bg-opacity-75"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReviewCard;