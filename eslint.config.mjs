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

  // == [3b. Disabled safety checks] == carried from /relics as-is.
  // Each of these switches off a check that catches genuinely unsafe code:
  // type holes, lost stack traces, silenced type errors.
  {
    name: 'triquet/relic-disabled-safety-checks',
    files: SourceFiles,
    rules: {
      'no-useless-escape':                                'off',
      '@typescript-eslint/ban-ts-comment':                'off',
      '@typescript-eslint/no-explicit-any':               'off',
      '@typescript-eslint/no-non-null-assertion':         'off',
      '@typescript-eslint/no-unsafe-declaration-merging': 'off',
      '@typescript-eslint/no-unused-expressions':         'off',
      '@typescript-eslint/only-throw-error':              'off', // relic: no-throw-literal
      '@typescript-eslint/return-await':                  'off',
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

  // == [3d. Not wanted here] == carried over to show what was dropped.
  // The commented entries name plugins this project does not install
  // (progress reporters, react-native, chai assertion plugins); naming an
  // unregistered plugin fails the config load.
  {
    name: 'triquet/relic-not-wanted',
    files: SourceFiles,
    rules: {
      'jsx-a11y/accessible-emoji': 'off',
      'react/sort-comp': ['warn', {
        order: [
          'constructor',
          'state',
          'static-variables',
          'instance-variables',
          'static-methods',
          'lifecycle',
          '/^(on|handle).+$/',
          'render',
          'everything-else',
        ],
      }],
      // 'file-progress/activate':               'off',
      // 'progress/activate':                    'off',
      // 'chai-friendly/no-unused-expressions':  'off',
      // 'react-native/no-inline-styles':        'warn',
      // 'react-native/no-raw-text':             'warn',
      // 'react-native/no-unused-styles':        'warn',
      // 'react-native/split-platform-components': 'warn',
    },
  },

  // == [3e. Misconfigured] == carried over exactly as the relics had them.
  {
    name: 'triquet/relic-misconfigured',
    files: SourceFiles,
    rules: {
      'consistent-this': ['error', 'self', 'thisStore', 'thisWorld', 'thisQB', 'innerQB'],
      'no-native-reassign': 'error',
      '@typescript-eslint/no-empty-interface': 'off',
      '@typescript-eslint/no-floating-promises': ['error', {
        checkThenables: false,
        allowForKnownSafePromises: [
          { from: 'file', name: 'KQB' },
          { from: 'package', name: 'Where', package: 'knex' },
        ],
      }],
      '@typescript-eslint/no-unused-vars': ['warn', {
        varsIgnorePattern: '^(_.*|UF|TH|TY|VT|DX|SRS|Errors|Lembas|Valar|Arda|Utils)$',
        argsIgnorePattern: '^(_.*)$',
      }],
      'import-x/extensions': ['error', 'always'],
      'import-x/no-extraneous-dependencies': ['error', {
        devDependencies: ['**/test*/**/*.*', 'scripts/**/*.*', '**/codegen/*.*'],
      }],
      'react/function-component-definition': ['error', {
        namedComponents: 'arrow-function',
        unnamedComponents: 'arrow-function',
      }],
      // Cannot run at all: eslint-plugin-react still calls context.getFilename(),
      // which ESLint 10 removed. One of exactly two rules in that plugin so
      // affected; the other is forward-ref-uses-ref, which we don't use.
      // 'react/jsx-filename-extension': ['warn', { extensions: ['.js', '.jsx'] }],
      'react/jsx-indent': 'warn',
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
    },
  },
])
