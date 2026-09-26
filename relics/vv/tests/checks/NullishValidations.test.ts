import      _                                /**/ from 'lodash'
import      { expect }                            from 'chai'
import      { CK }                                from '@freeword/meta'
//
/* eslint-disable space-in-parens, array-bracket-spacing */

jest.setTimeout(20_000)

describe('casting', () => {
  const { notund, notnil } = CK // anything, idk, unk,
  const notundValBag = CK.obj({ val: notund }).describe('happy notund bag')
  const notnilValBag = CK.obj({ val: notnil }).describe('happy notnil bag')
  // const { und, nul, nan, mta, mtb, mts, zro } = { und: undefined, nul: null, nan: NaN, mta: [], mtb: {}, mts: '', zro: 0 }
  // const dicks = CK.obj({ anything, notund, notnil, idk, unk })
  // function fafo(val) { return dicks.cast({ anything: val, notund: val, notnil: val, idk: val, unk: val }) }

  describe('notund (not undefined', () => { // @ts-expect-error WONTFIX testing bad input
    it.each([null, NaN, 0, '', [], {}])('is ok with %s as value', (val) => { expect(notund.cast(val)).to.eql(val) }) // @ts-expect-error WONTFIX testing bad input
    it.each([null, NaN, 0, '', [], {}])('is ok with %s as prop',  (val) => { expect(CK.obj({ val: notund }).cast({ val })).to.eql({ val }) })
    it.each([undefined])('fails with %s',                         (val) => { expect(() => notund.cast(val)).to.throw('issues: «undefined» is missing, needs defined or null') })
    it.each([undefined])('fails with %s as prop',                 (val) => { expect(() => notundValBag.cast({ val })).to.throw(`happy notund bag issues: val «undefined» is missing, needs defined or null`) })
    it('fails if missing', () => { expect(() => notundValBag.cast({ })).to.throw(`happy notund bag issues: val (unset) is unset, needs defined or null`) })
  })
  describe('notnil (not absent)', () => {
    it.each([NaN, 0, '', [],   {}])('is ok with %s as value', (val) => { expect(notnil.cast(val)).to.eql(val) })
    it.each([NaN, 0, '', [],   {}])('is ok with %s as prop',  (val) => { expect(CK.obj({ val: notnil }).cast({ val })).to.eql({ val }) }) // @ts-expect-error WONTFIX testing bad input
    it('fails with undefined as value', () => { expect(() => notnil.cast(undefined)).to.throw(`any non-absent value issues: «undefined» is missing, needs non-nil`) }) // @ts-expect-error WONTFIX testing bad input
    it('fails with null as value',      () => { expect(() => notnil.cast(null)).to.throw(`any non-absent value issues: «null» is nil, needs non-nil`) }) // @ts-expect-error WONTFIX testing bad input
    it('fails with undefined as prop',  () => { expect(() => notnilValBag.cast({ val: undefined })).to.throw(`happy notnil bag issues: val «undefined» is missing, needs non-nil`) }) // @ts-expect-error WONTFIX testing bad input
    it('fails with null as prop',       () => { expect(() => notnilValBag.cast({ val: null })).to.throw(`happy notnil bag issues: val «null» is nil, needs non-nil`) }) // @ts-expect-error WONTFIX testing bad input
    it('fails if missing', () => { expect(() => notnilValBag.cast({ })).to.throw(`happy notnil bag issues: val (unset) is unset, needs non-nil`) })
  })
})
