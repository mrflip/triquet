import { describe, expect, it } from 'vitest'
import * as Runner from '../../../src/lib/formulary/runner'
import { Expression, SeedExpressions, type ExpressionT } from '../../../src/models/expression'
import { BottingWidget, Expressing, type LibraryWidgetT } from '../../../src/models/widget'
import { defaultLayoutFor } from '../../../src/models/layout'
import { Question, type QuestionT } from '../../../src/models/question'
import { Quiz, type QuizT } from '../../../src/models/quiz'
import { Widgeted, type StoredWidgetedT, type WidgetedT } from '../../../src/models/widgeted'
import type { WidgetingT } from '../../../src/models/widgeting'
import type { IshItemT, IshesT } from '../../../src/models/ish'
import { present } from '../../support/present'
import { Here } from '../../support/places'
import { runOf } from '../../support/runs'

/** A finished extraction holding the spans given */
function extracted(items: IshItemT[], stale = false): IshesT {
  return { status: 'done', items, truncated: false, stale, updated_at: 1, last_err: null }
}

const numeral = (text: string, value: number): IshItemT => ({ text, value, kind: 'numeral' })
const wordish = (text: string, value: number): IshItemT => ({ text, value, kind: 'wordish' })
const failed = (message: string): WidgetedT => Widgeted.errored({ message, at: null, response: null })
const byText = (aa: string, bb: string) => aa.localeCompare(bb)

/** A stored row, recorded half a millisecond after `at` */
function storedRow(status: 'ok' | 'errored', at: number, value: StoredWidgetedT['value'] = null): StoredWidgetedT {
  return { status, value, message: status === 'ok' ? null : 'Too many requests.', result_meta: status === 'ok' ? {} : { response: { ok: false } }, _creationTime: at + 0.5 }
}

/** Expressings, each `[label, expression_label]` */
function widgetsOf(...labels: [string, string][]) {
  return labels.map(([label, expression_label]) => Expressing.fill({ kind: 'expressing', label, expression_label }))
}

/** One question with the fields given */
function loneQuestion(patch: Partial<QuestionT>): QuestionT {
  return { ...Question.blank(), qnum: '1', ...patch }
}

/** A quiz of `questions` showing the standard widgets: the three bots and the eight sums */
function standardQuiz(questions: QuestionT[]): QuizT {
  return { ...Quiz.blank('Standard'), questions, ...defaultLayoutFor(SeedExpressions) }
}

/** What the standard widgeting `label` came to for `question`, in a quiz of `questions` */
function sumOf(questions: QuestionT[], question: QuestionT, label: string): WidgetedT {
  return Runner.widgetedOf(runOf(standardQuiz(questions)), label, question._id)
}

/** A quiz of `questions` with one widgeting, `col`, working a formula of its own */
function columnQuiz(formula: string, questions: QuestionT[] = [loneQuestion({})]): { quiz: QuizT, expressions: ExpressionT[] } {
  return {
    quiz:        { ...Quiz.blank('Custom'), questions, widgets: [Expressing.fill({ kind: 'expressing', label: 'col', expression_label: 'custom' })] },
    expressions: [Expression.fill({ label: 'custom', formula })],
  }
}

