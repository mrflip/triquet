/**
 * Where the site serves Jazz's browser runtime (the SharedWorker script and its WASM) from, a
 * directory of its own under the static root, named for the runtime's version, so that its URL
 * changes only when the runtime does. `publish-runtime-assets.ts` puts the files there at build.
 */
export const RuntimeAssetsDir = 'jazz'

/** Each file of the runtime: where it sits in the jazz-tools package, and where Jazz looks for it under its `baseUrl` */
export const RuntimeAssetFiles = [
  { from: 'dist/worker/jazz-broker-worker.js', to: 'worker/jazz-broker-worker.js' },
  { from: 'dist/worker/jazz_wasm_bg.wasm',     to: 'jazz_wasm_bg.wasm' },
] as const

/**
 * The URL path the runtime of `version` is served under, as Jazz's `runtimeSources.baseUrl` takes it.
 *
 * @example runtimeAssetsBase('2.0.0-alpha.56-3f9a1c0b2e7d')  // => '/jazz/2.0.0-alpha.56-3f9a1c0b2e7d/'
 */
export function runtimeAssetsBase(version: string): string {
  return `/${RuntimeAssetsDir}/${version}/`
}
