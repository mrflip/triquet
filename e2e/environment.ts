/**
 * Whether an environment is fit to run the e2e suite in, decided before anything is launched.
 *
 * `playwright.config.ts` checks this before it starts a web server, since a server started on a
 * human's port or data directory has already done its damage by the time any spec could object.
 * `environment.setup.ts` prints `listing` so a run's log says what it ran under.
 */
import * as Lanes from '../scripts/lanes'

/** The variables that decide where the suite serves, builds and keeps its database, and what it talks to */
const RelevantNames = /^(CI|PORT|DOPPLER_|NEXT_|CONVEX_|TRIQUET_|ANTHROPIC_|TQ_|CLAUDE_CODE_REMOTE$)/

/** Variables whose values are never shown, only whether they are set */
const SensitiveNames = /secret|pw|pass|tok|key|auth/i

/** The suite's own settings, each of which Next would otherwise take from a human's defaults */
const SettingNames = ['PORT', 'NEXT_PUBLIC_CONVEX_URL', 'NEXT_DIST_DIR'] as const

/** The build directories other sessions in a checkout already use: a human's `pnpm dev`, and an agent's `pnpm dev:agent` and `pnpm build:agent` */
const TakenDistDirs: ReadonlySet<string> = new Set(['.next', '.next-agent', '.next-agent-build'])

/**
 * The roles the suite may run as (`CONVEX_ROLE`, `e2e` when unset): each with a port and a local
 * Convex backend of its own in every lane (`scripts/lanes.ts`), and the suite empties that
 * backend as it starts.
 */
export const E2eRoles = ['e2e', 'e2e-agent', 'e2e-built'] as const

export type E2eRole = typeof E2eRoles[number]

/** The role whose backend the suite runs against: `CONVEX_ROLE`, or `e2e` */
export function roleOf(env: Env): string {
  return env.CONVEX_ROLE ?? 'e2e'
}

/**
 * How the suite serves the app (`TRIQUET_E2E_SERVER`, `dev` when unset), as the command
 * `scripts/convex_dev` runs beside the role's backend. `dev` is Next's dev server, as a person
 * works on the app. `built` is the optimized build, the mode the app is deployed in: React without
 * StrictMode's doubled effects or the dev instrumentation, which hide a whole class of
 * effect-ordering bugs. Either way the keys, backend and settings are the suite's own.
 */
export const ServerCommandFor = {
  dev:   'next dev',
  built: 'sh -c "next build && next start"',
} as const

export type E2eServer = keyof typeof ServerCommandFor

/** How the suite serves the app: `TRIQUET_E2E_SERVER`, or `dev` */
export function serverOf(env: Env): string {
  return env.TRIQUET_E2E_SERVER ?? 'dev'
}

type Env = Readonly<Record<string, string | undefined>>

/**
 * How many workers the suite runs locally: a little under half the cores that sit idle, and never
 * fewer than one. Specs share one web server and one Convex backend, and too many workers for the
 * machine time them out; whatever else is running (another checkout's server, a build) counts
 * against the idle cores through the load average.
 *
 * @param cores - The cores this process may use, ordinarily `os.availableParallelism()`.
 * @param load - The one-minute load average, ordinarily `os.loadavg()[0]`.
 * @returns The worker count.
 *
 * @example workersFor(16, 0)  // => 7, a quiet laptop
 * @example workersFor(4, 0)   // => 2, a cloud session's container
 * @example workersFor(16, 8)  // => 4
 * @example workersFor(4, 6)   // => 1
 */
export function workersFor(cores: number, load: number): number {
  return Math.max(1, Math.round((cores - load) * 0.45))
}

/**
 * Everything wrong with `env` as a place to run the e2e suite, one sentence each.
 *
 * Outside CI and a cloud session's container (`CLAUDE_CODE_REMOTE`), each a machine of its own
 * with no Doppler, it must be Doppler's `dev_e2e` config. Anywhere, the web server must listen on the
 * role's own port in the checkout's lane (`TRIQUET_LANE`, 0 when unset), build into a directory
 * no other session uses, and talk to the role's own local Convex backend in that lane, which the
 * suite empties. The server is one it knows how to start (`ServerCommandFor`).
 *
 * @param env - The environment to judge, ordinarily `process.env`.
 * @returns The complaints, empty when the suite may run.
 *
 * @example complaintsAbout({ CI: 'true', PORT: '3002', NEXT_PUBLIC_CONVEX_URL: 'http://127.0.0.1:3402', NEXT_DIST_DIR: '.next-e2e' })  // => []
 * @example complaintsAbout({ CI: 'true', PORT: '3001', NEXT_PUBLIC_CONVEX_URL: 'http://127.0.0.1:3402', NEXT_DIST_DIR: '.next-e2e' })  // => ['PORT=3001 is not the e2e port in lane 0, 3002']
 */
