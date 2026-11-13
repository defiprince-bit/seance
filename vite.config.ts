/// <reference types="vitest" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { devApi } from './server/devApi.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), devApi()],
  // @ts-expect-error vitest augments UserConfig; triple-slash reference above provides types
  test: {
    environment: 'jsdom',
    globals: true,
    include: [
      'tests/**/*.test.ts',
      'tests/**/*.test.tsx',
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
    ],
  },
})
