import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    exclude: ['**/node_modules/**', 'aside/**', 'relics/**'],
    setupFiles: ['tests/support/setup.ts'],
    // Snapshots mirror the test tree under one hidden directory, rather than dropping a
    // `__snapshots__` beside every test file.
    resolveSnapshotPath: (testpath, extension) => (
      path.join('tests', '.snapshots', path.relative(path.join(import.meta.dirname, 'tests'), testpath) + extension)
    ),
    // The Convex functions run under convex-test, which wants the edge runtime Convex's own
    // isolates resemble; everything else runs under node.
    projects: [
      {
        extends: true,
        test: {
          name:        'convex',
          environment: 'edge-runtime',
          include:     ['tests/convex/**/*.test.ts'],
          // Every username an admin, as on a local backend (`scripts/convex_dev`); a test of fewer stubs it
          env:         { TRIQUET_ADMINS: '*' },
          server:      { deps: { inline: ['convex-test'] } },
        },
      },
      {
        extends: true,
        test: {
          name:        'unit',
          environment: 'node',
          include:     ['tests/**/*.test.{ts,tsx}'],
          exclude:     ['tests/convex/**'],
        },
      },
    ],
  },
})
