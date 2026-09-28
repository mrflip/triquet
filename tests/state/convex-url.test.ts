import { afterEach, describe, expect, it, vi } from 'vitest'
import * as Z from 'zod'
import { convexUrl } from '../../src/state/convex-url'

afterEach(() => { vi.unstubAllEnvs() })

describe('convexUrl', () => {
  it('is the URL the build was given', () => {
    expect(convexUrl('http://127.0.0.1:3401')).to.eq('http://127.0.0.1:3401')
    expect(convexUrl('https://quiet-otter-123.convex.cloud')).to.eq('https://quiet-otter-123.convex.cloud')
  })

  it('reads NEXT_PUBLIC_CONVEX_URL when handed nothing', () => {
    vi.stubEnv('NEXT_PUBLIC_CONVEX_URL', 'http://127.0.0.1:3402')
    expect(convexUrl()).to.eq('http://127.0.0.1:3402')
  })

  it('is undefined for a build given none, or given it blank', () => {
    vi.stubEnv('NEXT_PUBLIC_CONVEX_URL', undefined)
    expect([convexUrl(), convexUrl('')]).to.deep.eq([undefined, undefined])
  })

  it('refuses something that is not a URL, rather than failing to connect later', () => {
    expect(() => convexUrl('127.0.0.1:3401 ')).to.throw(Z.ZodError)
  })
})
