import { defineConfig, devices } from '@playwright/test'

// Locally the suite runs under Doppler's `dev_e2e` config (`pnpm test:e2e`), which gives it a port,
// build directory and Jazz server of its own; anywhere else it could land on someone's dev server.
if (! process.env.CI && process.env.DOPPLER_CONFIG !== 'dev_e2e') {
  throw new Error('Run the e2e suite with `pnpm test:e2e`, under Doppler\'s dev_e2e config')
}

const port = process.env.PORT ?? '3002'

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
    baseURL: `http://localhost:${port}`,
    trace:   'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command:             'pnpm exec next dev',
    url:                 `http://localhost:${port}`,
    reuseExistingServer: ! process.env.CI,
    env:                 {
      PORT:                                        port,
      TRIQUET_DATABASE_URL:                        'file:data/e2e.db',
      NEXT_PUBLIC_TRIQUET_COMMIT_DEBOUNCE_SECONDS: '2',
      // A stand-in key, so the players read as able to play and the specs stub what they ask;
      // it also means nothing here can ever spend real model usage, whatever the environment holds.
      ANTHROPIC_API_KEY:                           'sk-ant-not-a-real-key',
    },
    timeout:             120_000,
  },
})
