import { describe, expect, it } from 'vitest'
import * as Z from 'zod'
import type { Id } from '../../convex/_generated/dataModel'
import { User, UserValidators } from '../../src/models/user'

describe('User.labelFor', () => {
  const Cases = [
    ["Flip Kromer",          "flip_kromer",                  'makes words a label'],
    ["  flo  ",              "flo",                          'trims, leaving a label too short for the validator to take'],
    ["Ünïcödé Pérson",       "unicode_person",               'deburrs'],
    ["Philip (flip) Kromer", "philip_flip_kromer",           'drops punctuation, as a name may hold any'],
    ["the_quite_long_name_indeed", "the_quite_long_name_inde", 'stops at 24 characters'],
    ["2nd Avenue Puzzle Solvers Club", "z2nd_avenue_puzzle_solve", 'stops at 24 characters, the z before a leading digit counted in'],
    ["",                     "",                             'hands back nothing for nothing'],
  ] as const
  for (const [name, label, describes] of Cases) {
    it(describes, () => {
      expect(User.labelFor(name)).to.eq(label)
      expect(User.labelFor(name).length).to.be.at.most(24)
    })
  }
})

describe('User.suggestionsFor', () => {
  const Cases = [
    // regular usage:
    [{ name: "Flip Kromer", email: "flip.kromer@example.com" }, ["flip_kromer", "flip_kromer_2"], 'offers the name first, then numbered, the email making the same one adding nothing'],
    [{ name: "Flip Kromer", email: "mrflip@example.com" },      ["flip_kromer", "mrflip"],        'offers the email before the @ after the name'],
    [{ email: "mrflip@example.com" },                           ["mrflip", "mrflip_2"],           'offers the email alone where Google sent no name'],
    [{ name: "Flip", email: "flip@example.com" },               ["flip", "flip_2"],               "offers a name of four letters, the fewest a userlabel holds, as it is"],
    // mended or dropped:
    [{ name: "Jo", email: "jo@example.com" },                   ["jo_2", "jo_3"],                 'mends a name too short to be a userlabel by numbering it'],
    [{ name: "J" },                                             ["jz_2", "jz_3"],                 "mends a one-letter name, padded as every label is, by numbering it"],
    [{ name: "Handles", email: "mrflip@example.com" },          ["mrflip", "handles_2"],          'never offers a reserved word'],
    [{ name: "Google Fan", email: "support@example.com" },      [],                               'offers nothing where every word is kept, numbered or not'],
    [{ name: "The Quite Long Name Indeed" },                    ["the_quite_long_name_inde", "the_quite_long_name_in_2"], 'cuts a long one short to leave room for its number'],
    [{ name: "Abcdefghijklmnopqrstu Vw" },                      ["abcdefghijklmnopqrstu_vw", "abcdefghijklmnopqrstu_2"],  'keeps one cut short from ending in an underscore before its number'],
    // nothing to go on:
    [{},                                                        [],                               'offers nothing for nothing'],
    [{ name: "  ", email: "@example.com" },                     [],                               'offers nothing for a blank name and an email with nothing before its @'],
  ] as const
  for (const [profile, firstTwo, describes] of Cases) {
    it(describes, () => {
      expect(User.suggestionsFor(profile).slice(0, 2)).to.deep.eq(firstTwo)
    })
  }

  it('offers only userlabels a person could claim, each once', () => {
    const offered = User.suggestionsFor({ name: 'Flip Kromer', email: 'flip_kromer@example.com' })
    expect(offered.filter((label) => User.flawIn(label) !== null)).to.deep.eq([])
    expect(offered).to.have.lengthOf(9)
    expect(new Set(offered).size).to.eq(offered.length)
  })

  it('matches its examples', () => {
    expect(User.suggestionsFor({ name: 'Flip Kromer', email: 'flip@example.com' }).slice(0, 3)).to.deep.eq(['flip_kromer', 'flip', 'flip_kromer_2'])
    expect(User.suggestionsFor({ email: 'jo@example.com' }).slice(0, 2)).to.deep.eq(['jo_2', 'jo_3'])
    expect(User.suggestionsFor({})).to.deep.eq([])
  })
})

