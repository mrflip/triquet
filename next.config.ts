import type { NextConfig } from 'next'
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants'
import createMDX from '@next/mdx'
import { withJazz } from 'jazz-tools/dev/next'

/** Agents build and serve from their own directory, so they never trample a human's running `pnpm dev` */
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  turbopack: {
    root: import.meta.dirname,
  },
} satisfies NextConfig

/** Static content is written as markdown and imported as a component, `.md` files included */
const withMDX = createMDX({ extension: /\.(md|mdx)$/ })

/**
 * Whether this environment works against the real Jazz database its variables name. Only then
 * does development leave Jazz alone: no local server, and no schema published on start, since
 * deploying to a real database is a housekeeping step of its own.
 */
const JAZZ_REAL_DB = (process.env.JAZZ_REAL_DB === 'true')

/** Where a local Jazz server keeps its data, and the `.env` in which Jazz records its app id */
const JAZZ_DEV_DATA_DIR = process.env.JAZZ_DEV_DATA_DIR ?? 'data/jazz'

/**
 * In development against a local database, `withJazz` runs Jazz's sync server inside the Next
 * process and publishes `src/db/schema.ts` and `permissions.ts` to it. Its port and data
 * directory come from the environment so an agent's server never shares either with a human's.
 * `envDir` is read by `withJazz` though its types omit it; without it Jazz writes into `schemaDir`.
 */
const jazzOptions: Parameters<typeof withJazz>[1] & { envDir: string } = {
  schemaDir: 'src/db',
  envDir:    JAZZ_DEV_DATA_DIR,
  server:    JAZZ_REAL_DB ? false : {
    port:    Number(process.env.JAZZ_DEV_PORT ?? 3200),
    dataDir: JAZZ_DEV_DATA_DIR,
  },
}

type NextConfigContext = Parameters<ReturnType<typeof withJazz>>[1]

export default async function config(phase: string, context: NextConfigContext) {
  // `withJazz` connects to whatever server the environment names whenever it also finds an admin
  // secret. A local database must not see the real one's variables, so it cannot be steered
  // there; a build keeps them, since they are what it bakes into the page.
  if (phase === PHASE_DEVELOPMENT_SERVER && ! JAZZ_REAL_DB) {
    delete process.env.NEXT_PUBLIC_JAZZ_APP_ID
    delete process.env.NEXT_PUBLIC_JAZZ_SERVER_URL
    delete process.env.JAZZ_ADMIN_SECRET
  }
  return withMDX(await withJazz(nextConfig, jazzOptions)(phase, context))
}
