/**
 * The guard to run before the reserved list grows: reads every label the deployment holds through
 * `check_reserved:held`, and judges each against the list of the checkout it runs from
 * (`Labelmaker.isReserved`, top-level words and all). A userlabel is held to the whole list always
 * (`CK.userlabel`), so a word added while someone holds it leaves that user unable to make a hunt
 * or be put on one, and the hunts of an org so named out of reach and unwritable. Run it against
 * production from the branch that grows the list, and deploy the list only once it names no holder.
 * A hunt's own label is held to the top-level words only as it is made, so one they keep from new
 * hunts is named too, as standing; it guards the growth of the top-level list alone, since a word
 * added to the list every label is kept from (`PA.ReservedLabelGroups`) locks every row so labelled.
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
import * as Labelmaker from '../src/lib/labelmaker'
import { convexRun } from './convex-migrations.ts'
import { JanitorStop, stopOrThrow, takeAim } from './janitor.ts'

/** How a function on the deployment is run: its path and arguments, and what it answered */
export type RunT = (fnpath: string, args: Record<string, unknown>) => unknown

/** A hunt's two labels, as its address reads them */
const HuntLabels = z.object({ orglabel: z.string(), label: z.string() })

/** What `check_reserved:held` answers: the labels held, by where */
const Held = z.object({ users: z.array(z.string()), ghostings: z.array(z.string()), hunts: z.array(HuntLabels) })
export type HeldT = z.infer<typeof Held>

/** Which of a hunt's labels the list keeps */
type HuntFoundT = { orglabel: string, label: string, refused: ('orglabel' | 'label')[] }

/** What the list keeps among the labels held, and how many of each were read */
export type ReportT = {
  counted:   { users: number, ghostings: number, hunts: number },
  /** Userlabels users hold that the list keeps */
  users:     string[],
  /** Userlabels ghostings hold that the list keeps */
  ghostings: string[],
  /** Hunts whose org, label or both the list keeps */
  hunts:     HuntFoundT[],
}

/** Whether the list of this checkout keeps `label`, as a userlabel or a new hunt's label */
function isKept(label: string): boolean {
  return Labelmaker.isReserved(label, { toplevel: true })
}

/**
 * What the list keeps among `held`: each userlabel a user or ghosting holds that it keeps, and
 * each hunt whose org or label it keeps, saying which.
 *
 * @example reportOf({ users: ['flip_kromer', 'google_fan'], ghostings: [], hunts: [{ orglabel: 'pat_smith', label: 'privacy' }] })
 *   // => { counted: { users: 2, ghostings: 0, hunts: 1 }, users: ['google_fan'], ghostings: [], hunts: [{ orglabel: 'pat_smith', label: 'privacy', refused: ['label'] }] }
 */
export function reportOf(held: HeldT): ReportT {
  const hunts = held.hunts.map(({ orglabel, label }) => ({
    orglabel, label, refused: [isKept(orglabel) && 'orglabel' as const, isKept(label) && 'label' as const].filter((fieldname) => fieldname !== false),
  }))
  return {
    counted:   { users: held.users.length, ghostings: held.ghostings.length, hunts: held.hunts.length },
    users:     held.users.filter((userlabel) => isKept(userlabel)),
    ghostings: held.ghostings.filter((userlabel) => isKept(userlabel)),
    hunts:     hunts.filter((hunt) => hunt.refused.length > 0),
  }
}

/**
 * A hunt the list would refuse, as a line for a person: its address, and which of its labels.
 *
 * @example lineOf({ orglabel: 'google_fan', label: 'privacy', refused: ['orglabel', 'label'] })  // => '  ~google_fan/privacy  (its org and its label)'
 */
export function lineOf(hunt: HuntFoundT): string {
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
 * @returns What the list keeps among what the deployment holds.
 */
export function checkReserved(argv: readonly string[], run: RunT, say: (line: string) => void, reach?: Parameters<typeof takeAim>[1]): ReportT {
  const { aim, rest } = takeAim(argv, reach)
  if (rest.length > 0) { throw new JanitorStop(`Usage: scripts/check_reserved [--deployment <name>] (what is ${rest.join(' ')}?)`) }
  say(aim.said)
  const report = reportOf(Held.parse(run('check_reserved:held', {})))
  const { counted } = report
  say(`Read the userlabels of ${String(counted.users)} users and ${String(counted.ghostings)} ghostings, and ${String(counted.hunts)} hunts.`)
  const orgs = report.hunts.filter((hunt) => hunt.refused.includes('orglabel'))
  const holders = [
    ...report.users.map((userlabel) => `  ~${userlabel}  (a user's userlabel)`),
    ...report.ghostings.map((userlabel) => `  ~${userlabel}  (retired by a merge: a ghosting's)`),
    ...orgs.map((hunt) => lineOf(hunt)),
  ]
  if (holders.length === 0) {
    say('Nothing holds a userlabel or org the reserved list here keeps: it may be deployed.')
  } else {
    say('These hold a userlabel or org the reserved list here keeps. Deploy the list only once each has moved; until then it would lock them out:')
    for (const line of holders) { say(line) }
  }
  const standing = report.hunts.filter((hunt) => ! hunt.refused.includes('orglabel'))
  if (standing.length > 0) {
    say('These hunts have a label the list here keeps from new ones. Each keeps it at its address, writable while the word is a top-level one; a word every label is kept from locks the hunt:')
    for (const hunt of standing) { say(lineOf(hunt)) }
  }
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