describe('User.flawIn', () => {
  const Cases = [
    // regular usage:
    ["flip_kromer",                  null,         'takes a userlabel'],
    ["flip_kromer_2",                null,         'takes numbers and single underscores after the first letter'],
    ["x".repeat(24),                 null,         'takes as many characters as a label holds'],
    ["flip",                         null,         "takes as few characters as a userlabel holds"],
    // still being typed:
    ["flo",                          'unfinished', "finds a label of fewer than four characters unfinished"],
    ["",                             'unfinished', 'finds nothing typed unfinished, not misshapen'],
    ["flip_kromer_",                 'unfinished', 'finds a trailing underscore unfinished, as typing on would mend it'],
    // no typing on mends it:
    ["Flip_Kromer",                  'shape',      'refuses a capital, rather than folding it away'],
    ["flip kromer",                  'shape',      'refuses a space, rather than making it an underscore'],
    [" flip_kromer",                 'shape',      'refuses a space around it, rather than trimming it'],
    ["flip-kromer",                  'shape',      'refuses a hyphen'],
    ["flip__kromer",                 'shape',      'refuses two underscores in a row'],
    ["1flipper",                     'shape',      'refuses a number first'],
    ["_flipper",                     'shape',      'refuses an underscore first'],
    ["flïp_kromer",                  'shape',      'refuses an accented letter'],
    ["x".repeat(25),                 'shape',      'refuses more characters than a label holds'],
    ["fl!",                          'shape',      'says a misshapen character before saying unfinished'],
    // kept for the app's own use:
    ["support",                      'reserved',   'finds a top-level word reserved'],
    ["security_desk",                'reserved',   'finds a label beginning secur reserved'],
    ["constructor",                  'reserved',   'finds a word no label may be reserved'],
    ["stafford",                     null,         'takes a reserved word run on, where no prefix is kept'],
  ] as const
  for (const [label, flaw, describes] of Cases) {
    it(describes, () => {
      expect(User.flawIn(label)).to.eq(flaw)
    })
  }

  it('finds no flaw in any label a name makes but a short one', () => {
    const names = ['Flip Kromer', 'Philip (flip) Kromer', 'Ünïcödé Pérson', '1st Flipper', 'the quite long name indeed', '2nd Avenue Puzzle Solvers Club', '田中 Kromer', '🤔🤔🤔']
    expect(names.map((name) => User.flawIn(User.labelFor(name)))).to.deep.eq([null, null, null, null, null, null, null, 'unfinished'])
  })
})

describe('User.flawToSay', () => {
  const Cases = [
    ["Flip",        false, 'shape',      'says a misshapen label at once'],
    ["Flip",        true,  'shape',      'says a misshapen label once left'],
    ["flo",         false, null,         'keeps quiet of an unfinished label while it is being typed'],
    ["flo",         true,  'unfinished', 'says an unfinished label once the field is left'],
    ["flip_",       true,  'unfinished', 'says a trailing underscore once the field is left'],
    ["",            true,  null,         'never says anything of an empty field'],
    ["flip_kromer", true,  null,         'says nothing of a label'],
    ["system",      false, null,         'keeps quiet of a reserved word while it is being typed, as it may be on its way to another (systematic)'],
    ["support",     true,  'reserved',   'says a reserved word once the field is left'],
  ] as const
  for (const [label, left, flaw, describes] of Cases) {
    it(describes, () => {
      expect(User.flawToSay(label, left)).to.eq(flaw)
    })
  }
})

describe('User.byline', () => {
  it('names a user by its title, then its userlabel written @label', () => {
    expect(User.byline({ userlabel: 'mrflip', title: 'Mrflip' })).to.eq('Mrflip (@mrflip)')
    expect(User.byline({ userlabel: 'flip_kromer', title: 'The First' })).to.eq('The First (@flip_kromer)')
  })
})

