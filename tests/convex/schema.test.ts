import _ from 'es-toolkit/compat'
import * as Z from 'zod'
import { describe, expect, it } from 'vitest'
import { authTables } from '@convex-dev/auth/server'
import type { Id, TableNames as AllTableNames } from '../../convex/_generated/dataModel'
import schema from '../../convex/schema'
import { StampedTables } from '../../convex/stamping'
import { CategoryLabelVals } from '../../src/models/category'
import { ColumnValidators } from '../../src/models/column'
import { HuntValidators } from '../../src/models/hunt'
import { HuntingValidators } from '../../src/models/hunting'
import { IdentValidators } from '../../src/models/ident'
import { IdentingValidators } from '../../src/models/identing'
import { QuestionValidators } from '../../src/models/question'
import { QuizValidators } from '../../src/models/quiz'
import { RealmValidators } from '../../src/models/realm'
import { ReviewValidators } from '../../src/models/review'
import { ReviewingValidators } from '../../src/models/reviewing'
import { SignalValidators } from '../../src/models/signal'
import { WidgetValidators } from '../../src/models/widget'
import { WidgetedValidators } from '../../src/models/widgeted'
import { WidgetingValidators } from '../../src/models/widgeting'
import { openTester, type Tester } from '../support/convex'

// Every table's fields are derived from its row validator, bar a few written by hand. This holds
// the two together: the same fields (kind by kind, for a table that is a union), bar those
// retiring, every one required but those absentable for good, being backfilled or retired, and a
// row the validator makes is one the table takes, while a row with a field of the wrong type is
// refused. Convex Auth's tables are its own, derived from no row validator of ours, and left to it.

/** Our tables: every one but Convex Auth's */
type TableNames = Exclude<AllTableNames, keyof typeof authTables>

/** A row validator: one shape, or a union of shapes told apart by a field */
type RowValidator = Z.ZodObject | Z.ZodDiscriminatedUnion<Z.ZodObject[]>

/** Every table, and the row validator its writes pass through */
const RowValidators: Record<TableNames, RowValidator> = {
  columns:     ColumnValidators.row,
  hunts:       HuntValidators.row,
  huntings:    HuntingValidators.row,
  idents:      IdentValidators.row,
  identings:   IdentingValidators.row,
  questions:   QuestionValidators.row,
  quizzes:     QuizValidators.row,
  realms:      RealmValidators.row,
  reviews:     ReviewValidators.row,
  reviewings:  ReviewingValidators.row,
  signals:     SignalValidators.row,
  widgets:     WidgetValidators.row,
  widgetings:  WidgetingValidators.row,
  widgeteds:   WidgetedValidators.row,
  quiz_widgeteds: WidgetedValidators.quizRow,
}

/** A row's stamps, which the trigger writes once the row has landed (`convex/stamping.ts`), so that a row goes in without them */
const Stamps = ['created_at', 'updated_at']

/**
 * The fields a row may lack for good, their absence meaning what the code reading them says: a
 * hunt nobody has arranged reads as the default wheel, a quiz given no recap template of its own
 * follows the default one, and a column nobody has aligned centers Q# and lets every other cell
 * set itself; and every stamped row's stamps, a row the trigger has
 * not seen reading as made and last edited when the database made it (`Stamps.of`)
 */
const Absentable: Partial<Record<TableNames, string[]>> = {
  ...Object.fromEntries(StampedTables.map((tablename) => [tablename, Stamps])),
  hunts:   ['wheel', ...Stamps],
  quizzes: ['recap_template', ...Stamps],
  columns: ['align', ...Stamps],
}

/** The fields the schema lets a row lack while `convex/migrations.ts` backfills them */
const Backfilling: Partial<Record<TableNames, string[]>> = {}

/** The fields the schema still lets a row hold, though no row validator writes them, while `convex/migrations.ts` takes them off */
const Retiring: Partial<Record<TableNames, string[]>> = {}

/** For sorting names into a stable order to compare */
const alphabetically = (aa: string, bb: string) => aa.localeCompare(bb)

/** A table's field validator as the schema holds it */
type FieldValidator = { isOptional: string }

/** Each shape a table's rows may take, as field validators by name */
function tableShapesOf(tablename: TableNames): Record<string, FieldValidator>[] {
  const validator = schema.tables[tablename].validator as { kind: string, fields?: Record<string, FieldValidator>, members?: { fields: Record<string, FieldValidator> }[] }
  return validator.kind === 'union' ? (validator.members ?? []).map((member) => member.fields) : [validator.fields ?? {}]
}

/** Each shape a row validator's rows may take */
function rowShapesOf(row: RowValidator): Record<string, unknown>[] {
  return row instanceof Z.ZodDiscriminatedUnion ? row.options.map((option) => option.shape) : [row.shape]
}

