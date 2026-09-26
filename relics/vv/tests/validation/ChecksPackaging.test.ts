import      _                                /**/ from 'lodash'
import      { expect }                            from 'chai'
//
import type * as TY                               from '@freeword/meta'
import      { Validator, CK, UF }                 from '@freeword/meta'
//
import * as TH                                    from '../TestHelpers.ts'

const CheckerTools = [
  'isAnyArrChecker',     'isArrChecker',        'isBagChecker',        'isBigintChecker',     'isBoolArrChecker',
  'isBoolChecker',       'isBrandedCk',         'isChecker',           'isIdkChecker',        'isJsdateChecker',
  'isNotnil',            'isNotund',            'isNumArrChecker',     'isNumChecker',        'isOneofChecker',
  'isPipelineCk',        'isStrArrChecker',     'isStrChecker',        'isStrPipelineCk',     'isTupleChecker',
  'isUnwrappable',       'isZneverChecker',
  '_SYNTHKEY_RE',        'checkernameForZodname',  'summarizeCheckerDef',
  'zShape',  'zShapename',  'zcheckZodTypename',  'zodnameForCheckername',  'zodtstypeForCheckername',
]

describe('ChecksPackaging', () => {
  it('should package checks correctly', () => {
    const allChecks = _.reject(_.keys(CK), (ck) => /^[A-Z]/.test(ck))
    let validatorChecks = {} as TY.AnyBag
    Validator((checks) => { validatorChecks = checks; return {} })
    const strayChecks    = _.without(_.keys(validatorChecks), ...allChecks)
    const missingChecks = _.without(allChecks, ..._.keys(validatorChecks), ...CheckerTools)
    if (! _.isEmpty(strayChecks))   { TH.see(strayChecks) }
    if (! _.isEmpty(missingChecks)) { console.info('Add these checks in Validator():\n\n', missingChecks.join(', '), "\n") }
    expect(strayChecks).to.be.empty
    expect(missingChecks).to.be.empty
  })
})