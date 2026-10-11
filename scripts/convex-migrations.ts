/**
 * Runs the backfills in `convex/migrations.ts` on a deployment and waits for them to finish, and
 * records in the migrations table what the deployment was pushed (`notes/deploy.md`, *Serial
 * mode*). The pieces `scripts/deploy.ts` walks a stack of schema steps with are exported from here.
 *
 *   node scripts/convex-migrations.ts run [seconds]       migrations:runAll on the deployment the convex CLI names, then wait up to <seconds> (300) for every backfill to finish
 *   node scripts/convex-migrations.ts after-vercel-build  on a Vercel production build: record the commit as pushed, `run`, seed, record it backfilled; elsewhere, nothing
 *
 * `pnpm build:vercel` runs `after-vercel-build` once `convex deploy` has pushed, so the build that
 * deploys a widening finishes only when its backfill has, and the migrations table says so. A
 * backfill that stops, or is still running at the limit, fails the build: the functions already
 * serve, so what fails is only the pages, loudly, where a warning in a log once went unread.
 * Previews run `runAll` from `convex deploy --preview-run` instead, and record nothing. By hand,
 * against a local role:
 *
 *   ./scripts/doppledo dev_claude scripts/convex_dev agent node scripts/convex-migrations.ts run
 */
import { execFileSync } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'
import { z } from 'zod'

/** Seconds `run` waits for the backfills, unless told otherwise. */
export const DefaultLimitSeconds = 300

/** Seconds between one look at the backfills and the next. */
export const IntervalSeconds = 5

/** One unfinished backfill, as `migrations:outstanding` reports it. */
const Outstanding = z.object({
  name:      z.string(),
  state:     z.enum(['inProgress', 'failed', 'canceled', 'unknown']),
  processed: z.number(),
  error:     z.string().optional(),
})
export type Outstanding = z.infer<typeof Outstanding>

const LimitSeconds = z.coerce.number().positive()

/** A commit as the migrations table records a step: its full sha and its subject line */
export type StepT = { sha: string, subject: string }

/**
 * Where the backfills stand: `done` with none outstanding, `stuck` once one has failed or been
 * canceled (the series stops there, so waiting longer changes nothing), else `waiting`.
 *
 * @example standingOf([])  // => 'done'
 * @example standingOf([{ name: 'migrations:backfillQ1Preambles', state: 'inProgress', processed: 100 }])  // => 'waiting'
 * @example standingOf([{ name: 'migrations:backfillQ1Preambles', state: 'failed', processed: 0, error: 'Boom' }])  // => 'stuck'
 */
export function standingOf(outstanding: readonly Outstanding[]): 'done' | 'waiting' | 'stuck' {
  if (outstanding.length === 0) { return 'done' }
  return outstanding.some((each) => each.state === 'failed' || each.state === 'canceled') ? 'stuck' : 'waiting'
}

/**
 * One line for an unfinished backfill, for the build log.
 *
 * @example lineFor({ name: 'migrations:backfillQ1Preambles', state: 'failed', processed: 100, error: 'Boom' })  // => 'migrations:backfillQ1Preambles: failed, 100 rows done: Boom'
 */
export function lineFor({ name, state, processed, error }: Outstanding): string {
  const done = `${name}: ${state}, ${String(processed)} rows done`
  return error ? `${done}: ${error}` : done
}

/** Whether a build's environment is Vercel building production. */
export function isProductionBuild(env: Record<string, string | undefined>): boolean {
  return env.VERCEL_ENV === 'production'
}

/**
 * The commit a Vercel build is of, as the migrations table records it: the sha Vercel gives, and
 * the first line of the commit message.
 *
 * @example stepOfBuild({ VERCEL_GIT_COMMIT_SHA: '84de1bb0c2a1f5e6d7b8a9c0d1e2f3a4b5c6d7e8', VERCEL_GIT_COMMIT_MESSAGE: 'Jsonballs (#126)\n\nEvery resource…' })  // => { sha: '84de1bb0…', subject: 'Jsonballs (#126)' }
 * @example stepOfBuild({})  // => null
 */
export function stepOfBuild(env: Record<string, string | undefined>): StepT | null {
  const sha = env.VERCEL_GIT_COMMIT_SHA
  if (! sha) { return null }
  return { sha, subject: subjectOf(env.VERCEL_GIT_COMMIT_MESSAGE ?? '') }
}

/**
 * A commit message's subject: its first line, or `(no subject)` for an empty one.
 *
 * @example subjectOf('Jsonballs (#126)\n\nEvery resource…')  // => 'Jsonballs (#126)'
 * @example subjectOf('')  // => '(no subject)'
 */
export function subjectOf(message: string): string {
  const first = message.split('\n', 1)[0]?.trim() ?? ''
  return first === '' ? '(no subject)' : first
}

/** How `awaitBackfills` looks, waits and tells the time: the real ones, or a test's. */
export interface Waiter {
  look:  () => Promise<Outstanding[]>
  pause: (ms: number) => Promise<void>
  now:   () => number
}

