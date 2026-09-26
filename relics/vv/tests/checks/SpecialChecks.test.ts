import      _                                /**/ from 'lodash'
import      { expect }                            from 'chai'
//
import      { Validator, CK }                     from '@freeword/meta'

const { CurrencyVals, CountryCodeVals } = CK

const DEPRECATED = [
  'CKD', 'CUC', 'FOK', 'GGP', 'HRK', 'IMP', 'JEP', 'KID', 'SLL', 'TVD', 'ZWB',
  'VES', 'ANG',
]
const ADDITIONAL = [
  // SLE is Sierra Leone; XCG is the new ANG; VED for VES; ZWG for ZWB
  'SLE', 'VED', 'XCG', 'ZWG',
  // 'BOV', 'CHE', 'CHW', 'CLF', 'COU', 'MXV', 'SLE', 'SVC', 'USN', 'UYI', 'UYW', 'VED',
  // 'XAG', 'XAU', 'XBA', 'XBB', 'XBC', 'XBD', 'XDR', 'XPD', 'XPT', 'XSU', 'XTS', 'XUA',
  // 'XXX', 'ZWL',
]
// const FromNPMKeys = _.flatMap(_.flatMap(WorldCountries, 'currencies'), _.keys)
// const ExpectedCountryCodes = _.map(WorldCountries, 'cca2').sort()
// const ExpectedCurrencies = _.sortedUniq(_.without(FromNPMKeys, ...DEPRECATED).concat(ADDITIONAL).sort())

/* eslint-disable space-in-parens */

const EMAILS = `
101@gmail.com
101@123wireless1.com
andrew@wash-upon-a-star.com
_foxy1234@yahoo.com
a.gonzo2153@gmail.com
whitman@walt.rr.com
a@me.com
allseason-test@tookstock.com
antonio.x.san@gmail.com
carlos+tester5+pip@tookstock.com
bob@themostamericancaranddogwashhooray.com
carlos+manager+pip1@tookstock.com
`.trim().split(/\s+/g)

