import { describe, expect, it } from 'vitest'
import * as Sortings from '../../src/lib/sortings'
import { Column } from '../../src/models/column'
import { defaultLayoutFor } from '../../src/models/layout'
import { SeedExpressions } from '../../src/models/expression'
import { Expressing } from '../../src/models/widget'
import { Question, type QuestionT } from '../../src/models/question'
import type { Expressed, ExpressedForQuiz } from '../../src/lib/expressed'
import { present } from '../support/present'

/** A quiz built from `qnum, title` pairs, in the order given */
function questionsOf(...pairs: [string, string][]): QuestionT[] {
  return pairs.map(([qnum, title]) => ({ ...Question.blank(), qnum, title }))
}

const NoneExpressed: ExpressedForQuiz = new Map()

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

/** A finished extraction that found `count` spans */
const found = (count: number) => ({ status: 'done' as const, items: Array.from({ length: count }, () => ({ text: '1', value: 1, kind: 'numeral' as const })), truncated: false, stale: false, updated_at: 1, last_err: null })

/** A quiz of `questions` with the standard widgets and columns */
const quizOf = (questions: QuestionT[]) => ({ questions, ...defaultLayoutFor(SeedExpressions) })

/** A quiz of `questions` with one column, `size`, showing an expressing widget of that label */
const sizedQuiz = (questions: QuestionT[]) => ({
  questions,
  widgets: [Expressing.fill({ kind: 'expressing', label: 'size', expression_label: 'size' })],
  columns: [Column.fill({ label: 'size', title: 'Size', source: 'size', width_px: 78 })],
})

describe('sortValueFor', () => {
  it('reads a column that cannot be ordered -- one that holds prose -- as having nothing to say', () => {
    const questions = questionsOf(['1', 'a'], ['2', 'b'])
    const sorted = Sortings.sortQuestions(questions, Sortings.sortValueFor('column:clueing', quizOf(questions), NoneExpressed), false)
    expect(answers(sorted)).to.deep.eq(['a', 'b'])
  })

  it('reads a bot\'s extraction column as how many spans it found', () => {
    const [aa, bb] = questionsOf(['1', 'a'], ['2', 'b'])
    const questions = [{ ...present(aa), clueing_ishes: found(3) }, { ...present(bb), clueing_ishes: found(1) }]
    const sorted = Sortings.sortQuestions(questions, Sortings.sortValueFor('column:clueing_ishes', quizOf(questions), NoneExpressed), false)
    expect(answers(sorted)).to.deep.eq(['b', 'a'])
  })

  it('reads Q# as a number, so 10 sorts after 9', () => {
    const questions = questionsOf(['9', 'nine'], ['10', 'ten'])
    const sorted = Sortings.sortQuestions(questions, Sortings.sortValueFor('column:qnum', quizOf(questions), NoneExpressed), false)
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
    const sorted = Sortings.sortQuestions(chained, Sortings.sortValueFor('column:chains_to', quizOf(chained), NoneExpressed), false)
    expect(answers(sorted)).to.deep.eq(['zebra', 'aardvark', 'moose'])
  })

  it('reads an unchained question as having no value, so it sinks', () => {
    const questions = questionsOf(['', 'a'], ['', 'b'])
    const [first, second] = questions.map((question) => present(question))
    const chained = [present(first), { ...present(second), chains_to: present(first)._id }]
    const sorted = Sortings.sortQuestions(chained, Sortings.sortValueFor('column:chains_to', quizOf(chained), NoneExpressed), false)
    expect(answers(sorted)).to.deep.eq(['b', 'a'])
  })

  it('reads a computed column as what it came to for each question', () => {
    const questions = questionsOf(['1', 'a'], ['2', 'b'], ['3', 'c'])
    const [aa, bb, cc] = questions.map((question) => present(question))
    const expressed = new Map([['size', new Map<string, Expressed>([
      [present(aa)._id, { status: 'value', val: 30, stale: false }],
      [present(bb)._id, { status: 'value', val: 4, stale: false }],
      [present(cc)._id, { status: 'value', val: 200, stale: false }],
    ])]])
    const sorted = Sortings.sortQuestions(questions, Sortings.sortValueFor('column:size', sizedQuiz(questions), expressed), false)
    expect(answers(sorted)).to.deep.eq(['b', 'a', 'c'])
  })

  it('sinks a question a computed column has nothing for, or failed on, in either direction', () => {
    const questions = questionsOf(['1', 'a'], ['2', 'b'], ['3', 'c'])
    const [aa, bb, cc] = questions.map((question) => present(question))
    const expressed = new Map([['size', new Map<string, Expressed>([
      [present(aa)._id, { status: 'nothing' }],
      [present(bb)._id, { status: 'value', val: 4, stale: false }],
      [present(cc)._id, { status: 'error', message: 'nope' }],
    ])]])
    for (const descending of [false, true]) {
      const sorted = Sortings.sortQuestions(questions, Sortings.sortValueFor('column:size', sizedQuiz(questions), expressed), descending)
      expect(answers(sorted)[0]).to.eq('b')
    }
  })

  it('reads a column the quiz does not have as having nothing to say, leaving the order alone', () => {
    const questions = questionsOf(['1', 'a'], ['2', 'b'], ['3', 'c'])
    const sorted = Sortings.sortQuestions(questions, Sortings.sortValueFor('column:gone', quizOf(questions), NoneExpressed), false)
    expect(answers(sorted)).to.deep.eq(['a', 'b', 'c'])
  })
})
