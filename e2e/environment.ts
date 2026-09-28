/**
 * Whether an environment is fit to run the e2e suite in, decided before anything is launched.
 *
 * `playwright.config.ts` checks this before it starts a web server, since a server started on a
 * human's port or data directory has already done its damage by the time any spec could object.
 * `environment.setup.ts` prints `listing` so a run's log says what it ran under.
 */

/** The variables that decide where the suite serves, builds and keeps its database, and what it talks to */
const RelevantNames = /^(CI|PORT|DOPPLER_|NEXT_|CONVEX_|TRIQUET_|ANTHROPIC_)/

/** Variables whose values are never shown, only whether they are set */
const SensitiveNames = /secret|pw|pass|tok|key|auth/i

/**
 * The suite's own settings, each with the values other sessions on this machine already hold:
 * a human's `pnpm dev` and an agent's `pnpm dev:agent`. Next falls back to the human's when a
 * variable is unset, so each must be given.
 */
const TakenBy: Record<string, readonly string[]> = {
  PORT:                   ['3000', '3001'],
  NEXT_PUBLIC_CONVEX_URL: ['http://127.0.0.1:3400', 'http://127.0.0.1:3401'],
  NEXT_DIST_DIR:          ['.next', '.next-agent', '.next-agent-build'],
}

/**
 * The Convex backends the suite may run against, by role (`CONVEX_ROLE`, `e2e` when unset): each
 * a local backend of its own (`scripts/convex_backend`), which the suite empties as it starts.
 */
export const BackendUrlFor = {
  "e2e":       'http://127.0.0.1:3402',
  "e2e-agent": 'http://127.0.0.1:3403',
} as const

export type E2eRole = keyof typeof BackendUrlFor

/** The role whose backend the suite runs against: `CONVEX_ROLE`, or `e2e` */
export function roleOf(env: Env): string {
  return env.CONVEX_ROLE ?? 'e2e'
}

type Env = Readonly<Record<string, string | undefined>>

/**
 * Everything wrong with `env` as a place to run the e2e suite, one sentence each.
 *
 * Outside CI it must be Doppler's `dev_e2e` config. Anywhere, the web server and its build
 * directory need a port and directory no other session uses, and the database must be the
 * role's own local Convex backend, which the suite empties.
 *
 * @param env - The environment to judge, ordinarily `process.env`.
 * @returns The complaints, empty when the suite may run.
 *
 * @example complaintsAbout({ CI: 'true', PORT: '3002', NEXT_PUBLIC_CONVEX_URL: 'http://127.0.0.1:3402', NEXT_DIST_DIR: '.next-e2e' })  // => []
 * @example complaintsAbout({ CI: 'true', PORT: '3000', NEXT_PUBLIC_CONVEX_URL: 'http://127.0.0.1:3402', NEXT_DIST_DIR: '.next-e2e' })  // => ['PORT=3000 is already another session\'s']
 */
export function complaintsAbout(env: Env): string[] {
  const settingComplaints = Object.entries(TakenBy).flatMap(([envname, taken]) => {
    const val = env[envname]
    if (! val) { return [`${envname} is not set: Doppler's dev_e2e config gives it one, and so does the CI workflow`] }
    if (taken.includes(val)) { return [`${envname}=${val} is already another session's`] }
    return []
  })
  return [
    ...((! env.CI && env.DOPPLER_CONFIG !== 'dev_e2e') ? ['Run the e2e suite with `pnpm test:e2e`, under Doppler\'s dev_e2e config'] : []),
    ...settingComplaints,
    ...((env.PORT && ! isPort(env.PORT)) ? [`PORT=${env.PORT} is not a port`] : []),
    ...backendComplaints(env),
  ]
}

/** What is wrong with the database `env` would run the suite against */
function backendComplaints(env: Env): string[] {
  const role = roleOf(env)
  if (! Object.hasOwn(BackendUrlFor, role)) { return [`CONVEX_ROLE=${role} is not one of ${Object.keys(BackendUrlFor).join(', ')}`] }
  const url = BackendUrlFor[role as E2eRole]
  const given = env.NEXT_PUBLIC_CONVEX_URL
  if (! given || TakenBy.NEXT_PUBLIC_CONVEX_URL?.includes(given)) { return [] }
  return given === url ? [] : [`NEXT_PUBLIC_CONVEX_URL=${given} is not the ${role} backend, ${url}: the suite empties the database it runs against`]
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
  const names = new Set([...Object.keys(TakenBy), ...Object.keys(env).filter((envname) => RelevantNames.test(envname))])
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