describe('the standard sum widgets', () => {
  it('add every ish in the clueing, and the digit-written ones on their own', () => {
    const question = loneQuestion({ clueing_ishes: extracted([numeral('300', 300), wordish('a dozen', 12)]) })
    expect(sumOf([question], question, 'clueing_full')).to.deep.eq(Widgeted.ok(312))
    expect(sumOf([question], question, 'clueing_numeral')).to.deep.eq(Widgeted.ok(300))
  })

  it('round a sum to a whole number, halves upward, while the items keep their fractions', () => {
    const cases: [number[], number][] = [[[0.25, 0.5], 1], [[0.5], 1], [[0.4], 0], [[2.5], 3], [[-0.5], 0]]
    const readings = cases.map(([values]) => {
      const question = loneQuestion({ clueing_ishes: extracted(values.map((val) => wordish('some', val))) })
      return sumOf([question], question, 'clueing_full')
    })
    expect(readings).to.deep.eq(cases.map(([, expected]) => Widgeted.ok(expected)))
  })

  it('read an empty extraction as nought, which is a real answer', () => {
    const question = loneQuestion({ clueing_ishes: extracted([]) })
    expect(sumOf([question], question, 'clueing_full')).to.deep.eq(Widgeted.ok(0))
  })

  it('read a never-asked cell as missing, not as nought', () => {
    const question = loneQuestion({})
    expect(sumOf([question], question, 'clueing_full')).to.deep.eq(Widgeted.missing)
  })

  it('read a failed ask as missing', () => {
    const question = loneQuestion({ clueing_ishes: { status: 'error', message: 'A connection hiccup — try again.', updated_at: 1, last_err: { message: 'A connection hiccup — try again.', response: { ok: false }, at: 1 } } })
    expect(sumOf([question], question, 'clueing_full')).to.deep.eq(Widgeted.missing)
  })

  it('add the rank, not the Q#, so the meta-puzzle survives gappy numbering', () => {
    const early = { ...Question.blank(), qnum: '3', clueing_ishes: extracted([numeral('300', 300)]) }
    const late  = { ...Question.blank(), qnum: '40' }
    expect(sumOf([early, late], early, 'clueing_plus_rank')).to.deep.eq(Widgeted.ok(301))
  })

  it('borrow the chained-to question\'s hint for the BUT NOT widgets, followed by the label in force', () => {
    const target = { ...Question.blank(), qnum: '2', forced_label: 'the_film', hint_ishes: extracted([numeral('1994', 1994), wordish('twelve', 12)]) }
    const question = { ...Question.blank(), qnum: '1', chains_to: target._id, hint_ishes: extracted([numeral('7', 7)]) }
    expect(sumOf([question, target], question, 'butnot_full')).to.deep.eq(Widgeted.ok(2006))
    expect(sumOf([question, target], question, 'butnot_numeral')).to.deep.eq(Widgeted.ok(1994))
    expect(sumOf([question, target], question, 'hint_full')).to.deep.eq(Widgeted.ok(7))
  })

  it('leave the BUT NOT widgets missing when nothing is chained, and the combined one unless both halves exist', () => {
    const question = loneQuestion({ clueing_ishes: extracted([numeral('6', 6)]) })
    expect(sumOf([question], question, 'butnot_full')).to.deep.eq(Widgeted.missing)
    expect(sumOf([question], question, 'clueing_plus_butnot_full')).to.deep.eq(Widgeted.missing)
  })

  it('add the clueing and the borrowed hint for the widest reading', () => {
    const target = { ...Question.blank(), qnum: '2', hint_ishes: extracted([numeral('1994', 1994)]) }
    const question = { ...Question.blank(), qnum: '1', chains_to: target._id, clueing_ishes: extracted([numeral('6', 6)]) }
    expect(sumOf([question, target], question, 'clueing_plus_butnot_full')).to.deep.eq(Widgeted.ok(2000))
  })

  describe('staleness, retiring', () => {
    it('marks a sum stale when its own extraction is stale, and keeps the out-of-date number', () => {
      const question = loneQuestion({ clueing_ishes: extracted([numeral('300', 300)], true) })
      const run = runOf(standardQuiz([question]))
      expect(Runner.widgetedOf(run, 'clueing_full', question._id)).to.deep.eq(Widgeted.ok(300))
      expect(Runner.isStale(run, 'clueing_full', question._id)).to.be.true
      expect(Runner.isStale(run, 'clueing_numeral', question._id)).to.be.true
    })

    it('passes staleness on to a question borrowing a stale hint, and not to one that is not', () => {
      const target = { ...Question.blank(), qnum: '2', hint_ishes: extracted([numeral('1994', 1994)], true) }
      const question = { ...Question.blank(), qnum: '1', chains_to: target._id, clueing_ishes: extracted([numeral('6', 6)]) }
      const run = runOf(standardQuiz([question, target]))
      expect(Runner.isStale(run, 'butnot_full', question._id)).to.be.true
      expect(Runner.isStale(run, 'clueing_full', question._id)).to.be.false
    })
  })
})

