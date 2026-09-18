import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end, kept to a thin layer: the handful of flows where a break is invisible to unit
 * tests. The grid is one of them -- row heights, autosaving and reload survival are only real
 * in a browser.
 */
export default defineConfig({
  testDir:     './e2e',
  fullyParallel: true,
  reporter:    process.env.CI ? 'dot' : 'list',
  use: {
    baseURL: 'http://localhost:3100',
    trace:   'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command:             'pnpm dev --port 3100',
    url:                 'http://localhost:3100',
    reuseExistingServer: ! process.env.CI,
    timeout:             120_000,
  },
})
