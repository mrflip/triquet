import { defineConfig, devices } from '@playwright/test'
import * as Environment from './e2e/environment'

// Locally the suite runs under Doppler's `dev_e2e` config (`pnpm test:e2e`), with a port, build
// directory and Convex backend of its own in its checkout's lane (scripts/as_role); anywhere else
// it could land on someone's dev server.
// Checked here because nothing later runs before the web server starts.
const complaints = Environment.complaintsAbout(process.env)
if (complaints.length > 0) {
  throw new Error(`Not an environment to run the e2e suite in:\n  ${complaints.join('\n  ')}`)
}

const port = process.env.PORT ?? '3002'
const role = Environment.roleOf(process.env)
const server = Environment.serverOf(process.env) as Environment.E2eServer

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
  // records, is uploaded when the job fails. Locally, `pnpm e2e` asks for a JSON report too, at
  // PLAYWRIGHT_JSON_OUTPUT_FILE, to keep the branch's proof and the e2e log by (scripts/spine.ts).
  reporter:    process.env.CI ? [['list'], ['github'], ['html', { open: 'never' }]] : [['list'], ...(process.env.PLAYWRIGHT_JSON_OUTPUT_FILE ? [['json'] as const] : [])],
  // One retry on CI, so a failure there comes with a trace; a spec that passes only on its retry
  // is reported as flaky rather than hidden.
  retries:     process.env.CI ? 1 : 0,
  // One spec at a time on CI: a runner's few slow cores already carry the web server, Convex and the
  // browser, and a second worker there times specs out. CI goes wide by sharding instead. Locally,
  // seven, a little under half this machine's sixteen cores, so several worktrees' suites can run
  // at once, and no retry, so specs that collide over the one server they share fail here, the only
  // place they run side by side. A spec that fails among the others is rerun alone (`pnpm e2e:rerun`).
  // A smaller machine names its own count in TQ_E2E_WORKERS: a cloud session's four cores time
  // specs out at seven (.claude/hooks/session-start.sh sets it).
  workers:     process.env.CI ? 1 : Number(process.env.TQ_E2E_WORKERS ?? 7),
  // Under the dev server a route's first visit waits for it to compile, and a fresh page always
  // waits for its first reads.
  expect:      { timeout: 10_000 },
  use: {
    baseURL: `http://localhost:${port}`,
    trace:   'on-first-retry',
    // A Chromium of the machine's own, where Playwright may not download the build it pins: a
    // cloud session's container (.claude/hooks/session-start.sh sets it).
    ...(process.env.TQ_CHROMIUM_PATH && { launchOptions: { executablePath: process.env.TQ_CHROMIUM_PATH } }),
  },
  projects: [
    // Checks that the suite has a server, build and database of its own, and warms the first page.
    { name: 'environment', testMatch: /\.setup\.ts$/, use: { ...devices['Desktop Chrome'] } },
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, dependencies: ['environment'] },
  ],
  // The dev server, or the optimized build (`pnpm test:e2e:built`, and CI), beside the role's own Convex
  // backend with the functions pushed to it and every row of the last run cleared away
  // (`scripts/convex_dev`). The build is made here, so it sees the settings below: a NEXT_PUBLIC_
  // one is fixed into the pages as they are built.
  webServer: {
    command:             `scripts/convex_dev ${role} --reset --seed ${Environment.ServerCommandFor[server]}`,
    url:                 `http://localhost:${port}`,
    // Locally a dev server already on the port is used as it stands, since it follows the code
    // as it changes. A built server never is: one left from an earlier build would be tested
    // silently as it was, so a run finding the port taken refuses to start.
    reuseExistingServer: server === 'dev' && ! process.env.CI,
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
    // The optimized build is made before the server can answer.
    timeout:             server === 'built' ? 480_000 : 180_000,
  },
})