describe('the standard text widgets', () => {
  const textOf = (patch: Partial<QuestionT>, label: string): WidgetedT => {
    const question = { ...Question.blank(), ...patch }
    const quiz = { ...Quiz.blank('Words'), questions: [question], widgets: [Expressing.fill({ kind: 'expressing', label, expression_label: label })] }
    return Runner.widgetedOf(runOf(quiz), label, question._id)
  }

  const Cases: [string, Partial<QuestionT>, WidgetedT, string][] = [
    // label                  patch                                  expected                          blurb
    ['clueing_word_count',    { clueing: 'Who wrote  this, then?' }, Widgeted.ok(4),                   'words are counted across any run of spaces'],
    ['clueing_word_count',    { clueing: '' },                       Widgeted.ok(0),                   'an empty clueing has no words'],
    ['answer_letter_count',   { full_answer: 'Don\'t Stop!' },       Widgeted.ok(8),                   'only letters are counted'],
    ['answer_reversed',       { full_answer: 'stressed' },           Widgeted.ok('desserts'),          'the answer is written backward'],
    ['answer_reversed',       { full_answer: '' },                   Widgeted.missing,                 'an empty answer reverses to nothing'],
    ['answer_alphabetized',   { full_answer: 'Hello, World' },       Widgeted.ok('dehllloorw'),        'letters sorted, case and punctuation ignored'],
  ]
  for (const [label, patch, expected, blurb] of Cases) {
    it(`${label}: ${blurb}`, () => {
      expect(textOf(patch, label)).to.deep.eq(expected)
    })
  }

  describe('clueing_with_butnot', () => {
    const foldedFor = (clueing: string, hint: string | null): WidgetedT => {
      const target = { ...Question.blank(), qnum: '2', hint: hint ?? '' }
      const question = { ...Question.blank(), qnum: '1', clueing, chains_to: hint === null ? null : target._id }
      const quiz = { ...Quiz.blank('Fold'), questions: [question, target], widgets: [Expressing.fill({ kind: 'expressing', label: 'folded', expression_label: 'clueing_with_butnot' })] }
      return Runner.widgetedOf(runOf(quiz), 'folded', question._id)
    }

    const Cases2: [string, string | null, WidgetedT, string][] = [
      // clueing          hint                   expected                                              blurb
      ['Which region?',   'BUT NOT the film',    Widgeted.ok('Which region? ... BUT NOT the film'),     'joins a clueing to a hint that already says BUT NOT'],
      ['Which region?',   'the film',            Widgeted.ok('Which region? ... BUT NOT ... the film'), 'supplies the phrase when the hint does not carry it'],
      ['Which region?',   'but not the film',    Widgeted.ok('Which region? ... but not the film'),     'does not care how the hint is capitalised'],
      ['Which region?',   ' '.repeat(3),         Widgeted.ok('Which region?'),                          'leaves the clueing alone when the hint is only space'],
      ['Which region?',   null,                  Widgeted.ok('Which region?'),                          'leaves the clueing alone when nothing is chained'],
      ['',                null,                  Widgeted.missing,                                      'reads an empty clueing with nothing to fold as missing'],
    ]
    for (const [clueing, hint, expected, blurb] of Cases2) {
      it(blurb, () => {
        expect(foldedFor(clueing, hint)).to.deep.eq(expected)
      })
    }
  })
})

