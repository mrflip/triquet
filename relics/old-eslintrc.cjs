/* eslint-disable quote-props, array-bracket-spacing */
const rules = {
  // == [Customizations for JS + TS] == (may be overridden by tsRules). Please preserve alphabetical order, with slashed/plugins last

  "consistent-this":                        [2, "self", "thisStore", "thisWorld", "thisQB", "innerQB"],
  // "comma-dangle":                        ["warn", "always-multiline"],
  "default-param-last":                     2,
  "eol-last":                               ["warn", "always"],
  "func-style":                             [ "error", "declaration", { "allowArrowFunctions": true } ],
  "function-paren-newline":                 [1, "consistent"],
  "function-call-argument-newline":         [1, "consistent"],
  "generator-star-spacing":                 ["warn", { before: true, after: true }],
  "import/extensions":                      [2, "always"],
  "import/no-extraneous-dependencies":      [2, { devDependencies: ['**/test*/**/*.*', 'scripts/**/*.*', '**/codegen/*.*'] }],
  "indent":                                 [ "warn",  2 ],
  "linebreak-style":                        [ "error", "unix" ],
  "no-console":                             [ "warn", { allow: ["warn", "error"] } ],
  "no-constructor-return":                  2,
  "no-dupe-else-if":                        2,
  "no-else-return":                         1,
  "no-implicit-coercion":                   [2, { allow: ['!!'] }],
  "no-implicit-globals":                    2,
  "no-mixed-operators":                     2,
  "no-multiple-empty-lines":                1,
  "no-native-reassign":                     2,
  "no-negated-condition":                   2,
  "no-trailing-spaces":                     1,
  "no-unsafe-negation":                     ["error", { "enforceForOrderingRelations": true }],
  "no-unused-vars":                         [ "warn", { "varsIgnorePattern": "^(_.*|UF|TH|TY|VT|DX|SRS|Errors|Lembas|Valar|Arda|Utils)$", argsIgnorePattern: "^(_.*)$" }],
  "prefer-destructuring":                   [ "warn", { object: true, array: false }],
  "semi":                                   [ "warn",  "never" ],
  "space-unary-ops":                        [ "warn",  { "overrides": { "!": true } } ],
  "jest/no-focused-tests":                  ["warn"],
  "jest/no-disabled-tests":                 ["warn"],

  // --

  // == [Disabled rules for JS + TS] -- pleas preserve alphabetical order

  "arrow-body-style":                       0, // () => { return 3 } is ok
  // use any of the shown named variables   and eslint is cool about it.
  "camelcase":                              0,
  "class-methods-use-this":                 0,
  "file-progress/activate":                 0,
  "import/no-named-as-default":             0,
  "import/no-named-as-default-member":      0,
  "import/no-useless-path-segments":        0,
  "import/prefer-default-export":           0,
  "key-spacing":                            0,
  "lines-between-class-members":            0,
  "max-classes-per-file":                   0,
  "max-len":                                0,
  "newline-per-chained-call":               0,
  "no-await-in-loop":                       0,
  "no-continue":                            0,
  "no-inner-declarations":                  0,
  "no-multi-spaces":                        0,
  "no-restricted-syntax":                   0,
  "no-return-await":                        0,
  "no-underscore-dangle":                   0,
  "no-use-before-define":                   0,
  "no-useless-escape":                      0,
  "no-useless-rename":                      0,
  "object-curly-newline":                   0,
  "object-property-newline":                0,
  "padded-blocks":                          0,
  "prefer-template":                        0, // just be thoughtful with the string + string please
  "progress/activate":                      0,
  "quotes":                                 0,
  // --

  // == [Disabled rules for JS + TS plugins]

  "jest/prefer-importing-jest-globals":     0,
  "jest/padding-around-all":                0,
  "jest/padding-around-after-all-blocks":   0,
  "jest/padding-around-before-all-blocks":  0,
  "jest/padding-around-after-each-blocks":  0,
  "jest/padding-around-before-each-blocks": 0,
  "jest/padding-around-expect-groups":      0,
  "jest/padding-around-test-blocks":        0,
  "jest/padding-around-describe-blocks":    0,
  "jest/lowercase-name":                    0,
  "jest/max-expects":                       0,
  "jest/no-conditional-in-test":            0,
  "jest/no-hooks":                          0,
  "jest/no-if":                             0,
  "jest/prefer-expect-assertions":          0,
  "jest/prefer-lowercase-title":            0,
  "jest/require-hook":                      0,
  "jest/unbound-method":                    0,
  "jest/valid-expect":                      0,

  // --
}

