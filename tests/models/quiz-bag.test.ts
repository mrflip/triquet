import { describe, expect, it } from 'vitest'
import * as Runner from '../../src/lib/formulary/runner'
import { QuizBagValidators, inputSchema, outputSchema } from '../../src/models/quiz-bag'
import { Question } from '../../src/models/question'
import { Quiz } from '../../src/models/quiz'
import { Widgeting } from '../../src/models/widgeting'
import { present } from '../support/present'
import { runOf } from '../support/runs'
import { classicLayout } from '../support/layouts'
import type { WidgetedHistoryT } from '../../src/models/widgeted'

const IshesRow = { status: 'ok' as const, value: { items: [{ text: '300', value: 300, kind: 'numeral' }] }, message: null, result_meta: {}, _creationTime: 1 }
const Ishes: WidgetedHistoryT = { newest: IshesRow, ok: IshesRow }
const GuessRow = { status: 'ok' as const, value: { guess: 'Leon', explanation: 'A first instinct.' }, message: null, result_meta: {}, _creationTime: 1 }

describe('the bags formulas are actually given', () => {
  const target = { ...Question.blank(), qnum: '2', title: 'The film', label: 'the_film', stored: { numnum_hint: Ishes } }
  const question = { ...Question.blank(), qnum: '1', chains_to: target._id, stored: { numnum_clueing: Ishes, dumdum: { newest: GuessRow, ok: GuessRow } } }
  const quiz = { ...Quiz.blank('Bag'), ...classicLayout(), label: 'my_quiz', last_sortkey: 'column:clueing_full' as const, questions: [question, target, { ...Question.blank(), qnum: '' }] }
  // As the last widgeting would see them: every other widgeting's widgeted on every question.
  const bags = Runner.bagsAt(runOf(quiz), { label: 'clueing_plus_butnot_full', params: {} })

  it('all satisfy the schema the prompt shows, so the schema is never a description of something else', () => {
    const outcomes = bags.values().map((bag) => QuizBagValidators.quizBag.safeParse(bag).success).toArray()
    expect(outcomes).to.deep.eq([true, true, true])
  })

  it("hold every earlier widgeting's widgeted flat on each question, and never the widgeting's own", () => {
    const bag = present(bags.get(question._id))
    expect(bag.qn.numnum_clueing).to.deep.eq({ status: 'ok', value: IshesRow.value, err: null })
    expect(bag.qn.dumdum).to.deep.eq({ status: 'ok', value: GuessRow.value, err: null })
    expect(bag.qn.numnum_hint).to.deep.eq({ status: 'missing', value: null, err: null })
    expect(bag.qn.clueing_full).to.deep.eq({ status: 'ok', value: 300, err: null })
    expect(bag.qn).not.to.have.property('clueing_plus_butnot_full')
    expect(bag.qn).not.to.have.property('stored')
  })

  it("satisfy the schema with a category-estimate widgeting's parts carried beside its status and value", () => {
    const estimated = { ...quiz, widgetings: [Widgeting.fill({ widget_label: 'category_data', label: 'category_data' }), ...quiz.widgetings] }
    const bag = present(Runner.bagsAt(runOf(estimated), { label: 'clueing_plus_butnot_full', params: {} }).get(question._id))
    expect(bag.qn.category_data).to.deep.include({ status: 'missing', average: 0.525 })
    expect(QuizBagValidators.quizBag.safeParse(bag).success).to.be.true
  })

  it("satisfy the schema for a widgeting run once for the whole quiz: no question, and the quiz's own widgeteds on the quiz", () => {
    const quizWide = {
      ...quiz,
      widgetings: [Widgeting.fill({ widget_label: 'playtesters', label: 'playtesters', tier: 'quiz' }), ...quiz.widgetings, Widgeting.fill({ widget_label: 'question_count', label: 'total', tier: 'quiz' })],
    }
    const bag = present(Runner.bagsAt(runOf(quizWide), { label: 'total', params: {} }).get(question._id))
    expect([bag.qn, bag.qn_label]).to.deep.eq([{}, ''])
    expect(bag.quiz.playtesters).to.deep.include({ status: 'errored' })
    expect(QuizBagValidators.quizBag.safeParse(bag).success).to.be.true
  })

  it('name the failing field when one does not', () => {
    const bag = present(bags.get(question._id))
    const outcome = QuizBagValidators.quizBag.safeParse({ ...bag, qn_label: 'Not A Label' })
    expect(outcome.success).to.be.false
    expect(outcome.error?.issues[0]?.path).to.deep.eq(['qn_label'])
  })
})

