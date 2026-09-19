import * as Z from 'zod'
import { describe, expect, it } from 'vitest'
import { MirrorSettings } from '../../src/models/mirror-settings'

// A refusal is asserted by its type rather than its wording: what matters here is that a bad
// wait does not get through, not how the reporter happens to phrase it this month. The wording
// is pinned once, in tests/lib/vv/reporting.test.ts.
const Refusal = Z.ZodError

const fillWith = (wait: unknown) => () => MirrorSettings.fill({ commit_debounce_seconds: wait as number })

describe('MirrorSettings.fill', () => {
  it('waits 30 seconds unless told otherwise', () => {
    expect(MirrorSettings.fill({}).commit_debounce_seconds).to.eq(30)
  })

  const AcceptedWaits: [number, string][] = [
    [2,   'the shortest wait, 2, is allowed'],
    [30,  'the customer-facing 30 is allowed'],
    [600, 'the longest wait, 600, is allowed'],
  ]
  for (const [wait, describes] of AcceptedWaits) {
    it(describes, () => {
      expect(fillWith(wait)().commit_debounce_seconds).to.eq(wait)
    })
  }

  const RefusedWaits: [unknown, string][] = [
    // just outside:
    [1,          'one second is under the minimum'],
    [601,        'a second over ten minutes is over the maximum'],
    // not-quite-absurd cases:
    [0,          'zero would commit on every edit, which is the thing this exists to prevent'],
    [-5,         'a negative wait is meaningless'],
    [2.5,        'a fractional wait is not a whole number of seconds'],
    ['30',       'a string is not a number, however numeric it looks'],
    [NaN, 'NaN is not a wait'],
    [Infinity,   'an infinite wait is never'],
    [null,       'null is not the same as absent, which would default'],
  ]
  for (const [wait, describes] of RefusedWaits) {
    it(`refuses: ${describes}`, () => {
      expect(fillWith(wait)).to.throw(Refusal)
    })
  }
})

describe('MirrorSettings.fromEnv', () => {
  const AcceptedEnv: [string | undefined, number, string][] = [
    [undefined, 30,  'an unset variable means the default'],
    ['',        30,  'an empty variable means the default'],
    [' '.repeat(3),     30,  'a blank variable means the default'],
    ['2',       2,   'a variable spelling the minimum'],
    ['600',     600, 'a variable spelling the maximum'],
  ]
  for (const [raw, expected, describes] of AcceptedEnv) {
    it(describes, () => {
      expect(MirrorSettings.fromEnv(raw).commit_debounce_seconds).to.eq(expected)
    })
  }

  const RefusedEnv: [string, string][] = [
    ['1',      'a variable under the minimum stops the app rather than being quietly corrected'],
    ['thirty', 'a variable that is not a number stops the app'],
    ['2.5',    'a fractional variable stops the app'],
  ]
  for (const [raw, describes] of RefusedEnv) {
    it(`refuses: ${describes}`, () => {
      expect(() => MirrorSettings.fromEnv(raw)).to.throw(Refusal)
    })
  }
})
