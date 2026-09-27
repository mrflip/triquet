import { defineConfig, devices } from '@playwright/test'
import * as Environment from './e2e/environment'

// Locally the suite runs under Doppler's `dev_e2e` config (`pnpm test:e2e`), which gives it a port,
// build directory and Jazz server of its own; anywhere else it could land on someone's dev server.
// Checked here because nothing later runs before the web server starts.
const complaints = Environment.complaintsAbout(process.env)
if (complaints.length > 0) {
  throw new Error(`Not an environment to run the e2e suite in:\n  ${complaints.join('\n  ')}`)
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
  // GitHub shows a log a whole line at a time: `list` gives each spec a line as it finishes, and
  // `github` pins each failure to its line of the spec. The html report, with the traces a retry
  // records, is uploaded when the job fails.
  reporter:    process.env.CI ? [['list'], ['github'], ['html', { open: 'never' }]] : 'list',
  // One retry on CI, so a failure there comes with a trace; a spec that passes only on its retry
  // is reported as flaky rather than hidden.
  retries:     process.env.CI ? 1 : 0,
  // A worker per core on CI, where the runner does nothing else. Locally, Playwright's default of
  // half the cores: as many specs at once against one server as a CI shard runs, or more, and no
  // retry, so a collision fails here before CI reports it as flaky.
  workers:     process.env.CI ? '100%' : '50%',
  // A fresh page opens its Jazz database before it shows anything, most of a second in dev,
  // and a route's first visit also waits for it to compile.
  expect:      { timeout: 10_000 },
  use: {
    baseURL: `http://localhost:${port}`,
    trace:   'on-first-retry',
  },
  projects: [
    // Checks that the suite has a server, build and database of its own, and warms the first page.
    { name: 'environment', testMatch: /\.setup\.ts$/, use: { ...devices['Desktop Chrome'] } },
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, dependencies: ['environment'] },
  ],
  webServer: {
    command:             'pnpm exec next dev',
    url:                 `http://localhost:${port}`,
    reuseExistingServer: ! process.env.CI,
    env:                 {
      PORT:                                        port,
      NEXT_PUBLIC_TRIQUET_COMMIT_DEBOUNCE_SECONDS: '2',
      // A stand-in key, so the players read as able to play and the specs stub what they ask;
      // it also means nothing here can ever spend real model usage, whatever the environment holds.
      ANTHROPIC_API_KEY:                           'sk-ant-not-a-real-key',
    },
    timeout:             120_000,
  },
})
