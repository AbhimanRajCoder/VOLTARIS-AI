import { render, screen, waitFor } from '@testing-library/react'
import InfraMapPage from '@/app/infra-map/page'
import { SWRConfig } from 'swr'
import { vi, describe, it, expect } from 'vitest'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/infra-map'
}))

// Mock ZoneContext
vi.mock('@/context/ZoneContext', () => ({
  useZone: () => ({ selectedZone: 'Z01' })
}))

const AllProviders = ({ children }: { children: React.ReactNode }) => (
  <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
    {children}
  </SWRConfig>
)

describe('Infrastructure map page', () => {
  it('renders site ranking list from API', async () => {
    render(<InfraMapPage />, { wrapper: AllProviders })
    
    await waitFor(() => {
      expect(screen.getByText(/Top Candidates/i)).toBeInTheDocument()
      expect(screen.getByText(/Ward 1/i)).toBeInTheDocument()
    })
  })

  it('displays scores as percentages in the list', async () => {
    render(<InfraMapPage />, { wrapper: AllProviders })
    
    await waitFor(() => {
      // 0.85 -> 85%
      expect(screen.getByText('85%')).toBeInTheDocument()
    })
  })

  it('shows site detail when a site is clicked', async () => {
    render(<InfraMapPage />, { wrapper: AllProviders })
    
    await waitFor(async () => {
      const siteItem = screen.getByText(/Ward 1/i)
      siteItem.click()
      
      expect(screen.getByText(/Score Breakdown/i)).toBeInTheDocument()
      expect(screen.getByText(/Nearest Transformer/i)).toBeInTheDocument()
    })
  })

  it('renders map controls', async () => {
    render(<InfraMapPage />, { wrapper: AllProviders })
    
    await waitFor(() => {
      expect(screen.getByText(/Map Layers/i)).toBeInTheDocument()
      expect(screen.getByText(/Demand Density/i)).toBeInTheDocument()
    })
  })
})
