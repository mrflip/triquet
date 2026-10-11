import { describe, expect, it, vi } from 'vitest'
import type { ConvexAuthActionsContext } from '@convex-dev/auth/react'
import { returnPathOf, startGoogleSignIn } from '../../src/state/use-google-sign-in'

describe('returnPathOf', () => {
  const Cases: [Pick<Location, 'pathname' | 'search' | 'hash'>, string, string][] = [
    [{ pathname: '/~flip_kromer/quiet_otter', search: '?q=1', hash: '' }, '/~flip_kromer/quiet_otter?q=1', 'a page with a query'],
    [{ pathname: '/', search: '', hash: '' },                             '/',                             'the front door'],
    [{ pathname: '/my', search: '', hash: '#hunts' },                     '/my#hunts',                     'a page with a fragment'],
  ]
  for (const [here, expected, describes] of Cases) {
    it(`is the page's own path, relative: ${describes}`, () => {
      expect(returnPathOf(here)).to.eq(expected)
    })
  }
})

describe('startGoogleSignIn', () => {
  it('signs in with Google, to come back to the page it started on', async () => {
    const signIn = vi.fn<ConvexAuthActionsContext['signIn']>(() => Promise.resolve({ signingIn: false }))
    await startGoogleSignIn(signIn, { pathname: '/~flip_kromer/quiet_otter', search: '', hash: '' })
    expect(signIn.mock.calls).to.deep.eq([['google', { redirectTo: '/~flip_kromer/quiet_otter' }]])
  })
})
