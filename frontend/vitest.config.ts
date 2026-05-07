import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/__tests__/**', 'src/app/layout.tsx'],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 60,
      }
    }
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') }
  }
})
