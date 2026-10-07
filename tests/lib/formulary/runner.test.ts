import { describe, expect, it } from 'vitest'
import * as Runner from '../../../src/lib/formulary/runner'
import * as Wheel from '../../../src/lib/wheel'
import { Widget, type WidgetT } from '../../../src/models/widget'
import { classicLayout } from '../../support/layouts'
import { Question, type QuestionT } from '../../../src/models/question'
import { Quiz, type QuizT } from '../../../src/models/quiz'
import { SeedWidgets } from '../../../src/models/seeds'
import { Widgeted, type JsonT, type StoredWidgetedT, type WidgetedHistoryT, type WidgetedT } from '../../../src/models/widgeted'
import { Widgeting, type WidgetingT } from '../../../src/models/widgeting'
import type { IshItemT } from '../../../src/models/ish'
import { present } from '../../support/present'
import { Here } from '../../support/places'
import { runOf } from '../../support/runs'

const numeral = (text: string, value: number): IshItemT => ({ text, value, kind: 'numeral' })
const wordish = (text: string, value: number): IshItemT => ({ text, value, kind: 'wordish' })
const failed = (message: string): WidgetedT => Widgeted.errored({ message, at: null, response: null })
const byText = (aa: string, bb: string) => aa.localeCompare(bb)

/** A stored row, recorded half a millisecond after `at` */
function storedRow(status: 'ok' | 'errored', at: number, value: StoredWidgetedT['value'] = null): StoredWidgetedT {
  return { status, value, message: status === 'ok' ? null : 'Too many requests.', result_meta: status === 'ok' ? {} : { response: { ok: false } }, _creationTime: at + 0.5 }
}

/** A cell whose newest row, and newest `ok` row, both hold `value` */
function answered(value: JsonT, at = 3): WidgetedHistoryT {
  const row = storedRow('ok', at, value)
  return { newest: row, ok: row }
}

/** A number spotter's cell that found the spans given */
function extracted(items: IshItemT[]): WidgetedHistoryT {
  return answered({ items })
}

/** A cell whose only ask failed */
const onlyFailed: WidgetedHistoryT = { newest: storedRow('errored', 7), ok: null }

/** Widgetings, each `[label, widget_label]` */
function widgetingsOf(...labels: [string, string][]): WidgetingT[] {
  return labels.map(([label, widget_label]) => Widgeting.fill({ label, widget_label }))
}

/** A widgeting of `widget_label` under `label`, run once for the whole quiz */
function tiered(label: string, widget_label: string): WidgetingT {
  return Widgeting.fill({ label, widget_label, tier: 'quiz' })
}

/** A `jsonata` widget of the library */
function jsonataWidget(label: string, formula: string): WidgetT {
  return Widget.fill({ label, formulary: 'jsonata', formula })
}

/** One question with the fields given */
function loneQuestion(patch: Partial<QuestionT>): QuestionT {
  return { ...Question.blank(), qnum: '1', ...patch }
}

/** A quiz of `questions` working the default widgetings: the three bots, the BUT NOT ishes and the eight sums */
function standardQuiz(questions: QuestionT[]): QuizT {
  return { ...Quiz.blank('Standard'), questions, ...classicLayout() }
}

/** What the standard widgeting `label` came to for `question`, in a quiz of `questions` */
function sumOf(questions: QuestionT[], question: QuestionT, label: string): WidgetedT {
  return Runner.widgetedOf(runOf(standardQuiz(questions)), label, question._id)
}

/** A quiz of `questions` with one widgeting, `col`, working a widget of its own */
function columnQuiz(formula: string, questions: QuestionT[] = [loneQuestion({})]): { quiz: QuizT, library: WidgetT[] } {
  return {
    quiz:    { ...Quiz.blank('Custom'), questions, widgetings: widgetingsOf(['col', 'custom']) },
    library: [jsonataWidget('custom', formula)],
  }
}

