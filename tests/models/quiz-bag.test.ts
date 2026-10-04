import { describe, expect, it } from 'vitest'
import * as Expressed from '../../src/lib/expressed'
import { QuizBagValidators, inputSchema, outputSchema } from '../../src/models/quiz-bag'
import { Question } from '../../src/models/question'
import { Quiz } from '../../src/models/quiz'
import { present } from '../support/present'
import { Here } from '../support/places'

const ishes = { status: 'done' as const, items: [{ text: '300', value: 300, kind: 'numeral' as const }], truncated: false, stale: false, updated_at: 1, last_err: null }

describe('the bags formulas are actually given', () => {
  const target = { ...Question.blank(), qnum: '2', title: 'The film', forced_label: 'the_film', hint_ishes: ishes }
  const question = { ...Question.blank(), qnum: '1', chains_to: target._id, clueing_ishes: ishes, guess: { status: 'done' as const, text: 'Leon', truncated: false, stale: false, updated_at: 1, last_err: null } }
  const quiz = { ...Quiz.blank('Bag'), forced_label: 'my_quiz', last_sortkey: 'column:clueing_full' as const, questions: [question, target, { ...Question.blank(), qnum: '' }] }

  it('all satisfy the schema the prompt shows, so the schema is never a description of something else', () => {
    const outcomes = Expressed.bagsFor(quiz, Here).values().map((bag) => QuizBagValidators.quizBag.safeParse(bag).success).toArray()
    expect(outcomes).to.deep.eq([true, true, true])
  })

  it('name the failing field when one does not', () => {
    const bag = present(Expressed.bagsFor(quiz, Here).get(question._id))
    const outcome = QuizBagValidators.quizBag.safeParse({ ...bag, qn_label: 'Not A Label' })
    expect(outcome.success).to.be.false
    expect(outcome.error?.issues[0]?.path).to.deep.eq(['qn_label'])
  })
})

describe('inputSchema', () => {
  const schema = inputSchema() as { properties?: Record<string, unknown>, required?: string[] }
  /** The fields the schema names for its top-level key `key` */
  const fieldsOf = (key: string) => Object.keys((present(schema.properties)[key] as { properties?: object }).properties ?? {})

  it('names the seven keys a formula can read, all required', () => {
    expect(Object.keys(schema.properties ?? {})).to.have.members(['hunt', 'realm', 'quiz', 'qns', 'qn', 'qn_label', 'quiz_label'])
    expect(schema.required).to.have.members(['hunt', 'realm', 'quiz', 'qns', 'qn', 'qn_label', 'quiz_label'])
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
})

describe('outputSchema', () => {
  it('allows a scalar, null, or a value with a stale mark', () => {
    const text = JSON.stringify(outputSchema())
    expect(text).to.include('"stale"')
    expect(text).to.include('"null"')
  })

  it('accepts what the standard formulas answer with, and refuses what a cell cannot show', () => {
    const accepts = [7, 'text', true, null, { value: 3, stale: true }, { value: 3 }].map((val) => QuizBagValidators.formulaResult.safeParse(val).success)
    expect(accepts).to.deep.eq([true, true, true, true, true, true])
    const refuses = [[1, 2], { other: 1 }, { value: [1] }].map((val) => QuizBagValidators.formulaResult.safeParse(val).success)
    expect(refuses).to.deep.eq([false, false, false])
  })
})
