import { Validator } from '../lib/validator'
import { runtimeAssetsBase } from './runtime-assets'

/** How much Jazz's own runtime says in the console, quietest first */
export const JazzLogLevelVals = ['error', 'warn', 'info', 'debug', 'trace'] as const

const SyncSettingsValidators = Validator(({ obj, oneof, str, zod }) => {
  const syncSettings = obj({
    appId:     str.trim().min(1)
      .describe('Which Jazz app this browser syncs, from NEXT_PUBLIC_JAZZ_APP_ID.'),
    serverUrl: zod.url()
      .describe('Where the Jazz sync server listens, from NEXT_PUBLIC_JAZZ_SERVER_URL.'),
    logLevel:  str.pipe(oneof(JazzLogLevelVals)).default('debug')
      .describe('How much Jazz\'s runtime logs, from NEXT_PUBLIC_JAZZ_LOG_LEVEL. Its storage and sync run in a shared worker, whose console is apart from the page\'s.'),
    runtimeSources: obj({
      baseUrl:     str.startsWith('/'),
      wasmVersion: str.regex(/^\w[\w.+-]*$/),
    }).optional()
      .describe('Where the site serves Jazz\'s worker and WASM, and the version they are served as, from NEXT_PUBLIC_JAZZ_RUNTIME_VERSION. Absent, Jazz loads them from the bundle.'),
  })
  return { syncSettings }
})

/** Where the browser's Jazz database syncs to: the part of a Jazz session's config the host supplies */
export type SyncSettings = ReturnType<typeof SyncSettingsValidators.syncSettings>

/**
 * The Jazz app id and sync server URL this build was given, or undefined when it was given none,
 * with how much Jazz should log (`debug` unless the build was told otherwise) and where the site
 * serves Jazz's runtime.
 *
 * In development `withJazz` (in `next.config.ts`) supplies the app and server from the server it
 * starts; a production host supplies them through its own environment. `next.config.ts` sets the
 * runtime's version as it publishes the runtime. Next inlines them all at build time, so they are
 * read by their literal names.
 *
 * @returns The validated settings, or undefined when either variable is unset.
 * @throws When a variable is set but holds something unusable, such as a URL that does not parse.
 *
 * @example syncSettings()  // => { appId: '6f1c…', serverUrl: 'http://127.0.0.1:3201', logLevel: 'debug' } under `pnpm dev:agent`
 */
export function syncSettings(): SyncSettings | undefined {
  const appId = process.env.NEXT_PUBLIC_JAZZ_APP_ID
  const serverUrl = process.env.NEXT_PUBLIC_JAZZ_SERVER_URL
  if (appId === undefined || serverUrl === undefined) { return undefined }
  const logLevel = process.env.NEXT_PUBLIC_JAZZ_LOG_LEVEL
  const runtimeVersion = process.env.NEXT_PUBLIC_JAZZ_RUNTIME_VERSION
  const runtimeSources = runtimeVersion === undefined ? undefined : { baseUrl: runtimeAssetsBase(runtimeVersion), wasmVersion: runtimeVersion }
  return SyncSettingsValidators.syncSettings({ appId, serverUrl, logLevel, runtimeSources })
}
