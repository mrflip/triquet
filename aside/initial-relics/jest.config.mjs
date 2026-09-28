import      { createJsWithTsEsmPreset } from 'ts-jest' // eslint-disable-line import/no-extraneous-dependencies

const presetConfig = createJsWithTsEsmPreset({
  tsconfig:       '<rootDir>/tsconfig.test.json',
  diagnostics:    { warnOnly: true },
})

/** @type {import('jest').Config} */
const config = {
  ...presetConfig,

  moduleFileExtensions: ['js', 'ts', 'json', 'node', 'eta'],       // reload on eta files too
  setupFilesAfterEnv:   ['<rootDir>/tests/setupFilesAfterEnv.ts'], // A list of paths to modules that run some code to configure or set up the testing framework before each test
  snapshotResolver:      '<rootDir>/tests/snapshotResolver.cjs',   // don't pollute the code dirs with snapshot artifacts
  testEnvironment:       'node',                                   // The test environment that will be used for testing
  verbose:                true,
  resolver:              'ts-jest-resolver',
  testMatch: [
    '<rootDir>/tests/**/*.test.ts',
    '<rootDir>/src/**/*.test.ts',
  ],
  moduleNameMapper: {
    // Self-reference: @flipshop/flipshop → src/index.ts
    '^@flipshop/flipshop$':       '<rootDir>/src/index.ts',
    // '^@freeword/meta/checks$':    '<rootDir>../freeword/meta/built/src/checks/index.js',
    // '^@freeword/meta/checks.js$': '<rootDir>../freeword/meta/built/src/checks/index.js',
    // '^@freeword/meta$':           '<rootDir>../freeword/meta/built/src/index.js',
    // rewriteRelativeImportExtensions rewrites .ts→.js in emitted code; undo that
    // '^(\\.{1,2}/.*)\\.js$':        '$1',
  },
}

export default config
