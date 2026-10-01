import { describe, expect, it } from 'vitest'
import * as Z from 'zod'
import { AskContract } from '../../../src/lib/ask/contract'

describe('AskContract.askRequest', () => {
  it('accepts a guess ask', () => {
    expect(AskContract.askRequest({ job: 'guess', clueing: 'Which region?' }).job).to.eq('guess')
  })

  it('accepts an extraction ask for either text', () => {
    expect(AskContract.askRequest({ job: 'ishes', textkind: 'hint', text: 'BUT NOT 1994' }).job).to.eq('ishes')
  })

  it('refuses an ask about no text at all, which would spend usage for nothing', () => {
    expect(() => AskContract.askRequest({ job: 'guess', clueing: '' })).to.throw(Z.ZodError)
  })

  it('refuses a batched ask, a job it no longer offers', () => {
    expect(() => AskContract.askRequest({ job: 'bulk_ishes', items: [{ key: 'c:aa', text: 'Two' }] } as never)).to.throw(Z.ZodError)
  })

  it('refuses an extraction from a text other than the clueing or the hint', () => {
    expect(() => AskContract.askRequest({ job: 'ishes', textkind: 'answer', text: 'Two' } as never)).to.throw(Z.ZodError)
  })

  it('refuses a job it does not offer', () => {
    expect(() => AskContract.askRequest({ job: 'translate', clueing: 'x' } as never)).to.throw(Z.ZodError)
  })

  it('refuses text longer than a question could plausibly be', () => {
    expect(() => AskContract.askRequest({ job: 'guess', clueing: 'x'.repeat(10_001) })).to.throw(Z.ZodError)
  })
})

describe('AskContract.askReply', () => {
  it('carries a guess with its tier and cost', () => {
    const reply = AskContract.askReply({
      ok: true, job: 'guess', text: 'Leon', truncated: false, model_tier_applied: 'quick', approx_tokens: 84,
    })
    expect(reply).to.deep.include({ ok: true, text: 'Leon' })
  })

  it('carries a failure as a kind, so the wording stays in one place', () => {
    expect(AskContract.askReply({ ok: false, failurekind: 'rateLimited' }))
      .to.deep.eq({ ok: false, failurekind: 'rateLimited' })
  })

  it('refuses a failure kind with no sentence behind it', () => {
    expect(() => AskContract.askReply({ ok: false, failurekind: 'gremlins' } as never)).to.throw(Z.ZodError)
  })

  it('refuses a text missing from a batched run, which no ask can now come back as', () => {
    expect(() => AskContract.askReply({ ok: false, failurekind: 'missingFromRun' } as never)).to.throw(Z.ZodError)
  })

  it('refuses a batched answer, a job it no longer offers', () => {
    expect(() => AskContract.askReply({
      ok: true, job: 'bulk_ishes', groups: [], truncated: false, model_tier_applied: 'careful', approx_tokens: 1, text_count: 0,
    } as never)).to.throw(Z.ZodError)
  })

  it('refuses an extraction item the model mangled', () => {
    expect(() => AskContract.askReply({
      ok: true, job: 'ishes', items: [{ text: '', value: 1, kind: 'numeral' }],
      truncated: false, model_tier_applied: 'careful', approx_tokens: 10,
    })).to.throw(Z.ZodError)
  })
})
