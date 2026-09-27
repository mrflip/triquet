import { createRequire } from 'node:module'
import path from 'node:path'
import type { NextConfig } from 'next'
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants'
import createMDX from '@next/mdx'
import { withJazz } from 'jazz-tools/dev/next'
import { publishRuntimeAssets } from './src/db/publish-runtime-assets'
import { RuntimeAssetsDir } from './src/db/runtime-assets'

/** Agents build and serve from their own directory, so they never trample a human's running `pnpm dev` */
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  turbopack: {
    root: import.meta.dirname,
  },
  // Jazz's runtime is served under a path named for its version, so it never changes in place.
  headers: () => Promise.resolve([{
    source:  `/${RuntimeAssetsDir}/:path*`,
    headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
  }]),
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

/**
 * Serves Jazz's worker and WASM from `public/`, at a URL that changes only with the runtime,
 * rather than from the bundle, whose URLs change with every build. Jazz names the SharedWorker
 * that holds a browser's database after the worker's URL, so a bundled worker has a new name
 * after each deploy, and the new one cannot open the database the old one still holds. Returns
 * the version the page is to ask Jazz for.
 */
function servedJazzRuntime(): string {
  const packageDir = path.dirname(createRequire(import.meta.url).resolve('jazz-tools/package.json'))
  return publishRuntimeAssets(packageDir, path.join(import.meta.dirname, 'public'))
}

export default async function config(phase: string, context: NextConfigContext) {
  // `withJazz` connects to whatever server the environment names whenever it also finds an admin
  // secret. A local database must not see the real one's variables, so it cannot be steered
  // there; a build keeps them, since they are what it bakes into the page.
  if (phase === PHASE_DEVELOPMENT_SERVER && ! JAZZ_REAL_DB) {
    delete process.env.NEXT_PUBLIC_JAZZ_APP_ID
    delete process.env.NEXT_PUBLIC_JAZZ_SERVER_URL
    delete process.env.JAZZ_ADMIN_SECRET
  }
  const env = { NEXT_PUBLIC_JAZZ_RUNTIME_VERSION: servedJazzRuntime() }
  return withMDX(await withJazz({ ...nextConfig, env }, jazzOptions)(phase, context))
}
