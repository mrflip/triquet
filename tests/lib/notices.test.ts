import { describe, expect, it } from 'vitest'
import { botUnavailableNotice, identUnknownNotice, notASmithNotice, notOnHuntNotice } from '../../src/lib/notices'

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

describe('identUnknownNotice', () => {
  it('names the label no ident answers to, and says what they must do', () => {
    expect(identUnknownNotice('flip_kromer')).to.eq('No ident is labelled "flip_kromer". They need to visit the app and choose it first.')
  })
})

describe("notOnHuntNotice", () => {
  const Flip = { label: 'flip_kromer', title: 'Flip' }
  const Cases: [Parameters<typeof notOnHuntNotice>[0], string, string][] = [
    [[Flip],                                                                "Ask Flip (flip_kromer) to please add you",                                  'names the one smith by title and label'],
    [[Flip, { label: 'ada_lovelace', title: '' }],                          "Ask Flip (flip_kromer) or ada_lovelace to please add you",                  'names a smith with no title by label alone, and any of two'],
    [[Flip, { label: 'ada_lovelace', title: 'Ada' }, { label: 'grace_h', title: 'grace_h' }], "Ask Flip (flip_kromer), Ada (ada_lovelace), or grace_h to please add you", 'names any of several, a title that is the label once'],
    [[],                                                                    "Ask a smith of this hunt to please add you",                                'asks a smith of the hunt when none are known'],
  ]
  for (const [smiths, says, describes] of Cases) {
    it(describes, () => {
      expect(notOnHuntNotice(smiths, 'carol_strays')).to.include(says)
    })
  }

  it("says they are not yet a member, and names the ident a smith would add and where", () => {
    expect(notOnHuntNotice([Flip], 'ada_lovelace')).to.eq('You are not yet a member of this hunt. Ask Flip (flip_kromer) to please add you: they can put your ident, “ada_lovelace”, on the hunt from the Members panel beneath any of its quizzes, and this page opens for you as soon as they do.')
  })
})

describe("notASmithNotice", () => {
  it("says they are a reviewer, and who could make them a smith and where", () => {
    expect(notASmithNotice([{ label: 'flip_kromer', title: 'Flip' }], 'ada_lovelace')).to.eq('You are a reviewer on this hunt, not a smith. Ask Flip (flip_kromer) to make you one: they can change the role of your ident, “ada_lovelace”, in the Members panel beneath any of its quizzes.')
  })
})
