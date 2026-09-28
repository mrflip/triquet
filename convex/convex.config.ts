import { defineApp } from 'convex/server'
import { v as CVX } from 'convex/values'

/**
 * The app, and the environment variables its functions read. `TRIQUET_CLEARABLE` is set to
 * `yes` only on a development or test deployment whose tables may be emptied; production never
 * has it.
 */
export default defineApp({
  env: {
    TRIQUET_CLEARABLE: CVX.optional(CVX.string()),
  },
})
