/**
 * Vite's `import.meta.glob`, which hands convex-test the Convex modules to load. Vite arrives
 * only through Vitest, so its own `vite/client` types are not resolvable from here.
 */
interface ImportMeta {
  glob(pattern: string): Record<string, () => Promise<unknown>>
}
