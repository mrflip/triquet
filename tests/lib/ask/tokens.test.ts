import { describe, expect, it } from 'vitest'
import { approxTokensFor } from '../../../src/lib/ask/tokens'

describe('approxTokensFor', () => {
  it('estimates from character count across everything it is given', () => {
    expect(approxTokensFor('a'.repeat(400), 'b'.repeat(400))).to.eq(200)
  })

  it('rounds a part-token up, so a tiny ask never reads as free', () => {
    expect(approxTokensFor('ab')).to.eq(1)
  })

  it('reads nothing as nothing', () => {
    expect(approxTokensFor()).to.eq(0)
    expect(approxTokensFor('')).to.eq(0)
  })

  it('treats an absent text as no text rather than failing', () => {
    expect(approxTokensFor(null, undefined, 'abcd')).to.eq(1)
  })
})
