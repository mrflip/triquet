import Google, { type GoogleProfile } from '@auth/core/providers/google'
import { Anonymous } from '@convex-dev/auth/providers/Anonymous'
import { convexAuth } from '@convex-dev/auth/server'
import * as Routes from '../src/lib/routes'
import type { GoogleProfileT } from '../src/models/user'
import { env } from './_generated/server'
import { zPlainQuery } from './functions'
import { triggers } from './triggers'
import { userForSignIn } from './writing/user_actions'

/** One day, in the milliseconds Convex Auth counts in */
const DayMs = 24 * 60 * 60 * 1000

/**
 * What a Google sign-in asks Google for: who the person is, their email, and their name and
 * picture, and nothing more. The privacy policy (`/privacy`) promises exactly this, and what of it
 * is kept (`googleProfileOf`).
 */
export const GoogleScope = 'openid email profile'

/**
 * What a Google sign-in keeps of the claims Google's token carries, as the user's fields name them
 * (`UserValidators.googleProfile`), beside the account's id: the email, and when Google said it is
 * verified (the token's issue time, only when `email_verified` is true); the name and picture; and
 * the locale and Workspace domain (`hd`) when Google sends them. Nothing else: the given and family
 * names, among the rest, are dropped here. The Google provider's `profile`.
 *
 * @param claims - The claims of Google's ID token.
 * @returns The account's id, and what the user keeps.
 *
 * @example googleProfileOf({ sub: '1098', email: 'flip@example.com', email_verified: true, iat: 1760300000, name: 'Flip', picture: 'https://…', hd: 'example.com', … })
 *   // => { id: '1098', email: 'flip@example.com', emailVerificationTime: 1760300000000, name: 'Flip', image: 'https://…', hosted_domain: 'example.com' }
 */
export function googleProfileOf(claims: GoogleProfile): GoogleProfileT & { id: string } {
  return {
    id:    claims.sub,
    email: claims.email,
    ...(claims.email_verified && { emailVerificationTime: claims.iat * 1000 }),
    name:  claims.name,
    image: claims.picture,
    ...(claims.locale !== undefined && { locale: claims.locale }),
    ...(claims.hd !== undefined && { hosted_domain: claims.hd }),
  }
}

/**
 * Whether this deployment offers Google sign-in: only where both of Google's keys are set on it
 * (`AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`, which Convex Auth reads itself). A local backend has
 * them from the Doppler config it runs under (`scripts/convex_dev`), or, for an e2e role's (CI's
 * among them), placeholders for a stand-in for Google (`mockGoogleIssuerOf`); production from a
 * Coach; a preview never.
 *
 * @example googleKeyed()  // => false, on a deployment without Google's keys
 */
export function googleKeyed(): boolean {
  return Boolean(env.AUTH_GOOGLE_ID) && Boolean(env.AUTH_GOOGLE_SECRET)
}

/** The hosts a stand-in for Google may answer on: this machine's own */
const LoopbackHosts: ReadonlySet<string> = new Set(['127.0.0.1', 'localhost', '[::1]'])

/**
 * Where this deployment's Google sign-in goes in Google's place, if anywhere: the stand-in for
 * Google the e2e suite runs on this machine (`scripts/mock-google.ts`), which `TRIQUET_MOCK_GOOGLE_ISSUER`
 * names on an e2e role's backend (`scripts/convex_dev`). Honoured only on a deployment whose tables
 * may be emptied (`TRIQUET_CLEARABLE=yes`), which production never is, and only for an `http`
 * address on this machine; anything else is ignored, and Google's own issuer stands, so no one
 * setting can send production's sign-ins anywhere but Google (`notes/security.md`).
 *
 * @param vars - The deployment's environment, as `env` holds it.
 * @returns The stand-in's address, or undefined for Google's own.
 *
 * @example mockGoogleIssuerOf({ TRIQUET_CLEARABLE: 'yes', TRIQUET_MOCK_GOOGLE_ISSUER: 'http://127.0.0.1:3643' })  // => 'http://127.0.0.1:3643'
 * @example mockGoogleIssuerOf({ TRIQUET_MOCK_GOOGLE_ISSUER: 'http://127.0.0.1:3643' })                              // => undefined: not a deployment that may be emptied
 * @example mockGoogleIssuerOf({ TRIQUET_CLEARABLE: 'yes', TRIQUET_MOCK_GOOGLE_ISSUER: 'https://issuer.example.com' }) // => undefined: not this machine
 */