const tsRules = {
  ...rules,

  // == [Customizations for JS + TS]

  "lines-between-class-members":              0, // removed in favor of the typescript replacements
  "no-unused-vars":                           0, // removed in favor of the typescript replacements
  "indent":                                   0, // removed in favor of the typescript replacements
  "@typescript-eslint/no-floating-promises":  ["error", {
    "checkThenables": false,
    "allowForKnownSafePromises": [
      { "from": "file", "name": "KQB" },
      { "from": "package", "name": "Where", "package": "knex" },
    ],
  }],
  "@typescript-eslint/no-misused-promises":   2,
  "@typescript-eslint/comma-dangle":          ["warn", "always-multiline"],
  "@typescript-eslint/default-param-last":    2,
  "@typescript-eslint/indent":                [ "warn",  2, { SwitchCase: 0 } ],
  "@typescript-eslint/no-unused-vars":        [ "warn", { "varsIgnorePattern": "^(_.*|UF|TH|TY|VT|DX|SRS|Errors|Lembas|Valar|Arda|Utils)$", argsIgnorePattern: "^(_.*)$" }],
  "@typescript-eslint/semi":                  [ "warn",  "never" ],
  // --

  // == [Disabled rules for JS + TS plugins]
  "@typescript-eslint/explicit-module-boundary-types": 0,
  "@typescript-eslint/object-property-newline":        0,
  "@typescript-eslint/no-unused-expressions":          0,
  "@typescript-eslint/camelcase":                      0,
  "@typescript-eslint/class-methods-use-this":         0,
  "@typescript-eslint/key-spacing":                    0,
  "@typescript-eslint/lines-between-class-members":    0,
  "@typescript-eslint/no-await-in-loop":               0,
  "@typescript-eslint/no-continue":                    0,
  "@typescript-eslint/no-multi-spaces":                0,
  "@typescript-eslint/no-non-null-assertion":          0,
  "@typescript-eslint/no-restricted-syntax":           0,
  "@typescript-eslint/return-await":                   0,
  "@typescript-eslint/no-throw-literal":               0,
  "@typescript-eslint/no-underscore-dangle":           0,
  "@typescript-eslint/no-unsafe-declaration-merging":  0,
  "@typescript-eslint/no-use-before-define":           0,
  "@typescript-eslint/no-useless-rename":              0,
  "@typescript-eslint/no-useless-escape":              0,
  "@typescript-eslint/object-curly-newline":           0,
  "@typescript-eslint/padded-blocks":                  0,
  "@typescript-eslint/quotes":                         0,
  "@typescript-eslint/naming-convention":              0,
  "@typescript-eslint/ban-ts-comment":                 0,
  "@typescript-eslint/no-explicit-any":                0,
  "@typescript-eslint/no-empty-interface":             0,
  "@typescript-eslint/no-this-alias":                  0,
  "@typescript-eslint/no-useless-constructor":         0,
  // --
}

module.exports = {
  root:                 true,
  rules,
  env: {
    browser:            false,
    es2020:             true,
    "jest/globals":     true,
  },
  extends: [
    "plugin:jest/all",
    "plugin:chai-expect/recommended",
    "plugin:chai-friendly/recommended",
  ],
  globals: {
    Atomics:            'readonly',
    SharedArrayBuffer:  'readonly',
    expect:             'readonly',
    pm:                 'readonly',
    sinon:              'readonly',
    jestExpect:         'readonly',
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaFeatures:       { impliedStrict: true },
    ecmaVersion:        'latest',
    sourceType:         'module',
  },
  overrides: [
    {
      files: ['*.js', '*.jsx', '*.mjs', '*.cjs'],
      extends: [
        'airbnb-base',
      ],
      rules,
    },
    {
      files: ['*.ts', '*.tsx'],
      extends: [
        'plugin:@typescript-eslint/recommended',
        'airbnb-typescript/base',
        // 'plugin:@typescript-eslint/recommended-requiring-type-checking',
      ],
      parserOptions: { project: ['./tsconfig.eslint.json'] },
      rules: tsRules,
    },
  ],

  settings: {
    'import/resolver': {  node: true }, // extensions: ['.js', '.mjs', '.ts', '.tsx'],
    typescript: {
      alwaysTryTypes: true,              // Ensure TypeScript resolver looks for types
      project: './tsconfig.eslint.json', // Adjust this path if necessary
    },
  },

  plugins:              [
    "jest",
    "chai-expect",
    "chai-friendly",
    '@typescript-eslint',
    "file-progress",
    "progress",
    // "import",
    // 'airbnb/base',
  ],

  ignorePatterns: ['node_modules/', 'flow-typed', '*.d.ts', '*.t.ts', '*.t.js', '*.json', '*.graphql', '_aside*/**/*', 'aside/**/*', 'built*/**/*', '**/built*/**/*', '**/built', '.yarn'],
}
