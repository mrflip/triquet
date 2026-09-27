import { describe, expect, it } from 'vitest'
import { botUnavailableNotice } from '../../src/lib/notices'

describe('botUnavailableNotice', () => {
  const Cases: [[string, string], string, string][] = [
    [["Dumdum", "claude"],   "Dumdum can't play yet — no Claude credentials are set up for this app.",  'names the bot and capitalises the service'],
    [["Numnum", "claude"],   "Numnum can't play yet — no Claude credentials are set up for this app.",  'reads the same for the other bot'],
    [["Nobody", "a"],        "Nobody can't play yet — no A credentials are set up for this app.",        'a one-letter service still capitalises'],
    [["Dumdum", ""],         "Dumdum can't play yet — no  credentials are set up for this app.",         'an empty service does not throw'],
  ]
  for (const [args, expected, describes] of Cases) {
    it(describes, () => {
      expect(botUnavailableNotice(...args)).to.eq(expected)
    })
  }

  it('is a sentence for a person, not a code or a stack trace', () => {
    expect(botUnavailableNotice('Dumdum', 'claude')).not.to.match(/ANTHROPIC|_KEY|error/i)
  })
})
