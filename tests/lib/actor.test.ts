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
