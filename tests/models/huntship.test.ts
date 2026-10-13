import { describe, expect, it } from 'vitest'
import * as Z from 'zod'
import type { Id } from '../../convex/_generated/dataModel'
import * as Actor from '../../src/lib/actor'
import { Huntship, HuntshipValidators, HuntRoleVals, type HuntRole } from '../../src/models/huntship'
import { ModeVals } from '../../src/lib/addresses'
import { userActor } from '../support/actors'

const Row = { hunt_id: '01a0dc10-c9be-7cb3-9d3a-25fc68cd12f9', user_id: '01a0dc10-c9be-7cb3-9d3a-25fc68cd12fa', userlabel: 'flip_kromer', usertitle: 'Flip', role: 'smith' } as const

describe('HuntshipValidators.row', () => {
  it('takes each role', () => {
    for (const role of HuntRoleVals) {
      expect(HuntshipValidators.row({ ...Row, role })).to.deep.eq({ ...Row, role })
    }
  })

  const Refused: [object, string][] = [
    [{ role: 'owner' },        'a role that is not one'],
    [{ role: undefined },      'no role: a huntship always says what it is'],
    [{ hunt_id: 'nope' },      'a hunt that is not a row id'],
    [{ user_id: undefined },   'no user'],
    [{ userlabel: 'Flip K' },  "a user's userlabel that is not one"],
    [{ usertitle: '' },        "a user's title left blank, which no user has"],
    [{ usertitle: undefined }, "no title for its user"],
  ]
  for (const [overrides, describes] of Refused) {
    it(`refuses ${describes}`, () => {
      expect(() => HuntshipValidators.row({ ...Row, ...overrides })).to.throw(Z.ZodError)
    })
  }
})

describe('Huntship.modeFor', () => {
  it('opens the workbench for a smith and the playtest for a reviewer', () => {
    expect(HuntRoleVals.map((role) => Huntship.modeFor(role))).to.deep.eq(['edit', 'playtest'])
  })
})

describe('Huntship.holdsAtLeast', () => {
  const HoldsCases: [[HuntRole, HuntRole], boolean, string][] = [
    [["smith",    "reviewer"], true,  "a smith holds a reviewer's place, and more"],
    [["reviewer", "smith"],    false, "a reviewer holds less than a smith's"],
    [["smith",    "smith"],    true,  'a smith holds its own'],
    [["reviewer", "reviewer"], true,  'a reviewer holds its own'],
  ]
  for (const [[held, role], expected, describes] of HoldsCases) {
    it(describes, () => {
      expect(Huntship.holdsAtLeast(held, role)).to.eq(expected)
    })
  }
})

describe('Huntship.mayOpen', () => {
  const user_id = 'm57a2835q9kp1gefja107b9bfh8fnpvr' as Id<'users'>
  const hunt_id = 'k17ah9c4r1hm0z5y1ad0bbn7wn7fn9x1' as Id<'hunts'>
  const Alice = userActor(user_id, 'alice_smiths', { admin: true })
  const ClaimsAs = {
    smith:     Actor.claimsOn(Alice, hunt_id, { role: 'smith' }),
    reviewer:  Actor.claimsOn(Alice, hunt_id, { role: 'reviewer' }),
    stranger:  Actor.claimsOn(Alice, hunt_id, null),
    unlabelled: Actor.claimsOn(Actor.unlabelled, hunt_id, null),
  } as const

  it('shows a smith either mode, a reviewer only the playtest, and nobody else either', () => {
    const table = Object.values(ClaimsAs).map((claims) => ModeVals.map((mode) => Huntship.mayOpen(claims, mode)))
    expect(ModeVals).to.deep.eq(['edit', 'playtest'])
    expect(table).to.deep.eq([[true, true], [false, true], [false, false], [false, false]])
  })

  it("shows each role the mode the app's links open for it", () => {
    for (const role of HuntRoleVals) {
      expect(Huntship.mayOpen(ClaimsAs[role], Huntship.modeFor(role))).to.be.true
    }
  })
})