describe('runQuiz', () => {
  it('reports a formula that does not parse as a failure in its own cells, and no others', () => {
    const [aa, bb] = [loneQuestion({}), loneQuestion({})]
    const quiz = {
      ...Quiz.blank('Two widgetings'),
      questions: [aa, bb],
      widgets:   [
        Expressing.fill({ kind: 'expressing', label: 'bad', expression_label: 'broken' }),
        Expressing.fill({ kind: 'expressing', label: 'fine', expression_label: 'steady' }),
      ],
    }
    const run = runOf(quiz, [Expression.fill({ label: 'broken', formula: '$sum(' }), Expression.fill({ label: 'steady', formula: '3' })])
    expect(Runner.widgetedOf(run, 'bad', aa._id).status).to.eq('errored')
    expect(Runner.widgetedOf(run, 'fine', aa._id)).to.deep.eq(Widgeted.ok(3))
    expect(Runner.widgetedOf(run, 'fine', bb._id)).to.deep.eq(Widgeted.ok(3))
  })

  it('reports a widgeting whose widget is gone as a failure, naming it', () => {
    const { quiz } = columnQuiz('1')
    const widgeted = Runner.widgetedOf(runOf(quiz, []), 'col', present(quiz.questions[0])._id)
    expect(widgeted).to.deep.eq(failed('There is no widget called "custom" any more'))
  })

  it('stops a formula that will not end, and does not wait on it again for the rest of its widgeting', () => {
    const questions = Array.from({ length: 30 }, () => loneQuestion({}))
    const { quiz, expressions } = columnQuiz('( $spin := function() { $spin() }; $spin() )', questions)
    const beganAt = Date.now()
    const run = runOf(quiz, expressions)
    expect(Date.now() - beganAt).to.be.lessThan(1500)
    const statuses = questions.map((question) => Runner.widgetedOf(run, 'col', question._id).status)
    expect(new Set(statuses)).to.deep.eq(new Set(['errored']))
  })

  it('has no widgetings for a quiz that works none', () => {
    expect(runOf(Quiz.blank()).widgeteds.size).to.eq(0)
  })

  it('reads missing where the widgeting or the question is not there', () => {
    const { quiz, expressions } = columnQuiz('1')
    const run = runOf(quiz, expressions)
    expect(Runner.widgetedOf(run, 'absent', 'nobody')).to.deep.eq(Widgeted.missing)
    expect(Runner.widgetedOf(run, 'col', 'nobody')).to.deep.eq(Widgeted.missing)
  })

  describe('in run order', () => {
    const question = loneQuestion({ full_answer: 'Leon' })
    const expressions = [
      Expression.fill({ label: 'shout', formula: '$uppercase(qn.full_answer)' }),
      Expression.fill({ label: 'echo',  formula: "qn.first.status = 'ok' ? qn.first.value & '!'" }),
    ]

    it("hands each widgeting the widgeteds of those before it, an expression's value among them", () => {
      const quiz = { ...Quiz.blank('Order'), questions: [question], widgets: widgetsOf(['first', 'shout'], ['second', 'echo']) }
      expect(Runner.widgetedOf(runOf(quiz, expressions), 'second', question._id)).to.deep.eq(Widgeted.ok('LEON!'))
    })

    it('hands no widgeting its own widgeted, or a later one\'s', () => {
      const quiz = { ...Quiz.blank('Order'), questions: [question], widgets: widgetsOf(['second', 'echo'], ['first', 'shout']) }
      const run = runOf(quiz, expressions)
      expect(Runner.widgetedOf(run, 'second', question._id)).to.deep.eq(Widgeted.missing)
      expect(Runner.bagsAt(run, { label: 'second', params: {} }).get(question._id)?.qn).to.not.have.property('first')
    })

    it('puts every earlier widgeted on every question of `qns`, and on `qn`, the very object found there', () => {
      const other = loneQuestion({ full_answer: 'Lyon' })
      const quiz = { ...Quiz.blank('Order'), questions: [question, other], widgets: widgetsOf(['first', 'shout'], ['second', 'echo']) }
      const bag = present(Runner.bagsAt(runOf(quiz, expressions), { label: 'second', params: {} }).get(question._id))
      expect(bag.qns.map((qn) => qn.first)).to.deep.eq([Widgeted.ok('LEON'), Widgeted.ok('LYON')])
      expect(bag.qn).to.eq(bag.qns[0])
    })

    it("never lets a widgeting's label shadow one of a question's own keys", () => {
      const quiz = { ...Quiz.blank('Order'), questions: [question], widgets: widgetsOf(['title', 'shout']) }
      const bag = present(Runner.bagsAt(runOf(quiz, expressions), { label: 'later', params: {} }).get(question._id))
      expect(bag.qn.title).to.eq(question.title)
    })
  })
})

describe('the stored widgetings', () => {
  const answered = loneQuestion({
    clueing: 'Who?',
    guess:   { status: 'done', text: 'Leon\nThe lion.', truncated: false, updated_at: 5, last_err: { message: 'Too many requests.', response: { ok: false }, at: 9 } },
  })
  const quiz = { ...Quiz.blank('Bots'), questions: [answered, loneQuestion({})], widgets: [BottingWidget.fill({ kind: 'botting', label: 'dumdum', bot_label: 'dumdum', textkind: 'clueing' })] }
  const run = runOf(quiz)

  it('are projected from what was recorded: a value, with a newer failure riding along', () => {
    expect(Runner.widgetedOf(run, 'dumdum', answered._id)).to.deep.eq(Widgeted.ok({ guess: 'Leon', explanation: 'The lion.' }, { message: 'Too many requests.', at: 9, response: { ok: false } }))
  })

  it('carry what an ask would be put, and nothing for a blank text', () => {
    expect(Runner.inputOf(run, 'dumdum', answered._id)).to.deep.eq({ status: 'ok', input: { clueing: 'Who?' } })
    expect(Runner.inputOf(run, 'dumdum', present(quiz.questions[1])._id)).to.deep.eq({ status: 'missing' })
  })

  it('carry no inputs for a widgeting worked out on render', () => {
    const { quiz: worked, expressions } = columnQuiz('1')
    expect(Runner.inputOf(runOf(worked, expressions), 'col', present(worked.questions[0])._id)).to.deep.eq({ status: 'missing' })
  })

  it('are counted by status', () => {
    expect(Runner.statusCounts(run, 'dumdum')).to.deep.eq({ ok: 1, errored: 0, missing: 1 })
  })
})

