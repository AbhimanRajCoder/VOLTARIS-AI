import { render, screen, waitFor } from '@testing-library/react'
import SchedulerPage from '@/app/scheduler/page'
import { SWRConfig } from 'swr'
import { vi, describe, it, expect } from 'vitest'
import { ZoneProvider } from '@/context/ZoneContext'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/scheduler'
}))

const AllProviders = ({ children }: { children: React.ReactNode }) => (
  <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
    <ZoneProvider>
      {children}
    </ZoneProvider>
  </SWRConfig>
)

describe('Scheduler page', () => {
  it('renders load profile comparison chart', async () => {
    render(<SchedulerPage />, { wrapper: AllProviders })
    
    await waitFor(() => {
      expect(screen.getByText(/Load Profile Comparison/i)).toBeInTheDocument()
    })
  })

  it('renders heatmap with correct zone labels', async () => {
    render(<SchedulerPage />, { wrapper: AllProviders })
    
    await waitFor(() => {
      expect(screen.getByText(/Grid Network Schedule Heatmap/i)).toBeInTheDocument()
      // Zone labels Z01-Z10 should be present
      expect(screen.getByText('Z01')).toBeInTheDocument()
    })
  })

  it('shows peak reduction summary badge', async () => {
    render(<SchedulerPage />, { wrapper: AllProviders })
    
    await waitFor(() => {
      expect(screen.getByText(/Peak reduced by 121kW/i)).toBeInTheDocument()
      expect(screen.getByText(/15.2%/i)).toBeInTheDocument()
    })
  })

  it('renders intervention recommendations in sidebar', async () => {
    render(<SchedulerPage />, { wrapper: AllProviders })
    
    await waitFor(() => {
      expect(screen.getByText(/Interventions/i)).toBeInTheDocument()
      expect(screen.getAllByText(/Defer Charging/i).length).toBeGreaterThan(0)
    })
  })
})
