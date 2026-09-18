// eslint.config.mjs
//
// Three layers, in override order (later wins):
//
//   1. Stock defaults -- exactly what `create-next-app` generates for a
//      TypeScript app, plus `js.configs.recommended` as the floor.
//   2. The police state -- type-aware `strictTypeChecked`, plus unicorn,
//      sonarjs and import-x. This is the modern stand-in for the airbnb
//      config in /relics; see the notes on that below.
//   3. Ours -- house style and the settings carried over from /relics,
//      grouped by what kind of setting they are.
//
// Layer 2 replaces airbnb rather than extending it. `eslint-config-airbnb`
// is eslintrc-only and stops at ESLint 8; `eslint-config-airbnb-extended`,
// the community flat-config port, stops at ESLint 9. Pinning either one
// would pin this whole project behind the toolchain.
import { defineConfig, globalIgnores } from 'eslint/config'
import js from '@eslint/js'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'
import tseslint from 'typescript-eslint'
import unicorn from 'eslint-plugin-unicorn'
import sonarjs from 'eslint-plugin-sonarjs'
import importX from 'eslint-plugin-import-x'
import stylistic from '@stylistic/eslint-plugin'
import vitest from '@vitest/eslint-plugin'

/** Everything we lint; matches the glob eslint-config-next registers its plugins for. */
const SourceFiles = ['**/*.{js,jsx,mjs,ts,tsx,mts,cts}']

