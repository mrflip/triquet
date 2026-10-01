import { describe, expect, it } from 'vitest'
import * as Z from 'zod'
import { AskContract, type AskRequestDNA } from '../../../src/lib/ask/contract'

const Dumdumish: AskRequestDNA = { prompt: 'Question: Which region?', servicelabel: 'claude', model_tier: 'quick', max_tokens: 256 }

describe('AskContract.askRequest', () => {
  it('accepts a rendered prompt with its service, tier and room', () => {
    expect(AskContract.askRequest(Dumdumish)).to.deep.eq(Dumdumish)
  })

  const Refused: [unknown, string][] = [
    [{ ...Dumdumish, prompt: '' },                         'an empty prompt, which would spend usage for nothing'],
    [{ ...Dumdumish, prompt: 'x'.repeat(16_001) },         'a prompt longer than any template filled in from a question could be'],
    [{ ...Dumdumish, prompt: 'Who\u{0}?' },                'a prompt carrying a control character'],
    [{ ...Dumdumish, servicelabel: 'openai' },             'a service the server holds no credentials for'],
    [{ ...Dumdumish, model_tier: 'enormous' },             'a tier it has no model for'],
    [{ ...Dumdumish, max_tokens: 8001 },                   'more room than any widget may ask for'],
    [{ ...Dumdumish, max_tokens: 0 },                      'no room at all'],
    [{ job: 'guess', clueing: 'Which region?' },           "the fixed guess job it no longer takes"],
  ]
  for (const [ask, describes] of Refused) {
    it(`refuses ${describes}`, () => {
      expect(() => AskContract.askRequest(ask as never)).to.throw(Z.ZodError)
    })
  }
})

describe('AskContract.askReply', () => {
  it('carries the object answered with, its tier and its cost', () => {
    const reply = AskContract.askReply({ ok: true, value: { guess: 'Leon' }, truncated: false, model_tier_applied: 'quick', approx_tokens: 84 })
    expect(reply).to.deep.include({ ok: true, value: { guess: 'Leon' } })
  })

  it('carries a failure as a kind, so the wording stays in one place', () => {
    expect(AskContract.askReply({ ok: false, failurekind: 'cutShort' })).to.deep.eq({ ok: false, failurekind: 'cutShort' })
  })

  it('refuses a failure kind with no sentence behind it', () => {
    expect(() => AskContract.askReply({ ok: false, failurekind: 'gremlins' } as never)).to.throw(Z.ZodError)
  })

  it('refuses an answer that is a list rather than an object', () => {
    expect(() => AskContract.askReply({ ok: true, value: [1, 2] as never, truncated: false, model_tier_applied: 'quick', approx_tokens: 1 })).to.throw(Z.ZodError)
  })

  it('refuses an answer too large to keep', () => {
    expect(() => AskContract.askReply({ ok: true, value: { text: 'x'.repeat(40_001) }, truncated: false, model_tier_applied: 'quick', approx_tokens: 1 })).to.throw(Z.ZodError)
  })

  it('refuses the old job-shaped answers', () => {
    expect(() => AskContract.askReply({ ok: true, job: 'guess', text: 'Leon', truncated: false, model_tier_applied: 'quick', approx_tokens: 84 } as never)).to.throw(Z.ZodError)
  })
})
