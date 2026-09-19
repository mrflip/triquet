import * as Z from 'zod'
import { describe, expect, it } from 'vitest'
import * as RR from '../../../src/lib/vv/reporting'

// The error map is installed by tests/support/setup.ts, before this module is imported.

/** The error zod ends up with for `val` against `schema`; the parse must fail */
function errFor(schema: Z.ZodType, val: unknown): Z.ZodError {
  const res = schema.safeParse(val)
  if (res.success) { throw new Error('expected this to fail') }
  return res.error
}

/** The advice on the first issue */
function msgFor(schema: Z.ZodType, val: unknown): string {
  return errFor(schema, val).issues[0]!.message
}

/** The whole explanation, path and value included */
function explainFor(schema: Z.ZodType, val: unknown): string {
  return RR.explain(errFor(schema, val))
}

describe('customError', () => {
  const Cases: [Z.ZodType, unknown, string, string][] = [
    // wrong type:
    [Z.string(),                      42,        'is a number but should be text',                       'a number where text belongs'],
    [Z.number(),                      'x',       'is text but should be a number',                      'text where a number belongs'],
    [Z.boolean(),                     'true',    'is text but should be true/false',                 'text where a boolean belongs'],
    // absent rather than wrong -- the four-way distinction:
    [Z.string(),                      null,      'is nil, should be text',                             'null says nil'],
    [Z.string(),                      undefined, 'is missing, should be text',                    'undefined says missing'],
    // bounds on text:
    [Z.string().min(3),               'x',       'has «1» characters but should have «3» or more',      'too short'],
    [Z.string().max(2),               'xxxx',    'is too long: «4» characters vs «2» available',     'too long'],
    [Z.string().min(1),               '',        'should not be empty',                                  'empty where something was needed'],
    // bounds on numbers:
    [Z.number().min(7),               5,         'should be «7» or more',                                 'below a minimum'],
    [Z.number().max(7),               9,         'should be «7» or less',                                 'above a maximum'],
    // bounds on collections:
    [Z.array(Z.number()).min(1),      [],        'should not be empty',                                  'an empty array'],
    [Z.array(Z.number()).min(3),      [1, 2],    'has «2» items but should have «3» or more',      'too few items'],
    [Z.array(Z.number()).max(0),      [1],       'should be empty',                                   'items where none belong'],
    // formats:
    [Z.string().regex(/^a/),          'b',       'should match pattern',                                'a regex that did not match'],
    [Z.email(),                       'nope',    'should be a email',                                'a malformed email'],
    [Z.string().startsWith('ab'),     'zz',      "should start with «'ab'»",                           'a missing prefix'],
    [Z.string().endsWith('ab'),       'zz',      "should end with «'ab'»",                             'a missing suffix'],
    [Z.string().includes('ab'),       'zz',      "should contain «'ab'»",                              'a missing substring'],
    // values:
    [Z.literal('aa'),                 'bb',      "should be the value «'aa'»",                         'the wrong literal'],
    [Z.enum(['aa', 'bb']),            'zz',      'should be one of aa or bb',                         'outside an enum'],
    // arithmetic:
    [Z.number().multipleOf(7),        9,         'should be an exact multiple of «7»',                    'not a multiple'],
  ]

  for (const [schema, val, wanted, blurb] of Cases) {
    it(blurb, () => { expect(msgFor(schema, val)).to.eq(wanted) })
  }

  it('names the unknown keys, without leading with the whole object', () => {
    const schema = Z.strictObject({ aa: Z.string() })
    expect(msgFor(schema, { aa: 'x', zz: 1 })).to.eq('unknown property zz=«1»')
    expect(msgFor(schema, { aa: 'x', zz: 1, yy: 'two' }))
      .to.eq("unknown properties zz=«1» and yy=«'two'»")
  })

  it('renders a date bound as a date, not as epoch millis', () => {
    const schema = Z.date().min(new Date('2022-05-04T00:00:00Z'))
    expect(msgFor(schema, new Date('1999-01-01T00:00:00Z')))
      .to.eq('should be on or after «2022-05-04T00:00:00.000Z»')
  })

  it('tames a control character rather than emitting it raw', () => {
    expect(explainFor(Z.string().min(20), 'has\na newline')).to.match(/~\^n/)
  })

  it('leaves a code it has no opinion about to zod', () => {
    const schema = Z.string().refine(() => false, { error: 'should be plausible' })
    expect(msgFor(schema, 'x')).to.eq('should be plausible')
  })

  it('keeps zod wording for a union, rather than inventing one', () => {
    const msg = msgFor(Z.union([Z.string(), Z.number()]), true)
    expect(msg).to.be.a('string').and.have.length.greaterThan(0)
  })
})

