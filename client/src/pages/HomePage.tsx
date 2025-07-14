import React from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from 'react-query'
import { productService } from '@/services/productService'
import { ProductCard } from '@/components/products/ProductCard'
import { ArrowRight, Truck, Shield, RefreshCw, CreditCard } from 'lucide-react'

export const HomePage: React.FC = () => {
  // 추천 상품 및 한글 샘플 데이터 조회
  const { data: featuredData } = useQuery(
    'featured-products',
    productService.getFeaturedProducts,
    {
      fallbackData: { data: [] }
    }
  )

  const { data: sampleData } = useQuery(
    'sample-products-korean',
    () => fetch('/api/core/sample/products').then(res => res.json()),
    {
      fallbackData: { data: { products: [] } }
    }
  )

  const { data: categoriesData } = useQuery(
    'categories-korean',
    () => fetch('/api/core/sample/categories').then(res => res.json()),
    {
      fallbackData: { data: { categories: [] } }
    }
  )

  // 추천 상품이 없으면 한글 샘플 데이터 사용
  const featuredProducts = featuredData?.data?.length > 0 
    ? featuredData.data 
    : sampleData?.data?.products || []

  const categories = categoriesData?.data?.categories || []

  return (
    <div>
      {/* Hero Section - 한글화 */}
      <section className="bg-gradient-to-r from-primary-600 to-primary-800 text-white">
        <div className="container py-20">
          <div className="max-w-3xl">
            <h1 className="text-5xl font-bold mb-6">
              🇰🇷 한국 이커머스 플랫폼
            </h1>
            <p className="text-xl mb-8 text-primary-100">
              최고의 상품을 합리적인 가격에 만나보세요. 
              안전한 결제와 빠른 배송으로 편리한 쇼핑을 경험하세요.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link to="/products" className="btn-primary bg-white text-primary-600 hover:bg-gray-100">
                지금 쇼핑하기
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
              <Link to="/deals" className="btn-outline border-white text-white hover:bg-white hover:text-primary-600">
                특가 상품 보기
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features - 한국 특화 서비스 */}
      <section className="py-16 bg-gray-50">
        <div className="container">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="inline-flex p-4 bg-primary-100 rounded-full mb-4">
                <Truck className="h-8 w-8 text-primary-600" />
              </div>
              <h3 className="font-semibold mb-2">무료 배송</h3>
              <p className="text-sm text-gray-600">
                5만원 이상 주문 시<br />
                CJ대한통운, 로젠택배
              </p>
            </div>
            <div className="text-center">
              <div className="inline-flex p-4 bg-primary-100 rounded-full mb-4">
                <Shield className="h-8 w-8 text-primary-600" />
              </div>
              <h3 className="font-semibold mb-2">안전한 결제</h3>
              <p className="text-sm text-gray-600">
                토스페이, 카카오페이<br />
                100% 안전 보장
              </p>
            </div>
            <div className="text-center">
              <div className="inline-flex p-4 bg-primary-100 rounded-full mb-4">
                <RefreshCw className="h-8 w-8 text-primary-600" />
              </div>
              <h3 className="font-semibold mb-2">간편 교환/환불</h3>
              <p className="text-sm text-gray-600">
                30일 무조건 교환<br />
                당일 환불 처리
              </p>
            </div>
            <div className="text-center">
              <div className="inline-flex p-4 bg-primary-100 rounded-full mb-4">
                <CreditCard className="h-8 w-8 text-primary-600" />
              </div>
              <h3 className="font-semibold mb-2">다양한 결제수단</h3>
              <p className="text-sm text-gray-600">
                신용카드, 계좌이체<br />
                포인트, 쿠폰 적립
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Products - 추천 상품 */}
      {featuredProducts.length > 0 && (
        <section className="py-16">
          <div className="container">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-3xl font-bold">🔥 추천 상품</h2>
              <Link
                to="/products?featured=true"
                className="text-primary-600 hover:text-primary-700 flex items-center gap-1"
              >
                전체보기
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {featuredProducts.slice(0, 8).map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Categories - 동적 카테고리 연동 */}
      <section className="py-16 bg-gray-50">
        <div className="container">
          <h2 className="text-3xl font-bold text-center mb-12">
            📂 카테고리별 쇼핑
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {categories.slice(0, 4).map((category) => (
              <Link
                key={category.id}
                to={`/products?category=${category.slug}`}
                className="group relative overflow-hidden rounded-lg aspect-square"
              >
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-black/0 z-10" />
                <img
                  src={`/images/categories/${category.slug}.jpg`}
                  alt={category.name}
                  className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200"
                  onError={(e) => {
                    e.currentTarget.src = `https://via.placeholder.com/400x400?text=${category.name}`
                  }}
                />
                <div className="absolute bottom-4 left-4 right-4 z-20 text-white">
                  <h3 className="text-xl font-semibold">{category.name}</h3>
                  <p className="text-sm opacity-90">{category.count}개 상품</p>
                  <p className="text-xs opacity-75 mt-1">{category.description}</p>
                </div>
              </Link>
            ))}
          </div>
          
          {/* 더 많은 카테고리 */}
          {categories.length > 4 && (
            <div className="text-center mt-8">
              <Link
                to="/categories"
                className="btn-outline border-primary-600 text-primary-600 hover:bg-primary-600 hover:text-white"
              >
                모든 카테고리 보기 ({categories.length}개)
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Newsletter - 한글화 */}
      <section className="py-16 bg-primary-600 text-white">
        <div className="container text-center">
          <h2 className="text-3xl font-bold mb-4">
            📧 뉴스레터 구독
          </h2>
          <p className="text-xl mb-8 text-primary-100">
            뉴스레터 구독하고 첫 주문 시 10% 할인받으세요
          </p>
          <form className="max-w-md mx-auto flex gap-4">
            <input
              type="email"
              placeholder="이메일 주소를 입력하세요"
              className="input flex-1 bg-white text-gray-900"
            />
            <button type="submit" className="btn-primary bg-gray-900 hover:bg-gray-800">
              구독하기
            </button>
          </form>
          <p className="text-sm text-primary-200 mt-4">
            개인정보보호정책에 따라 안전하게 관리됩니다
          </p>
        </div>
      </section>
    </div>
  )
}