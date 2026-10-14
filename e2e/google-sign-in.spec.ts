import * as Z from 'zod'
import { AppNotices, GoogleSignInUnfinished, googleGateNotice, googleSignInUnfinishedNotice, keepHandleNotice, nameChoiceQuestion, signedInAsNotice } from '../src/lib/notices'
import * as Routes from '../src/lib/routes'
import { MockClientId } from '../scripts/mock-google.ts'
import { keptOf, runAsAdmin } from './admin'
import { answerGoogleAs, continueWithGoogle, freshGoogleAccount, GoogleButton, mockIssuerUrl, signUpWithGoogle, userMenuSaying } from './google'
import { assumeUserlabel, expect, freshUserlabel, huntMadeFor, huntOf, landedAfterSignUp, openUserMenu, otherVisitor, startHunt, test } from './support'

// Signing in with Google, all the way through: the suite's backend signs in with a stand-in for
// Google on this machine (`scripts/mock-google.ts`), in CI as locally, so every spec here leaves
// for the stand-in's consent step and comes back, and the backend exchanges the code with it as
// it would with Google. Which account answers, or whether consent is refused, each spec says
// (`answerGoogleAs`, in `google.ts`).
test.use({ startAt: null })

/** What `auth:signIn` answers for Google: the deployment's address to send the browser to */
const Started = Z.object({ redirect: Z.string() })

