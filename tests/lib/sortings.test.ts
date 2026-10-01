import { describe, expect, it } from 'vitest'
import * as Sortings from '../../src/lib/sortings'
import { Column } from '../../src/models/column'
import { defaultLayout } from '../../src/models/layout'
import { Question, type QuestionT } from '../../src/models/question'
import { Quiz, type QuizT, type Sortkey } from '../../src/models/quiz'
import { Widgeted, type JsonT, type WidgetedHistoryT, type WidgetedT } from '../../src/models/widgeted'
import { Widgeting } from '../../src/models/widgeting'
import { runHolding, runOf } from '../support/runs'
import { present } from '../support/present'

/** A quiz built from `qnum, title` pairs, in the order given */
function questionsOf(...pairs: [string, string][]): QuestionT[] {
  return pairs.map(([qnum, title]) => ({ ...Question.blank(), qnum, title }))
}

/** How a column reads a question, in a quiz whose widgetings came to nothing */
const readerFor = (sortkey: Sortkey, quiz: Pick<QuizT, 'questions' | 'columns' | 'widgetings'>) => Sortings.sortValueFor(sortkey, quiz, runHolding(quiz, {}))

const answers = (questions: QuestionT[]) => questions.map((question) => question.title)

const byAnswer = (question: QuestionT) => question.title
const byQnumOrNull = (question: QuestionT) => (question.qnum === '' ? null : Number(question.qnum))

describe('sortQuestions', () => {
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
const quizOf = (questions: QuestionT[]) => ({ questions, ...defaultLayout() })

/** A quiz of `questions` with one column, `size`, showing a widgeting of that label */
const sizedQuiz = (questions: QuestionT[]) => ({
  questions,
  widgetings: [Widgeting.fill({ label: 'size', widget_label: 'size' })],
  columns: [Column.fill({ label: 'size', title: 'Size', source: 'size', width_px: 78 })],
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

  it('reads a stored widgeting\'s column as what was recorded, an object by its JSON, sinking one never asked', () => {
    const [aa, bb, cc] = questionsOf(['1', 'a'], ['2', 'b'], ['3', 'c'])
    const questions = [
      { ...present(aa), stored: { dumdum: answered({ guess: 'Zurich', explanation: '' }) } },
      present(bb),
      { ...present(cc), stored: { dumdum: answered({ guess: 'Avignon', explanation: '' }) } },
    ]
    const quiz = { ...Quiz.blank(), ...quizOf(questions) }
    const sorted = Sortings.sortQuestions(questions, Sortings.sortValueFor('column:guess', quiz, runOf(quiz)), false)
    expect(answers(sorted)).to.deep.eq(['c', 'a', 'b'])
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
    [Widgeted.ok({ b: 1, a: 2 }),    '{"a":2,"b":1}',  'any other value sorts as its JSON'],
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
