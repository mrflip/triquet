/**
 * Whether an environment is fit to run the e2e suite in, decided before anything is launched.
 *
 * `playwright.config.ts` checks this before it starts a web server, since a server started on a
 * human's port or data directory has already done its damage by the time any spec could object.
 * `environment.setup.ts` prints `listing` so a run's log says what it ran under.
 */

/** The variables that decide where the suite serves, builds and keeps its database, and what it talks to */
const RelevantNames = /^(CI|PORT|DOPPLER_|NEXT_|JAZZ_|TRIQUET_|ANTHROPIC_)/

/** Variables whose values are never shown, only whether they are set */
const SensitiveNames = /secret|pw|pass|tok|key|auth/i

/**
 * The suite's own settings, each with the values other sessions on this machine already hold:
 * a human's `pnpm dev` and an agent's `pnpm dev:agent`. `next.config.ts` falls back to the
 * human's when a variable is unset, so each must be given.
 */
const TakenBy: Record<string, readonly string[]> = {
  PORT:              ['3000', '3001'],
  JAZZ_DEV_PORT:     ['3200', '3201'],
  JAZZ_DEV_DATA_DIR: ['data/jazz', 'data/jazz-agent'],
  NEXT_DIST_DIR:     ['.next', '.next-agent', '.next-agent-build'],
}

/** The variables that hold a port */
const PortNames = ['PORT', 'JAZZ_DEV_PORT'] as const

type Env = Readonly<Record<string, string | undefined>>

/**
 * Everything wrong with `env` as a place to run the e2e suite, one sentence each.
 *
 * Outside CI it must be Doppler's `dev_e2e` config. Anywhere, the web server, its build
 * directory and its Jazz server need ports and directories no other session uses, and Jazz
 * must be the local one.
 *
 * @param env - The environment to judge, ordinarily `process.env`.
 * @returns The complaints, empty when the suite may run.
 *
 * @example complaintsAbout({ CI: 'true', PORT: '3002', JAZZ_DEV_PORT: '3202', JAZZ_DEV_DATA_DIR: 'data/jazz-e2e', NEXT_DIST_DIR: '.next-e2e' })  // => []
 * @example complaintsAbout({ CI: 'true', PORT: '3002', JAZZ_DEV_PORT: '3200', JAZZ_DEV_DATA_DIR: 'data/jazz-e2e', NEXT_DIST_DIR: '.next-e2e' })  // => ['JAZZ_DEV_PORT=3200 is already another session\'s']
 */
export function complaintsAbout(env: Env): string[] {
  const settingComplaints = Object.entries(TakenBy).flatMap(([envname, taken]) => {
    const val = env[envname]
    if (! val) { return [`${envname} is not set: Doppler's dev_e2e config gives it one, and so does the CI workflow`] }
    if (taken.includes(val)) { return [`${envname}=${val} is already another session's`] }
    return []
  })
  const portComplaints = PortNames.flatMap((envname) => {
    const val = env[envname]
    return (val && ! isPort(val)) ? [`${envname}=${val} is not a port`] : []
  })
  return [
    ...((! env.CI && env.DOPPLER_CONFIG !== 'dev_e2e') ? ['Run the e2e suite with `pnpm test:e2e`, under Doppler\'s dev_e2e config'] : []),
    ...settingComplaints,
    ...portComplaints,
    ...((env.PORT && env.PORT === env.JAZZ_DEV_PORT) ? [`PORT and JAZZ_DEV_PORT are both ${env.PORT}`] : []),
    ...((env.JAZZ_REAL_DB === 'true') ? ['JAZZ_REAL_DB=true would send every spec\'s writes to a real Jazz database'] : []),
  ]
}

/**
 * The variables of `env` that bear on the suite, for a log: each value, or only whether it is set
 * when the name looks like it holds a secret. The suite's own settings are listed even when unset.
 *
 * @param env - The environment to list, ordinarily `process.env`.
 * @returns Variable name to what may be shown of its value.
 *
 * @example listing({ PORT: '3002', JAZZ_ADMIN_SECRET: 'hunter2', HOME: '/root' })  // => { PORT: '3002', JAZZ_ADMIN_SECRET: '(set, not shown)', JAZZ_DEV_PORT: '(unset)', ... }
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
