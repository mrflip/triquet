import type { AuthConfig } from 'convex/server'
import { env } from './_generated/server'

/**
 * Who may vouch for a caller: this deployment itself, through Convex Auth, which signs its own
 * tokens (`JWT_PRIVATE_KEY`) and publishes the key to check them by (`JWKS`) at its HTTP actions'
 * address, `CONVEX_SITE_URL`.
 */
export default {
  providers: [
    { domain: env.CONVEX_SITE_URL, applicationID: 'convex' },
  ],
} satisfies AuthConfig
