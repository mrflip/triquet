import { Migrations, type MigrationFunctionReference } from '@convex-dev/migrations'
import { components, internal } from './_generated/api'
import { internalMutation } from './_generated/server'
import { zInternalQuery } from './functions'
import { widgetForLabel } from './reading'
import * as Stamps from '../src/lib/stamps'
import { ValidatorKit } from '../src/lib/validator'
import { beforeOctoberColumn, beforeOctoberParams, beforeOctoberQuizTexts, beforeOctoberTemplated, beforeOctoberWidgetTexts, QuizTemplateFieldnames } from '../src/models/before-october'
import { ColumnValidators } from '../src/models/column'
import { QuestionValidators } from '../src/models/question'
import { QuizValidators, TemplatableFieldVals } from '../src/models/quiz'
import { WidgetValidators } from '../src/models/widget'
import { WidgetedValidators } from '../src/models/widgeted'
import { WidgetingValidators } from '../src/models/widgeting'
import schema from './schema'
import type { StampedTablename } from './stamping'

// Backfills that bring a deployment's rows up to the schema, run through `@convex-dev/migrations`,
// which batches them, records how far each got, and never runs a finished one twice. Each is
// written to be run again harmlessly: a row that already fits is left as it is. Rows are written
// through their row validators, as every other write is. A migration is defined here beside a
// widened schema, and removed once the schema is tightened after it (`notes/deploy.md`, *Schema
// pushes*), whose ledger names the commit that still holds each one. Every production deploy runs
// them all (`runAll`) and waits for them (`outstanding`, `scripts/convex-migrations.ts`), so a
// backfill runs itself once its widening is deployed.

const { obj, arr, str, uint, oneof } = ValidatorKit

/** A backfill not yet finished, as `outstanding` reports it */
const Unfinished = obj({ name: str, state: oneof(['inProgress', 'failed', 'canceled', 'unknown']), processed: uint, error: str.optional() })

export const migrations = new Migrations(components.migrations, { internalMutation, schema })

/**
 * Any one migration, by name.
 *
 * @example npx convex run migrations:run '{"fn": "migrations:backfillHuntStamps", "dryRun": true}'
 */
export const run = migrations.runner()

/**
 * The backfill giving each row of `table` that the stamping trigger has never seen the stamps it
 * is read with meanwhile (`Stamps.of`): made in the whole millisecond the database made it, and
 * last edited then too, unless it has been edited since the stamps arrived. A backfill is no edit:
 * a never-edited row keeps its two stamps equal, as an untouched starter question must
 * (`importQuestions`). The migrations write raw, so the trigger does not see this write. A row
 * with both stamps is left alone; the rest of the row is not read again, so no older row can hold
 * the backfill up. The stamps stay optional for good, so no tightening retires these.
 */
function stampBackfill(table: StampedTablename) {
  return migrations.define({
    table,
    migrateOne: async (ctx, held) => {
      if (held.created_at !== undefined && held.updated_at !== undefined) { return }
      const stamps = Stamps.of(held)
      await ctx.db.patch(table, held._id, { created_at: ValidatorKit.stamps.created_at.parse(stamps.created_at), updated_at: ValidatorKit.stamps.updated_at.parse(stamps.updated_at) })
    },
  })
}

// One per stamped table, each as `stampBackfill` says.
export const backfillIdentStamps     = stampBackfill('idents')
export const backfillHuntStamps      = stampBackfill('hunts')
export const backfillRealmStamps     = stampBackfill('realms')
export const backfillWidgetStamps    = stampBackfill('widgets')
export const backfillQuizStamps      = stampBackfill('quizzes')
export const backfillWidgetingStamps = stampBackfill('widgetings')
export const backfillColumnStamps    = stampBackfill('columns')
export const backfillQuestionStamps  = stampBackfill('questions')
export const backfillWidgetedStamps  = stampBackfill('widgeteds')
export const backfillReviewStamps    = stampBackfill('reviews')
export const backfillReviewingStamps = stampBackfill('reviewings')
export const backfillHuntingStamps   = stampBackfill('huntings')