describe('the standard sum widgetings', () => {
  it('add every ish in the clueing, and the digit-written ones on their own', () => {
    const question = loneQuestion({ stored: { numnum_clueing: extracted([numeral('300', 300), wordish('a dozen', 12)]) } })
    expect(sumOf([question], question, 'clueing_full')).to.deep.eq(Widgeted.ok(312))
    expect(sumOf([question], question, 'clueing_numeral')).to.deep.eq(Widgeted.ok(300))
  })

  it('round a sum to a whole number, halves upward, while the items keep their fractions', () => {
    const cases: [number[], number][] = [[[0.25, 0.5], 1], [[0.5], 1], [[0.4], 0], [[2.5], 3], [[-0.5], 0]]
    const readings = cases.map(([values]) => {
      const question = loneQuestion({ stored: { numnum_clueing: extracted(values.map((val) => wordish('some', val))) } })
      return sumOf([question], question, 'clueing_full')
    })
    expect(readings).to.deep.eq(cases.map(([, expected]) => Widgeted.ok(expected)))
  })

  it('read an empty extraction as nought, which is a real answer', () => {
    const question = loneQuestion({ stored: { numnum_clueing: extracted([]) } })
    expect(sumOf([question], question, 'clueing_full')).to.deep.eq(Widgeted.ok(0))
  })

  it('read a never-asked cell as missing, not as nought', () => {
    const question = loneQuestion({})
    expect(sumOf([question], question, 'clueing_full')).to.deep.eq(Widgeted.missing)
  })

  it('read a failed ask as missing', () => {
    const question = loneQuestion({ stored: { numnum_clueing: onlyFailed } })
    expect(sumOf([question], question, 'clueing_full')).to.deep.eq(Widgeted.missing)
  })

  it('read the older answer when a newer ask failed', () => {
    const question = loneQuestion({ stored: { numnum_clueing: { newest: storedRow('errored', 9), ok: storedRow('ok', 3, { items: [numeral('6', 6)] }) } } })
    expect(sumOf([question], question, 'clueing_full')).to.deep.eq(Widgeted.ok(6))
  })

  it('add the rank, not the Q#, so the meta-puzzle survives gappy numbering', () => {
    const early = { ...Question.blank(), qnum: '3', stored: { numnum_clueing: extracted([numeral('300', 300)]) } }
    const late  = { ...Question.blank(), qnum: '40' }
    expect(sumOf([early, late], early, 'clueing_plus_rank')).to.deep.eq(Widgeted.ok(301))
  })

  it('borrow the chained-to question\'s hint for the BUT NOT widgetings, followed by the label in force', () => {
    const target = { ...Question.blank(), qnum: '2', label: 'the_film', stored: { numnum_hint: extracted([numeral('1994', 1994), wordish('twelve', 12)]) } }
    const question = { ...Question.blank(), qnum: '1', chains_to: target._id, stored: { numnum_hint: extracted([numeral('7', 7)]) } }
    expect(sumOf([question, target], question, 'butnot_full')).to.deep.eq(Widgeted.ok(2006))
    expect(sumOf([question, target], question, 'butnot_numeral')).to.deep.eq(Widgeted.ok(1994))
    expect(sumOf([question, target], question, 'hint_full')).to.deep.eq(Widgeted.ok(7))
    expect(sumOf([question, target], question, 'butnot_ishes')).to.deep.eq(Widgeted.ok({ items: [numeral('1994', 1994), wordish('twelve', 12)] }))
  })

  it('leave the BUT NOT widgetings missing when nothing is chained, and the combined one unless both halves exist', () => {
    const question = loneQuestion({ stored: { numnum_clueing: extracted([numeral('6', 6)]) } })
    expect(sumOf([question], question, 'butnot_full')).to.deep.eq(Widgeted.missing)
    expect(sumOf([question], question, 'butnot_ishes')).to.deep.eq(Widgeted.missing)
    expect(sumOf([question], question, 'clueing_plus_butnot_full')).to.deep.eq(Widgeted.missing)
  })

  it('add the clueing and the borrowed hint for the widest reading', () => {
    const target = { ...Question.blank(), qnum: '2', stored: { numnum_hint: extracted([numeral('1994', 1994)]) } }
    const question = { ...Question.blank(), qnum: '1', chains_to: target._id, stored: { numnum_clueing: extracted([numeral('6', 6)]) } }
    expect(sumOf([question, target], question, 'clueing_plus_butnot_full')).to.deep.eq(Widgeted.ok(2000))
  })
})