describe('runQuiz, from a source of its own', () => {
  const question = loneQuestion({})
  const widgeting: WidgetingT = { label: 'asked', widget_label: 'asker', description: '', params: { tone: 'dry' } }
  const widget: LibraryWidgetT = { formulary: 'aibot', label: 'asker', title: '', description: '', formula: 'Say {{tone}}', input_formula: "{ 'tone': params.tone }", config: { servicelabel: 'claude', model_tier: 'quick', max_tokens: 10 } }
  const source = (stored: Runner.RunSource['storedOf']): Runner.RunSource => ({ quiz: { ...Quiz.blank(), questions: [question] }, place: Here, steps: [{ widgeting, widget }], storedOf: stored })

  it("reads each stored widgeting's history through the source, and hands the input its params", () => {
    const run = Runner.runQuiz(source(() => ({ newest: storedRow('ok', 3, 'hi'), ok: storedRow('ok', 3, 'hi') })))
    expect(Runner.widgetedOf(run, 'asked', question._id)).to.deep.eq(Widgeted.ok('hi'))
    expect(Runner.inputOf(run, 'asked', question._id)).to.deep.eq({ status: 'ok', input: { tone: 'dry' } })
  })

  it('names the step working a widgeting, and none for a label it does not hold', () => {
    const run = Runner.runQuiz(source(() => null))
    expect(Runner.stepOf(run, 'asked')?.widget?.formulary).to.eq('aibot')
    expect(Runner.stepOf(run, 'nobody')).to.be.null
  })
})

describe('widgetedFrom', () => {
  const Err = { message: 'Too many requests.', at: 7, response: { ok: false } }

  const Cases: [Parameters<typeof Runner.widgetedFrom>[0], WidgetedT, string][] = [
    [null,                                                   Widgeted.missing,                       'no row is missing'],
    [{ newest: storedRow('ok', 3, 42), ok: storedRow('ok', 3, 42) },     Widgeted.ok(42),                        'the newest ok row is the value'],
    [{ newest: storedRow('errored', 7), ok: storedRow('ok', 3, 42) },    Widgeted.ok(42, Err),                   'a newer errored row rides along as err, never replacing the value'],
    [{ newest: storedRow('errored', 7), ok: null },                Widgeted.errored(Err),                  'only errored rows make the cell errored, the failure in whole milliseconds'],
    [{ newest: storedRow('ok', 3, null), ok: storedRow('ok', 3, null) }, Widgeted.ok(null),                      'an ok row whose value is null is still ok'],
  ]
  for (const [history, expected, blurb] of Cases) {
    it(blurb, () => {
      expect(Runner.widgetedFrom(history)).to.deep.eq(expected)
    })
  }
})

describe('bagsAt', () => {
  const target = { ...Question.blank(), qnum: '2', title: 'The film', forced_label: 'the_film' }
  const question = { ...Question.blank(), qnum: '1', title: 'The book', chains_to: target._id }
  const quiz = { ...Quiz.blank('Bag'), forced_label: 'my_quiz', questions: [question, target] }
  const bags = Runner.bagsAt(runOf(quiz), { label: 'col', params: { size: 3 } })
  const bag = present(bags.get(question._id))

  it('gives each question its own bag, in the quiz\'s order', () => {
    expect(bags.keys().toArray()).to.deep.eq([question._id, target._id])
  })

  it('names the question, the quiz and the widgeting by label, and carries its params', () => {
    expect([bag.qn_label, bag.quiz_label, bag.widgeting_label]).to.deep.eq([question.label, 'my_quiz', 'col'])
    expect(present(bag.qns[1]).label).to.eq('the_film')
    expect(bag.params).to.deep.eq({ size: 3 })
  })

  it('strips ids everywhere, and names a chain by the target\'s label, or null', () => {
    expect(bag.qn).to.not.have.property('_id')
    expect(bag.quiz).to.not.have.property('_id')
    expect(bag.qn.chains_to).to.eq('the_film')
    expect(present(bags.get(target._id)).qn.chains_to).to.be.null
  })

  it('leaves the quiz\'s own questions, widgets and columns out of `quiz`', () => {
    expect(bag.quiz).to.not.have.any.keys('questions', 'widgets', 'columns')
    expect(bag.quiz).to.include({ title: 'Bag', label: 'my_quiz' })
  })

  it('gives each question its rank, and null to one with no Q#', () => {
    const unranked = { ...Question.blank(), qnum: '' }
    const ranked = Runner.bagsAt(runOf({ ...quiz, questions: [target, question, unranked] }), { label: 'col', params: {} })
    expect(ranked.values().map((each) => each.qn.rank).toArray()).to.deep.eq([2, 1, null])
  })
})