// The `bagshape` chain (the columnwise sprint's thread 10): every stored text that reads the bag,
// rewritten in the words the bag has since it took the export's shape (`question`, `questions`,
// `question_label`; `src/models/before-october.ts`, whose functions the importer reads older
// exports with too). Text only, so no schema changes and nothing tightens after them; each leaves a
// text in today's words as it is, so running one again changes nothing. A rewritten text its
// validator refuses (grown past its length) is left, and said in the log. The rows are written raw,
// so no stamp moves and no trigger sees them: the rewrite is no author's edit.

/** Whether a text holds a Liquid tag or output, the only place a template reads the bag */
const isTemplate = (text: unknown): text is string => typeof text === 'string' && (text.includes('{{') || text.includes('{%'))

/** What a backfill says of a row it leaves, its rewrite refused */
const leftAs = (what: string, id: string, why: string) => { console.warn(`${what} ${id} is left as it was: its rewrite will not do (${why})`) }

/**
 * Each widget's texts that read the bag (`beforeOctoberWidgetTexts`): a formula's input formula,
 * and its formula; a bot's input formula, not its prompt; a template's input formula, and its
 * template where its input is the whole bag. The seeded widgets among them come out as the seeds
 * read now.
 */
export const backfillBagshapeWidgets = migrations.define({
  table:      'widgets',
  migrateOne: async (ctx, widget) => {
    const rewritten = beforeOctoberWidgetTexts(widget)
    if (rewritten.formula === widget.formula && rewritten.input_formula === widget.input_formula) { return }
    const read = WidgetValidators.row.safeParse(rewritten)
    if (! read.success) { leftAs('Widget', widget.label, read.error.message); return }
    await ctx.db.patch('widgets', widget._id, { formula: read.data.formula, input_formula: read.data.input_formula })
  },
})

/** Each `liquidize` widgeting's own template, where its widget's input is the whole bag, and its `template_from`'s ref (`beforeOctoberParams`) */
export const backfillBagshapeWidgetings = migrations.define({
  table:      'widgetings',
  migrateOne: async (ctx, widgeting) => {
    if (! ('template' in widgeting.params || 'template_from' in widgeting.params)) { return }
    const widget = await widgetForLabel(ctx.db, widgeting.widget_label)
    const params = beforeOctoberParams(widgeting.params, widget?.input_formula)
    if (JSON.stringify(params) === JSON.stringify(widgeting.params)) { return }
    const read = WidgetingValidators.params.safeParse(params)
    if (! read.success) { leftAs('Widgeting', widgeting.label, read.error.message); return }
    await ctx.db.patch('widgetings', widgeting._id, { params: read.data })
  },
})

/** Each column's ref and template (`beforeOctoberColumn`); its formula reads what its ref picks, not the bag */
export const backfillBagshapeColumns = migrations.define({
  table:      'columns',
  migrateOne: async (ctx, column) => {
    const rewritten = beforeOctoberColumn(column)
    if (rewritten.source === column.source && rewritten.template === column.template) { return }
    const source = ColumnValidators.source.safeParse(rewritten.source)
    const template = ColumnValidators.template.optional().safeParse(rewritten.template)
    if (! source.success || ! template.success) { leftAs('Column', column.label, (source.error ?? template.error)?.message ?? ''); return }
    await ctx.db.patch('columns', column._id, { source: source.data, template: template.data })
  },
})

/** Each quiz's recap head, tail and template (`beforeOctoberQuizTexts`) */
export const backfillBagshapeQuizzes = migrations.define({
  table:      'quizzes',
  migrateOne: async (ctx, quiz) => {
    const rewritten = beforeOctoberQuizTexts(quiz)
    if (QuizTemplateFieldnames.every((fieldname) => rewritten[fieldname] === quiz[fieldname])) { return }
    const head = QuizValidators.recap_head.safeParse(rewritten.recap_head)
    const tail = QuizValidators.recap_tail.safeParse(rewritten.recap_tail)
    const template = QuizValidators.recap_template.optional().safeParse(rewritten.recap_template)
    if (! head.success || ! tail.success || ! template.success) { leftAs('Quiz', quiz.label, (head.error ?? tail.error ?? template.error)?.message ?? ''); return }
    await ctx.db.patch('quizzes', quiz._id, { recap_head: head.data, recap_tail: tail.data, recap_template: template.data })
  },
})

