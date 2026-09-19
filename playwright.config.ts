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
    command:             'pnpm dev:agent',
    url:                 'http://localhost:3100',
    reuseExistingServer: ! process.env.CI,
    // A stand-in key, so the players read as able to play and the specs stub what they ask;
    // it also means nothing here can ever spend real model usage.
    env:                 { NEXT_PUBLIC_TRIQUET_COMMIT_DEBOUNCE_SECONDS: '2', ANTHROPIC_API_KEY: 'sk-ant-not-a-real-key' },
    timeout:             120_000,
  },
})
