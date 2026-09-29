import migrations from '@convex-dev/migrations/convex.config.js'
import { defineApp } from 'convex/server'
import { v as CVX } from 'convex/values'

/**
 * The app, the environment variables its functions read, and the components it uses.
 * `TRIQUET_CLEARABLE` is set to `yes` only on a development or test deployment whose tables may
 * be emptied; production never has it. `migrations` keeps the state of the backfills in
 * `convex/migrations.ts`.
 */
const app = defineApp({
  env: {
    TRIQUET_CLEARABLE: CVX.optional(CVX.string()),
  },
})
app.use(migrations) // eslint-disable-line unicorn/no-top-level-side-effects -- Convex registers a component only this way

export default app
