/**
 * The e2e log: a JSON line for every run of the e2e suite through `pnpm e2e` and `pnpm e2e:rerun`,
 * from every checkout, kept beside the worktrees (`$TQ_WORKTREES/.e2e-log.jsonl`) so it outlives
 * them. It says how often the suite goes red for reasons that are not the code: the machine's
 * load, a cold build cache, a spec that fails beside the others and passes alone. `pnpm e2e:log`
 * summarises it.
 *
 * Here too is the reading of Playwright's JSON report into an outcome per spec, and the tally that
 * carries a branch's e2e proof (`notes/git_hygiene.md`, *Finishing*) from a full run through the
 * reruns that repair it. `scripts/spine.ts` runs the suite, keeps the tally and writes the log.
 */
import fs from 'node:fs'
import path from 'node:path'
import type { JSONReport, JSONReportSuite } from '@playwright/test/reporter'

/** How a spec came out of one run. `unrun` is a spec the run meant to run and never did: its setup failed, or the run was cut short */
export type Outcome = 'passed' | 'failed' | 'flaky' | 'skipped' | 'unrun'

/** One spec's outcome in one run, the spec named by its file and titles */
export interface SpecOutcome {
  spec:    string
  outcome: Outcome
}

/** What a run was: the whole suite, Playwright's `--last-failed`, or specs a worker chose */
export type RunKind = 'full' | 'rerun' | 'chosen'

/** The e2e build cache as a run found it: absent, seeded from the main checkout's and not yet used, or left by an earlier run */
export type CacheState = 'cold' | 'seeded' | 'warm'

/** A spec that failed in the full run and has passed since: alone with the code unchanged (a flake), or after a change */
export interface Cleared {
  spec: string
  how:  'flake' | 'repaired'
}

/**
 * Where a branch's e2e proof stands: the last full run, and every spec it failed that has not
 * passed since. The branch is proved once the full run finished and nothing is outstanding.
 */
export interface Tally {
  branch:      string
  /** The top the full run's branch stood on */
  top:         string
  /** The branch's patch-id at the full run */
  patchid:     string
  /** Whether the full run ran its specs to the end, red or green; a run that broke first (its web server never started) proves nothing */
  complete:    boolean
  outstanding: string[]
  cleared:     Cleared[]
}

/** One line of the log */
export interface Entry {
  at:        string
  branch:    string
  lane:      number
  kind:      RunKind
  args:      string[]
  /** Whether the run was of committed work alone; a run with uncommitted changes counts toward no proof */
  committed: boolean
  /** The one-minute load average as the run began, and the five-minute average as it ended */
  load:      { before: number, after: number }
  cores:     number
  cache:     CacheState
  seconds:   number
  /** The suite's exit status */
  status:    number
  counts:    Record<Outcome, number>
  /** The specs this run failed or never ran */
  failures:  string[]
  /** The specs this run cleared from the tally */
  cleared:   Cleared[]
  /** What the tally still holds outstanding after this run */
  still:     string[]
  proved:    boolean
}

/** The log's file: beside the worktrees, so it outlives each of them */
export function logfileOf(worktreesHome: string): string {
  return path.join(worktreesHome, '.e2e-log.jsonl')
}

/**
 * Each spec's outcome in a Playwright JSON report, specs named `file › describe › title`.
 *
 * @example outcomesOf({ suites: [{ title: 'grid.spec.ts', file: 'grid.spec.ts', specs: [{ title: 'folds', file: 'grid.spec.ts', tests: [{ status: 'unexpected', expectedStatus: 'passed' }] }] }] })  // => [{ spec: 'grid.spec.ts › folds', outcome: 'failed' }]
 */
export function outcomesOf(report: Pick<JSONReport, 'suites'>): SpecOutcome[] {
  return report.suites.flatMap((suite) => suiteOutcomes(suite, []))
}

