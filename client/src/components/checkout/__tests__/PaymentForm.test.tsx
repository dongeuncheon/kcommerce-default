import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@/test/utils'
import { PaymentForm } from '../PaymentForm'
import { useLocation, useNavigate } from 'react-router-dom'
import { paymentService } from '@/services/paymentService'
import { useCartStore } from '@/stores/cartStore'

// Mock dependencies
vi.mock('react-router-dom', () => ({
  ...vi.importActual('react-router-dom'),
  useLocation: vi.fn(),
  useNavigate: vi.fn(),
}))
vi.mock('@/services/paymentService')
vi.mock('@/stores/cartStore')
vi.mock('react-hot-toast')

describe('PaymentForm', () => {
  const mockNavigate = vi.fn()
  const mockClearCart = vi.fn()
  const mockLocation = {
    state: { orderId: 'order123' },
  }

  beforeEach(() => {
    vi.mocked(useNavigate).mockReturnValue(mockNavigate)
    vi.mocked(useLocation).mockReturnValue(mockLocation)
    vi.mocked(useCartStore).mockReturnValue({
      clearCart: mockClearCart,
      cart: null,
      isLoading: false,
      error: null,
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders payment method options', () => {
    render(<PaymentForm />)

    expect(screen.getByLabelText(/credit card/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/paypal/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/toss payments/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/kakao pay/i)).toBeInTheDocument()
  })

  it('shows credit card fields when credit card is selected', () => {
    render(<PaymentForm />)

    const creditCardRadio = screen.getByLabelText(/credit card/i)
    fireEvent.click(creditCardRadio)

    expect(screen.getByLabelText(/card number/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/expiry date/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/cvv/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/cardholder name/i)).toBeInTheDocument()
  })

  it('validates credit card number', async () => {
    render(<PaymentForm />)

    const creditCardRadio = screen.getByLabelText(/credit card/i)
    fireEvent.click(creditCardRadio)

    const cardNumberInput = screen.getByLabelText(/card number/i)
    fireEvent.change(cardNumberInput, { target: { value: '1234' } })
    fireEvent.blur(cardNumberInput)

    await waitFor(() => {
      expect(screen.getByText(/card number must be 16 digits/i)).toBeInTheDocument()
    })
  })

  it('validates expiry date format', async () => {
    render(<PaymentForm />)

    const creditCardRadio = screen.getByLabelText(/credit card/i)
    fireEvent.click(creditCardRadio)

    const expiryInput = screen.getByLabelText(/expiry date/i)
    fireEvent.change(expiryInput, { target: { value: '13/25' } })
    fireEvent.blur(expiryInput)

    await waitFor(() => {
      expect(screen.getByText(/invalid expiry date/i)).toBeInTheDocument()
    })
  })

  it('validates CVV', async () => {
    render(<PaymentForm />)

    const creditCardRadio = screen.getByLabelText(/credit card/i)
    fireEvent.click(creditCardRadio)

    const cvvInput = screen.getByLabelText(/cvv/i)
    fireEvent.change(cvvInput, { target: { value: '12' } })
    fireEvent.blur(cvvInput)

    await waitFor(() => {
      expect(screen.getByText(/cvv must be 3 or 4 digits/i)).toBeInTheDocument()
    })
  })

  it('processes credit card payment successfully', async () => {
    const mockPaymentResponse = {
      success: true,
      data: {
        paymentId: 'payment123',
        status: 'COMPLETED',
      },
    }
    vi.mocked(paymentService.processPayment).mockResolvedValue(mockPaymentResponse)

    render(<PaymentForm />)

    // Select credit card
    const creditCardRadio = screen.getByLabelText(/credit card/i)
    fireEvent.click(creditCardRadio)

    // Fill in card details
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

    const submitButton = screen.getByRole('button', { name: /complete payment/i })
    fireEvent.click(submitButton)

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
      expect(mockClearCart).toHaveBeenCalled()
      expect(mockNavigate).toHaveBeenCalledWith('/order-confirmation', {
        state: { orderId: 'order123', paymentId: 'payment123' },
      })
    })
  })

  it('processes PayPal payment', async () => {
    const mockPaymentResponse = {
      success: true,
      data: {
        paymentId: 'payment123',
        status: 'COMPLETED',
      },
    }
    vi.mocked(paymentService.processPayment).mockResolvedValue(mockPaymentResponse)

    render(<PaymentForm />)

    const paypalRadio = screen.getByLabelText(/paypal/i)
    fireEvent.click(paypalRadio)

    const submitButton = screen.getByRole('button', { name: /complete payment/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(paymentService.processPayment).toHaveBeenCalledWith({
        orderId: 'order123',
        gateway: 'PAYPAL',
        method: 'PAYPAL',
      })
    })
  })

  it('processes Toss Payments', async () => {
    const mockPaymentResponse = {
      success: true,
      data: {
        paymentId: 'payment123',
        status: 'COMPLETED',
      },
    }
    vi.mocked(paymentService.processPayment).mockResolvedValue(mockPaymentResponse)

    render(<PaymentForm />)

    const tossRadio = screen.getByLabelText(/toss payments/i)
    fireEvent.click(tossRadio)

    const submitButton = screen.getByRole('button', { name: /complete payment/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(paymentService.processPayment).toHaveBeenCalledWith({
        orderId: 'order123',
        gateway: 'TOSS_PAYMENTS',
        method: 'TOSS_PAYMENTS',
      })
    })
  })

  it('shows error message on payment failure', async () => {
    vi.mocked(paymentService.processPayment).mockRejectedValue(
      new Error('Payment failed')
    )

    render(<PaymentForm />)

    const creditCardRadio = screen.getByLabelText(/credit card/i)
    fireEvent.click(creditCardRadio)

    // Fill in card details
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

    const submitButton = screen.getByRole('button', { name: /complete payment/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/payment failed/i)).toBeInTheDocument()
    })
  })

  it('disables submit button during payment processing', async () => {
    vi.mocked(paymentService.processPayment).mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 100))
    )

    render(<PaymentForm />)

    const paypalRadio = screen.getByLabelText(/paypal/i)
    fireEvent.click(paypalRadio)

    const submitButton = screen.getByRole('button', { name: /complete payment/i })
    fireEvent.click(submitButton)

    expect(submitButton).toBeDisabled()
    expect(screen.getByText(/processing payment/i)).toBeInTheDocument()
  })

  it('redirects to checkout if no order ID', () => {
    vi.mocked(useLocation).mockReturnValue({ state: null })

    render(<PaymentForm />)

    expect(mockNavigate).toHaveBeenCalledWith('/checkout')
  })

  it('shows payment method descriptions', () => {
    render(<PaymentForm />)

    expect(screen.getByText(/pay with visa, mastercard/i)).toBeInTheDocument()
    expect(screen.getByText(/fast and secure payment with paypal/i)).toBeInTheDocument()
    expect(screen.getByText(/popular korean payment method/i)).toBeInTheDocument()
    expect(screen.getByText(/pay with kakao/i)).toBeInTheDocument()
  })
})