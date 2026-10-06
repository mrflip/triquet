import { describe, expect, it } from 'vitest'
import * as Z from 'zod'
import { SignalGrainMs, SignalValidators } from '../../src/models/signal'

const Row = { hunt_id: '01a0dc10-c9be-7cb3-9d3a-25fc68cd12f9', quiz_id: '01a0dc10-c9be-7cb3-9d3a-25fc68cd12fa', changed_at: 1_759_700_000_000 } as const

describe('SignalValidators.row', () => {
  it("takes a quiz's signal: its hunt, its quiz, and when it last moved", () => {
    expect(SignalValidators.row(Row)).to.deep.eq(Row)
  })

  const Refused: [object, string][] = [
    [{ changed_at: 0 },          'a time before there were any'],
    [{ changed_at: 1.5 },        'a time between milliseconds'],
    [{ changed_at: undefined },  'no time: a signal is made when it first moves'],
    [{ quiz_id: 'nope' },        'a quiz that is not a row id'],
    [{ hunt_id: undefined },     'no hunt, whose smiths alone are told of it'],
  ]
  for (const [overrides, describes] of Refused) {
    it(`refuses ${describes}`, () => {
      expect(() => SignalValidators.row({ ...Row, ...overrides })).to.throw(Z.ZodError)
    })
  }
})

describe('SignalGrainMs', () => {
  it("is a few seconds: short beside the minutes a history may lag, long beside a bot's answers", () => {
    expect(SignalGrainMs).to.be.within(1000, 10_000)
  })
})
