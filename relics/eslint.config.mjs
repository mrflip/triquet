// eslint.config.mjs
//
// Flat config for ESLint 9+ / typescript-eslint v8+.
// No .eslintrc, no `env`, no `extends` cascading — this file IS the whole config,
// read top to bottom, which is why it's laid out as one array of config objects
// instead of a jalopy of `overrides`.
//
// Philosophy, carried over from the legacy config this replaces:
//   - Style rules that were explicitly turned ON stay on, ported to their modern
//     equivalents (mostly `@stylistic/eslint-plugin`, since ESLint core deprecated
//     its own formatting rules in favor of that package).
//   - Style/pattern rules that were explicitly turned OFF stay off. That was a
//     deliberate taste call in the old file, not legacy cruft, so it's preserved
//     even though the base rulesets below would otherwise turn some of them on.
//   - Where a rule is about *correctness* rather than *taste* (unsafe promise
//     handling, throwing non-Errors, `any` leaking through), rigor wins over the
//     old file's pragmatic legacy-codebase leniency. Each such reversal is called
//     out in a comment below so it's easy to relitigate.
//
// Formatting is handled entirely by ESLint (`@stylistic/*`) rather than Prettier.
// The old file's conventions include some genuinely idiosyncratic calls (no space
// before a named function's parens, for example) that Prettier does not offer as
// an option, so introducing Prettier here would just mean the two fight. If you'd
// rather hand formatting to Prettier project-wide, drop the `@stylistic` block
// below, run `npx @stylistic/eslint-plugin-migrate` for a Prettier-config seed, and
// accept Prettier's opinions on the couple of things it won't compromise on.
//
// devDependencies to add:
//   eslint typescript-eslint @stylistic/eslint-plugin eslint-plugin-import-x
//   (add @vitest/eslint-plugin or eslint-plugin-jest, matching whichever you use)

import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import stylistic from '@stylistic/eslint-plugin'
import importX from 'eslint-plugin-import-x'
import globals from 'globals'