describe('what a bag exposes of a question', () => {
  const answered = {
    ...Question.blank(), qnum: '1', title: 'Leon', forced_label: 'leon_q',
    guess:         { status: 'done' as const, text: 'Lyon', truncated: true, model_tier_applied: 'quick' as const, approx_tokens: 84, updated_at: 5, last_err: { message: 'no', response: { ok: false }, at: 9 } },
    clueing_ishes: { status: 'done' as const, items: [numeral('3', 3)], truncated: true, stale: true, model_tier_applied: 'careful' as const, approx_tokens: 10, updated_at: 5, last_err: null },
    hint_ishes:    { status: 'error' as const, message: 'Too many requests.', updated_at: 5, last_err: { message: 'Too many requests.', response: { ok: false }, at: 5 } },
  }
  const quiz = { ...Quiz.blank('Bag'), forced_label: 'my_quiz', locked: true, questions: [answered] }
  const { qn, quiz: quizBag, hunt, realm } = present(Runner.bagsAt(runOf(quiz), { label: 'col', params: {} }).get(answered._id))

  it('gives a question only its exposed fields, with the label in force and the rank, and the bots\' fields as they have always been', () => {
    expect(Object.keys(qn).toSorted(byText)).to.deep.eq([...Question.exposed, 'clueing_ishes', 'guess', 'hint_ishes', 'rank'].toSorted(byText))
  })

  it('shows the bots\' answers as their status and what they said, and nothing about cost, model, time or failure', () => {
    expect([qn.guess, qn.clueing_ishes, qn.hint_ishes]).to.deep.eq([{ status: 'done', text: 'Lyon' }, { status: 'done', items: [numeral('3', 3)], stale: true }, { status: 'error' }])
  })

  it("gives the quiz only its label, smith's note and title, and the hunt and realm their labels and titles", () => {
    expect(quizBag).to.deep.eq({ label: 'my_quiz', smiths_note: '', title: 'Bag' })
    expect([hunt, realm]).to.deep.eq([{ label: 'deep_lake', title: 'Deep Lake' }, { label: 'home', title: 'Home' }])
  })
})

describe('placeOf', () => {
  const Cases: [Parameters<typeof Runner.placeOf>, Runner.QuizPlace, string][] = [
    [[{ label: 'deep_lake', forced_label: null,    title: '' },          { label: 'home',   title: '' }],
      { hunt: { label: 'deep_lake', title: 'Deep Lake' },  realm: { label: 'home',   title: 'Home' } },          'blank titles read as the labels titleized'],
    [[{ label: 'deep_lake', forced_label: 'tarn',  title: '' },          { label: 'home',   title: '' }],
      { hunt: { label: 'tarn',      title: 'Tarn' },       realm: { label: 'home',   title: 'Home' } },          "the hunt's forced label is the one in force, and titles a blank title"],
    [[{ label: 'deep_lake', forced_label: 'tarn',  title: 'Lakeside' },  { label: 'finals', title: 'The Finals' }],
      { hunt: { label: 'tarn',      title: 'Lakeside' },   realm: { label: 'finals', title: 'The Finals' } },    'titles of their own are kept as they are'],
  ]
  for (const [[hunt, realm], expected, blurb] of Cases) {
    it(blurb, () => {
      expect(Runner.placeOf(hunt, realm)).to.deep.eq(expected)
    })
  }

  it('leaves out everything a hunt or realm holds besides its exposed fields', () => {
    const hunt = { _id: 'hunt_id', label: 'deep_lake', forced_label: null, title: 'Deep Lake', realms: [], expressions: [] }
    const realm = { _id: 'realm_id', label: 'home', title: 'Home', quizzes: [] }
    expect(Runner.placeOf(hunt, realm)).to.deep.eq({ hunt: { label: 'deep_lake', title: 'Deep Lake' }, realm: { label: 'home', title: 'Home' } })
  })
})
