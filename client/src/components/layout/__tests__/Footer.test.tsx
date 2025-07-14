import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/utils'
import { Footer } from '../Footer'

describe('Footer', () => {
  it('renders company information', () => {
    render(<Footer />)

    expect(screen.getByText('Commerce Store')).toBeInTheDocument()
    expect(screen.getByText(/your trusted e-commerce platform/i)).toBeInTheDocument()
  })

  it('renders quick links section', () => {
    render(<Footer />)

    expect(screen.getByText('Quick Links')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /about us/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /contact/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /faq/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /shipping/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /returns/i })).toBeInTheDocument()
  })

  it('renders customer service section', () => {
    render(<Footer />)

    expect(screen.getByText('Customer Service')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /help center/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /track order/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /size guide/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /gift cards/i })).toBeInTheDocument()
  })

  it('renders legal section', () => {
    render(<Footer />)

    expect(screen.getByText('Legal')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /privacy policy/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /terms of service/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /cookie policy/i })).toBeInTheDocument()
  })

  it('renders contact information', () => {
    render(<Footer />)

    expect(screen.getByText('Contact Us')).toBeInTheDocument()
    expect(screen.getByText(/1234 commerce street/i)).toBeInTheDocument()
    expect(screen.getByText(/seoul, south korea/i)).toBeInTheDocument()
    expect(screen.getByText(/\+82 2-1234-5678/i)).toBeInTheDocument()
    expect(screen.getByText(/support@commercestore.com/i)).toBeInTheDocument()
  })

  it('renders social media links', () => {
    render(<Footer />)

    expect(screen.getByText('Follow Us')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /facebook/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /twitter/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /instagram/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /youtube/i })).toBeInTheDocument()
  })

  it('renders newsletter subscription', () => {
    render(<Footer />)

    expect(screen.getByText('Newsletter')).toBeInTheDocument()
    expect(screen.getByText(/subscribe to get updates/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/enter your email/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /subscribe/i })).toBeInTheDocument()
  })

  it('renders payment methods', () => {
    render(<Footer />)

    expect(screen.getByText('Accepted Payments')).toBeInTheDocument()
    expect(screen.getByAltText(/visa/i)).toBeInTheDocument()
    expect(screen.getByAltText(/mastercard/i)).toBeInTheDocument()
    expect(screen.getByAltText(/paypal/i)).toBeInTheDocument()
  })

  it('renders copyright notice', () => {
    render(<Footer />)

    const currentYear = new Date().getFullYear()
    expect(screen.getByText(new RegExp(`© ${currentYear}`, 'i'))).toBeInTheDocument()
    expect(screen.getByText(/all rights reserved/i)).toBeInTheDocument()
  })

  it('has correct link destinations', () => {
    render(<Footer />)

    const links = {
      'About Us': '/about',
      'Contact': '/contact',
      'FAQ': '/faq',
      'Help Center': '/help',
      'Privacy Policy': '/privacy',
      'Terms of Service': '/terms',
    }

    Object.entries(links).forEach(([text, href]) => {
      const link = screen.getByRole('link', { name: new RegExp(text, 'i') })
      expect(link).toHaveAttribute('href', href)
    })
  })

  it('has external social media links', () => {
    render(<Footer />)

    const socialLinks = screen.getAllByRole('link').filter(link => 
      link.getAttribute('href')?.includes('facebook') ||
      link.getAttribute('href')?.includes('twitter') ||
      link.getAttribute('href')?.includes('instagram') ||
      link.getAttribute('href')?.includes('youtube')
    )

    socialLinks.forEach(link => {
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    })
  })
})