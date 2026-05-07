import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import AlertsPage from '@/app/alerts/page'
import { SWRConfig } from 'swr'
import { vi, describe, it, expect } from 'vitest'
import { ZoneProvider } from '@/context/ZoneContext'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/alerts'
}))

const AllProviders = ({ children }: { children: React.ReactNode }) => (
  <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
    <ZoneProvider>
      {children}
    </ZoneProvider>
  </SWRConfig>
)

describe('Alerts page', () => {
  it('renders alert feed with items from API', async () => {
    render(<AlertsPage />, { wrapper: AllProviders })
    
    await waitFor(() => {
      expect(screen.getByText(/Transformer Overload Detected/i)).toBeInTheDocument()
      expect(screen.getByText(/High Voltage Fluctuation/i)).toBeInTheDocument()
    })
  })

  it('filters alerts when filter buttons are clicked', async () => {
    render(<AlertsPage />, { wrapper: AllProviders })
    
    await waitFor(() => {
      expect(screen.getByText(/Transformer Overload Detected/i)).toBeInTheDocument()
    })

    const criticalFilter = screen.getByRole('button', { name: /critical/i })
    fireEvent.click(criticalFilter)

    await waitFor(() => {
      expect(screen.getByText(/Transformer Overload Detected/i)).toBeInTheDocument()
      expect(screen.queryByText(/High Voltage Fluctuation/i)).not.toBeInTheDocument()
    })
  })

  it('shows relative time for alerts', async () => {
    render(<AlertsPage />, { wrapper: AllProviders })
    
    await waitFor(() => {
      // 120000ms ago = 2 minutes ago
      expect(screen.getByText(/2 minutes ago/i)).toBeInTheDocument()
    })
  })

  it('calls acknowledge API and updates UI optimistically', async () => {
    render(<AlertsPage />, { wrapper: AllProviders })
    
    await waitFor(() => {
      const ackButton = screen.getAllByRole('button', { name: /acknowledge/i })[0]
      fireEvent.click(ackButton)
    })

    await waitFor(() => {
      expect(screen.getByText(/Acknowledged/i)).toBeInTheDocument()
    })
  })
})
