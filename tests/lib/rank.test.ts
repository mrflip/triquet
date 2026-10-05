import { describe, expect, it } from 'vitest'
import * as Rank from '../../src/lib/rank'
import { Question, type QuestionT, type QuestionViz } from '../../src/models/question'
import { present } from '../support/present'

/** A quiz built from `qnum, title` pairs, in the order given */
function questionsOf(...pairs: [string, string][]): QuestionT[] {
  return pairs.map(([qnum, title]) => ({ ...Question.blank(), qnum, title }))
}

/** `questions`, each shown as `vizzes` says, in order */
function shownAs(questions: QuestionT[], ...vizzes: QuestionViz[]): QuestionT[] {
  return questions.map((question, ii) => ({ ...question, viz: vizzes[ii] ?? 'normal' }))
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
      expect(Rank.qnumOf({ qnum })).to.eq(expected)
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
    expect(Rank.ranksOf([]).keys().toArray()).to.deep.eq([])
  })
})

describe('inRankOrder', () => {
  it('puts the quiz in Q# order with the blanks last', () => {
    const questions = questionsOf(['4', 'd'], ['', 'z'], ['1', 'a'], ['3.3', 'c'])
    expect(answers(Rank.inRankOrder(questions))).to.deep.eq(['a', 'c', 'd', 'z'])
  })

  it('keeps blanks in the order they already sat in', () => {
    const questions = questionsOf(['', 'second'], ['', 'first'], ['1', 'a'])
    expect(answers(Rank.inRankOrder(questions))).to.deep.eq(['a', 'second', 'first'])
  })

  it('leaves the quiz it was given alone', () => {
    const questions = questionsOf(['2', 'b'], ['1', 'a'])
    Rank.inRankOrder(questions)
    expect(answers(questions)).to.deep.eq(['b', 'a'])
  })
})

describe('renumberByRank', () => {
  it('tidies the numbers without moving a single question', () => {
    const questions = questionsOf(['4', 'd'], ['3.3', 'c'], ['6', 'f'], ['1', 'a'])
    const after = Rank.renumberByRank(questions)
    expect(qnums(after)).to.deep.eq(['3', '2', '4', '1'])
    expect(answers(after)).to.deep.eq(['d', 'c', 'f', 'a'])
  })

  it('leaves a question with no Q# alone rather than adopting it', () => {
    const after = Rank.renumberByRank(questionsOf(['4', 'd'], ['', 'z'], ['1', 'a']))
    expect(qnums(after)).to.deep.eq(['2', '', '1'])
  })

  it('is settled after one pass: renumbering twice changes nothing', () => {
    const once = Rank.renumberByRank(questionsOf(['4', 'd'], ['3.3', 'c'], ['1', 'a']))
    expect(qnums(Rank.renumberByRank(once))).to.deep.eq(qnums(once))
  })
})

describe('renumberByPosition', () => {
  it('numbers from the top, adopting the questions that had no Q#', () => {
    const questions = questionsOf(['9', 'a'], ['', 'b'], ['2', 'c'])
    expect(qnums(Rank.renumberByPosition(questions))).to.deep.eq(['1', '2', '3'])
  })

  it('passes over an archived question, which keeps its Q# and is not counted', () => {
    const questions = shownAs(questionsOf(['9', 'a'], ['7', 'b'], ['2', 'c']), 'normal', 'archived', 'secondary')
    expect(qnums(Rank.renumberByPosition(questions))).to.deep.eq(['1', '7', '2'])
  })
})

describe('the viz of the questions ranked', () => {
  it('puts an alternate after its peer of the same Q#, whatever their titles', () => {
    const questions = shownAs(questionsOf(['2', 'aardvark'], ['2', 'zebra'], ['1', 'mule']), 'secondary', 'normal', 'normal')
    expect(answers(Rank.inRankOrder(questions))).to.deep.eq(['mule', 'zebra', 'aardvark'])
    expect(ranks(questions)).to.deep.eq([3, 2, 1])
  })

  it('gives an archived question no rank, and takes none from the rest', () => {
    const questions = shownAs(questionsOf(['1', 'a'], ['2', 'b'], ['3', 'c']), 'normal', 'archived', 'normal')
    expect(ranks(questions)).to.deep.eq([1, null, 2])
    expect(qnums(Rank.renumberByRank(questions))).to.deep.eq(['1', '2', '2'])
  })

  it("places a question dropped among those shown just above the one it was dropped on, archived ones and all", () => {
    const [aa, archived, bb, cc] = shownAs(questionsOf(['1', 'aa'], ['', 'archived'], ['2', 'bb'], ['3', 'cc']), 'normal', 'archived', 'normal', 'normal')
    const questions = [present(aa), present(archived), present(bb), present(cc)]
    expect(Rank.ontoIdxAmong(questions, present(cc)._id, 1)).to.eq(2)
    expect(Rank.ontoIdxAmong(questions, present(cc)._id, 0)).to.eq(0)
    expect(Rank.ontoIdxAmong(questions, present(aa)._id, 2)).to.eq(3)
    const onto_idx = Rank.ontoIdxAmong(questions, present(cc)._id, 1)
    const moved = Rank.moveQuestion(questions, present(cc)._id, onto_idx)
    expect(answers(moved)).to.deep.eq(['aa', 'archived', 'cc', 'bb'])
  })

  it("reads alternatesLast's example", () => {
    expect([Rank.alternatesLast({ viz: 'secondary' }, { viz: 'normal' }), Rank.alternatesLast({ viz: 'normal' }, { viz: 'normal' })]).to.deep.eq([1, 0])
  })
})

describe('moveQuestion', () => {
  it('drops the dragged question at its new seat', () => {
    const questions = questionsOf(['1', 'a'], ['2', 'b'], ['3', 'c'])
    const dragged = present(questions[2])
    const moved = Rank.moveQuestion(questions, dragged._id, 0)
    expect(answers(moved)).to.deep.eq(['c', 'a', 'b'])
  })

  it('moves a question down the list', () => {
    const questions = questionsOf(['1', 'a'], ['2', 'b'], ['3', 'c'])
    const dragged = present(questions[0])
    const moved = Rank.moveQuestion(questions, dragged._id, 2)
    expect(answers(moved)).to.deep.eq(['b', 'c', 'a'])
  })

  it('clamps a drop past the end to the end', () => {
    const questions = questionsOf(['1', 'a'], ['2', 'b'])
    const dragged = present(questions[0])
    const moved = Rank.moveQuestion(questions, dragged._id, 99)
    expect(answers(moved)).to.deep.eq(['b', 'a'])
  })

  it('leaves the quiz alone when the dragged question is not in it', () => {
    const questions = questionsOf(['1', 'a'], ['2', 'b'])
    const moved = Rank.moveQuestion(questions, 'nobody', 0)
    expect(answers(moved)).to.deep.eq(['a', 'b'])
  })
})

/** Ranks in the order the questions were given, for compact comparison */
function ranks(questions: QuestionT[]): (number | null)[] {
  const bag = Rank.ranksOf(questions)
  return questions.map((question) => bag.get(question._id) ?? null)
}
