import { describe, expect, it } from 'vitest'
import { pendingShown, type PendingParams } from '../../src/components/WidgetingPanel'

describe("pendingShown", () => {
  const PendingShownTestCases: [PendingParams | null, string, Record<string, unknown> | null, string][] = [
    // regular usage:
    [null,                                                              '{}',          null,        'nothing pending: what is held'],
    [{ params: { max: 5 }, over: ['{}'], sent: true },                  '{}',          { max: 5 },  'sent, waiting on the watch'],
    [{ params: { max: 5 }, over: ['{}'], sent: true },                  '{"max":5}',   null,        'the watch brought back what was sent'],
    [{ params: { max: 5 }, over: ['{}'], sent: false },                 '{}',          { max: 5 },  'refused: stays while the held do'],
    [{ params: { max: 5 }, over: ['{}'], sent: false },                 '{"min":1}',   null,        'refused, then the held changed'],
    // a change from elsewhere:
    [{ params: { max: 5 }, over: ['{}'], sent: true },                  '{"max":7}',   null,        'sent, and the held moved elsewhere: what is held takes over'],
    // two sent before the watch caught up:
    [{ params: { max: 5, min: 1 }, over: ['{}', '{"max":5}'], sent: true }, '{"max":5}', { max: 5, min: 1 }, 'the first came back: the second still shows'],
    [{ params: { max: 5, min: 1 }, over: ['{}', '{"max":5}'], sent: true }, '{"max":5,"min":1}', null,   'both came back'],
  ]
  it.each(PendingShownTestCases)('%j over %s => %j: %s', (pending, held, expected) => {
    expect(pendingShown(pending, held)).to.deep.equal(expected)
  })
})
