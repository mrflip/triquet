import { Migrations, type MigrationFunctionReference } from '@convex-dev/migrations'
import { components, internal } from './_generated/api'
import { internalMutation } from './_generated/server'
import { zInternalQuery } from './functions'
import { layoutOf } from './reading'
import * as Labelmaker from '../src/lib/labelmaker'
import * as Estimates from '../src/lib/estimates'
import * as Stamps from '../src/lib/stamps'
import { widgetFrom } from '../src/lib/rows'
import { ValidatorKit } from '../src/lib/validator'
import { CategoriesDescription, CategoriesWidgetLabel, categoryDataOf, relabelledSource } from '../src/models/before-october'
import { ColumnValidators, plainOf } from '../src/models/column'
import { QuizValidators, templateableFrom } from '../src/models/quiz'
import { CategoryDataLabel, SeedWidgets } from '../src/models/seeds'
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

// The columnwise chain (`Serial Deploy: columnwise`), in order: the library's category-estimate
// entry relabelled `category_data`, since `categories` is a word at the bag's top level that a
// widgeting must not shadow; each quiz's widgetings of it, and the columns and nominations naming
// them, relabelled with it; each column's source written in the plain grammar; and each quiz's
// `templated` written as its `templateable`, in the plain grammar, and taken off. The grammar
// before October 2026 is `column.ts`'s to read (`plainOf`), which every reader does meanwhile. A
// value that will not do under today's validators is left as it is and said in the log, rather
// than stopping the series. Nothing rewrites an author's formula reading `qn.categories`.

/** The seeded category-estimate entry as the library holds it now */
const CategoryDataSeed = SeedWidgets.find((widget) => widget.label === CategoryDataLabel)

/**
 * Relabel the library's category-estimate entry, `categories` before October 2026, as
 * `category_data`, its seeded description with it. Where the seeds have already made a
 * `category_data` category-estimate entry beside it, the old one is taken away instead, the
 * widgetings working it being relabelled to the new one next; any other widget under that label
 * stops the series, for a Coach to settle.
 */
export const backfillCategoryDataWidget = migrations.define({
  table:      'widgets',
  migrateOne: async (ctx, widget) => {
    if (widget.label !== CategoriesWidgetLabel) { return }
    const already = await ctx.db.query('widgets').withIndex('by_scope_and_label', (cvx) => cvx.eq('scope', widget.scope).eq('label', CategoryDataLabel)).first()
    if (already) {
      if (! Estimates.isEstimating(widgetFrom(already))) { throw new Error(`The library holds a widget labelled "${CategoryDataLabel}" that is no category-estimate entry, so "${CategoriesWidgetLabel}" cannot become it`) }
      await ctx.db.delete('widgets', widget._id)
      return
    }
    const description = CategoryDataSeed && widget.description === CategoriesDescription ? CategoryDataSeed.description : widget.description
    await ctx.db.patch('widgets', widget._id, { label: ValidatorKit.label.parse(CategoryDataLabel), description: ValidatorKit.noteish.parse(description) })
  },
})

/**
 * In each quiz, relabel what the category-estimate entry's relabelling leaves behind: each
 * widgeting working it, as its `widget_label`; each widgeting labelled `categories` or
 * `categories_<n>`, as `category_data` or `category_data_<n>` (the first free label after
 * `category_data`, if the quiz holds that already, or another of these is to take it); and each column's source and each nomination of what it templates
 * naming one of those, in whichever grammar it is written.
 */
export const backfillCategoryDataWidgetings = migrations.define({
  table:      'quizzes',
  migrateOne: async (ctx, quiz) => {
    const { widgetings, columns } = await layoutOf(ctx.db, quiz)
    const kept = widgetings.filter((widgeting) => categoryDataOf(widgeting.label) === null).map((widgeting) => widgeting.label)
    const labelFor = new Map<string, string>()
    for (const widgeting of widgetings) {
      const relabelled = categoryDataOf(widgeting.label)
      const others = widgetings.filter((other) => other !== widgeting).flatMap((other) => categoryDataOf(other.label) ?? [])
      const label = relabelled === null ? widgeting.label : Labelmaker.firstFree(relabelled, new Set([...kept, ...others, ...labelFor.values()]))
      if (label !== widgeting.label) { labelFor.set(widgeting.label, label) }
      const widget_label = widgeting.widget_label === CategoriesWidgetLabel ? CategoryDataLabel : widgeting.widget_label
      if (label === widgeting.label && widget_label === widgeting.widget_label) { continue }
      await ctx.db.patch('widgetings', widgeting._id, { label: WidgetingValidators.widgetingLabel.parse(label), widget_label: ValidatorKit.label.parse(widget_label) })
    }
    if (labelFor.size === 0) { return }
    for (const column of columns) {
      const source = relabelledSource(column.source, labelFor)
      if (source !== column.source) { await ctx.db.patch('columns', column._id, { source }) }
    }
    const relabelled = (sources: readonly string[] | undefined) => sources?.map((source) => labelFor.get(source) ?? source)
    await ctx.db.patch('quizzes', quiz._id, { templated: relabelled(quiz.templated), templateable: relabelled(quiz.templateable) })
  },
})

/**
 * Write each column's source in the plain grammar (`plainOf`): `question.<x>` as `<x>`, and
 * `<widgeting>.<part>` as the widgeting with the formula `$.<part>`. A plain source is left.
 */
export const backfillPlainColumnSources = migrations.define({
  table:      'columns',
  migrateOne: async (ctx, column) => {
    const plain = plainOf(column)
    if (plain.source === column.source) { return }
    const source = ColumnValidators.source.safeParse(plain.source)
    const formula = ColumnValidators.formula.optional().safeParse(plain.formula)
    if (! source.success || ! formula.success) {
      console.warn(`Column ${column.label} of quiz ${column.quiz_id} is left showing "${column.source}": "${plain.source}" will not do`)
      return
    }
    await ctx.db.patch('columns', column._id, { source: source.data, formula: formula.data })
  },
})

/**
 * Write each quiz's nomination of what it templates as its `templateable`, in the plain grammar
 * (`templateableFrom`), and take its `templated` off. A nomination that will not do is left out,
 * and said in the log.
 */
export const backfillQuizTemplateables = migrations.define({
  table:      'quizzes',
  migrateOne: async (ctx, quiz) => {
    if (quiz.templateable !== undefined && quiz.templated === undefined) { return }
    const sources = quiz.templateable ?? templateableFrom(quiz.templated ?? [])
    const kept = sources.filter((source) => QuizValidators.templateableSource.safeParse(source).success)
    const dropped = sources.filter((source) => ! kept.includes(source))
    if (dropped.length > 0) { console.warn(`Quiz ${quiz.label} (${quiz._id}) no longer nominates ${dropped.join(', ')}: no source can be so named`) }
    await ctx.db.patch('quizzes', quiz._id, { templateable: QuizValidators.templateable.parse([...new Set(kept)]), templated: undefined })
  },
})

/**
 * Every backfill still defined, in the order they run: the stamps', then the columnwise chain's.
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
  internal.migrations.backfillCategoryDataWidget,
  internal.migrations.backfillCategoryDataWidgetings,
  internal.migrations.backfillPlainColumnSources,
  internal.migrations.backfillQuizTemplateables,
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
