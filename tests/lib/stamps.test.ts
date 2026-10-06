import { describe, expect, it } from 'vitest'
import * as Stamps from '../../src/lib/stamps'

describe('Stamps.of', () => {
  const Cases: [Stamps.StampableT, Stamps.StampsT, string][] = [
    // regular usage:
    [{ _creationTime: 1, created_at: 2, updated_at: 3 },  { created_at: 2, updated_at: 3 },                       'a stamped row: its own'],
    // written before rows were stamped:
    [{ _creationTime: 1_759_700_000_000.5 },              { created_at: 1_759_700_000_000, updated_at: 1_759_700_000_000 }, 'an unstamped row: made, and last edited, in the whole millisecond the database made it'],
    [{ _creationTime: 5.5, updated_at: 9 },               { created_at: 5, updated_at: 9 },                       'one edited since the stamps arrived: made when the database made it, edited since'],
  ]
  for (const [row, stamps, describes] of Cases) {
    it(`reads ${describes}`, () => {
      expect(Stamps.of(row)).to.deep.eq(stamps)
    })
  }
})

describe('Stamps.isUntouched', () => {
  it("is whether a row has not been edited since it was made", () => {
    expect([Stamps.isUntouched({ created_at: 5, updated_at: 5 }), Stamps.isUntouched({ created_at: 5, updated_at: 6 })]).to.deep.eq([true, false])
  })
})

describe('Stamps.isoOf', () => {
  it("writes a stamp as ISO-8601 in UTC, ending in Z, and none as null", () => {
    expect([Stamps.isoOf(0), Stamps.isoOf(Date.UTC(2026, 9, 5, 23, 59, 59, 999)), Stamps.isoOf(null)]).to.deep.eq(['1970-01-01T00:00:00.000Z', '2026-10-05T23:59:59.999Z', null])
  })
})

describe('Stamps.isoStampsOf', () => {
  it("reads the doc block's examples", () => {
    expect(Stamps.isoStampsOf({ created_at: 0, updated_at: null })).to.deep.eq({ created_at: '1970-01-01T00:00:00.000Z', updated_at: null })
    expect(Stamps.isoStampsOf({ _creationTime: 0.5 })).to.deep.eq({ created_at: '1970-01-01T00:00:00.000Z', updated_at: '1970-01-01T00:00:00.000Z' })
  })

  it("writes nothing known for a thing that holds no stamps", () => {
    expect(Stamps.isoStampsOf({})).to.deep.eq({ created_at: null, updated_at: null })
  })

  it("reads a row's own stamps over when the database made it", () => {
    expect(Stamps.isoStampsOf({ _creationTime: 0, created_at: 1000, updated_at: 2000 })).to.deep.eq({ created_at: '1970-01-01T00:00:01.000Z', updated_at: '1970-01-01T00:00:02.000Z' })
  })
})
