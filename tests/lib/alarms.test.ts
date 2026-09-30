import { describe, expect, it } from 'vitest'
import { ConvexError } from 'convex/values'
import * as Alarms from '../../src/lib/alarms'
import { AppNotices, RefusalNotices } from '../../src/lib/notices'

/** An error as the Convex client raises it for a failed call: its path, the request, what the server said */
function convexMessage(said: string): string {
  return `[CONVEX M(hunts:perform)] [Request ID: 5c0f9a] ${said}\n  Called by client`
}

/** A refusal, as a mutation that called `refuse` rejects with */
function refusal(): ConvexError<{ failurekind: string, message: string }> {
  const data = { failurekind: 'quizLocked', message: RefusalNotices.quizLocked }
  const err = new ConvexError(data)
  err.message = convexMessage(`Server Error\nUncaught ConvexError: ${JSON.stringify(data)}`)
  return err
}

/** An unplanned error a production deployment keeps to itself */
function hiddenServerError(): Error {
  return new Error(convexMessage('Server Error'))
}

describe('Alarms.of', () => {
  it("says a refusal's own reason, under the headline it is given, with no request to send", () => {
    expect(Alarms.of(AppNotices.changeNotKept, refusal())).to.deep.eq({ headline: AppNotices.changeNotKept, notice: RefusalNotices.quizLocked, request_id: null })
  })

  it('names the request when the server kept the reason to itself, so it can be sent to us', () => {
    const alarm = Alarms.of(AppNotices.changeNotKept, hiddenServerError())
    expect(alarm.request_id).to.eq('5c0f9a')
    expect(alarm.notice).to.eq(AppNotices.changeFailed)
  })

  it('says nothing was altered, and names no request, for a failure that never reached the server', () => {
    expect(Alarms.of('Headline', new TypeError('fetch failed'))).to.deep.eq({ headline: 'Headline', notice: AppNotices.changeFailed, request_id: null })
  })

  it('makes do with something thrown that is not an error', () => {
    expect(Alarms.of('Headline', 'just a string').notice).to.eq(AppNotices.changeFailed)
  })
})
