import { describe, expect, it } from 'vitest'
import * as CK from '../../../../src/lib/vv/checks/contact'
import { accepts, rejects } from '../../../support/checking'

const Ctrl = '\u{1}'

describe('names and address lines', () => {
  it('take ordinary text, trimmed', () => {
    expect(accepts(CK.namestr, '  Fred Sanford  ')).to.eq('Fred Sanford')
    accepts(CK.stradd1, '9114 South Central Ave')
    accepts(CK.city, 'Los Angeles')
  })
  it('take a name that is not plain ASCII, because people have those', () => {
    accepts(CK.familyName, 'Nußbaum')
    accepts(CK.givenName, 'José')
    accepts(CK.familyName, "O'Brien")
    accepts(CK.familyName, '梅田')
  })
  it('refuse an empty one, since a blank name is a missing name', () => {
    rejects(CK.namestr, '')
    rejects(CK.familyName, ' '.repeat(3))
  })
  it('refuse a control character', () => {
    rejects(CK.namestr, `Fred${Ctrl}Sanford`)
  })
  it('cap a name part shorter than a whole line', () => {
    accepts(CK.namepart, 'x'.repeat(40))
    rejects(CK.namepart, 'x'.repeat(41))
    accepts(CK.namestr, 'x'.repeat(82))
    rejects(CK.namestr, 'x'.repeat(83))
  })
})

describe('phone', () => {
  it('takes what people actually type, without trying to parse it', () => {
    accepts(CK.phone, '+1 (555) 867-5309')
    accepts(CK.phone, '5558675309')
    expect(accepts(CK.phone, '  555 1234  ')).to.eq('555 1234')
  })
  it('refuses one longer than any real number', () => {
    rejects(CK.phone, '5'.repeat(41))
  })
})

describe('postcode', () => {
  it('takes the shapes used around the world', () => {
    accepts(CK.postcode, '90210')
    accepts(CK.postcode, '90210-1234')
    accepts(CK.postcode, 'SW1A 1AA')
    accepts(CK.postcode, 'K1A 0B1')
  })
  it('refuses one that could not be a postcode', () => {
    rejects(CK.postcode, '')
    rejects(CK.postcode, 'a')
    rejects(CK.postcode, '-90210')
  })
  it('refuses a number, which is the commonest way to get this wrong', () => {
    expect(rejects(CK.postcode, 90_210)).to.include('is a number but should be text')
  })
})

describe('email', () => {
  const Good = [
    'a@z.com', 'a@z.tw', '101@gmail.com', '101@123wireless1.com',
    'andrew@wash-upon-a-star.com', 'a.gonzo2153@gmail.com', 'whitman@walt.rr.com',
    'a+b@z.com', 'a_____b@z.com', 'a@1n1.com', 'a@z.cookingchannel',
    'bob@themostamericancaranddogwashhooray.com',
  ]
  for (const addr of Good) {
    it(`takes ${addr}`, () => { expect(accepts(CK.email, addr)).to.eq(addr) })
  }

  const Bad: [string, string][] = [
    ['a@com',            'no dot in the domain'],
    ['a@@z.com',         'two at-signs'],
    ['@z.com',           'nothing before the at-sign'],
    ['a@z.c',            'a single-letter TLD'],
    ['.a@z.com',         'a leading dot'],
    ['a.@z.com',         'a trailing dot'],
    ['a..b@z.com',       'two dots together'],
    ['a@-z.com',         'a domain part starting with a dash'],
    ['a@z.com-',         'a trailing dash'],
    ['a@192.168.99.1',   'a bare IP address'],
    ['mötorhead@z.com',  'a non-ASCII local part'],
    ['a b@z.com',        'a space'],
    ['',                 'nothing at all'],
  ]
  for (const [addr, blurb] of Bad) {
    it(`refuses ${blurb}`, () => { rejects(CK.email, addr) })
  }

  it('insists on lowercase, rather than quietly fixing it', () => {
    expect(rejects(CK.email, 'A@z.com')).to.include('should be all lowercase')
  })
  it('refuses one longer than the cap, even when well formed', () => {
    const long = `${'a'.repeat(80)}@z.com`
    expect(rejects(CK.email, long)).to.include('is too long')
  })
  it('says what shape it wanted', () => {
    expect(rejects(CK.email, 'a@com')).to.include('should be a conventional email format')
  })
})
