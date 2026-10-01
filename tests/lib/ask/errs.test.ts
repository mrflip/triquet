import { describe, expect, it } from 'vitest'
import * as Errs from '../../../src/lib/ask/errs'
import type { AskReplyT } from '../../../src/lib/ask/contract'

const guessReply: AskReplyT = { ok: true, job: 'guess', text: 'Leon', truncated: false, model_tier_applied: 'quick', approx_tokens: 10 }

describe('failureOf', () => {
  it('is the reply itself when the ask failed', () => {
    const failed = { ok: false as const, failurekind: 'rateLimited' as const }
    expect(Errs.failureOf(failed, 'guess')).to.eq(failed)
  })

  it('is null for the answer that was wanted', () => {
    expect(Errs.failureOf(guessReply, 'guess')).to.be.null
  })

  it('reads a success for some other job as an answer this build could not read', () => {
    expect(Errs.failureOf(guessReply, 'ishes')).to.deep.eq({ ok: false, failurekind: 'unreadable' })
  })
})
