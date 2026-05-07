import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import SimulatePage from '@/app/simulate/page'
import { SWRConfig } from 'swr'
import { vi, describe, it, expect } from 'vitest'
import { ZoneProvider } from '@/context/ZoneContext'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/simulate'
}))

const AllProviders = ({ children }: { children: React.ReactNode }) => (
  <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
    <ZoneProvider>
      {children}
    </ZoneProvider>
  </SWRConfig>
)

describe('Simulate page', () => {
  it('renders simulation configuration panel', () => {
    render(<SimulatePage />, { wrapper: AllProviders })
    
    expect(screen.getByText(/Simulation Parameters/i)).toBeInTheDocument()
    expect(screen.getByText(/Run Simulation/i)).toBeInTheDocument()
  })

  it('updates multiplier when slider is moved', () => {
    render(<SimulatePage />, { wrapper: AllProviders })
    
    const slider = screen.getByRole('slider')
    fireEvent.change(slider, { target: { value: '2.5' } })
    
    expect(screen.getByText('2.5x')).toBeInTheDocument()
  })

  it('runs simulation and displays results', async () => {
    render(<SimulatePage />, { wrapper: AllProviders })
    
    const runButton = screen.getByRole('button', { name: /run simulation/i })
    fireEvent.click(runButton)
    
    expect(screen.getByText(/Processing Model/i)).toBeInTheDocument()
    expect(runButton).toBeDisabled()

    await waitFor(() => {
      expect(screen.getByText(/Grid Resilient/i)).toBeInTheDocument()
      expect(screen.getByText(/Grid Stress Comparison/i)).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('shows peak reduction percentage in results', async () => {
    render(<SimulatePage />, { wrapper: AllProviders })
    
    fireEvent.click(screen.getByRole('button', { name: /run simulation/i }))

    await waitFor(() => {
      // 25 + (1.5 * 5) = 32.5 -> rounded to 33%
      expect(screen.getByText(/-33%/i)).toBeInTheDocument()
    }, { timeout: 3000 })
  })
})
