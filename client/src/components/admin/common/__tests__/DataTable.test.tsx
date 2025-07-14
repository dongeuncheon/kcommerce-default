import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { createColumnHelper } from '@tanstack/react-table'
import { DataTable } from '../DataTable'

interface TestData {
  id: string
  name: string
  age: number
}

const columnHelper = createColumnHelper<TestData>()

const testColumns = [
  columnHelper.accessor('name', {
    header: 'Name',
  }),
  columnHelper.accessor('age', {
    header: 'Age',
  }),
]

const testData: TestData[] = [
  { id: '1', name: 'John Doe', age: 30 },
  { id: '2', name: 'Jane Smith', age: 25 },
  { id: '3', name: 'Bob Johnson', age: 35 },
]

describe('DataTable', () => {
  it('renders table with data', () => {
    render(<DataTable data={testData} columns={testColumns} />)
    
    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('Jane Smith')).toBeInTheDocument()
    expect(screen.getByText('Bob Johnson')).toBeInTheDocument()
  })

  it('shows loading state', () => {
    render(<DataTable data={[]} columns={testColumns} loading={true} />)
    
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
  })

  it('shows error state', () => {
    const error = 'Failed to load data'
    render(<DataTable data={[]} columns={testColumns} error={error} />)
    
    expect(screen.getByText(error)).toBeInTheDocument()
  })

  it('shows empty message when no data', () => {
    render(<DataTable data={[]} columns={testColumns} />)
    
    expect(screen.getByText('No data available')).toBeInTheDocument()
  })

  it('filters data when search is used', () => {
    render(<DataTable data={testData} columns={testColumns} showSearch={true} />)
    
    const searchInput = screen.getByPlaceholderText('Search...')
    fireEvent.change(searchInput, { target: { value: 'John' } })
    
    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument()
  })

  it('calls onRowClick when row is clicked', () => {
    const onRowClick = jest.fn()
    render(<DataTable data={testData} columns={testColumns} onRowClick={onRowClick} />)
    
    fireEvent.click(screen.getByText('John Doe'))
    
    expect(onRowClick).toHaveBeenCalledWith(testData[0])
  })

  it('shows pagination controls', () => {
    render(<DataTable data={testData} columns={testColumns} showPagination={true} />)
    
    expect(screen.getByText(/Showing/)).toBeInTheDocument()
    expect(screen.getByText(/Page/)).toBeInTheDocument()
  })
})