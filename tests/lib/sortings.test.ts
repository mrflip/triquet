import { describe, expect, it } from 'vitest'
import * as Sortings from '../../src/lib/sortings'
import { Column } from '../../src/models/column'
import { classicLayout } from '../support/layouts'
import { Question, type QuestionT } from '../../src/models/question'
import { Quiz, type QuizT, type Sortkey } from '../../src/models/quiz'
import { Widgeted, type JsonT, type WidgetedHistoryT, type WidgetedT } from '../../src/models/widgeted'
import { Widgeting } from '../../src/models/widgeting'
import { Widget } from '../../src/models/widget'
import { runHolding, runOf } from '../support/runs'
import { present } from '../support/present'

/** A quiz built from `qnum, title` pairs, in the order given */
function questionsOf(...pairs: [string, string][]): QuestionT[] {
  return pairs.map(([qnum, title]) => ({ ...Question.blank(), qnum, title }))
}

/** A cell whose one row holds `value`, as an entry's does */
function typed(value: JsonT): WidgetedHistoryT {
  const row = { status: 'ok' as const, value, message: null, result_meta: {}, _creationTime: 1 }
  return { newest: row, ok: row }
}

/** How a column reads a question, in a quiz whose widgetings came to nothing */
const readerFor = (sortkey: Sortkey, quiz: Pick<QuizT, 'questions' | 'columns' | 'widgetings'>) => Sortings.sortValueFor(sortkey, { ...quiz, templateable: [] }, runHolding(quiz, {}))

const answers = (questions: QuestionT[]) => questions.map((question) => question.title)

const byAnswer = (question: QuestionT) => question.title
const byQnumOrNull = (question: QuestionT) => (question.qnum === '' ? null : Number(question.qnum))

describe('sortQuestions', () => {
  it('puts an alternate after its peers of the same value, and after its peers with none, before falling back on where they sit', () => {
    const questions = questionsOf(['', 'apple'], ['', 'apple'], ['', ''], ['', ''], ['', 'banana']).map((question, ii) => ({ ...question, label: `q${String(ii)}`, viz: ii % 2 === 0 ? 'secondary' as const : 'normal' as const }))
    expect(Sortings.sortQuestions(questions, byAnswer, false).map((question) => question.label)).to.deep.eq(['q1', 'q0', 'q4', 'q3', 'q2'])
  })

  it('orders by what the column reads', () => {
    const questions = questionsOf(['', 'cherry'], ['', 'apple'], ['', 'banana'])
    expect(answers(Sortings.sortQuestions(questions, byAnswer, false))).to.deep.eq(['apple', 'banana', 'cherry'])
  })

  it('reverses when asked', () => {
    const questions = questionsOf(['', 'cherry'], ['', 'apple'], ['', 'banana'])
    expect(answers(Sortings.sortQuestions(questions, byAnswer, true))).to.deep.eq(['cherry', 'banana', 'apple'])
  })

  it('sinks the questions with no value to the bottom, ascending', () => {
    const questions = questionsOf(['', 'cherry'], ['', ''], ['', 'apple'])
    expect(answers(Sortings.sortQuestions(questions, byAnswer, false))).to.deep.eq(['apple', 'cherry', ''])
  })

  it('sinks them to the bottom descending too -- an absence is not a small value', () => {
    const questions = questionsOf(['', 'cherry'], ['', ''], ['', 'apple'])
    expect(answers(Sortings.sortQuestions(questions, byAnswer, true))).to.deep.eq(['cherry', 'apple', ''])
  })

  it('treats a null reading the same as an empty one', () => {
    const questions = questionsOf(['3', 'c'], ['', 'blank'], ['1', 'a'])
    expect(answers(Sortings.sortQuestions(questions, byQnumOrNull, false))).to.deep.eq(['a', 'c', 'blank'])
  })

  it('settles ties by where the questions already sit', () => {
    const questions = questionsOf(['', 'same'], ['', 'SAME'], ['', 'same'])
    const sorted = Sortings.sortQuestions(questions, byAnswer, false)
    expect(sorted.map((question) => question._id)).to.deep.eq(questions.map((question) => question._id))
  })

  it('sorts text case-insensitively', () => {
    const questions = questionsOf(['', 'Banana'], ['', 'apple'], ['', 'Cherry'])
    expect(answers(Sortings.sortQuestions(questions, byAnswer, false))).to.deep.eq(['apple', 'Banana', 'Cherry'])
  })

  it('sorts numbers numerically, not as text', () => {
    const questions = questionsOf(['9', 'nine'], ['10', 'ten'], ['2', 'two'])
    expect(answers(Sortings.sortQuestions(questions, byQnumOrNull, false))).to.deep.eq(['two', 'nine', 'ten'])
  })

  it('leaves the quiz it was given alone', () => {
    const questions = questionsOf(['', 'b'], ['', 'a'])
    Sortings.sortQuestions(questions, byAnswer, false)
    expect(answers(questions)).to.deep.eq(['b', 'a'])
  })

  it('reads an empty quiz without complaint', () => {
    expect(Sortings.sortQuestions([], byAnswer, false)).to.deep.eq([])
  })
})

