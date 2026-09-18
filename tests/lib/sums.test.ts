import { describe, expect, it } from 'vitest'
import { sumsForRound } from '../../src/lib/sums'
import { Question, type QuestionT } from '../../src/models/question'
import type { IshItemT, IshesT } from '../../src/models/ish'
import { present } from '../support/present'

/** A finished extraction holding the spans given */
function extracted(items: IshItemT[], stale = false): IshesT {
  return { status: 'done', items, truncated: false, stale, updated_at: 1 }
}

const numeral = (text: string, value: number): IshItemT => ({ text, value, kind: 'numeral' })
const wordish = (text: string, value: number): IshItemT => ({ text, value, kind: 'wordish' })

/** One question with the extractions given, in a round of its own */
function loneQuestion(patch: Partial<QuestionT>): QuestionT {
  return { ...Question.blank(), qnum: '1', ...patch }
}

const sumsOf = (questions: QuestionT[], question: QuestionT) => present(sumsForRound(questions).get(question.id))

describe('sumsForRound', () => {
  it('adds every ish in the clueing, and the digit-written ones on their own', () => {
    const question = loneQuestion({ clueing_ishes: extracted([numeral('300', 300), wordish('a dozen', 12)]) })
    const sums = sumsOf([question], question)
    expect(sums.clueing_full.total).to.eq(312)
    expect(sums.clueing_numeral.total).to.eq(300)
  })

  it('rounds a sum to a whole number while the items keep their fractions', () => {
    const question = loneQuestion({ clueing_ishes: extracted([wordish('quarter', 0.25), wordish('half', 0.5)]) })
    expect(sumsOf([question], question).clueing_full.total).to.eq(1)
  })

  it('reads an empty extraction as nought, which is a real answer', () => {
    const question = loneQuestion({ clueing_ishes: extracted([]) })
    expect(sumsOf([question], question).clueing_full.total).to.eq(0)
  })

  it('reads a never-asked cell as nothing at all, not as nought', () => {
    const question = loneQuestion({})
    expect(sumsOf([question], question).clueing_full.total).to.eq(null)
  })

  it('reads a failed ask as nothing at all', () => {
    const question = loneQuestion({ clueing_ishes: { status: 'error', message: 'A connection hiccup — try again.', updated_at: 1 } })
    expect(sumsOf([question], question).clueing_full.total).to.eq(null)
  })

  it('adds the rank, not the Q#, so the meta-puzzle survives gappy numbering', () => {
    const early = { ...Question.blank(), qnum: '3', clueing_ishes: extracted([numeral('300', 300)]) }
    const late  = { ...Question.blank(), qnum: '40' }
    expect(sumsOf([early, late], early).clueing_plus_rank.total).to.eq(301)
  })

  it('leaves Clueing + Rank empty when the question is unranked', () => {
    const question = loneQuestion({ qnum: '', clueing_ishes: extracted([numeral('300', 300)]) })
    expect(sumsOf([question], question).clueing_plus_rank.total).to.eq(null)
  })

  it('borrows the chained-to question\'s hint for the BUT NOT columns', () => {
    const target = { ...Question.blank(), qnum: '2', hint_ishes: extracted([numeral('1994', 1994), wordish('twelve', 12)]) }
    const question = { ...Question.blank(), qnum: '1', chains_to: target.id }
    const sums = sumsOf([question, target], question)
    expect(sums.butnot_full.total).to.eq(2006)
    expect(sums.butnot_numeral.total).to.eq(1994)
  })

  it('reads this question\'s own hint separately from the one it borrows', () => {
    const target = { ...Question.blank(), qnum: '2', hint_ishes: extracted([numeral('1994', 1994)]) }
    const question = { ...Question.blank(), qnum: '1', chains_to: target.id, hint_ishes: extracted([numeral('7', 7)]) }
    const sums = sumsOf([question, target], question)
    expect(sums.hint_full.total).to.eq(7)
    expect(sums.butnot_full.total).to.eq(1994)
  })

  it('leaves the BUT NOT columns empty when nothing is chained', () => {
    const question = loneQuestion({ clueing_ishes: extracted([numeral('300', 300)]) })
    expect(sumsOf([question], question).butnot_full.total).to.eq(null)
  })

  it('adds the clueing and the borrowed hint for the widest reading', () => {
    const target = { ...Question.blank(), qnum: '2', hint_ishes: extracted([numeral('1994', 1994)]) }
    const question = { ...Question.blank(), qnum: '1', chains_to: target.id, clueing_ishes: extracted([numeral('6', 6)]) }
    expect(sumsOf([question, target], question).clueing_plus_butnot_full.total).to.eq(2000)
  })

  it('leaves Clueing+BUT NOT empty unless both halves exist', () => {
    const question = loneQuestion({ clueing_ishes: extracted([numeral('6', 6)]) })
    expect(sumsOf([question], question).clueing_plus_butnot_full.total).to.eq(null)
  })

  describe('staleness', () => {
    it('marks a sum stale when its own extraction is stale', () => {
      const question = loneQuestion({ clueing_ishes: extracted([numeral('300', 300)], true) })
      const sums = sumsOf([question], question)
      expect(sums.clueing_full).to.deep.eq({ total: 300, stale: true })
    })

    it('keeps the out-of-date number rather than emptying the cell', () => {
      const question = loneQuestion({ clueing_ishes: extracted([numeral('300', 300)], true) })
      expect(sumsOf([question], question).clueing_full.total).to.eq(300)
    })

    it('passes staleness on to a question borrowing a stale hint', () => {
      const target = { ...Question.blank(), qnum: '2', hint_ishes: extracted([numeral('1994', 1994)], true) }
      const question = { ...Question.blank(), qnum: '1', chains_to: target.id }
      expect(sumsOf([question, target], question).butnot_full.stale).to.eq(true)
    })

    it('marks a combined sum stale when either half is', () => {
      const target = { ...Question.blank(), qnum: '2', hint_ishes: extracted([numeral('1994', 1994)], true) }
      const question = { ...Question.blank(), qnum: '1', chains_to: target.id, clueing_ishes: extracted([numeral('6', 6)]) }
      expect(sumsOf([question, target], question).clueing_plus_butnot_full).to.deep.eq({ total: 2000, stale: true })
    })
  })
})
