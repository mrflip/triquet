/**
 * Deletes every person from a deployment and keeps its hunts: every row of `users` and Convex
 * Auth's other tables, `idents`, `identings`, `huntings`, `reviews` and `reviewings`, through
 * `clear_people:clearBatch`, run until a run deletes nothing. Hunts, and everything under them,
 * stay at their addresses. Every browser is signed out. (`notes/deploy.md`, *Clearing production's
 * people*.)
 *
 * A dry run unless told the deployment to act on (`scripts/janitor.ts`): it counts each table's
 * rows (`clear_people:count`) and changes nothing. Told, it counts, deletes batch after batch,
 * saying what each run deleted, and counts again to show what is left, which is nothing unless a
 * visitor arrived meanwhile.
 *
 *   ./scripts/doppledo prd_janitor scripts/clear_people                                  count, and say where it is aimed
 *   ./scripts/doppledo prd_janitor scripts/clear_people --deployment <the name it said>  delete
 *
 * Exits 1 when it stops, or when rows are left after deleting.
 */
import { z } from 'zod'
import { convexRun } from './convex-migrations.ts'
import { dryRunCoda, JanitorStop, stopOrThrow, takeAim } from './janitor.ts'

/** How a function on the deployment is run: its path and arguments, and what it answered */
export type RunT = (fnpath: string, args: Record<string, unknown>) => unknown

/** Rows by table, as the deployment names its tables */
export type CountsT = Record<string, number>

/** Where `clear_people:count` takes up */
const CountAt = z.object({ tablename: z.string(), cursor: z.string().nullable() })

/** A page of `clear_people:count`'s counting */
const CountPage = z.object({ tablename: z.string(), counted: z.int().nonnegative(), next: CountAt.nullable() })

/** What one run of `clear_people:clearBatch` deleted, by table */
const Deleted = z.record(z.string(), z.int().nonnegative())

/** How many runs of `clearBatch` are made at most before giving up: a batch is 500 rows, so half a million */
export const RunsMax = 1000

/**
 * How many rows each of the people's tables holds, in the order the deployment counts them, a page
 * at a time.
 *
 * @example countsOf(run)  // => { reviewings: 12, reviews: 3, ..., users: 40 }
 */
export function countsOf(run: RunT): CountsT {
  const counts: CountsT = {}
  let at: z.infer<typeof CountAt> | null = null
  do {
    const page = CountPage.parse(run('clear_people:count', { at }))
    counts[page.tablename] = (counts[page.tablename] ?? 0) + page.counted
    at = page.next
  } while (at !== null)
  return counts
}

/**
 * How many rows `counts` holds in all.
 *
 * @example totalOf({ users: 3, idents: 2 })  // => 5
 */
export function totalOf(counts: CountsT): number {
  return Object.values(counts).reduce((sum, count) => sum + count, 0)
}

/**
 * `counts` as lines for a person: each table and its count, aligned, and the total.
 *
 * @example linesOf({ users: 3, idents: 2 })  // => ['  users   3', '  idents  2', '  in all  5']
 */
export function linesOf(counts: CountsT): string[] {
  const rows = [...Object.entries(counts), ['in all', totalOf(counts)] as const]
  const width = Math.max(...rows.map(([tablename]) => tablename.length))
  const countWidth = Math.max(...rows.map(([, count]) => String(count).length))
  return rows.map(([tablename, count]) => `  ${tablename.padEnd(width)}  ${String(count).padStart(countWidth)}`)
}

/**
 * Runs `clear_people:clearBatch` until a run deletes nothing, telling `say` what each run deleted,
 * table by table in the order `order` names them (the deployment answers them alphabetically).
 *
 * @returns How many rows of each table were deleted, over every run, in that order.
 * @throws When rows are still being deleted after `RunsMax` runs.
 *
 * @example clearedWith(run, console.log, Object.keys(countsOf(run)))  // => { reviewings: 12, ..., users: 40 }, having said 'Run 1: deleted 52 (reviewings 12, …)' and 'Run 2: deleted nothing.'
 */
export function clearedWith(run: RunT, say: (line: string) => void, order: readonly string[]): CountsT {
  const deleted: CountsT = {}
  for (let iter = 1; iter <= RunsMax; iter += 1) {
    const ran = Deleted.parse(run('clear_people:clearBatch', {}))
    const tablenames = [...order, ...Object.keys(ran).filter((tablename) => ! order.includes(tablename))]
    const some = tablenames.map((tablename) => [tablename, ran[tablename] ?? 0] as const).filter(([, count]) => count > 0)
    if (some.length === 0) {
      say(`Run ${String(iter)}: deleted nothing.`)
      return deleted
    }
    for (const [tablename, count] of some) { deleted[tablename] = (deleted[tablename] ?? 0) + count }
    const listed = some.map(([tablename, count]) => `${tablename} ${String(count)}`).join(', ')
    say(`Run ${String(iter)}: deleted ${String(totalOf(ran))} (${listed}).`)
  }
  throw new JanitorStop(`Still deleting after ${String(RunsMax)} runs: something is writing people as fast as they go. Nothing more was done.`)
}

/**
 * The command, carried out: aim, count, and, when acting, delete and count again.
 *
 * @param argv - The command line: `--deployment <name>`, or nothing.
 * @param run - How a function on the deployment is run.
 * @param say - Where a line for the person running it goes.
 * @param reach - As `takeAim` takes it, for a test.
 * @returns Whether every row is gone: true after a dry run too.
 */
export function clearPeople(argv: readonly string[], run: RunT, say: (line: string) => void, reach?: Parameters<typeof takeAim>[1]): boolean {
  const { aim, rest } = takeAim(argv, reach)
  if (rest.length > 0) { throw new JanitorStop(`Usage: scripts/clear_people [--deployment <name>] (what is ${rest.join(' ')}?)`) }
  say(aim.said)
  const before = countsOf(run)
  say('The people\'s rows:')
  for (const line of linesOf(before)) { say(line) }
  if (! aim.acting) {
    say(dryRunCoda(aim))
    return true
  }
  const deleted = clearedWith(run, say, Object.keys(before))
  say('Deleted, over every run:')
  for (const line of linesOf(deleted)) { say(line) }
  const after = countsOf(run)
  const left = totalOf(after)
  if (left === 0) {
    say(`${aim.deployment} holds none of the people's rows now.`)
    return true
  }
  say(`${aim.deployment} still holds ${String(left)} of the people's rows, written while this ran:`)
  for (const line of linesOf(after)) { say(line) }
  say('Run it again: the clear deletes only what it finds.')
  return false
}

if (import.meta.main) {
  try {
    const run: RunT = (fnpath, args) => convexRun(fnpath, args, { quiet: true })
    if (! clearPeople(process.argv.slice(2), run, (line) => { process.stdout.write(`${line}\n`) })) { process.exitCode = 1 }
  } catch (err) {
    stopOrThrow(err)
  }
}
