import { describe, expect, it } from 'vitest'
import * as Z from 'zod'
import { GuessValidators } from '../../src/models/guess'

describe('GuessValidators.guess', () => {
  it('reads null as never asked', () => {
    expect(GuessValidators.guess(null)).to.eq(null)
  })

  it('keeps the model\'s own wording, trimmed as any note is', () => {
    const guess = GuessValidators.guess({ status: 'done', text: '  Leon, probably?  ', updated_at: 1 })
    expect(guess?.status === 'done' && guess.text).to.eq('Leon, probably?')
  })

  it('refuses an answer carrying control characters', () => {
    expect(() => GuessValidators.guess({ status: 'done', text: 'Le\u{1}on', updated_at: 1 })).to.throw(Z.ZodError)
  })

  it('accepts an empty answer, which is a different thing from never having asked', () => {
    const guess = GuessValidators.guess({ status: 'done', text: '', updated_at: 1 })
    expect(guess?.status).to.eq('done')
  })

  it('records which tier answered and what it cost', () => {
    const guess = GuessValidators.guess({ status: 'done', text: 'Leon', model_tier_applied: 'quick', approx_tokens: 84, updated_at: 1 })
    expect(guess).to.deep.include({ model_tier_applied: 'quick', approx_tokens: 84, truncated: false })
  })

  it('defaults an unspecified tier to quick', () => {
    const guess = GuessValidators.guess({ status: 'done', text: 'Leon', updated_at: 1 })
    expect(guess).to.deep.include({ model_tier_applied: 'quick' })
  })

  it('rejects a tier it does not recognize', () => {
    expect(() => GuessValidators.guess({ status: 'done', text: 'Leon', model_tier_applied: 'sonnet' as never, updated_at: 1 })).to.throw(Z.ZodError)
  })

  it('rejects an error with no message, which would read as an empty cell', () => {
    expect(() => GuessValidators.guess({ status: 'error', message: '', updated_at: 1 })).to.throw(Z.ZodError)
  })
})