test.describe("Google sign-in", () => {
  test("is offered by the suite's backend, which signs in with the stand-in for Google", async () => {
    expect(await runAsAdmin('auth:offered', {})).toEqual({ google: true })
  })

  test("is sent from the deployment to the consent step, with our client, our callback and openid email profile", async ({ page }) => {
    const { redirect } = Started.parse(await runAsAdmin('auth:signIn', { provider: 'google', params: { redirectTo: '/' } }))
    const deployment = new URL(redirect)
    expect(deployment.pathname).toBe('/api/auth/signin/google')
    const response = await page.request.get(redirect, { maxRedirects: 0 })
    expect(response.status()).toBe(302)
    const asked = new URL(String(response.headers().location))
    expect(`${asked.origin}${asked.pathname}`).toBe(`${mockIssuerUrl()}/authorize`)
    expect(Object.fromEntries(['client_id', 'redirect_uri', 'scope', 'response_type', 'code_challenge_method'].map((key) => [key, asked.searchParams.get(key)]))).toEqual({
      client_id:             MockClientId,
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

test.describe("signing up with Google", () => {
  test("makes a new visitor at the front door a verified account, under the name and handle they add, keeping what Google sent", async ({ page }) => {
    const account = freshGoogleAccount({ name: 'Ada Lovelace', locale: 'en-GB', hd: 'example.org' })
    await page.goto('/')
    await answerGoogleAs(page, account)
    await page.getByRole('button', { name: GoogleButton.signIn }).click()
    await expect(page.getByRole('heading', { name: AppNotices.googleGateTitle })).toBeVisible()
    await expect(page.getByText(googleGateNotice(account.email))).toBeVisible()
    // The name Google sent is offered, and a handle made from it
    await expect(page.getByRole('textbox', { name: 'Your name' })).toHaveValue('Ada Lovelace')
    await expect(page.getByRole('textbox', { name: 'Handle', exact: true })).toHaveValue(/^ada_lovelace/)
    const label = freshUserlabel()
    await page.getByRole('textbox', { name: 'Handle', exact: true }).fill(label)
    await page.getByRole('button', { name: AppNotices.saveName, exact: true }).click()
    await landedAfterSignUp(page, label)
    const menu = await openUserMenu(page)
    await expect(menu.getByText(signedInAsNotice(account.email))).toBeVisible()
    const kept = await keptOf(label)
    expect(kept).toMatchObject({ anonymous: false, email: account.email, name: 'Ada Lovelace', locale: 'en-GB', hosted_domain: 'example.org' })
    expect(kept.email_verified_at).toBeGreaterThan(0)
  })

  test("from a link to a hunt, comes back to the hunt once the handle is added", async ({ page, friendLabel }) => {
    const { org, hunt } = huntOfAddress(await huntMadeFor(friendLabel))
    const address = Routes.huntPath({ org, hunt })
    await page.goto(address)
    await expect(page).toHaveURL((url) => url.pathname === '/' && url.searchParams.get('then') === address)
    await signUpWithGoogle(page, { from: address })
  })

  test("keeps no verification for an email Google says is not verified, and signs the visitor up all the same", async ({ page }) => {
    const account = freshGoogleAccount({ email_verified: false })
    const { label } = await signUpWithGoogle(page, { account })
    expect(await keptOf(label)).toMatchObject({ anonymous: false, email: account.email, email_verified_at: null })
  })

  test("says so when consent is refused, and leaves the visitor at the front door as they were", async ({ page }) => {
    await page.goto('/')
    await answerGoogleAs(page, 'refused')
    await page.getByRole('button', { name: GoogleButton.signIn }).click()
    await expect(page.getByRole('alert').filter({ hasText: GoogleSignInUnfinished })).toContainText(googleSignInUnfinishedNotice(null))
    await expect(page.getByRole('heading', { name: AppNotices.userlabelGateTitle })).toBeVisible()
    await expect(page.getByRole('button', { name: GoogleButton.signIn })).toBeVisible()
  })
})

/** The hunt an address names, by its org and label: `/~<org>/<hunt>/...` */
function huntOfAddress(address: string): Routes.HuntLabels {
  const [, org = '', hunt = ''] = address.split('/', 3)
  return { org: org.replace(/^~/, ''), hunt }
}

test.describe("verifying a standalone account", () => {
  test("from the user menu, keeps its handle and its hunt, comes back to the page it was on, and keeps what Google sent", async ({ page }) => {
    const label = await startHunt(page)
    const { hunt } = huntOf(page)
    const account = freshGoogleAccount({ locale: 'fr', hd: 'example.org' })
    await answerGoogleAs(page, account)
    await continueWithGoogle(page)
    await expect(page).toHaveURL((url) => url.pathname.startsWith(Routes.huntPath({ org: label, hunt })) && ! url.searchParams.has('code'))
    const menu = await userMenuSaying(page, signedInAsNotice(account.email))
    await expect(menu.getByText(`@${label}`)).toBeVisible()
    expect(await keptOf(label)).toMatchObject({ anonymous: false, email: account.email, locale: 'fr', hosted_domain: 'example.org' })
    await page.goto(Routes.huntsPath())
    await expect(page.getByRole('table', { name: 'Your hunts' }).getByRole('rowheader').getByRole('link')).toHaveAttribute('href', Routes.huntPath({ org: label, hunt }))
  })

  test("says so when consent is refused, and leaves the account standalone, under its handle", async ({ page }) => {
    const label = await assumeUserlabel(page)
    await answerGoogleAs(page, 'refused')
    await continueWithGoogle(page)
    await expect(page.getByRole('alert').filter({ hasText: GoogleSignInUnfinished })).toContainText(googleSignInUnfinishedNotice(label))
    await page.goto(Routes.huntsPath())
    await expect(page.getByText(`(@${label})`)).toBeVisible()
    expect(await keptOf(label)).toMatchObject({ anonymous: true })
  })
})

test.describe("signing in again", () => {
  test("switches a fresh browser at the front door to the Google account's own user", async ({ page, browser }) => {
    const { label, account } = await signUpWithGoogle(page)
    const elsewhere = await otherVisitor(browser)
    await elsewhere.goto('/')
    await answerGoogleAs(elsewhere, account)
    await elsewhere.getByRole('button', { name: GoogleButton.signIn }).click()
    await expect(elsewhere).toHaveURL(/\/my\/hunts$/)
    await expect(elsewhere.getByText(`(@${label})`)).toBeVisible()
  })

  test("merges a standalone account into the Google account's user, which asks which handle to keep, and keeping the browser's makes it the user's own", { tag: '@smoke' }, async ({ page, browser }) => {
    const { label: own, account } = await signUpWithGoogle(page)
    const elsewhere = await otherVisitor(browser)
    const merged = await assumeUserlabel(elsewhere)
    await answerGoogleAs(elsewhere, account)
    await continueWithGoogle(elsewhere)
    const dialog = elsewhere.getByRole('dialog', { name: AppNotices.nameChoiceTitle })
    await expect(dialog).toContainText(nameChoiceQuestion(merged, own))
    await dialog.getByRole('button', { name: `Keep ${merged}` }).click()
    await expect(dialog).toBeHidden()
    await elsewhere.goto(Routes.huntsPath())
    await expect(elsewhere.getByText(`(@${merged})`)).toBeVisible()
    expect(await keptOf(merged)).toMatchObject({ anonymous: false, email: account.email })
  })

  test("leaves the name choice for later in the tab, asks it again on the next load, and keeps the user's own handle when asked to", async ({ page, browser }) => {
    const { label: own, account } = await signUpWithGoogle(page)
    const elsewhere = await otherVisitor(browser)
    await assumeUserlabel(elsewhere)
    await answerGoogleAs(elsewhere, account)
    await continueWithGoogle(elsewhere)
    const dialog = elsewhere.getByRole('dialog', { name: AppNotices.nameChoiceTitle })
    await dialog.getByRole('button', { name: AppNotices.nameChoiceLater }).click()
    await expect(dialog).toBeHidden()
    await elsewhere.reload()
    await dialog.getByRole('button', { name: `Keep ${own}` }).click()
    await expect(dialog).toBeHidden()
    await elsewhere.goto(Routes.huntsPath())
    await expect(elsewhere.getByText(`(@${own})`)).toBeVisible()
    await elsewhere.reload()
    await expect(elsewhere.getByText(`(@${own})`)).toBeVisible()
    await expect(dialog).toHaveCount(0)
  })
})

test.describe("the front door", () => {
  test("offers signing in with Google beside choosing a handle, and says a standalone account has limits", async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('textbox', { name: 'Handle', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: GoogleButton.signIn })).toBeVisible()
    await expect(page.getByText(AppNotices.ifExistingAccount)).toBeVisible()
    await expect(page.getByText(AppNotices.verifyAccountBrings, { exact: false })).toBeVisible()
  })

  test("says, in place of its button, that a handle a verified account holds is one to sign in to", async ({ page, browser }) => {
    const { label } = await signUpWithGoogle(page)
    const elsewhere = await otherVisitor(browser)
    await elsewhere.goto('/')
    await elsewhere.getByRole('textbox', { name: 'Handle', exact: true }).fill(label)
    await expect(elsewhere.getByRole('status')).toHaveText(AppNotices.heldByVerifiedAccount)
    await expect(elsewhere.getByRole('button', { name: AppNotices.signUp, exact: true })).toHaveCount(0)
  })

  test("says, in place of its button, that a handle a standalone account holds is taken", async ({ page, browser }) => {
    const label = await assumeUserlabel(page)
    const elsewhere = await otherVisitor(browser)
    await elsewhere.goto('/')
    await elsewhere.getByRole('textbox', { name: 'Handle', exact: true }).fill(label)
    await expect(elsewhere.getByRole('status')).toHaveText(AppNotices.heldOtherwise)
  })

  test("leads from the line about a standalone account's limits to the help page's list of them", async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: AppNotices.standaloneLimits }).click()
    await expect(page).toHaveURL(/\/help#account-benefits$/)
    await expect(page.getByRole('heading', { name: 'Standalone and verified accounts' })).toBeInViewport()
  })
})

test.describe("the user menu", () => {
  test("offers a standalone account Google's whole Continue with Google button, and no way to sign out", async ({ page }) => {
    await assumeUserlabel(page)
    const menu = await openUserMenu(page)
    await expect(menu.getByRole('button', { name: GoogleButton.continue })).toBeVisible()
    await expect(menu.getByRole('menuitem', { name: /^Sign out/ })).toHaveCount(0)
  })

  test("shows a standalone account, on the page a refusal's Verify your account leads to, that it has limits, and offers a verified account under its handle", async ({ page }) => {
    const label = await assumeUserlabel(page)
    await page.goto(Routes.signInPath())
    const standalone = page.getByRole('region', { name: AppNotices.standaloneTitle })
    await expect(standalone.getByRole('link', { name: AppNotices.standaloneLimits })).toHaveAttribute('href', Routes.helpPath('account-benefits'))
    await expect(standalone.getByText(keepHandleNotice(label))).toBeVisible()
    await expect(standalone.getByRole('button', { name: GoogleButton.continue })).toBeVisible()
  })

  test("shows a user signed in with Google its own email, and signs it out once asked twice, the browser left with no handle", async ({ page }) => {
    const { account } = await signUpWithGoogle(page)
    const menu = await openUserMenu(page)
    await expect(menu.getByText(signedInAsNotice(account.email))).toBeVisible()
    await expect(menu.getByRole('button', { name: GoogleButton.continue })).toHaveCount(0)
    await menu.getByRole('menuitem', { name: `${AppNotices.signOut}…` }).click()
    await expect(menu.getByText(AppNotices.signOutQuestion, { exact: true })).toBeVisible()
    await menu.getByRole('button', { name: AppNotices.staySignedIn }).click()
    await menu.getByRole('menuitem', { name: `${AppNotices.signOut}…` }).click()
    await menu.getByRole('button', { name: AppNotices.signOut, exact: true }).click()
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('textbox', { name: 'Handle', exact: true })).toHaveValue('')
    await page.goto('/my/hunts')
    await expect(page).toHaveURL(/\/\?then=%2Fmy%2Fhunts$/)
  })
})

test.describe("the sign-in page", () => {
  test("sends a user signed in with Google on to their profile, or to where it was asked to", async ({ page }) => {
    await signUpWithGoogle(page)
    await page.goto(Routes.signInPath())
    await expect(page).toHaveURL(/\/my\/profile$/)
    await page.goto(Routes.signInPath(Routes.huntsPath()))
    await expect(page).toHaveURL(/\/my\/hunts$/)
  })

  test("sends a visitor holding no handle to the front door, which lands them at their sandbox after, as their profile is no page to come back to", async ({ page }) => {
    await page.goto(Routes.signInPath())
    await expect(page).toHaveURL(/\/\?then=%2Fmy%2Fprofile$/)
    const label = freshUserlabel()
    await page.getByRole('textbox', { name: 'Handle', exact: true }).fill(label)
    await page.getByRole('button', { name: AppNotices.signUp, exact: true }).click()
    await landedAfterSignUp(page, label, Routes.profilePath())
  })
})
