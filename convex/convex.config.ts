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
 * * `TRIQUET_ADMINS` names the deployment's admins (`Actor.namesAdmin`): userlabels parted by
 *   commas or spaces, or `*` for every userlabel. Unset names nobody. `scripts/convex_dev` sets `*`
 *   on a local backend; a Coach sets production's (`notes/deploy.md`).
 * * `EXPOSE_INTERNAL_STATS_TO_ALL` is `true` on a deployment whose stats page (`/stats`) may show its
 *   backfills to everyone, not only an admin (`Approve.mayReadBackfills`). `false` or unset keeps
 *   them an admin's; any other value is refused.
 * * `JWT_PRIVATE_KEY`, `JWKS` and `SITE_URL` are Convex Auth's (`convex/auth.ts`), which reads
 *   them itself: the key it signs a session's tokens with, the public half it checks them by, and
 *   the web app's address. `scripts/convex_auth_keys` sets them on a local backend; a Coach sets
 *   production's (`notes/deploy.md`).
 *
 * `migrations` keeps the state of the backfills in `convex/migrations.ts`.
 */
const app = defineApp({
  env: {
    TRIQUET_CLEARABLE:            CVX.optional(CVX.literal('yes')),
    TRIQUET_ADMINS:               CVX.optional(CVX.string()),
    EXPOSE_INTERNAL_STATS_TO_ALL: CVX.optional(Switch),
    JWT_PRIVATE_KEY:              CVX.optional(CVX.string()),
    JWKS:                         CVX.optional(CVX.string()),
    SITE_URL:                     CVX.optional(CVX.string()),
  },
})
app.use(migrations) // eslint-disable-line unicorn/no-top-level-side-effects -- Convex registers a component only this way

export default app
