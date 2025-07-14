import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@/test/utils'
import { MemoryRouter } from 'react-router-dom'
import { Checkout } from '@/pages/Checkout'
import { useCartStore } from '@/stores/cartStore'
import { orderService } from '@/services/orderService'
import { paymentService } from '@/services/paymentService'

// Mock services and stores
vi.mock('@/stores/cartStore')
vi.mock('@/services/orderService')
vi.mock('@/services/paymentService')
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
        images: [{ url: 'test.jpg', alt: 'Test' }],
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

describe('Checkout Integration', () => {
  const mockClearCart = vi.fn()

  beforeEach(() => {
    vi.mocked(useCartStore).mockReturnValue({
      cart: mockCart,
      clearCart: mockClearCart,
      isLoading: false,
      error: null,
      fetchCart: vi.fn(),
      addItem: vi.fn(),
      updateItem: vi.fn(),
      removeItem: vi.fn(),
      applyCoupon: vi.fn(),
      removeCoupon: vi.fn(),
      getItemCount: vi.fn().mockReturnValue(2),
      getItem: vi.fn(),
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('completes full checkout flow', async () => {
    const mockOrderResponse = {
      success: true,
      data: { id: 'order123', status: 'PENDING' },
    }
    const mockPaymentResponse = {
      success: true,
      data: { paymentId: 'payment123', status: 'COMPLETED' },
    }

    vi.mocked(orderService.createOrder).mockResolvedValue(mockOrderResponse)
    vi.mocked(paymentService.processPayment).mockResolvedValue(mockPaymentResponse)

    render(
      <MemoryRouter initialEntries={['/checkout']}>
        <Checkout />
      </MemoryRouter>
    )

    // Verify cart summary is displayed
    expect(screen.getByText('Test Product')).toBeInTheDocument()
    expect(screen.getByText('₩113,300')).toBeInTheDocument()

    // Fill out customer information
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

    // Submit checkout form
    const continueButton = screen.getByRole('button', { name: /continue to payment/i })
    fireEvent.click(continueButton)

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

    // Payment form should be shown next
    await waitFor(() => {
      expect(screen.getByText(/payment method/i)).toBeInTheDocument()
    })

    // Select credit card payment
    const creditCardRadio = screen.getByLabelText(/credit card/i)
    fireEvent.click(creditCardRadio)

    // Fill credit card details
    fireEvent.change(screen.getByLabelText(/card number/i), {
      target: { value: '4111111111111111' },
    })
    fireEvent.change(screen.getByLabelText(/expiry date/i), {
      target: { value: '12/25' },
    })
    fireEvent.change(screen.getByLabelText(/cvv/i), {
      target: { value: '123' },
    })
    fireEvent.change(screen.getByLabelText(/cardholder name/i), {
      target: { value: 'John Doe' },
    })

    // Submit payment
    const paymentButton = screen.getByRole('button', { name: /complete payment/i })
    fireEvent.click(paymentButton)

    await waitFor(() => {
      expect(paymentService.processPayment).toHaveBeenCalledWith({
        orderId: 'order123',
        gateway: 'STRIPE',
        method: 'CREDIT_CARD',
        cardNumber: '4111111111111111',
        expiryDate: '12/25',
        cvv: '123',
        cardholderName: 'John Doe',
      })
    })

    // Cart should be cleared after successful payment
    await waitFor(() => {
      expect(mockClearCart).toHaveBeenCalled()
    })

    // Should navigate to order confirmation
    await waitFor(() => {
      expect(screen.getByText(/order confirmed/i)).toBeInTheDocument()
    })
  })

  it('handles validation errors during checkout', async () => {
    render(
      <MemoryRouter initialEntries={['/checkout']}>
        <Checkout />
      </MemoryRouter>
    )

    // Try to submit without filling required fields
    const continueButton = screen.getByRole('button', { name: /continue to payment/i })
    fireEvent.click(continueButton)

    await waitFor(() => {
      expect(screen.getByText(/email is required/i)).toBeInTheDocument()
      expect(screen.getByText(/first name is required/i)).toBeInTheDocument()
      expect(screen.getByText(/last name is required/i)).toBeInTheDocument()
    })

    // Order should not be created
    expect(orderService.createOrder).not.toHaveBeenCalled()
  })

  it('handles order creation failure', async () => {
    vi.mocked(orderService.createOrder).mockRejectedValue(
      new Error('Order creation failed')
    )

    render(
      <MemoryRouter initialEntries={['/checkout']}>
        <Checkout />
      </MemoryRouter>
    )

    // Fill required fields
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

    const continueButton = screen.getByRole('button', { name: /continue to payment/i })
    fireEvent.click(continueButton)

    await waitFor(() => {
      expect(screen.getByText(/order creation failed/i)).toBeInTheDocument()
    })
  })

  it('handles payment failure', async () => {
    const mockOrderResponse = {
      success: true,
      data: { id: 'order123', status: 'PENDING' },
    }
    vi.mocked(orderService.createOrder).mockResolvedValue(mockOrderResponse)
    vi.mocked(paymentService.processPayment).mockRejectedValue(
      new Error('Payment failed')
    )

    render(
      <MemoryRouter initialEntries={['/checkout/payment']}>
        <Checkout />
      </MemoryRouter>
    )

    // Mock location state for payment step
    vi.mocked(useLocation).mockReturnValue({
      state: { orderId: 'order123' },
    })

    // Select PayPal for simpler test
    const paypalRadio = screen.getByLabelText(/paypal/i)
    fireEvent.click(paypalRadio)

    const paymentButton = screen.getByRole('button', { name: /complete payment/i })
    fireEvent.click(paymentButton)

    await waitFor(() => {
      expect(screen.getByText(/payment failed/i)).toBeInTheDocument()
    })

    // Cart should not be cleared on payment failure
    expect(mockClearCart).not.toHaveBeenCalled()
  })

  it('redirects to cart when cart is empty', () => {
    vi.mocked(useCartStore).mockReturnValue({
      cart: null,
      clearCart: mockClearCart,
      isLoading: false,
      error: null,
      fetchCart: vi.fn(),
      addItem: vi.fn(),
      updateItem: vi.fn(),
      removeItem: vi.fn(),
      applyCoupon: vi.fn(),
      removeCoupon: vi.fn(),
      getItemCount: vi.fn().mockReturnValue(0),
      getItem: vi.fn(),
    })

    const { container } = render(
      <MemoryRouter initialEntries={['/checkout']}>
        <Checkout />
      </MemoryRouter>
    )

    // Should redirect to cart, so checkout form shouldn't be rendered
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument()
  })
})