export function complaintsAbout(env: Env): string[] {
  const blankComplaints = SettingNames.flatMap((envname) => {
    const val = env[envname]
    return val ? [] : [`${envname} is not set: \`pnpm test:e2e\` gives it one, and so does the CI workflow`]
  })
  return [
    ...((! env.CI && env.CLAUDE_CODE_REMOTE !== 'true' && env.DOPPLER_CONFIG !== 'dev_e2e') ? ['Run the e2e suite with `pnpm test:e2e`, under Doppler\'s dev_e2e config'] : []),
    ...blankComplaints,
    ...((env.NEXT_DIST_DIR && TakenDistDirs.has(env.NEXT_DIST_DIR)) ? [`NEXT_DIST_DIR=${env.NEXT_DIST_DIR} is already another session's`] : []),
    ...((env.PORT && ! isPort(env.PORT)) ? [`PORT=${env.PORT} is not a port`] : []),
    ...laneComplaints(env),
    ...serverComplaints(env),
  ]
}

/** What is wrong with the port and database `env` would run the suite on, for its role and lane */
function laneComplaints(env: Env): string[] {
  const role = roleOf(env)
  if (! isE2eRole(role)) { return [`CONVEX_ROLE=${role} is not one of ${E2eRoles.join(', ')}`] }
  let lane: number
  try {
    lane = Lanes.givenLaneOf(env) ?? 0
  } catch (err) {
    return [(err as Error).message]
  }
  const ports = Lanes.portsOf(role, lane)
  const url = `http://127.0.0.1:${String(ports.backend)}`
  const given = env.NEXT_PUBLIC_CONVEX_URL
  return [
    ...((env.PORT && isPort(env.PORT) && env.PORT !== String(ports.web)) ? [`PORT=${env.PORT} is not the ${role} port in lane ${String(lane)}, ${String(ports.web)}`] : []),
    ...((given && given !== url) ? [`NEXT_PUBLIC_CONVEX_URL=${given} is not the ${role} backend in lane ${String(lane)}, ${url}: the suite empties the database it runs against`] : []),
  ]
}

/** Whether `role` is one the suite may run as */
function isE2eRole(role: string): role is E2eRole {
  return (E2eRoles as readonly string[]).includes(role)
}

/** What is wrong with the way `env` would have the suite serve the app */
function serverComplaints(env: Env): string[] {
  const server = serverOf(env)
  if (Object.hasOwn(ServerCommandFor, server)) { return [] }
  return [`TRIQUET_E2E_SERVER=${server} is not one of ${Object.keys(ServerCommandFor).join(', ')}`]
}

/**
 * The variables of `env` that bear on the suite, for a log: each value, or only whether it is set
 * when the name looks like it holds a secret. The suite's own settings are listed even when unset.
 *
 * @param env - The environment to list, ordinarily `process.env`.
 * @returns Variable name to what may be shown of its value.
 *
 * @example listing({ PORT: '3002', CONVEX_DEPLOY_KEY: 'hunter2', HOME: '/root' })  // => { PORT: '3002', CONVEX_DEPLOY_KEY: '(set, not shown)', NEXT_DIST_DIR: '(unset)', ... }
 */
export function listing(env: Env): Record<string, string> {
  const names = new Set([...SettingNames, ...Object.keys(env).filter((envname) => RelevantNames.test(envname))])
  return Object.fromEntries([...names].map((envname) => [envname, shownValOf(env, envname)]))
}

/** What may be shown of `envname`'s value */
function shownValOf(env: Env, envname: string): string {
  const val = env[envname]
  if (val === undefined) { return '(unset)' }
  if (SensitiveNames.test(envname)) { return '(set, not shown)' }
  return val
}

/** Whether `val` names a port a server here may listen on */
function isPort(val: string): boolean {
  const port = Number(val)
  return /^\d+$/.test(val) && port >= 1024 && port <= 65_535
}
