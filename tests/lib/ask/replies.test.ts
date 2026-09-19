import { describe, expect, it } from 'vitest'
import { clipText, vetReply } from '../../../src/lib/ask/replies'
import type { AskReplyT } from '../../../src/lib/ask/contract'

const guessReply = (text: string): AskReplyT => ({ ok: true, job: 'guess', text, truncated: false, model_tier_applied: 'quick', approx_tokens: 84 })
const ishesReply = (text: string): AskReplyT => ({
  ok: true, job: 'ishes', items: [{ text, value: 3, kind: 'wordish' }], truncated: false, model_tier_applied: 'careful', approx_tokens: 84,
})
const Unreadable = { ok: false, failurekind: 'unreadable' }

describe('clipText', () => {
  it('cuts to what a textish field holds', () => {
    expect(clipText('x'.repeat(5000)).length).to.eq(3600)
  })

  it('leaves shorter text exactly as it was, space and all', () => {
    expect(clipText('  Leon\n')).to.eq('  Leon\n')
  })
})

describe('vetReply', () => {
  it('passes a reply through untrimmed', () => {
    expect(vetReply(guessReply('  Leon, probably?\n'))).to.deep.eq(guessReply('  Leon, probably?\n'))
  })

  it('clips an overlong reply rather than refusing it', () => {
    const vetted = vetReply(guessReply('x'.repeat(5000)))
    const text = vetted.ok && vetted.job === 'guess' ? vetted.text : ''
    expect(text).to.have.length(3600)
  })

  it('clips each span of an extraction, and each span of a batch', () => {
    const vetted = vetReply(ishesReply('three'.repeat(1000)))
    expect(vetted.ok && vetted.job === 'ishes' && vetted.items[0]?.text.length).to.eq(3600)
    const batch = vetReply({ ok: true, job: 'bulk_ishes', groups: [{ key: 'c:q1', items: [{ text: 'x'.repeat(4000), value: 1, kind: 'numeral' }] }], truncated: false, model_tier_applied: 'careful', approx_tokens: 1, text_count: 1 })
    expect(batch.ok && batch.job === 'bulk_ishes' && batch.groups[0]?.items[0]?.text.length).to.eq(3600)
  })

  const Refused: [AskReplyT, string][] = [
    [guessReply('Le\u{1}on'),    'a guess carrying a control character'],
    [guessReply('Leon\u{0}'),    'a guess carrying a NUL'],
    [ishesReply('thr\u{7}ee'),   'a span carrying a control character'],
  ]
  for (const [reply, describes] of Refused) {
    it(`turns ${describes} into an unreadable failure`, () => {
      expect(vetReply(reply)).to.deep.eq(Unreadable)
    })
  }

  it('lets a failure through as it is', () => {
    expect(vetReply({ ok: false, failurekind: 'declined' })).to.deep.eq({ ok: false, failurekind: 'declined' })
  })
})
