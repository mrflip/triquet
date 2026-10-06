import { afterEach, describe, expect, it, vi } from 'vitest'
import { SyncProvider } from '../../src/app/providers'
import { renderedText } from '../support/rendering'

afterEach(() => { vi.unstubAllEnvs() })

describe('SyncProvider', () => {
  it("says the build has no database, in place of the page, when the build was given none", () => {
    vi.stubEnv('NEXT_PUBLIC_CONVEX_URL', undefined)
    expect(renderedText(<SyncProvider><p>the page</p></SyncProvider>)).to.eq('This build has no database: set NEXT_PUBLIC_CONVEX_URL.')
  })

  it("draws the page, and no notice, for a build given its database", () => {
    vi.stubEnv('NEXT_PUBLIC_CONVEX_URL', 'http://127.0.0.1:3401')
    expect(renderedText(<SyncProvider><p>the page</p></SyncProvider>)).to.eq('the page')
  })
})
