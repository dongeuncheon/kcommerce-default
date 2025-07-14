import React from 'react'
import { Link } from 'react-router-dom'
import { Order } from '@/types'
import { CheckCircle, Package, Mail, Download, Printer } from 'lucide-react'

interface OrderConfirmationProps {
  order: Order
}

export const OrderConfirmation: React.FC<OrderConfirmationProps> = ({ order }) => {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
    }).format(price)
  }

  const handlePrint = () => {
    window.print()
  }

  const handleDownloadInvoice = () => {
    // In a real app, this would download a PDF invoice
    console.log('Downloading invoice for order:', order.orderNumber)
  }

  return (
    <div className="space-y-8">
      {/* Success Message */}
      <div className="text-center">
        <div className="mb-4 flex justify-center">
          <div className="rounded-full bg-green-100 p-3">
            <CheckCircle className="h-12 w-12 text-green-600" />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Order Confirmed!
        </h1>
        <p className="text-lg text-gray-600">
          Thank you for your purchase
        </p>
      </div>

      {/* Order Details */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Order Details</h2>
        </div>
        <div className="card-content space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Order Number</p>
              <p className="font-semibold">{order.orderNumber}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Order Date</p>
              <p className="font-semibold">
                {new Date(order.createdAt).toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Amount</p>
              <p className="font-semibold text-primary-600">
                {formatPrice(order.total)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Payment Status</p>
              <p className="font-semibold capitalize">
                {order.paymentStatus.toLowerCase()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Order Items */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title flex items-center gap-2">
            <Package className="h-5 w-5" />
            Order Items
          </h2>
        </div>
        <div className="card-content">
          <div className="space-y-3">
            {order.items.map((item) => (
              <div key={item.id} className="flex justify-between py-2">
                <div>
                  <p className="font-medium">{item.product?.name || 'Product'}</p>
                  <p className="text-sm text-gray-600">
                    Quantity: {item.quantity} × {formatPrice(item.price)}
                  </p>
                </div>
                <p className="font-medium">{formatPrice(item.subtotal)}</p>
              </div>
            ))}
          </div>
          
          <div className="border-t mt-4 pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span>Subtotal</span>
              <span>{formatPrice(order.subtotal)}</span>
            </div>
            {order.shipping > 0 && (
              <div className="flex justify-between text-sm">
                <span>Shipping</span>
                <span>{formatPrice(order.shipping)}</span>
              </div>
            )}
            {order.tax > 0 && (
              <div className="flex justify-between text-sm">
                <span>Tax</span>
                <span>{formatPrice(order.tax)}</span>
              </div>
            )}
            {order.discount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Discount</span>
                <span>-{formatPrice(order.discount)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-lg border-t pt-2">
              <span>Total</span>
              <span className="text-primary-600">{formatPrice(order.total)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Shipping Information */}
      {order.shippingAddress && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Shipping Information</h2>
          </div>
          <div className="card-content">
            <p className="font-medium">
              {order.shippingAddress.firstName} {order.shippingAddress.lastName}
            </p>
            {order.shippingAddress.company && (
              <p className="text-gray-600">{order.shippingAddress.company}</p>
            )}
            <p className="text-gray-600">{order.shippingAddress.addressLine1}</p>
            {order.shippingAddress.addressLine2 && (
              <p className="text-gray-600">{order.shippingAddress.addressLine2}</p>
            )}
            <p className="text-gray-600">
              {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}
            </p>
            <p className="text-gray-600">{order.shippingAddress.country}</p>
            <p className="text-gray-600 mt-2">{order.shippingAddress.phone}</p>
          </div>
        </div>
      )}

      {/* What's Next */}
      <div className="card bg-blue-50 border-blue-200">
        <div className="card-header">
          <h2 className="card-title flex items-center gap-2 text-blue-900">
            <Mail className="h-5 w-5" />
            What's Next?
          </h2>
        </div>
        <div className="card-content">
          <ul className="space-y-2 text-blue-800">
            <li className="flex items-start gap-2">
              <span className="text-blue-600 mt-1">•</span>
              <span>
                You will receive an order confirmation email at{' '}
                <strong>{order.customerEmail}</strong>
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 mt-1">•</span>
              <span>
                We'll send you shipping updates when your order is on its way
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 mt-1">•</span>
              <span>
                You can track your order status in your account dashboard
              </span>
            </li>
          </ul>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-4 justify-center">
        <button
          onClick={handlePrint}
          className="btn-outline flex items-center gap-2"
        >
          <Printer className="h-4 w-4" />
          Print Order
        </button>
        <button
          onClick={handleDownloadInvoice}
          className="btn-outline flex items-center gap-2"
        >
          <Download className="h-4 w-4" />
          Download Invoice
        </button>
        <Link to="/account/orders" className="btn-outline">
          View My Orders
        </Link>
        <Link to="/products" className="btn-primary">
          Continue Shopping
        </Link>
      </div>
    </div>
  )
}