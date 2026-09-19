import { describe, expect, it } from 'vitest'
import * as Sortings from '../../src/lib/sortings'
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
    expect(sorted.map((question) => question.id)).to.deep.eq(questions.map((question) => question.id))
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

describe('sortValueFor', () => {
  it('reads Q# as a number, so 10 sorts after 9', () => {
    const questions = questionsOf(['9', 'nine'], ['10', 'ten'])
    const sorted = Sortings.sortQuestions(questions, Sortings.sortValueFor('qnum', questions, NoneExpressed), false)
    expect(answers(sorted)).to.deep.eq(['nine', 'ten'])
  })

  it('reads a chain as the label the author sees: the target\'s title', () => {
    const questions = questionsOf(['', 'aardvark'], ['', 'zebra'], ['', 'moose'])
    const [aardvark, zebra, moose] = questions.map((question) => present(question))
    const chained = [
      { ...present(aardvark), chains_to: present(zebra).id },
      { ...present(zebra), chains_to: present(moose).id },
      present(moose),
    ]
    const sorted = Sortings.sortQuestions(chained, Sortings.sortValueFor('chains_to', chained, NoneExpressed), false)
    expect(answers(sorted)).to.deep.eq(['zebra', 'aardvark', 'moose'])
  })

  it('reads an unchained question as having no value, so it sinks', () => {
    const questions = questionsOf(['', 'a'], ['', 'b'])
    const [first, second] = questions.map((question) => present(question))
    const chained = [present(first), { ...present(second), chains_to: present(first).id }]
    const sorted = Sortings.sortQuestions(chained, Sortings.sortValueFor('chains_to', chained, NoneExpressed), false)
    expect(answers(sorted)).to.deep.eq(['b', 'a'])
  })

  it('reads a computed column as what it came to for each question', () => {
    const questions = questionsOf(['1', 'a'], ['2', 'b'], ['3', 'c'])
    const [aa, bb, cc] = questions.map((question) => present(question))
    const expressed = new Map([['size', new Map<string, Expressed>([
      [present(aa).id, { status: 'value', val: 30, stale: false }],
      [present(bb).id, { status: 'value', val: 4, stale: false }],
      [present(cc).id, { status: 'value', val: 200, stale: false }],
    ])]])
    const sorted = Sortings.sortQuestions(questions, Sortings.sortValueFor('expressing:size', questions, expressed), false)
    expect(answers(sorted)).to.deep.eq(['b', 'a', 'c'])
  })

  it('sinks a question a computed column has nothing for, or failed on, in either direction', () => {
    const questions = questionsOf(['1', 'a'], ['2', 'b'], ['3', 'c'])
    const [aa, bb, cc] = questions.map((question) => present(question))
    const expressed = new Map([['size', new Map<string, Expressed>([
      [present(aa).id, { status: 'nothing' }],
      [present(bb).id, { status: 'value', val: 4, stale: false }],
      [present(cc).id, { status: 'error', message: 'nope' }],
    ])]])
    for (const descending of [false, true]) {
      const sorted = Sortings.sortQuestions(questions, Sortings.sortValueFor('expressing:size', questions, expressed), descending)
      expect(answers(sorted)[0]).to.eq('b')
    }
  })

  it('reads a computed column the quiz no longer has as having nothing to say, leaving the order alone', () => {
    const questions = questionsOf(['1', 'a'], ['2', 'b'], ['3', 'c'])
    const sorted = Sortings.sortQuestions(questions, Sortings.sortValueFor('expressing:gone', questions, NoneExpressed), false)
    expect(answers(sorted)).to.deep.eq(['a', 'b', 'c'])
  })
})
