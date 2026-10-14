/**
 * The guard to run before a reserved list grows: reads every row the deployment holds, in every one
 * of our tables, a page at a time (`check_reserved:page`), and judges each by the row validator of
 * the checkout it runs from (`RowValidators`), so every label is judged as its field is when
 * written: a userlabel or a hunt's org against both lists (`CK.userlabel`), every other label
 * against the words every label is kept from (`PA.ReservedLabelGroups`, `PA.Unreserved`), a
 * widgeting's against its own namespace's too (`ReservedWidgetingLabels`), and a widgeting's
 * params with the words their formularies let through. A row its validator would refuse is
 * locked once the list deploys: each write to it is refused, and a userlabel or org so held locks
 * its holder out and its hunts out of reach. So it guards growth of either list, and any other
 * tightening of a row validator besides. Run it against production from the branch growing the
 * list, and deploy only once it names no row.
 *
 * A hunt's own label is held to the top-level words only as it is made, so a hunt whose label they
 * keep from new ones is named apart, as standing: it keeps its label and needs nothing done. A hunt
 * refused already (its org, say) is named once, as refused.
 *
 * Read-only. It stands behind the janitor's guard all the same (`scripts/janitor.ts`), so it names
 * the deployment it reached before it says anything else; `--deployment` changes nothing but
 * which deployment it insists on reaching.
 *
 *   ./scripts/doppledo prd_janitor scripts/check_reserved
 *
 * Exits 0 whatever it finds; 1 only when it stops.
 */
import _ from 'es-toolkit/compat'
import { z } from 'zod'
import { RowValidators } from '../convex/schema'
import * as Routes from '../src/lib/routes'
import * as UU from '../src/lib/useful'
import { HuntValidators } from '../src/models/hunt'
import { convexRun } from './convex-migrations.ts'
import { JanitorStop, stopOrThrow, takeAim } from './janitor.ts'

/** How a function on the deployment is run: its path and arguments, and what it answered, or a promise of it */
export type RunT = (fnpath: string, args: Record<string, unknown>) => unknown

/** One of our tables: one with a row validator */
export type TablenameT = keyof typeof RowValidators

/** Our tables, in the order the schema names them */
export const Tablenames = Object.keys(RowValidators) as TablenameT[]

/** A row as the deployment holds it: its fields, `_id` and `_creationTime` among them */
export type RowT = Record<string, unknown>

/** What `check_reserved:page` answers: one page of a table's rows, or null for a table the deployment does not hold */
const Row = z.record(z.string(), z.unknown())
const Page = z.object({ page: z.array(Row), isDone: z.boolean(), continueCursor: z.string(), pageStatus: z.string().nullish() }).nullable()

/** The rows a deployment holds, by table; a table it does not hold is absent */
export type HeldT = Partial<Record<TablenameT, RowT[]>>

/** A value a row holds that its validator refuses, and where it sits */
export type RefusedT = {
  table:  TablenameT,
  /** The address of the hunt or quiz the row belongs to, when it belongs to one */
  where:  string | null,
  /** The row: its label, else its userlabel, else its id */
  row:    string,
  /** The field, as a path into the row: `params.data` for a param's name */
  field:  string,
  /** The value refused, as it is held */
  val:    unknown,
  /** Why: the validator's message */
  reason: string,
}

/** What the validators here refuse among the rows held, how many of each table were read, and which tables the deployment does not hold */
export type ReportT = {
  counted:  Partial<Record<TablenameT, number>>,
  absent:   TablenameT[],
  refused:  RefusedT[],
  /** The addresses of hunts whose own label the list keeps from new ones, which keep it */
  standing: string[],
}

