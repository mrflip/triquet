import      _                                /**/ from 'lodash'
import      { expect }                            from 'chai'
import      { DateTime  }                         from 'luxon'
import      { Validator }                         from '@freeword/meta'
//
import      * as TH                              from '../TestHelpers.ts'
//
/* eslint-disable space-in-parens */

describe('casting', () => {
  const isoishes = {
    valid: [
      [[DateTime.fromISO('2024-02-29T08:08:08Z'), new Date('2024-02-29T08:08:08Z'), '2024-02-29T08:08:08.000Z'], '2024-02-29T08:08:08.000Z'],
      [['2024-02-29T08:08:08Z'], '2024-02-29T08:08:08Z'],
    ],
    invalid: [
      '', 'flase', {}, { '': false }, false, true, '2023-02-29T08:08:08.000Z',
    ],
  }
  const { isotime } = Validator.Checks
  const Validate = Validator(({ obj, isotime }) => {
    return {
      hasIsoish:   obj({ foo: isotime                       }),
      hasIsoishON: obj({ foo: isotime.optional().nullable() }),
      hasIsoishO:  obj({ foo: isotime.optional()            }),
      hasIsoishR:  obj({ foo: isotime                       }),
      hasIsoishRN: obj({ foo: isotime.nullable()            }),
    }
  })

  // describe('basic validator', () => {
  //   it('casts and validates isoishes', () => {
  //     for (const [vals, wanted] of isoishes.valid) {
  //       for (const val of vals) { expect(isotime.cast(val)).to.eql(wanted) }
  //     }
  //   })
  //   it('does nullable/optional correctly', () => {
  //     expect(isoishYupper.notRequired().cast(null)).to.eql(null)
  //     expect(isoishYupper.notRequired().cast(undefined)).to.eql(undefined)
  //   })
  //   it.each(isoishes.invalid)('non-isoish %s throws an error', (val) => {
  //     expect(() => Validate.hasIsoish.cast({ foo: val })).to.throw(/should be a date-time in ISO YYYY-MM-DDThh:mm:ss.uuuZ form/)
  //   })
  // })

  describe('Validator', () => {
    describe('isotime', () => {
      it('casts and validates isotime', () => {
        expect(Validate.hasIsoishO.cast({  foo: '2024-02-29T08:08:08.000Z' })).to.eql({ foo: '2024-02-29T08:08:08.000Z' })
        expect(Validate.hasIsoishR.cast({  foo: '2024-02-29T08:08:08.000Z' })).to.eql({ foo: '2024-02-29T08:08:08.000Z' })
        expect(Validate.hasIsoishRN.cast({ foo: '2024-02-29T08:08:08.000Z' })).to.eql({ foo: '2024-02-29T08:08:08.000Z' })
        expect(Validate.hasIsoishON.cast({ foo: '2024-02-29T08:08:08.000Z' })).to.eql({ foo: '2024-02-29T08:08:08.000Z' })
        expect(Validate.hasIsoish.cast({   foo: '2024-02-29T08:08:08.000Z' })).to.eql({ foo: '2024-02-29T08:08:08.000Z' })
      })
    })
    // describe('isoish convertor', () => {
    //   it('casts and validates object with a isoish field', () => {
    //     for (const [vals, wanted] of isoishes.valid) {
    //       for (const val of vals) {
    //         // if (! _.isEqual(Validate.hasIsoish.cast({ foo: val }), { foo: wanted })) { console.warn('oops wrong cast', val, wanted) }
    //         expect(Validate.hasIsoish.cast({ foo: val })).to.eql({ foo: wanted })
    //       }
    //     }
    //   })
    //   it('by default, allows undefined and null', () => {
    //     // expect(      Validate.hasIsoish.cast({ foo: null      })).to.eql({ foo: null })
    //     expect(() => Validate.hasIsoish.cast({ foo: null        })).to.throw(/foo cannot be null : got .foo:%~null.: checkname='hasIsoish' got=.foo:%~null/)
    //     expect(      Validate.hasIsoish.cast({ foo: undefined   })).to.eql({ })
    //     expect(      Validate.hasIsoish.cast({                  })).to.eql({ })
    //   })
    //   it('.notRequired, elides undefined and passes null', () => {
    //     expect(      Validate.hasIsoishON.cast({ foo: null      })).to.eql({ foo: null })
    //     expect(      Validate.hasIsoishON.cast({ foo: undefined })).to.eql({ })
    //     expect(      Validate.hasIsoishON.cast({                })).to.eql({ })
    //   })
    //   it('.notRequired.nonNullabe, elides undefined and rejects null', () => {
    //     expect(() => Validate.hasIsoishO.cast({ foo: null      })).to.throw(/foo cannot be null : got .foo:%~null.: checkname='hasIsoishO' got=.foo:%~null/)
    //     expect(      Validate.hasIsoishO.cast({ foo: undefined })).to.eql({ })
    //     expect(      Validate.hasIsoishO.cast({                })).to.eql({ })
    //   })
    //   it('.required, rejects undefined and rejects null', () => {
    //     expect(() => Validate.hasIsoishR.cast({ foo: null      })).to.throw(/foo is required : got .foo:%~null.: checkname='hasIsoishR' got=.foo:%~null./)
    //     expect(() => Validate.hasIsoishR.cast({ foo: undefined })).to.throw(/foo is required : got .foo:'%missing'.: checkname='hasIsoishR' got=\{\}/)
    //     expect(() => Validate.hasIsoishR.cast({                })).to.throw(/foo is required : got .foo:'%missing'.: checkname='hasIsoishR' got=\{\}/)
    //   })
    //   it('.required().nonNullable(), elides undefined and rejects null', () => {
    //     expect(      Validate.hasIsoishRN.cast({ foo: null      })).to.eql({ foo: null })
    //     expect(() => Validate.hasIsoishRN.cast({ foo: undefined })).to.throw(/foo is required : got .foo:'%missing'.: checkname='hasIsoishRN' got=\{\}/)
    //     expect(() => Validate.hasIsoishRN.cast({                })).to.throw(/foo is required : got .foo:'%missing'.: checkname='hasIsoishRN' got=\{\}/)
    //   })
    //   it.each(isoishes.invalid)('non-isoish %s throws an error', (val) => {
    //     expect(() => Validate.hasIsoish.cast({ foo: val })).to.throw(/should be a date-time in ISO YYYY-MM-DDThh:mm:ss.uuuZ form/)
    //   })
    //   it.each(isoishes.invalid)('non-isoish %s throws an error with helpful info', (val) => {
    //     let err; try { Validate.hasIsoish.cast({ foo: val }) } catch (_e) { err = _e }
    //     expect(err).to.be.an('error')
    //     expect(err.message).to.match(/should be a date-time in ISO YYYY-MM-DDThh:mm:ss.uuuZ form : got.\{foo/)
    //     console.log('err', err, err.extensions)
    //     expect(err).property('extensions').property('badprops').to.eql({ foo: String(val) })
    //     expect(err).property('extensions').property('badpropsStr').to.match(/\{ foo: /)
    //   })
    // })
  })
})
