// Drop this near the top of eslint.config.mjs, above `export default`.
//
// Scoped by *import source*, not by importing file: it fires on `import { foo } from '.../lib/bar'`
// wherever that happens, and has no opinion at all about React, MUI, or Next imports, since those
// don't match the pattern. Type imports are exempt -- `import type { FooT }` stays named.

const preferNamespaceImport = {
  meta: {
    type: 'suggestion',
    docs: { description: 'Import lib modules as a namespace, so their facilities stay namespaced' },
    messages: {
      preferNamespace: "Import '{{source}}' as a namespace (`import * as Foo from '{{source}}'`). Named imports from a lib module drop its facilities into this file's namespace; see STYLE.md.",
    },
    schema: [{
      type: 'object',
      properties: {
        pattern: { type: 'string' },
        exempt:  { type: 'string' },
      },
      additionalProperties: false,
    }],
  },
  create(context) {
    const opts    = context.options[0] ?? {}
    const pattern = new RegExp(opts.pattern ?? '(^|/)lib/')
    const exempt  = opts.exempt ? new RegExp(opts.exempt) : null
    return {
      ImportDeclaration(node) {
        const source = node.source.value
        if (node.importKind === 'type') { return }
        if (! pattern.test(source)) { return }
        if (exempt && exempt.test(source)) { return }
        const hasNamed = node.specifiers.some((spec) => (
          spec.type === 'ImportSpecifier' && spec.importKind !== 'type'
        ))
        if (! hasNamed) { return }
        context.report({ node, messageId: 'preferNamespace', data: { source } })
      },
    }
  },
}

// ---------------------------------------------------------------------------
// Wiring. Add to the `app/base` config object:

//     plugins: {
//       '@stylistic': stylistic,
//       'local':      { rules: { 'prefer-namespace-import': preferNamespaceImport } },
//     },
//
//     rules: {
//       // Advisory: lib modules are facilities, not loose functions. See STYLE.md.
//       // `exempt` keeps hook modules on named imports, so eslint-plugin-react-hooks
//       // can still recognise `useThing()` by name.
//       'local/prefer-namespace-import': ['warn', { pattern: '(^|/)lib/', exempt: '(^|/)lib/hooks(/|$)' }],
//     },

// ---------------------------------------------------------------------------
// And a separate block, so lib modules export named facilities while `app/` keeps the
// default exports Next.js requires:

//     {
//       name: 'app/lib',
//       files: ['src/lib/**/*.ts'],
//       rules: {
//         'import-x/no-default-export': 'error', // a namespace import of a default export is useless
//         'import-x/no-anonymous-default-export': 'error',
//       },
//     },

export { preferNamespaceImport }