/** The field names of each shape, in a stable order to compare */
const namesOf = (shapes: Record<string, unknown>[]) => shapes.map((shape) => Object.keys(shape).toSorted(alphabetically).join(' ')).toSorted(alphabetically)

type Samples = Record<TableNames, Record<string, unknown>>

/** One valid row for every table, each written by its row validator, pointing at rows written before it */
async function samplesIn(tt: Tester): Promise<Samples> {
  return await tt.run(async (ctx) => {
    const insert = async <TN extends TableNames>(tablename: TN, row: Record<string, unknown>): Promise<Id<TN>> => await ctx.db.insert(tablename, row as never)
    const hunt = HuntValidators.row({ label: 'quiet_otter', orglabel: 'flip_kromer', title: 'Quiet Otter', branch: 'playtest', wheel: [null, ...CategoryLabelVals.slice(1)] })
    const hunt_id = await insert('hunts', hunt)
    const realm = RealmValidators.row({ hunt_id, label: 'home', title: '', position: 0 })
    const realm_id = await insert('realms', realm)
    const quiz = QuizValidators.row({ hunt_id, realm_id, title: '', label: 'princes', smiths_note: 'Theme: princes.', q1_preamble: 'Read the note![br]', recap_head: 'Thanks to {{quiz.playtesters}}.', recap_tail: 'See you next season.', templated: ['question.recap', 'dumdum'], locked: false, last_sortkey: 'column:clueing', row_ordering: [] })
    const quiz_id = await insert('quizzes', quiz)
    const question = QuestionValidators.row({ hunt_id, quiz_id, label: 'leon', title: '', qnum: '1', clueing: 'Who?', hint: '', chains_to: null, full_answer: '', alt_text: '', notes: '', recap: 'Leon was the pseudonym.' })
    const question_id = await insert('questions', question)
    const user_id = await ctx.db.insert('users', { isAnonymous: true })
    const ident = IdentValidators.row({ label: 'flip_kromer', title: 'Flip', user_id })
    const ident_id = await insert('idents', ident)
    const review = ReviewValidators.row({ hunt_id, quiz_id, ident_id, overall: '', phase: 'empty' })
    const review_id = await insert('reviews', review)
    const widgeting = WidgetingValidators.row({ hunt_id, quiz_id, widget_label: 'dumdum', label: 'dumdum', description: '', params: { strictness: { level: 3, words: ['but', 'not'] } }, tier: 'question', position: 0 })
    const widgeting_id = await insert('widgetings', widgeting)
    return {
      hunts:       hunt,
      huntings:    HuntingValidators.row({ hunt_id, ident_id, ident_label: ident.label, ident_title: ident.title, role: 'reviewer' }),
      realms:      realm,
      quizzes:     quiz,
      questions:   question,
      idents:      ident,
      identings:   IdentingValidators.row({ user_id, ident_id }),
      widgets:     WidgetValidators.row({
        scope: 'pub', label: 'dumdum', title: 'Dumdum', description: '', formulary: 'aibot', formula: 'Answer this: {{clueing}}', input_formula: "{ 'clueing': qn.clueing }",
        config: { servicelabel: 'claude', model_tier: 'quick', max_tokens: 256 }, position: 0,
      }),
      widgetings:  widgeting,
      columns:     ColumnValidators.row({ hunt_id, quiz_id, label: 'clueing', title: 'Clueing', source: 'question.clueing', width_px: 200, position: 0 }),
      reviews:     review,
      reviewings:  ReviewingValidators.row({
        hunt_id, quiz_id, ident_id, review_id, question_id, get_rate: 40, guesses: 'Hamlet?', comments: 'Fair.', minutes: 2.5, keep_it: true, needs_fact_check: false, elimination_candidate: false, peeked: true,
      }),
      widgeteds:   WidgetedValidators.row({
        hunt_id, quiz_id, question_id, widgeting_id, status: 'ok', value: { guess: 'Hamlet', explanation: 'A prince.' }, message: null,
        result_meta: { model_tier_applied: 'quick', approx_tokens: 120, truncated: false, response: { error: { kind: 'overloaded', retry: [1, 2] } } },
      }),
      signals:     SignalValidators.row({ hunt_id, quiz_id, changed_at: 1_759_700_000_000 }),
      quiz_widgeteds: WidgetedValidators.quizRow({
        hunt_id, quiz_id, widgeting_id, status: 'ok', value: { names: ['Ada', 'Grace'] }, message: null, result_meta: { imported: true, nested: { deep: [1, 2] } },
      }),
    }
  })
}

