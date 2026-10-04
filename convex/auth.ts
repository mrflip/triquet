import { Anonymous } from '@convex-dev/auth/providers/Anonymous'
import { convexAuth } from '@convex-dev/auth/server'

/**
 * Sessions, by Convex Auth. A browser signs in anonymously on its first visit and keeps its
 * session; who it is in the app is the username it then asserts (`idents.performAccount`). A
 * provider that proves who someone is (Google, say) joins `Anonymous` in the list.
 */
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Anonymous],
})
