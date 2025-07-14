import React from 'react'
import { UseFormReturn } from 'react-hook-form'
import { Mail, User, Phone, MapPin, Building } from 'lucide-react'

interface CheckoutFormProps {
  form: UseFormReturn<any>
  onNext: () => void
  isProcessing: boolean
}

export const CheckoutForm: React.FC<CheckoutFormProps> = ({
  form,
  onNext,
  isProcessing,
}) => {
  const {
    register,
    formState: { errors },
    watch,
  } = form

  const sameAsShipping = watch('sameAsShipping')

  return (
    <div className="space-y-8">
      {/* Customer Information */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title flex items-center gap-2">
            <User className="h-5 w-5" />
            Customer Information
          </h2>
        </div>
        <div className="card-content space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium mb-1">
                First Name *
              </label>
              <input
                {...register('customerFirstName')}
                className={`input w-full ${errors.customerFirstName ? 'border-red-500' : ''}`}
                placeholder="John"
              />
              {errors.customerFirstName && (
                <p className="mt-1 text-xs text-red-600">
                  {errors.customerFirstName.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Last Name *
              </label>
              <input
                {...register('customerLastName')}
                className={`input w-full ${errors.customerLastName ? 'border-red-500' : ''}`}
                placeholder="Doe"
              />
              {errors.customerLastName && (
                <p className="mt-1 text-xs text-red-600">
                  {errors.customerLastName.message}
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              <Mail className="inline h-4 w-4 mr-1" />
              Email Address *
            </label>
            <input
              {...register('customerEmail')}
              type="email"
              className={`input w-full ${errors.customerEmail ? 'border-red-500' : ''}`}
              placeholder="john@example.com"
            />
            {errors.customerEmail && (
              <p className="mt-1 text-xs text-red-600">
                {errors.customerEmail.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              <Phone className="inline h-4 w-4 mr-1" />
              Phone Number *
            </label>
            <input
              {...register('customerPhone')}
              type="tel"
              className={`input w-full ${errors.customerPhone ? 'border-red-500' : ''}`}
              placeholder="+82 10-1234-5678"
            />
            {errors.customerPhone && (
              <p className="mt-1 text-xs text-red-600">
                {errors.customerPhone.message}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Shipping Address */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Shipping Address
          </h2>
        </div>
        <div className="card-content space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium mb-1">
                First Name *
              </label>
              <input
                {...register('shippingAddress.firstName')}
                className={`input w-full ${errors.shippingAddress?.firstName ? 'border-red-500' : ''}`}
              />
              {errors.shippingAddress?.firstName && (
                <p className="mt-1 text-xs text-red-600">
                  {errors.shippingAddress.firstName.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Last Name *
              </label>
              <input
                {...register('shippingAddress.lastName')}
                className={`input w-full ${errors.shippingAddress?.lastName ? 'border-red-500' : ''}`}
              />
              {errors.shippingAddress?.lastName && (
                <p className="mt-1 text-xs text-red-600">
                  {errors.shippingAddress.lastName.message}
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              <Building className="inline h-4 w-4 mr-1" />
              Company (Optional)
            </label>
            <input
              {...register('shippingAddress.company')}
              className="input w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Address Line 1 *
            </label>
            <input
              {...register('shippingAddress.addressLine1')}
              className={`input w-full ${errors.shippingAddress?.addressLine1 ? 'border-red-500' : ''}`}
              placeholder="123 Main St"
            />
            {errors.shippingAddress?.addressLine1 && (
              <p className="mt-1 text-xs text-red-600">
                {errors.shippingAddress.addressLine1.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Address Line 2 (Optional)
            </label>
            <input
              {...register('shippingAddress.addressLine2')}
              className="input w-full"
              placeholder="Apt 4B"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                City *
              </label>
              <input
                {...register('shippingAddress.city')}
                className={`input w-full ${errors.shippingAddress?.city ? 'border-red-500' : ''}`}
              />
              {errors.shippingAddress?.city && (
                <p className="mt-1 text-xs text-red-600">
                  {errors.shippingAddress.city.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                State/Province
              </label>
              <input
                {...register('shippingAddress.state')}
                className="input w-full"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Postal Code *
              </label>
              <input
                {...register('shippingAddress.postalCode')}
                className={`input w-full ${errors.shippingAddress?.postalCode ? 'border-red-500' : ''}`}
              />
              {errors.shippingAddress?.postalCode && (
                <p className="mt-1 text-xs text-red-600">
                  {errors.shippingAddress.postalCode.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Country *
              </label>
              <select
                {...register('shippingAddress.country')}
                className={`input w-full ${errors.shippingAddress?.country ? 'border-red-500' : ''}`}
              >
                <option value="KR">South Korea</option>
                <option value="US">United States</option>
                <option value="JP">Japan</option>
                <option value="CN">China</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Phone Number *
            </label>
            <input
              {...register('shippingAddress.phone')}
              type="tel"
              className={`input w-full ${errors.shippingAddress?.phone ? 'border-red-500' : ''}`}
            />
            {errors.shippingAddress?.phone && (
              <p className="mt-1 text-xs text-red-600">
                {errors.shippingAddress.phone.message}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Billing Address */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Billing Address</h2>
        </div>
        <div className="card-content">
          <label className="flex items-center gap-2">
            <input
              {...register('sameAsShipping')}
              type="checkbox"
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm font-medium">
              Same as shipping address
            </span>
          </label>

          {!sameAsShipping && (
            <div className="mt-4 space-y-4">
              {/* Billing address fields would go here - similar to shipping */}
              <p className="text-sm text-gray-600">
                Billing address fields would appear here when unchecked
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Notes */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Order Notes (Optional)</h2>
        </div>
        <div className="card-content">
          <textarea
            {...register('notes')}
            rows={3}
            className="input w-full"
            placeholder="Add any special instructions for your order..."
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-between">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="btn-outline"
        >
          Back to Cart
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={isProcessing}
          className="btn-primary"
        >
          Continue to Payment
        </button>
      </div>
    </div>
  )
}