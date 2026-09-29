import { defineConfig, devices } from '@playwright/test'
import * as Environment from './e2e/environment'

// Locally the suite runs under Doppler's `dev_e2e` config (`pnpm test:e2e`), which gives it a port,
// build directory and Convex backend of its own; anywhere else it could land on someone's dev server.
// Checked here because nothing later runs before the web server starts.
const complaints = Environment.complaintsAbout(process.env)
if (complaints.length > 0) {
  throw new Error(`Not an environment to run the e2e suite in:\n  ${complaints.join('\n  ')}`)
}

const port = process.env.PORT ?? '3002'
const role = Environment.roleOf(process.env)

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
  // One spec at a time on CI: a runner's few slow cores already carry the dev server, Convex and the
  // browser, and a second worker there times specs out. CI goes wide by sharding instead. Locally,
  // half the cores and no retry, so specs that collide over the one server they share fail here,
  // the only place they run side by side.
  workers:     process.env.CI ? 1 : '50%',
  // A route's first visit waits for it to compile, and a fresh page for its first reads.
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
  // The dev server, beside the role's own Convex backend with the functions pushed to it and every
  // row of the last run cleared away (`scripts/convex_dev`).
  webServer: {
    command:             `scripts/convex_dev ${role} --reset next dev`,
    url:                 `http://localhost:${port}`,
    reuseExistingServer: ! process.env.CI,
    env:                 {
      PORT:                                        port,
      NEXT_PUBLIC_TRIQUET_COMMIT_DEBOUNCE_SECONDS: '2',
      // A stand-in key, so the bots read as able to play and the specs stub what they ask;
      // it also means nothing here can ever spend real model usage, whatever the environment holds.
      ANTHROPIC_API_KEY:                           'sk-ant-not-a-real-key',
      // And the ask route stays switched off, so an ask no spec stubbed is declined before any
      // request leaves the machine, whatever Doppler's config says.
      ENABLE_ANTHROPIC_BOT:                        'off',
    },
    timeout:             180_000,
  },
})
