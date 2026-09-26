import { describe, expect, it } from 'vitest'
import * as Chain from '../../src/lib/chain'
import { Question, type QuestionT } from '../../src/models/question'
import { present } from '../support/present'

/**
 * A quiz from `qnum, title, chains_to` triples, where `chains_to` names another
 * question by its title.
 */
function questionsOf(...triples: [string, string, string | null][]): QuestionT[] {
  const bare = triples.map(([qnum, title]) => ({ ...Question.blank(), qnum, title }))
  const idForAnswer = new Map(bare.map((question) => [question.title, question.id]))
  return bare.map((question, idx) => ({
    ...question,
    chains_to: idForAnswer.get(present(triples[idx])[2] ?? '') ?? null,
  }))
}

const answers = (questions: QuestionT[]) => questions.map((question) => question.title)

const SnippetCases: [string, string, string][] = [
  // regular usage:
  ["Short enough",  "Short enough",  'text under the cap comes back whole'],
  ["BUT NOT the titular role in an internationally successful 1994 French film", "BUT NOT the titular role in an internationally…", 'long text is cut at a word boundary and gains an ellipsis'],
  // trivial cases:
  ["",              "",              'empty text stays empty'],
  ["   padded   ",  "padded",        'surrounding whitespace is trimmed away'],
  // weird cases:
  ["a".repeat(80),  "a".repeat(50) + "…",  'a single unbroken word is cut mid-word rather than vanishing'],
  ["x".repeat(50),  "x".repeat(50),  'text exactly at the cap is not cut'],
]

describe('chainSnippet', () => {
  for (const [text, expected, blurb] of SnippetCases) {
    it(blurb, () => {
      expect(Chain.chainSnippet(text)).to.eq(expected)
    })
  }
})

describe('clearDanglingChains', () => {
  it('leaves a sound chain alone', () => {
    const questions = questionsOf(['1', 'a', 'b'], ['2', 'b', null])
    expect(Chain.clearDanglingChains(questions)[0]?.chains_to).to.eq(present(questions[1]).id)
  })

  it('clears a chain pointing at a question that is not here', () => {
    const questions = questionsOf(['1', 'a', null], ['2', 'b', null])
    const orphaned = [{ ...present(questions[0]), chains_to: 'someone-elses-id' }]
    expect(Chain.clearDanglingChains(orphaned)[0]?.chains_to).to.eq(null)
  })

  it('clears a question chained to itself', () => {
    const question = present(questionsOf(['1', 'a', null])[0])
    expect(Chain.clearDanglingChains([{ ...question, chains_to: question.id }])[0]?.chains_to).to.eq(null)
  })

  it('leaves an unchained question unchained', () => {
    expect(Chain.clearDanglingChains(questionsOf(['1', 'a', null]))[0]?.chains_to).to.eq(null)
  })

  it('reads an empty quiz without complaint', () => {
    expect(Chain.clearDanglingChains([])).to.deep.eq([])
  })
})

describe('chainOrder', () => {
  it('reads a quiz in presentation order however jumbled the array is', () => {
    const questions = questionsOf(['3', 'c', 'd'], ['1', 'a', 'b'], ['4', 'd', null], ['2', 'b', 'c'])
    expect(answers(Chain.chainOrder(questions, false))).to.deep.eq(['a', 'b', 'c', 'd'])
  })

  it('reads the same quiz backward', () => {
    const questions = questionsOf(['3', 'c', 'd'], ['1', 'a', 'b'], ['4', 'd', null], ['2', 'b', 'c'])
    expect(answers(Chain.chainOrder(questions, true))).to.deep.eq(['d', 'c', 'b', 'a'])
  })

  it('leads with question 1 rather than with whatever chains into it', () => {
    // 4 chains to 1, so a naive walk would start at 4 and leave question 1 waiting behind it.
    const questions = questionsOf(['4', 'd', 'a'], ['1', 'a', 'b'], ['2', 'b', 'c'], ['3', 'c', null])
    expect(answers(Chain.chainOrder(questions, false))).to.deep.eq(['a', 'b', 'c', 'd'])
  })

  it('restarts at the next unplaced question when a path runs out', () => {
    const questions = questionsOf(['1', 'a', 'b'], ['2', 'b', null], ['3', 'c', 'd'], ['4', 'd', null])
    expect(answers(Chain.chainOrder(questions, false))).to.deep.eq(['a', 'b', 'c', 'd'])
  })

  it('takes the lowest Q# first where several questions merge into one', () => {
    // Walking back from the tail there is a genuine choice: both `early` and `late` chain into
    // it, and the lower Q# goes next.
    const questions = questionsOf(['4', 'tail', null], ['3', 'late', 'tail'], ['2', 'early', 'tail'])
    expect(answers(Chain.chainOrder(questions, true))).to.deep.eq(['tail', 'early', 'late'])
  })

  it('still places a question whose backward path was taken by a sibling', () => {
    const questions = questionsOf(['4', 'tail', null], ['3', 'late', 'tail'], ['2', 'early', 'tail'])
    expect(answers(Chain.chainOrder(questions, true))).to.have.length(3)
  })

  it('places every question exactly once even when the chain is a loop', () => {
    const questions = questionsOf(['1', 'a', 'b'], ['2', 'b', 'c'], ['3', 'c', 'a'])
    expect(answers(Chain.chainOrder(questions, false))).to.deep.eq(['a', 'b', 'c'])
  })

  it('places wholly unchained questions in rank order', () => {
    const questions = questionsOf(['2', 'b', null], ['1', 'a', null], ['3', 'c', null])
    expect(answers(Chain.chainOrder(questions, false))).to.deep.eq(['a', 'b', 'c'])
  })

  it('puts questions with no Q# last, as rank order does', () => {
    const questions = questionsOf(['', 'unranked', null], ['1', 'a', null])
    expect(answers(Chain.chainOrder(questions, false))).to.deep.eq(['a', 'unranked'])
  })

  it('leaves questions with no Q# last walking backward too -- an absent Q# is not a high one', () => {
    const questions = questionsOf(['', 'unranked', null], ['1', 'a', 'b'], ['2', 'b', null])
    expect(answers(Chain.chainOrder(questions, true))).to.deep.eq(['b', 'a', 'unranked'])
  })

  it('reads an empty quiz without complaint', () => {
    expect(Chain.chainOrder([], false)).to.deep.eq([])
  })
})