/**
 * Looks at the backfills every `IntervalSeconds` until they are done, one is stuck, or
 * `limitSeconds` have passed.
 *
 * @returns How they stood at the last look, and what was outstanding then.
 */
export async function awaitBackfills(waiter: Waiter, limitSeconds: number): Promise<{ standing: ReturnType<typeof standingOf>, outstanding: Outstanding[] }> {
  const deadline = waiter.now() + (limitSeconds * 1000)
  for (;;) {
    const outstanding = await waiter.look()
    const standing    = standingOf(outstanding)
    if (standing !== 'waiting' || waiter.now() >= deadline) { return { standing, outstanding } }
    await waiter.pause(IntervalSeconds * 1000)
  }
}

/**
 * What the convex CLI prints for running `fn` with `args` on the deployment its environment names,
 * parsed as JSON. Run from `cwd` (this checkout, unless told otherwise), with `env` over the
 * process's.
 */
export function convexRun(fn: string, args?: Record<string, unknown>, opts: { cwd?: string, env?: Record<string, string | undefined> } = {}): unknown {
  const argv = ['exec', 'convex', 'run', fn, ...(args ? [JSON.stringify(args)] : [])]
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- the pnpm this checkout already runs
  const printed = execFileSync('pnpm', argv, { cwd: opts.cwd, env: { ...process.env, ...opts.env }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] })
  return printed.trim() === '' ? null : JSON.parse(printed)
}

/** What a run of the backfills came to */
export interface BackfillsRun {
  standing:    ReturnType<typeof standingOf>
  outstanding: Outstanding[]
  lines:       string[]
}

/**
 * Starts every backfill the deployment defines and waits up to `limitSeconds` for them.
 *
 * @returns How they stood, what was outstanding, and the lines to say so.
 */
export async function runBackfills(limitSeconds: number, opts: { cwd?: string, env?: Record<string, string | undefined> } = {}): Promise<BackfillsRun> {
  convexRun('migrations:runAll', undefined, opts)
  const waiter: Waiter = {
    look:  () => Promise.resolve(z.array(Outstanding).parse(convexRun('migrations:outstanding', undefined, opts))),
    pause: async (ms) => { await sleep(ms) },
    now:   () => Date.now(),
  }
  const { standing, outstanding } = await awaitBackfills(waiter, limitSeconds)
  if (standing === 'done') { return { standing, outstanding, lines: ['Backfills: every one has finished.'] } }
  const why = standing === 'stuck' ? 'one has stopped, and the series with it' : `still running after ${String(limitSeconds)}s`
  return { standing, outstanding, lines: [`Backfills: ${why}.`, ...outstanding.map((each) => `  ${lineFor(each)}`)] }
}

/**
 * What a production build does once `convex deploy` has pushed: records the commit as pushed,
 * runs the backfills and waits, seeds, and records the commit backfilled.
 *
 * @returns Whether every step finished; the lines say how far it got.
 * @throws When the CLI cannot reach the deployment, or the commit is unknown.
 */
export async function afterProductionPush(step: StepT, limitSeconds: number): Promise<{ ok: boolean, lines: string[] }> {
  convexRun('deploying:recordPushed', step)
  const ran = await runBackfills(limitSeconds)
  if (ran.standing !== 'done') { return { ok: false, lines: ran.lines } }
  convexRun('seeding:seedWidgets')
  convexRun('deploying:recordBackfilled', step)
  return { ok: true, lines: [...ran.lines, `Seeded, and recorded ${step.sha.slice(0, 8)} as pushed and backfilled.`] }
}

/** The command line: one of the commands in the module's doc block. */
async function main([command, limitArg]: string[], env: Record<string, string | undefined>): Promise<void> {
  if (command === 'after-vercel-build') {
    if (! isProductionBuild(env)) { return }
    const step = stepOfBuild(env)
    if (step === null) { throw new Error('VERCEL_GIT_COMMIT_SHA is not set: cannot record what was pushed.') }
    const { ok, lines } = await afterProductionPush(step, DefaultLimitSeconds)
    process.stdout.write(`${lines.join('\n')}\n`)
    if (! ok) { throw new Error('The backfills did not finish: the functions serve, and this build fails so that someone looks (notes/deploy.md, *Serial mode*).') }
    return
  }
  if (command !== 'run') { throw new Error('Usage: node scripts/convex-migrations.ts <run [seconds] | after-vercel-build>') }
  const ran = await runBackfills(LimitSeconds.parse(limitArg ?? DefaultLimitSeconds))
  process.stdout.write(`${ran.lines.join('\n')}\n`)
  if (ran.standing !== 'done') { process.exitCode = 1 }
}

if (import.meta.main) {
  try {
    await main(process.argv.slice(2), process.env)
  } catch (err) {
    console.error(err instanceof Error ? err.message : err)
    process.exitCode = 1
  }
}
