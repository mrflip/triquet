import * as Z from 'zod'
import { AppNotices, keepHandleNotice, nameChoiceQuestion, signedInAsNotice, signOutQuestion } from '../src/lib/notices'
import { mergeInto, runAsAdmin, vouchFor } from './admin'
import { assumeUserlabel, expect, openUserMenu, otherVisitor, test } from './support'

// Signing in with Google, as far as anything automated may go: to the redirect, which is read and
// never followed, and to the deployment's sign-in route, where a browser is stopped. Nothing here
// signs in to Google. A backend offers Google only where it has Google's keys, which Doppler's dev
// configs give a local one and CI never does. What a sign-in leaves is stood in for: a user vouched
// for as signed in with Google (`vouchFor`), and a merge's mark (`mergeInto`).
test.use({ startAt: null })

/** Whether the suite's backend was given Google's keys, as `scripts/convex_dev` gives them from the environment */
const GoogleKeyed = Boolean(process.env.AUTH_GOOGLE_ID) && Boolean(process.env.AUTH_GOOGLE_SECRET)

/** What `auth:signIn` answers for Google: the deployment's address to send the browser to */
const Started = Z.object({ redirect: Z.string() })

test.describe('Google sign-in', () => {
  test('is offered exactly where the backend has Google\'s keys', async () => {
    expect(await runAsAdmin('auth:offered', {})).toEqual({ google: GoogleKeyed })
  })

  test('is sent from the deployment to Google, with our client, our callback and openid email profile, and goes no further', async ({ page }) => {
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

/** The deployment's sign-in route, where Convex Auth sends a browser on its way to Google: a spec stops the browser here, and the deployment never answers it */
const SignInRoute = '**/api/auth/signin/google**'

/** What a spec answers a browser sent to the deployment's sign-in route in its place, so the browser goes no further */
const StoppedBeforeGoogle = 'Stopped before the deployment sent this browser to Google'

test.describe('the front door', () => {
  test("offers signing in with Google beside choosing a handle, exactly where the backend has Google's keys", async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('textbox', { name: 'Handle', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign in with Google' })).toHaveCount(Number(GoogleKeyed))
  })

  test("leaves for the deployment's sign-in when asked, coming back to the front door, and is stopped there, never reaching Google", async ({ page }) => {
    // eslint-disable-next-line playwright/no-skipped-test -- CI holds no Google keys, by the sprint's rule, so there is no button to press; the test above holds it to that
    test.skip(! GoogleKeyed, 'This backend has no Google keys (CI never has them)')
    await page.route(SignInRoute, async (route) => { await route.fulfill({ status: 200, contentType: 'text/plain', body: StoppedBeforeGoogle }) })
    await page.goto('/')
    await page.getByRole('button', { name: 'Sign in with Google' }).click()
    await expect(page.getByText(StoppedBeforeGoogle)).toBeVisible()
    await expect(page).toHaveURL(/\/api\/auth\/signin\/google\?code=/)
  })
})

test.describe('the user menu', () => {
  test('offers an anonymous user signing in with Google to keep its handle on every device, where the backend has the keys', async ({ page }) => {
    // eslint-disable-next-line playwright/no-skipped-test -- CI holds no Google keys, by the sprint's rule, so nothing is offered; the front door's test holds it to that
    test.skip(! GoogleKeyed, 'This backend has no Google keys (CI never has them)')
    const label = await assumeUserlabel(page)
    const menu = await openUserMenu(page)
    await expect(menu.getByText(keepHandleNotice(label))).toBeVisible()
    await expect(menu.getByRole('button', { name: 'Sign in with Google' })).toBeVisible()
    await expect(menu.getByRole('menuitem', { name: /^Sign out/ })).toHaveCount(0)
  })

  test("shows a user signed in with Google its own email, and signs it out once asked twice, the browser left with no handle", async ({ page }) => {
    const label = await assumeUserlabel(page)
    await vouchFor(label, `${label}@example.com`)
    await page.reload()
    // The page has heard from the server, so the menu's button answers a press
    await expect(page.getByText(`(@${label})`)).toBeVisible()
    const menu = await openUserMenu(page)
    await expect(menu.getByText(signedInAsNotice(`${label}@example.com`))).toBeVisible()
    await expect(menu.getByRole('button', { name: 'Sign in with Google' })).toHaveCount(0)
    await menu.getByRole('menuitem', { name: `${AppNotices.signOut}…` }).click()
    await expect(menu.getByText(signOutQuestion(label))).toBeVisible()
    await menu.getByRole('button', { name: AppNotices.staySignedIn }).click()
    await menu.getByRole('menuitem', { name: `${AppNotices.signOut}…` }).click()
    await menu.getByRole('button', { name: AppNotices.signOut, exact: true }).click()
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('textbox', { name: 'Handle', exact: true })).toHaveValue('')
    await page.goto('/my/hunts')
    await expect(page).toHaveURL(/\/\?then=%2Fmy%2Fhunts$/)
  })
})

test.describe('the name choice a merge leaves', () => {
  test("asks on whatever page is open which handle to keep, and keeping the merged browser's makes it the user's own", { tag: '@smoke' }, async ({ page, browser }) => {
    const own = await assumeUserlabel(page)
    await vouchFor(own)
    const merged = await assumeUserlabel(await otherVisitor(browser))
    await mergeInto(merged, own)
    const dialog = page.getByRole('dialog', { name: AppNotices.nameChoiceTitle })
    await expect(dialog).toContainText(nameChoiceQuestion(merged, own))
    await dialog.getByRole('button', { name: `Keep ${merged}` }).click()
    await expect(dialog).toBeHidden()
    await expect(page.getByText(`(@${merged})`)).toBeVisible()
  })

  test('puts the choice off for the tab, asks it again on the next load, and keeps the user\'s own handle when asked to', async ({ page, browser }) => {
    const own = await assumeUserlabel(page)
    await vouchFor(own)
    const merged = await assumeUserlabel(await otherVisitor(browser))
    await mergeInto(merged, own)
    const dialog = page.getByRole('dialog', { name: AppNotices.nameChoiceTitle })
    await dialog.getByRole('button', { name: AppNotices.nameChoiceLater }).click()
    await expect(dialog).toBeHidden()
    await page.reload()
    await dialog.getByRole('button', { name: `Keep ${own}` }).click()
    await expect(dialog).toBeHidden()
    await expect(page.getByText(`(@${own})`)).toBeVisible()
    await page.reload()
    await expect(page.getByText(`(@${own})`)).toBeVisible()
    await expect(dialog).toHaveCount(0)
  })
})