describe('User.atLabel', () => {
  it("writes a user's userlabel as its byline does, after an @", () => {
    expect(User.atLabel({ userlabel: 'flip_kromer' })).to.eq('@flip_kromer')
  })
})

describe('User.labelled', () => {
  it('titles a user after its userlabel when it is given no title', () => {
    expect(User.labelled('flip_kromer', '')).to.deep.eq({ userlabel: 'flip_kromer', title: 'Flip Kromer' })
    expect(User.labelled('flip_kromer', ' '.repeat(3))).to.deep.eq({ userlabel: 'flip_kromer', title: 'Flip Kromer' })
  })

  it('keeps a title it is given, trimmed', () => {
    expect(User.labelled('flip_kromer', ' Flip ')).to.deep.eq({ userlabel: 'flip_kromer', title: 'Flip' })
  })

  const Refused = [
    ['flo',                    "a userlabel shorter than four"],
    ['x'.repeat(25),           'a userlabel longer than twenty-four'],
    ['Flip_Kromer',            'a userlabel that is not one'],
    ['support',                'a word kept for the app\'s own use'],
    ['google_fan',             'a word kept for the app\'s own use since it was claimed, as a merge would take it over'],
  ] as const
  for (const [userlabel, describes] of Refused) {
    it(`refuses ${describes}`, () => {
      expect(() => User.labelled(userlabel, 'Flip')).to.throw(Z.ZodError)
    })
  }
})

describe('User.fromGoogle', () => {
  /** What Google says only while it holds, none of it said: each taken away by a patch */
  const Unsaid = { emailVerificationTime: undefined, locale: undefined, hosted_domain: undefined }

  it('is a user signed in with Google, holding the email, name and picture Google sent', () => {
    expect(User.fromGoogle({ email: 'flip@example.com', name: 'Flip' })).to.deep.eq({ isAnonymous: false, email: 'flip@example.com', name: 'Flip', ...Unsaid })
    expect(User.fromGoogle({ email: 'f@example.com', name: 'F', image: 'https://lh3.googleusercontent.com/a/f' })).to.deep.eq({ isAnonymous: false, email: 'f@example.com', name: 'F', image: 'https://lh3.googleusercontent.com/a/f', ...Unsaid })
  })

  it('holds when Google said the email is verified, the locale and the Workspace domain, when Google sent them', () => {
    const sent = { email: 'flip@example.com', emailVerificationTime: 1_760_300_000_000, locale: 'en-GB', hosted_domain: 'example.com' }
    expect(User.fromGoogle(sent)).to.deep.eq({ isAnonymous: false, ...sent })
  })

  it('drops anything else Google sends, so a profile cannot set a userlabel, an admin flag, or anonymity', () => {
    const sent = { email: 'flip@example.com', given_name: 'Flip', userlabel: 'mrflip', admin: true, isAnonymous: true } as never
    expect(User.fromGoogle(sent)).to.deep.eq({ isAnonymous: false, email: 'flip@example.com', ...Unsaid })
  })

  it('is no longer anonymous even when Google sends nothing', () => {
    expect(User.fromGoogle({})).to.deep.eq({ isAnonymous: false, ...Unsaid })
  })
})

describe('User.provisional', () => {
  it('is a user signed in with Google, holding what Google sent, marked provisional', () => {
    expect(User.provisional({ email: 'flip@example.com' })).to.deep.eq({ isAnonymous: false, email: 'flip@example.com', provisional: true, emailVerificationTime: undefined, locale: undefined, hosted_domain: undefined })
  })
})

describe('User.mergedInto', () => {
  const into_user_id = 'm57a2835q9kp1gefja107b9bfh8fnpvr' as Id<'users'>
  const account_id = '10000000000000000000authAccounts' as Id<'authAccounts'>

  it('is the mark of a user merged away: the user it merged into, and the account whose sign-in did it', () => {
    expect(User.mergedInto(into_user_id, account_id)).to.deep.eq({ merged: { into_user_id, account_id } })
  })

  it('refuses what is not a row id', () => {
    expect(() => User.mergedInto('nobody' as Id<'users'>, account_id)).to.throw(Z.ZodError)
  })
})