describe('pathOf', () => {
  const Cases: [PropertyKey[], string, string][] = [
    [[],                    'it',              'the subject itself'],
    [['aa'],                'aa',              'one plain key'],
    [['aa', 'bb'],          'aa.bb',           'nested keys are dotted'],
    [['cuts', 0, 'year'],   'cuts[0].year',    'an index is bracketed, as you would type it'],
    [[0],                   '[0]',             'a leading index'],
    [['aa', 0, 1],          'aa[0][1]',        'two indexes in a row'],
  ]
  for (const [path, wanted, blurb] of Cases) {
    it(blurb, () => { expect(RR.pathOf(path)).to.eq(wanted) })
  }
  it('brackets a key that is not an identifier', () => {
    expect(RR.pathOf(['not-ident'])).to.match(/not-ident/)
  })
})

describe('display', () => {
  it('wraps a value in guillemets', () => {
    expect(RR.display(42)).to.eq('«42»')
    expect(RR.display('aa')).to.eq("«'aa'»")
  })
  it('shows what JSON would drop', () => {
    expect(RR.display(undefined)).to.eq('«undefined»')
    expect(RR.display({ aa: undefined })).to.eq('«{ aa: undefined }»')
  })
  it('trims an enormous value rather than filling the log with it', () => {
    expect(RR.display('x'.repeat(5000))).to.have.length.lessThan(200)
  })
  it('replaces a backslash escape with the greppable marker', () => {
    expect(RR.display('a\nb')).to.eq("«'a~^nb'»")
  })
})

describe('vacancy', () => {
  it('has a different word for each kind of absence', () => {
    expect(RR.vacancy(undefined)).to.eq('missing')
    expect(RR.vacancy(null)).to.eq('nil')
    expect(RR.vacancy('')).to.eq('blank')
    expect(RR.vacancy(NaN)).to.eq('an invalid number')
  })
  it('says nothing about a value that is actually there', () => {
    expect(RR.vacancy(0)).to.eq(null)
    expect(RR.vacancy(false)).to.eq(null)
    expect(RR.vacancy([])).to.eq(null)
  })
})

describe('reading a failed parse', () => {
  const cut    = Z.object({ year: Z.number() })
  const schema = Z.object({
    title:  Z.string().min(1),
    lumens: Z.number().max(200),
    cuts:   Z.array(cut),
  })
  const err = errFor(schema, { title: '', lumens: 400, cuts: [{ year: 'x' }] })

  it('badpropsOf gives the offending value at each path', () => {
    expect(RR.badpropsOf(err)).to.eql({
      title: '', lumens: 400, 'cuts[0].year': 'x',
    })
  })
  it('messagesOf gives the message at each path', () => {
    expect(RR.messagesOf(err)).to.have.keys(['title', 'lumens', 'cuts[0].year'])
    expect(RR.messagesOf(err).lumens).to.eq('should be «200» or less')
  })
  it('explain reads as one line, path by path', () => {
    expect(RR.explain(err)).to.eq(
      "title «''» should not be empty"
      + ';; lumens «400» should be «200» or less'
      + ";; cuts[0].year «'x'» is text but should be a number",
    )
  })
  it('explain omits the path when the subject itself was wrong', () => {
    expect(explainFor(Z.string(), 42)).to.eq('«42» is a number but should be text')
  })
})