/** A field of each table given a value of the wrong type */
const WrongTyped: Record<TableNames, Record<string, unknown>> = {
  columns:     { width_px: '200px' },
  hunts:       { wheel: ['knitting'] },
  huntings:    { role: 'owner' },
  idents:      { label: null },
  identings:   { user_id: 12 },
  questions:   { position: 'first' },
  quizzes:     { locked: 'yes' },
  realms:      { hunt_id: 'nowhere' },
  reviews:     { phase: 'finished' },
  reviewings:  { minutes: 'a few' },
  signals:     { changed_at: 'just now' },
  widgets:     { formulary: 'gadget' },
  widgetings:  { position: 'first' },
  widgeteds:   { status: 'pending' },
  quiz_widgeteds: { quiz_id: 7 },
}

describe("every table and its row validator", () => {
  it("cover the same tables", () => {
    const ours = Object.keys(schema.tables).filter((tablename) => ! Object.hasOwn(authTables, tablename))
    expect(ours.toSorted(alphabetically)).to.deep.eq(Object.keys(RowValidators).toSorted(alphabetically))
  })

  for (const [tablename, row] of Object.entries(RowValidators) as [TableNames, RowValidator][]) {
    describe(tablename, () => {
      const shapes = tableShapesOf(tablename)

      const retiring = Retiring[tablename] ?? []

      it("name the same fields, bar those retiring", () => {
        expect(namesOf(shapes.map((fields) => _.omit(fields, retiring)))).to.deep.eq(namesOf(rowShapesOf(row)))
      })

      it("require every field, bar those absentable, being backfilled or retired", () => {
        const optional = shapes.flatMap((fields) => Object.keys(fields).filter((fieldname) => fields[fieldname]?.isOptional === 'optional'))
        expect(_.uniq(optional).toSorted(alphabetically)).to.deep.eq([...(Absentable[tablename] ?? []), ...(Backfilling[tablename] ?? []), ...retiring].toSorted(alphabetically))
      })

      it("take a row the row validator makes", async () => {
        const tt = openTester()
        const samples = await samplesIn(tt)
        const row_id = await tt.run(async (ctx) => await ctx.db.insert(tablename, samples[tablename] as never))
        const written = await tt.run(async (ctx) => await ctx.db.get(tablename, row_id))
        expect(written).to.deep.include(samples[tablename])
      })

      it("refuse a row with a field of the wrong type", async () => {
        const tt = openTester()
        const samples = await samplesIn(tt)
        const wrong = { ...samples[tablename], ...WrongTyped[tablename] }
        await expect(tt.run(async (ctx) => { await ctx.db.insert(tablename, wrong as never) })).rejects.toThrow(/Validator error|failed to validate|does not match/i)
      })
    })
  }

  // The fields written by hand as any JSON: the table takes any JSON at all, deep or shallow, and
  // the row validator is what refuses a value that is not JSON. A record's JSON is under a key.
  const AnyJsonFields = [
    ['widgetings', 'params',      "a widgeting's params",     (val: unknown) => ({ held: val })],
    ['widgeteds',  'value',       "a widgeted's value",       (val: unknown) => val],
    ['widgeteds',  'result_meta', "a widgeted's result_meta", (val: unknown) => ({ held: val })],
    ['quiz_widgeteds', 'value',       "a quiz's widgeted's value",       (val: unknown) => val],
    ['quiz_widgeteds', 'result_meta', "a quiz's widgeted's result_meta", (val: unknown) => ({ held: val })],
  ] as const

  for (const [tablename, fieldname, title, holding] of AnyJsonFields) {
    it(`let ${title} be any JSON, leaving the row validator to say what JSON is`, async () => {
      const tt = openTester()
      const samples = await samplesIn(tt)
      for (const val of [null, 'Overloaded', 529, [1, 'two'], { deep: { deeper: { deepest: [true] } } }]) {
        await tt.run(async (ctx) => { await ctx.db.insert(tablename, { ...samples[tablename], [fieldname]: holding(val) } as never) })
      }
      const notJson = { ...samples[tablename], [fieldname]: holding(new Date()) }
      expect(() => RowValidators[tablename].parse(notJson)).to.throw(Z.ZodError)
    })
  }

  // Checks the bridge does not carry, made by the row validator alone: the table takes a row an
  // older write may hold, so no push is refused for it, while every write now is held to them.
  const ValidatorOnly = [
    ['realms',     { label: 'away' },     "a realm labelled other than home"],
    ['widgetings', { label: 'position' }, "a widgeting under a label its question's fields take"],
  ] as const

  for (const [tablename, overrides, title] of ValidatorOnly) {
    it(`take ${title}, leaving the row validator to refuse it`, async () => {
      const tt = openTester()
      const samples = await samplesIn(tt)
      const held = { ...samples[tablename], ...overrides }
      await tt.run(async (ctx) => { await ctx.db.insert(tablename, held as never) })
      expect(() => RowValidators[tablename].parse(held)).to.throw(Z.ZodError)
    })
  }
})
