import Google from '@auth/core/providers/google'
import { Anonymous } from '@convex-dev/auth/providers/Anonymous'
import { convexAuth } from '@convex-dev/auth/server'
import { env } from './_generated/server'
import { zQuery } from './functions'
import { triggers } from './triggers'
import { userForSignIn } from './writing/user_actions'

/** One day, in the milliseconds Convex Auth counts in */
const DayMs = 24 * 60 * 60 * 1000

/**
 * What a Google sign-in asks Google for: who the person is, their email, and their name and
 * picture, and nothing more. The privacy policy (`/privacy`) promises exactly this.
 */
export const GoogleScope = 'openid email profile'

/**
 * Whether this deployment offers Google sign-in: only where both of Google's keys are set on it
 * (`AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`, which Convex Auth reads itself). A local backend has
 * them from the Doppler config it runs under (`scripts/convex_dev`); production from a Coach; a
 * preview, and CI, never.
 *
 * @example googleKeyed()  // => false, on a deployment without Google's keys
 */
export function googleKeyed(): boolean {
  return Boolean(env.AUTH_GOOGLE_ID) && Boolean(env.AUTH_GOOGLE_SECRET)
}

/**
 * Sessions, by Convex Auth. A browser signs in anonymously on its first visit and keeps its
 * session, signed in as a new anonymous user; who it is in the app is the userlabel that user then
 * takes (`users.perform`), its own from then on. Where the deployment has Google's keys, Google
 * joins `Anonymous`: a sign-in that proves who someone is, asking Google only for `GoogleScope`.
 *
 * The user a sign-in is signed in as is ours to write (`createOrUpdateUser`, `userForSignIn`):
 * through the database the triggers run on, so the row is stamped, and through our row validator.
 * It decides from whose the account is and whose the signing-in browser was (`authUserId`, which
 * our patch of Convex Auth hands it), never from an email.
 *
 * A session lasts as long as the browser keeps it, short of a year unvisited: an anonymous session
 * that ended would strand its user and its userlabel, which no other session may be signed in as,
 * so it is not ended on Convex Auth's default schedule (thirty days, however often it is used).
 */
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Anonymous,
    ...(googleKeyed() ? [Google({ authorization: { params: { scope: GoogleScope } } })] : []),
  ],
  session: {
    totalDurationMs:    3650 * DayMs,
    inactiveDurationMs: 365 * DayMs,
  },
  callbacks: {
    createOrUpdateUser: async (ctx, signIn) => await userForSignIn(triggers.wrapDB(ctx).db, signIn),
  },
})

/**
 * Which ways of signing in this deployment offers beyond the anonymous one every browser starts
 * with: Google, where it has Google's keys (`googleKeyed`). What the browser's *Sign in with
 * Google* button reads before it shows itself.
 *
 * @returns `{ google }`: whether Google sign-in is offered.
 */
export const offered = zQuery({
  args:    {},
  handler: (): { google: boolean } => ({ google: googleKeyed() }),
})
