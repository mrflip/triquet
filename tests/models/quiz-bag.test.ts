import { describe, expect, it } from 'vitest'
import * as Runner from '../../src/lib/formulary/runner'
import * as Wheel from '../../src/lib/wheel'
import { Bagged, QuizBagValidators, inputSchema, outputSchema } from '../../src/models/quiz-bag'
import { Question } from '../../src/models/question'
import { Quiz } from '../../src/models/quiz'
import { QuizBagKeys, Widgeting } from '../../src/models/widgeting'
import { present } from '../support/present'
import { runOf } from '../support/runs'
import { classicLayout } from '../support/layouts'
import { Widgeted, type WidgetedHistoryT } from '../../src/models/widgeted'

const IshesRow = { status: 'ok' as const, value: { items: [{ text: '300', value: 300, kind: 'numeral' }] }, message: null, result_meta: {}, _creationTime: 1 }
const Ishes: WidgetedHistoryT = { newest: IshesRow, ok: IshesRow }
const GuessRow = { status: 'ok' as const, value: { guess: 'Leon', explanation: 'A first instinct.' }, message: null, result_meta: {}, _creationTime: 1 }

describe('QuizBagValidators.quizBag', () => {
  it("has the top-level keys QuizBagKeys names, which the widgetings' reserved labels are drawn from", () => {
    expect(Object.keys(QuizBagValidators.quizBag.shape)).to.have.members([...QuizBagKeys])
  })
})

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
    expect(bag.question.numnum_clueing).to.deep.eq({ status: 'ok', value: IshesRow.value })
    expect(bag.question.dumdum).to.deep.eq({ status: 'ok', value: GuessRow.value })
    expect(bag.question.numnum_hint).to.deep.eq({ status: 'missing', value: null })
    expect(bag.question.clueing_full).to.deep.eq({ status: 'ok', value: 300 })
    expect(bag.question).not.to.have.property('clueing_plus_butnot_full')
    expect(bag.question).not.to.have.property('stored')
  })

  it("satisfy the schema with a category-estimate widgeting's parts carried beside its status and value", () => {
    const estimated = { ...quiz, widgetings: [Widgeting.fill({ widget_label: 'category_data', label: 'category_data' }), ...quiz.widgetings] }
    const bag = present(Runner.bagsAt(runOf(estimated), { label: 'clueing_plus_butnot_full', params: {} }).get(question._id))
    expect(bag.question.category_data).to.deep.include({ status: 'missing', average: 0.525 })
    expect(QuizBagValidators.quizBag.safeParse(bag).success).to.be.true
  })

  it("satisfy the schema for a widgeting run once for the whole quiz: no question, and the quiz's own widgeteds on the quiz", () => {
    const quizWide = {
      ...quiz,
      widgetings: [Widgeting.fill({ widget_label: 'playtesters', label: 'playtesters', tier: 'quiz' }), ...quiz.widgetings, Widgeting.fill({ widget_label: 'question_count', label: 'grand_total', tier: 'quiz' })],
    }
    const bag = present(Runner.bagsAt(runOf(quizWide), { label: 'grand_total', params: {} }).get(question._id))
    expect([bag.question, bag.question_label]).to.deep.eq([{}, ''])
    expect(bag.quiz.playtesters).to.deep.include({ status: 'errored' })
    expect(QuizBagValidators.quizBag.safeParse(bag).success).to.be.true
  })

  it('name the failing field when one does not', () => {
    const bag = present(bags.get(question._id))
    const outcome = QuizBagValidators.quizBag.safeParse({ ...bag, question_label: 'Not A Label' })
    expect(outcome.success).to.be.false
    expect(outcome.error?.issues[0]?.path).to.deep.eq(['question_label'])
  })
})