/** A cell whose newest row, and newest `ok` row, both hold `value` */
function answered(value: JsonT): WidgetedHistoryT {
  const row = { status: 'ok' as const, value, message: null, result_meta: {}, _creationTime: 1000 }
  return { newest: row, ok: row }
}

/** A quiz of `questions` with the standard widgetings and columns */
const quizOf = (questions: QuestionT[]) => ({ questions, ...classicLayout() })

/** A quiz of `questions` with one column, `size`, showing a widgeting of that label */
const sizedQuiz = (questions: QuestionT[]) => ({
  questions,
  widgetings: [Widgeting.fill({ label: 'size', widget_label: 'size' })],
  columns: [Column.fill({ label: 'size', title: 'Size', source: 'size', width_px: 78 })],
  templateable: [],
})

describe('sortedIdsOf', () => {
  it("is every question's id, every one, in the order the sort puts them, for the browser to hand the server", () => {
    const questions = questionsOf(['3', 'c'], ['1', 'a'], ['2', 'b'])
    const quiz = { ...quizOf(questions), templateable: [] }
    const ids = (descending: boolean) => Sortings.sortedIdsOf('column:qnum', quiz, runHolding(quiz, {}), descending)
    expect(ids(false)).to.deep.eq([1, 2, 0].map((idx) => present(questions[idx])._id))
    expect(ids(true)).to.deep.eq([0, 2, 1].map((idx) => present(questions[idx])._id))
  })
})