describe('the standard text widgets', () => {
  const textOf = (patch: Partial<QuestionT>, label: string): WidgetedT => {
    const question = { ...Question.blank(), ...patch }
    const quiz = { ...Quiz.blank('Words'), questions: [question], widgetings: widgetingsOf([label, label]) }
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
      const quiz = { ...Quiz.blank('Fold'), questions: [question, target], widgetings: widgetingsOf(['folded', 'clueing_with_butnot']) }
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
    const quiz = { ...Quiz.blank('Two widgetings'), questions: [aa, bb], widgetings: widgetingsOf(['bad', 'broken'], ['fine', 'steady']) }
    const run = runOf(quiz, [jsonataWidget('broken', '$sum('), jsonataWidget('steady', '3')])
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
    const { quiz, library } = columnQuiz('( $spin := function() { $spin() }; $spin() )', questions)
    const beganAt = Date.now()
    const run = runOf(quiz, library)
    expect(Date.now() - beganAt).to.be.lessThan(1500)
    const statuses = questions.map((question) => Runner.widgetedOf(run, 'col', question._id).status)
    expect(new Set(statuses)).to.deep.eq(new Set(['errored']))
  })

  it('has no widgetings for a quiz that works none', () => {
    expect(runOf(Quiz.blank()).widgeteds.size).to.eq(0)
  })

  it('reads missing where the widgeting or the question is not there', () => {
    const { quiz, library } = columnQuiz('1')
    const run = runOf(quiz, library)
    expect(Runner.widgetedOf(run, 'absent', 'nobody')).to.deep.eq(Widgeted.missing)
    expect(Runner.widgetedOf(run, 'col', 'nobody')).to.deep.eq(Widgeted.missing)
  })

  describe('in run order', () => {
    const question = loneQuestion({ full_answer: 'Leon' })
    const library = [
      jsonataWidget('shout', '$uppercase(qn.full_answer)'),
      jsonataWidget('echo',  "qn.first.status = 'ok' ? qn.first.value & '!'"),
      jsonataWidget('peek',  "qn.first.status & '/' & $string($exists(qn.second)) & '/' & $string($exists(qn.third))"),
      ...SeedWidgets,
    ]

    it("hands each widgeting the widgeteds of those before it, a jsonata widget's value among them", () => {
      const quiz = { ...Quiz.blank('Order'), questions: [question], widgetings: widgetingsOf(['first', 'shout'], ['second', 'echo']) }
      expect(Runner.widgetedOf(runOf(quiz, library), 'second', question._id)).to.deep.eq(Widgeted.ok('LEON!'))
    })

    it('hands no widgeting its own widgeted, or a later one\'s', () => {
      const quiz = { ...Quiz.blank('Order'), questions: [question], widgetings: widgetingsOf(['second', 'echo'], ['first', 'shout']) }
      const run = runOf(quiz, library)
      expect(Runner.widgetedOf(run, 'second', question._id)).to.deep.eq(Widgeted.missing)
      expect(present(Runner.bagsAt(run, { label: 'second', params: {} }).get(question._id)).qn).to.not.have.any.keys('first', 'second')
    })

    it('shows every earlier widgeting on every question, as missing at the least, and none from itself on', () => {
      const other = loneQuestion({ full_answer: 'Lyon' })
      const quiz = { ...Quiz.blank('Order'), questions: [question, other], widgetings: widgetingsOf(['first', 'dumdum'], ['second', 'peek'], ['third', 'shout']) }
      const run = runOf(quiz, library)
      const bags = Runner.bagsAt(run, { label: 'second', params: {} })
      expect(bags.values().map((bag) => bag.qn.first).toArray()).to.deep.eq([Widgeted.missing, Widgeted.missing])
      expect(bags.values().flatMap((bag) => bag.qns).map((qn) => Object.hasOwn(qn, 'first')).toArray()).to.deep.eq([true, true, true, true])
      expect(Runner.widgetedOf(run, 'second', question._id)).to.deep.eq(Widgeted.ok('missing/false/false'))
    })

    it('puts every earlier widgeted on every question of `qns`, and on `qn`, the very object found there', () => {
      const other = loneQuestion({ full_answer: 'Lyon' })
      const quiz = { ...Quiz.blank('Order'), questions: [question, other], widgetings: widgetingsOf(['first', 'shout'], ['second', 'echo']) }
      const bag = present(Runner.bagsAt(runOf(quiz, library), { label: 'second', params: {} }).get(question._id))
      expect(bag.qns.map((qn) => qn.first)).to.deep.eq([Widgeted.ok('LEON'), Widgeted.ok('LYON')])
      expect(bag.qn).to.eq(bag.qns[0])
    })

    it("hands a widgeting the run hasn't put to work every widgeting's widgeted", () => {
      const quiz = { ...Quiz.blank('Order'), questions: [question], widgetings: widgetingsOf(['first', 'shout'], ['second', 'echo']) }
      const bag = present(Runner.bagsAt(runOf(quiz, library), { label: 'later', params: {} }).get(question._id))
      expect([bag.qn.first, bag.qn.second]).to.deep.eq([Widgeted.ok('LEON'), Widgeted.ok('LEON!')])
    })

    it("relies on a widgeting's label never being one a question's own keys answer to", () => {
      expect(() => Widgeting.fill({ label: 'title', widget_label: 'shout' })).to.throw(/which the questions already use/)
      expect(() => Widgeting.fill({ label: 'rank', widget_label: 'shout' })).to.throw(/which the questions already use/)
    })
  })
})

