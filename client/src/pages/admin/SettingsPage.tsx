import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Save,
  Globe,
  CreditCard,
  Truck,
  Receipt,
  Mail,
  Users,
  Shield,
  Settings as SettingsIcon,
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { SystemSettings } from '../../types/admin'
import { api } from '../../services/api'

const settingsSchema = z.object({
  general: z.object({
    siteName: z.string().min(1, 'Site name is required'),
    siteUrl: z.string().url('Valid URL is required'),
    adminEmail: z.string().email('Valid email is required'),
    timezone: z.string().min(1, 'Timezone is required'),
    currency: z.string().min(1, 'Currency is required'),
    language: z.string().min(1, 'Language is required'),
  }),
  checkout: z.object({
    guestCheckout: z.boolean(),
    requirePhone: z.boolean(),
    requireCompany: z.boolean(),
    termsRequired: z.boolean(),
  }),
  shipping: z.object({
    freeShippingThreshold: z.number().min(0).optional(),
    defaultShippingRate: z.number().min(0),
    enableCalculator: z.boolean(),
  }),
  tax: z.object({
    enabled: z.boolean(),
    rate: z.number().min(0).max(100),
    includeInPrice: z.boolean(),
  }),
  email: z.object({
    provider: z.string().min(1, 'Email provider is required'),
    fromName: z.string().min(1, 'From name is required'),
    fromEmail: z.string().email('Valid email is required'),
    templates: z.object({
      orderConfirmation: z.boolean(),
      orderShipped: z.boolean(),
      orderCancelled: z.boolean(),
      accountCreated: z.boolean(),
    }),
  }),
})

type SettingsFormData = z.infer<typeof settingsSchema>

const settingsSections = [
  {
    id: 'general',
    label: 'General',
    icon: Globe,
    description: 'Basic site settings and preferences',
  },
  {
    id: 'checkout',
    label: 'Checkout',
    icon: CreditCard,
    description: 'Configure checkout process and requirements',
  },
  {
    id: 'shipping',
    label: 'Shipping',
    icon: Truck,
    description: 'Shipping rates and configuration',
  },
  {
    id: 'tax',
    label: 'Tax',
    icon: Receipt,
    description: 'Tax settings and rates',
  },
  {
    id: 'email',
    label: 'Email',
    icon: Mail,
    description: 'Email provider and template settings',
  },
]

