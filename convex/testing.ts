import { env } from './_generated/server'
import type { Doc } from './_generated/dataModel'
import schema from './schema'
import * as Labelmaker from '../src/lib/labelmaker'
import * as Routes from '../src/lib/routes'
import { ValidatorKit } from '../src/lib/validator'
import { planWidgetingEdit } from '../src/lib/widgeting-edit'
import { widgetFrom } from '../src/lib/rows'
import { Column, namesFor, QuestionFieldVals, QuestionViewVals, type QuestionField, type QuestionView } from '../src/models/column'
import { ActionValidators, isLayoutAction } from '../src/models/actions'
import { AddedColumnWidthPx } from '../src/models/layout'
import { HomeRealmLabel } from '../src/models/realm'
import { zInternalMutation } from './functions'
import { huntInOrg, identForLabel, layoutOf, realmsOf, widgetForLabel, wholeQuizOf } from './reading'
import { makeHuntFor } from './writing/account_actions'
import { addColumn, performLayout } from './writing/layout_actions'
import type { OpenQuizT, Writer } from './writing/quiz_writing'

const { arr, label, oneof, str, userlabel, zod } = ValidatorKit

/** How many rows one run deletes before handing the rest to the next: a delete reads, and its triggers read, and a function may read only so much */
const BatchSize = 500

/**
 * Empty every table of a development or test deployment, up to a batch of rows a run, table by table:
 * run it again until it says it deleted nothing (`scripts/convex_reset` does). Refused on a
 * deployment without `TRIQUET_CLEARABLE=yes`, which production never has.
 *
 * @returns How many rows this run deleted; zero once the deployment is empty.
 * @throws On a deployment that may not be emptied; nothing is deleted.
 *
 * @example npx convex run testing:clearAll --env-file data/convex-agent/cli.env
 */
export const clearAll = zInternalMutation({
  args:    {},
  returns: zod.number(),
  handler: async (ctx) => {
    if (env.TRIQUET_CLEARABLE !== 'yes') { throw new Error('This deployment may not be emptied: TRIQUET_CLEARABLE is not yes') }
    const tablenames = Object.keys(schema.tables) as (keyof typeof schema.tables)[]
    // Table by table, each read just before it is cleared, not side by side: a trigger may take a
    // row away with another (a quiz takes its change signal).
    let deleted = 0
    for (const tablename of tablenames) {
      const rows = await ctx.db.query(tablename).take(BatchSize - deleted)
      for (const row of rows) { await ctx.db.delete(tablename, row._id) }
      deleted += rows.length
    }
    return deleted
  },
})

/** How many fresh labels `makeHunt` draws before it gives up on finding one its ident's org has not used */
const LabelDrawsMax = 9

/**
 * Make a hunt for the ident labelled `ident`, as its smith, the way the hunts list's *+ New hunt*
 * does (`new_hunt`), and lay out its quiz with `widgetings` and `columns` the way the gear's
 * dialogs would, in the order given. The e2e suite's way in to a quiz that is not about the way
 * in: the ident is the one its worker's browsers hold, and the address is where they go. Unlike
 * `new_hunt`, it makes one however many its ident has made (`makeHuntFor`): a worker makes every
 * hunt of its tests, and a run on one worker makes more than one username may.
 * Refused on a deployment without `TRIQUET_CLEARABLE=yes`, which production never has.
 *
 * Internal, never public: acting as whichever ident an argument names is for a holder of the
 * deployment's admin key alone.
 *
 * @param ident - The label of the ident to make it for, which a session must already hold.
 * @param widgetings - The library's widgets to put to work, each bringing its column, as *+ New widgeting* does.
 * @param columns - The question's own fields and views to show, each in a column at the grid's end, as *+ New column* does.
 * @returns The address of the hunt's quiz, opened to edit.
 * @throws On a deployment that may not be made into, for an ident no session holds, or a widget the library lacks; nothing is written.
 *
 * @example npx convex run testing:makeHunt '{"ident": "tester_0123abcd", "widgetings": ["dumdum"], "columns": ["hint"]}'
 *   // => '/~tester_0123abcd/quiet_otter/quizzes/home/quiet_otter/!edit', say
 */
export const makeHunt = zInternalMutation({
  args: {
    ident:      userlabel,
    widgetings: arr(label).default([]),
    columns:    arr(oneof([...QuestionFieldVals, ...QuestionViewVals])).default([]),
  },
  returns: str,
  handler: async (ctx, { ident: identLabel, widgetings, columns }) => {
    if (env.TRIQUET_CLEARABLE !== 'yes') { throw new Error('This deployment is not one to make hunts in by hand: TRIQUET_CLEARABLE is not yes') }
    const ident = await identForLabel(ctx.db, identLabel)
    if (! ident?.user_id) { throw new Error(`No session holds the ident ${identLabel}: say who you are at the front door first`) }
    const hunt = await freshHuntLabel(ctx.db, ident.label)
    const hunt_id = await makeHuntFor(ctx.db, ident, hunt)
    const [home] = await realmsOf(ctx.db, hunt_id)
    const quiz = home?.quizzes[0]
    if (! home || ! quiz) { throw new Error(`The hunt ${hunt} was made without its quiz`) }
    const open: OpenQuizT = { hunt_id, realm_id: home.realm._id, quiz_id: quiz._id, quiz, realm: home.realm }
    for (const widget_label of widgetings) { await layOutWidgeting(ctx.db, open, quiz, widget_label) }
    for (const field of columns) { await layOutColumn(ctx.db, open, quiz, field) }
    return Routes.quizPath({ org: ident.label, hunt, realm: HomeRealmLabel, quiz: hunt }, 'edit')
  },
})

/** A label no hunt of the org `orglabel` answers to yet, drawn as the hunts list draws one */
async function freshHuntLabel(db: Writer, orglabel: string): Promise<string> {
  for (let draw = 1; draw <= LabelDrawsMax; draw += 1) {
    const hunt = Labelmaker.freshLabelFor([])
    if (! await huntInOrg(db, orglabel, hunt)) { return hunt }
  }
  throw new Error(`No fresh hunt label for ${orglabel} in ${String(LabelDrawsMax)} draws`)
}

/** Put the library's widget `widget_label` to work in the open quiz as the widgeting editor plans it: under its own label, with its column */
async function layOutWidgeting(db: Writer, open: OpenQuizT, quiz: Doc<'quizzes'>, widget_label: string): Promise<void> {
  const widget = await widgetForLabel(db, widget_label)
  if (! widget) { throw new Error(`The library has no widget ${widget_label}`) }
  const plan = planWidgetingEdit({ widgeting: null, label: '', description: '', widgetLabel: widget_label }, [widgetFrom(widget)], await wholeQuizOf(db, quiz))
  if (! plan.ok) { throw new Error(plan.issue) }
  for (const dna of plan.actions) {
    const action = ActionValidators.huntAction(dna)
    if (! isLayoutAction(action)) { throw new Error(`The widgeting editor planned a ${action.kind}, which is no layout action`) }
    await performLayout(db, open, action)
  }
}

/** Show the question's own `field` in a column at the open quiz's end, as the columns editor makes one left at its defaults */
async function layOutColumn(db: Writer, open: OpenQuizT, quiz: Doc<'quizzes'>, field: QuestionField | QuestionView): Promise<void> {
  const source = field
  const named = namesFor(source)
  const { columns } = await layoutOf(db, quiz)
  const taken = columns.some((column) => column.label === named.label)
  await addColumn(db, open, Column.fill({ label: taken ? Labelmaker.appendFallback(named.label) : named.label, title: named.title, source, width_px: AddedColumnWidthPx }))
}
