import { describe, expect, it } from 'vitest'
import * as CK from '../../../../src/lib/vv/checks/numbers'
import { accepts, rejects } from '../../../support/checking'

describe('what every numeric check refuses', () => {
  const NotNumbers: [unknown, string][] = [
    ['5',       'a number written as text'],
    [null,      'null'],
    [undefined, 'undefined'],
    [NaN,       'NaN'],
    [Infinity,  'an infinity'],
    [-Infinity, 'the other infinity'],
    [{},        'a bag'],
    [[],        'an array'],
  ]
  for (const [val, blurb] of NotNumbers) {
    it(`safenum refuses ${blurb}`, () => { rejects(CK.safenum, val) })
  }
  it('takes zero, which a truthiness check would have lost', () => {
    expect(accepts(CK.safenum, 0)).to.eq(0)
    expect(accepts(CK.quantity, 0)).to.eq(0)
  })
})

describe('integers', () => {
  it('bareint takes whole numbers and refuses fractions', () => {
    accepts(CK.bareint, 42)
    accepts(CK.bareint, -42)
    rejects(CK.bareint, 1.5)
  })
  it('safeint refuses a number too large to count on', () => {
    accepts(CK.safeint, Number.MAX_SAFE_INTEGER)
    rejects(CK.safeint, Number.MAX_SAFE_INTEGER + 2)
  })
  it('float takes a fraction, where the integers do not', () => {
    expect(accepts(CK.float, 1.5)).to.eq(1.5)
    rejects(CK.bareint, 1.5)
  })
})

describe('bounded integers', () => {
  const Bounds: [keyof typeof CK, number, number][] = [
    ['uint32',   0,             4_294_967_295],
    ['int32',    -2_147_483_648, 2_147_483_647],
    ['byte',     0,             255],
    ['quantity', 0,             10_000_000],
    ['portnum',  0,             65_535],
  ]
  for (const [ckname, min, max] of Bounds) {
    describe(ckname, () => {
      it('takes both ends of its range', () => {
        accepts(CK[ckname], min)
        accepts(CK[ckname], max)
      })
      it('refuses either side of it', () => {
        rejects(CK[ckname], min - 1)
        rejects(CK[ckname], max + 1)
      })
      it('refuses a fraction inside the range', () => {
        rejects(CK[ckname], min + 0.5)
      })
    })
  }
})

describe('geography', () => {
  it('lat runs pole to pole, inclusive', () => {
    accepts(CK.lat, -90)
    accepts(CK.lat, 90)
    accepts(CK.lat, 0)
    rejects(CK.lat, 91)
    rejects(CK.lat, -90.5)
  })
  it('lng excludes -180 and includes 180, so the date line is named once', () => {
    accepts(CK.lng, 180)
    accepts(CK.lng, -179.999)
    rejects(CK.lng, -180)
    rejects(CK.lng, 181)
  })
  it('takes a fraction, unlike the integer checks', () => {
    expect(accepts(CK.lat, 30.266666)).to.eq(30.266666)
  })
})

describe('money', () => {
  it('ubux runs either side of zero, and is whole', () => {
    accepts(CK.ubux, 0)
    accepts(CK.ubux, -500)
    accepts(CK.ubux, 1e12)
    rejects(CK.ubux, 1.5)
  })
  it('refuses an amount past where a typo stops looking like a number', () => {
    rejects(CK.ubux, 2e12)
    rejects(CK.ubux, -2e12)
  })
})

describe('the advice a numeric check gives', () => {
  const Cases: [keyof typeof CK, unknown, string][] = [
    ['quantity', -1,    '«-1» should be «0» or more'],
    ['quantity', 2e7,   '«20_000_000» should be «10_000_000» or less'],
    ['quantity', 0.5,   'should be an integer'],
    ['byte',     256,   '«256» should be «255» or less'],
    ['lat',      91,    '«91» should be «90» or less'],
    ['safenum',  '5',   "«'5'» is text but should be a number"],
    ['safenum',  null,  '«null» is nil, should be a number'],
  ]
  for (const [ckname, val, wanted] of Cases) {
    it(`${ckname} on ${JSON.stringify(val)} says "${wanted}"`, () => {
      expect(rejects(CK[ckname], val)).to.include(wanted)
    })
  }
  it('groups the digits of a large number, so a reader can see the size', () => {
    expect(rejects(CK.quantity, 20_000_000)).to.include('20_000_000')
  })
})