describe('the stored widgetings', () => {
  const recorded = loneQuestion({
    clueing: 'Who?',
    stored:  { dumdum: { newest: storedRow('errored', 9), ok: storedRow('ok', 5, { guess: 'Leon', explanation: 'The lion.' }) } },
  })
  const failing = loneQuestion({ clueing: 'Why?', stored: { dumdum: onlyFailed } })
  const blank = loneQuestion({})
  const quiz = { ...Quiz.blank('Bots'), questions: [recorded, failing, blank], widgetings: widgetingsOf(['dumdum', 'dumdum']) }
  const run = runOf(quiz)

  it('are projected from what was recorded: a value, with a newer failure riding along', () => {
    expect(Runner.widgetedOf(run, 'dumdum', recorded._id)).to.deep.eq(Widgeted.ok({ guess: 'Leon', explanation: 'The lion.' }, { message: 'Too many requests.', at: 9, response: { ok: false } }))
  })

  it('are errored when only failures were recorded, and missing when nothing was', () => {
    expect(Runner.widgetedOf(run, 'dumdum', failing._id)).to.deep.eq(Widgeted.errored({ message: 'Too many requests.', at: 7, response: { ok: false } }))
    expect(Runner.widgetedOf(run, 'dumdum', blank._id)).to.deep.eq(Widgeted.missing)
  })

  it('carry what an ask would be put, and nothing for a blank text', () => {
    expect(Runner.inputOf(run, 'dumdum', recorded._id)).to.deep.eq({ status: 'ok', input: { clueing: 'Who?' } })
    expect(Runner.inputOf(run, 'dumdum', blank._id)).to.deep.eq({ status: 'missing' })
  })

  it('carry no inputs for a widgeting worked out on render', () => {
    const { quiz: worked, library } = columnQuiz('1')
    expect(Runner.inputOf(runOf(worked, library), 'col', present(worked.questions[0])._id)).to.deep.eq({ status: 'missing' })
  })

  it('are counted by status', () => {
    expect(Runner.statusCounts(run, 'dumdum')).to.deep.eq({ ok: 1, errored: 1, missing: 1 })
  })

  it('name the step working them, and the widget behind it', () => {
    expect(Runner.stepOf(run, 'dumdum')?.widget?.formulary).to.eq('aibot')
  })
})

describe('the typed widgetings', () => {
  const typed = loneQuestion({ clueing: 'Who?', stored: { remark: answered('Ask Flip.') } })
  const blank = loneQuestion({})
  const quiz = { ...Quiz.blank('Typed'), questions: [typed, blank], widgetings: widgetingsOf(['remark', 'remarks'], ['shout', 'loud']) }
  const library = [Widget.fill({ label: 'remarks', formulary: 'entry', config: { entry_kind: 'text' } }), jsonataWidget('loud', "qn.remark.status = 'ok' ? $uppercase(qn.remark.value)")]
  const run = runOf(quiz, library)

  it('are projected from the one value typed, and missing where nothing was', () => {
    expect(Runner.widgetedOf(run, 'remark', typed._id)).to.deep.eq(Widgeted.ok('Ask Flip.'))
    expect(Runner.widgetedOf(run, 'remark', blank._id)).to.deep.eq(Widgeted.missing)
  })

  it('carry no inputs, since nothing is ever asked of them', () => {
    expect(Runner.inputOf(run, 'remark', typed._id)).to.deep.eq({ status: 'missing' })
    expect(run.inputs.has('remark')).to.be.false
  })

  it('reach the widgetings after them in the bag, as any widgeted does', () => {
    expect(Runner.widgetedOf(run, 'shout', typed._id)).to.deep.eq(Widgeted.ok('ASK FLIP.'))
    expect(Runner.widgetedOf(run, 'shout', blank._id)).to.deep.eq(Widgeted.missing)
  })
})

