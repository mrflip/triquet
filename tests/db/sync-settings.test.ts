import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ZodError } from 'zod'
import { syncSettings } from '../../src/db/sync-settings'

describe('syncSettings', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_JAZZ_APP_ID', 'triquet-test')
    vi.stubEnv('NEXT_PUBLIC_JAZZ_SERVER_URL', 'http://127.0.0.1:3202')
    vi.stubEnv('NEXT_PUBLIC_JAZZ_LOG_LEVEL', undefined)
    vi.stubEnv('NEXT_PUBLIC_JAZZ_RUNTIME_VERSION', undefined)
  })

  afterEach(() => { vi.unstubAllEnvs() })

  it('reads the app and server, and logs at debug unless told otherwise', () => {
    expect(syncSettings()).to.deep.include({ appId: 'triquet-test', serverUrl: 'http://127.0.0.1:3202', logLevel: 'debug' })
  })

  it('leaves Jazz to load its runtime from the bundle when the build published none', () => {
    expect(syncSettings()?.runtimeSources).to.eq(undefined)
  })

  it('points Jazz at the runtime the build published, by its version', () => {
    vi.stubEnv('NEXT_PUBLIC_JAZZ_RUNTIME_VERSION', '2.0.0-alpha.56-3f9a1c0b2e7d')
    expect(syncSettings()?.runtimeSources).to.deep.eq({ baseUrl: '/jazz/2.0.0-alpha.56-3f9a1c0b2e7d/', wasmVersion: '2.0.0-alpha.56-3f9a1c0b2e7d' })
  })

  it('refuses a runtime version that would not stay one segment of a path', () => {
    vi.stubEnv('NEXT_PUBLIC_JAZZ_RUNTIME_VERSION', '..')
    expect(() => syncSettings()).to.throw(ZodError)
  })

  it('takes the log level the build was given', () => {
    vi.stubEnv('NEXT_PUBLIC_JAZZ_LOG_LEVEL', 'trace')
    expect(syncSettings()?.logLevel).to.eq('trace')
  })

  it('refuses a log level Jazz does not have', () => {
    vi.stubEnv('NEXT_PUBLIC_JAZZ_LOG_LEVEL', 'chatty')
    expect(() => syncSettings()).to.throw(ZodError)
  })

  it('is undefined when the build was given nowhere to sync to', () => {
    vi.stubEnv('NEXT_PUBLIC_JAZZ_SERVER_URL', undefined)
    expect(syncSettings()).to.eq(undefined)
  })

  it('refuses a server that is not a URL', () => {
    vi.stubEnv('NEXT_PUBLIC_JAZZ_SERVER_URL', 'nowhere')
    expect(() => syncSettings()).to.throw(ZodError)
  })
})
