/**
 * Runs the backfills in `convex/migrations.ts` on a deployment and waits for them to finish, so a
 * production deploy carries its own backfills (`notes/deploy.md`, *Schema pushes*).
 *
 *   node scripts/convex-migrations.ts run [seconds]       migrations:runAll on the deployment the convex CLI names, then wait up to <seconds> (300) for every backfill to finish
 *   node scripts/convex-migrations.ts after-vercel-build  on a Vercel production build, `run`, warning in the build log rather than failing; elsewhere, nothing
 *
 * `pnpm build:vercel` runs `after-vercel-build` once `convex deploy` has pushed, so the build that
 * deploys a widening finishes only when its backfill has, and a tightening merged after it finds
 * every row ready. Previews run `runAll` from `convex deploy --preview-run` instead, and do not
 * wait. By hand, against a local role:
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

/** What the convex CLI prints for running `fn` on the deployment it names, parsed as JSON. */
function convexRun(fn: string): unknown {
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- the pnpm this checkout already runs
  const printed = execFileSync('pnpm', ['exec', 'convex', 'run', fn], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] })
  return JSON.parse(printed)
}

/**
 * Starts every backfill and waits for them.
 *
 * @returns Whether they all finished; the build log has said how they stand either way.
 */
async function runBackfills(limitSeconds: number): Promise<boolean> {
  convexRun('migrations:runAll')
  const waiter: Waiter = {
    look:  () => Promise.resolve(z.array(Outstanding).parse(convexRun('migrations:outstanding'))),
    pause: async (ms) => { await sleep(ms) },
    now:   () => Date.now(),
  }
  const { standing, outstanding } = await awaitBackfills(waiter, limitSeconds)
  if (standing === 'done') {
    process.stdout.write('Backfills: every one has finished.\n')
    return true
  }
  const why = standing === 'stuck' ? 'one has stopped, and the series with it' : `still running after ${String(limitSeconds)}s`
  console.warn([`Backfills: ${why}.`, ...outstanding.map((each) => `  ${lineFor(each)}`)].join('\n'))
  return false
}

/** The command line: one of the commands in the module's doc block. */
async function main([command, limitArg]: string[], env: Record<string, string | undefined>): Promise<void> {
  if (command === 'after-vercel-build') {
    if (! isProductionBuild(env)) { return }
    // The new functions already serve; a failed build now would only part the pages from them.
    try {
      await runBackfills(DefaultLimitSeconds)
    } catch (err) {
      console.warn(`Backfills: could not run them; the deploy stands. ${String(err)}`)
    }
    return
  }
  if (command !== 'run') { throw new Error('Usage: node scripts/convex-migrations.ts <run [seconds] | after-vercel-build>') }
  if (! await runBackfills(LimitSeconds.parse(limitArg ?? DefaultLimitSeconds))) { process.exitCode = 1 }
}

if (import.meta.main) {
  try {
    await main(process.argv.slice(2), process.env)
  } catch (err) {
    console.error(err instanceof Error ? err.message : err)
    process.exitCode = 1
  }
}