describe('the widgetings run once for the whole quiz', () => {
  const first = loneQuestion({ qnum: '1', clueing: 'Who?', stored: { remark: answered('Ask Flip.') } })
  const second = loneQuestion({ qnum: '2', clueing: 'Where?' })
  const library = [
    Widget.fill({ label: 'names', formulary: 'entry', config: { entry_kind: 'text' } }),
    Widget.fill({ label: 'remarks', formulary: 'entry', config: { entry_kind: 'text' } }),
    jsonataWidget('thanked', "quiz.playtesters.status = 'ok' ? 'Thanks, ' & quiz.playtesters.value"),
    jsonataWidget('remark_count', "$count(qns[remark.status = 'ok'])"),
    jsonataWidget('early_count', "$count(qns[remark.status = 'ok'])"),
  ]
  // In position order: early_count and playtesters for the quiz, remark and thanked for each question, remark_count for the quiz.
  const quiz: QuizT = {
    ...Quiz.blank('Tiers'),
    questions: [first, second],
    stored:     { playtesters: answered('Ada and Grace') },
    widgetings: [tiered('early_count', 'early_count'), tiered('playtesters', 'names'), ...widgetingsOf(['remark', 'remarks'], ['thanked', 'thanked']), tiered('remark_count', 'remark_count')],
  }
  const run = runOf(quiz, library)

  it('are projected from what the quiz stored, or worked out once, over a bag for no question', () => {
    expect(Runner.quizWidgetedOf(run, 'playtesters')).to.deep.eq(Widgeted.ok('Ada and Grace'))
    expect(Runner.quizWidgetedOf(run, 'remark_count')).to.deep.eq(Widgeted.ok(1))
  })

  it("reach every later question widgeting's bag as quiz.<label>", () => {
    expect(Runner.widgetedOf(run, 'thanked', first._id)).to.deep.eq(Widgeted.ok('Thanks, Ada and Grace'))
    expect(Runner.widgetedOf(run, 'thanked', second._id)).to.deep.eq(Widgeted.ok('Thanks, Ada and Grace'))
  })

  it('read no question widgeting placed after them, and every one placed before', () => {
    expect(Runner.quizWidgetedOf(run, 'early_count')).to.deep.eq(Widgeted.ok(0))
    expect(Runner.quizWidgetedOf(run, 'remark_count')).to.deep.eq(Widgeted.ok(1))
  })

  it('run in position order, the tiers mixed: one for the whole quiz reads the questions as they stand at its place, and those after it read it', () => {
    const mixedLibrary = [
      ...library,
      jsonataWidget('so_far', "'Remarked so far: ' & quiz.mid_count.value"),
      jsonataWidget('so_far_count', "$count(qns[so_far.status = 'ok'])"),
    ]
    const mixed: QuizT = {
      ...quiz,
      widgetings: [...widgetingsOf(['remark', 'remarks']), tiered('mid_count', 'remark_count'), ...widgetingsOf(['so_far', 'so_far']), tiered('so_far_count', 'so_far_count')],
    }
    const mixedRun = runOf(mixed, mixedLibrary)
    expect(mixedRun.steps.map((step) => step.widgeting.label)).to.deep.eq(['remark', 'mid_count', 'so_far', 'so_far_count'])
    expect(Runner.quizWidgetedOf(mixedRun, 'mid_count')).to.deep.eq(Widgeted.ok(1))
    expect(Runner.quizBagAt(mixedRun, { label: 'mid_count', params: {} }).qns[0]).to.not.have.property('so_far')
    expect(Runner.widgetedOf(mixedRun, 'so_far', second._id)).to.deep.eq(Widgeted.ok('Remarked so far: 1'))
    expect(Runner.quizWidgetedOf(mixedRun, 'so_far_count')).to.deep.eq(Widgeted.ok(2))
  })

  it('have no cell for any question, and are told apart from those that do', () => {
    expect(Runner.widgetedOf(run, 'playtesters', first._id)).to.deep.eq(Widgeted.missing)
    expect([Runner.isQuizWide(run, 'playtesters'), Runner.isQuizWide(run, 'thanked')]).to.deep.eq([true, false])
    expect(Runner.quizWidgetedOf(run, 'thanked')).to.deep.eq(Widgeted.missing)
  })

  it('count their one cell', () => {
    expect(Runner.statusCounts(run, 'playtesters')).to.deep.eq({ ok: 1, errored: 0, missing: 0 })
    expect(Runner.statusCounts(run, 'thanked')).to.deep.eq({ ok: 2, errored: 0, missing: 0 })
  })

  it('read as missing when nothing was typed, and as the failure when their widget is gone', () => {
    const unentered = runOf({ ...quiz, stored: {} }, library)
    expect(Runner.quizWidgetedOf(unentered, 'playtesters')).to.deep.eq(Widgeted.missing)
    expect(Runner.widgetedOf(unentered, 'thanked', first._id)).to.deep.eq(Widgeted.missing)
    const gone = runOf(quiz, library.slice(1))
    expect(Runner.quizWidgetedOf(gone, 'playtesters')).to.deep.eq(failed('There is no widget called "names" any more'))
  })

  it("leave the frame's quiz as it stands once every widgeting has run, and each bag's quiz as it stood when that one ran", () => {
    expect(run.frame.quiz).to.deep.include({ playtesters: Widgeted.ok('Ada and Grace'), remark_count: Widgeted.ok(1), early_count: Widgeted.ok(0) })
    expect(run.quizAt.get('playtesters')).to.not.have.property('playtesters')
    expect(run.quizAt.get('thanked')).to.have.property('playtesters')
  })

  it('hand a quiz widgeting one bag, for no question, whichever question it is asked for', () => {
    const bags = Runner.bagsAt(run, { label: 'remark_count', params: {} })
    expect(bags.get(first._id)).to.equal(bags.get(second._id))
    expect(present(bags.get(first._id))).to.deep.include({ qn: {}, qn_label: '', widgeting_label: 'remark_count' })
    expect(Runner.quizBagAt(run, { label: 'remark_count', params: {} }).qns[0]?.remark).to.deep.eq(Widgeted.ok('Ask Flip.'))
  })

  it('give a widgeting the quiz does not run, read for the whole quiz, every widgeted there is', () => {
    const bag = Runner.quizBagAt(run, { label: 'not_yet', params: {} })
    expect(bag.quiz).to.deep.include({ playtesters: Widgeted.ok('Ada and Grace') })
    expect(bag.qns[1]?.thanked).to.deep.eq(Widgeted.ok('Thanks, Ada and Grace'))
  })
})