export default defineConfig([
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'dist/**',
    'coverage/**',
    'next-env.d.ts',
    '**/*.generated.*',
    // CLAUDE.md: staged past-project files, not code this project runs.
    'aside/**',
    'relics/**',
  ]),

  // == [1. Stock Next.js + TypeScript defaults] ==

  js.configs.recommended,
  ...nextVitals,
  ...nextTs,

  // == [2. Strictness layer] ==

  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  unicorn.configs.recommended,
  sonarjs.configs.recommended,
  importX.flatConfigs.recommended,
  importX.flatConfigs.typescript,

  // Type-aware rules need the TS project. `projectService` replaces the
  // hand-maintained `tsconfig.eslint.json` the relics needed.
  {
    name: 'triquet/type-aware',
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  // == [3a. House style] == carried from /relics, in modern form.
  // Formatting rules left ESLint core and typescript-eslint for @stylistic;
  // these are the same conventions, at their current addresses.
  {
    name: 'triquet/house-style',
    files: SourceFiles,
    plugins: { '@stylistic': stylistic },
    rules: {
      '@stylistic/comma-dangle':                   ['warn', 'always-multiline'],
      '@stylistic/eol-last':                       ['warn', 'always'],
      '@stylistic/function-call-argument-newline': ['warn', 'consistent'],
      '@stylistic/function-paren-newline':         ['warn', 'consistent'],
      '@stylistic/generator-star-spacing':         ['warn', { before: true, after: true }],
      '@stylistic/indent':                         ['warn', 2, { SwitchCase: 0 }],
      '@stylistic/linebreak-style':                ['error', 'unix'],
      '@stylistic/no-mixed-operators':             'error',
      '@stylistic/no-multiple-empty-lines':        'warn',
      '@stylistic/no-trailing-spaces':             'warn',
      '@stylistic/semi':                           ['warn', 'never'],
      '@stylistic/space-unary-ops':                ['warn', { overrides: { '!': true } }],

      // Off because we align values into columns, and quote style is a
      // by-hand convention (STYLE.md).
      '@stylistic/key-spacing':                    'off',
      '@stylistic/max-len':                        'off',
      '@stylistic/multiline-ternary':              'off',
      '@stylistic/newline-per-chained-call':       'off',
      '@stylistic/no-multi-spaces':                'off',
      '@stylistic/object-curly-newline':           'off',
      '@stylistic/object-property-newline':        'off',
      '@stylistic/padded-blocks':                  'off',
      '@stylistic/quotes':                         'off',

      'func-style':                ['error', 'declaration', { allowArrowFunctions: true }],
      'no-console':                ['warn', { allow: ['warn', 'error'] }],
      'no-constructor-return':     'error',
      'no-dupe-else-if':           'error',
      'no-else-return':            'warn',
      'no-implicit-coercion':      ['error', { allow: ['!!'] }],
      'no-implicit-globals':       'error',
      'no-negated-condition':      'error',
      'no-unsafe-negation':        ['error', { enforceForOrderingRelations: true }],
      'prefer-destructuring':      ['warn', { object: true, array: false }],

      'arrow-body-style':          'off',
      'camelcase':                 'off',
      'class-methods-use-this':    'off',
      'lines-between-class-members': 'off',
      'max-classes-per-file':      'off',
      'no-await-in-loop':          'off',
      'no-continue':               'off',
      'no-inner-declarations':     'off',
      'no-restricted-syntax':      'off',
      'no-underscore-dangle':      'off',
      'no-useless-rename':         'off',
      'prefer-template':           'off',

      '@typescript-eslint/default-param-last':             'error',
      '@typescript-eslint/no-misused-promises':            'error',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/naming-convention':              'off',
      '@typescript-eslint/no-this-alias':                  'off',
      '@typescript-eslint/no-use-before-define':           'off',
      '@typescript-eslint/no-useless-constructor':         'off',

      'import-x/no-named-as-default':        'off',
      'import-x/no-named-as-default-member': 'off',
      'import-x/no-useless-path-segments':   'off',
      'import-x/prefer-default-export':      'off',

      'react/jsx-key':                 ['error', { checkFragmentShorthand: true }],
      'react/jsx-no-useless-fragment': 'off',
      'react/no-unsafe':               'error',
    },
  },

  // == [3b. Disabled safety checks] == every one of these switched off a
  // check for genuinely unsafe code, so every one is left commented rather
  // than carried forward. Uncomment individually, with a reason, if a real
  // case argues for it.
  //
  // STYLE.md currently lists no-non-null-assertion and ban-ts-comment as
  // deliberately not enforced, which contradicts leaving them on. That
  // conflict is the Coach's to settle; the config takes the safe side.
  {
    name: 'triquet/relic-disabled-safety-checks',
    files: SourceFiles,
    rules: {
      // 'no-useless-escape':                                'off',
      // '@typescript-eslint/ban-ts-comment':                'off',
      // '@typescript-eslint/no-explicit-any':               'off',
      // '@typescript-eslint/no-non-null-assertion':         'off',
      // '@typescript-eslint/no-unsafe-declaration-merging': 'off',
      // '@typescript-eslint/only-throw-error':              'off', // relic: no-throw-literal
      // '@typescript-eslint/return-await':                  'off',
      //
      // no-unused-expressions stays off, but only for tests, where
      // chai-style assertions (`expect(val).to.be.true`) are bare
      // expressions by design. See the tests block below.
      // '@typescript-eslint/no-unused-expressions':         'off',
    },
  },

  // == [3c. Redundant] == commented out, not deleted, so the diff shows them.
  // The `@typescript-eslint/*` entries were duplicates of core rules that
  // typescript-eslint has since dropped -- naming one now fails the config
  // load outright. The jest and airbnb-react entries only ever existed to
  // quiet `plugin:jest/all` and `airbnb`, neither of which we extend.
  {
    name: 'triquet/relic-redundant',
    files: SourceFiles,
    rules: {
      // '@typescript-eslint/camelcase':                   'off',
      // '@typescript-eslint/comma-dangle':                ['warn', 'always-multiline'],
      // '@typescript-eslint/indent':                      ['warn', 2, { SwitchCase: 0 }],
      // '@typescript-eslint/key-spacing':                 'off',
      // '@typescript-eslint/lines-between-class-members': 'off',
      // '@typescript-eslint/no-await-in-loop':            'off',
      // '@typescript-eslint/no-continue':                 'off',
      // '@typescript-eslint/no-multi-spaces':             'off',
      // '@typescript-eslint/no-restricted-syntax':        'off',
      // '@typescript-eslint/no-underscore-dangle':        'off',
      // '@typescript-eslint/no-useless-escape':           'off',
      // '@typescript-eslint/no-useless-rename':           'off',
      // '@typescript-eslint/object-curly-newline':        'off',
      // '@typescript-eslint/object-property-newline':     'off',
      // '@typescript-eslint/padded-blocks':               'off',
      // '@typescript-eslint/quotes':                      'off',
      // '@typescript-eslint/semi':                        ['warn', 'never'],
      //
      // 'jest/lowercase-name':                  'off',
      // 'jest/max-expects':                     'off',
      // 'jest/no-conditional-in-test':          'off',
      // 'jest/no-hooks':                        'off',
      // 'jest/no-if':                           'off',
      // 'jest/padding-around-all':              'off',
      // 'jest/prefer-expect-assertions':        'off',
      // 'jest/prefer-importing-jest-globals':   'off',
      // 'jest/prefer-lowercase-title':          'off',
      // 'jest/require-hook':                    'off',
      // 'jest/unbound-method':                  'off',
      // 'jest/valid-expect':                    'off',
      //
      // 'react/prop-types':                    'off',
      // 'react/jsx-equals-spacing':            'off',
      // 'react/jsx-one-expression-per-line':   'off',
      // 'react/jsx-props-no-multi-spaces':     'off',
      // 'react/jsx-props-no-spreading':        'off',
      // 'react/jsx-sort-props':                'off',
    },
  },

  // == [3d. Repaired] == the relics' settings, with the parts that were
  // aimed at that codebase rather than this one corrected.
  //
  // Dropped outright, rather than repaired:
  //   react-native/*, file-progress, progress, chai-expect, chai-friendly
  //     -- plugins with no role here
  //   react/sort-comp          -- orders class components; we write functions
  //   jsx-a11y/accessible-emoji, react/jsx-indent, react/jsx-filename-extension
  //     -- deprecated or, in the last case, unable to run on ESLint 10
  {
    name: 'triquet/relic-repaired',
    files: SourceFiles,
    rules: {
      // Aliases dropped; they named objects in the old codebase.
      'consistent-this': ['error', 'self'],
      // Renamed rule: no-native-reassign, deprecated since ESLint 3.3.0.
      'no-global-assign': 'error',
      // Renamed rule: no-empty-interface.
      '@typescript-eslint/no-empty-object-type': 'off',
      // Allowlist dropped; it named a knex query builder we don't use.
      '@typescript-eslint/no-floating-promises': 'error',
      // Ignore pattern was a list of that codebase's ambient names.
      '@typescript-eslint/no-unused-vars': ['warn', {
        varsIgnorePattern:         '^_',
        argsIgnorePattern:         '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
      // Bare 'always' demanded extensions on package imports too.
      'import-x/extensions': ['error', 'always', { ignorePackages: true }],
      // Globs now describe this repo's layout.
      'import-x/no-extraneous-dependencies': ['error', {
        devDependencies: ['tests/**', '**/*.config.{ts,mts,mjs}', 'eslint.config.mjs', 'scripts/**'],
        optionalDependencies: false,
        peerDependencies: true,
      }],
      // Arrow components contradict func-style: declaration, and Next.js
      // pages and layouts must be default-exported declarations.
      'react/function-component-definition': ['error', {
        namedComponents:   'function-declaration',
        unnamedComponents: 'arrow-function',
      }],
    },
  },

  // This file and any other loose script sit outside the TS project, so the
  // type-aware rules above cannot run on them. Last, so it wins.
  {
    name: 'triquet/untyped-config-files',
    files: ['**/*.mjs', '**/*.js', '**/*.cjs'],
    extends: [tseslint.configs.disableTypeChecked],
  },

  // == [Tests] == vitest replaces the relics' jest + chai plugin stack.
  {
    name: 'triquet/tests',
    files: ['tests/**/*.{ts,tsx}'],
    extends: [vitest.configs.recommended],
    rules: {
      'vitest/no-disabled-tests': 'warn',
      'vitest/no-focused-tests': 'warn',
      // Chai-style assertions are bare expressions by design.
      '@typescript-eslint/no-unused-expressions': 'off',
    },
  },
])