describe('sortValueFor', () => {
  it('reads a column that cannot be ordered -- one that holds prose -- as having nothing to say', () => {
    const questions = questionsOf(['1', 'a'], ['2', 'b'])
    const sorted = Sortings.sortQuestions(questions, readerFor('column:clueing', quizOf(questions)), false)
    expect(answers(sorted)).to.deep.eq(['a', 'b'])
  })

  it('reads a view of the question -- the chained hint -- as having nothing to say', () => {
    const questions = questionsOf(['2', 'b'], ['1', 'a'])
    const sorted = Sortings.sortQuestions(questions, readerFor('column:butnot', quizOf(questions)), false)
    expect(answers(sorted)).to.deep.eq(['b', 'a'])
  })

  it('reads a stored widgeting\'s column as what was recorded, a list of spans by how many, sinking one never asked', () => {
    const [aa, bb, cc] = questionsOf(['1', 'a'], ['2', 'b'], ['3', 'c'])
    const span = { text: '30', value: 30, kind: 'numeral' }
    const questions = [
      { ...present(aa), stored: { numnum_clueing: answered({ items: [span, span] }) } },
      present(bb),
      { ...present(cc), stored: { numnum_clueing: answered({ items: [] }) } },
    ]
    const quiz = { ...Quiz.blank(), ...quizOf(questions) }
    const sorted = Sortings.sortQuestions(questions, Sortings.sortValueFor('column:clueing_ishes', quiz, runOf(quiz)), false)
    expect(answers(sorted)).to.deep.eq(['c', 'a', 'b'])
  })

  it('reads an object of several keys as having nothing to say, leaving the order alone', () => {
    const [aa, bb] = questionsOf(['1', 'a'], ['2', 'b'])
    const questions = [
      { ...present(aa), stored: { dumdum: answered({ guess: 'Zurich', explanation: '' }) } },
      { ...present(bb), stored: { dumdum: answered({ guess: 'Avignon', explanation: '' }) } },
    ]
    const quiz = { ...Quiz.blank(), ...quizOf(questions) }
    const sorted = Sortings.sortQuestions(questions, Sortings.sortValueFor('column:guess', quiz, runOf(quiz)), false)
    expect(answers(sorted)).to.deep.eq(['a', 'b'])
  })

  it('reads a sum worked out from a stored widgeting as its number', () => {
    const [aa, bb] = questionsOf(['1', 'a'], ['2', 'b'])
    const questions = [
      { ...present(aa), stored: { numnum_clueing: answered({ items: [{ text: '30', value: 30, kind: 'numeral' }] }) } },
      { ...present(bb), stored: { numnum_clueing: answered({ items: [{ text: '4', value: 4, kind: 'numeral' }] }) } },
    ]
    const quiz = { ...Quiz.blank(), ...quizOf(questions) }
    const sorted = Sortings.sortQuestions(questions, Sortings.sortValueFor('column:clueing_full', quiz, runOf(quiz)), false)
    expect(answers(sorted)).to.deep.eq(['b', 'a'])
  })

  it('reads Q# as a number, so 10 sorts after 9', () => {
    const questions = questionsOf(['9', 'nine'], ['10', 'ten'])
    const sorted = Sortings.sortQuestions(questions, readerFor('column:qnum', quizOf(questions)), false)
    expect(answers(sorted)).to.deep.eq(['nine', 'ten'])
  })

  it('reads a chain as the label the author sees: the target\'s title', () => {
    const questions = questionsOf(['', 'aardvark'], ['', 'zebra'], ['', 'moose'])
    const [aardvark, zebra, moose] = questions.map((question) => present(question))
    const chained = [
      { ...present(aardvark), chains_to: present(zebra)._id },
      { ...present(zebra), chains_to: present(moose)._id },
      present(moose),
    ]
    const sorted = Sortings.sortQuestions(chained, readerFor('column:chains_to', quizOf(chained)), false)
    expect(answers(sorted)).to.deep.eq(['zebra', 'aardvark', 'moose'])
  })

  it('reads an unchained question as having no value, so it sinks', () => {
    const questions = questionsOf(['', 'a'], ['', 'b'])
    const [first, second] = questions.map((question) => present(question))
    const chained = [present(first), { ...present(second), chains_to: present(first)._id }]
    const sorted = Sortings.sortQuestions(chained, readerFor('column:chains_to', quizOf(chained)), false)
    expect(answers(sorted)).to.deep.eq(['b', 'a'])
  })

  it('reads a widgeting column as what it came to for each question', () => {
    const questions = questionsOf(['1', 'a'], ['2', 'b'], ['3', 'c'])
    const [aa, bb, cc] = questions.map((question) => present(question))
    const run = runHolding(sizedQuiz(questions), { size: { [present(aa)._id]: Widgeted.ok(30), [present(bb)._id]: Widgeted.ok(4), [present(cc)._id]: Widgeted.ok(200) } })
    const sorted = Sortings.sortQuestions(questions, Sortings.sortValueFor('column:size', sizedQuiz(questions), run), false)
    expect(answers(sorted)).to.deep.eq(['b', 'a', 'c'])
  })

  it('sinks a question a widgeting column has nothing for, or failed on, in either direction', () => {
    const questions = questionsOf(['1', 'a'], ['2', 'b'], ['3', 'c'])
    const [aa, bb, cc] = questions.map((question) => present(question))
    const run = runHolding(sizedQuiz(questions), { size: { [present(aa)._id]: Widgeted.missing, [present(bb)._id]: Widgeted.ok(4), [present(cc)._id]: Widgeted.errored({ message: 'nope', at: null, response: null }) } })
    for (const descending of [false, true]) {
      const sorted = Sortings.sortQuestions(questions, Sortings.sortValueFor('column:size', sizedQuiz(questions), run), descending)
      expect(answers(sorted)[0]).to.eq('b')
    }
  })

  it("reads a column showing a persona's chance as that chance, worked out from the estimates typed, a cell nobody typed into at no category in particular", () => {
    const [art, math, blank] = questionsOf(['1', 'art'], ['2', 'math'], ['3', 'blank']).map((question) => present(question))
    const questions = [
      { ...present(art), stored: { cats: typed([{ category: 'art', difficulty: 'medium' }]) } },
      { ...present(math), stored: { cats: typed([{ category: 'math_econ', difficulty: 'medium' }]) } },
      present(blank),
    ]
    const quiz = { ...Quiz.blank(), questions, widgetings: [Widgeting.fill({ label: 'cats', widget_label: 'categories' })], columns: [Column.fill({ label: 'masie', title: 'Masie', source: 'cats', formula: '$.masie', width_px: 60 })] }
    const run = runOf(quiz, [Widget.fill({ label: 'categories', formulary: 'entry', config: { entry_kind: 'estimates' } })])
    const sorted = Sortings.sortQuestions(questions, Sortings.sortValueFor('column:masie', quiz, run), true)
    expect(answers(sorted)).to.deep.eq(['math', 'blank', 'art'])
    const before = { ...quiz, columns: [Column.fill({ label: 'masie', title: 'Masie', source: 'cats.masie', width_px: 60 })] }
    const sortedBefore = Sortings.sortQuestions(questions, Sortings.sortValueFor('column:masie', before, run), true)
    expect(answers(sortedBefore)).to.deep.eq(['math', 'blank', 'art'])
  })

  it("reads what a column came to, never the text its template dresses it in: 9% sorts before 10%", () => {
    const questions = questionsOf(['1', 'a'], ['2', 'b'])
    const [aa, bb] = questions
    const quiz = { ...sizedQuiz(questions), columns: [Column.fill({ label: 'size', title: 'Size', source: 'size', template: '{{ value }}%', width_px: 78 })] }
    const run = runHolding(quiz, { size: { [present(aa)._id]: Widgeted.ok(10), [present(bb)._id]: Widgeted.ok(9) } })
    const sorted = Sortings.sortQuestions(questions, Sortings.sortValueFor('column:size', quiz, run), false)
    expect(answers(sorted)).to.deep.eq(['b', 'a'])
  })

  it('reads a column showing a widgeting the quiz does not have as having nothing to say', () => {
    const questions = questionsOf(['1', 'b'], ['2', 'a'])
    const quiz = { ...sizedQuiz(questions), widgetings: [] }
    const sorted = Sortings.sortQuestions(questions, readerFor('column:size', quiz), false)
    expect(answers(sorted)).to.deep.eq(['b', 'a'])
  })

  it('reads a column the quiz does not have as having nothing to say, leaving the order alone', () => {
    const questions = questionsOf(['1', 'a'], ['2', 'b'], ['3', 'c'])
    const sorted = Sortings.sortQuestions(questions, readerFor('column:gone', quizOf(questions)), false)
    expect(answers(sorted)).to.deep.eq(['a', 'b', 'c'])
  })
})

