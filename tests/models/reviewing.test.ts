import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as Z from 'zod'
import { Reviewing, ReviewingFlags, ReviewingValidators } from '../../src/models/reviewing'

const Ids = {
  hunt_id:     '01a0dc10-c9be-7cb3-9d3a-25fc68cd12f6',
  quiz_id:     '01a0dc10-c9be-7cb3-9d3a-25fc68cd12f7',
  ident_id:    '01a0dc10-c9be-7cb3-9d3a-25fc68cd12f8',
  review_id:   '01a0dc10-c9be-7cb3-9d3a-25fc68cd12f9',
  question_id: '01a0dc10-c9be-7cb3-9d3a-25fc68cd12fa',
} as const

/** The moment the tests run at, which a row checked without stamps is stamped with */
const Now = 1_759_700_000_000

const Blank = {
  ...Ids, get_rate: null, guesses: '', comments: '', minutes: null,
  keep_it: false, needs_fact_check: false, elimination_candidate: false, peeked: false, created_at: Now, updated_at: Now,
} as const

beforeEach(() => { vi.useFakeTimers({ now: Now, toFake: ['Date'] }) })
afterEach(() => { vi.useRealTimers() })

describe('ReviewingValidators.row', () => {
  it('defaults every verdict to unsaid, and the answer to unseen', () => {
    expect(ReviewingValidators.row(Ids)).to.deep.eq(Blank)
  })

  const Taken: [object, string][] = [
    [{ get_rate: 0 },                       'a get rate of none at all'],
    [{ get_rate: 100 },                     'a get rate of certain'],
    [{ minutes: 0 },                        'no minutes spent'],
    [{ minutes: 2.5 },                      'a fraction of a minute'],
    [{ minutes: 999 },                      'the most minutes anyone could mean'],
    [{ comments: '  Two lines,\nkept.  ' }, 'comments as typed, untrimmed'],
  ]
  for (const [overrides, describes] of Taken) {
    it(`takes ${describes}`, () => {
      expect(ReviewingValidators.row({ ...Blank, ...overrides })).to.deep.eq({ ...Blank, ...overrides })
    })
  }

  const Refused: [object, string][] = [
    [{ get_rate: 101 },          'a get rate past certain'],
    [{ get_rate: -1 },           'a negative get rate'],
    [{ get_rate: 50.5 },         'a fractional get rate'],
    [{ get_rate: '50' },         'a get rate as text'],
    [{ minutes: -1 },            'negative minutes'],
    [{ minutes: Infinity },      'endless minutes'],
    [{ minutes: 1000 },          'more minutes than anyone means: a typo'],
    [{ keep_it: 'yes' },         'a flag that is not a boolean'],
    [{ review_id: 'nope' },      'a review that is not a row id'],
    [{ question_id: undefined }, 'no question'],
    [{ ident_id: undefined },    'no writer for its review'],
  ]
  for (const [overrides, describes] of Refused) {
    it(`refuses ${describes}`, () => {
      expect(() => ReviewingValidators.row({ ...Blank, ...overrides })).to.throw(Z.ZodError)
    })
  }
})

describe('ReviewingValidators.reviewingPatch', () => {
  it('carries only the fields it was given: no defaults', () => {
    expect(ReviewingValidators.reviewingPatch({ get_rate: 40 })).to.deep.eq({ get_rate: 40 })
    expect(ReviewingValidators.reviewingPatch({})).to.deep.eq({})
  })

  it('carries a null, to clear a get rate or minutes', () => {
    expect(ReviewingValidators.reviewingPatch({ get_rate: null, minutes: null })).to.deep.eq({ get_rate: null, minutes: null })
  })

  it('holds its fields to the row\'s bounds', () => {
    expect(() => ReviewingValidators.reviewingPatch({ get_rate: 101 })).to.throw(Z.ZodError)
    expect(() => ReviewingValidators.reviewingPatch({ minutes: -1 })).to.throw(Z.ZodError)
  })

  it("refuses a patch picking a question both top and meh", () => {
    expect(() => ReviewingValidators.reviewingPatch({ keep_it: true, elimination_candidate: true })).to.throw(Z.ZodError)
    expect(ReviewingValidators.reviewingPatch({ keep_it: true, elimination_candidate: false })).to.deep.eq({ keep_it: true, elimination_candidate: false })
  })

  it('never carries the ids or peeked: those are not the reviewer\'s to revise', () => {
    expect(ReviewingValidators.reviewingPatch({ ...Ids, peeked: true, keep_it: true } as never)).to.deep.eq({ keep_it: true })
  })
})

describe('Reviewing.blank', () => {
  it("is a reviewing with nothing said, carrying its review's hunt, quiz and writer", () => {
    const review = { _id: Ids.review_id, hunt_id: Ids.hunt_id, quiz_id: Ids.quiz_id, ident_id: Ids.ident_id }
    expect(Reviewing.blank(review, Ids.question_id)).to.deep.eq(Blank)
  })
})

describe('Reviewing.unrivalled', () => {
  const Cases: [object, object, string][] = [
    [{ keep_it: true },                    { keep_it: true, elimination_candidate: false },  'a top pick lowers the meh'],
    [{ elimination_candidate: true },      { elimination_candidate: true, keep_it: false },  'a meh pick lowers the top'],
    [{ keep_it: false },                   { keep_it: false },                               'lowering a pick leaves its rival alone'],
    [{ needs_fact_check: true },           { needs_fact_check: true },                       'a flag that is no pick leaves the picks alone'],
    [{ guesses: 'Hamlet?' },               { guesses: 'Hamlet?' },                           'a patch without flags is unchanged'],
  ]
  for (const [patch, settled, describes] of Cases) {
    it(describes, () => {
      expect(Reviewing.unrivalled(patch)).to.deep.eq(settled)
    })
  }
})

describe('Reviewing.pickedElsewhere', () => {
  const picks = [
    { question_id: 'q1', keep_it: true,  elimination_candidate: false },
    { question_id: 'q2', keep_it: true,  elimination_candidate: false },
    { question_id: 'q3', keep_it: false, elimination_candidate: true },
  ]
  it('counts the questions picked that way', () => {
    expect(Reviewing.pickedElsewhere(picks, 'keep_it', 'q9')).to.eq(2)
    expect(Reviewing.pickedElsewhere(picks, 'elimination_candidate', 'q9')).to.eq(1)
  })
  it('leaves out the question about to be picked', () => {
    expect(Reviewing.pickedElsewhere(picks, 'keep_it', 'q1')).to.eq(1)
  })
  it('counts nothing for a review that has said nothing', () => {
    expect(Reviewing.pickedElsewhere([], 'keep_it', 'q1')).to.eq(0)
  })
})

describe('ReviewingFlags', () => {
  it('words the picks by how many a review may make', () => {
    expect(ReviewingFlags.map(({ word }) => word)).to.deep.eq(['top 3', 'needs fact check', 'meh 3'])
  })


  it('are the flags of a reviewing a reviewer raises: every boolean but peeked', () => {
    const booleans = Object.keys(Blank).filter((fieldname) => typeof Blank[fieldname as keyof typeof Blank] === 'boolean' && fieldname !== 'peeked')
    expect(ReviewingFlags.map(({ flag }) => flag)).to.deep.eq(booleans)
  })
})
