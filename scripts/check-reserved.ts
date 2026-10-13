/**
 * Names every hunt whose label or org the reserved list would refuse, were it made now, through
 * `check_reserved:refused`. Such a hunt stands, writable, at its address: the list governs only a
 * label being made or claimed (`src/lib/vv/patterns.ts`). Run it against production after the
 * list grows, to see what the new words leave standing.
 *
 * Read-only. It stands behind the janitor's guard all the same (`scripts/janitor.ts`), so it names
 * the deployment it reached before it says anything else; `--deployment` changes nothing but
 * which deployment it insists on reaching.
 *
 *   ./scripts/doppledo prd_janitor scripts/check_reserved
 *
 * Exits 0 whatever it finds; 1 only when it stops.
 */
import { z } from 'zod'
import { convexRun } from './convex-migrations.ts'
import { JanitorStop, stopOrThrow, takeAim } from './janitor.ts'

/** How a function on the deployment is run: its path and arguments, and what it answered */
export type RunT = (fnpath: string, args: Record<string, unknown>) => unknown

/** One hunt the list would refuse: its address, and which of its labels */
const Refused = z.object({ orglabel: z.string(), label: z.string(), refused: z.array(z.enum(['orglabel', 'label'])).min(1) })

/** What `check_reserved:refused` answers: how many hunts it read, and those the list would refuse */
const Report = z.object({ counted: z.int().nonnegative(), refused: z.array(Refused) })
export type ReportT = z.infer<typeof Report>

/**
 * A hunt the list would refuse, as a line for a person: its address, and which of its labels.
 *
 * @example lineOf({ orglabel: 'google_fan', label: 'privacy', refused: ['orglabel', 'label'] })  // => '  ~google_fan/privacy  (its org and its label)'
 */
export function lineOf(hunt: z.infer<typeof Refused>): string {
  const which = hunt.refused.map((fieldname) => (fieldname === 'orglabel' ? 'its org' : 'its label')).join(' and ')
  return `  ~${hunt.orglabel}/${hunt.label}  (${which})`
}

/**
 * The command, carried out: aim, ask, and say what the list would refuse.
 *
 * @param argv - The command line: `--deployment <name>`, or nothing.
 * @param run - How a function on the deployment is run.
 * @param say - Where a line for the person running it goes.
 * @param reach - As `takeAim` takes it, for a test.
 * @returns What the deployment answered.
 */
export function checkReserved(argv: readonly string[], run: RunT, say: (line: string) => void, reach?: Parameters<typeof takeAim>[1]): ReportT {
  const { aim, rest } = takeAim(argv, reach)
  if (rest.length > 0) { throw new JanitorStop(`Usage: scripts/check_reserved [--deployment <name>] (what is ${rest.join(' ')}?)`) }
  say(aim.said)
  const report = Report.parse(run('check_reserved:refused', {}))
  say(`Read ${String(report.counted)} hunts.`)
  if (report.refused.length === 0) {
    say('None has a label or org the reserved list keeps from new ones.')
    return report
  }
  say(`${String(report.refused.length)} have a label or org the reserved list keeps from new ones. Each hunt keeps its address, and its own row stays writable:`)
  for (const hunt of report.refused) { say(lineOf(hunt)) }
  return report
}

if (import.meta.main) {
  try {
    const run: RunT = (fnpath, args) => convexRun(fnpath, args, { quiet: true })
    checkReserved(process.argv.slice(2), run, (line) => { process.stdout.write(`${line}\n`) })
  } catch (err) {
    stopOrThrow(err)
  }
}
