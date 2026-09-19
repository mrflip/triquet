import      _                                /**/ from 'lodash'
import      { expect }                            from 'chai'
import      { Validator }                         from '@freeword/meta'
//
/* eslint-disable space-in-parens */

const { Zods }  = Validator

describe('casting', () => {
  const boolishes = {
    valid: [
      [[true,  1, 'true',  'True',  'TRUE',  '1', 'Yes', 'yes', 'YES', 'Y', 'y'],  true],
      [[false, 0, 'false', 'False', 'FALSE', '0', 'No',  'no',  'NO',  'N', 'n'], false],
    ],
    invalid: ['', 'flase', 2, {}, { '': false }, ['true'],  [true], ['false'], [false]],
  } as const

  const Validate = Validator(({ boolish, obj }) => {
    return {
      hasBoolish:   obj({ foo: boolish               }),
      hasBoolishO:  obj({ foo: boolish.optional()    }),
      hasBoolishON: obj({ foo: boolish.optional().nullable()    }),
      hasBoolishR:  obj({ foo: boolish               }),
      hasBoolishRN: obj({ foo: boolish.nullable()    }),
    }
  })
  const boolishZ = Zods.boolish

  describe('basic zod validator', () => {
    it('has zod checks', () => {
      expect(boolishZ.cast(true)).to.be.true
      expect(boolishZ.cast(false)).to.be.false
      expect(boolishZ.cast('false')).to.be.false
      expect(boolishZ.cast('true')).to.be.true
      expect(() => boolishZ.cast(2)).to.throw('«2» should be identifiably true or false')
    })
    it('casts and validates boolishes', () => {
      for (const [vals, wanted] of boolishes.valid) {
        for (const val of vals) {
          expect(boolishZ.cast(val)).to.eql(wanted)
        }
      }
    })
    it('does nullable/optional correctly', () => {
      expect(boolishZ.nullable().cast(null)).to.eql(null)
      expect(boolishZ.optional().cast(undefined)).to.eql(undefined)
    })
    it.each(boolishes.invalid)('non-boolish %s throws an error', (val) => {
      expect(() => boolishZ.cast(val)).to.throw(/«.*» should be identifiably true or false/)
    })
  })

  describe('Validator', () => {
    it('by default, elides undefined and rejects null', () => {
      expect(() => Validate.hasBoolish.cast({ foo: null        })).to.throw(/hasBoolish issues: foo «null» should be identifiably true or false/)
      expect(() => Validate.hasBoolish.cast({ foo: undefined   })).to.throw(/hasBoolish issues: foo «undefined» should be identifiably true or false/)
      expect(() => Validate.hasBoolish.cast({                  })).to.throw(/hasBoolish issues: foo \(unset\) should be identifiably true or false/)
    })
    it('.notRequired, elides undefined and passes null', () => {
      expect(      Validate.hasBoolishON.cast({ foo: null      })).to.eql({ foo: null })
      expect(      Validate.hasBoolishON.cast({ foo: undefined })).to.eql({ })
      expect(      Validate.hasBoolishON.cast({                })).to.eql({ })
    })
    it('.required, rejects null and undefined', () => {
      expect(() => Validate.hasBoolishR.cast({ foo: null      })).to.throw(/hasBoolishR issues: foo «null» should be identifiably true or false/)
      expect(() => Validate.hasBoolishR.cast({ foo: undefined })).to.throw(/hasBoolishR issues: foo «undefined» should be identifiably true or false/)
      expect(() => Validate.hasBoolishR.cast({                })).to.throw(/hasBoolishR issues: foo \(unset\) should be identifiably true or false/)
    })
    it('.required().nonNullable(), elides undefined and rejects null', () => {
      expect(      Validate.hasBoolishRN.cast({ foo: null      })).to.eql({ foo: null })
      expect(() => Validate.hasBoolishRN.cast({ foo: undefined })).to.throw(/hasBoolishRN issues: foo «undefined» should be identifiably true or false/)
      expect(() => Validate.hasBoolishRN.cast({                })).to.throw(/hasBoolishRN issues: foo \(unset\) should be identifiably true or false/)
    })
    it.each(boolishes.invalid)('non-boolish %s throws an error', (val) => {
      expect(() => Validate.hasBoolish.cast({ foo: val })).to.throw(/hasBoolish issues: foo «.*» should be identifiably true or false/)
    })
  })
})
