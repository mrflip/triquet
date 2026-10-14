/**
 * Signing in with Google, all the way through, as the suite does it: against the stand-in for
 * Google that the suite's backend signs in with (`scripts/mock-google.ts`, which `scripts/convex_dev`
 * starts beside an e2e role's backend). The browser leaves for the deployment's sign-in route, is
 * sent on to the stand-in's consent step and back, and the backend exchanges the code with the
 * stand-in, as it would with Google. Which account answers is the spec's to say, before the button
 * is pressed (`answerGoogleAs`).
 */
import { expect, type Locator, type Page } from '@playwright/test'
import { AppNotices } from '../src/lib/notices'
import * as Lanes from '../scripts/lanes'
import * as MockGoogle from '../scripts/mock-google.ts'
import * as Environment from './environment'
import { freshUserlabel, landedAfterSignUp, openUserMenu } from './support'

/** The deployment's sign-in route, where Convex Auth sends a browser on its way to Google: the first stop of every Google sign-in */
export const SignInRoute = '**/api/auth/signin/google**'

/** Google's own words for its buttons, which its branding guidelines allow no others of (`GoogleButtonWords`, in a view this process does not load) */
export const GoogleButton = { signIn: 'Sign in with Google', continue: 'Continue with Google' } as const

export type GoogleAccountT = MockGoogle.MockAccountT

/**
 * Where the suite's stand-in for Google answers: the issuer port of the suite's role, in its lane
 * (`TRIQUET_LANE`, which `scripts/as_role` sets), as `scripts/convex_dev` started it.
 *
 * @example mockIssuerUrl()  // => 'http://127.0.0.1:3643', for e2e-agent in lane 4
 */
export function mockIssuerUrl(): string {
  const role = Environment.roleOf(process.env)
  if (! Lanes.isRole(role)) { throw new Error(`CONVEX_ROLE=${role} is not a role`) }
  return MockGoogle.issuerUrlFor(Lanes.portsOf(role, Lanes.givenLaneOf(process.env) ?? 0).issuer)
}

/**
 * A Google account nobody has signed in with: a fresh account id and email, verified, with
 * `overrides` laid over it (an unverified email, a locale, a Workspace domain).
 *
 * @example freshGoogleAccount()                                    // => { sub: 'mock_5f0c…', email: 'mock_5f0c…@example.com', email_verified: true, name: 'Mock 5f0c…' }
 * @example freshGoogleAccount({ locale: 'en-GB', hd: 'example.org' })
 */
export function freshGoogleAccount(overrides: Partial<GoogleAccountT> = {}): GoogleAccountT {
  return MockGoogle.freshMockAccount(overrides)
}

/**
 * Have every Google sign-in `page` starts from now on answered as `account`, or refused at
 * Google's consent step (`'refused'`), replacing whatever was said before. The page's way to the
 * deployment's sign-in route is continued with a header that tells the stand-in so, which rides
 * along through each redirect after it to the stand-in's consent step (a route sees only the
 * first address of a chain of redirects, and Playwright carries a continued request's headers
 * through the rest).
 *
 * @example await answerGoogleAs(page, freshGoogleAccount())
 * @example await answerGoogleAs(page, 'refused')
 */
export async function answerGoogleAs(page: Page, account: GoogleAccountT | 'refused'): Promise<void> {
  const said: MockGoogle.MockSignInT = account === 'refused' ? { kind: 'refused' } : { kind: 'account', account }
  await page.unroute(SignInRoute)
  await page.route(SignInRoute, async (route) => {
    await route.continue({ headers: { ...route.request().headers(), [MockGoogle.SignInHeader]: MockGoogle.encodeSignIn(said) } })
  })
}

/** Who signs up with Google, and from where (`signUpWithGoogle`) */
export type SignUpT = {
  /** The Google account to sign up with; a fresh one when omitted */
  account?: GoogleAccountT
  /** The handle to take; a fresh one when omitted */
  label?:   string
  /** Where the visitor sets out from: a page holding no handle sends them to the front door, to come back to it after; the front door itself when omitted */
  from?:    string
}

/**
 * Sign up with Google: set out from `from`, a page of the app (the front door, or a link that
 * sends a visitor holding no handle there, to come back to it), sign in with Google as `account`,
 * a new one, add the handle `label` on the page that asks for a name and a handle, and wait until
 * the new user has landed (`landedAfterSignUp`).
 *
 * @returns The handle taken, and the account.
 *
 * @example const { label, account } = await signUpWithGoogle(page)
 * @example await signUpWithGoogle(page, { from: huntAddress })  // lands back at the hunt's address
 */
export async function signUpWithGoogle(page: Page, { account = freshGoogleAccount(), label = freshUserlabel(), from = '/' }: SignUpT = {}): Promise<{ label: string, account: GoogleAccountT }> {
  await page.goto(from)
  await answerGoogleAs(page, account)
  await page.getByRole('button', { name: GoogleButton.signIn }).click()
  await expect(page.getByRole('heading', { name: AppNotices.googleGateTitle })).toBeVisible()
  await page.getByRole('textbox', { name: 'Handle', exact: true }).fill(label)
  await page.getByRole('button', { name: AppNotices.saveName, exact: true }).click()
  await landedAfterSignUp(page, label, from === '/' ? undefined : from)
  return { label, account }
}

/**
 * Press the user menu's *Continue with Google*, as a standalone account verifies itself from
 * whatever page it is on: the sign-in is answered as `answerGoogleAs` said, and comes back to that
 * page.
 *
 * @example await answerGoogleAs(page, account); await continueWithGoogle(page)
 */
export async function continueWithGoogle(page: Page): Promise<void> {
  const menu = await openUserMenu(page)
  await menu.getByRole('button', { name: GoogleButton.continue }).click()
}

/**
 * The user menu, opened once it says `text`: for a page just back from Google, where a click on
 * the header's button before the page has hydrated (while the address still holds the code) opens
 * nothing, and a menu opened before the server has said who is looking holds only *Profile* until
 * it does. A menu that does not yet say it is closed (Escape) and opened again, for a while.
 *
 * @example await expect(await userMenuSaying(page, signedInAsNotice(account.email))).toContainText(`@${label}`)
 */
export async function userMenuSaying(page: Page, text: string): Promise<Locator> {
  const menu = page.getByRole('dialog', { name: 'You', exact: true })
  await expect(async () => {
    if (! await menu.isVisible()) { await openUserMenu(page) }
    try {
      await expect(menu.getByText(text)).toBeVisible({ timeout: 2000 })
    } catch (err) {
      await page.keyboard.press('Escape')
      throw err
    }
  }, `the user menu should say ${text}`).toPass({ timeout: 20_000 })
  return menu
}
