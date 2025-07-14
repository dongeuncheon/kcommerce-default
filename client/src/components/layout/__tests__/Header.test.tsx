import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@/test/utils'
import { Header } from '../Header'
import { useCartStore } from '@/stores/cartStore'
import { useAuthStore } from '@/stores/authStore'

// Mock stores
vi.mock('@/stores/cartStore')
vi.mock('@/stores/authStore')

describe('Header', () => {
  const mockGetItemCount = vi.fn()
  const mockLogout = vi.fn()

  beforeEach(() => {
    vi.mocked(useCartStore).mockReturnValue({
      getItemCount: mockGetItemCount,
      cart: null,
      isLoading: false,
      error: null,
      fetchCart: vi.fn(),
      addItem: vi.fn(),
      updateItem: vi.fn(),
      removeItem: vi.fn(),
      clearCart: vi.fn(),
      applyCoupon: vi.fn(),
      removeCoupon: vi.fn(),
      getItem: vi.fn(),
    })

    vi.mocked(useAuthStore).mockReturnValue({
      user: null,
      isAuthenticated: false,
      logout: mockLogout,
      login: vi.fn(),
      register: vi.fn(),
      isLoading: false,
      error: null,
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders logo and navigation links', () => {
    render(<Header />)

    expect(screen.getByText('Commerce Store')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /home/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /products/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /categories/i })).toBeInTheDocument()
  })

  it('shows cart item count', () => {
    mockGetItemCount.mockReturnValue(3)
    render(<Header />)

    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /cart/i })).toBeInTheDocument()
  })

  it('hides cart count when empty', () => {
    mockGetItemCount.mockReturnValue(0)
    render(<Header />)

    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })

  it('shows login link when not authenticated', () => {
    render(<Header />)

    expect(screen.getByRole('link', { name: /login/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /logout/i })).not.toBeInTheDocument()
  })

  it('shows user menu when authenticated', () => {
    vi.mocked(useAuthStore).mockReturnValue({
      user: {
        id: '1',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
      },
      isAuthenticated: true,
      logout: mockLogout,
      login: vi.fn(),
      register: vi.fn(),
      isLoading: false,
      error: null,
    })

    render(<Header />)

    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /account/i })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /login/i })).not.toBeInTheDocument()
  })

  it('shows dropdown menu on user button click', () => {
    vi.mocked(useAuthStore).mockReturnValue({
      user: {
        id: '1',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
      },
      isAuthenticated: true,
      logout: mockLogout,
      login: vi.fn(),
      register: vi.fn(),
      isLoading: false,
      error: null,
    })

    render(<Header />)

    const accountButton = screen.getByRole('button', { name: /account/i })
    fireEvent.click(accountButton)

    expect(screen.getByRole('link', { name: /my orders/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /profile/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument()
  })

  it('calls logout when logout button is clicked', () => {
    vi.mocked(useAuthStore).mockReturnValue({
      user: {
        id: '1',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
      },
      isAuthenticated: true,
      logout: mockLogout,
      login: vi.fn(),
      register: vi.fn(),
      isLoading: false,
      error: null,
    })

    render(<Header />)

    const accountButton = screen.getByRole('button', { name: /account/i })
    fireEvent.click(accountButton)

    const logoutButton = screen.getByRole('button', { name: /logout/i })
    fireEvent.click(logoutButton)

    expect(mockLogout).toHaveBeenCalled()
  })

  it('toggles mobile menu', () => {
    render(<Header />)

    const menuButton = screen.getByRole('button', { name: /menu/i })
    fireEvent.click(menuButton)

    // Mobile menu should be visible
    expect(screen.getAllByRole('link', { name: /products/i })).toHaveLength(2) // Desktop and mobile

    // Click again to close
    fireEvent.click(menuButton)
    expect(screen.getAllByRole('link', { name: /products/i })).toHaveLength(1) // Only desktop
  })

  it('shows search bar', () => {
    render(<Header />)

    const searchInput = screen.getByPlaceholderText(/search products/i)
    expect(searchInput).toBeInTheDocument()

    fireEvent.change(searchInput, { target: { value: 'laptop' } })
    fireEvent.submit(searchInput.closest('form')!)

    // Would navigate to search results
    expect(searchInput).toHaveValue('laptop')
  })

  it('navigates to correct routes', () => {
    render(<Header />)

    const links = {
      home: '/',
      products: '/products',
      categories: '/categories',
      cart: '/cart',
      login: '/login',
    }

    Object.entries(links).forEach(([name, path]) => {
      const link = screen.getByRole('link', { name: new RegExp(name, 'i') })
      expect(link).toHaveAttribute('href', path)
    })
  })
})