export function mockGoogleIssuerOf(vars: { TRIQUET_CLEARABLE?: string, TRIQUET_MOCK_GOOGLE_ISSUER?: string }): string | undefined {
  const named = vars.TRIQUET_MOCK_GOOGLE_ISSUER
  if (! named || vars.TRIQUET_CLEARABLE !== 'yes') { return undefined }
  const url = URL.canParse(named) ? new URL(named) : null
  return url?.protocol === 'http:' && LoopbackHosts.has(url.hostname) ? named : undefined
}

/**
 * The address a sign-in sends the browser back to, on the app's own address (`SITE_URL`):
 * `redirectTo` when it is a path of this app's that opens the database (`Routes.isSyncedPath`), and
 * the front door, which is one, otherwise. Only such a page mounts Convex Auth's provider, which
 * exchanges the `?code=` in the address at once, so a code is never left lying unspent in a page
 * that would not, and a page of another site is never sent one. Anywhere else asked for is not
 * followed but replaced, so the browser still lands where its sign-in finishes (or says it did
 * not), rather than on an error from the deployment after Google's consent. Convex Auth's
 * `redirect` callback.
 *
 * @param redirectTo - Where the browser asked to come back to, as it started the sign-in.
 * @returns The absolute address.
 * @throws For a deployment with no `SITE_URL`: the sign-in goes no further.
 *
 * @example returnUrlFor('/~pat_smith/quiet_otter')  // => 'https://triquet.me/~pat_smith/quiet_otter'
 * @example returnUrlFor('/privacy')                 // => 'https://triquet.me/'
 * @example returnUrlFor('https://example.com/')     // => 'https://triquet.me/'
 */
export function returnUrlFor(redirectTo: string): string {
  const site = env.SITE_URL
  if (! site) { throw new Error('This deployment has no SITE_URL to send a sign-in back to') }
  return `${site.replace(/\/$/, '')}${Routes.isSyncedPath(redirectTo) ? redirectTo : Routes.rootPath()}`
}

/** The Google provider's `issuer`, where a stand-in replaces Google's (`mockGoogleIssuerOf`); nothing, so Google's own stands, everywhere else */
function googleIssuerOption(): { issuer?: string } {
  const issuer = mockGoogleIssuerOf(env)
  return issuer === undefined ? {} : { issuer }
}

/**
 * Sessions, by Convex Auth. A browser signs in anonymously on its first visit and keeps its
 * session, signed in as a new anonymous user; who it is in the app is the userlabel that user then
 * takes (`users.perform`), its own from then on. Where the deployment has Google's keys, Google
 * joins `Anonymous`: a sign-in that proves who someone is, asking Google only for `GoogleScope`, and
 * keeping only `googleProfileOf` of what it sends. An e2e role's local backend signs in with a
 * stand-in for Google instead (`mockGoogleIssuerOf`).
 *
 * The user a sign-in is signed in as is ours to write (`createOrUpdateUser`, `userForSignIn`):
 * through the database the triggers run on, so the row is stamped, and through our row validator.
 * For Google it is asked twice: at Google's callback, where it only links the account, and at the
 * code's exchange, where the browser has proved it started the sign-in and the starting browser's
 * user (`authUserId`, which our patch of Convex Auth hands it there) is upgraded, merged or
 * switched from. Never from an email.
 *
 * A session lasts as long as the browser keeps it, short of a year unvisited: an anonymous session
 * that ended would strand its user and its userlabel, which no other session may be signed in as,
 * so it is not ended on Convex Auth's default schedule (thirty days, however often it is used).
 */
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Anonymous,
    ...(googleKeyed() ? [Google({ ...googleIssuerOption(), authorization: { params: { scope: GoogleScope } }, profile: googleProfileOf })] : []),
  ],
  session: {
    totalDurationMs:    3650 * DayMs,
    inactiveDurationMs: 365 * DayMs,
  },
  callbacks: {
    redirect:           ({ redirectTo }) => Promise.resolve(returnUrlFor(redirectTo)),
    createOrUpdateUser: async (ctx, signIn) => await userForSignIn(triggers.wrapDB(ctx).db, signIn),
  },
})

/**
 * Which ways of signing in this deployment offers beyond the anonymous one every browser starts
 * with: Google, where it has Google's keys (`googleKeyed`). What the browser's *Sign in with
 * Google* button reads before it shows itself. Of the deployment alone, so it asks nobody who is
 * asking (`zPlainQuery`): signing in or out reruns nothing here.
 *
 * @returns `{ google }`: whether Google sign-in is offered.
 */
export const offered = zPlainQuery({
  args:    {},
  handler: (): { google: boolean } => ({ google: googleKeyed() }),
})
