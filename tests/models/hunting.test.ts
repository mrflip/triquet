import { describe, expect, it } from 'vitest'
import * as Z from 'zod'
import { Hunting, HuntingValidators, HuntRoleVals } from '../../src/models/hunting'
import { ActVals } from '../../src/lib/routes'

const Row = { hunt_id: '01a0dc10-c9be-7cb3-9d3a-25fc68cd12f9', ident_id: '01a0dc10-c9be-7cb3-9d3a-25fc68cd12fa', role: 'smith' } as const

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
  ]
  for (const [overrides, describes] of Refused) {
    it(`refuses ${describes}`, () => {
      expect(() => HuntingValidators.row({ ...Row, ...overrides })).to.throw(Z.ZodError)
    })
  }
})

describe('Hunting.actFor', () => {
  it('shows a smith the workbench and a reviewer the review', () => {
    expect(HuntRoleVals.map((role) => Hunting.actFor(role))).to.deep.eq(['smith', 'review'])
  })
})

describe('Hunting.mayAct', () => {
  it('shows a smith either presentation, and a reviewer only the review', () => {
    const table = HuntRoleVals.map((role) => ActVals.map((act) => Hunting.mayAct(role, act)))
    expect(ActVals).to.deep.eq(['smith', 'review'])
    expect(table).to.deep.eq([[true, true], [false, true]])
  })

  it('shows each role the presentation it is sent to', () => {
    for (const role of HuntRoleVals) {
      expect(Hunting.mayAct(role, Hunting.actFor(role))).to.be.true
    }
  })
})
