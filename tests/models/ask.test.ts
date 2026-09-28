import { describe, expect, it } from 'vitest'
import * as Z from 'zod'
import { AskValidators, askError } from '../../src/models/ask'

const LastErr = { message: 'A connection hiccup — try again.', response: { ok: false }, at: 1_700_000_000_000 }

describe('AskValidators.model_tier', () => {
  it('defaults to quick, the tier the app reaches for first', () => {
    expect(AskValidators.model_tier(undefined)).to.eq('quick')
  })

  it('rejects a tier it does not recognize', () => {
    expect(() => AskValidators.model_tier('sonnet' as never)).to.throw(Z.ZodError)
  })
})

describe('AskValidators.lastErr', () => {
  it('keeps the response as whatever JSON came back', () => {
    expect(AskValidators.lastErr(LastErr).response).to.deep.eq({ ok: false })
  })

  it('rejects a failure with no sentence to show the author', () => {
    expect(() => AskValidators.lastErr({ ...LastErr, message: '' })).to.throw(Z.ZodError)
  })
})

describe('askError', () => {
  it('is an error cell carrying the failure, stamped when the failure was', () => {
    expect(askError(LastErr)).to.deep.eq({ status: 'error', message: LastErr.message, updated_at: LastErr.at, last_err: LastErr })
  })
})
