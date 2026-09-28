import { describe, expect, it } from 'vitest'
import * as Z from 'zod'
import { BlankQuestionQty, Quiz, QuizValidators } from '../../src/models/quiz'
import { Question } from '../../src/models/question'
import { mintId } from '../../src/lib/ids'
import * as Labelmaker from '../../src/lib/labelmaker'

const quizId = mintId()

describe('Quiz.fill', () => {
  it('defaults every field but the id', () => {
    const quiz = Quiz.fill({ _id: quizId })
    expect(quiz).to.deep.include({
      _id:             quizId,
      questions:       [],
      locked:          false,
      last_sortkey:    null,
      bulk_ishes_last: null,
      forced_label:    null,
    })
    expect(quiz.label).to.match(/^[a-z]+_[a-z]+$/)
    expect(quiz.title).to.eq(Labelmaker.titleize(quiz.label))
  })

  it('keeps the questions in the order given, because that array IS the order', () => {
    const [one, two, three] = [Question.blank(), Question.blank(), Question.blank()]
    const quiz = Quiz.fill({ _id: quizId, questions: [one, two, three].toReversed() })
    expect(quiz.questions.map((question) => question._id)).to.deep.eq([three._id, two._id, one._id])
  })

  it('accepts a chain between two questions in the quiz', () => {
    const [ante, post] = [Question.blank(), Question.blank()]
    const quiz = Quiz.fill({ _id: quizId, questions: [{ ...ante, chains_to: post._id }, post] })
    expect(quiz.questions[0]?.chains_to).to.eq(post._id)
  })

  it('refuses a chain pointing at a question in no quiz', () => {
    const question = Question.blank()
    expect(() => Quiz.fill({ _id: quizId, questions: [{ ...question, chains_to: mintId() }] })).to.throw(Z.ZodError)
  })

  it('refuses a question chained to itself', () => {
    const question = Question.blank()
    expect(() => Quiz.fill({ _id: quizId, questions: [{ ...question, chains_to: question._id }] })).to.throw(Z.ZodError)
  })

  it('refuses two questions sharing one id', () => {
    const question = Question.blank()
    expect(() => Quiz.fill({ _id: quizId, questions: [question, { ...question }] })).to.throw(Z.ZodError)
  })

  it('holds 999 questions, and refuses a thousandth', () => {
    const questions = Array.from({ length: 1000 }, () => Question.blank())
    expect(Quiz.fill({ _id: quizId, questions: questions.slice(0, 999) }).questions).to.have.lengthOf(999)
    expect(() => Quiz.fill({ _id: quizId, questions })).to.throw(Z.ZodError)
  })

  it('holds 99 widgets, and refuses a hundredth', () => {
    const widgets = Array.from({ length: 100 }, (_unused, idx) => ({ kind: 'expressing' as const, label: `widget_${String(idx)}`, expression_label: 'letter_count' }))
    expect(Quiz.fill({ _id: quizId, widgets: widgets.slice(0, 99) }).widgets).to.have.lengthOf(99)
    expect(() => Quiz.fill({ _id: quizId, widgets })).to.throw(Z.ZodError)
  })

  it('holds 99 columns, and refuses a hundredth', () => {
    const columns = Array.from({ length: 100 }, (_unused, idx) => ({ label: `column_${String(idx)}`, title: 'Title', source: 'question.title', width_px: 80 }))
    expect(Quiz.fill({ _id: quizId, columns: columns.slice(0, 99) }).columns).to.have.lengthOf(99)
    expect(() => Quiz.fill({ _id: quizId, columns })).to.throw(Z.ZodError)
  })

  it('names the offending field when a chain dangles', () => {
    const question = Question.blank()
    const outcome = QuizValidators.quiz.safeParse({ _id: quizId, questions: [{ ...question, chains_to: mintId() }] })
    expect(outcome.success).to.eq(false)
    expect(outcome.error?.issues[0]?.path).to.deep.eq(['questions', 0, 'chains_to'])
  })

  it('rejects a sort memory naming no column we have', () => {
    expect(() => Quiz.fill({ _id: quizId, last_sortkey: 'q_full' as never })).to.throw(Z.ZodError)
  })

  it('accepts a sort memory naming one of its columns, or the chain order', () => {
    expect(Quiz.fill({ _id: quizId, last_sortkey: 'column:clueing_full' }).last_sortkey).to.eq('column:clueing_full')
    expect(Quiz.fill({ _id: quizId, last_sortkey: 'chain_order' }).last_sortkey).to.eq('chain_order')
  })

  it('rejects a sort memory naming a column badly, or the old kind of name', () => {
    const outcomes = ['column:', 'column:Clueing', 'column:a', 'column:x_', 'expressing:clueing_full', 'qnum']
      .map((sortkey) => QuizValidators.quiz.safeParse({ _id: quizId, last_sortkey: sortkey }).success)
    expect(outcomes).to.deep.eq([false, false, false, false, false, false])
  })

  it('keeps its widgets and its columns each in the order given', () => {
    const widgets = [
      { kind: 'expressing' as const, label: 'zed', expression_label: 'answer_reversed' },
      { kind: 'botting' as const, label: 'aye', bot_label: 'dumdum' as const, textkind: 'clueing' as const },
    ]
    const columns = [
      { label: 'zed_col', title: 'Zed', source: 'zed', width_px: 78 },
      { label: 'aye_col', title: 'Aye', source: 'aye', width_px: 160 },
    ]
    const quiz = Quiz.fill({ _id: quizId, widgets, columns })
    expect(quiz.widgets.map((widget) => widget.label)).to.deep.eq(['zed', 'aye'])
    expect(quiz.columns.map((column) => column.label)).to.deep.eq(['zed_col', 'aye_col'])
  })

  const Widget = { kind: 'expressing' as const, label: 'zed', expression_label: 'answer_reversed' }
  const Col = { label: 'zed', title: 'Zed', source: 'question.title', width_px: 78 }

  const Refused: [object, string][] = [
    [{ widgets: [Widget, { ...Widget, description: 'again' }] },                                'two widgets sharing a label'],
    [{ widgets: [{ ...Widget, label: 'question' }] },                                           'a widget labelled as the questions are'],
    [{ columns: [Col, { ...Col, title: 'Again' }] },                                            'two columns sharing a label'],
    [{ columns: [{ ...Col, source: 'nowhere' }] },                                              'a column showing a widget the quiz does not have'],
  ]
  for (const [overrides, describes] of Refused) {
    it(`refuses ${describes}`, () => {
      expect(() => Quiz.fill({ _id: quizId, ...overrides })).to.throw(Z.ZodError)
    })
  }

  it('accepts a widget and a column that share a label, since one is what a thing is and the other where it is shown', () => {
    expect(() => Quiz.fill({ _id: quizId, widgets: [Widget], columns: [{ ...Col, source: 'zed' }] })).to.not.throw()
  })

  it('exposes its label and its title, and none of its housekeeping', () => {
    expect(Quiz.exposed).to.deep.eq(['label', 'title'])
  })

  it('remembers what the last batch run cost', () => {
    const quiz = Quiz.fill({ _id: quizId, bulk_ishes_last: { approx_tokens: 4200, text_count: 28, updated_at: 1 } })
    expect(quiz.bulk_ishes_last).to.deep.eq({ approx_tokens: 4200, text_count: 28, updated_at: 1 })
  })

  it('rejects a title past 200 characters', () => {
    expect(() => Quiz.fill({ _id: quizId, title: 'x'.repeat(201) })).to.throw(Z.ZodError)
  })
})

