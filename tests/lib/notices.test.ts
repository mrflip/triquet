import { describe, expect, it } from 'vitest'
import { RefusalNotices, botUnavailableNotice, googleSignInUnfinishedNotice, userUnknownNotice, noSuchHuntNotice, notASmithNotice, notOnHuntNotice, widgetingShownNotice } from '../../src/lib/notices'

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

describe('noSuchHuntNotice', () => {
  it("names the org the address named, and the hunt's label", () => {
    expect(noSuchHuntNotice('pat_smith', 'spring_hunt')).to.eq('There is no hunt labelled “spring_hunt” in ~pat_smith.')
  })

  it("names the label alone for an old address, which names no org", () => {
    expect(noSuchHuntNotice(null, 'spring_hunt')).to.eq('There is no hunt labelled “spring_hunt”.')
  })
})

describe('userUnknownNotice', () => {
  it('names the handle nobody goes by, and says what they must do', () => {
    expect(userUnknownNotice('flip_kromer')).to.eq('Nobody goes by the handle "flip_kromer". They need to visit the app and choose it first.')
  })
})

describe("notOnHuntNotice", () => {
  const Flip = { label: 'flip_kromer', title: 'Flip' }
  const Cases: [Parameters<typeof notOnHuntNotice>[0], string, string][] = [
    [[Flip],                                                                "contact its smith, Flip (flip_kromer), and",                                         'names the one smith by title and label'],
    [[Flip, { label: 'ada_lovelace', title: '' }],                          "contact one of its smiths, Flip (flip_kromer) or ada_lovelace, and",                  'names a smith with no title by label alone, and any of two'],
    [[Flip, { label: 'ada_lovelace', title: 'Ada' }, { label: 'grace_h', title: 'grace_h' }], "contact one of its smiths, Flip (flip_kromer), Ada (ada_lovelace), or grace_h, and", 'names any of several, a title that is the label once'],
    [[],                                                                    "contact a smith of this hunt, and",                                                  'asks a smith of the hunt when none are known'],
  ]
  for (const [smiths, says, describes] of Cases) {
    it(describes, () => {
      expect(notOnHuntNotice(smiths, 'carol_strays')).to.include(says)
    })
  }

  it("says they are not yet a member, to contact the smith for an invitation, and the handle to invite", () => {
    expect(notOnHuntNotice([Flip], 'ada_lovelace')).to.eq('You are not yet a member of this hunt. To be invited, contact its smith, Flip (flip_kromer), and give them your handle, “ada_lovelace”. This page opens for you as soon as they add you.')
  })
})

describe("notASmithNotice", () => {
  it("says they are a reviewer, and who could make them a smith and where", () => {
    expect(notASmithNotice([{ label: 'flip_kromer', title: 'Flip' }], 'ada_lovelace')).to.eq('You are a reviewer on this hunt, not a smith. Ask Flip (flip_kromer) to make you one: they can change the role of your handle, “ada_lovelace”, in the Members panel beneath any of its quizzes.')
  })
})

describe('widgetingShownNotice', () => {
  it('names the one column showing a widgeting, and what to do first', () => {
    expect(widgetingShownNotice(['Sum'])).to.eq('The column “Sum” still shows that widgeting — remove the column first.')
  })

  it('names every column showing it, as a list', () => {
    expect(widgetingShownNotice(['Masie', 'Artie', 'Poppy'])).to.eq('The columns “Masie”, “Artie”, and “Poppy” still show that widgeting — remove them first.')
  })

  it("says the refusal's own sentence when it knows no column by name", () => {
    expect(widgetingShownNotice([])).to.eq(RefusalNotices.widgetingShown)
  })
})

describe('googleSignInUnfinishedNotice', () => {
  it("tells a browser it is still the handle it was, or still signed in as before when it holds none", () => {
    expect(googleSignInUnfinishedNotice('flip_kromer')).to.eq("You're still flip_kromer, as before. Try again.")
    expect(googleSignInUnfinishedNotice(null)).to.eq("You're still signed in as before. Try again.")
  })
})

