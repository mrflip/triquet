import { describe, expect, it } from 'vitest'
import * as Z from 'zod'
import { Ident, IdentValidators } from '../../src/models/ident'
import { IdentingValidators } from '../../src/models/identing'

describe('Ident.labelFor', () => {
  const Cases = [
    ["Flip Kromer",          "flip_kromer",                  'makes words a label'],
    ["  flip  ",             "flip",                         'trims, leaving a label too short for the validator to take'],
    ["Ünïcödé Pérson",       "unicode_person",               'deburrs'],
    ["Philip (flip) Kromer", "philip_flip_kromer",           'drops punctuation, as a name may hold any'],
    ["the_quite_long_name_indeed", "the_quite_long_name_inde", 'stops at 24 characters'],
    ["",                     "",                             'hands back nothing for nothing'],
  ] as const
  for (const [name, label, describes] of Cases) {
    it(describes, () => {
      expect(Ident.labelFor(name)).to.eq(label)
    })
  }
})

describe('Ident.flawIn', () => {
  const Cases = [
    // regular usage:
    ["flip_kromer",                  null,         'takes an ident label'],
    ["flip_kromer_2",                null,         'takes numbers and single underscores after the first letter'],
    ["x".repeat(24),                 null,         'takes as many characters as a label holds'],
    // still being typed:
    ["flip",                         'unfinished', 'finds a label of fewer than six characters unfinished'],
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
    ["supporter",                    null,         'takes a reserved word run on'],
  ] as const
  for (const [label, flaw, describes] of Cases) {
    it(describes, () => {
      expect(Ident.flawIn(label)).to.eq(flaw)
    })
  }

  it('finds no flaw in any label a name makes but a short one', () => {
    const names = ['Flip Kromer', 'Philip (flip) Kromer', 'Ünïcödé Pérson', '1st Flipper', 'the quite long name indeed', '田中 Kromer', '🤔🤔🤔']
    expect(names.map((name) => Ident.flawIn(Ident.labelFor(name)))).to.deep.eq([null, null, null, null, null, null, 'unfinished'])
  })
})

describe('Ident.flawToSay', () => {
  const Cases = [
    ["Flip",        false, 'shape',      'says a misshapen label at once'],
    ["Flip",        true,  'shape',      'says a misshapen label once left'],
    ["flip",        false, null,         'keeps quiet of an unfinished label while it is being typed'],
    ["flip",        true,  'unfinished', 'says an unfinished label once the field is left'],
    ["flip_",       true,  'unfinished', 'says a trailing underscore once the field is left'],
    ["",            true,  null,         'never says anything of an empty field'],
    ["flip_kromer", true,  null,         'says nothing of a label'],
    ["support",     false, null,         'keeps quiet of a reserved word while it is being typed, as it may be on its way to another'],
    ["support",     true,  'reserved',   'says a reserved word once the field is left'],
  ] as const
  for (const [label, left, flaw, describes] of Cases) {
    it(describes, () => {
      expect(Ident.flawToSay(label, left)).to.eq(flaw)
    })
  }
})

describe('Ident.byline', () => {
  it('names an ident by its title, then its label written @label', () => {
    expect(Ident.byline({ label: 'mrflip', title: 'Mrflip' })).to.eq('Mrflip (@mrflip)')
    expect(Ident.byline({ label: 'flip_kromer', title: 'The First' })).to.eq('The First (@flip_kromer)')
  })
})

describe('Ident.atLabel', () => {
  it("writes an ident's label as its byline does, after an @", () => {
    expect(Ident.atLabel({ label: 'flip_kromer' })).to.eq('@flip_kromer')
  })
})

describe('Ident.fill', () => {
  const user_id = 'm57a2835q9kp1gefja107b9bfh8fnpvr'

  it('titles an ident after its label when it is given no title', () => {
    expect(Ident.fill({ label: 'flip_kromer', title: '', user_id })).to.deep.eq({ label: 'flip_kromer', title: 'Flip Kromer', user_id })
    expect(Ident.fill({ label: 'flip_kromer', title: ' '.repeat(3), user_id })).to.deep.eq({ label: 'flip_kromer', title: 'Flip Kromer', user_id })
  })

  it('keeps a title it is given, trimmed', () => {
    expect(Ident.fill({ label: 'flip_kromer', title: ' Flip ', user_id })).to.deep.eq({ label: 'flip_kromer', title: 'Flip', user_id })
  })

  it('holds the session that claimed it, or nobody', () => {
    expect(Ident.fill({ label: 'flip_kromer', title: 'Flip', user_id: null }).user_id).to.be.null
    expect(() => Ident.fill({ label: 'flip_kromer', title: 'Flip' } as never)).to.throw(Z.ZodError)
  })

  const Refused = [
    ['flips',                  'a label shorter than six'],
    ['x'.repeat(25),           'a label longer than twenty-four'],
    ['Flip_Kromer',            'a label that is not one'],
  ] as const
  for (const [label, describes] of Refused) {
    it(`refuses ${describes}`, () => {
      expect(() => Ident.fill({ label, title: 'Flip', user_id: null })).to.throw(Z.ZodError)
    })
  }
})

describe('IdentValidators.identLabel', () => {
  it('takes six to twenty-four characters, inclusive', () => {
    expect(['sixsix', 'x'.repeat(24)].map((label) => IdentValidators.identLabel.safeParse(label).success)).to.deep.eq([true, true])
    expect(['fivee', 'x'.repeat(25)].map((label) => IdentValidators.identLabel.safeParse(label).success)).to.deep.eq([false, false])
  })
})

describe('IdentingValidators.row', () => {
  const user_id = 'm57a2835q9kp1gefja107b9bfh8fnpvr'
  const ident_id = 'j97d0qbj35dar1v8edndzckvsx8f828f'

  it('names the session, and the ident it took on, each by its row id', () => {
    expect(IdentingValidators.row({ user_id, ident_id })).to.deep.eq({ user_id, ident_id })
  })

  it('refuses a session that is not a row id, or no session at all', () => {
    expect(() => IdentingValidators.row({ user_id: 'flip_kromer', ident_id })).to.throw(Z.ZodError)
    expect(() => IdentingValidators.row({ ident_id } as never)).to.throw(Z.ZodError)
  })
})
