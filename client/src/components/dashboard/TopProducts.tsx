import React from 'react';
import { TrendingUp, Package } from 'lucide-react';

interface TopProduct {
  id: string;
  name: string;
  sales: number;
  revenue: number;
}

interface TopProductsProps {
  products: TopProduct[];
}

export const TopProducts: React.FC<TopProductsProps> = ({ products }) => {
  if (!products || products.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Package className="w-12 h-12 mx-auto mb-2 text-gray-300" />
        <p>판매 데이터가 없습니다</p>
      </div>
    );
  }

  const maxSales = Math.max(...products.map(p => p.sales));

  return (
    <div className="space-y-4">
      {products.slice(0, 10).map((product, index) => (
        <div key={product.id} className="flex items-center space-x-4 p-3 rounded-lg hover:bg-gray-50 transition-colors">
          {/* 순위 */}
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
            index === 0 ? 'bg-yellow-100 text-yellow-800' :
            index === 1 ? 'bg-gray-100 text-gray-800' :
            index === 2 ? 'bg-orange-100 text-orange-800' :
            'bg-blue-100 text-blue-800'
          }`}>
            {index + 1}
          </div>

          {/* 상품 정보 */}
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-gray-900 truncate">
              {product.name}
            </h4>
            <div className="flex items-center justify-between mt-1">
              <div className="flex items-center space-x-4 text-sm text-gray-600">
                <span>판매: {product.sales}개</span>
                <span>매출: ₩{product.revenue.toLocaleString()}</span>
              </div>
            </div>
            
            {/* 진행 바 */}
            <div className="mt-2">
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div 
                  className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${(product.sales / maxSales) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* 트렌드 아이콘 */}
          <div className="flex-shrink-0">
            <TrendingUp className="w-5 h-5 text-green-500" />
          </div>
        </div>
      ))}

      {/* 더보기 링크 */}
      <div className="pt-4 border-t">
        <button className="w-full text-sm text-blue-600 hover:text-blue-800 font-medium">
          모든 상품 성과 보기
        </button>
      </div>
    </div>
  );
};