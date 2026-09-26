import      _                                /**/ from 'lodash'
import      { expect }                            from 'chai'
//
import * as CK                                    from '@freeword/meta/checks' // eslint-disable-line import/no-unresolved
import * as TH                                    from '../TestHelpers.ts'

const { Examples } = TH
const { handleish, splitStr, titleish } = CK

/* esl int-disable no-useless-concat */

describe('Validation', () => {
  describe('Basic String Checks', () => {

    describe('handles', () => {
      describe('examples', () => {
        const invalid_handleish_keys = ['len_40', 'len_41', 'len_100', 'len_101']
        const {
          medstr, fullstr, titlecase, camelcase, has_whitespace, emptystring, undef_val,
          has_dashes, null_val, bangy, twiddly, good_idkey, len_41,
          ...valids
        } = Examples.Strings
        //
        _.each({
          medstr, fullstr, titlecase, camelcase, has_whitespace, emptystring, undef_val,
          has_dashes, null_val, bangy, twiddly, good_idkey, len_41,
          ..._.pick(Examples.Handleish, invalid_handleish_keys),
        }, (inval, key) => {
          it(`${key} is invalid (${inval})`, () => {
            expect(handleish.report(inval)).property('ok').to.be.false
          })
        })

        it('Blank is valid (enforce using .min)', () => {
          const report = handleish.report('')
          expect(report).property('ok').to.be.false
          expect(report).property('message').to.match(/record handle issues: «''» is blank/)
        })

        it(`Other examples are valid`, () => {
          _.each({ ...valids, ..._.omit(Examples.Handleish, invalid_handleish_keys) }, (val, key) => {
            const report = handleish.report(val)
            if (! report?.ok) { console.error('should be valid:', key, val, report); return }
            expect(report).property('ok').to.be.true
          })
        })
      })
    })

    describe('splitStr', () => {
      /** @type {Record<string, [CK.ZodTypeAny, string | RegExp | undefined, string | string[], string[]]>} */
      const scenarios = {
        basic:         [handleish, undefined,   'a,b,c',                                                                  ['a', 'b', 'c']],
        empty:         [handleish, undefined,   '',                                                                       []],
        default_sep:   [titleish,  undefined,   'I love seeing Grandmom, head-banging and diving into the mosh pit',      ['I', 'love', 'seeing', 'Grandmom', 'head', 'banging', 'and', 'diving', 'into', 'the', 'mosh', 'pit']],
        comma_sep:     [titleish,  ',',         'I love seeing Grandmom, head-banging and diving into the mosh pit',     ['I love seeing Grandmom', 'head-banging and diving into the mosh pit']],
        notrim:        [CK.str,    ',',         'I love seeing Grandmom, head-banging, and diving into the mosh pit',    ['I love seeing Grandmom', ' head-banging', ' and diving into the mosh pit']],
        oxford_sp_sep: [titleish,  ', ',        'I love seeing Grandmom, head-banging, and diving into the mosh pit',    ['I love seeing Grandmom', 'head-banging', 'and diving into the mosh pit']],
        sp_sep:        [titleish,  ' ',         'I love seeing Grandmom, head-banging, and diving into the mosh pit',    ['I', 'love', 'seeing', 'Grandmom,', 'head-banging,', 'and', 'diving', 'into', 'the', 'mosh', 'pit']],
        trims1:        [titleish,  undefined,  ' I love seeing Grandmom, head-banging, and diving into the mosh pit.',   ['I', 'love', 'seeing', 'Grandmom', 'head', 'banging', 'and', 'diving', 'into', 'the', 'mosh', 'pit']],
        regex_Cap:     [titleish,  /(\W+)/,    ' I love seeing Grandmom, head-banging, and diving into the mosh pit ',   ['', 'I', '', 'love', '', 'seeing', '', 'Grandmom', ',', 'head', '-', 'banging', ',', 'and', '', 'diving', '', 'into', '', 'the', '', 'mosh', '', 'pit', '']],
        //
        array:         [handleish, undefined,   ['a', 'b', 'c'],                                                         ['a', 'b', 'c']],
        array_sep:     [CK.str,    /\W+/,       ['a .!! q', 'asdfasdf', '.', ''],                                        ['a .!! q', 'asdfasdf', '.', '']],
        empty_arr:     [handleish, undefined,   [],                                                                      []],
      } as const
      it.each(_.entries(scenarios))('%s', (_handle, [ck, sep, str, wanted]) => {
        const check = splitStr(ck, sep)
        const report = check.report(str)
        expect(report).property('ok').to.be.true
        expect(report).property('val').to.deep.equal(wanted)
      })
    })
  })
})
