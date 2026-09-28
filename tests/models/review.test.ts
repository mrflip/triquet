import { describe, expect, it } from 'vitest'
import * as Z from 'zod'
import { ReviewValidators, sharedReviewsOf } from '../../src/models/review'

describe('ReviewValidators.row', () => {
  const Row = { hunt_id: '01a0dc10-c9be-7cb3-9d3a-25fc68cd12f8', quiz_id: '01a0dc10-c9be-7cb3-9d3a-25fc68cd12f9', ident_id: '01a0dc10-c9be-7cb3-9d3a-25fc68cd12fa', overall: '', phase: 'empty' } as const

  it('takes a review as the database holds it', () => {
    expect(ReviewValidators.row(Row)).to.deep.eq(Row)
  })

  it('defaults overall to empty and phase to empty', () => {
    expect(ReviewValidators.row({ hunt_id: Row.hunt_id, quiz_id: Row.quiz_id, ident_id: Row.ident_id })).to.deep.eq(Row)
  })

  const Refused: [object, string][] = [
    [{ hunt_id: 'nope' },             'a hunt that is not a row id'],
    [{ quiz_id: 'nope' },             'a quiz that is not a row id'],
    [{ ident_id: 'nope' },            'an ident that is not a row id'],
    [{ phase: 'reviewed' },           'a phase outside the enum'],
    [{ overall: 'x'.repeat(3601) },   'an overall note past its length'],
  ]
  for (const [overrides, describes] of Refused) {
    it(`refuses ${describes}`, () => {
      expect(() => ReviewValidators.row({ ...Row, ...overrides })).to.throw(Z.ZodError)
    })
  }
})

describe('sharedReviewsOf', () => {
  it('keeps only the shared reviews, in their given order', () => {
    const reviews = [{ phase: 'draft' as const }, { phase: 'shared' as const }, { phase: 'empty' as const }, { phase: 'shared' as const }]
    expect(sharedReviewsOf(reviews)).to.deep.eq([{ phase: 'shared' }, { phase: 'shared' }])
  })

  it('is empty when nothing is shared', () => {
    expect(sharedReviewsOf([{ phase: 'draft' as const }])).to.deep.eq([])
  })
})
