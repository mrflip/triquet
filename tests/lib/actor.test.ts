import { describe, expect, it } from 'vitest'
import type { Id } from '../../convex/_generated/dataModel'
import * as Actor from '../../src/lib/actor'

const user_id  = 'm57a2835q9kp1gefja107b9bfh8fnpvr' as Id<'users'>
const other_id = 'j97d0qbj35dar1v8edndzckvsx8f8299' as Id<'users'>

/** A deployment where only a user's own flag makes it an admin, as production is */
const Production = { everyoneAdmin: false }

/** A deployment where every user is an admin, as a local backend is */
const Local = { everyoneAdmin: true }

describe('Actor.unlabelled', () => {
  it('is the one actor of a request whose user holds no userlabel, and cannot be changed', () => {
    expect(Actor.unlabelled).to.deep.eq({ kind: 'unlabelled' })
    expect(Object.isFrozen(Actor.unlabelled)).to.be.true
  })
})

describe('Actor.ofUser', () => {
  it('is the actor of a user holding a userlabel, by its own userlabel and title', () => {
    expect(Actor.ofUser(user_id, { userlabel: 'flip_kromer', title: 'Flip' }, Production)).to.deep.eq({ kind: 'user', user_id, userlabel: 'flip_kromer', usertitle: 'Flip', admin: false, anonymous: false })
  })

  it('is the unlabelled actor for a user holding no userlabel yet, anonymous or not, admin or not', () => {
    expect(Actor.ofUser(user_id, { isAnonymous: true }, Production)).to.eq(Actor.unlabelled)
    expect(Actor.ofUser(user_id, { admin: true }, Local)).to.eq(Actor.unlabelled)
  })

  it('says a user signed in with no proof is anonymous, and so sealed', () => {
    const actor = Actor.ofUser(user_id, { userlabel: 'flip_kromer', title: 'Flip', isAnonymous: true }, Production)
    expect([actor, Actor.isSealed(actor)]).to.deep.eq([{ kind: 'user', user_id, userlabel: 'flip_kromer', usertitle: 'Flip', admin: false, anonymous: true }, true])
  })

  const AdminCases: [boolean | undefined, boolean, boolean, string][] = [
    //  the flag   everyone  admin
    [true,         false,    true,  "a user whose own flag says so, where the deployment says nothing"],
    [false,        false,    false, "a user whose flag says no"],
    [undefined,    false,    false, "a user with no flag, as every user is until the command line sets one"],
    [undefined,    true,     true,  "anyone at all, where the deployment makes everyone an admin (a local backend)"],
    [false,        true,     true,  "even a user whose flag says no, where everyone is one"],
  ]
  for (const [admin, everyoneAdmin, expected, describes] of AdminCases) {
    it(`reads the admin flag once: ${describes}`, () => {
      const actor = Actor.ofUser(user_id, { userlabel: 'flip_kromer', title: 'Flip', ...(admin !== undefined && { admin }) }, { everyoneAdmin })
      expect(actor.kind === 'user' && Actor.isAdmin(actor)).to.eq(expected)
    })
  }
})

const Flip  = { kind: 'user', user_id, userlabel: 'flip_kromer', usertitle: 'Flip', admin: false, anonymous: false } as const satisfies Actor.UserActorT
const Anon  = { ...Flip, anonymous: true } as const satisfies Actor.UserActorT

describe('Actor.isUnlabelled', () => {
  it('is true for the unlabelled actor, and false for a user holding a userlabel', () => {
    expect([Actor.isUnlabelled(Actor.unlabelled), Actor.isUnlabelled(Flip), Actor.isUnlabelled(Anon)]).to.deep.eq([true, false, false])
  })
})

describe('Actor.isSealed', () => {
  it('is true only for an anonymous user holding a userlabel: the unlabelled actor is refused for having none first', () => {
    expect([Actor.isSealed(Anon), Actor.isSealed(Flip), Actor.isSealed(Actor.unlabelled)]).to.deep.eq([true, false, false])
  })
})

const hunt_id  = 'k17ah9c4r1hm0z5y1ad0bbn7wn7fn9x1' as Id<'hunts'>

describe('Actor.claimsOn', () => {
  it("takes the standing of the actor's huntship, as a role", () => {
    expect(Actor.claimsOn(Flip, hunt_id, { role: 'reviewer' })).to.deep.eq({ ...Flip, hunt_id, standing: 'reviewer' })
  })

  it('makes a stranger of an actor with no huntship there', () => {
    expect(Actor.claimsOn(Flip, hunt_id, null)).to.deep.eq({ ...Flip, hunt_id, standing: 'stranger' })
  })

  it('makes a stranger of the unlabelled actor', () => {
    expect(Actor.claimsOn(Actor.unlabelled, hunt_id, null)).to.deep.eq({ kind: 'unlabelled', hunt_id, standing: 'stranger' })
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
  const Cases: [Actor.ActorT, Actor.UserRefT, boolean, string][] = [
    [Flip,             { user_id },                   true,  'the actor, by id'],
    [Flip,             { userlabel: 'flip_kromer' },  true,  'the actor, by userlabel'],
    [Flip,             { user_id: other_id },         false, 'someone else, by id'],
    [Flip,             { userlabel: 'ada_lovelace' }, false, 'someone else, by userlabel'],
    [Actor.unlabelled, { user_id },                   false, 'nobody is the unlabelled actor'],
  ]
  for (const [actor, target, expected, describes] of Cases) {
    it(describes, () => {
      expect(Actor.isOneself(actor, target)).to.eq(expected)
    })
  }
})
