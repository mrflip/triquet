// eslint.config.mjs
//
// Baseline layer: eslint-config-next's own flat config, unmodified -- the
// "everyone else's" defaults for a Next.js + TypeScript app. It registers
// react, react-hooks, jsx-a11y, @next/next and @typescript-eslint.
//
// Strict layer: eslint-config-airbnb-extended, stacked on top so its rules
// win on any overlap. ESLint's flat config refuses to register the same
// plugin name twice with two different instances, so we only pull in the
// plugins airbnb-extended adds that the baseline doesn't already provide
// (stylistic, import-x, node) -- its rule sets otherwise ride on the
// plugins already registered above. This is deliberately maximal and
// deliberately unaddressed for now -- nothing here has been relaxed or
// reconciled with our own taste yet. That reconciliation is the next pass.
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'
import { configs as airbnb, plugins as airbnbPlugins } from 'eslint-config-airbnb-extended'

export default [
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
  ...nextCoreWebVitals,
  ...nextTypescript,
  airbnbPlugins.stylistic,
  airbnbPlugins.importX,
  airbnbPlugins.node,
  ...airbnb.base.all,
  ...airbnb.react.all,
  ...airbnb.next.all,
  ...airbnb.node.recommended,
]