describe('sortValueOf', () => {
  const Failed = Widgeted.errored({ message: 'no', at: null, response: null })
  const Cases: [WidgetedT, Sortings.SortValue, string][] = [
    [Widgeted.ok(7),                 7,                'a number sorts as itself'],
    [Widgeted.ok('abc'),             'abc',            'text sorts as itself'],
    [Widgeted.ok(true),              1,                'a boolean sorts as 1'],
    [Widgeted.ok(false),             0,                'a boolean sorts as 0'],
    [Widgeted.ok([1, 2, 3]),         3,                'a list sorts by how many items it holds'],
    [Widgeted.ok([]),                0,                'an empty list is a real answer, and sorts as nought'],
    [Widgeted.ok({ items: [{}, {}] }), 2,              'an object of one key sorts as what it holds'],
    [Widgeted.ok({ guess: 'Leon' }), 'Leon',           'an object of one key holding text sorts as the text'],
    [Widgeted.ok({ b: 1, a: 2 }),    null,             'an object of several keys has no one value to sort by'],
    [Widgeted.ok({}),                null,             'an empty object has nothing to sort by'],
    [Widgeted.ok(null),              null,             'a null value has nothing to sort by'],
    [Widgeted.missing,               null,             'nothing has no value to sort by'],
    [Failed,                         null,             'a failure has no value to sort by'],
  ]
  for (const [widgeted, expected, blurb] of Cases) {
    it(blurb, () => {
      expect(Sortings.sortValueOf(widgeted)).to.eq(expected)
    })
  }
})