describe('the category-estimate widgetings', () => {
  const placed = loneQuestion({ stored: { cats: answered([{ category: 'art', difficulty: 'easy' }]) } })
  const blank = loneQuestion({})
  const quiz = { ...Quiz.blank('Estimated'), questions: [placed, blank], widgetings: widgetingsOf(['cats', 'categories'], ['loved', 'loved_by'], ['remark', 'remarks']) }
  const library = [
    Widget.fill({ label: 'categories', formulary: 'entry', config: { entry_kind: 'estimates' } }),
    jsonataWidget('loved_by', "qn.cats.artie > qn.cats.masie ? 'Artie' : 'Masie'"),
    Widget.fill({ label: 'remarks', formulary: 'entry', config: { entry_kind: 'text' } }),
  ]
  const run = runOf(quiz, library)

  it('are projected from the estimates typed, as any entry is', () => {
    expect(Runner.widgetedOf(run, 'cats', placed._id)).to.deep.eq(Widgeted.ok([{ category: 'art', difficulty: 'easy' }]))
    expect(Runner.widgetedOf(run, 'cats', blank._id)).to.deep.eq(Widgeted.missing)
  })

  it("offer each persona's chance and their average as parts, read against the hunt's total order", () => {
    const parts = (['masie', 'artie', 'poppy', 'average'] as const).map((part) => Runner.widgetedOf(run, 'cats', placed._id, part).value)
    expect(parts.map((chance) => Number(chance).toFixed(2))).to.deep.eq(['0.69', '0.90', '0.69', '0.76'])
  })

  it('offer the estimates as a part, a cell nobody filled in drawing on no category in particular, at medium', () => {
    expect(Runner.widgetedOf(run, 'cats', placed._id, 'estimates')).to.deep.eq(Widgeted.ok([{ category: 'art', difficulty: 'easy' }]))
    expect(Runner.widgetedOf(run, 'cats', blank._id, 'estimates')).to.deep.eq(Widgeted.ok([{ category: null, difficulty: 'medium' }]))
    expect(Runner.widgetedOf(run, 'cats', blank._id, 'poppy')).to.deep.eq(Widgeted.ok(0.525))
  })

  it('carry their parts in the bag beside status and value, so a later formula reads them', () => {
    expect(Runner.widgetedOf(run, 'loved', placed._id)).to.deep.eq(Widgeted.ok('Artie'))
    const [bagged] = Runner.bagsAt(run, { label: 'remark', params: {} }).get(placed._id)?.qns ?? []
    expect(bagged?.cats).to.deep.include({ status: 'ok', estimates: [{ category: 'art', difficulty: 'easy' }], artie: 0.9 })
  })

  it('have no parts for any other widgeting to give', () => {
    expect(Runner.widgetedOf(run, 'remark', placed._id, 'masie')).to.deep.eq(Widgeted.missing)
    expect(run.parts.has('remark')).to.be.false
    const [bagged] = Runner.bagsAt(run, { label: 'remark', params: {} }).get(placed._id)?.qns ?? []
    expect(bagged?.loved).to.deep.eq(Widgeted.ok('Artie'))
  })

  it('follow the wheel: whoever sits beside a category knows it best', () => {
    const wheel = Wheel.placed(Wheel.defaultWheel(), 'art', 0)
    const rearranged = runOf(quiz, library, Runner.placeOf({ label: 'deep_lake', title: '', wheel }, { label: 'home', title: '' }))
    expect(Runner.widgetedOf(rearranged, 'cats', placed._id, 'masie')).to.deep.eq(Widgeted.ok(0.9))
    expect(Runner.widgetedOf(rearranged, 'loved', placed._id)).to.deep.eq(Widgeted.ok('Masie'))
  })
})