describe('Quiz.blank', () => {
  it('opens with blank questions rather than an empty void', () => {
    expect(Quiz.blank().questions).to.have.length(BlankQuestionQty)
  })

  it('gives every question its own id', () => {
    const ids = new Set(Quiz.blank().questions.map((question) => question._id))
    expect(ids.size).to.eq(BlankQuestionQty)
  })

  it('takes a title when one is offered', () => {
    expect(Quiz.blank('Quiz two').title).to.eq('Quiz two')
  })

  it('takes a label when one is offered, and titles itself from it', () => {
    const quiz = Quiz.blank('', 'danishprinces')
    expect(quiz.label).to.eq('danishprinces')
    expect(quiz.title).to.eq('Danishprinces')
  })

  it('refuses a label that is not one', () => {
    expect(() => Quiz.blank('', 'Not A Label')).to.throw(Z.ZodError)
  })
})

describe('QuizValidators.row', () => {
  const Row = {
    realm_id: '01a0dc10-c9be-7cb3-9d3a-25fc68cd12f9', title: 'Princes', label: 'princes', forced_label: null, version: 'main', locked: false, last_sortkey: null, bulk_ishes_last: null,
  }

  it('takes a quiz as the database holds it, sort memory and batch cost included', () => {
    const run = { approx_tokens: 4200, text_count: 28, updated_at: 1_700_000_000_000 }
    expect(QuizValidators.row({ ...Row, last_sortkey: 'column:clueing', bulk_ishes_last: run })).to.deep.eq({ ...Row, last_sortkey: 'column:clueing', bulk_ishes_last: run })
    expect(QuizValidators.row({ ...Row, last_sortkey: 'chain_order' }).last_sortkey).to.eq('chain_order')
  })

  const Refused: [object, string][] = [
    [{ realm_id: 'princes' },                'a realm that is not a row id'],
    [{ label: 'Princes' },                   'a label that is not one'],
    [{ title: 'x'.repeat(83) },              'a title past 82 characters'],
    [{ last_sortkey: 'column:Clueing' },     'a sort memory naming a column that is not a label'],
    [{ last_sortkey: 'clueing' },            'a sort memory that is neither a column nor the chain order'],
    [{ locked: 'no' },                       'a lock that is not a yes or no'],
  ]
  for (const [overrides, describes] of Refused) {
    it(`refuses ${describes}`, () => {
      expect(() => QuizValidators.row({ ...Row, ...overrides })).to.throw(Z.ZodError)
    })
  }
})
