import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useCartStore } from '@/stores/cartStore'
import { orderService } from '@/services/orderService'
import { CheckoutSteps } from './CheckoutSteps'
import { CheckoutForm } from './CheckoutForm'
import { CheckoutSummary } from './CheckoutSummary'
import { PaymentForm } from './PaymentForm'
import { OrderConfirmation } from './OrderConfirmation'
import { EmptyCart } from '../cart/EmptyCart'
import { Order } from '@/types'
import toast from 'react-hot-toast'

const checkoutSchema = z.object({
  customerEmail: z.string().email('Invalid email address'),
  customerFirstName: z.string().min(1, 'First name is required'),
  customerLastName: z.string().min(1, 'Last name is required'),
  customerPhone: z.string().min(10, 'Valid phone number is required'),
  
  shippingAddress: z.object({
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    company: z.string().optional(),
    addressLine1: z.string().min(1, 'Address is required'),
    addressLine2: z.string().optional(),
    city: z.string().min(1, 'City is required'),
    state: z.string().optional(),
    postalCode: z.string().min(1, 'Postal code is required'),
    country: z.string().min(1, 'Country is required').default('KR'),
    phone: z.string().min(10, 'Valid phone number is required'),
  }),
  
  sameAsShipping: z.boolean().default(true),
  
  billingAddress: z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    company: z.string().optional(),
    addressLine1: z.string().optional(),
    addressLine2: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    postalCode: z.string().optional(),
    country: z.string().optional(),
    phone: z.string().optional(),
  }).optional(),
  
  notes: z.string().optional(),
})

type CheckoutFormData = z.infer<typeof checkoutSchema>

export const Checkout: React.FC = () => {
  const navigate = useNavigate()
  const { cart, fetchCart } = useCartStore()
  const [currentStep, setCurrentStep] = useState(1)
  const [order, setOrder] = useState<Order | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const form = useForm<CheckoutFormData>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      customerEmail: '',
      customerFirstName: '',
      customerLastName: '',
      customerPhone: '',
      shippingAddress: {
        firstName: '',
        lastName: '',
        company: '',
        addressLine1: '',
        addressLine2: '',
        city: '',
        state: '',
        postalCode: '',
        country: 'KR',
        phone: '',
      },
      sameAsShipping: true,
      notes: '',
    },
  })

  useEffect(() => {
    fetchCart()
  }, [fetchCart])

  if (!cart || cart.items.length === 0) {
    return <EmptyCart />
  }

  const handleNextStep = async () => {
    if (currentStep === 1) {
      // Validate shipping information
      const isValid = await form.trigger([
        'customerEmail',
        'customerFirstName',
        'customerLastName',
        'customerPhone',
        'shippingAddress',
      ])
      
      if (isValid) {
        setCurrentStep(2)
      }
    } else if (currentStep === 2) {
      // Create order
      handleCreateOrder()
    }
  }

  const handlePreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleCreateOrder = async () => {
    try {
      setIsProcessing(true)
      
      const formData = form.getValues()
      const checkoutData = {
        ...formData,
        billingAddress: formData.sameAsShipping 
          ? formData.shippingAddress 
          : formData.billingAddress,
      }

      const response = await orderService.createOrder(checkoutData)
      
      if (response.success && response.data) {
        setOrder(response.data)
        setCurrentStep(3)
      }
    } catch (error) {
      toast.error('Failed to create order. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handlePayment = async (paymentMethod: string, paymentDetails?: any) => {
    if (!order) return
    
    try {
      setIsProcessing(true)
      
      const response = await orderService.processPayment(order.id, {
        paymentMethod,
        paymentDetails,
      })
      
      if (response.success && response.data) {
        if (response.data.paymentUrl) {
          // Redirect to payment gateway
          window.location.href = response.data.paymentUrl
        } else {
          // Payment completed
          setOrder(response.data.order)
          setCurrentStep(4)
          
          // Clear cart
          await fetchCart()
        }
      }
    } catch (error) {
      toast.error('Payment failed. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-8">Checkout</h1>

      {/* Steps */}
      <CheckoutSteps currentStep={currentStep} />

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2">
          {currentStep === 1 && (
            <CheckoutForm 
              form={form}
              onNext={handleNextStep}
              isProcessing={isProcessing}
            />
          )}
          
          {currentStep === 2 && order && (
            <PaymentForm
              order={order}
              onPayment={handlePayment}
              onBack={handlePreviousStep}
              isProcessing={isProcessing}
            />
          )}
          
          {currentStep === 3 && (
            <div className="text-center py-12">
              <div className="inline-flex h-16 w-16 animate-spin rounded-full border-4 border-solid border-primary-600 border-r-transparent"></div>
              <p className="mt-4 text-lg">Processing your payment...</p>
            </div>
          )}
          
          {currentStep === 4 && order && (
            <OrderConfirmation order={order} />
          )}
        </div>

        {/* Summary */}
        <div className="lg:col-span-1">
          {currentStep < 4 && (
            <CheckoutSummary cart={cart} />
          )}
        </div>
      </div>
    </div>
  )
}