describe('sourceOf', () => {
  const recorded = loneQuestion({ stored: { asked: answered('hi') } })
  const blank = loneQuestion({})
  const widget = Widget.fill({ label: 'asker', formulary: 'aibot', formula: 'Say {{clueing}}', config: { servicelabel: 'claude', model_tier: 'quick', max_tokens: 10 } })
  const quiz = { ...Quiz.blank('Sourced'), questions: [recorded, blank], widgetings: widgetingsOf(['asked', 'asker'], ['orphan', 'nobody']) }
  const source = Runner.sourceOf(quiz, [widget, jsonataWidget('unworked', '1')], Here)

  it('pairs each widgeting, in run order, with the library widget it names, or null when the library holds none', () => {
    expect(source.steps.map((step) => [step.widgeting.label, step.widget?.label ?? null])).to.deep.eq([['asked', 'asker'], ['orphan', null]])
  })

  it('carries the quiz and its place as given', () => {
    expect(source.quiz).to.eq(quiz)
    expect(source.place).to.eq(Here)
  })

  it("reads a widgeting's history from what each question stored under its label, or null", () => {
    const [asked, orphan] = quiz.widgetings
    expect(source.storedOf(present(asked), recorded)).to.deep.eq(answered('hi'))
    expect(source.storedOf(present(asked), blank)).to.be.null
    expect(source.storedOf(present(orphan), recorded)).to.be.null
  })

  it('is what a run reads its widgeteds from', () => {
    const run = Runner.runQuiz(source)
    expect(Runner.widgetedOf(run, 'asked', recorded._id)).to.deep.eq(Widgeted.ok('hi'))
    expect(Runner.widgetedOf(run, 'orphan', recorded._id)).to.deep.eq(failed('There is no widget called "nobody" any more'))
  })
})