/** The outcomes in `suite` and the suites inside it, below the titles `above` */
function suiteOutcomes(suite: JSONReportSuite, above: readonly string[]): SpecOutcome[] {
  // A file's own suite is titled with the file's name, which leads every spec's name already.
  const titles = suite.title === suite.file ? above : [...above, suite.title]
  const own = suite.specs.flatMap((spec) => spec.tests.map((test) => ({
    spec:    [spec.file, ...titles, spec.title].join(' › '),
    outcome: outcomeOf(test.status, test.expectedStatus),
  })))
  return [...own, ...(suite.suites ?? []).flatMap((inner) => suiteOutcomes(inner, titles))]
}

/** A test's outcome, from Playwright's status for it and the status it expected */
function outcomeOf(status: string, expectedStatus: string): Outcome {
  switch (status) {
  case 'expected':   { return 'passed' }
  case 'unexpected': { return 'failed' }
  case 'flaky':      { return 'flaky' }
  default:           { return expectedStatus === 'skipped' ? 'skipped' : 'unrun' }
  }
}

/** How many specs came out each way */
export function countsOf(outcomes: readonly SpecOutcome[]): Record<Outcome, number> {
  const counts: Record<Outcome, number> = { passed: 0, failed: 0, flaky: 0, skipped: 0, unrun: 0 }
  for (const { outcome } of outcomes) { counts[outcome] += 1 }
  return counts
}

/** The specs a run failed or never ran */
export function failuresOf(outcomes: readonly SpecOutcome[]): string[] {
  return outcomes.filter(({ outcome }) => outcome === 'failed' || outcome === 'unrun').map(({ spec }) => spec)
}

/** Whether a tally proves its branch: a full run finished, and every spec it failed has passed since */
export function isProved(tally: Tally | undefined): boolean {
  return tally !== undefined && tally.complete && tally.outstanding.length === 0
}

/**
 * The tally after one more run. A full run starts it afresh. A rerun or a run of chosen specs
 * clears each outstanding spec it passed (a flake when the branch's patch-id is the full run's,
 * repaired when it has changed since), and adds any spec it failed; without a full run of this
 * branch to build on, it changes nothing.
 *
 * @param prior - The tally before this run, if any.
 * @param run - The run: its kind, the branch and its top and patch-id, its exit status and outcomes.
 * @returns The new tally, and the specs this run cleared.
 *
 * @example tallied(undefined, { kind: 'full', branch: 'b', top: 't', patchid: 'p', status: 1, outcomes: [{ spec: 'a', outcome: 'failed' }] }).tally.outstanding  // => ['a']
 */
export function tallied(prior: Tally | undefined, run: { kind: RunKind, branch: string, top: string, patchid: string, status: number, outcomes: readonly SpecOutcome[] }): { tally: Tally | undefined, cleared: Cleared[] } {
  const failures = failuresOf(run.outcomes)
  if (run.kind === 'full') {
    // A run that exits red without naming a spec it failed broke before its specs could say anything.
    const complete = run.outcomes.length > 0 && (run.status === 0 || failures.length > 0)
    return { tally: { branch: run.branch, top: run.top, patchid: run.patchid, complete, outstanding: failures, cleared: [] }, cleared: [] }
  }
  if (! prior?.complete || prior.branch !== run.branch) { return { tally: prior, cleared: [] } }
  const passed = new Set(run.outcomes.filter(({ outcome }) => outcome === 'passed' || outcome === 'flaky').map(({ spec }) => spec))
  const how = run.patchid === prior.patchid ? 'flake' : 'repaired'
  const cleared = prior.outstanding.filter((spec) => passed.has(spec)).map((spec) => ({ spec, how }) as const)
  const kept = prior.outstanding.filter((spec) => ! passed.has(spec))
  const outstanding = [...kept, ...failures.filter((spec) => ! kept.includes(spec))]
  return { tally: { ...prior, outstanding, cleared: [...prior.cleared, ...cleared] }, cleared }
}

/** The tally's flakes: specs that failed in the full run and passed alone, the code unchanged */
export function flakesOf(tally: Tally | undefined): string[] {
  return (tally?.cleared ?? []).filter(({ how }) => how === 'flake').map(({ spec }) => spec)
}

/** Appends `entry` to the log at `logfile` */
export function append(logfile: string, entry: Entry): void {
  fs.mkdirSync(path.dirname(logfile), { recursive: true })
  fs.appendFileSync(logfile, `${JSON.stringify(entry)}\n`)
}

