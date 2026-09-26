import { Validator } from '../lib/validator'

const SyncSettingsValidators = Validator(({ obj, str, zod }) => {
  const syncSettings = obj({
    appId:     str.trim().min(1)
      .describe('Which Jazz app this browser syncs, from NEXT_PUBLIC_JAZZ_APP_ID.'),
    serverUrl: zod.url()
      .describe('Where the Jazz sync server listens, from NEXT_PUBLIC_JAZZ_SERVER_URL.'),
  })
  return { syncSettings }
})

/** Where the browser's Jazz database syncs to: the part of a Jazz session's config the host supplies */
export type SyncSettings = ReturnType<typeof SyncSettingsValidators.syncSettings>

/**
 * The Jazz app id and sync server URL this build was given, or undefined when it was given none.
 *
 * In development `withJazz` (in `next.config.ts`) supplies both from the server it starts; a
 * production host supplies them through its own environment. Next inlines them at build time,
 * so they are read by their literal names.
 *
 * @returns The validated settings, or undefined when either variable is unset.
 * @throws When a variable is set but holds something unusable, such as a URL that does not parse.
 *
 * @example syncSettings()  // => { appId: '6f1c…', serverUrl: 'http://127.0.0.1:3201' } under `pnpm dev:agent`
 */
export function syncSettings(): SyncSettings | undefined {
  const appId = process.env.NEXT_PUBLIC_JAZZ_APP_ID
  const serverUrl = process.env.NEXT_PUBLIC_JAZZ_SERVER_URL
  if (appId === undefined || serverUrl === undefined) { return undefined }
  return SyncSettingsValidators.syncSettings({ appId, serverUrl })
}