describe('runQuiz, from a source of its own', () => {
  const question = loneQuestion({})
  const widgeting: WidgetingT = { label: 'asked', widget_label: 'asker', description: '', params: { tone: 'dry' }, tier: 'question' }
  const widget: WidgetT = { scope: 'pub', formulary: 'aibot', label: 'asker', title: '', description: '', formula: 'Say {{tone}}', input_formula: "{ 'tone': params.tone }", config: { servicelabel: 'claude', model_tier: 'quick', max_tokens: 10 } }
  const source = (stored: Runner.RunSource['storedOf']): Runner.RunSource => ({ quiz: { ...Quiz.blank(), questions: [question] }, place: Here, steps: [{ widgeting, widget }], storedOf: stored, quizStoredOf: () => null })

  it("reads each stored widgeting's history through the source, and hands the input its params", () => {
    const run = Runner.runQuiz(source(() => answered('hi')))
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
    [null,                                                               Widgeted.missing,        'no row is missing'],
    [answered(42),                                                       Widgeted.ok(42),         'the newest ok row is the value'],
    [{ newest: storedRow('errored', 7), ok: storedRow('ok', 3, 42) },    Widgeted.ok(42, Err),    'a newer errored row rides along as err, never replacing the value'],
    [{ newest: storedRow('errored', 7), ok: null },                      Widgeted.errored(Err),   'only errored rows make the cell errored, the failure in whole milliseconds'],
    [answered(null),                                                     Widgeted.ok(null),       'an ok row whose value is null is still ok'],
  ]
  for (const [history, expected, blurb] of Cases) {
    it(blurb, () => {
      expect(Runner.widgetedFrom(history)).to.deep.eq(expected)
    })
  }

  it('carries an errored row with no response as a failure with none', () => {
    const row = { ...storedRow('errored', 7), result_meta: {} }
    expect(Runner.widgetedFrom({ newest: row, ok: null })).to.deep.eq(Widgeted.errored({ ...Err, response: null }))
  })
})

describe('bagsAt', () => {
  const target = { ...Question.blank(), qnum: '2', title: 'The film', label: 'the_film' }
  const question = { ...Question.blank(), qnum: '1', title: 'The book', chains_to: target._id }
  const quiz = { ...Quiz.blank('Bag'), label: 'my_quiz', questions: [question, target] }
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

  it('leaves the quiz\'s own questions, widgetings and columns out of `quiz`', () => {
    expect(bag.quiz).to.not.have.any.keys('questions', 'widgetings', 'columns')
    expect(bag.quiz).to.include({ title: 'Bag', label: 'my_quiz' })
  })

  it('gives each question its rank, and null to one with no Q#', () => {
    const unranked = { ...Question.blank(), qnum: '' }
    const ranked = Runner.bagsAt(runOf({ ...quiz, questions: [target, question, unranked] }), { label: 'col', params: {} })
    expect(ranked.values().map((each) => each.qn.rank).toArray()).to.deep.eq([2, 1, null])
  })

  it("holds a number spotter's widgeted where a sum reads it", () => {
    const spotted = loneQuestion({ stored: { numnum_clueing: extracted([numeral('3', 3)]) } })
    const run = runOf(standardQuiz([spotted]))
    const seen = present(Runner.bagsAt(run, { label: 'clueing_full', params: {} }).get(spotted._id))
    expect(seen.qn.numnum_clueing).to.deep.eq(Widgeted.ok({ items: [numeral('3', 3)] }))
  })
})

describe('what a bag exposes of a question', () => {
  const recorded = {
    ...Question.blank(), qnum: '1', title: 'Leon', label: 'leon_q',
    stored: { dumdum: { newest: storedRow('errored', 9), ok: storedRow('ok', 5, { guess: 'Lyon', explanation: '' }) } },
  }
  const quiz = { ...Quiz.blank('Bag'), label: 'my_quiz', locked: true, questions: [recorded], widgetings: widgetingsOf(['dumdum', 'dumdum']) }
  const { qn, quiz: quizBag, hunt, realm } = present(Runner.bagsAt(runOf(quiz), { label: 'col', params: {} }).get(recorded._id))

  it('gives a question only its exposed fields, with the label in force and the rank, and each earlier widgeting under its label', () => {
    expect(Object.keys(qn).toSorted(byText)).to.deep.eq([...Question.exposed, 'dumdum', 'rank'].toSorted(byText))
  })

  it('shows an earlier widgeting as its widgeted whole: its status, its value, and a failure riding along', () => {
    expect(qn.dumdum).to.deep.eq(Widgeted.ok({ guess: 'Lyon', explanation: '' }, { message: 'Too many requests.', at: 9, response: { ok: false } }))
  })

  it("gives the quiz only its label, smith's note and title, and the hunt and realm their labels and titles", () => {
    expect(quizBag).to.deep.eq({ label: 'my_quiz', smiths_note: '', title: 'Bag' })
    expect([hunt, realm]).to.deep.eq([{ label: 'deep_lake', title: 'Deep Lake' }, { label: 'home', title: 'Home' }])
  })
})

describe('placeOf', () => {
  const DefaultOrder = Wheel.orderOf(Wheel.defaultWheel())
  const Cases: [Parameters<typeof Runner.placeOf>, Omit<Runner.QuizPlace, 'order'>, string][] = [
    [[{ label: 'deep_lake', title: '' },          { label: 'home',   title: '' }],
      { hunt: { label: 'deep_lake', title: 'Deep Lake' },  realm: { label: 'home',   title: 'Home' } },          'blank titles read as the labels titleized'],
    [[{ label: 'tarn',      title: 'Lakeside' },  { label: 'finals', title: 'The Finals' }],
      { hunt: { label: 'tarn',      title: 'Lakeside' },   realm: { label: 'finals', title: 'The Finals' } },    'titles of their own are kept as they are'],
  ]
  for (const [[hunt, realm], expected, blurb] of Cases) {
    it(blurb, () => {
      expect(Runner.placeOf(hunt, realm)).to.deep.eq({ ...expected, order: DefaultOrder })
    })
  }

  it('leaves out everything a hunt or realm holds besides its exposed fields', () => {
    const hunt = { _id: 'hunt_id', label: 'deep_lake', title: 'Deep Lake', realms: [] }
    const realm = { _id: 'realm_id', label: 'home', title: 'Home', quizzes: [] }
    expect(Runner.placeOf(hunt, realm)).to.deep.eq({ hunt: { label: 'deep_lake', title: 'Deep Lake' }, realm: { label: 'home', title: 'Home' }, order: DefaultOrder })
  })

  it("reads the hunt's categories in the total order of its wheel, holes filled from the pool", () => {
    const wheel = Wheel.placed(Wheel.placed(Wheel.defaultWheel(), 'theater', 0), 'tv', 'pool')
    const { order } = Runner.placeOf({ label: 'deep_lake', title: '', wheel }, { label: 'home', title: '' })
    expect([order[0], order[12], order[15], order.length]).to.deep.eq(['theater', 'math_econ', 'tv', 24])
  })
})
