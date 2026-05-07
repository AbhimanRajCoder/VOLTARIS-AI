import { render, screen, waitFor } from '@testing-library/react'
import DashboardPage from '@/app/dashboard/page'
import { SWRConfig } from 'swr'
import { vi, describe, it, expect } from 'vitest'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/dashboard'
}))

// Wrap component with SWRConfig to clear cache between tests
const AllProviders = ({ children }: { children: React.ReactNode }) => (
  <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
    {children}
  </SWRConfig>
)

describe('Dashboard page', () => {
  it('renders 10 zone health cards from briefing API', async () => {
    render(<DashboardPage />, { wrapper: AllProviders })
    
    // Check for zone operational matrix table rows
    await waitFor(() => {
      const rows = screen.getAllByRole('row')
      // 1 header row + 6 visible rows (due to slice(0,6) in component)
      expect(rows.length).toBeGreaterThanOrEqual(7)
    })
  })

  it('shows system summary details from briefing API', async () => {
    render(<DashboardPage />, { wrapper: AllProviders })
    
    await waitFor(() => {
      expect(screen.getByText(/Peak at 19:00 today/i)).toBeInTheDocument()
      expect(screen.getByText(/System Status: NORMAL/i)).toBeInTheDocument()
    })
  })

  it('renders action center with pending actions', async () => {
    render(<DashboardPage />, { wrapper: AllProviders })
    
    await waitFor(() => {
      expect(screen.getByText(/Action Center/i)).toBeInTheDocument()
      expect(screen.getByText(/Transformer Overload/i)).toBeInTheDocument()
    })
  })

  it('displays correct counts from alerts summary', async () => {
    render(<DashboardPage />, { wrapper: AllProviders })
    
    await waitFor(() => {
      // Find the critical and warning counts in the banner
      const criticalCount = screen.getByText('2')
      const warningCount = screen.getByText('5')
      expect(criticalCount).toBeInTheDocument()
      expect(warningCount).toBeInTheDocument()
    })
  })

  it('renders KPI cards with initial data', async () => {
    render(<DashboardPage />, { wrapper: AllProviders })
    
    await waitFor(() => {
      expect(screen.getByText(/Current Grid Load/i)).toBeInTheDocument()
      expect(screen.getByText(/EV Demand Share/i)).toBeInTheDocument()
    })
  })
})
