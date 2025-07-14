// Admin-specific types
export interface AdminUser extends User {
  permissions?: string[]
  lastLoginAt?: string
  loginCount?: number
}

export interface DashboardMetrics {
  revenue: {
    total: number
    today: number
    thisWeek: number
    thisMonth: number
    growth: number
  }
  orders: {
    total: number
    pending: number
    processing: number
    completed: number
    cancelled: number
  }
  customers: {
    total: number
    new: number
    returning: number
    growth: number
  }
  products: {
    total: number
    active: number
    lowStock: number
    outOfStock: number
  }
}

export interface SalesData {
  date: string
  revenue: number
  orders: number
  customers: number
}

export interface TopProduct {
  id: string
  name: string
  sales: number
  revenue: number
  quantity: number
}

export interface CustomerActivity {
  id: string
  customerId: string
  customerName: string
  customerEmail: string
  action: string
  details?: string
  createdAt: string
}

export interface SystemSettings {
  general: {
    siteName: string
    siteUrl: string
    adminEmail: string
    timezone: string
    currency: string
    language: string
  }
  checkout: {
    guestCheckout: boolean
    requirePhone: boolean
    requireCompany: boolean
    termsRequired: boolean
  }
  shipping: {
    freeShippingThreshold?: number
    defaultShippingRate: number
    enableCalculator: boolean
  }
  tax: {
    enabled: boolean
    rate: number
    includeInPrice: boolean
  }
  email: {
    provider: string
    fromName: string
    fromEmail: string
    templates: {
      orderConfirmation: boolean
      orderShipped: boolean
      orderCancelled: boolean
      accountCreated: boolean
    }
  }
}

export interface AdminRoute {
  path: string
  label: string
  icon: string
  permission?: string
  children?: AdminRoute[]
}

export interface DataTableColumn<T> {
  key: keyof T | string
  label: string
  sortable?: boolean
  render?: (value: any, row: T) => React.ReactNode
  width?: string
  align?: 'left' | 'center' | 'right'
}

export interface DataTableProps<T> {
  data: T[]
  columns: DataTableColumn<T>[]
  loading?: boolean
  error?: string
  onSort?: (key: string, order: 'asc' | 'desc') => void
  onRowClick?: (row: T) => void
  onSelect?: (selectedRows: T[]) => void
  actions?: React.ReactNode
  pagination?: {
    page: number
    limit: number
    total: number
    onChange: (page: number) => void
  }
}

// Re-export common types
export * from './index'