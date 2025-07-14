import React, { useState } from 'react'
import { Order } from '@/types'
import { CreditCard, Smartphone, Building2, Wallet, Shield, Lock } from 'lucide-react'

interface PaymentFormProps {
  order: Order
  onPayment: (method: string, details?: any) => void
  onBack: () => void
  isProcessing: boolean
}

const paymentMethods = [
  {
    id: 'STRIPE',
    name: 'Credit/Debit Card',
    icon: CreditCard,
    description: 'Pay securely with your card via Stripe',
  },
  {
    id: 'TOSS_PAYMENTS',
    name: 'Toss Payments',
    icon: Smartphone,
    description: 'Korean payment gateway',
  },
  {
    id: 'PAYPAL',
    name: 'PayPal',
    icon: Wallet,
    description: 'Pay with PayPal account',
  },
  {
    id: 'INICIS',
    name: 'INICIS',
    icon: Building2,
    description: 'Korean payment gateway',
  },
  {
    id: 'KCP',
    name: 'KCP',
    icon: Smartphone,
    description: 'Korean payment gateway',
  },
]

export const PaymentForm: React.FC<PaymentFormProps> = ({
  order,
  onPayment,
  onBack,
  isProcessing,
}) => {
  const [selectedMethod, setSelectedMethod] = useState<string>('STRIPE')
  const [cardDetails, setCardDetails] = useState({
    number: '',
    name: '',
    expiry: '',
    cvv: '',
  })

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
    }).format(price)
  }

  const handlePayment = () => {
    if (selectedMethod === 'STRIPE') {
      // Validate card details
      if (!cardDetails.number || !cardDetails.name || !cardDetails.expiry || !cardDetails.cvv) {
        alert('Please fill in all card details')
        return
      }
    }

    onPayment(selectedMethod, selectedMethod === 'STRIPE' ? cardDetails : undefined)
  }

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '')
    const matches = v.match(/\d{4,16}/g)
    const match = (matches && matches[0]) || ''
    const parts = []

    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4))
    }

    if (parts.length) {
      return parts.join(' ')
    } else {
      return value
    }
  }

  const formatExpiry = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '')
    if (v.length >= 2) {
      return v.slice(0, 2) + (v.length > 2 ? '/' + v.slice(2, 4) : '')
    }
    return v
  }

  return (
    <div className="space-y-6">
      {/* Order Summary */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Order #{order.orderNumber}</h2>
        </div>
        <div className="card-content">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Total Amount</span>
            <span className="text-2xl font-bold text-primary-600">
              {formatPrice(order.total)}
            </span>
          </div>
        </div>
      </div>

      {/* Payment Methods */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Payment Method</h2>
        </div>
        <div className="card-content space-y-3">
          {paymentMethods.map((method) => (
            <label
              key={method.id}
              className={`
                flex items-center gap-4 p-4 rounded-lg border cursor-pointer
                transition-colors
                ${
                  selectedMethod === method.id
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300'
                }
              `}
            >
              <input
                type="radio"
                name="paymentMethod"
                value={method.id}
                checked={selectedMethod === method.id}
                onChange={(e) => setSelectedMethod(e.target.value)}
                className="text-primary-600 focus:ring-primary-500"
              />
              <method.icon className="h-6 w-6 text-gray-600" />
              <div className="flex-1">
                <p className="font-medium">{method.name}</p>
                <p className="text-sm text-gray-600">{method.description}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Card Details */}
      {selectedMethod === 'STRIPE' && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Card Information</h3>
          </div>
          <div className="card-content space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Card Number
              </label>
              <input
                type="text"
                value={cardDetails.number}
                onChange={(e) => setCardDetails({
                  ...cardDetails,
                  number: formatCardNumber(e.target.value)
                })}
                placeholder="1234 5678 9012 3456"
                maxLength={19}
                className="input w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Cardholder Name
              </label>
              <input
                type="text"
                value={cardDetails.name}
                onChange={(e) => setCardDetails({
                  ...cardDetails,
                  name: e.target.value
                })}
                placeholder="John Doe"
                className="input w-full"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Expiry Date
                </label>
                <input
                  type="text"
                  value={cardDetails.expiry}
                  onChange={(e) => setCardDetails({
                    ...cardDetails,
                    expiry: formatExpiry(e.target.value)
                  })}
                  placeholder="MM/YY"
                  maxLength={5}
                  className="input w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  CVV
                </label>
                <input
                  type="text"
                  value={cardDetails.cvv}
                  onChange={(e) => setCardDetails({
                    ...cardDetails,
                    cvv: e.target.value.replace(/\D/g, '').slice(0, 4)
                  })}
                  placeholder="123"
                  maxLength={4}
                  className="input w-full"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Security Notice */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Shield className="h-5 w-5 text-green-600 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900">
              Secure Payment
            </p>
            <p className="text-sm text-gray-600 mt-1">
              Your payment information is encrypted and secure. We never store your card details.
            </p>
            <div className="flex items-center gap-4 mt-2">
              <div className="flex items-center gap-1">
                <Lock className="h-4 w-4 text-gray-400" />
                <span className="text-xs text-gray-600">SSL Encrypted</span>
              </div>
              <span className="text-xs text-gray-600">PCI DSS Compliant</span>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-between">
        <button
          type="button"
          onClick={onBack}
          disabled={isProcessing}
          className="btn-outline"
        >
          Back
        </button>
        <button
          type="button"
          onClick={handlePayment}
          disabled={isProcessing}
          className="btn-primary"
        >
          {isProcessing ? 'Processing...' : `Pay ${formatPrice(order.total)}`}
        </button>
      </div>
    </div>
  )
}