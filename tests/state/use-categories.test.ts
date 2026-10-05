import { describe, expect, it } from 'vitest'
import type { OptimisticLocalStore } from 'convex/browser'
import type { Id } from '../../convex/_generated/dataModel'
import type { HuntOpeningT, ShallowHuntT } from '../../src/lib/rows'
import * as Wheel from '../../src/lib/wheel'
import { showArranged } from '../../src/state/use-categories'

const hunt_id = 'j97d0qbj35dar1v8edndzckvsx8f8h01' as Id<'hunts'>
const other_id = 'j97d0qbj35dar1v8edndzckvsx8f8h02' as Id<'hunts'>

/** A hunt as its screens hold it, with nothing in it */
function shallowHunt(_id: Id<'hunts'>): ShallowHuntT {
  return { _id, label: 'quiet_otter', title: 'Quiet Otter', branch: 'main', realms: [], wheel: Wheel.defaultWheel(), members: [], role: 'smith' }
}

/** A stand-in for the client's watched results: every opening it holds, and what was written back */
function storeHolding(openings: { args: { hunt_label: string }, value: HuntOpeningT | undefined }[]) {
  const written: { args: unknown, value: unknown }[] = []
  const store = {
    getAllQueries: () => openings,
    setQuery:      (_query: unknown, args: unknown, value: unknown) => { written.push({ args, value }) },
  } as unknown as OptimisticLocalStore
  return { store, written }
}

describe("showArranged", () => {
  const wheel = Wheel.placed(Wheel.defaultWheel(), 'tv', 'pool')
  const arranging = { action: { kind: 'arrange_categories' as const, hunt_id, wheel } }

  it("shows the arranged hunt's every watched opening with its new wheel at once", () => {
    const args = { hunt_label: 'quiet_otter' }
    const { store, written } = storeHolding([{ args, value: { why: null, hunt: shallowHunt(hunt_id) } }])
    showArranged(store, arranging)
    expect(written).to.deep.eq([{ args, value: { why: null, hunt: { ...shallowHunt(hunt_id), wheel } } }])
  })

  it("leaves another hunt's opening, one still on its way, and one shown to a stranger alone", () => {
    const args = { hunt_label: 'other' }
    const { store, written } = storeHolding([
      { args, value: { why: null, hunt: shallowHunt(other_id) } },
      { args, value: undefined },
      { args, value: { why: 'notOnHunt', hunt: null, smiths: [] } },
    ])
    showArranged(store, arranging)
    expect(written).to.deep.eq([])
  })

  it("shows nothing early for any other account action", () => {
    const args = { hunt_label: 'quiet_otter' }
    const { store, written } = storeHolding([{ args, value: { why: null, hunt: shallowHunt(hunt_id) } }])
    showArranged(store, { action: { kind: 'retitle_hunt', hunt_id, title: 'Autumn' } })
    expect(written).to.deep.eq([])
  })
})
