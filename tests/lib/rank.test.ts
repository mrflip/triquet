import { describe, expect, it } from 'vitest'
import { inRankOrder, moveQuestion, qnumOf, ranksOf, renumberByPosition, renumberByRank } from '../../src/lib/rank'
import { Question, type QuestionT } from '../../src/models/question'
import { present } from '../support/present'

/** A quiz built from `qnum, title` pairs, in the order given */
function questionsOf(...pairs: [string, string][]): QuestionT[] {
  return pairs.map(([qnum, title]) => ({ ...Question.blank(), qnum, title }))
}

const qnums = (questions: QuestionT[]) => questions.map((question) => question.qnum)
const answers = (questions: QuestionT[]) => questions.map((question) => question.title)

const QnumCases: [string, number | null, string][] = [
  // regular usage:
  ["1",     1,      'a plain integer'],
  ["3.1",   3.1,    'a decimal'],
  ["100",   100,    'more than one digit'],
  ["03",    3,      'a leading zero'],
  // nil and missing values:
  ["",      null,   'blank, which means unranked rather than zero'],
]

describe('qnumOf', () => {
  for (const [qnum, expected, blurb] of QnumCases) {
    it(blurb, () => {
      expect(qnumOf({ qnum })).to.eq(expected)
    })
  }
})

describe('ranksOf', () => {
  it('numbers the ranked questions from 1, whatever their Q# values are', () => {
    expect(ranks(questionsOf(['4', 'd'], ['3.3', 'c'], ['6', 'f'], ['1', 'a']))).to.deep.eq([3, 2, 4, 1])
  })

  it('gives a question with no Q# no rank at all, rather than a last one', () => {
    const questions = questionsOf(['1', 'a'], ['', 'b'])
    expect(ranks(questions)).to.deep.eq([1, null])
  })

  it('settles a duplicated Q# alphabetically by title, ignoring case', () => {
    const questions = questionsOf(['1', 'zebra'], ['1', 'Antelope'])
    expect(ranks(questions)).to.deep.eq([2, 1])
  })

  it('leaves gaps in the Q# values without leaving gaps in the ranks', () => {
    const questions = questionsOf(['2', 'a'], ['9', 'b'], ['40', 'c'])
    expect(ranks(questions)).to.deep.eq([1, 2, 3])
  })

  it('reads an empty quiz without complaint', () => {
    expect(ranksOf([]).keys().toArray()).to.deep.eq([])
  })
})

describe('inRankOrder', () => {
  it('puts the quiz in Q# order with the blanks last', () => {
    const questions = questionsOf(['4', 'd'], ['', 'z'], ['1', 'a'], ['3.3', 'c'])
    expect(answers(inRankOrder(questions))).to.deep.eq(['a', 'c', 'd', 'z'])
  })

  it('keeps blanks in the order they already sat in', () => {
    const questions = questionsOf(['', 'second'], ['', 'first'], ['1', 'a'])
    expect(answers(inRankOrder(questions))).to.deep.eq(['a', 'second', 'first'])
  })

  it('leaves the quiz it was given alone', () => {
    const questions = questionsOf(['2', 'b'], ['1', 'a'])
    inRankOrder(questions)
    expect(answers(questions)).to.deep.eq(['b', 'a'])
  })
})

describe('renumberByRank', () => {
  it('tidies the numbers without moving a single question', () => {
    const questions = questionsOf(['4', 'd'], ['3.3', 'c'], ['6', 'f'], ['1', 'a'])
    const after = renumberByRank(questions)
    expect(qnums(after)).to.deep.eq(['3', '2', '4', '1'])
    expect(answers(after)).to.deep.eq(['d', 'c', 'f', 'a'])
  })

  it('leaves a question with no Q# alone rather than adopting it', () => {
    const after = renumberByRank(questionsOf(['4', 'd'], ['', 'z'], ['1', 'a']))
    expect(qnums(after)).to.deep.eq(['2', '', '1'])
  })

  it('is settled after one pass: renumbering twice changes nothing', () => {
    const once = renumberByRank(questionsOf(['4', 'd'], ['3.3', 'c'], ['1', 'a']))
    expect(qnums(renumberByRank(once))).to.deep.eq(qnums(once))
  })
})

describe('renumberByPosition', () => {
  it('numbers from the top, adopting the questions that had no Q#', () => {
    const questions = questionsOf(['9', 'a'], ['', 'b'], ['2', 'c'])
    expect(qnums(renumberByPosition(questions))).to.deep.eq(['1', '2', '3'])
  })
})

describe('moveQuestion', () => {
  it('drops the dragged question at its new seat', () => {
    const questions = questionsOf(['1', 'a'], ['2', 'b'], ['3', 'c'])
    const dragged = present(questions[2])
    const moved = moveQuestion(questions, dragged.id, 0)
    expect(answers(moved)).to.deep.eq(['c', 'a', 'b'])
  })

  it('moves a question down the list', () => {
    const questions = questionsOf(['1', 'a'], ['2', 'b'], ['3', 'c'])
    const dragged = present(questions[0])
    const moved = moveQuestion(questions, dragged.id, 2)
    expect(answers(moved)).to.deep.eq(['b', 'c', 'a'])
  })

  it('clamps a drop past the end to the end', () => {
    const questions = questionsOf(['1', 'a'], ['2', 'b'])
    const dragged = present(questions[0])
    const moved = moveQuestion(questions, dragged.id, 99)
    expect(answers(moved)).to.deep.eq(['b', 'a'])
  })

  it('leaves the quiz alone when the dragged question is not in it', () => {
    const questions = questionsOf(['1', 'a'], ['2', 'b'])
    const moved = moveQuestion(questions, 'nobody', 0)
    expect(answers(moved)).to.deep.eq(['a', 'b'])
  })
})

/** Ranks in the order the questions were given, for compact comparison */
function ranks(questions: QuestionT[]): (number | null)[] {
  const bag = ranksOf(questions)
  return questions.map((question) => bag.get(question.id) ?? null)
}
