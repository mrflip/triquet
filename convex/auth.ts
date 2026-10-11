import { Anonymous } from '@convex-dev/auth/providers/Anonymous'
import { convexAuth } from '@convex-dev/auth/server'
import { triggers } from './triggers'
import { userForSignIn } from './writing/user_actions'

/** One day, in the milliseconds Convex Auth counts in */
const DayMs = 24 * 60 * 60 * 1000

/**
 * Sessions, by Convex Auth. A browser signs in anonymously on its first visit and keeps its
 * session, signed in as a new anonymous user; who it is in the app is the userlabel that user then
 * takes (`users.perform`), its own from then on. A provider that proves who someone is (Google,
 * say) joins `Anonymous` in the list.
 *
 * The user a sign-in is signed in as is ours to write (`createOrUpdateUser`, `userForSignIn`):
 * through the database the triggers run on, so the row is stamped, and through our row validator.
 *
 * A session lasts as long as the browser keeps it, short of a year unvisited: an anonymous session
 * that ended would strand its user and its userlabel, which no other session may be signed in as,
 * so it is not ended on Convex Auth's default schedule (thirty days, however often it is used).
 */
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Anonymous],
  session:   {
    totalDurationMs:    3650 * DayMs,
    inactiveDurationMs: 365 * DayMs,
  },
  callbacks: {
    createOrUpdateUser: async (ctx, signIn) => await userForSignIn(triggers.wrapDB(ctx).db, signIn),
  },
})
