import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@/test/utils'
import { CheckoutForm } from '../CheckoutForm'
import { useCartStore } from '@/stores/cartStore'
import { useNavigate } from 'react-router-dom'
import { orderService } from '@/services/orderService'

// Mock dependencies
vi.mock('@/stores/cartStore')
vi.mock('react-router-dom', () => ({
  ...vi.importActual('react-router-dom'),
  useNavigate: vi.fn(),
}))
vi.mock('@/services/orderService')
vi.mock('react-hot-toast')

const mockCart = {
  id: '1',
  sessionId: 'session123',
  userId: 'user123',
  items: [
    {
      id: 'item1',
      productId: 'prod1',
      product: {
        id: 'prod1',
        name: 'Test Product',
        price: 50000,
        images: [],
      },
      quantity: 2,
      price: 50000,
      subtotal: 100000,
    },
  ],
  subtotal: 100000,
  shipping: 3000,
  tax: 10300,
  discount: 0,
  total: 113300,
}

describe('CheckoutForm', () => {
  const mockNavigate = vi.fn()
  const mockClearCart = vi.fn()

  beforeEach(() => {
    vi.mocked(useNavigate).mockReturnValue(mockNavigate)
    vi.mocked(useCartStore).mockReturnValue({
      cart: mockCart,
      clearCart: mockClearCart,
      isLoading: false,
      error: null,
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders checkout form fields', () => {
    render(<CheckoutForm />)

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/last name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/phone/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/address/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/city/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/postal code/i)).toBeInTheDocument()
  })

  it('shows validation errors for empty fields', async () => {
    render(<CheckoutForm />)

    const submitButton = screen.getByRole('button', { name: /continue to payment/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/email is required/i)).toBeInTheDocument()
      expect(screen.getByText(/first name is required/i)).toBeInTheDocument()
      expect(screen.getByText(/last name is required/i)).toBeInTheDocument()
    })
  })

  it('validates email format', async () => {
    render(<CheckoutForm />)

    const emailInput = screen.getByLabelText(/email/i)
    fireEvent.change(emailInput, { target: { value: 'invalid-email' } })
    fireEvent.blur(emailInput)

    await waitFor(() => {
      expect(screen.getByText(/invalid email address/i)).toBeInTheDocument()
    })
  })

  it('submits form with valid data', async () => {
    const mockOrderResponse = {
      success: true,
      data: {
        id: 'order123',
        status: 'PENDING',
      },
    }
    vi.mocked(orderService.createOrder).mockResolvedValue(mockOrderResponse)

    render(<CheckoutForm />)

    // Fill in form fields
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@example.com' },
    })
    fireEvent.change(screen.getByLabelText(/first name/i), {
      target: { value: 'John' },
    })
    fireEvent.change(screen.getByLabelText(/last name/i), {
      target: { value: 'Doe' },
    })
    fireEvent.change(screen.getByLabelText(/phone/i), {
      target: { value: '010-1234-5678' },
    })
    fireEvent.change(screen.getByLabelText(/address/i), {
      target: { value: '123 Test St' },
    })
    fireEvent.change(screen.getByLabelText(/city/i), {
      target: { value: 'Seoul' },
    })
    fireEvent.change(screen.getByLabelText(/postal code/i), {
      target: { value: '12345' },
    })

    const submitButton = screen.getByRole('button', { name: /continue to payment/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(orderService.createOrder).toHaveBeenCalledWith({
        customerEmail: 'test@example.com',
        customerFirstName: 'John',
        customerLastName: 'Doe',
        customerPhone: '010-1234-5678',
        shippingAddress: '123 Test St',
        shippingCity: 'Seoul',
        shippingPostalCode: '12345',
        cartId: '1',
      })
    })
  })

  it('navigates to payment after successful order creation', async () => {
    const mockOrderResponse = {
      success: true,
      data: {
        id: 'order123',
        status: 'PENDING',
      },
    }
    vi.mocked(orderService.createOrder).mockResolvedValue(mockOrderResponse)

    render(<CheckoutForm />)

    // Fill in minimum required fields
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@example.com' },
    })
    fireEvent.change(screen.getByLabelText(/first name/i), {
      target: { value: 'John' },
    })
    fireEvent.change(screen.getByLabelText(/last name/i), {
      target: { value: 'Doe' },
    })
    fireEvent.change(screen.getByLabelText(/phone/i), {
      target: { value: '010-1234-5678' },
    })
    fireEvent.change(screen.getByLabelText(/address/i), {
      target: { value: '123 Test St' },
    })
    fireEvent.change(screen.getByLabelText(/city/i), {
      target: { value: 'Seoul' },
    })
    fireEvent.change(screen.getByLabelText(/postal code/i), {
      target: { value: '12345' },
    })

    const submitButton = screen.getByRole('button', { name: /continue to payment/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/checkout/payment', {
        state: { orderId: 'order123' },
      })
    })
  })

  it('shows error message on submission failure', async () => {
    vi.mocked(orderService.createOrder).mockRejectedValue(
      new Error('Failed to create order')
    )

    render(<CheckoutForm />)

    // Fill in form fields
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@example.com' },
    })
    fireEvent.change(screen.getByLabelText(/first name/i), {
      target: { value: 'John' },
    })
    fireEvent.change(screen.getByLabelText(/last name/i), {
      target: { value: 'Doe' },
    })
    fireEvent.change(screen.getByLabelText(/phone/i), {
      target: { value: '010-1234-5678' },
    })
    fireEvent.change(screen.getByLabelText(/address/i), {
      target: { value: '123 Test St' },
    })
    fireEvent.change(screen.getByLabelText(/city/i), {
      target: { value: 'Seoul' },
    })
    fireEvent.change(screen.getByLabelText(/postal code/i), {
      target: { value: '12345' },
    })

    const submitButton = screen.getByRole('button', { name: /continue to payment/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/failed to create order/i)).toBeInTheDocument()
    })
  })

  it('disables submit button during submission', async () => {
    vi.mocked(orderService.createOrder).mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 100))
    )

    render(<CheckoutForm />)

    // Fill in form fields
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@example.com' },
    })
    fireEvent.change(screen.getByLabelText(/first name/i), {
      target: { value: 'John' },
    })
    fireEvent.change(screen.getByLabelText(/last name/i), {
      target: { value: 'Doe' },
    })
    fireEvent.change(screen.getByLabelText(/phone/i), {
      target: { value: '010-1234-5678' },
    })
    fireEvent.change(screen.getByLabelText(/address/i), {
      target: { value: '123 Test St' },
    })
    fireEvent.change(screen.getByLabelText(/city/i), {
      target: { value: 'Seoul' },
    })
    fireEvent.change(screen.getByLabelText(/postal code/i), {
      target: { value: '12345' },
    })

    const submitButton = screen.getByRole('button', { name: /continue to payment/i })
    fireEvent.click(submitButton)

    expect(submitButton).toBeDisabled()
    expect(screen.getByText(/processing/i)).toBeInTheDocument()
  })

  it('redirects to cart if cart is empty', () => {
    vi.mocked(useCartStore).mockReturnValue({
      cart: null,
      clearCart: mockClearCart,
      isLoading: false,
      error: null,
    })

    render(<CheckoutForm />)

    expect(mockNavigate).toHaveBeenCalledWith('/cart')
  })
})