describe('User.titleFor', () => {
  it('is the title as given, or the userlabel titleized when blank', () => {
    expect([User.titleFor('flip_kromer', ''), User.titleFor('flip_kromer', 'Flip')]).to.deep.eq(['Flip Kromer', 'Flip'])
  })

  it('refuses a title that is not one', () => {
    expect(() => User.titleFor('flip_kromer', 'F'.repeat(83))).to.throw(Z.ZodError)
  })
})

describe('User.titleOf', () => {
  it("is the user's title, when it has one", () => {
    expect(User.titleOf({ userlabel: 'flip_kromer', title: 'Flip' })).to.eq('Flip')
  })

  it("is the userlabel titleized, for a user with none", () => {
    expect(User.titleOf({ userlabel: 'flip_kromer' })).to.eq('Flip Kromer')
  })
})

describe('User.anonymous', () => {
  it('is an anonymous user holding no userlabel, as an anonymous sign-in makes one', () => {
    expect(User.anonymous()).to.deep.eq({ isAnonymous: true })
  })
})

describe('User.isAnonymous', () => {
  it("is Convex Auth's isAnonymous, failing closed: only false, as a Google sign-in writes it, says no", () => {
    expect([User.isAnonymous({ isAnonymous: true }), User.isAnonymous({ isAnonymous: false }), User.isAnonymous({})]).to.deep.eq([true, false, true])
  })
})

describe('User.faceOf', () => {
  const _id = 'm57a2835q9kp1gefja107b9bfh8fnpvr' as Id<'users'>

  it('tells of a user its userlabel, title and whether it is anonymous, and never its email', () => {
    expect(User.faceOf({ _id, userlabel: 'flip_kromer', title: 'Flip', isAnonymous: false, email: 'flip@example.com', name: 'Flip K' } as never)).to.deep.eq({ _id, userlabel: 'flip_kromer', title: 'Flip', anonymous: false })
    expect(User.faceOf({ _id, userlabel: 'flip_kromer', title: 'Flip', isAnonymous: true })).to.deep.eq({ _id, userlabel: 'flip_kromer', title: 'Flip', anonymous: true })
  })

  it('is null for a user holding no userlabel, whom nobody can name', () => {
    expect(User.faceOf({ _id, isAnonymous: true })).to.be.null
  })
})

describe('UserValidators.userlabel', () => {
  it("takes four to twenty-four characters, inclusive", () => {
    expect(['flip', 'x'.repeat(24)].map((label) => UserValidators.userlabel.safeParse(label).success)).to.deep.eq([true, true])
    expect(['flo', 'x'.repeat(25)].map((label) => UserValidators.userlabel.safeParse(label).success)).to.deep.eq([false, false])
  })
})

describe('UserValidators.row', () => {
  it("takes a user with nothing yet, as an anonymous sign-in makes one, and Convex Auth's fields beside ours", () => {
    const row = { name: 'Flip K', image: 'https://example.com/flip.png', email: 'flip@example.com', emailVerificationTime: 1_759_700_000_000, isAnonymous: false, userlabel: 'flip_kromer', title: 'Flip', admin: true }
    expect([UserValidators.row({}), UserValidators.row(row)]).to.deep.eq([{}, row])
  })

  const Refused: [object, string][] = [
    [{ userlabel: 'Flip K' },    'a userlabel that is not one'],
    [{ userlabel: 'google_fan' }, "a userlabel the top-level list keeps, though held already"],
    [{ title: '' },              'a title left blank, which no user has'],
    [{ admin: 'yes' },           'an admin flag that is not a yes or no'],
    [{ isAnonymous: 'true' },    'an isAnonymous that is not a yes or no'],
  ]
  for (const [row, describes] of Refused) {
    it(`refuses ${describes}`, () => {
      expect(() => UserValidators.row(row as never)).to.throw(Z.ZodError)
    })
  }
})