/** Every row `table` holds, read a page at a time until it is done; null when the deployment does not hold the table */
async function rowsOf(run: RunT, table: TablenameT): Promise<RowT[] | null> {
  const rows: RowT[] = []
  let cursor: string | null = null
  for (;;) {
    const page = Page.parse(await run('check_reserved:page', { table, cursor }))
    if (page === null) { return null }
    if (page.pageStatus === 'SplitRequired') { throw new JanitorStop(`A page of ${table} came back short of rows (SplitRequired): nothing judged, as a row may be missing`) }
    rows.push(...page.page)
    if (page.isDone) { return rows }
    cursor = page.continueCursor
  }
}

/**
 * Every row the deployment holds, table by table, reading each a page at a time until it is done.
 *
 * @param run - How a function on the deployment is run.
 * @returns The rows, by table; a table the deployment does not hold is absent.
 */
export async function heldFrom(run: RunT): Promise<HeldT> {
  const held: HeldT = {}
  for (const table of Tablenames) {
    const rows = await rowsOf(run, table)
    if (rows !== null) { held[table] = rows }
  }
  return held
}

/** The string `row` holds at `key`, or undefined when it holds none */
function textAt(row: RowT | undefined, key: string): string | undefined {
  const val = row?.[key]
  return typeof val === 'string' ? val : undefined
}

/** The rows of a table, by id */
function byId(rows: RowT[] | undefined): Map<string, RowT> {
  return new Map((rows ?? []).map((row) => [String(row._id), row]))
}

/** The hunts, realms and quizzes held, by id: what a row is placed by */
export type PlacesT = Record<'hunts' | 'realms' | 'quizzes', Map<string, RowT>>

/**
 * The hunts, realms and quizzes of `held`, by id.
 *
 * @example placesOf({ hunts: [{ _id: 'h1', orglabel: 'pat_smith', label: 'quiet_otter' }] }).hunts.get('h1')?.label  // => 'quiet_otter'
 */
export function placesOf(held: HeldT): PlacesT {
  return { hunts: byId(held.hunts), realms: byId(held.realms), quizzes: byId(held.quizzes) }
}

/**
 * The address of the hunt or quiz `row` of `table` belongs to: the row itself when it is one, else
 * the one its `hunt_id` and `quiz_id` point to. Null for a row belonging to none (a user, a widget).
 *
 * @example whereOf('questions', { hunt_id: 'h1', quiz_id: 'q1' }, placesOf(held))  // => '/~pat_smith/quiet_otter/quizzes/home/loud_heron'
 */
export function whereOf(table: TablenameT, row: RowT, places: PlacesT): string | null {
  const hunt  = table === 'hunts' ? row : places.hunts.get(String(row.hunt_id))
  const quiz  = table === 'quizzes' ? row : places.quizzes.get(String(row.quiz_id))
  const realm = table === 'realms' ? row : places.realms.get(String(quiz?.realm_id))
  const [org, huntlabel, realmlabel, quizlabel] = [textAt(hunt, 'orglabel'), textAt(hunt, 'label'), textAt(realm, 'label'), textAt(quiz, 'label')]
  if (org === undefined || huntlabel === undefined) { return null }
  const labels = { org, hunt: huntlabel }
  return realmlabel !== undefined && quizlabel !== undefined ? Routes.quizPath({ ...labels, realm: realmlabel, quiz: quizlabel }) : Routes.huntPath(labels)
}

/** Why `issue` was raised, in the validator's words: a refused key's or element's own reasons, rather than "Invalid key in record" */
function reasonOf(issue: z.core.$ZodIssue): string {
  return issue.code === 'invalid_key' || issue.code === 'invalid_element' ? issue.issues.map((inner) => inner.message).join('; ') : issue.message
}

/**
 * What the row validators here refuse among `held`, each by where it sits, and the hunts they
 * refuse nothing of whose own label the top-level words keep from new ones.
 *
 * @example reportOf({ users: [{ _id: 'u1', userlabel: 'google_fan' }] }).refused
 *   // => [{ table: 'users', where: null, row: 'google_fan', field: 'userlabel', val: 'google_fan', reason: "is kept for the app's own pages and people: add to it, as my_label or label_2" }]
 */
