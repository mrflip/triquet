import { describe, expect, it } from 'vitest'
import type { Id } from '../../convex/_generated/dataModel'
import type { HuntOpeningT, ShallowHuntT } from '../../src/lib/rows'
import * as Wheel from '../../src/lib/wheel'
import { findingOf } from '../../src/state/use-hunt-opening'

const hunt_id = 'j97d0qbj35dar1v8edndzckvsx8f8h01' as Id<'hunts'>

/** A hunt as its screens hold it, with nothing in it */
function shallowHunt(_id: Id<'hunts'>): ShallowHuntT {
  return { _id, label: 'quiet_otter', org: 'alice_smiths', title: 'Quiet Otter', branch: 'main', created_at: 1_759_700_000_000, updated_at: 1_759_700_000_000, realms: [], wheel: Wheel.defaultWheel(), members: [], role: 'smith' }
}

describe("findingOf", () => {
  const FindingCases: [boolean, HuntOpeningT | undefined, string, string][] = [
    [true,  undefined,                                          'waiting', 'the server has not answered yet'],
    [true,  { why: null, hunt: shallowHunt(hunt_id) },          'found',   'the visitor is on the hunt'],
    [true,  { why: 'notOnHunt', hunt: null, smiths: [] },       'refused', 'the visitor is not on the hunt'],
    [true,  { why: 'noSuchHunt', hunt: null },                  'missing', 'no hunt answers to the label'],
    [false, undefined,                                          'missing', 'the address names something that cannot be a label, so nothing was asked'],
  ]
  for (const [askable, opening, expected, describes] of FindingCases) {
    it(`is ${expected} when ${describes}`, () => {
      expect(findingOf(askable, opening)).to.eq(expected)
    })
  }
})
