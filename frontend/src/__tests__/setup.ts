import { setupServer } from 'msw/node'
import { handlers } from './handlers'
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { vi, beforeAll, afterEach, afterAll } from 'vitest'
import React from 'react'

export const server = setupServer(...handlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
afterEach(() => {
  server.resetHandlers()
  cleanup()
})
afterAll(() => server.close())

// Mock Leaflet since it depends on DOM APIs not present in jsdom
vi.mock('leaflet', () => ({
  map: vi.fn(() => ({ 
    setView: vi.fn(), 
    remove: vi.fn(), 
    addLayer: vi.fn(), 
    removeLayer: vi.fn(),
    on: vi.fn(),
    flyTo: vi.fn()
  })),
  tileLayer: vi.fn(() => ({ addTo: vi.fn() })),
  circleMarker: vi.fn(() => ({ 
    addTo: vi.fn(), 
    bindPopup: vi.fn(),
    on: vi.fn(),
    setRadius: vi.fn(),
    setStyle: vi.fn(),
    clearLayers: vi.fn()
  })),
  marker: vi.fn(() => ({
    addTo: vi.fn(),
    on: vi.fn()
  })),
  layerGroup: vi.fn(() => ({
    addTo: vi.fn(),
    clearLayers: vi.fn(),
    addLayer: vi.fn()
  })),
  divIcon: vi.fn(() => ({})),
  control: {
    zoom: vi.fn(() => ({ addTo: vi.fn() }))
  },
  DomEvent: {
    stopPropagation: vi.fn()
  }
}))

// Mock Recharts ResponsiveContainer to avoid width/height issues in jsdom
vi.mock('recharts', async (importOriginal) => {
  const actual: any = await importOriginal()
  return {
    ...actual,
    ResponsiveContainer: ({ children }: any) => 
      React.createElement('div', { style: { width: '800px', height: '600px' } }, children),
  }
})

// Mock leaflet.heat
vi.mock('leaflet.heat', () => ({}))