describe('inputSchema', () => {
  const schema = inputSchema() as { properties?: Record<string, unknown>, required?: string[] }
  /** The fields the schema names for its top-level key `key` */
  const fieldsOf = (key: string) => Object.keys((present(schema.properties)[key] as { properties?: object }).properties ?? {})

  it('names the twelve keys a formula can read, all required', () => {
    const keys = ['hunt', 'realm', 'categories', 'quiz', 'questions', 'question', 'hunt_label', 'realm_label', 'quiz_label', 'question_label', 'params', 'widgeting_label']
    expect(Object.keys(schema.properties ?? {})).to.have.members(keys)
    expect(schema.required).to.have.members(keys)
  })

  it("names the fields the export holds of the hunt and the quiz, and the realm's label and title, and no others", () => {
    expect(fieldsOf('hunt')).to.have.members(['label', 'title', 'branch', 'created_at', 'updated_at'])
    expect(fieldsOf('realm')).to.have.members(['label', 'title'])
    expect(fieldsOf('quiz')).to.have.members(['label', 'title', 'smiths_note', 'q1_preamble', 'recap_head', 'recap_tail', 'recap_template', 'templateable', 'locked', 'last_sortkey', 'created_at', 'updated_at'])
  })

  it("tells a reader what the smith's note is", () => {
    expect(JSON.stringify(present(schema.properties).quiz)).to.include('What the smiths want to say about the quiz')
  })

  it('keeps the descriptions, which are what tell a reader what a field means', () => {
    expect(JSON.stringify(inputSchema())).to.include('Look it up in `questions`')
  })

  it('leaves the id out of a question, and the raw chain id with it', () => {
    const questionSchema = JSON.stringify(present(schema.properties).question)
    expect(questionSchema).to.not.include('"id"')
    expect(questionSchema).to.include('"rank"')
    expect(questionSchema).to.include('"position"')
  })

  it("tells a reader that every earlier widgeting's widgeted sits on a question under its label", () => {
    const [questionSchema] = (present(schema.properties).question as { anyOf: { additionalProperties?: { oneOf?: unknown[] } }[] }).anyOf
    expect(JSON.stringify(present(questionSchema).additionalProperties)).to.include('under that widgeting')
    expect(present(questionSchema).additionalProperties?.oneOf).to.have.lengthOf(3)
  })

  it("tells a reader that a quiz widgeting's widgeted sits on the quiz under its label, and that its own bag holds no question", () => {
    const quizSchema = present(schema.properties).quiz as { additionalProperties?: unknown }
    expect(JSON.stringify(quizSchema.additionalProperties)).to.include('quiz.playtesters.value')
    expect(JSON.stringify(present(schema.properties).question)).to.include('Empty for a widgeting run once for the whole quiz')
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

describe('Bagged', () => {
  const leon = { ...Question.blank(), label: 'leon', qnum: '1', title: 'Leon', created_at: 0, updated_at: 0 }
  const nantes = { ...Question.blank(), label: 'nantes', qnum: '', chains_to: leon._id, viz: 'archived' as const }

  it('makes a question as its export holds it: its place, label, own fields, viz, chain by label and stamps', () => {
    expect(Bagged.question(leon, 0, null)).to.deep.eq({
      position: 0, label: 'leon', qnum: '1', clueing: '', hint: '', title: 'Leon', alt_text: '', notes: '', full_answer: '', recap: '', viz: 'normal',
      chains_to: null, created_at: '1970-01-01T00:00:00.000Z', updated_at: '1970-01-01T00:00:00.000Z',
    })
  })

  it("makes every question of a quiz in its order, each chain named by its target's label, or none for one outside them", () => {
    expect(Bagged.questions([leon, nantes]).map(({ label, position, chains_to }) => [label, position, chains_to])).to.deep.eq([['leon', 0, null], ['nantes', 1, 'leon']])
    expect(Bagged.questions([nantes])[0]?.chains_to).to.be.null
  })

  it('works out each question\'s rank and its viz as two yes-or-nos, which only the bag holds', () => {
    expect(Bagged.workedOut([leon, nantes])).to.deep.eq([{ rank: 1, archived: false, secondary: false }, { rank: null, archived: true, secondary: false }])
  })

  it("makes the quiz's own fields, its recap template null for the default, and nothing of its questions or layout", () => {
    expect(Bagged.quiz({ ...Quiz.blank('Bag'), label: 'my_quiz' })).to.deep.include({ label: 'my_quiz', title: 'Bag', recap_template: null, created_at: null })
    expect(Bagged.quiz(Quiz.blank('Bag'))).to.not.have.any.keys('questions', 'widgetings', 'columns', 'stored', '_id')
  })

  it("makes the hunt's categories by label in the wheel's total order, each with its slot or none", () => {
    const categories = Bagged.categories(Wheel.placed(Wheel.defaultWheel(), 'tv', 'pool'))
    expect(Object.keys(categories)).to.have.lengthOf(24)
    expect(categories.tv).to.deep.eq({ label: 'tv', title: 'TV', position: null })
  })

  it('makes a widgeted its status and value, never its failure', () => {
    expect(Bagged.widgeted(Widgeted.errored({ message: 'No', at: null, response: null }))).to.deep.eq({ status: 'errored', value: null })
  })

  it('keys questions by label, once for each list', () => {
    const listed = [{ label: 'leon' }, { label: 'nantes' }]
    expect(Object.keys(Bagged.keyed(listed))).to.deep.eq(['leon', 'nantes'])
    expect(Bagged.keyed(listed)).to.eq(Bagged.keyed(listed))
  })
})
