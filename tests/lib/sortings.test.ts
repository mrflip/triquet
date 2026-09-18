import { describe, expect, it } from 'vitest'
import { sortQuestions, sortValueFor } from '../../src/lib/sortings'
import { Question, type QuestionT } from '../../src/models/question'
import { present } from '../support/present'

/** A round built from `qnum, short_answer` pairs, in the order given */
function roundOf(...pairs: [string, string][]): QuestionT[] {
  return pairs.map(([qnum, short_answer]) => ({ ...Question.blank(), qnum, short_answer }))
}

const answers = (questions: QuestionT[]) => questions.map((question) => question.short_answer)

const byAnswer = (question: QuestionT) => question.short_answer
const byQnumOrNull = (question: QuestionT) => (question.qnum === '' ? null : Number(question.qnum))

describe('sortQuestions', () => {
  it('orders by what the column reads', () => {
    const questions = roundOf(['', 'cherry'], ['', 'apple'], ['', 'banana'])
    expect(answers(sortQuestions(questions, byAnswer, false))).to.deep.eq(['apple', 'banana', 'cherry'])
  })

  it('reverses when asked', () => {
    const questions = roundOf(['', 'cherry'], ['', 'apple'], ['', 'banana'])
    expect(answers(sortQuestions(questions, byAnswer, true))).to.deep.eq(['cherry', 'banana', 'apple'])
  })

  it('sinks the questions with no value to the bottom, ascending', () => {
    const questions = roundOf(['', 'cherry'], ['', ''], ['', 'apple'])
    expect(answers(sortQuestions(questions, byAnswer, false))).to.deep.eq(['apple', 'cherry', ''])
  })

  it('sinks them to the bottom descending too -- an absence is not a small value', () => {
    const questions = roundOf(['', 'cherry'], ['', ''], ['', 'apple'])
    expect(answers(sortQuestions(questions, byAnswer, true))).to.deep.eq(['cherry', 'apple', ''])
  })

  it('treats a null reading the same as an empty one', () => {
    const questions = roundOf(['3', 'c'], ['', 'blank'], ['1', 'a'])
    expect(answers(sortQuestions(questions, byQnumOrNull, false))).to.deep.eq(['a', 'c', 'blank'])
  })

  it('settles ties by where the questions already sit', () => {
    const questions = roundOf(['', 'same'], ['', 'SAME'], ['', 'same'])
    const sorted = sortQuestions(questions, byAnswer, false)
    expect(sorted.map((question) => question.id)).to.deep.eq(questions.map((question) => question.id))
  })

  it('sorts text case-insensitively', () => {
    const questions = roundOf(['', 'Banana'], ['', 'apple'], ['', 'Cherry'])
    expect(answers(sortQuestions(questions, byAnswer, false))).to.deep.eq(['apple', 'Banana', 'Cherry'])
  })

  it('sorts numbers numerically, not as text', () => {
    const questions = roundOf(['9', 'nine'], ['10', 'ten'], ['2', 'two'])
    expect(answers(sortQuestions(questions, byQnumOrNull, false))).to.deep.eq(['two', 'nine', 'ten'])
  })

  it('leaves the round it was given alone', () => {
    const questions = roundOf(['', 'b'], ['', 'a'])
    sortQuestions(questions, byAnswer, false)
    expect(answers(questions)).to.deep.eq(['b', 'a'])
  })

  it('reads an empty round without complaint', () => {
    expect(sortQuestions([], byAnswer, false)).to.deep.eq([])
  })
})

describe('sortValueFor', () => {
  it('reads Q# as a number, so 10 sorts after 9', () => {
    const questions = roundOf(['9', 'nine'], ['10', 'ten'])
    const sorted = sortQuestions(questions, sortValueFor('qnum', questions), false)
    expect(answers(sorted)).to.deep.eq(['nine', 'ten'])
  })

  it('reads a chain as the label the author sees: the target\'s short answer', () => {
    const questions = roundOf(['', 'aardvark'], ['', 'zebra'], ['', 'moose'])
    const [aardvark, zebra, moose] = questions.map((question) => present(question))
    const chained = [
      { ...present(aardvark), chains_to: present(zebra).id },
      { ...present(zebra), chains_to: present(moose).id },
      present(moose),
    ]
    const sorted = sortQuestions(chained, sortValueFor('chains_to', chained), false)
    expect(answers(sorted)).to.deep.eq(['zebra', 'aardvark', 'moose'])
  })

  it('reads an unchained question as having no value, so it sinks', () => {
    const questions = roundOf(['', 'a'], ['', 'b'])
    const [first, second] = questions.map((question) => present(question))
    const chained = [present(first), { ...present(second), chains_to: present(first).id }]
    const sorted = sortQuestions(chained, sortValueFor('chains_to', chained), false)
    expect(answers(sorted)).to.deep.eq(['b', 'a'])
  })

  it('reads a column M5 has yet to fill as having nothing to say, leaving the order alone', () => {
    const questions = roundOf(['1', 'a'], ['2', 'b'], ['3', 'c'])
    const sorted = sortQuestions(questions, sortValueFor('clueing_full', questions), false)
    expect(answers(sorted)).to.deep.eq(['a', 'b', 'c'])
  })
})
