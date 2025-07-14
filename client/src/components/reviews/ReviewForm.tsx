import React, { useState } from 'react';
import { Star, Upload, X, Image as ImageIcon, Video } from 'lucide-react';
import { reviewService } from '../../services/reviewService';
import { CreateReviewDto } from '../../types/review';

interface ReviewFormProps {
  productId: string;
  orderId?: string;
  orderItemId?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const ReviewForm: React.FC<ReviewFormProps> = ({
  productId,
  orderId,
  orderItemId,
  onSuccess,
  onCancel
}) => {
  const [formData, setFormData] = useState<CreateReviewDto>({
    productId,
    orderId,
    orderItemId,
    rating: 5,
    title: '',
    comment: '',
    pros: '',
    cons: '',
    qualityRating: undefined,
    valueRating: undefined,
    deliveryRating: undefined,
    images: [],
    videos: []
  });
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [previewVideos, setPreviewVideos] = useState<string[]>([]);

  const handleRatingChange = (rating: number, type: 'main' | 'quality' | 'value' | 'delivery') => {
    if (type === 'main') {
      setFormData(prev => ({ ...prev, rating }));
    } else {
      setFormData(prev => ({ 
        ...prev, 
        [`${type}Rating`]: rating 
      }));
    }
  };

  const renderStarRating = (
    currentRating: number, 
    onChange: (rating: number) => void,
    label: string
  ) => {
    return (
      <div className="flex items-center space-x-2">
        <span className="text-sm font-medium text-gray-700 w-16">{label}</span>
        <div className="flex space-x-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => onChange(star)}
              className="focus:outline-none"
            >
              <Star
                size={24}
                className={`${
                  star <= currentRating 
                    ? 'text-yellow-400 fill-current' 
                    : 'text-gray-300'
                } hover:text-yellow-400 transition-colors`}
              />
            </button>
          ))}
        </div>
        <span className="text-sm text-gray-600 ml-2">{currentRating}/5</span>
      </div>
    );
  };

  const handleImageUpload = async (files: FileList) => {
    if (files.length === 0) return;
    
    setUploading(true);
    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        // 실제로는 파일 업로드 서비스를 사용
        // 여기서는 시뮬레이션
        return new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
      });

      const imageUrls = await Promise.all(uploadPromises);
      setPreviewImages(prev => [...prev, ...imageUrls]);
      setFormData(prev => ({
        ...prev,
        images: [...(prev.images || []), ...imageUrls]
      }));
    } catch (error) {
      console.error('이미지 업로드 실패:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleVideoUpload = async (files: FileList) => {
    if (files.length === 0) return;
    
    setUploading(true);
    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        return new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
      });

      const videoUrls = await Promise.all(uploadPromises);
      setPreviewVideos(prev => [...prev, ...videoUrls]);
      setFormData(prev => ({
        ...prev,
        videos: [...(prev.videos || []), ...videoUrls]
      }));
    } catch (error) {
      console.error('동영상 업로드 실패:', error);
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (index: number) => {
    setPreviewImages(prev => prev.filter((_, i) => i !== index));
    setFormData(prev => ({
      ...prev,
      images: prev.images?.filter((_, i) => i !== index)
    }));
  };

  const removeVideo = (index: number) => {
    setPreviewVideos(prev => prev.filter((_, i) => i !== index));
    setFormData(prev => ({
      ...prev,
      videos: prev.videos?.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.rating) {
      alert('평점을 선택해주세요.');
      return;
    }

    setSubmitting(true);
    try {
      await reviewService.createReview(formData);
      onSuccess();
    } catch (error) {
      console.error('리뷰 작성 실패:', error);
      alert('리뷰 작성에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white p-6 rounded-lg shadow">
      <h2 className="text-xl font-bold text-gray-900 mb-6">리뷰 작성하기</h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 전체 평점 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            전체 평점 *
          </label>
          {renderStarRating(
            formData.rating,
            (rating) => handleRatingChange(rating, 'main'),
            ''
          )}
        </div>

        {/* 상세 평점 */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-700">상세 평점 (선택사항)</h3>
          
          {renderStarRating(
            formData.qualityRating || 0,
            (rating) => handleRatingChange(rating, 'quality'),
            '품질'
          )}
          
          {renderStarRating(
            formData.valueRating || 0,
            (rating) => handleRatingChange(rating, 'value'),
            '가성비'
          )}
          
          {renderStarRating(
            formData.deliveryRating || 0,
            (rating) => handleRatingChange(rating, 'delivery'),
            '배송'
          )}
        </div>

        {/* 리뷰 제목 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            리뷰 제목
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
            placeholder="리뷰 제목을 입력해주세요"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            maxLength={100}
          />
        </div>

        {/* 리뷰 내용 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            상세 리뷰
          </label>
          <textarea
            value={formData.comment}
            onChange={(e) => setFormData(prev => ({ ...prev, comment: e.target.value }))}
            placeholder="상품에 대한 솔직한 후기를 작성해주세요"
            rows={5}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            maxLength={2000}
          />
          <div className="text-xs text-gray-500 mt-1">
            {formData.comment?.length || 0}/2000자
          </div>
        </div>

        {/* 장점/단점 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              👍 좋은 점
            </label>
            <textarea
              value={formData.pros}
              onChange={(e) => setFormData(prev => ({ ...prev, pros: e.target.value }))}
              placeholder="이 상품의 장점을 알려주세요"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              maxLength={500}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              👎 아쉬운 점
            </label>
            <textarea
              value={formData.cons}
              onChange={(e) => setFormData(prev => ({ ...prev, cons: e.target.value }))}
              placeholder="개선되었으면 하는 점을 알려주세요"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              maxLength={500}
            />
          </div>
        </div>

        {/* 이미지/동영상 업로드 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            사진/동영상 첨부
          </label>
          <p className="text-xs text-gray-500 mb-3">
            사진은 최대 5장, 동영상은 최대 2개까지 업로드 가능합니다. 포토/동영상 리뷰 시 추가 포인트를 적립받을 수 있습니다.
          </p>
          
          <div className="flex space-x-4 mb-4">
            <label className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
              <ImageIcon size={16} />
              <span>사진 추가</span>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={(e) => e.target.files && handleImageUpload(e.target.files)}
                className="hidden"
                disabled={uploading || (previewImages.length >= 5)}
              />
            </label>
            
            <label className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
              <Video size={16} />
              <span>동영상 추가</span>
              <input
                type="file"
                multiple
                accept="video/*"
                onChange={(e) => e.target.files && handleVideoUpload(e.target.files)}
                className="hidden"
                disabled={uploading || (previewVideos.length >= 2)}
              />
            </label>
          </div>

          {/* 이미지 미리보기 */}
          {previewImages.length > 0 && (
            <div className="grid grid-cols-5 gap-2 mb-4">
              {previewImages.map((image, index) => (
                <div key={index} className="relative">
                  <img
                    src={image}
                    alt={`미리보기 ${index + 1}`}
                    className="w-full h-20 object-cover rounded-lg border"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* 동영상 미리보기 */}
          {previewVideos.length > 0 && (
            <div className="grid grid-cols-2 gap-2 mb-4">
              {previewVideos.map((video, index) => (
                <div key={index} className="relative">
                  <video
                    src={video}
                    className="w-full h-24 object-cover rounded-lg border"
                    controls
                  />
                  <button
                    type="button"
                    onClick={() => removeVideo(index)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 포인트 안내 */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">💰 리뷰 적립 포인트</h4>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• 일반 리뷰: 100P</li>
            <li>• 포토 리뷰: 300P (일반 리뷰 + 포토 보너스 200P)</li>
            <li>• 동영상 리뷰: 600P (일반 리뷰 + 동영상 보너스 500P)</li>
            <li className="text-xs">* 구매 확인된 리뷰에만 포인트가 지급됩니다.</li>
          </ul>
        </div>

        {/* 버튼 */}
        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            disabled={submitting}
          >
            취소
          </button>
          <button
            type="submit"
            disabled={submitting || uploading || !formData.rating}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? '작성 중...' : '리뷰 작성하기'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ReviewForm;