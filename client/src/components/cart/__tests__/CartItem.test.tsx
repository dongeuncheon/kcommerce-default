import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@/test/utils'
import { CartItem } from '../CartItem'
import { CartItem as CartItemType } from '@/types'
import { useCartStore } from '@/stores/cartStore'

// Mock the cart store
vi.mock('@/stores/cartStore', () => ({
  useCartStore: vi.fn(),
}))

const mockCartItem: CartItemType = {
  id: '1',
  productId: 'prod1',
  product: {
    id: 'prod1',
    name: 'Test Product',
    slug: 'test-product',
    sku: 'TEST-001',
    status: 'PUBLISHED',
    type: 'SIMPLE',
    price: 50000,
    trackQuantity: true,
    quantity: 20,
    lowStockThreshold: 5,
    allowBackorders: false,
    images: [
      {
        id: 'img1',
        url: 'https://example.com/image.jpg',
        alt: 'Test image',
        isPrimary: true,
        sortOrder: 0,
      },
    ],
    createdAt: '2023-01-01',
    updatedAt: '2023-01-01',
  },
  quantity: 2,
  price: 50000,
  subtotal: 100000,
  addedAt: '2023-01-01',
}

describe('CartItem', () => {
  const mockUpdateItem = vi.fn()
  const mockRemoveItem = vi.fn()

  beforeEach(() => {
    vi.mocked(useCartStore).mockReturnValue({
      updateItem: mockUpdateItem,
      removeItem: mockRemoveItem,
      addItem: vi.fn(),
      cart: null,
      isLoading: false,
      error: null,
      fetchCart: vi.fn(),
      clearCart: vi.fn(),
      applyCoupon: vi.fn(),
      removeCoupon: vi.fn(),
      getItemCount: vi.fn(),
      getItem: vi.fn(),
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders cart item information correctly', () => {
    render(<CartItem item={mockCartItem} />)

    expect(screen.getByText('Test Product')).toBeInTheDocument()
    expect(screen.getByText('₩50,000 each')).toBeInTheDocument()
    expect(screen.getByText('₩100,000')).toBeInTheDocument()
    expect(screen.getByDisplayValue('2')).toBeInTheDocument()
  })

  it('increases quantity when plus button is clicked', async () => {
    render(<CartItem item={mockCartItem} />)

    const plusButton = screen.getAllByRole('button')[1] // Second button is plus
    fireEvent.click(plusButton)

    await waitFor(() => {
      expect(mockUpdateItem).toHaveBeenCalledWith('1', 3)
    })
  })

  it('decreases quantity when minus button is clicked', async () => {
    render(<CartItem item={mockCartItem} />)

    const minusButton = screen.getAllByRole('button')[0] // First button is minus
    fireEvent.click(minusButton)

    await waitFor(() => {
      expect(mockUpdateItem).toHaveBeenCalledWith('1', 1)
    })
  })

  it('removes item when quantity becomes 0', async () => {
    const itemWithQuantity1 = { ...mockCartItem, quantity: 1 }
    render(<CartItem item={itemWithQuantity1} />)

    const minusButton = screen.getAllByRole('button')[0]
    fireEvent.click(minusButton)

    await waitFor(() => {
      expect(mockRemoveItem).toHaveBeenCalledWith('1')
    })
  })

  it('removes item when remove button is clicked', async () => {
    render(<CartItem item={mockCartItem} />)

    const removeButton = screen.getAllByRole('button')[2] // Third button is remove
    fireEvent.click(removeButton)

    await waitFor(() => {
      expect(mockRemoveItem).toHaveBeenCalledWith('1')
    })
  })

  it('updates quantity when input value changes', async () => {
    render(<CartItem item={mockCartItem} />)

    const input = screen.getByDisplayValue('2')
    fireEvent.change(input, { target: { value: '5' } })

    await waitFor(() => {
      expect(mockUpdateItem).toHaveBeenCalledWith('1', 5)
    })
  })

  it('shows out of stock message', () => {
    const outOfStockItem = {
      ...mockCartItem,
      product: { ...mockCartItem.product, quantity: 0 },
    }
    render(<CartItem item={outOfStockItem} />)

    expect(screen.getByText('Out of stock')).toBeInTheDocument()
  })

  it('shows low stock warning', () => {
    const lowStockItem = {
      ...mockCartItem,
      product: { ...mockCartItem.product, quantity: 1 },
      quantity: 2,
    }
    render(<CartItem item={lowStockItem} />)

    expect(screen.getByText('Only 1 left in stock')).toBeInTheDocument()
  })

  it('disables buttons when out of stock', () => {
    const outOfStockItem = {
      ...mockCartItem,
      product: { ...mockCartItem.product, quantity: 0 },
    }
    render(<CartItem item={outOfStockItem} />)

    const buttons = screen.getAllByRole('button')
    expect(buttons[0]).toBeDisabled() // Minus button
    expect(buttons[1]).toBeDisabled() // Plus button
  })

  it('renders without image', () => {
    const itemWithoutImage = {
      ...mockCartItem,
      product: { ...mockCartItem.product, images: [] },
    }
    render(<CartItem item={itemWithoutImage} />)

    expect(screen.getByText('No image')).toBeInTheDocument()
  })
})