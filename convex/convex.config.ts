import migrations from '@convex-dev/migrations/convex.config.js'
import { defineApp } from 'convex/server'
import { v as CVX } from 'convex/values'

/**
 * The app, the environment variables its functions read, and the components it uses.
 *
 * * `TRIQUET_CLEARABLE` is set to `yes` only on a development or test deployment whose tables may
 *   be emptied; production never has it.
 * * `JWT_PRIVATE_KEY`, `JWKS` and `SITE_URL` are Convex Auth's (`convex/auth.ts`), which reads
 *   them itself: the key it signs a session's tokens with, the public half it checks them by, and
 *   the web app's address. `scripts/convex_auth_keys` sets them on a local backend; a Coach sets
 *   production's (`notes/deploy.md`).
 *
 * `migrations` keeps the state of the backfills in `convex/migrations.ts`.
 */
const app = defineApp({
  env: {
    TRIQUET_CLEARABLE: CVX.optional(CVX.string()),
    JWT_PRIVATE_KEY:   CVX.optional(CVX.string()),
    JWKS:              CVX.optional(CVX.string()),
    SITE_URL:          CVX.optional(CVX.string()),
  },
})
app.use(migrations) // eslint-disable-line unicorn/no-top-level-side-effects -- Convex registers a component only this way

export default app
