// eslint.config.mjs
//
import { defineConfig, globalIgnores } from 'eslint/config'
import js                              from '@eslint/js'
import nextVitals                      from 'eslint-config-next/core-web-vitals'
import nextTs                          from 'eslint-config-next/typescript'
import tseslint                        from 'typescript-eslint'
import unicorn                         from 'eslint-plugin-unicorn'
import sonarjs                         from 'eslint-plugin-sonarjs'
import importX                         from 'eslint-plugin-import-x'
import stylistic                       from '@stylistic/eslint-plugin'
import vitest                          from '@vitest/eslint-plugin'

/** Everything we lint; matches the glob eslint-config-next registers its plugins for. */
const SourceFiles = ['**/*.{js,jsx,mjs,ts,tsx,mts,cts}']

export default defineConfig([
  globalIgnores([
    '.next/**',
    '.next-agent/**',
    '.next-e2e/**',
    '.next-*/**',
    'out/**',
    'build/**',
    'dist/**',
    'coverage/**',
    'next-env.d.ts',
    '**/*.generated.*',
    // CLAUDE.md: staged past-project files, not code this project runs.
    'aside/**',
    'relics/**',
    // Written by the Jazz migration tool (scripts/jazz_migration), in its own double-quoted style.
    // In src/db because Jazz's dev server reads migrations only from beside the schema.
    'src/db/migrations/**',
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
      '@stylistic/no-mixed-operators':             ['error'],
      '@stylistic/no-multiple-empty-lines':        ['warn'],
      '@stylistic/no-trailing-spaces':             ['warn'],
      '@stylistic/semi':                           ['warn', 'never'],
      // '@stylistic/space-unary-ops' is not carried: its `!` override also fires on
      // TypeScript's postfix non-null assertion (`arr[0]!`), which it cannot distinguish
      // from the negation operator the rule is aimed at.

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

      'func-style':                                ['error', 'declaration', { allowArrowFunctions: true }],
      'no-console':                                ['warn', { allow: ['warn', 'error'] }],
      'no-constructor-return':                     ['error'],
      'no-dupe-else-if':                           ['error'],
      'no-else-return':                            ['warn'],
      'no-implicit-coercion':                      ['error', { allow: ['!!'] }],
      'no-implicit-globals':                       ['error'],
      'no-negated-condition':                      ['error'],
      // STYLE.md: const by default, let where genuinely reassigned, never var.
      'no-var':                                    ['error'],
      'no-unsafe-negation':                        ['error', { enforceForOrderingRelations: true }],
      'prefer-destructuring':                      ['warn', { object: true, array: false }],

      'arrow-body-style':                          ['off'],
      'camelcase':                                 ['off'],
      'class-methods-use-this':                    ['off'],
      'lines-between-class-members':               ['off'],
      'max-classes-per-file':                      ['off'],
      'no-await-in-loop':                          ['off'],
      'no-continue':                               ['off'],
      'no-inner-declarations':                     ['off'],
      'no-restricted-syntax':                      ['off'],
      'no-underscore-dangle':                      ['off'],
      'no-useless-rename':                         ['off'],
      'prefer-template':                           ['off'],

      '@typescript-eslint/default-param-last':     ['error'],
      '@typescript-eslint/no-misused-promises':    ['error'],
      '@typescript-eslint/explicit-module-boundary-types': ['off'],
      '@typescript-eslint/naming-convention':      ['off'],
      '@typescript-eslint/no-this-alias':          ['off'],
      '@typescript-eslint/no-use-before-define':   ['off'],
      '@typescript-eslint/no-useless-constructor': ['off'],
      '@typescript-eslint/return-await':           ['warn', 'error-handling-correctness-only'], // use this when it's warranted

      'import-x/no-named-as-default':        'off',
      'import-x/no-named-as-default-member': 'off',
      'import-x/no-useless-path-segments':   'off',
      'import-x/prefer-default-export':      'off',
      // No extension enforcement: extensionless is the grain of Next.js and
      // the wider ecosystem's import convention, so import-x/extensions
      // (either direction) isn't set here at all.
      'import-x/no-extraneous-dependencies': ['error', {
        devDependencies: ['tests/**', 'e2e/**', '**/*.config.{ts,mts,mjs}', 'eslint.config.mjs', 'scripts/**'],
        optionalDependencies: false,
        peerDependencies: true,
      }],

      'react/jsx-key':                 ['error', { checkFragmentShorthand: true }],
      'react/jsx-no-useless-fragment': 'off',
      'react/no-unsafe':               'error',

      // Aliases dropped; they named objects in a previous codebase.
      'consistent-this': ['error', 'self'],
      // Renamed rule: no-native-reassign, deprecated since ESLint 3.3.0.
      'no-global-assign': 'error',
      // Renamed rule: no-empty-interface.
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-unused-vars': ['warn', {
        varsIgnorePattern:         '^_',
        argsIgnorePattern:         '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
    },
  },

  // == [3a-bis. Plugin defaults our own documents contradict] ==
  // Each of these is a reasonable default that STYLE.md or notes/guidelines.md rules out
  // explicitly. Turned off here rather than disabled at hundreds of call sites.
  {
    name: 'triquet/house-overrides',
    files: SourceFiles,
    rules: {
      // STYLE.md sanctions the one-line doc block: `/** Brief statement, if that's truly enough */`.
      'unicorn/single-line-block-comment-style': 'off',
      // guidelines.md's Real phase: "Every field exists (possibly null, never undefined)".
      // null is load-bearing in the data model and in every import payload.
      'unicorn/no-null': 'off',
      // guidelines.md's worked example declares a model's fields first, then its statics --
      // the field list is the documentation, and it belongs at the top.
      'unicorn/consistent-class-member-order': 'off',
      // STYLE.md's tag glossary is deliberate and specific: `idx`, `val`, `str`, `num`, `obj`,
      // `arr`, `props`, `pt` -- and `err`, where the rule's replacement (`error`) is the one
      // name STYLE.md forbids outright.
      'unicorn/name-replacements': 'off',
      // The data model's booleans are named by the spec: `locked`, `stale`, `truncated`. An
      // is- prefix on every local binding of one would be a translation layer and nothing more,
      // and it fights `prefer-destructuring`, which is on.
      'unicorn/consistent-boolean-name': 'off',
      // Components are PascalCase, everything else kebab-case -- the grain of React and of
      // Next.js's own `page.tsx` / `layout.tsx`.
      'unicorn/filename-case': ['error', { cases: { kebabCase: true, pascalCase: true } }],
      // Taste, and it would split the model files: `type FooT = Z.output<...>` cannot be an
      // interface, so its neighbours should not have to be either.
      '@typescript-eslint/consistent-type-definitions': 'off',
      // STYLE.md: "Use `err`, never `error`". The rule's own default is the forbidden name.
      'unicorn/catch-error-name': ['error', { name: 'err' }],
      // STYLE.md endorses the guard clause ("Short guards stay on one line, still braced") and
      // asks that visual weight match didactic weight: a guard is not a choice between two
      // values, and should not have to read like one.
      'unicorn/prefer-ternary': 'off',
    },
  },

  // These are all good ideas to enforce, but forbidding access to @ts-expect-error
  // etc can send the coach-coder development loop into a tailspin.
  // Use them judiciously, and ALWAYS report it in chat.
  {
    name: 'triquet/can-we-be-adults-yes-we-can',
    files: SourceFiles,
    rules: {
      '@typescript-eslint/ban-ts-comment':                'off',
      '@typescript-eslint/no-explicit-any':               'off',
      '@typescript-eslint/no-non-null-assertion':         'off',
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
      // '@typescript-eslint/no-unsafe-declaration-merging': 'off',
      // '@typescript-eslint/only-throw-error':              'off', // relic: no-throw-literal
      // We want this in tests, where chai-style assertions (`expect(val).to.be.true`) are bare, but not in production code.
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
    },
  },

  // Relic settings this project doesn't carry forward at all, kept here as
  // a record of what was dropped rather than repaired:
  //   react-native/*, file-progress, progress, chai-expect, chai-friendly
  //     -- plugins with no role here
  //   react/sort-comp          -- orders class components; we write functions
  //   jsx-a11y/accessible-emoji, react/jsx-indent, react/jsx-filename-extension
  //     -- deprecated or, in the last case, unable to run on ESLint 10
  //   import-x/extensions      -- pulled; extensionless is the grain of
  //                               Next.js and the ecosystem (see STYLE.md)
  //   react/function-component-definition
  //     -- removed by Coach review; worth asking about before re-adding

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
      // A type-level test asserts with `expectTypeOf` and has no runtime to check. Without
      // this the only way to satisfy the rule is to pad it with a token runtime assertion,
      // which tells the reader nothing about what the test is for.
      'vitest/expect-expect': ['error', {
        assertFunctionNames: ['expect', 'expectTypeOf', 'accepts', 'rejects', 'expectUnchanged'],
      }],
      // A bulk example list indexes a namespace by a name from its table (`CK[ckname]`), which
      // this rule cannot follow. tsc checks the same thing properly, and does.
      'import-x/namespace': 'off',
      // Same ground as vitest/expect-expect above, but with no way to name our own assertion
      // helpers. One rule enforcing this is enough, and that one is the one we can configure.
      'sonarjs/assertions-in-tests': 'off',
      // notes/testing.md mandates bulk example lists, whose `it(blurb, ...)` title is a
      // variable by construction.
      'vitest/valid-title': 'off',
      // Chai-style assertions are bare expressions by design.
      '@typescript-eslint/no-unused-expressions': 'off',
    },
  },
])
