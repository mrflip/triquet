import      _                                /**/ from 'lodash'
import      { expect }                            from 'chai'
//
import type * as TY                               from '@freeword/meta'
import      { Validator, CK, UF }                 from '@freeword/meta'
//
import * as TH                                    from '../TestHelpers.ts'

function makeValidator() {
  const Validate = Validator(({ obj, fullname, stradd1, stradd2, postcode, label, bool, arr, tuple, custom, lat, lng, bareint }) => {
    const postal = obj({
      strnum: bareint.max(99999).optional().nullable(), stradd1, stradd2: stradd2.nullable(), postcode,
      leaveAtDoor: bool.optional(), place: obj({ lat, lng }),
    })
    return {
      postal,
      sortspec: arr(tuple([label, custom((val) => (val === 1 || val === -1), "should be +1 or -1")])),
      postcode,
      contact:  obj({ name: fullname, postals: arr(postal) }),
      contactS: obj({ name: fullname, postals: arr(postal) }).strict(),
    }
  })
  return Validate
}

function sortuniq(list: any[]) { return _.sortedUniq(_.sortBy(list)) }
function dumplist(listIn: any[], { width = 112, chunkSize = 6, quoted = true, note = '' }: { width?: number, chunkSize?: number, quoted?: boolean, note?: string } = {}) {
  // const list = quotes ? listIn.map(UF.qt) : listIn
  console.warn(note, "\n", UF.prettifyInChunks(_.sortBy(listIn), { stringify: quoted, colwd: width / chunkSize, chunkSize, naked: true }))
}