export const SettingsPage: React.FC = () => {
  const queryClient = useQueryClient()
  const [activeSection, setActiveSection] = useState('general')

  // Fetch settings
  const { data: settings, isLoading } = useQuery<SystemSettings>(
    'systemSettings',
    async () => {
      const response = await api.get('/api/admin/settings')
      return response.data.data
    }
  )

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    watch,
    setValue,
  } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    values: settings,
  })

  // Update settings mutation
  const updateMutation = useMutation(
    async (data: SettingsFormData) => {
      await api.put('/api/admin/settings', data)
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('systemSettings')
        toast.success('Settings updated successfully')
      },
      onError: () => {
        toast.error('Failed to update settings')
      },
    }
  )

  const onSubmit = (data: SettingsFormData) => {
    updateMutation.mutate(data)
  }

  const renderGeneralSection = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Site Name
        </label>
        <input
          {...register('general.siteName')}
          type="text"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        {errors.general?.siteName && (
          <p className="text-red-600 text-sm mt-1">{errors.general.siteName.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Site URL
        </label>
        <input
          {...register('general.siteUrl')}
          type="url"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        {errors.general?.siteUrl && (
          <p className="text-red-600 text-sm mt-1">{errors.general.siteUrl.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Admin Email
        </label>
        <input
          {...register('general.adminEmail')}
          type="email"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        {errors.general?.adminEmail && (
          <p className="text-red-600 text-sm mt-1">{errors.general.adminEmail.message}</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Timezone
          </label>
          <select
            {...register('general.timezone')}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="UTC">UTC</option>
            <option value="America/New_York">Eastern Time</option>
            <option value="America/Chicago">Central Time</option>
            <option value="America/Denver">Mountain Time</option>
            <option value="America/Los_Angeles">Pacific Time</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Currency
          </label>
          <select
            {...register('general.currency')}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="USD">USD ($)</option>
            <option value="EUR">EUR (€)</option>
            <option value="GBP">GBP (£)</option>
            <option value="CAD">CAD (C$)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Language
          </label>
          <select
            {...register('general.language')}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="en">English</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
            <option value="de">German</option>
          </select>
        </div>
      </div>
    </div>
  )

  const renderCheckoutSection = () => (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center">
          <input
            {...register('checkout.guestCheckout')}
            type="checkbox"
            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
          />
          <label className="ml-2 block text-sm text-gray-900">
            Allow guest checkout
          </label>
        </div>

        <div className="flex items-center">
          <input
            {...register('checkout.requirePhone')}
            type="checkbox"
            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
          />
          <label className="ml-2 block text-sm text-gray-900">
            Require phone number
          </label>
        </div>

        <div className="flex items-center">
          <input
            {...register('checkout.requireCompany')}
            type="checkbox"
            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
          />
          <label className="ml-2 block text-sm text-gray-900">
            Require company name
          </label>
        </div>

        <div className="flex items-center">
          <input
            {...register('checkout.termsRequired')}
            type="checkbox"
            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
          />
          <label className="ml-2 block text-sm text-gray-900">
            Require terms and conditions acceptance
          </label>
        </div>
      </div>
    </div>
  )

  const renderShippingSection = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Free Shipping Threshold ($)
        </label>
        <input
          {...register('shipping.freeShippingThreshold', { valueAsNumber: true })}
          type="number"
          step="0.01"
          min="0"
          placeholder="Leave empty to disable"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Default Shipping Rate ($)
        </label>
        <input
          {...register('shipping.defaultShippingRate', { valueAsNumber: true })}
          type="number"
          step="0.01"
          min="0"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div className="flex items-center">
        <input
          {...register('shipping.enableCalculator')}
          type="checkbox"
          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
        />
        <label className="ml-2 block text-sm text-gray-900">
          Enable shipping calculator
        </label>
      </div>
    </div>
  )

  const renderTaxSection = () => (
    <div className="space-y-6">
      <div className="flex items-center">
        <input
          {...register('tax.enabled')}
          type="checkbox"
          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
        />
        <label className="ml-2 block text-sm text-gray-900">Enable tax</label>
      </div>

      {watch('tax.enabled') && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tax Rate (%)
            </label>
            <input
              {...register('tax.rate', { valueAsNumber: true })}
              type="number"
              step="0.01"
              min="0"
              max="100"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center">
            <input
              {...register('tax.includeInPrice')}
              type="checkbox"
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
            />
            <label className="ml-2 block text-sm text-gray-900">
              Include tax in product prices
            </label>
          </div>
        </>
      )}
    </div>
  )

  const renderEmailSection = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Email Provider
        </label>
        <select
          {...register('email.provider')}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="smtp">SMTP</option>
          <option value="sendgrid">SendGrid</option>
          <option value="mailgun">Mailgun</option>
          <option value="amazon-ses">Amazon SES</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            From Name
          </label>
          <input
            {...register('email.fromName')}
            type="text"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            From Email
          </label>
          <input
            {...register('email.fromEmail')}
            type="email"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-4">Email Templates</h4>
        <div className="space-y-3">
          <div className="flex items-center">
            <input
              {...register('email.templates.orderConfirmation')}
              type="checkbox"
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
            />
            <label className="ml-2 block text-sm text-gray-900">
              Order confirmation
            </label>
          </div>

          <div className="flex items-center">
            <input
              {...register('email.templates.orderShipped')}
              type="checkbox"
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
            />
            <label className="ml-2 block text-sm text-gray-900">
              Order shipped
            </label>
          </div>

          <div className="flex items-center">
            <input
              {...register('email.templates.orderCancelled')}
              type="checkbox"
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
            />
            <label className="ml-2 block text-sm text-gray-900">
              Order cancelled
            </label>
          </div>

          <div className="flex items-center">
            <input
              {...register('email.templates.accountCreated')}
              type="checkbox"
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
            />
            <label className="ml-2 block text-sm text-gray-900">
              Account created
            </label>
          </div>
        </div>
      </div>
    </div>
  )

  const renderSectionContent = () => {
    switch (activeSection) {
      case 'general':
        return renderGeneralSection()
      case 'checkout':
        return renderCheckoutSection()
      case 'shipping':
        return renderShippingSection()
      case 'tax':
        return renderTaxSection()
      case 'email':
        return renderEmailSection()
      default:
        return null
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-1">
          Configure your store settings and preferences
        </p>
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-64 flex-shrink-0">
          <nav className="space-y-1">
            {settingsSections.map((section) => {
              const Icon = section.icon
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                    activeSection === section.id
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <Icon className="w-5 h-5 mr-3" />
                  {section.label}
                </button>
              )
            })}
          </nav>
        </div>

        {/* Main content */}
        <div className="flex-1">
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">
                  {settingsSections.find((s) => s.id === activeSection)?.label}
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  {settingsSections.find((s) => s.id === activeSection)?.description}
                </p>
              </div>

              <div className="px-6 py-6">{renderSectionContent()}</div>

              {isDirty && (
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-lg">
                  <button
                    type="submit"
                    disabled={updateMutation.isLoading}
                    className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {updateMutation.isLoading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}