export default tseslint.config(

  // ---------------------------------------------------------------------
  // What we never lint
  // ---------------------------------------------------------------------
  {
    ignores: [
      'dist/**',
      'build/**',
      '.next/**',
      'coverage/**',
      'node_modules/**',
      '**/*.d.ts',
      '**/*.generated.*',
      // CLAUDE.md: ignore everything staged here, and don't design anything
      // that needs it -- these are past-project files awaiting integration,
      // not code this project runs.
      'aside/**',
      'relics/**',
    ],
  },

  // ---------------------------------------------------------------------
  // Base rulesets — this is where the rigor comes from. `strictTypeChecked`
  // is the opinionated, type-information-powered ruleset; it's what catches
  // the things a coding agent will otherwise cheerfully write (unhandled
  // promise rejections, unsafe `any` flow, unnecessary conditionals, etc).
  // We deliberately skip `stylisticTypeChecked` — style is handled below,
  // by hand, to match the conventions this file is preserving.
  // ---------------------------------------------------------------------
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,

  // ---------------------------------------------------------------------
  // Language options
  // ---------------------------------------------------------------------
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
      parserOptions: {
        // v8's replacement for the old `project: [...]` array — finds the
        // right tsconfig per file automatically, no maintenance required.
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // ---------------------------------------------------------------------
  // Plugins used below, and import resolution
  // ---------------------------------------------------------------------
  {
    plugins: {
      '@stylistic': stylistic,
      'import-x': importX,
    },
    settings: {
      'import-x/resolver': {
        typescript: true,
      },
    },
    rules: {

      // == [Formatting — ported 1:1 from the legacy `warn`/`error` rules] ==
      // Please preserve alphabetical order.

      '@stylistic/eol-last':                     ['warn', 'always'],
      '@stylistic/function-call-argument-newline': ['warn', 'consistent'],
      '@stylistic/function-paren-newline':       ['warn', 'consistent'],
      '@stylistic/generator-star-spacing':       ['warn', { before: true, after: true }],
      '@stylistic/indent':                       ['warn', 2, { SwitchCase: 0 }],
      '@stylistic/linebreak-style':              ['error', 'unix'],
      '@stylistic/no-multiple-empty-lines':      'warn',
      '@stylistic/no-trailing-spaces':           'warn',
      '@stylistic/semi':                         ['warn', 'never'],
      // TODO: see which of these are already injected correctly by the base rulesets and configure ones that are not
      // '@stylistic/space-unary-ops':           ['warn', { overrides: { '!': true } }],
      // '@stylistic/arrow-parens':              ['warn', 'always'],
      // '@stylistic/brace-style':               ['warn', '1tbs'],
      // 'no-var':                               'error',
      // 'prefer-const':                         'error',
      // id-denylist:                            ['name', 'value', 'node', 'error', 'query'],

      // New, matching the "JavaScript house style" this project also uses:
      //   no space before a named function's parens, space before an
      //   anonymous or arrow function's parens: `paintRange(range)` /
      //   `function (val) {}`.
      '@stylistic/space-before-function-paren': ['error', {
        named:      'never',
        anonymous:  'always',
        asyncArrow: 'always',
      }],

      // --

      // == [Correctness / convention rules kept ON from the legacy config] ==
      // Please preserve alphabetical order.

      'consistent-this':          ['error', 'self'], // append project-specific aliases here as they come up
      'curly':                    ['error', 'all'],  // always brace blocks, even one-liners
      'default-param-last':       ['off'],           // superseded by the TS-aware version below
      'no-console':               ['warn', { allow: ['warn', 'error'] }],
      'no-constructor-return':    ['error'],
      'no-else-return':           ['warn', { allowElseIf: false }],
      'no-global-assign':         ['error'],
      'no-implicit-coercion':     ['error', { allow: ['!!'] }],
      'no-implicit-globals':      ['error'],
      'no-mixed-operators':       ['error'],
      'no-negated-condition':     ['error'],
      'no-unsafe-negation':       ['error', { enforceForOrderingRelations: true }],
      'no-unused-vars':           ['off'],           // superseded by the TS-aware version below
      'prefer-destructuring':     ['warn', { object: true, array: false }],

      '@typescript-eslint/default-param-last': 'error',
      '@typescript-eslint/no-unused-vars':     ['warn', {
        argsIgnorePattern:         '^_',
        varsIgnorePattern:         '^_',
        caughtErrorsIgnorePattern: '^_',
      }],

      // No single-letter identifiers — spell it out, or double a traditional
      // iterator (`ii`, `jj`) instead of `i`, `j`. Doesn't touch object keys
      // or TS generic type parameters (`T`, `K`, `V` are unaffected).
      'id-length': ['warn', { min: 2, properties: 'never', exceptions: ['_'] }],

      'func-style': ['error', 'declaration', { allowArrowFunctions: true }],

      // --

      // == [Deliberate rigor increases — the legacy file turned these off for
      //      pragmatism in an old, already-migrated codebase. A greenfield,
      //      agent-authored project doesn't need that leniency.] ==

      // Throwing a string/object instead of an Error silently loses the
      // stack trace. Renamed from `no-throw-literal`.
      '@typescript-eslint/only-throw-error': 'error',

      // `await`-ing inside try/catch (rather than `return`-ing the promise
      // bare) keeps the stack trace attached to the throw site. Renamed
      // from `no-return-await`, and worth it precisely because agents tend
      // to write `return somePromise` out of habit.
      '@typescript-eslint/return-await': ['error', 'in-try-catch'],

      // `any` is a hole in the type system exactly where an agent is most
      // likely to reach for it under time pressure — worth flagging loudly.
      '@typescript-eslint/no-explicit-any': 'error',

      // --

      // == [Explicitly OFF — a preserved taste call, not an oversight] ==
      // These would otherwise be enabled by `strictTypeChecked` or by
      // `eslint:recommended`. Please preserve alphabetical order.

      '@typescript-eslint/ban-ts-comment':                 'off', // agents sometimes need an escape hatch; require a reason via `ts-expect-error` comment convention, not a lint rule
      '@typescript-eslint/class-methods-use-this':         'off',
      '@typescript-eslint/explicit-module-boundary-types':  'off',
      '@typescript-eslint/naming-convention':               'off',
      '@typescript-eslint/no-empty-object-type':            'off', // renamed from no-empty-interface
      '@typescript-eslint/no-non-null-assertion':           'off',
      '@typescript-eslint/no-this-alias':                   'off', // pairs with consistent-this: 'self'
      '@typescript-eslint/no-unsafe-declaration-merging':   'off',
      '@typescript-eslint/no-use-before-define':            'off',
      '@typescript-eslint/no-useless-constructor':          'off',
      'camelcase':                'off',
      'no-await-in-loop':          'off',
      'no-continue':               'off',
      'no-restricted-syntax':      'off',
      'no-underscore-dangle':      'off',
      'quotes':                    'off', // no opinion on ' vs " here

      // --

      // == [import-x — replacing the legacy `import/*` rules] ==

      'import-x/extensions': ['error', 'always', { ignorePackages: true }],
      'import-x/no-extraneous-dependencies': ['error', {
        devDependencies: [
          '**/*.test.*',
          '**/*.spec.*',
          'scripts/**/*',
          'eslint.config.*',
          'vite.config.*',
          'vitest.config.*',
        ],
      }],
      'import-x/no-named-as-default':        'off',
      'import-x/no-named-as-default-member': 'off',
      'import-x/no-useless-path-segments':   'off',
      'import-x/prefer-default-export':      'off',
    },
  },

  // ---------------------------------------------------------------------
  // Test files — relax the couple of rules that fight with assertion
  // libraries (bare `expect(x).to.be.true` reads as an unused expression).
  // Swap the plugin/import below for `eslint-plugin-jest` if that's your
  // runner instead of Vitest.
  // ---------------------------------------------------------------------
  {
    files: ['**/*.test.ts', '**/*.spec.ts', '**/__tests__/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unused-expressions': 'off',
      '@typescript-eslint/no-explicit-any':       'off',
    },
  },

  // ---------------------------------------------------------------------
  // Config files themselves don't need to be part of the type-checked
  // project, and reasonably import devDependencies.
  // ---------------------------------------------------------------------
  {
    files: ['*.config.{js,mjs,ts}', '.*.config.{js,mjs,ts}'],
    ...tseslint.configs.disableTypeChecked,
  },
)
