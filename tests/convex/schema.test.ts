import * as Z from 'zod'
import { describe, expect, it } from 'vitest'
import type { Id, TableNames } from '../../convex/_generated/dataModel'
import schema from '../../convex/schema'
import { BottingValidators } from '../../src/models/botting'
import { ColumnValidators } from '../../src/models/column'
import { ExpressionValidators } from '../../src/models/expression'
import { HuntValidators } from '../../src/models/hunt'
import { IdentValidators } from '../../src/models/ident'
import { IdentingValidators } from '../../src/models/identing'
import { QuestionValidators } from '../../src/models/question'
import { QuizValidators } from '../../src/models/quiz'
import { RealmValidators } from '../../src/models/realm'
import { ReviewValidators } from '../../src/models/review'
import { WidgetValidators } from '../../src/models/widget'
import { openTester, type Tester } from '../support/convex'

// Every table's fields are derived from its row validator, bar one written by hand. This holds
// the two together: the same fields, every one required, and a row the validator makes is one the
// table takes, while a row with a field of the wrong type is refused.

/** Every table, and the row validator its writes pass through */
const RowValidators: Record<TableNames, Z.ZodObject> = {
  bottings:    BottingValidators.row,
  columns:     ColumnValidators.row,
  expressions: ExpressionValidators.row,
  hunts:       HuntValidators.row,
  idents:      IdentValidators.row,
  identings:   IdentingValidators.row,
  questions:   QuestionValidators.row,
  quizzes:     QuizValidators.row,
  realms:      RealmValidators.row,
  reviews:     ReviewValidators.row,
  widgets:     WidgetValidators.row,
}

/** For sorting names into a stable order to compare */
const alphabetically = (aa: string, bb: string) => aa.localeCompare(bb)

type Samples = Record<TableNames, Record<string, unknown>>

/** One valid row for every table, each written by its row validator, pointing at rows written before it */
async function samplesIn(tt: Tester): Promise<Samples> {
  return await tt.run(async (ctx) => {
    const insert = async <TN extends TableNames>(tablename: TN, row: Record<string, unknown>): Promise<Id<TN>> => await ctx.db.insert(tablename, row as never)
    const hunt = HuntValidators.row({ label: 'quiet_otter', forced_label: null, title: 'Quiet Otter' })
    const hunt_id = await insert('hunts', hunt)
    const realm = RealmValidators.row({ hunt_id, label: 'home', title: '', position: 0 })
    const realm_id = await insert('realms', realm)
    const quiz = QuizValidators.row({ realm_id, title: '', label: 'princes', forced_label: null, version: 'main', locked: false, last_sortkey: 'column:clueing', bulk_ishes_last: { approx_tokens: 9, text_count: 2, updated_at: 5 } })
    const quiz_id = await insert('quizzes', quiz)
    const question = QuestionValidators.row({ quiz_id, position: 0, label: 'leon', forced_label: null, title: '', qnum: '1', clueing: 'Who?', hint: '', chains_to: null, full_answer: '', alt_text: '', notes: '' })
    const question_id = await insert('questions', question)
    const ident = IdentValidators.row({ label: 'flip_kromer', title: 'Flip' })
    const ident_id = await insert('idents', ident)
    return {
      hunts:       hunt,
      realms:      realm,
      quizzes:     quiz,
      questions:   question,
      idents:      ident,
      identings:   IdentingValidators.row({ browser_key: crypto.randomUUID(), ident_id }),
      expressions: ExpressionValidators.row({ hunt_id, owner: 'tq', label: 'shout', formula: '$uppercase(qn.title)', description: '', position: 0 }),
      widgets:     WidgetValidators.row({ quiz_id, label: 'dumdum', kind: 'botting', expression_label: null, bot_label: 'dumdum', textkind: 'clueing', description: '', position: 0 }),
      columns:     ColumnValidators.row({ quiz_id, label: 'clueing', title: 'Clueing', source: 'question.clueing', width_px: 200, position: 0 }),
      reviews:     ReviewValidators.row({ quiz_id, ident_id, overall: '', phase: 'empty' }),
      bottings:    BottingValidators.row({
        question_id, bot_label: 'numnum', textkind: 'clueing', asked_text: 'Who?', status: 'error', reply_text: null, items: [],
        message: 'It failed', response: { error: { kind: 'overloaded', retry: [1, 2] } }, truncated: false, model_tier_applied: null, approx_tokens: null,
      }),
    }
  })
}

/** A field of each table given a value of the wrong type */
const WrongTyped: Record<TableNames, Record<string, unknown>> = {
  bottings:    { truncated: 'no' },
  columns:     { width_px: '200px' },
  expressions: { owner: 'someone' },
  hunts:       { title: 7 },
  idents:      { label: null },
  identings:   { browser_key: 12 },
  questions:   { position: 'first' },
  quizzes:     { locked: 'yes' },
  realms:      { hunt_id: 'nowhere' },
  reviews:     { phase: 'finished' },
  widgets:     { kind: 'gadget' },
}

describe('every table and its row validator', () => {
  it('cover the same tables', () => {
    expect(Object.keys(schema.tables).toSorted(alphabetically)).to.deep.eq(Object.keys(RowValidators).toSorted(alphabetically))
  })

  for (const [tablename, row] of Object.entries(RowValidators) as [TableNames, Z.ZodObject][]) {
    describe(tablename, () => {
      const fields = schema.tables[tablename].validator.fields as Record<string, { isOptional: string }>

      it('name the same fields', () => {
        expect(Object.keys(fields).toSorted(alphabetically)).to.deep.eq(Object.keys(row.shape).toSorted(alphabetically))
      })

      it('require every field', () => {
        expect(Object.keys(fields).filter((fieldname) => fields[fieldname]?.isOptional === 'optional')).to.deep.eq([])
      })

      it('take a row the row validator makes', async () => {
        const tt = openTester()
        const samples = await samplesIn(tt)
        const row_id = await tt.run(async (ctx) => await ctx.db.insert(tablename, samples[tablename] as never))
        const written = await tt.run(async (ctx) => await ctx.db.get(tablename, row_id))
        expect(written).to.deep.include(samples[tablename])
      })

      it('refuse a row with a field of the wrong type', async () => {
        const tt = openTester()
        const samples = await samplesIn(tt)
        const wrong = { ...samples[tablename], ...WrongTyped[tablename] }
        await expect(tt.run(async (ctx) => { await ctx.db.insert(tablename, wrong as never) })).rejects.toThrow(/Validator error|failed to validate|does not match/i)
      })
    })
  }

  it('let a botting\'s response be any JSON, or null, leaving the row validator to say what JSON is', async () => {
    const tt = openTester()
    const samples = await samplesIn(tt)
    for (const response of [null, 'Overloaded', 529, [1, 'two'], { deep: { deeper: { deepest: [true] } } }]) {
      await tt.run(async (ctx) => { await ctx.db.insert('bottings', { ...samples.bottings, response } as never) })
    }
    const notJson = { ...samples.bottings, response: new Date() }
    expect(() => BottingValidators.row(notJson as never)).to.throw(Z.ZodError)
  })
})
