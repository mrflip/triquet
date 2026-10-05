import { Anonymous } from '@convex-dev/auth/providers/Anonymous'
import { convexAuth } from '@convex-dev/auth/server'

/** One day, in the milliseconds Convex Auth counts in */
const DayMs = 24 * 60 * 60 * 1000

/**
 * Sessions, by Convex Auth. A browser signs in anonymously on its first visit and keeps its
 * session; who it is in the app is the username it then asserts (`idents.performAccount`), which
 * that session alone holds from then on. A provider that proves who someone is (Google, say) joins
 * `Anonymous` in the list.
 *
 * A session lasts as long as the browser keeps it, short of a year unvisited: an anonymous session
 * that ended would strand its username, which no other session may assert, so it is not ended on
 * Convex Auth's default schedule (thirty days, however often it is used).
 */
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Anonymous],
  session:   {
    totalDurationMs:    3650 * DayMs,
    inactiveDurationMs: 365 * DayMs,
  },
})
