import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@/test/utils'
import { ProductCard } from '../ProductCard'
import { Product } from '@/types'
import { useCartStore } from '@/stores/cartStore'

// Mock the cart store
vi.mock('@/stores/cartStore', () => ({
  useCartStore: vi.fn(),
}))

const mockProduct: Product = {
  id: '1',
  name: 'Test Product',
  slug: 'test-product',
  description: 'Test description',
  shortDescription: 'Short description',
  sku: 'TEST-001',
  status: 'PUBLISHED',
  type: 'SIMPLE',
  price: 99000,
  comparePrice: 120000,
  costPrice: 50000,
  trackQuantity: true,
  quantity: 10,
  lowStockThreshold: 5,
  allowBackorders: false,
  images: [
    {
      id: '1',
      url: 'https://example.com/image.jpg',
      alt: 'Test image',
      isPrimary: true,
      sortOrder: 0,
    },
  ],
  category: {
    id: '1',
    name: 'Test Category',
    slug: 'test-category',
    isActive: true,
    sortOrder: 0,
  },
  metaTitle: 'Test Product',
  metaDescription: 'Test meta description',
  metaKeywords: 'test, product',
  createdAt: '2023-01-01',
  updatedAt: '2023-01-01',
}

describe('ProductCard', () => {
  const mockAddItem = vi.fn()
  const mockGetItem = vi.fn()

  beforeEach(() => {
    vi.mocked(useCartStore).mockReturnValue({
      addItem: mockAddItem,
      getItem: mockGetItem,
      cart: null,
      isLoading: false,
      error: null,
      fetchCart: vi.fn(),
      updateItem: vi.fn(),
      removeItem: vi.fn(),
      clearCart: vi.fn(),
      applyCoupon: vi.fn(),
      removeCoupon: vi.fn(),
      getItemCount: vi.fn(),
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders product information correctly', () => {
    render(<ProductCard product={mockProduct} />)

    expect(screen.getByText('Test Product')).toBeInTheDocument()
    expect(screen.getByText('Short description')).toBeInTheDocument()
    expect(screen.getByText('Test Category')).toBeInTheDocument()
    expect(screen.getByText('₩99,000')).toBeInTheDocument()
    expect(screen.getByText('₩120,000')).toBeInTheDocument()
    expect(screen.getByText('-18%')).toBeInTheDocument()
    expect(screen.getByText('In stock')).toBeInTheDocument()
  })

  it('shows out of stock when quantity is 0', () => {
    const outOfStockProduct = { ...mockProduct, quantity: 0 }
    render(<ProductCard product={outOfStockProduct} />)

    expect(screen.getByText('Out of stock')).toBeInTheDocument()
  })

  it('shows low stock warning', () => {
    const lowStockProduct = { ...mockProduct, quantity: 3 }
    render(<ProductCard product={lowStockProduct} />)

    expect(screen.getByText('Only 3 left in stock')).toBeInTheDocument()
    expect(screen.getByText('Low Stock')).toBeInTheDocument()
  })

  it('calls addItem when add to cart button is clicked', () => {
    render(<ProductCard product={mockProduct} />)

    const addButton = screen.getByRole('button', { name: /cart/i })
    fireEvent.click(addButton)

    expect(mockAddItem).toHaveBeenCalledWith('1')
  })

  it('disables add to cart button when out of stock', () => {
    const outOfStockProduct = { ...mockProduct, quantity: 0 }
    render(<ProductCard product={outOfStockProduct} />)

    const addButton = screen.getByRole('button', { name: /cart/i })
    expect(addButton).toBeDisabled()
  })

  it('shows cart quantity when item is in cart', () => {
    mockGetItem.mockReturnValue({ id: '1', quantity: 2 })
    render(<ProductCard product={mockProduct} />)

    expect(screen.getByText('2 in cart')).toBeInTheDocument()
  })

  it('renders without image', () => {
    const productWithoutImage = { ...mockProduct, images: [] }
    render(<ProductCard product={productWithoutImage} />)

    expect(screen.getByText('No image')).toBeInTheDocument()
  })

  it('navigates to product detail on click', () => {
    render(<ProductCard product={mockProduct} />)

    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/products/test-product')
  })
})