/** Every entry in the log at `logfile`, skipping any line that does not parse; none when there is no log */
export function read(logfile: string): Entry[] {
  if (! fs.existsSync(logfile)) { return [] }
  return fs.readFileSync(logfile, 'utf8').split('\n').filter(Boolean).flatMap((line) => {
    try {
      return [JSON.parse(line) as Entry]
    } catch {
      return []
    }
  })
}

/** The load bands the summary splits runs into, by the five-minute load average as each run ended */
const LoadBands = [[0, 8, 'under 8'], [8, 16, '8 to 16'], [16, 32, '16 to 32'], [32, Infinity, '32 and up']] as const

/**
 * The band `load` falls in.
 *
 * @example loadBandOf(7.9)  // => 'under 8'
 * @example loadBandOf(16)   // => '16 to 32'
 */
export function loadBandOf(load: number): string {
  return (LoadBands.find(([beg, end]) => load >= beg && load < end) ?? LoadBands[0])[2]
}

/** Whether a run went red: a spec failed or never ran, or the suite exited red */
function isRed(entry: Entry): boolean {
  return entry.status !== 0 || entry.failures.length > 0
}

/** One summary row: how many runs, how many red, and how long they took on average */
function rowOf(title: string, entries: readonly Entry[]): string {
  const red = entries.filter((entry) => isRed(entry)).length
  const minutes = entries.reduce((sum, entry) => sum + entry.seconds, 0) / Math.max(entries.length, 1) / 60
  const pct = Math.round((100 * red) / Math.max(entries.length, 1))
  return `  ${title.padEnd(10)} ${String(entries.length).padStart(4)} runs  ${String(red).padStart(4)} red (${String(pct).padStart(3)}%)  mean ${minutes.toFixed(1)} min`
}

/**
 * The log, summarised for a person: full runs red by load and by build cache, and how many of the
 * specs full runs failed passed alone with the code unchanged.
 *
 * @example summarise([])  // => ['The e2e log is empty: `pnpm e2e` writes a line for every run.']
 */
export function summarise(entries: readonly Entry[]): string[] {
  if (entries.length === 0) { return ['The e2e log is empty: `pnpm e2e` writes a line for every run.'] }
  const full = entries.filter((entry) => entry.kind === 'full')
  const groupBy = (keyOf: (entry: Entry) => string, order: readonly string[]) => order.flatMap((key) => {
    const group = full.filter((entry) => keyOf(entry) === key)
    return group.length === 0 ? [] : [rowOf(key, group)]
  })
  const failed = full.reduce((sum, entry) => sum + entry.failures.length, 0)
  const cleared = entries.flatMap((entry) => entry.cleared)
  const flakes = cleared.filter(({ how }) => how === 'flake').map(({ spec }) => spec)
  const often = Object.entries(Object.groupBy(flakes, (spec) => spec)).map(([spec, seen]) => ({ spec, count: seen?.length ?? 0 }))
    .toSorted((aa, bb) => bb.count - aa.count).slice(0, 5)
  const dates = entries.map(({ at }) => at.slice(0, 10)).toSorted((aa, bb) => aa.localeCompare(bb))
  return [
    `${String(entries.length)} runs logged, ${dates[0] ?? ''} to ${dates.at(-1) ?? ''}: ${String(full.length)} full, ${String(entries.length - full.length)} reruns or chosen specs.`,
    'Full runs, by the load as each ended (five-minute average):',
    ...groupBy((entry) => loadBandOf(entry.load.after), LoadBands.map((band) => band[2])),
    'Full runs, by the build cache each found:',
    ...groupBy((entry) => entry.cache, ['cold', 'seeded', 'warm']),
    `Specs failed in full runs: ${String(failed)}. Passed alone since, code unchanged (flakes): ${String(flakes.length)}; after a change: ${String(cleared.length - flakes.length)}.`,
    ...(often.length === 0 ? [] : ['Flaking most often:', ...often.map(({ spec, count }) => `  ${String(count).padStart(3)}  ${spec}`)]),
  ]
}
