import migrations from '@convex-dev/migrations/convex.config.js'
import { defineApp } from 'convex/server'
import { v as CVX } from 'convex/values'

/** A switch an operator sets by hand: the word `true` or the word `false`, and no other */
const Switch = CVX.union(CVX.literal('true'), CVX.literal('false'))

/**
 * The app, the environment variables its functions read, and the components it uses.
 *
 * * `TRIQUET_CLEARABLE` is set to `yes` only on a development or test deployment whose tables may
 *   be emptied; production never has it.
 * * `TRIQUET_EVERYONE_ADMIN` is set to `yes` only on a local backend (`scripts/convex_dev`), where
 *   every user is an admin (`Actor.ofUser`). Production never has it: there, a user is an admin
 *   only where its own `admin` flag says so, set from the command line. No variable lists admins.
 * * `EXPOSE_INTERNAL_STATS_TO_ALL` is `true` on a deployment whose stats page (`/stats`) may show its
 *   backfills to everyone, not only an admin (`Approve.mayReadBackfills`). `false` or unset keeps
 *   them an admin's; any other value is refused.
 * * `JWT_PRIVATE_KEY`, `JWKS` and `SITE_URL` are Convex Auth's (`convex/auth.ts`), which reads
 *   them itself: the key it signs a session's tokens with, the public half it checks them by, and
 *   the web app's address. `scripts/convex_auth_keys` sets them on a local backend; a Coach sets
 *   production's (`notes/deploy.md`).
 * * `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` are Google's keys for signing in with Google, which
 *   Convex Auth reads itself: a deployment offers Google only where both are set
 *   (`googleKeyed` in `auth.ts`). `scripts/convex_dev` sets them on a local backend from its Doppler
 *   config; a Coach sets production's (`notes/deploy.md`); a preview has none. An e2e role's local
 *   backend, CI's among them, has placeholders instead, for the stand-in Google below.
 * * `TRIQUET_MOCK_GOOGLE_ISSUER` names a stand-in for Google on this machine
 *   (`scripts/mock-google.ts`), which an e2e role's backend signs in with in Google's place
 *   (`scripts/convex_dev`). Honoured only on a deployment that also has `TRIQUET_CLEARABLE=yes`, and
 *   only for an `http` address on this machine (`mockGoogleIssuerOf` in `auth.ts`); production
 *   never has it, and Google is Google everywhere else.
 *
 * `migrations` keeps the state of the backfills in `convex/migrations.ts`.
 */
const app = defineApp({
  env: {
    TRIQUET_CLEARABLE:            CVX.optional(CVX.literal('yes')),
    TRIQUET_EVERYONE_ADMIN:       CVX.optional(CVX.literal('yes')),
    EXPOSE_INTERNAL_STATS_TO_ALL: CVX.optional(Switch),
    JWT_PRIVATE_KEY:              CVX.optional(CVX.string()),
    JWKS:                         CVX.optional(CVX.string()),
    SITE_URL:                     CVX.optional(CVX.string()),
    AUTH_GOOGLE_ID:               CVX.optional(CVX.string()),
    AUTH_GOOGLE_SECRET:           CVX.optional(CVX.string()),
    TRIQUET_MOCK_GOOGLE_ISSUER:   CVX.optional(CVX.string()),
  },
})
app.use(migrations) // eslint-disable-line unicorn/no-top-level-side-effects -- Convex registers a component only this way

export default app
