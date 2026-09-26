import      _                                /**/ from 'lodash'
import      { expect }                            from 'chai'
import      { UF, Validator }                     from '@freeword/meta'
//
import      * as TH                               from '../TestHelpers.ts'
//
/* eslint-disable space-in-parens */

describe('casting', () => {
  const boolishes = {
    valid: [
      [[true,  1, 'true',  'True',  'TRUE',  '1', 'Yes', 'yes', 'YES', 'Y', 'y'],  true],
      [[false, 0, 'false', 'False', 'FALSE', '0', 'No',  'no',  'NO',  'N', 'n'], false],
    ],
    invalid: ['', 'flase', 2, {}, { '': false }, ['true'],  [true], ['false'], [false]],
  } as const
  const Validate = Validator(({ obj, boolish }) => {
    return {
      hasBoolish:   obj({ foo: boolish                       }),
      hasBoolishO:  obj({ foo: boolish.optional()            }),
      hasBoolishR:  obj({ foo: boolish                       }),
      hasBoolishRN: obj({ foo: boolish.nullable()            }),
      hasBoolishON: obj({ foo: boolish.optional().nullable() }),
    }
  })
  const { boolish } = Validator.Checks

  describe('basic validator', () => {
    it('casts and validates boolean-like string or boolean values', () => {
      for (const [vals, wanted] of boolishes.valid) {
        // if (boolish.cast(val) !== wanted) { console.warn('oops wrong cast', val, wanted) }
        for (const val of vals) { expect(boolish.cast(val)).to.eql(wanted) }
      }
    })
    it('does nullable/optional correctly', () => {
      expect(boolish.nullable().cast(null)).to.eql(null)
      expect(boolish.optional().cast(undefined)).to.eql(undefined)
    })
    it.each(boolishes.invalid)('non-boolish %s throws an error', (val) => {
      expect(() => boolish.cast(val)).to.throw(`«${UF.inspectify(val)}» should be identifiably true or false`)
    })
  })

  describe('Yupper', () => {
    it('casts and validates object with a boolish field', () => {
      for (const [vals, wanted] of boolishes.valid) {
        for (const val of vals) { expect(Validate.hasBoolish.cast({ foo: val })).to.eql({ foo: wanted }) }
      }
    })
    it('by default, requires a value', () => {
      expect(() => Validate.hasBoolish.cast({ foo: null        })).to.throw(`hasBoolish issues: foo «null» should be identifiably true or false`)
      expect(() => Validate.hasBoolish.cast({ foo: undefined   })).to.throw(`hasBoolish issues: foo «undefined» should be identifiably true or false`)
      expect(() => Validate.hasBoolish.cast({                  })).to.throw(`hasBoolish issues: foo (unset) should be identifiably true or false`)
    })
    it('.optional, elides undefined and rejects null', () => {
      expect(() => Validate.hasBoolishO.cast({ foo: null        })).to.throw(`hasBoolishO issues: foo «null» should be identifiably true or false`)
      expect(      Validate.hasBoolishO.cast({ foo: undefined   })).to.eql({ })
      expect(      Validate.hasBoolishO.cast({                  })).to.eql({ })
    })
    it('.notRequired, elides undefined and passes null', () => {
      expect(      Validate.hasBoolishON.cast({ foo: null      })).to.eql({ foo: null })
      expect(      Validate.hasBoolishON.cast({ foo: undefined })).to.eql({ })
      expect(      Validate.hasBoolishON.cast({                })).to.eql({ })
    })
    it('.required, rejects null and undefined', () => {
      expect(() => Validate.hasBoolishR.cast({ foo: null      })).to.throw(`hasBoolishR issues: foo «null» should be identifiably true or false`)
      expect(() => Validate.hasBoolishR.cast({ foo: undefined })).to.throw(`hasBoolishR issues: foo «undefined» should be identifiably true or false`)
      expect(() => Validate.hasBoolishR.cast({                })).to.throw(`hasBoolishR issues: foo (unset) should be identifiably true or false`)
    })
    it('.required().nonNullable(), elides undefined and rejects null', () => {
      expect(      Validate.hasBoolishRN.cast({ foo: null      })).to.eql({ foo: null })
      expect(() => Validate.hasBoolishRN.cast({ foo: undefined })).to.throw(`hasBoolishRN issues: foo «undefined» should be identifiably true or false`)
      expect(() => Validate.hasBoolishRN.cast({                })).to.throw(`hasBoolishRN issues: foo (unset) should be identifiably true or false`)
    })
    it.each(boolishes.invalid)('non-boolish %s throws an error', (val) => {
      expect(() => Validate.hasBoolish.cast({ foo: val })).to.throw(`hasBoolish issues: foo «${UF.inspectify(val)}» should be identifiably true or false`)
    })
  })
})
