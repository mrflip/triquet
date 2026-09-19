import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['**/node_modules/**', 'aside/**', 'relics/**'],
    // Snapshots mirror the test tree under one hidden directory, rather than dropping a
    // `__snapshots__` beside every test file.
    resolveSnapshotPath: (testpath, extension) => (
      path.join('tests', '.snapshots', path.relative(path.join(import.meta.dirname, 'tests'), testpath) + extension)
    ),
  },
})