describe("numberlike strings", () => {
  // [check, given, what it hands back, or null where it refuses]
  const Cases: [keyof typeof CK, unknown, unknown][] = [
    ['intstr',  "-12",    "-12"],
    ['intstr',  -12,      "-12"],
    ['intstr',  " 7",     null],
    ['intstr',  "+7",     "+7"],
    ['intstr',  "1.5",    null],
    ['intstr',  1.5,      null],
    ['uintstr', "0",      "0"],
    ['uintstr', "-1",     null],
    ['uintstr', -1,       null],
    ['numstr',  "-2.5",   "-2.5"],
    ['numstr',  2.5,      "2.5"],
    ['numstr',  "3.10",   "3.10"],
    ['unumstr', "3.1",    "3.1"],
    ['unumstr', "-3.1",   null],
    ['strint',  "-12",    -12],
    ['strint',  -12,      -12],
    ['strint',  "1.5",    null],
    ['ustrint', "007",    7],
    ['ustrint', "-7",     null],
    ['strnum',  "-2.5",   -2.5],
    ['strnum',  2.5,      2.5],
    ['ustrnum', "3.10",   3.1],
    ['ustrnum', "-3.1",   null],
  ]
  for (const [ckname, val, wanted] of Cases) {
    if (wanted === null) {
      it(`${ckname} refuses ${JSON.stringify(val)}`, () => { rejects(CK[ckname], val) })
    } else {
      it(`${ckname} makes ${JSON.stringify(val)} into ${JSON.stringify(wanted)}`, () => {
        expect(accepts(CK[ckname], val)).to.eq(wanted)
      })
    }
  }

  const NotNumberlike: [unknown, string][] = [
    ["",        'blank text'],
    ["three",   'a word'],
    ["1e5",     'an exponent'],
    ["1,000",   'grouped digits'],
    ["1 000",   'spaced digits'],
    ["7 ",      'a trailing space'],
    [".5",      'a fraction with no whole part'],
    ["5.",      'a point with nothing after it'],
    ["0x1f",    'hexadecimal'],
    [null,      'null'],
    [NaN,       'NaN'],
    [Infinity,  'an infinity'],
  ]
  for (const ckname of ['intstr', 'uintstr', 'numstr', 'unumstr', 'strint', 'ustrint', 'strnum', 'ustrnum'] as const) {
    for (const [val, blurb] of NotNumberlike) {
      it(`${ckname} refuses ${blurb}`, () => { rejects(CK[ckname], val) })
    }
  }

  it("refuses text spelling a number past the safe integers, either way it arrives", () => {
    accepts(CK.uintstr, '9007199254740991')
    rejects(CK.uintstr, '9007199254740992')
    rejects(CK.strint, '-9007199254740992')
    rejects(CK.numstr, '9007199254740991.5')
  })

  it("refuses a number that writes itself with an exponent, which no text check takes", () => {
    rejects(CK.numstr, 1e-7)
    expect(accepts(CK.strnum, 1e-7)).to.eq(1e-7)
  })

  it("encodes back the other way", () => {
    expect(CK.ustrnum.encode(2.5)).to.eq('2.5')
    expect(CK.unumstr.encode('2.5')).to.eq('2.5')
  })

  it("says what shape it wanted", () => {
    expect(rejects(CK.unumstr, 'three')).to.include('should be a number, zero or more, written as plain digits')
    expect(rejects(CK.uintstr, '9007199254740992')).to.include('should be from 0 to 9007199254740991')
  })

  it("says only what shape it wanted, when the text is not a number at all", () => {
    expect(rejects(CK.unumstr, 'three')).not.to.include('should be from')
  })
})

describe("unumstrOrBlank", () => {
  it("takes blank text, and what unumstr takes", () => {
    expect(accepts(CK.unumstrOrBlank, '')).to.eq('')
    expect(accepts(CK.unumstrOrBlank, '3.1')).to.eq('3.1')
    expect(accepts(CK.unumstrOrBlank, 3.1)).to.eq('3.1')
  })
  it("refuses what unumstr refuses, with unumstr's own advice and code", () => {
    const res = CK.unumstrOrBlank.safeParse('three')
    expect(res.error?.issues.map((issue) => issue.code)).to.deep.eq(['invalid_format'])
    rejects(CK.unumstrOrBlank, ' ')
    rejects(CK.unumstrOrBlank, -1)
  })
})
