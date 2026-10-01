import { describe, expect, it } from 'vitest'
import * as Z from 'zod'
import { AskValidators } from '../../src/models/ask'

describe('AskValidators.model_tier', () => {
  it('defaults to quick, the tier the app reaches for first', () => {
    expect(AskValidators.model_tier(undefined)).to.eq('quick')
  })

  it('rejects a tier it does not recognize', () => {
    expect(() => AskValidators.model_tier('sonnet' as never)).to.throw(Z.ZodError)
  })
})

describe('AskValidators.approxTokens', () => {
  it('takes a whole count, nought included', () => {
    expect(AskValidators.approxTokens(0)).to.eq(0)
    expect(AskValidators.approxTokens(412)).to.eq(412)
  })

  it('rejects a fraction or a negative count', () => {
    expect(() => AskValidators.approxTokens(2.5)).to.throw(Z.ZodError)
    expect(() => AskValidators.approxTokens(-1)).to.throw(Z.ZodError)
  })
})