describe('Validator', () => {

  describe('construction', () => {
    it('from bag of items', () => {
      const Validate = makeValidator()
      expect(Validate.sortspec.cast([['name', 1], ['id', -1]])).to.eql([['name', 1], ['id', -1]])
      // property('_def').to.eql({ a: 1 })
    })
    describe('on invalid input', () => {
      it('array with custom check', () => {
        const Validate = makeValidator()
        expect(Validate.sortspec.check([['name', 0], ['id', -1]])).to.be.false
        // property('_def').to.eql({ a: 1 })
      })
      it('on invalid input', () => {
        const Validate = makeValidator()
        const garbage = {
          fullname: 'Bob', fullName: '', name: '',
          postals: [{ strnum: 8675309, stradd1: null, stradd2: null, postcode: 90210, leaveAtDoor: 'true', place: { lat: 120 } }],
        } // @ts-ignore WONTFIX testing bad input
        expect(() => Validate.contact.cast(garbage)).to.throw(
          `contact issues: name «''» is blank;; `
          + `postals[0].strnum «8_675_309» should be «99_999» or less;; `
          + `postals[0].stradd1 «null» is nil;; `
          + `postals[0].postcode «90_210» is a number but should be text;; `
          + `postals[0].leaveAtDoor «'true'» is text but should be true/false;; `
          + `postals[0].place.lat «120» should be «90» or less;; `
          + `postals[0].place.lng is unset`,
        )
        // property('_def').to.eql({ a: 1 })
      })
      it('on extra props', () => {
        const Validate = makeValidator()
        const garbage = {
          fullname: 'Bob', name: '',
          postals: [{ stradd1: '', postcode: '90210', leaveAtDoor: true, lng: 99, place: { lat: 120, lng: 180 } }],
        }
        // @ts-ignore WONTFIX testing bad input
        expect(() => Validate.contact.cast(garbage)).to.throw(
          `contact issues: name «''» is blank;; `
          + `postals[0].stradd1 «''» is blank;; `
          + `postals[0].stradd2 is unset;; `
          + `postals[0].place.lat «120» should be «90» or less`,
        )
      })
    })
  })

  describe('complex objects', () => {
    //
    // Set up our validations:
    //
    const Validate = Validator(({
      arr, obj, anybag, num, oneof, bool, quantity,
      familyName, givenName, stradd1, stradd2, postcode, email, medstr,
      bareint, lat, lng, phone, extkey:extkeyBase,
    }) => {
      const extkey = extkeyBase.min(1)
      const resolver = { params: anybag }
      const postal = obj({
        strnum: bareint.max(99999).optional().nullable(), stradd1, stradd2: stradd2.nullable(), postcode,
        leaveAtDoor: bool, place: obj({ lat, lng }),
      })
      return {
        resolver:     obj(resolver),
        quantityV:    obj({ quantity }),
        emailV:       obj({ email }),
        loc:          obj({
          id:    extkey,
          branch: oneof(['site', 'closet']),
          shipTo: obj({
            id: extkey, familyName, givenName: givenName.optional(), familyNameFirst: bool,
            phones: arr(phone).min(1),
            postal0: postal.strict(),
          }).optional(),
          trackings: arr(obj({ id: num, quantity: num.nullable().optional(), src: obj({ title: medstr }) })),
          dept: obj({ id: extkey, title: medstr, sectags: arr(extkey) }).strict(),
        }),
      }
    })
    const goodloc = {
      id:         'loc.foo:dump',
      shipTo: {
        id: 'ctp.foo:mansion', postal0: { postcode: '90210' }, familyName: 'Sanford', givenName: 'Fred', familyNameFirst: false,
      },
      dept: { id: 'dpt.foo:skrilla' },
      trackings: [{ id: 0, quantity: 3, src: { title: 'Weep Mizer' } }],
    }
    const badloc = {
      shipTo: {
        id:      '', familyName: null, phones: [],
        postal0: { strnum: 0 },
      },
      branch: undefined,
      trackings: [{ src: null }, { id: undefined }],
    }
    it('gives values for missing fields', () => {
      const report = Validate.loc.report(badloc)
      expect(report).property('badprops').to.eql({
        id:                         undefined,
        'shipTo.id':                '',
        'shipTo.phones':            [],
        'shipTo.postal0.leaveAtDoor': undefined,
        'shipTo.postal0.place':     undefined,
        'shipTo.familyName':        null,
        'shipTo.familyNameFirst':   undefined,
        'shipTo.postal0.postcode':  undefined,
        branch:                     undefined,
        dept:                       undefined,
        'shipTo.postal0.stradd1':   undefined,
        'shipTo.postal0.stradd2':   undefined,
        'trackings[0].id':          undefined,
        'trackings[0].src':         null,
        'trackings[1].id':          undefined,
        'trackings[1].src':         undefined,

      })
    })
    it('Explains with nuance the missing fields', () => {
      const report = Validate.loc.report(badloc) as TY.BadParseReport<string, any>
      expect(report).property('message').to.eql( // loc issues:
        `loc issues: id is unset;; `
        + `branch «undefined» is missing;; `
        + `shipTo.id «''» is blank;; `
        + `shipTo.familyName «null» is nil;; `
        + `shipTo.familyNameFirst is unset;; `
        + `shipTo.phones «[]» should not be empty;; `
        + `shipTo.postal0.stradd1 is unset;; `
        + `shipTo.postal0.stradd2 is unset;; `
        + `shipTo.postal0.postcode is unset;; `
        + `shipTo.postal0.leaveAtDoor is unset;; `
        + `shipTo.postal0.place is unset;; trackings[0].id is unset;; `
        + `trackings[0].src «null» is nil;; `
        + `trackings[1].id «undefined» is missing;; `
        + `trackings[1].src is unset;; `
        + `dept is unset`,

      )
      expect(TH.checkSnapshot(report)).to.be.true
    })
    it('reports on extra fields', () => {
      const garbage = {
        shipTo: { ignoredExtraProp: 'whatevs', postal0: { interloper: 'tee hee' } },
        dept: { extraDeptProp: 'oops' },
      }
      const report = Validate.loc.report(_.merge({}, goodloc, garbage)) as TY.BadParseReport<string, any>
      expect(report).to.be.an('error').and.include.keys(['badprops', 'message', 'messages'])
      const wanted = {
        branch:                       undefined,
        'dept.sectags':               undefined,
        'dept.title':                 undefined,
        'shipTo.phones':              undefined,
        'shipTo.postal0.leaveAtDoor': undefined,
        'shipTo.postal0.place':       undefined,
        'shipTo.postal0.stradd1':     undefined,
        'shipTo.postal0.stradd2':     undefined,
        _unknown:   { 'shipTo.postal0': { interloper: 'tee hee' }, dept: { extraDeptProp: 'oops' } },
      }
      if (! _.isEqual(report.badprops, wanted)) { TH.see(report.badprops) }
      expect(report).property('badprops').to.eql(wanted)
      expect(report).property('message').to.eql(
        `loc issues: branch is unset;; `
        + `shipTo.phones is unset;; `
        + `shipTo.postal0.stradd1 is unset;; `
        + `shipTo.postal0.stradd2 is unset;; `
        + `shipTo.postal0.leaveAtDoor is unset;; `
        + `shipTo.postal0.place is unset;; `
        + `dept.title is unset;; `
        + `dept.sectags is unset;; `
        + `unknown properties shipTo.postal0.interloper=«'tee hee'» and dept.extraDeptProp=«'oops'»`,
      )
      expect(TH.checkSnapshot(report)).to.be.true
    })
  })

  describe('by type', () => {
    const { Zods } = Validator
    const CkTypers = Validator.CheckerTypers
    const groupedChecks = {} as Record<string, string[]>
    _.each(Zods, (checker, checkername) => {
      const shapename = CkTypers.zShapename(checker)
      groupedChecks[shapename] ||=  []
      groupedChecks[shapename].push(checkername)
    })
    function checkerGroupname(primname: string) { return _.upperFirst(primname) + 'Checks' }
    const { str, oneof, obj, num, bool, nonChecker:_nc, ...others } = groupedChecks
    const other = _.flatten(_.values(others))
    const checkerGroups = { str, oneof, obj, num, bool, other }

    it.each(_.entries(checkerGroups))('groups all zod checks by type: %s', (primname, checknames) => {
      const actual = _.keys(Validator[checkerGroupname(primname) as keyof typeof Validator]).sort()
      if (primname === 'obj') { UF.appendMutatingly(actual, _.keys((Validator as any).ZodTypedObjChecks)); actual.sort() }
      expect(actual).to.eql(_.uniq([...checknames as string[]]).sort())
    })
    it('can dump the groups if you want', () => {
      const showCheckerGroups = false
      if (showCheckerGroups) {
        console.log(UF.prettifyInChunks(_.sortBy(_.flatten(_.map(checkerGroups, _.values))), { colwd: 15, chunkSize: 6, indent: 2, stringify: false, naked: true })) // eslint-disable-line no-console
      }
      const lines = [] as string[]
      if (showCheckerGroups) {
        _.each(checkerGroups, (checknames, primname) => {
          lines.push(`export const ${checkerGroupname(primname)} = {`)
          lines.push(UF.prettifyInChunks(_.sortBy(checknames), { colwd: 15, chunkSize: 6, indent: 2, stringify: false, naked: true }))
          lines.push(`} as const satisfies PartialBag<keyof typeof Checks, ${CkTypers.zodtstypeForCheckername(primname)}ish>\n`)
        })
        console.warn(lines.join('\n'))
      }
      expect(lines).to.be.an('array')
    })

    // const interestings = {}
    // const objzs = {}
    // _.each(Zods, (checker, checkername) => {
    //   const shapename = CkTypers.zShapename(checker)
    //   if (shapename === 'anyArr') {
    //     objzs[checkername] = simplifyCheckerDef(checker)
    //   } else if (/[A-Z]/.test(shapename)) {
    //     interestings[shapename] ||= {}
    //     interestings[shapename][checkername] = simplifyCheckerDef(checker)
    //   }
    // })
    // _.each(interestings, (intg, handle) => { console.warn(handle, '\n', TH.prettify(intg)) })
    // _.each(objzs,        (intg, handle) => { console.warn(handle, '\n', TH.prettify(intg)) })
  })

  describe('exports', () => {
    it('Exports all checkers and methods', () => {
      expect(TH.checkSnapshot({ ...(Validator as any).Checks })).to.be.true
    })
    it('Has all expected checks', () => {
      expect(TH.checkSnapshot(_.keys(Validator.Zods))).to.be.true
    })
  })

  describe('zShapename', () => {
    it('marks pipelined types correctly', () => {
      const { asciish, idk } = Validator.Zods
      expect(Validator.CheckerTypers.zShapename(idk.pipe(asciish))).to.eql('str')
    })
  })

  describe('All exported zchecks are available to Validator clients', () => {
    //
    const zfuncsExpected = [
      'among',   'arr',     'bag', 'cases', 'coerce',     'custom',  'instance',  'jsmap',   'jsset',   'jssym',
      'lazy',    'literal', 'obj', 'oneof', 'preprocess', 'tuple',   'typish',    'union',   'znever',  'promise',
      'arrROCk', 'arrNZCk', 'arrNZROCk', 'bagWithKeys', 'bagWithAllKeys', 'bagWithSomeKeys', 'splitStr', 'tupleOptionals',
      'oneOrMany', 'isLuxontime',
    ].sort()
    const utilnames   = [
      'isChecker',  'zShape',    'zShapename', // 'isBorked', 'BORKEDTYPENAME',
      'isArrChecker',            'isBagChecker',            'isBigintChecker',
      'isBoolArrChecker',        'isBoolChecker',           'isIdkChecker',
      'isJsdateChecker',         'isNumArrChecker',         'isNumChecker',
      'isOneofChecker',          'isStrArrChecker',         'isStrChecker',
      'isTupleChecker',          'isZneverChecker',         'isUnwrappable',
      'checkernameForZodname',   'zodnameForCheckername',   'zodtstypeForCheckername',
      'summarizeCheckerDef',     'zcheckZodTypename',
      'isAnyArrChecker',         'isBrandedCk',
      'isPipelineCk',            'isStrPipelineCk',
      'isNotnil',                'isNotund',
      'isDuration',
    ].sort()
    const notyetnames = [].sort()
    const straynames  = ['_SYNTHKEY_RE'].sort()
    const { Zods, Checks:validatorChecks } = Validator
    const validatorparams = _.keys(Zods).sort()
    const checknames      = _.keys(validatorChecks).sort()
    const zfuncs          = _.difference(validatorparams, _.without([...checknames, ...straynames, ...utilnames], 'znever')) // it's in both groups
    const exported        = _.keys(CK).filter((cn) => /^[^A-Z]/.test(cn)).sort()
    //
    const nonCheckNames  = sortuniq([...zfuncsExpected, ...utilnames, ...notyetnames, ...straynames])
    const expectedNames = _.uniq([...checknames, ...nonCheckNames])
    const exportedButNotInZodfood = _.difference(exported, expectedNames)
    const inZodfoodButNotExported = _.difference(expectedNames, [...exported, ...utilnames])
    //
    if (! _.isEmpty(exportedButNotInZodfood)) {
      dumplist(exportedButNotInZodfood,               { quoted: false, note: 'Add these to the checkname list (searcn "All exported zchecks are available" in tests/validation/Validator.test.ts)' })
      dumplist(_.difference(expectedNames, exported), { quoted: false, note: 'Or for the full list, paste this' })
    }

    it('Every check exported in src/checks/ is made available as CK.Zods', () => {
      expect(exportedButNotInZodfood).to.eql([])
    })
    it('Every check in CK.Zods is exported or included in the list of exceptions in this test file', () => {
      expect(inZodfoodButNotExported).to.eql([])
    })
    it('Our list of still-a-function zod primitives matches the exported kit of those', () => {
      expect(zfuncs).to.eql(zfuncsExpected)
    })
  })

})
