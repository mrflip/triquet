import { describe, expect, it } from 'vitest'
import * as Z from 'zod'
import type { Id } from '../../convex/_generated/dataModel'
import * as Actor from '../../src/lib/actor'
import { Hunting, HuntingValidators, HuntRoleVals } from '../../src/models/hunting'
import { ModeVals } from '../../src/lib/addresses'

const Row = { hunt_id: '01a0dc10-c9be-7cb3-9d3a-25fc68cd12f9', ident_id: '01a0dc10-c9be-7cb3-9d3a-25fc68cd12fa', ident_label: 'flip_kromer', ident_title: 'Flip', role: 'smith' } as const

describe('HuntingValidators.row', () => {
  it('takes each role', () => {
    for (const role of HuntRoleVals) {
      expect(HuntingValidators.row({ ...Row, role })).to.deep.eq({ ...Row, role })
    }
  })

  const Refused: [object, string][] = [
    [{ role: 'owner' },        'a role that is not one'],
    [{ role: undefined },      'no role: a hunting always says what it is'],
    [{ hunt_id: 'nope' },      'a hunt that is not a row id'],
    [{ ident_id: undefined },  'no ident'],
    [{ ident_label: 'Flip K' }, "an ident's label that is not one"],
    [{ ident_title: '' },      "an ident's title left blank, which no ident has"],
    [{ ident_title: undefined }, "no title for its ident"],
  ]
  for (const [overrides, describes] of Refused) {
    it(`refuses ${describes}`, () => {
      expect(() => HuntingValidators.row({ ...Row, ...overrides })).to.throw(Z.ZodError)
    })
  }
})

describe('Hunting.modeFor', () => {
  it('opens the workbench for a smith and the playtest for a reviewer', () => {
    expect(HuntRoleVals.map((role) => Hunting.modeFor(role))).to.deep.eq(['edit', 'playtest'])
  })
})

describe('Hunting.mayOpen', () => {
  const user_id = 'm57a2835q9kp1gefja107b9bfh8fnpvr' as Id<'users'>
  const hunt_id = 'k17ah9c4r1hm0z5y1ad0bbn7wn7fn9x1' as Id<'hunts'>
  const Alice = Actor.asIdent(user_id, { _id: 'j97d0qbj35dar1v8edndzckvsx8f828f' as Id<'idents'>, label: 'alice_smiths' }, true)
  const ClaimsAs = {
    smith:     Actor.claimsOn(Alice, hunt_id, { role: 'smith' }),
    reviewer:  Actor.claimsOn(Alice, hunt_id, { role: 'reviewer' }),
    stranger:  Actor.claimsOn(Alice, hunt_id, null),
    anonymous: Actor.claimsOn(Actor.anonymous, hunt_id, null),
  } as const

  it('shows a smith either mode, a reviewer only the playtest, and nobody else either', () => {
    const table = Object.values(ClaimsAs).map((claims) => ModeVals.map((mode) => Hunting.mayOpen(claims, mode)))
    expect(ModeVals).to.deep.eq(['edit', 'playtest'])
    expect(table).to.deep.eq([[true, true], [false, true], [false, false], [false, false]])
  })

  it("shows each role the mode the app's links open for it", () => {
    for (const role of HuntRoleVals) {
      expect(Hunting.mayOpen(ClaimsAs[role], Hunting.modeFor(role))).to.be.true
    }
  })
})