describe('specific validations', () => {

  // describe('CurrencyCodes', () => {
  //   it('matches external source', () => {
  //     if (! _.isEqual(CurrencyVals, ExpectedCurrencies)) {
  //       console.warn('Currency Sources differ', _.difference(CurrencyVals, ExpectedCurrencies), _.difference(ExpectedCurrencies, CurrencyVals))
  //     }
  //     expect(CurrencyVals).to.eql(ExpectedCurrencies)
  //   })
  //}) // currency codes

  // describe('Country codes', () => {
  //   it('matches external source', () => {
  //     if (! _.isEqual(CountryCodeVals, ExpectedCountryCodes)) {
  //       console.warn('Currency Sources differ', _.difference(CountryCodeVals, ExpectedCountryCodes), _.difference(ExpectedCountryCodes, CountryCodeVals))
  //     }
  //     expect(CountryCodeVals).to.eql(ExpectedCountryCodes)
  //   })
  // }) // country codes

  describe('email validation', () => {

    const Validate = Validator(({ obj, email }) => ({
      emailV:       obj({ email }),
    }))
    function tryBadEmail(str: string) { return (() => Validate.emailV.cast({ email: str })) }

    it('email accepts valid emails', () => {
      expect(Validate.emailV.cast({ email: 'a@z.com'                      })).to.eql({ email: 'a@z.com'                      })
      expect(Validate.emailV.cast({ email: 'a@z.xn--vermgensberatung-pwb' })).to.eql({ email: 'a@z.xn--vermgensberatung-pwb' })
      expect(Validate.emailV.cast({ email: 'a@z.tw'                       })).to.eql({ email: 'a@z.tw'                       })
      expect(Validate.emailV.cast({ email: 'a@z.cookingchannel'           })).to.eql({ email: 'a@z.cookingchannel'           })
      expect(Validate.emailV.cast({ email: 'a@z.c.d.e.zz'                 })).to.eql({ email: 'a@z.c.d.e.zz'                 })
      expect(Validate.emailV.cast({ email: '1@z.c.d.e.zz'                 })).to.eql({ email: '1@z.c.d.e.zz'                 })
      expect(Validate.emailV.cast({ email: '1@z.c.d.e.zz'                 })).to.eql({ email: '1@z.c.d.e.zz'                 })
      expect(Validate.emailV.cast({ email: 'a+b+c@z.c.d.e.zz'             })).to.eql({ email: 'a+b+c@z.c.d.e.zz'             })
      //
      expect(Validate.emailV.cast({ email: 'a@xn--z.com'                                                          })).to.eql({ email: 'a@xn--z.com'                                                          })
      expect(Validate.emailV.cast({ email: 'a@xn--vermgensberatung-pwb.xn--z.xn--vermgensberatung-pwb'            })).to.eql({ email: 'a@xn--vermgensberatung-pwb.xn--z.xn--vermgensberatung-pwb'            })
      expect(Validate.emailV.cast({ email: 'a@xn--1234567890123456789012345678901234567890123456789012-456789.zw' })).to.eql({ email: 'a@xn--1234567890123456789012345678901234567890123456789012-456789.zw' })
      expect(Validate.emailV.cast({ email: 'a@xn--12345678901234567890123456789012345678901234567890123456789.zw' })).to.eql({ email: 'a@xn--12345678901234567890123456789012345678901234567890123456789.zw' })
      expect(Validate.emailV.cast({ email: 'a@123456789a123456789b123456789c123456789d123456789e123456789f123.zw' })).to.eql({ email: 'a@123456789a123456789b123456789c123456789d123456789e123456789f123.zw' })

      //
      expect(Validate.emailV.cast({ email: 'a_____b@z.com'                   })).to.eql({ email: 'a_____b@z.com'                   })
      expect(Validate.emailV.cast({ email: '1-_@z.com'                       })).to.eql({ email: '1-_@z.com'                       })
      expect(Validate.emailV.cast({ email: 'a@1n1.com'                       })).to.eql({ email: 'a@1n1.com'                       })
      expect(Validate.emailV.cast({ email: '_-_._@z.com'                     })).to.eql({ email: '_-_._@z.com'                     })
      expect(Validate.emailV.cast({ email: '_____b__-_+___c___-_@z.com'      })).to.eql({ email: '_____b__-_+___c___-_@z.com'      })
      // tlds can't have multiple dashes in certain places but subdomains can it seems
      expect(Validate.emailV.cast({ email: '_____b__-_+___c___-_@co--m.com'  })).to.eql({ email: '_____b__-_+___c___-_@co--m.com'  })
      expect(Validate.emailV.cast({ email: '_____b__-_+___c___-_@c---om.com' })).to.eql({ email: '_____b__-_+___c___-_@c---om.com' })
      // all number segments are ok but there must be a letter somewhere (no ip addresses)
      expect(Validate.emailV.cast({ email: 'a@0.1.2.z.arp'                   })).to.eql({ email: 'a@0.1.2.z.arp'                   })
    })

    it('examples', () => { _.each(EMAILS, (example) => { expect(Validate.emailV.check({ email: example })).to.be.true }) })

    it('applies standard validator', () => {
      function invalidEmailMsg(str: string) { return new RegExp(`^emailV issues: email «'${str}'?» should be a conventional email format`) }
      expect(tryBadEmail('a@com'          )).to.throw(invalidEmailMsg('a@com'))
      expect(tryBadEmail('a@@z.com'       )).to.throw(invalidEmailMsg('a@@z.com'))
      expect(tryBadEmail('@z.com'         )).to.throw(invalidEmailMsg('@z.com'))
      expect(tryBadEmail('a\\b@z.com'     )).to.throw(invalidEmailMsg('a~\\^~\\^b@z.com'))
      expect(tryBadEmail('a.@z.com'       )).to.throw(invalidEmailMsg('a\\.@z.com'))
      expect(tryBadEmail('.a@z.com'       )).to.throw(invalidEmailMsg('.a@z.com'      ))
      expect(tryBadEmail('a..b@z.com'     )).to.throw(invalidEmailMsg('a..b@z.com'    ))
      // FIXME -- current babel (or someone) doesn't allow backtracking so this edge case is ignored
      // (tryBadEmail('a@z-.com'       )).to.throw(invalidEmailMsg('a@z-.com'      ))
      expect(tryBadEmail('a@-z.com'       )).to.throw(invalidEmailMsg('a@-z.com'      ))
      expect(tryBadEmail('a@z.-com'       )).to.throw(invalidEmailMsg('a@z.-com'      ))
      expect(tryBadEmail('a@z.com-'       )).to.throw(invalidEmailMsg('a@z.com-'      ))
      expect(tryBadEmail('a@192.168.99.1' )).to.throw(invalidEmailMsg('a@192.168.99.1'))
      expect(tryBadEmail('a@2001:0db8:85a3:0000:0000:8a2e:0370:7334' )).to.throw(invalidEmailMsg('.*' ))

    })

    it('always lowercase', () => {
      function funkyEmailMsg(str: string) { return new RegExp(`^emailV issues: email «'${str}'» (should be all lowercase and )?should be a conventional email format`) }
      expect(tryBadEmail('A@z.com'          )).to.throw(funkyEmailMsg('A@z\\.com'))
      expect(tryBadEmail('a@z.coM'          )).to.throw(funkyEmailMsg('a@z\\.coM'))
    })

    it('structure is often stricter than the standard requires', () => {
      // more of these are flagged by Yup now but the point is one of them comes in
      function funkyEmailMsg(str: string) {
        return new RegExp(
          `emailV issues: email «'${str}'?» (should be all lowercase and )?should be a conventional email format`,
        )
      }
      // only plain characters
      expect(tryBadEmail('mötorhead@z.com'  )).to.throw(funkyEmailMsg('mötorhead@z\\.com' ))
      // bad domain name structure
      expect(tryBadEmail('a@z.c'            )).to.throw(funkyEmailMsg('a@z\\.c'           ))
      expect(tryBadEmail('a@z.c.d.e.f.com'  )).to.throw(funkyEmailMsg('a@z\\.c\\.d\\.e\\.f\\.com' ))
      // delimiters must be internal
      expect(tryBadEmail('+b@z.com'         )).to.throw(funkyEmailMsg('\\+b@z.com' ))
      expect(tryBadEmail('a+@z.com'         )).to.throw(funkyEmailMsg('a\\+@z.com' ))
      expect(tryBadEmail('-a@z.com'         )).to.throw(funkyEmailMsg('-a@z.com'         ))
      expect(tryBadEmail('a-@z.com'         )).to.throw(funkyEmailMsg('a-@z.com'         ))
      // one delimiter per segment
      expect(tryBadEmail('a-.b@z.com'       )).to.throw(funkyEmailMsg('a-.b@z.com'       ))
      expect(tryBadEmail('a--b@z.com'       )).to.throw(funkyEmailMsg('a--b@z.com'       ))
      // cannot have dashes positions 3&4 except for xn--
      expect(tryBadEmail('a@b.co--m'        )).to.throw(funkyEmailMsg('a@b.co--m'      ))
      expect(tryBadEmail('a@b.c---om'       )).to.throw(funkyEmailMsg('a@b.c---om'     ))
      // only two plus segments
      expect(tryBadEmail('a+b+c+d@z.com'    )).to.throw(funkyEmailMsg('a\\+b\\+c\\+d@z.com'    ))
      // no routing domains /
      // FIXME -- current babel (or someone) doesn't allow backtracking so this edge case is ignored
      // tryBadEmail('a@1.0.0.ipv4only.arpa')).to.throw(funkyEmailMsg('.*' ))
      // segments too long
      expect(tryBadEmail('a@xn--1234567890123456789012345678901234567890123456789012-4567890.zw')).to.throw(funkyEmailMsg('.*' ))
      expect(tryBadEmail('a@xn--123456789012345678901234567890123456789012345678901234567890.zw')).to.throw(funkyEmailMsg('.*' ))
      expect(tryBadEmail('a@123456789a123456789b123456789c123456789d123456789e123456789f1234.zw')).to.throw(funkyEmailMsg('.*' ))
      expect(tryBadEmail('slightlytoolong@xn--123456789012345678901234567890123456789012345678901234567890.zw')).to.throw(
        /^emailV issues: email «'slightlytoolong@xn--123456789012345678901234567890123456789012345678901234567890.zw'» should be a conventional email format and is too long: «83» vs «82» available/,
      )
      expect(tryBadEmail('slightlytoolong.for.our.stricter.rules@xn--1234567890123456789012345678901234567890.zw')).to.throw(
        `emailV issues: email «'slightlytoolong.for.our.stricter.rules@xn--1234567890123456789012345678901234567890.zw'» is too long: «86» vs «82» available`,
      )
    })
  }) // email validation

  describe('extkey', () => {
    const Validate = Validator(({ obj, extkey }) => ({
      extkeyV:       obj({ extkey }),
    }))
    it('is happy with uuids', () => {
      expect(Validate.extkeyV.check({ extkey: '11111111-9eae-429d-92b5-8a31299af04c' })).to.be.true
      expect(Validate.extkeyV.check({ extkey: '00300000-9eea-429d-92b5-8a234567890c' })).to.be.true
    })

    it('is happy with email addresses', () => {
      expect(Validate.extkeyV.check({ extkey: 'foo+plus@this.that.bar-none.com' })).to.be.true
    })

    it('refuses weird stuff', () => {
      expect(() => Validate.extkeyV.cast({ extkey: 'fooüé!#$%&\'*+\/=?`{|}~^.-@this.that.bar-none.com' })).to.throw(
        `extkeyV issues: extkey «"fooüé!#$%&'*+/=?\`{|}~^.-@this.that.bar-none.com"» should be a freeform identifier`,
      )
    })
  }) // extkey

  // describe('cursoring', () => {
  //   const CV = Validator(({
  //     obj, first, after, offset, sortcols, cursoring, kxcursoring,
  //   }) => {
  //     return {
  //       first, after, offset, sortcols,
  //       cursoring: cursoring.partial(),
  //       list: obj({ ...cursoring.shape, pred: obj({}).optional() }),
  //       kxcursoring: kxcursoring.partial(), // ['first', 'after', 'sortadjv']),
  //     }
  //   })

  //   describe('first', () => {
  //     it('does not accept ALL any more', () => {
  //       expect(CV.cursoring.check({ first: ALL })).to.be.false
  //     })
  //     it('accepts the string "ALL"', () => {
  //       expect(CV.cursoring.check({ first: "ALL" })).to.be.true
  //     })
  //     it('accepts finite numbers below 200', () => {
  //       expect(CV.cursoring.check({ limit: 30 })).to.be.true
  //       expect(CV.cursoring.check({ limit: 200 })).to.be.true
  //     })
  //     it('does not accept non-js-safe numbers', () => {
  //       expect(() => CV.cursoring.cast({ first: Infinity })).to.throw(`cursoring issues: first «Infinity» is a decimal but should be an integer and should be «200» or less`)
  //       expect(() => CV.cursoring.cast({ limit: Infinity })).to.throw(`cursoring issues: limit «Infinity» is a decimal but should be an integer and should be «200» or less`)
  //     })
  //     it('does not accept out-of-bounds numbers', () => {
  //       expect(() => CV.cursoring.cast({ first: 5_001 })).to.throw(`cursoring issues: first «5_001» should be «200» or less`)
  //       expect(() => CV.cursoring.cast({ limit: 5_001 })).to.throw(`cursoring issues: limit «5_001» should be «200» or less`)
  //     })
  //     it('rejects negative numbers', () => {
  //       expect(() => CV.cursoring.cast({ first: -1 })).to.throw(`cursoring issues: first «-1» should be «0» or more`)
  //     })
  //     it('rejects other bad inputs', () => { // @ts-ignore WONTFIX testing bad input
  //       expect(() => CV.cursoring.cast({ first: NIL   })).to.throw(`cursoring issues: first «Symbol(NIL)» should either be a number or the value «'ALL'»`) // @ts-expect-error WONTFIX testing bad input
  //       expect(() => CV.cursoring.cast({ first: null  })).to.throw(`cursoring issues: first «null» should either not be nil or the value «'ALL'»`) // @ts-expect-error WONTFIX testing bad input
  //       expect(() => CV.cursoring.cast({ first: '5'   })).to.throw(`cursoring issues: first «'5'» should either be a number or the value «'ALL'»`) // @ts-expect-error WONTFIX testing bad input
  //       expect(() => CV.cursoring.cast({ limit: NIL   })).to.throw(`cursoring issues: limit «Symbol(NIL)» is a jssym but should be a number`) // @ts-expect-error WONTFIX testing bad input
  //       expect(() => CV.cursoring.cast({ limit: null  })).to.throw(`cursoring issues: limit «null» is nil`) // @ts-expect-error WONTFIX testing bad input
  //       expect(() => CV.cursoring.cast({ limit: '5'   })).to.throw(`cursoring issues: limit «'5'» is text but should be a number`)
  //     })
  //   })

  //   describe('after', () => {
  //     it('accepts a string', () => {
  //       expect(CV.cursoring.check({ after: 'asdf' })).to.be.true
  //     })
  //   })

  //   describe('kxafter', () => {
  //     it('accepts a stringed integer', () => {
  //       expect(CV.kxcursoring.check({ after: '123' })).to.be.true // @ts-ignore WONTFIX testing bad input
  //       expect(CV.kxcursoring.check({ after: TH.MAX_CURSOR })).to.be.true
  //       expect(() => CV.kxcursoring.cast({ after: 'asdf' })).to.throw(`kxcursoring issues: after «'asdf'» should be a knex-compatible cursor`) // @ts-ignore WONTFIX testing bad input
  //       expect(() => CV.kxcursoring.cast({ after: 123 })).to.throw(`kxcursoring issues: after «123» is a number but should be text`)
  //     })
  //   })
  // }) // cursoring

  // describe('Path Types', () => {
  //   const normalExample = TH.Examples.ParsedPaths.knownfext
  //   const ValidPathspecs = {
  //     normalExample,
  //     hasOKNulls:  { ...normalExample, fextffmt: null, extname: null, corefext: null },
  //     hasOKBlanks: { ...normalExample, fextffmt: null, extname: '', corefext: null },
  //   }
  //   const InvalidPathspecs = {
  //     hasBadNulls:    {
  //       ...normalExample, abspath: null, dirname: null, rootpath: null, basename: null, barename: null,
  //       errmsg: `parsedPath issues: abspath «null» is nil;; rootpath «null» is nil;; dirname «null» is nil;; basename «null» is nil;; barename «null» is nil`,
  //     },
  //     // hasBadBlanks:   { ...normalExample, fextffmt: '',  comprfext: '',  errmsg: /parsedPath issues: fextffmt «''» Invalid enum value. Expected 'archive_apk' \| 'archive_gzip' \| 'archive_tar' \| 'archive_zip' \| '.*;; comprfext «''» Invalid enum value. should be a 'bz2' \| 'gz': comprfext=.*?, fextffmt=.*/ },
  //     // ugh wait for Zod
  //     // hasBadExtNulls: { ...normalExample, extname: null, corefext: null, errmsg: 'abspath is required, rootpath is required;; dirname is required;; basename is required;; barename is required : got' },
  //   }
  //   const ValidPathspecsList   = _.map(ValidPathspecs,   (example, handle) => ({ ...example, example, handle }))
  //   const InvalidPathspecsList = _.map(InvalidPathspecs, (example, handle) => ({ ...example, example: _.omit(example, ['errmsg']), handle }))

  //   const Validate = Validator(({
  //     parsedPath,
  //   }) => {
  //     return {
  //       parsedPath,
  //     }
  //   })
  //   describe('parsedPath', () => {
  //     describe('valid input', () => {
  //       it.each(ValidPathspecsList)('edge case $handle $origpath to be OK', ({ example }) =>  { // @ts-expect-error WONTFIX testing bad input
  //         expect(Validate.parsedPath.cast(example)).to.eql(example)
  //       })
  //     })
  //     describe('invalid input', () => {
  //       it.each(InvalidPathspecsList)('edge case $handle $origpath to throw $errmsg', ({ example, errmsg }) => { // @ts-expect-error WONTFIX testing bad input
  //         expect(() => Validate.parsedPath.cast(example)).to.throw(errmsg)
  //       })
  //     })
  //   })
  // }) // Path Types

})
