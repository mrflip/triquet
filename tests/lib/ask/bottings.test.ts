import { describe, expect, it } from 'vitest'
import * as Bottings from '../../../src/lib/ask/bottings'
import { AskFailureNotices } from '../../../src/lib/notices'
import { BottingValidators } from '../../../src/models/botting'
import type { GuessReplyT, IshesReplyT } from '../../../src/lib/ask/contract'

const question_id = 'j97d0qbj35dar1v8edndzckvsx8f828f'
const guessCell: Bottings.AskedCell = { question_id, bot_label: 'dumdum', textkind: 'clueing', asked_text: 'Which region?' }
const hintCell:  Bottings.AskedCell = { question_id, bot_label: 'numnum', textkind: 'hint', asked_text: 'BUT NOT the 1994 film' }

const guessReply: GuessReplyT = { ok: true, job: 'guess', text: 'Leon', truncated: false, model_tier_applied: 'quick', approx_tokens: 12 }
const oneSpan = [{ text: '1994', value: 1994, kind: 'numeral' as const }]
const ishesReply: IshesReplyT = { ok: true, job: 'ishes', items: oneSpan, truncated: true, model_tier_applied: 'careful', approx_tokens: 210 }

describe('bottingFor', () => {
  it('records dumdum\'s reply as its text, with what the ask cost', () => {
    const botting = Bottings.bottingFor(guessCell, guessReply)
    expect(botting).to.deep.eq({
      ...guessCell, status: 'done', reply_text: 'Leon', items: [], message: null, response: null,
      truncated: false, model_tier_applied: 'quick', approx_tokens: 12,
    })
  })

  it('records numnum\'s reply as its spans, and whether it was cut short', () => {
    const botting = Bottings.bottingFor(hintCell, ishesReply)
    expect(botting).to.deep.include({ ...hintCell, status: 'done', reply_text: null, items: oneSpan, truncated: true, model_tier_applied: 'careful', approx_tokens: 210 })
  })

  it('is a botting the database will take', () => {
    expect(() => BottingValidators.row(Bottings.bottingFor(guessCell, guessReply))).to.not.throw()
    expect(() => BottingValidators.row(Bottings.bottingFor(hintCell, ishesReply))).to.not.throw()
  })
})

describe('bulkBottingFor', () => {
  it('takes the spans for the cell and what the run said of the whole, with no token figure', () => {
    const botting = Bottings.bulkBottingFor(hintCell, oneSpan, { truncated: false, model_tier_applied: 'careful' })
    expect(botting).to.deep.include({ ...hintCell, status: 'done', items: oneSpan, truncated: false, model_tier_applied: 'careful', approx_tokens: null })
  })
})

describe('failedBottingFor', () => {
  it('keeps the author\'s sentence and the reply as it came back, and no value', () => {
    const failed = { ok: false as const, failurekind: 'rateLimited' as const, detail: { status: 429 } }
    const botting = Bottings.failedBottingFor(guessCell, failed)
    expect(botting).to.deep.eq({
      ...guessCell, status: 'error', reply_text: null, items: [], message: AskFailureNotices.rateLimited, response: failed,
      truncated: false, model_tier_applied: null, approx_tokens: null,
    })
  })

  it('is a botting the database will take', () => {
    expect(() => BottingValidators.row(Bottings.failedBottingFor(hintCell, { ok: false, failurekind: 'connection' }))).to.not.throw()
  })
})
