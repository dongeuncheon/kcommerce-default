# Admin Panel Components

This directory contains all the React components for the comprehensive admin dashboard of the commerce plugin.

## Structure

```
admin/
├── layout/
│   └── AdminLayout.tsx          # Main admin layout with sidebar and navigation
├── common/
│   ├── AdminGuard.tsx           # Authentication and authorization guard
│   ├── DataTable.tsx            # Reusable data table with sorting, filtering, pagination
│   └── __tests__/               # Component tests
└── README.md                    # This file
```

## Pages

The admin pages are located in `/src/pages/admin/`:

- **DashboardPage.tsx** - Main dashboard with metrics and charts
- **ProductsPage.tsx** - Product management with CRUD operations
- **OrdersPage.tsx** - Order management and status updates
- **CustomersPage.tsx** - Customer management and communication
- **InventoryPage.tsx** - Stock management and adjustments
- **AnalyticsPage.tsx** - Sales analytics and reporting
- **SettingsPage.tsx** - System configuration and settings

## Key Features

### 1. AdminLayout Component
- Responsive sidebar navigation
- User profile dropdown
- Notifications system
- Search functionality
- Mobile-friendly design

### 2. DataTable Component
- Sortable columns
- Global search and filtering
- Pagination
- Row selection
- Bulk actions
- Loading and error states
- Responsive design

### 3. Authentication & Authorization
- Role-based access control
- Permission checking
- Redirect to login for unauthenticated users
- Access denied page for insufficient permissions

### 4. Dashboard Features
- Key performance metrics
- Revenue and sales charts
- Order status distribution
- Top products list
- Recent activity feed
- Real-time data updates

### 5. Product Management
- Product CRUD operations
- Bulk actions (publish, archive, delete)
- Image management
- Stock monitoring
- Category organization
- SEO optimization

### 6. Order Management
- Order status updates
- Payment tracking
- Fulfillment management
- Customer communication
- Invoice generation
- Shipping integration

### 7. Customer Management
- Customer profiles
- Order history
- Communication tools
- Segmentation
- Activity tracking
- Bulk email campaigns

### 8. Inventory Management
- Stock level monitoring
- Low stock alerts
- Stock adjustments
- Reorder management
- Turnover analysis
- Audit trail

### 9. Analytics & Reporting
- Sales performance charts
- Product analytics
- Customer insights
- Conversion funnels
- Export functionality
- Date range filtering

### 10. Settings Management
- General store settings
- Checkout configuration
- Shipping settings
- Tax configuration
- Email templates
- User management

## Technical Implementation

### Dependencies
- **React Router** - Navigation and routing
- **React Query** - Data fetching and caching
- **React Hook Form** - Form management
- **Zod** - Schema validation
- **Tailwind CSS** - Styling
- **Recharts** - Charts and graphs
- **TanStack Table** - Advanced table functionality
- **Radix UI** - Accessible UI components
- **React Hot Toast** - Notifications
- **Lucide React** - Icons

### State Management
- **Zustand** - Global state (auth, cart)
- **React Query** - Server state management
- **React Hook Form** - Form state

### Data Flow
1. Components use React Query for data fetching
2. Mutations update server state and invalidate cache
3. Real-time updates via WebSocket connections
4. Optimistic updates for better UX

### Authentication Flow
1. User accesses admin route
2. AdminGuard checks authentication status
3. Redirects to login if not authenticated
4. Checks user role and permissions
5. Renders admin content or access denied

### Error Handling
- Global error boundaries
- API error handling
- Form validation errors
- Network error recovery
- User-friendly error messages

## Usage Examples

### Basic DataTable
```tsx
import { DataTable } from '../components/admin/common/DataTable'
import { createColumnHelper } from '@tanstack/react-table'

const columnHelper = createColumnHelper<Product>()
const columns = [
  columnHelper.accessor('name', { header: 'Product Name' }),
  columnHelper.accessor('price', { 
    header: 'Price',
    cell: info => `$${info.getValue().toFixed(2)}`
  }),
]

<DataTable 
  data={products}
  columns={columns}
  loading={isLoading}
  searchPlaceholder="Search products..."
  onRowClick={handleRowClick}
/>
```

### Protected Admin Route
```tsx
import { AdminGuard } from '../components/admin/common/AdminGuard'

<AdminGuard requiredRole="ADMIN">
  <AdminLayout>
    <ProductsPage />
  </AdminLayout>
</AdminGuard>
```

### Analytics Chart
```tsx
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

<ResponsiveContainer width="100%" height={400}>
  <LineChart data={salesData}>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis dataKey="date" />
    <YAxis />
    <Tooltip />
    <Line type="monotone" dataKey="revenue" stroke="#6366f1" />
  </LineChart>
</ResponsiveContainer>
```

## Performance Considerations

- **Code Splitting** - Admin routes are lazy loaded
- **Data Caching** - React Query caches API responses
- **Virtual Scrolling** - For large data tables
- **Image Optimization** - Lazy loading and compression
- **Bundle Optimization** - Tree shaking and minification

## Security Features

- **Role-based Access Control** - Admin/Super Admin roles
- **Permission System** - Granular permissions
- **CSRF Protection** - Token-based security
- **Input Validation** - Client and server-side validation
- **Audit Logging** - Track admin actions

## Testing

- **Unit Tests** - Component testing with Jest/React Testing Library
- **Integration Tests** - API integration testing
- **E2E Tests** - Full workflow testing
- **Accessibility Tests** - Screen reader compatibility

## Future Enhancements

- Multi-language support
- Advanced filtering and search
- Custom dashboard widgets
- Workflow automation
- Advanced reporting
- Mobile admin app
- API rate limiting dashboard
- Performance monitoring