export function reportOf(held: HeldT): ReportT {
  const places = placesOf(held)
  const refused = Tablenames.flatMap((table) => (held[table] ?? []).flatMap((row) => {
    const judged = RowValidators[table].safeParse(row, { reportInput: true })
    if (judged.success) { return [] }
    const where = whereOf(table, row, places)
    const name = textAt(row, 'label') ?? textAt(row, 'userlabel') ?? String(row._id)
    return judged.error.issues.map((issue) => ({ table, where, row: name, field: issue.path.join('.'), val: issue.input, reason: reasonOf(issue) }))
  }))
  const standing = (held.hunts ?? [])
    .filter((hunt) => RowValidators.hunts.safeParse(hunt).success && ! HuntValidators.newLabel.safeParse(hunt.label).success)
    .map((hunt) => whereOf('hunts', hunt, places) ?? String(hunt._id))
  return {
    counted: _.mapValues(held, (rows) => rows?.length ?? 0),
    absent:  Tablenames.filter((table) => held[table] === undefined),
    refused,
    standing,
  }
}

/**
 * A value refused, as a line for a person: where its row sits, the row, and the field, value and reason.
 *
 * @example lineOf({ table: 'questions', where: '/~pat_smith/quiet_otter/quizzes/home/loud_heron', row: 'leon', field: 'chains_to', val: 'constructor', reason: 'is a word the tool keeps' })
 *   // => '  /~pat_smith/quiet_otter/quizzes/home/loud_heron  questions leon  chains_to "constructor": is a word the tool keeps'
 */
export function lineOf(found: RefusedT): string {
  const place = found.where === null ? '' : `${found.where}  `
  return `  ${place}${found.table} ${found.row}  ${found.field} ${_.truncate(UU.jsonify(found.val), { length: 60 })}: ${found.reason}`
}

/**
 * The command, carried out: aim, read, and say what the validators here would refuse.
 *
 * @param argv - The command line: `--deployment <name>`, or nothing.
 * @param run - How a function on the deployment is run.
 * @param say - Where a line for the person running it goes.
 * @param reach - As `takeAim` takes it, for a test.
 * @returns What the validators here refuse among what the deployment holds.
 */
export async function checkReserved(argv: readonly string[], run: RunT, say: (line: string) => void, reach?: Parameters<typeof takeAim>[1]): Promise<ReportT> {
  const { aim, rest } = takeAim(argv, reach)
  if (rest.length > 0) { throw new JanitorStop(`Usage: scripts/check_reserved [--deployment <name>] (what is ${rest.join(' ')}?)`) }
  say(aim.said)
  const report = reportOf(await heldFrom(run))
  const counts = Object.entries(report.counted).map(([table, count]) => `${table} ${String(count)}`)
  say(`Read every row of ${String(counts.length)} tables: ${counts.join(', ')}.`)
  if (report.absent.length > 0) { say(`The deployment holds no table ${report.absent.join(', ')} yet: nothing there to judge.`) }
  if (report.refused.length === 0) {
    say('Nothing held is refused by the validators here, the reserved lists among them: they may be deployed.')
  } else {
    say('These rows hold what the validators here refuse. Deploy only once each has moved; until then each is locked, and a userlabel or org so held locks out its holder or its hunts:')
    for (const found of report.refused) { say(lineOf(found)) }
  }
  if (report.standing.length > 0) {
    say('These hunts have a label the list here keeps from new ones. Each keeps it at its address, and needs nothing done:')
    for (const where of report.standing) { say(`  ${where}`) }
  }
  return report
}

if (import.meta.main) {
  try {
    const run: RunT = (fnpath, args) => convexRun(fnpath, args, { quiet: true })
    await checkReserved(process.argv.slice(2), run, (line) => { process.stdout.write(`${line}\n`) })
  } catch (err) {
    stopOrThrow(err)
  }
}
