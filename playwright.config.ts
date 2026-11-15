/**
 * playwright.config.ts: the smoke test (task 16), chromium only.
 * `npm run smoke` builds and serves the app with `vite preview`.
 * Set SMOKE_BASE_URL to test a deployed site instead, e.g.
 *   $env:SMOKE_BASE_URL = 'https://seance-psi.vercel.app'; npm run smoke
 */
import { defineConfig, devices } from '@playwright/test'

const LOCAL = 'http://localhost:4173'
const baseURL = process.env['SMOKE_BASE_URL'] || LOCAL

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 20_000 },
  retries: 0,
  reporter: [['list']],
  use: { baseURL, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // only start a local server when no remote URL is given
  webServer: baseURL === LOCAL
    ? { command: 'npm run build && npx vite preview --port 4173 --strictPort', url: LOCAL, reuseExistingServer: true, timeout: 180_000 }
    : undefined,
})
