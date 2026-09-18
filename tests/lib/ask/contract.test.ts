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

  it('accepts a batched ask', () => {
    const ask = AskContract.askRequest({ job: 'bulk_ishes', items: [{ key: 'c:aa', text: 'Two' }] })
    expect(ask.job).to.eq('bulk_ishes')
  })

  it('refuses an ask about no text at all, which would spend usage for nothing', () => {
    expect(() => AskContract.askRequest({ job: 'guess', clueing: '' })).to.throw(Z.ZodError)
  })

  it('refuses a batched ask with nothing in it', () => {
    expect(() => AskContract.askRequest({ job: 'bulk_ishes', items: [] })).to.throw(Z.ZodError)
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

  it('refuses an extraction item the model mangled', () => {
    expect(() => AskContract.askReply({
      ok: true, job: 'ishes', items: [{ text: '', value: 1, kind: 'numeral' }],
      truncated: false, model_tier_applied: 'careful', approx_tokens: 10,
    })).to.throw(Z.ZodError)
  })
})
