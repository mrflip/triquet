import * as Z from 'zod'
import { runAsAdmin } from './admin'
import { expect, test } from './support'

// Signing in with Google, as far as anything automated may go: to the redirect, which is read and
// never followed. Nothing here signs in to Google. A backend offers Google only where
// it has Google's keys, which Doppler's dev configs give a local one and CI never does.
test.use({ startAt: null })

/** Whether the suite's backend was given Google's keys, as `scripts/convex_dev` gives them from the environment */
const GoogleKeyed = Boolean(process.env.AUTH_GOOGLE_ID) && Boolean(process.env.AUTH_GOOGLE_SECRET)

/** What `auth:signIn` answers for Google: the deployment's address to send the browser to */
const Started = Z.object({ redirect: Z.string() })

test.describe('Google sign-in', () => {
  test('is offered exactly where the backend has Google\'s keys', async () => {
    expect(await runAsAdmin('auth:offered', {})).toEqual({ google: GoogleKeyed })
  })

  test('is sent from the deployment to Google, with our client, our callback and openid email profile, and goes no further', { tag: '@smoke' }, async ({ page }) => {
    // eslint-disable-next-line playwright/no-skipped-test -- CI holds no Google keys, by the sprint's rule, so there is no redirect to read; the test above holds it to that
    test.skip(! GoogleKeyed, 'This backend has no Google keys (CI never has them)')
    const { redirect } = Started.parse(await runAsAdmin('auth:signIn', { provider: 'google', params: { redirectTo: '/' } }))
    const deployment = new URL(redirect)
    expect(deployment.pathname).toBe('/api/auth/signin/google')
    // The deployment's answer is read, not followed: a route cannot catch a redirect the server
    // makes, so no browser is ever pointed at the deployment's sign-in address.
    const response = await page.request.get(redirect, { maxRedirects: 0 })
    expect(response.status()).toBe(302)
    const asked = new URL(String(response.headers().location))
    expect(`${asked.origin}${asked.pathname}`).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    expect(Object.fromEntries(['client_id', 'redirect_uri', 'scope', 'response_type', 'code_challenge_method'].map((key) => [key, asked.searchParams.get(key)]))).toEqual({
      client_id:             process.env.AUTH_GOOGLE_ID,
      redirect_uri:          `${deployment.origin}/api/auth/callback/google`,
      scope:                 'openid email profile',
      response_type:         'code',
      code_challenge_method: 'S256',
    })
    // The only cookies are Convex Auth's own short-lived ones for the sign-in, as the privacy policy says
    const cookies = await page.context().cookies(deployment.origin)
    expect(cookies.map((cookie) => cookie.name).filter((cookiename) => ! /^(__Host-)?google(OAuth(state|pkce|nonce)|RedirectTo)$/.test(cookiename))).toEqual([])
  })
})