/** Each question's fields its quiz nominates as templateable, each a template over the bag (`beforeOctoberTemplated`) */
export const backfillBagshapeQuestions = migrations.define({
  table:      'questions',
  migrateOne: async (ctx, question) => {
    if (TemplatableFieldVals.every((fieldname) => ! isTemplate(question[fieldname]))) { return }
    const quiz = await ctx.db.get('quizzes', question.quiz_id)
    const nominated = TemplatableFieldVals.filter((fieldname) => quiz?.templateable.includes(fieldname) === true && isTemplate(question[fieldname]))
    const patch: Partial<Record<typeof TemplatableFieldVals[number], string>> = {}
    for (const fieldname of nominated) {
      const read = QuestionValidators[fieldname].safeParse(beforeOctoberTemplated(question[fieldname]))
      if (! read.success) { leftAs('Question', question.label, read.error.message); return }
      if (read.data !== question[fieldname]) { patch[fieldname] = read.data }
    }
    if (Object.keys(patch).length > 0) { await ctx.db.patch('questions', question._id, patch) }
  },
})

/** Each value typed into a text entry its quiz nominates as templateable, a template over the bag (`beforeOctoberTemplated`) */
export const backfillBagshapeWidgeteds = migrations.define({
  table:      'widgeteds',
  migrateOne: async (ctx, widgeted) => {
    if (! isTemplate(widgeted.value)) { return }
    const widgeting = await ctx.db.get('widgetings', widgeted.widgeting_id)
    const quiz = await ctx.db.get('quizzes', widgeted.quiz_id)
    if (widgeting === null || quiz?.templateable.includes(widgeting.label) !== true) { return }
    const read = WidgetedValidators.value.safeParse(beforeOctoberTemplated(widgeted.value))
    if (! read.success) { leftAs('Widgeted', widgeted._id, read.error.message); return }
    if (read.data !== widgeted.value) { await ctx.db.patch('widgeteds', widgeted._id, { value: read.data }) }
  },
})

/**
 * Every backfill still defined, in the order they run: the stamps', which stay for good; then the
 * `bagshape` chain's, which change no schema and so have no tightening to retire them: any later
 * pull request may, once production's deploy has said they finished.
 * What `runAll` runs and `outstanding` reports on. A new backfill joins the end, and leaves with the tightening after it.
 * It is never empty: `runAll`, a runner of the series, refuses to run none.
 */
export const Backfills: readonly MigrationFunctionReference[] = [
  internal.migrations.backfillIdentStamps,
  internal.migrations.backfillHuntStamps,
  internal.migrations.backfillRealmStamps,
  internal.migrations.backfillWidgetStamps,
  internal.migrations.backfillQuizStamps,
  internal.migrations.backfillWidgetingStamps,
  internal.migrations.backfillColumnStamps,
  internal.migrations.backfillQuestionStamps,
  internal.migrations.backfillWidgetedStamps,
  internal.migrations.backfillReviewStamps,
  internal.migrations.backfillReviewingStamps,
  internal.migrations.backfillHuntingStamps,
  internal.migrations.backfillBagshapeWidgets,
  internal.migrations.backfillBagshapeWidgetings,
  internal.migrations.backfillBagshapeColumns,
  internal.migrations.backfillBagshapeQuizzes,
  internal.migrations.backfillBagshapeQuestions,
  internal.migrations.backfillBagshapeWidgeteds,
]

/**
 * Every backfill still defined, in order (`Backfills`), each skipped once finished: run after every
 * production deploy, so it is harmless with nothing to do. A failure stops the series, leaving the
 * backfills after it unrun.
 *
 * @example npx convex run migrations:runAll
 */
export const runAll = migrations.runner([...Backfills])

/**
 * The backfills in `Backfills` not yet finished, with how far each got: empty once all are. A
 * backfill not yet started reads as `unknown`; one that threw, as `failed`, with its error.
 *
 * @example npx convex run migrations:outstanding  // => [{ name: 'migrations:backfillQuestionStamps', state: 'inProgress', processed: 100 }]
 */
export const outstanding = zInternalQuery({
  args:    {},
  returns: arr(Unfinished),
  handler: async (ctx) => {
    const statuses = await migrations.getStatus(ctx, { migrations: [...Backfills] })
    return statuses.flatMap(({ name, state, processed, error }) => (state === 'success' ? [] : [{ name, state, processed, error }]))
  },
})