describe('inputSchema', () => {
  const schema = inputSchema() as { properties?: Record<string, unknown>, required?: string[] }
  /** The fields the schema names for its top-level key `key` */
  const fieldsOf = (key: string) => Object.keys((present(schema.properties)[key] as { properties?: object }).properties ?? {})

  it('names the ten keys a formula can read, all required', () => {
    const keys = ['hunt', 'realm', 'categories', 'quiz', 'qns', 'qn', 'qn_label', 'quiz_label', 'params', 'widgeting_label']
    expect(Object.keys(schema.properties ?? {})).to.have.members(keys)
    expect(schema.required).to.have.members(keys)
  })

  it("names the exposed fields of the hunt, the realm and the quiz, and no others", () => {
    expect([fieldsOf('hunt'), fieldsOf('realm'), fieldsOf('quiz')]).to.deep.eq([['label', 'title'], ['label', 'title'], ['label', 'smiths_note', 'title']])
  })

  it("tells a reader what the smith's note is", () => {
    expect(JSON.stringify(present(schema.properties).quiz)).to.include('What the smiths want to say about the quiz')
  })

  it('keeps the descriptions, which are what tell a reader what a field means', () => {
    expect(JSON.stringify(inputSchema())).to.include('Look it up with')
  })

  it('leaves the id out of a question, and the raw chain id with it', () => {
    const questionSchema = JSON.stringify(present(schema.properties).qn)
    expect(questionSchema).to.not.include('"id"')
    expect(questionSchema).to.include('"rank"')
  })

  it("tells a reader that every earlier widgeting's widgeted sits on a question under its label", () => {
    const [questionSchema] = (present(schema.properties).qn as { anyOf: { additionalProperties?: { oneOf?: unknown[] } }[] }).anyOf
    expect(JSON.stringify(present(questionSchema).additionalProperties)).to.include('under that widgeting')
    expect(present(questionSchema).additionalProperties?.oneOf).to.have.lengthOf(3)
  })

  it("tells a reader that a quiz widgeting's widgeted sits on the quiz under its label, and that its own bag holds no question", () => {
    const quizSchema = present(schema.properties).quiz as { additionalProperties?: unknown }
    expect(JSON.stringify(quizSchema.additionalProperties)).to.include('quiz.playtesters.value')
    expect(JSON.stringify(present(schema.properties).qn)).to.include('Empty for a widgeting run once for the whole quiz')
  })
})

describe('outputSchema', () => {
  it('allows a scalar or null, and no longer a value with a stale mark', () => {
    const text = JSON.stringify(outputSchema())
    expect(text).to.include('"null"')
    expect(text).not.to.include('"stale"')
  })

  it('accepts what the standard formulas answer with, and refuses what a cell cannot show', () => {
    const accepts = [7, 'text', true, null].map((val) => QuizBagValidators.formulaResult.safeParse(val).success)
    expect(accepts).to.deep.eq([true, true, true, true])
    const refuses = [[1, 2], { other: 1 }, { value: 3, stale: true }, { value: 3 }].map((val) => QuizBagValidators.formulaResult.safeParse(val).success)
    expect(refuses).to.deep.eq([false, false, false, false])
  })
})
