import { describe, expect, it } from 'vitest'
import * as Z from 'zod'
import { BlankQuestionQty, DefaultQ1Preamble, Quiz, QuizValidators } from '../../src/models/quiz'
import { Question } from '../../src/models/question'
import { mintId } from '../../src/lib/ids'
import * as Labelmaker from '../../src/lib/labelmaker'

const quiz_id = mintId()

describe('Quiz.fill', () => {
  it('defaults every field but the id', () => {
    const quiz = Quiz.fill({ _id: quiz_id })
    expect(quiz).to.deep.include({
      _id:             quiz_id,
      questions:       [],
      locked:          false,
      last_sortkey:    null,
      q1_preamble:     DefaultQ1Preamble,
      recap_head:      '',
      recap_tail:      '',
      templated:       [],
      widgetings:      [],
      columns:         [],
    })
    expect(quiz.label).to.match(/^[a-z]+_[a-z]+$/)
    expect(quiz.title).to.eq(Labelmaker.titleize(quiz.label))
  })

  it('keeps the questions in the order given, because that array IS the order', () => {
    const [one, two, three] = [Question.blank(), Question.blank(), Question.blank()]
    const quiz = Quiz.fill({ _id: quiz_id, questions: [one, two, three].toReversed() })
    expect(quiz.questions.map((question) => question._id)).to.deep.eq([three._id, two._id, one._id])
  })

  it('accepts a chain between two questions in the quiz', () => {
    const [ante, post] = [Question.blank(), Question.blank()]
    const quiz = Quiz.fill({ _id: quiz_id, questions: [{ ...ante, chains_to: post._id }, post] })
    expect(quiz.questions[0]?.chains_to).to.eq(post._id)
  })

  it('refuses a chain pointing at a question in no quiz', () => {
    const question = Question.blank()
    expect(() => Quiz.fill({ _id: quiz_id, questions: [{ ...question, chains_to: mintId() }] })).to.throw(Z.ZodError)
  })

  it('refuses a question chained to itself', () => {
    const question = Question.blank()
    expect(() => Quiz.fill({ _id: quiz_id, questions: [{ ...question, chains_to: question._id }] })).to.throw(Z.ZodError)
  })

  it('refuses two questions sharing one id', () => {
    const question = Question.blank()
    expect(() => Quiz.fill({ _id: quiz_id, questions: [question, { ...question }] })).to.throw(Z.ZodError)
  })

  it('holds 999 questions, and refuses a thousandth', () => {
    const questions = Array.from({ length: 1000 }, () => Question.blank())
    expect(Quiz.fill({ _id: quiz_id, questions: questions.slice(0, 999) }).questions).to.have.lengthOf(999)
    expect(() => Quiz.fill({ _id: quiz_id, questions })).to.throw(Z.ZodError)
  })

  it('holds 99 widgetings, and refuses a hundredth', () => {
    const widgetings = Array.from({ length: 100 }, (_unused, idx) => ({ widget_label: 'answer_letter_count', label: `widgeting_${String(idx)}` }))
    expect(Quiz.fill({ _id: quiz_id, widgetings: widgetings.slice(0, 99) }).widgetings).to.have.lengthOf(99)
    expect(() => Quiz.fill({ _id: quiz_id, widgetings })).to.throw(Z.ZodError)
  })

  it('holds 99 columns, and refuses a hundredth', () => {
    const columns = Array.from({ length: 100 }, (_unused, idx) => ({ label: `column_${String(idx)}`, title: 'Title', source: 'question.title', width_px: 80 }))
    expect(Quiz.fill({ _id: quiz_id, columns: columns.slice(0, 99) }).columns).to.have.lengthOf(99)
    expect(() => Quiz.fill({ _id: quiz_id, columns })).to.throw(Z.ZodError)
  })

  it('names the offending field when a chain dangles', () => {
    const question = Question.blank()
    const outcome = QuizValidators.quiz.safeParse({ _id: quiz_id, questions: [{ ...question, chains_to: mintId() }] })
    expect(outcome.success).to.be.false
    expect(outcome.error?.issues[0]?.path).to.deep.eq(['questions', 0, 'chains_to'])
  })

  it('rejects a sort memory naming no column we have', () => {
    expect(() => Quiz.fill({ _id: quiz_id, last_sortkey: 'q_full' as never })).to.throw(Z.ZodError)
  })

  it('accepts a sort memory naming one of its columns, or the chain order', () => {
    expect(Quiz.fill({ _id: quiz_id, last_sortkey: 'column:clueing_full' }).last_sortkey).to.eq('column:clueing_full')
    expect(Quiz.fill({ _id: quiz_id, last_sortkey: 'chain_order' }).last_sortkey).to.eq('chain_order')
  })

  it('rejects a sort memory naming a column badly, or the old kind of name', () => {
    const outcomes = ['column:', 'column:Clueing', 'column:a', 'column:x_', 'expressing:clueing_full', 'qnum']
      .map((sortkey) => QuizValidators.quiz.safeParse({ _id: quiz_id, last_sortkey: sortkey }).success)
    expect(outcomes).to.deep.eq([false, false, false, false, false, false])
  })

  it('keeps its widgetings and its columns each in the order given', () => {
    const widgetings = [
      { widget_label: 'answer_reversed', label: 'zed' },
      { widget_label: 'dumdum', label: 'aye' },
    ]
    const columns = [
      { label: 'zed_col', title: 'Zed', source: 'zed', width_px: 78 },
      { label: 'aye_col', title: 'Aye', source: 'aye', width_px: 160 },
    ]
    const quiz = Quiz.fill({ _id: quiz_id, widgetings, columns })
    expect(quiz.widgetings.map((widgeting) => widgeting.label)).to.deep.eq(['zed', 'aye'])
    expect(quiz.columns.map((column) => column.label)).to.deep.eq(['zed_col', 'aye_col'])
  })

  const Widgeting = { widget_label: 'answer_reversed', label: 'zed' }
  const Col = { label: 'zed', title: 'Zed', source: 'question.title', width_px: 78 }

  const Refused: [object, string][] = [
    [{ widgetings: [Widgeting, { ...Widgeting, description: 'again' }] },                       'two widgetings sharing a label'],
    [{ widgetings: [Widgeting, { ...Widgeting, widget_label: 'dumdum' }] },                     'two widgetings of different widgets sharing a label'],
    [{ widgetings: [{ ...Widgeting, label: 'question' }] },                                     'a widgeting labelled as the questions are'],
    [{ widgetings: [{ ...Widgeting, label: 'rank' }] },                                         'a widgeting labelled as the rank the bag adds'],
    [{ columns: [Col, { ...Col, title: 'Again' }] },                                            'two columns sharing a label'],
    [{ columns: [{ ...Col, source: 'nowhere' }] },                                              'a column showing a widgeting the quiz does not have'],
    [{ templated: ['nowhere'] },                                                                'templating a widgeting the quiz does not have'],
    [{ templated: ['question.recap', 'question.recap'] },                                       'templating one source twice'],
    [{ templated: ['question.title'] },                                                         'templating a question field that holds no markdown'],
    [{ recap_tail: 'x'.repeat(3601) },                                                          'a recap tail past 3600 characters'],
  ]
  for (const [overrides, describes] of Refused) {
    it(`refuses ${describes}`, () => {
      expect(() => Quiz.fill({ _id: quiz_id, ...overrides })).to.throw(Z.ZodError)
    })
  }

  it('accepts a widgeting and a column that share a label, since one is what a thing is and the other where it is shown', () => {
    expect(() => Quiz.fill({ _id: quiz_id, widgetings: [Widgeting], columns: [{ ...Col, source: 'zed' }] })).to.not.throw()
  })

  it('templates its questions\' markdown fields and its own widgetings, trimming its recap head and tail', () => {
    const quiz = Quiz.fill({ _id: quiz_id, widgetings: [Widgeting], templated: ['question.clueing', 'zed', 'question.recap'], recap_head: '  Thanks!\n', recap_tail: 'Bye. ' })
    expect([quiz.templated, quiz.recap_head, quiz.recap_tail]).to.deep.eq([['question.clueing', 'zed', 'question.recap'], 'Thanks!', 'Bye.'])
  })

  it('names the offending source when it templates a widgeting it does not have', () => {
    const outcome = QuizValidators.quiz.safeParse({ _id: quiz_id, widgetings: [Widgeting], templated: ['zed', 'gone'] })
    expect(outcome.error?.issues[0]?.path).to.deep.eq(['templated', 1])
  })

  it('accepts two widgetings of one widget under labels of their own', () => {
    const quiz = Quiz.fill({ _id: quiz_id, widgetings: [Widgeting, { ...Widgeting, label: 'zed_2' }] })
    expect(quiz.widgetings.map((widgeting) => widgeting.widget_label)).to.deep.eq(['answer_reversed', 'answer_reversed'])
  })

  it('names the offending widgeting when two share a label', () => {
    const outcome = QuizValidators.quiz.safeParse({ _id: quiz_id, widgetings: [Widgeting, Widgeting] })
    expect(outcome.error?.issues[0]?.path).to.deep.eq(['widgetings', 1, 'label'])
  })

  it("exposes its label, the smith's note and its title, and none of its housekeeping", () => {
    expect(Quiz.exposed).to.deep.eq(['label', 'smiths_note', 'title'])
  })

  it('rejects a title past 200 characters', () => {
    expect(() => Quiz.fill({ _id: quiz_id, title: 'x'.repeat(201) })).to.throw(Z.ZodError)
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

describe('Quiz.isLocked', () => {
  it('is true of a locked quiz, and false of one that is not', () => {
    expect([Quiz.isLocked({ locked: true }), Quiz.isLocked({ locked: false })]).to.deep.eq([true, false])
  })
})

describe('QuizValidators.row', () => {
  const Row = {
    hunt_id: '01a0dc10-c9be-7cb3-9d3a-25fc68cd12f8', realm_id: '01a0dc10-c9be-7cb3-9d3a-25fc68cd12f9', title: 'Princes', label: 'princes', smiths_note: '', q1_preamble: 'Read the note![br]', recap_head: '', recap_tail: '', templated: ['question.recap'], locked: false, last_sortkey: null,
    row_ordering: ['j97d0qbj35dar1v8edndzckvsx8f828f'], created_at: 1_759_700_000_000, updated_at: 1_759_700_000_000,
  }

  it('takes a quiz as the database holds it, sort memory included', () => {
    expect(QuizValidators.row({ ...Row, last_sortkey: 'column:clueing' })).to.deep.eq({ ...Row, last_sortkey: 'column:clueing' })
    expect(QuizValidators.row({ ...Row, last_sortkey: 'chain_order' }).last_sortkey).to.eq('chain_order')
  })

  const Refused: [object, string][] = [
    [{ realm_id: 'princes' },                'a realm that is not a row id'],
    [{ hunt_id: undefined },                 'no hunt'],
    [{ label: 'Princes' },                   'a label that is not one'],
    [{ title: 'x'.repeat(83) },              'a title past 82 characters'],
    [{ last_sortkey: 'column:Clueing' },     'a sort memory naming a column that is not a label'],
    [{ last_sortkey: 'clueing' },            'a sort memory that is neither a column nor the chain order'],
    [{ locked: 'no' },                       'a lock that is not a yes or no'],
    [{ row_ordering: ['princes'] },          'an order naming something that is not a row id'],
    [{ recap_head: undefined },              'a missing recap head, which a row never defaults'],
    [{ templated: undefined },               'missing templating, which a row never defaults'],
    [{ templated: ['question.qnum'] },       'templating a field that holds no markdown'],
    [{ row_ordering: Array.from({ length: 1000 }, () => 'j97d0qbj35dar1v8edndzckvsx8f828f') }, 'an order of more questions than a quiz may hold'],
  ]
  for (const [overrides, describes] of Refused) {
    it(`refuses ${describes}`, () => {
      expect(() => QuizValidators.row({ ...Row, ...overrides })).to.throw(Z.ZodError)
    })
  }
})
