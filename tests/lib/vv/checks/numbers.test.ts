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
