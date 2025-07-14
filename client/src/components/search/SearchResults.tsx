import React from 'react';
import { Link } from 'react-router-dom';
import { Star, ShoppingCart, Heart } from 'lucide-react';
import { Product } from '../../types';
import { useCartStore } from '../../stores/cartStore';
import { formatPrice } from '../../utils/format';

interface SearchResultsProps {
  products: Array<Product & { highlights?: any }>;
  loading: boolean;
  viewMode: 'grid' | 'list';
}

export const SearchResults: React.FC<SearchResultsProps> = ({
  products,
  loading,
  viewMode
}) => {
  const { addItem } = useCartStore();

  const handleAddToCart = (product: Product) => {
    addItem({
      productId: product.id,
      quantity: 1,
      price: product.salePrice || product.price,
      product
    });
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="bg-gray-200 h-64 rounded-lg mb-4"></div>
            <div className="bg-gray-200 h-4 w-3/4 rounded mb-2"></div>
            <div className="bg-gray-200 h-4 w-1/2 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-lg">검색 결과가 없습니다.</p>
        <p className="text-gray-400 mt-2">다른 검색어로 시도해보세요.</p>
      </div>
    );
  }

  return (
    <div className={viewMode === 'grid' 
      ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
      : 'space-y-4'
    }>
      {products.map(product => (
        <div
          key={product.id}
          className={viewMode === 'grid'
            ? 'bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow'
            : 'bg-white rounded-lg shadow-md p-4 flex hover:shadow-lg transition-shadow'
          }
        >
          {viewMode === 'grid' ? (
            <>
              {/* Grid View */}
              <Link to={`/products/${product.id}`} className="block">
                <div className="relative">
                  <img
                    src={product.images?.[0]?.url || '/placeholder.jpg'}
                    alt={product.name}
                    className="w-full h-64 object-cover"
                  />
                  {product.salePrice && (
                    <div className="absolute top-2 left-2 bg-red-500 text-white px-2 py-1 rounded text-sm">
                      {Math.round(((product.price - product.salePrice) / product.price) * 100)}% 할인
                    </div>
                  )}
                  <button className="absolute top-2 right-2 p-2 bg-white rounded-full shadow hover:bg-gray-100">
                    <Heart className="w-5 h-5 text-gray-600" />
                  </button>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-gray-800 mb-2 line-clamp-2">
                    {product.highlights?.name ? (
                      <span dangerouslySetInnerHTML={{ __html: product.highlights.name[0] }} />
                    ) : (
                      product.name
                    )}
                  </h3>
                  {product.highlights?.description && (
                    <p className="text-sm text-gray-600 mb-2 line-clamp-2"
                       dangerouslySetInnerHTML={{ __html: product.highlights.description[0] }} />
                  )}
                  <div className="flex items-center mb-2">
                    <div className="flex items-center">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`w-4 h-4 ${
                            i < Math.floor(product.rating || 0)
                              ? 'text-yellow-400 fill-current'
                              : 'text-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-sm text-gray-500 ml-2">
                      ({product.reviewCount || 0})
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      {product.salePrice ? (
                        <>
                          <span className="text-sm text-gray-500 line-through">
                            {formatPrice(product.price)}
                          </span>
                          <span className="text-lg font-bold text-red-600 ml-2">
                            {formatPrice(product.salePrice)}
                          </span>
                        </>
                      ) : (
                        <span className="text-lg font-bold">
                          {formatPrice(product.price)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
              <div className="px-4 pb-4">
                <button
                  onClick={() => handleAddToCart(product)}
                  disabled={!product.inStock}
                  className={`w-full py-2 rounded-lg font-medium transition-colors ${
                    product.inStock
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {product.inStock ? (
                    <>
                      <ShoppingCart className="inline-block w-4 h-4 mr-2" />
                      장바구니 담기
                    </>
                  ) : (
                    '품절'
                  )}
                </button>
              </div>
            </>
          ) : (
            <>
              {/* List View */}
              <Link to={`/products/${product.id}`} className="flex-shrink-0">
                <img
                  src={product.images?.[0]?.url || '/placeholder.jpg'}
                  alt={product.name}
                  className="w-32 h-32 object-cover rounded"
                />
              </Link>
              <div className="flex-1 ml-4">
                <Link to={`/products/${product.id}`}>
                  <h3 className="font-semibold text-lg text-gray-800 mb-1">
                    {product.highlights?.name ? (
                      <span dangerouslySetInnerHTML={{ __html: product.highlights.name[0] }} />
                    ) : (
                      product.name
                    )}
                  </h3>
                  {product.highlights?.description && (
                    <p className="text-gray-600 mb-2 line-clamp-2"
                       dangerouslySetInnerHTML={{ __html: product.highlights.description[0] }} />
                  )}
                </Link>
                <div className="flex items-center mb-2">
                  <div className="flex items-center">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`w-4 h-4 ${
                          i < Math.floor(product.rating || 0)
                            ? 'text-yellow-400 fill-current'
                            : 'text-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-sm text-gray-500 ml-2">
                    ({product.reviewCount || 0} 리뷰)
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    {product.salePrice ? (
                      <>
                        <span className="text-gray-500 line-through">
                          {formatPrice(product.price)}
                        </span>
                        <span className="text-xl font-bold text-red-600 ml-2">
                          {formatPrice(product.salePrice)}
                        </span>
                      </>
                    ) : (
                      <span className="text-xl font-bold">
                        {formatPrice(product.price)}
                      </span>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    <button className="p-2 bg-gray-100 rounded hover:bg-gray-200">
                      <Heart className="w-5 h-5 text-gray-600" />
                    </button>
                    <button
                      onClick={() => handleAddToCart(product)}
                      disabled={!product.inStock}
                      className={`px-4 py-2 rounded font-medium transition-colors ${
                        product.inStock
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      {product.inStock ? '장바구니' : '품절'}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
};