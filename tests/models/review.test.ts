import { describe, expect, it } from 'vitest'
import * as Z from 'zod'
import type { Id } from '../../convex/_generated/dataModel'
import * as Actor from '../../src/lib/actor'
import { Review, ReviewValidators, sharedReviewsOf, type ReviewPhase, type ReviewRowT } from '../../src/models/review'

describe('ReviewValidators.row', () => {
  const Row = { hunt_id: '01a0dc10-c9be-7cb3-9d3a-25fc68cd12f8', quiz_id: '01a0dc10-c9be-7cb3-9d3a-25fc68cd12f9', ident_id: '01a0dc10-c9be-7cb3-9d3a-25fc68cd12fa', overall: '', phase: 'empty' } as const

  it('takes a review as the database holds it', () => {
    expect(ReviewValidators.row(Row)).to.deep.eq(Row)
  })

  it('defaults overall to empty and phase to empty, and leaves the stamps to the database', () => {
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

describe('Review.isShared and Review.isHidden', () => {
  const Cases: [ReviewPhase, boolean, string][] = [
    ['shared', true,  'a shared review is shared'],
    ['draft',  false, 'a draft is hidden'],
    ['empty',  false, 'an empty review is hidden'],
  ]
  for (const [phase, shared, describes] of Cases) {
    it(describes, () => {
      expect([Review.isShared({ phase }), Review.isHidden({ phase })]).to.deep.eq([shared, ! shared])
    })
  }
})

describe('Review.isActiveOwner', () => {
  const user_id  = 'm57a2835q9kp1gefja107b9bfh8fnpvr' as Id<'users'>
  const hunt_id  = 'k17ah9c4r1hm0z5y1ad0bbn7wn7fn9x1' as Id<'hunts'>
  const other_hunt_id = 'k17ah9c4r1hm0z5y1ad0bbn7wn7fn9x2' as Id<'hunts'>
  const ident_id = 'j97d0qbj35dar1v8edndzckvsx8f828f' as Id<'idents'>
  const other_id = 'j97d0qbj35dar1v8edndzckvsx8f8299' as Id<'idents'>
  const Flip = Actor.asIdent(user_id, { _id: ident_id, label: 'flip_kromer' })
  const Own = { hunt_id, ident_id }

  const Cases: [Pick<ReviewRowT, 'hunt_id' | 'ident_id'>, Actor.HuntClaimsT, boolean, string][] = [
    [Own,                               Actor.claimsOn(Actor.anonymous, hunt_id, null),      false, 'nobody who has asserted no username wrote it'],
    [{ hunt_id, ident_id: other_id },   Actor.claimsOn(Flip, hunt_id, { role: 'reviewer' }), false, "nobody else's review is theirs"],
    [{ ...Own, hunt_id: other_hunt_id }, Actor.claimsOn(Flip, hunt_id, { role: 'reviewer' }), false, 'claims on another hunt say nothing of this one'],
    [Own,                               Actor.claimsOn(Flip, hunt_id, { role: 'reviewer' }), true,  'the writer, while a reviewer on its hunt'],
    [Own,                               Actor.claimsOn(Flip, hunt_id, { role: 'smith' }),    true,  'the writer, while a smith on its hunt'],
    [Own,                               Actor.claimsOn(Flip, hunt_id, null),                 false, 'the writer, once taken off its hunt'],
  ]
  for (const [review, claims, expected, describes] of Cases) {
    it(describes, () => {
      expect(Review.isActiveOwner(review, claims)).to.eq(expected)
    })
  }
})

describe('Review.ownOf', () => {
  const user_id  = 'm57a2835q9kp1gefja107b9bfh8fnpvr' as Id<'users'>
  const ident_id = 'j97d0qbj35dar1v8edndzckvsx8f828f' as Id<'idents'>
  const other_id = 'j97d0qbj35dar1v8edndzckvsx8f8299' as Id<'idents'>
  const Flip = Actor.asIdent(user_id, { _id: ident_id, label: 'flip_kromer' })
  const reviews = [{ ident_id: other_id, phase: 'shared' }, { ident_id, phase: 'draft' }] as const

  it("finds the actor's own among a quiz's reviews", () => {
    expect(Review.ownOf(reviews, Flip)).to.eq(reviews[1])
  })

  it('is null for an actor who wrote none', () => {
    expect(Review.ownOf(reviews.slice(0, 1), Flip)).to.be.null
  })

  it('is null for the anonymous actor', () => {
    expect(Review.ownOf(reviews, Actor.anonymous)).to.be.null
  })
})
