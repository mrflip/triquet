import { describe, expect, it } from 'vitest'
import type { Id } from '../../convex/_generated/dataModel'
import * as Actor from '../../src/lib/actor'

const user_id  = 'm57a2835q9kp1gefja107b9bfh8fnpvr' as Id<'users'>
const ident_id = 'j97d0qbj35dar1v8edndzckvsx8f828f' as Id<'idents'>

describe('Actor.anonymous', () => {
  it('is the one actor of a request that has asserted no username, and cannot be changed', () => {
    expect(Actor.anonymous).to.deep.eq({ kind: 'anonymous' })
    expect(Object.isFrozen(Actor.anonymous)).to.be.true
  })
})

describe('Actor.asIdent', () => {
  it('is the actor of a session, by the ident it took on last', () => {
    expect(Actor.asIdent(user_id, { _id: ident_id, label: 'flip_kromer' })).to.deep.eq({ kind: 'ident', user_id, ident_id, ident_label: 'flip_kromer' })
  })
})

describe('Actor.isAnonymous', () => {
  it('is true for the anonymous actor, and false for an ident', () => {
    expect(Actor.isAnonymous(Actor.anonymous)).to.be.true
    expect(Actor.isAnonymous(Actor.asIdent(user_id, { _id: ident_id, label: 'flip_kromer' }))).to.be.false
  })
})

const hunt_id  = 'k17ah9c4r1hm0z5y1ad0bbn7wn7fn9x1' as Id<'hunts'>
const other_id = 'j97d0qbj35dar1v8edndzckvsx8f8299' as Id<'idents'>
const Flip = Actor.asIdent(user_id, { _id: ident_id, label: 'flip_kromer' })

describe('Actor.claimsOn', () => {
  it("takes the standing of the actor's hunting, as a role", () => {
    expect(Actor.claimsOn(Flip, hunt_id, { role: 'reviewer' })).to.deep.eq({ ...Flip, hunt_id, standing: 'reviewer' })
  })

  it('makes a stranger of an actor with no hunting there', () => {
    expect(Actor.claimsOn(Flip, hunt_id, null)).to.deep.eq({ ...Flip, hunt_id, standing: 'stranger' })
  })

  it('makes a stranger of the anonymous actor', () => {
    expect(Actor.claimsOn(Actor.anonymous, hunt_id, null)).to.deep.eq({ kind: 'anonymous', hunt_id, standing: 'stranger' })
  })
})

describe('the standing predicates', () => {
  const Cases: [Actor.HuntStanding, boolean, boolean, boolean, string][] = [
    //           isSmith  isReviewer  isMember
    ['smith',    true,    false,      true,     'a smith is a member, and not a reviewer'],
    ['reviewer', false,   true,       true,     'a reviewer is a member, and not a smith'],
    ['stranger', false,   false,      false,    'a stranger is none of them'],
  ]
  for (const [standing, smith, reviewer, member, describes] of Cases) {
    it(describes, () => {
      const claims = { ...Flip, hunt_id, standing }
      expect([Actor.isSmith(claims), Actor.isReviewer(claims), Actor.isMember(claims)]).to.deep.eq([smith, reviewer, member])
    })
  }
})

describe('Actor.roleOf', () => {
  it("is a member's standing", () => {
    expect(Actor.roleOf(Actor.claimsOn(Flip, hunt_id, { role: 'smith' }))).to.eq('smith')
  })

  it('throws for a stranger, who holds no role', () => {
    expect(() => Actor.roleOf(Actor.claimsOn(Flip, hunt_id, null))).to.throw('holds no role')
  })
})

describe('Actor.isOneself', () => {
  const Cases: [Actor.ActorT, Actor.IdentRefT, boolean, string][] = [
    [Flip,            { ident_id },                  true,   'the actor, by id'],
    [Flip,            { ident_label: 'flip_kromer' }, true,   'the actor, by label'],
    [Flip,            { ident_id: other_id },         false,  'someone else, by id'],
    [Flip,            { ident_label: 'ada_lovelace' }, false, 'someone else, by label'],
    [Actor.anonymous, { ident_id },                  false,  'nobody is the anonymous actor'],
  ]
  for (const [actor, target, expected, describes] of Cases) {
    it(describes, () => {
      expect(Actor.isOneself(actor, target)).to.eq(expected)
    })
  }
})
