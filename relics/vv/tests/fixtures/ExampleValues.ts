import      _                                /**/ from 'lodash'
//
import      * as Luxon                            from 'luxon'
import type { AnyBag } from '@freeword/meta'
//
const { DateTime, Duration } = Luxon
Luxon.Settings.defaultZone     = "utc"

export const TransformableExamples = {
  leapDay2020: {
    asDate:     new Date('2020-02-29T08:08:42.512Z'),
    asDateTime: DateTime.fromISO('2020-02-29T08:08:42.512Z', { zone: 'utc' }),
    asISO:      '2020-02-29T08:08:42.512Z',
    asISOD:     '2020-02-29',
    asTS:       DateTime.fromISO('2020-02-29T08:08:42.512Z').toMillis(),
    asTC: '01e27zv28gt00kst0ckc0deftw',
  },
  in2005: {
    asDate:     new Date('2005-12-17T04:01:39.165Z'),
    asDateTime: DateTime.fromISO('2005-12-17T04:01:39.165Z', { zone: 'utc' }),
    asISO:      '2005-12-17T04:01:39.165Z',
    asISOD:     '2005-12-17',
    asTS:       DateTime.fromISO('2005-12-17T04:01:39.165Z').toMillis(),
    asTC: '0110ve2haxt00kst0ckc0deftw',
  },
  idkeys: {
    // technicall valid timeids:
    c0ff33:     'c0ff33hazthatcaff31ne1n33d',
    foolofa:    'f0010fat00kth1s1sasrysjrny',
    love:       '',   // unreasonably future-
    t00k:       '10ve2hax0nt00kst0ckc0deftw',   // unreasonably in future, natch
    t00k_10:    '10ve2hax0n',                   // just the time part
    t00k_16:    't00kst0ckc0deftw',             // timecode uniquer length
  },
  uuid_v1s: { // thanks https://nedbatchelder.com/text/hexwords.html
    // must have               1
    be5tc0de:   '5ca1ab1e-c0de-15da-be57-c0de42beabed',
  },
  uuid_v4s: {
    // magic bits forced:      4    v-- [89ab]
    effdecaf:   'effdecaf-50da-4f1p-a7da-c0ffee4d471d',
    salad:      'a1fa1fa5-a1ad-40dd-ba11-f00d1352feed',
  },

  duration250y: {
    asDuration:     Duration.fromObject({ years: 250 }),
    asParts:        { years: 250 },
    asISODur:       'P250Y',
    //
    asYears:        250,
    asQuarters:     1000,
    asMonths: 3000,
    asWeeks: 13000,
    asDays: 91250,
    asHours: 2190000,
    asMinutes: 131400000,
    asSeconds: 7884000000,
    asMillis: 7884000000000,
  },
  durationYearJumble: {
    asDuration:     Duration.fromObject({
      days:           0.125,   hours:    2,
      minutes:      525_600,   seconds:  3000,  milliseconds: 600_000,
    }),
    asParts:        {
      days:           0.125,   hours:    2,
      minutes:      525_600,   seconds:  3000,  millis: 600_000,
    },
    asISODur:       'P0.125DT2H525600M3600S',
    asYears:              1.0006849315068491, // 1.0006849315068493,
    asQuarters:           4.013736263736264,
    asMonths:            12.174999999999999, // 12.175,
    asWeeks:             52.17857142857143,
    asDays:             365.25,
    asHours:           8766,
    asMinutes:      525_960,
    asSeconds:      31_557_600,
    asMillis:       31_557_600_000,
  },
  durationYearMS: {
    asDuration:     Duration.fromMillis(31_557_600_000),
    asParts:        { millis: 31_557_600_000 },
    asISODur:       'PT31557600S',
    //
    asYears:              1.0006849315068493,
    asQuarters:           4.013736263736264,
    asMonths:            12.175,
    asWeeks:             52.17857142857143,
    asDays:             365.25,
    asHours:           8766,
    asMinutes:      525_960,
    asSeconds:      31_557_600,
    asMillis:       31_557_600_000,

  },
  durationYear: {
    asDuration:     Duration.fromObject({ years: 1 }),
    asParts:        { years: 1 },
    asISODur:       'P1Y',
    asYears:              1,
    asQuarters:           4,
    asMonths:            12,
    asWeeks:             52,
    asDays:             365,
    asHours:           8760,
    asMinutes:      525_600,
    asSeconds:      31_536_000,
    asMillis:       31_536_000_000,
  },
  durationRent: {
    asDuration:     Duration.fromObject({ minutes: 525_600 }),
    asParts:        { minutes:  525_600 },
    asISODur:       'PT525600M',
    //
    asYears:             1,
    asQuarters:          4.010989010989011,
    asMonths:           12.166666666666666,
    asWeeks:            52.142857142857146,
    asDays:            365,
    asHours:          8760,
    asMinutes:      525600,
    asSeconds:      31_536_000,
    asMillis:       31_536_000_000,
  },
  durationBareJohnCage: {
    asDuration:     Duration.fromObject({ weeks: 1, days: 5, minutes: 4, seconds: 33 }),
    asParts:        { weeks: 1, days: 5, minutes: 4, seconds: 33 }, // Barenaked Ladies + John Cage
    asISODur:       'P1W5DT4M33S',
    asYears:        0.0329380561409671,
    asQuarters:     0.1319028540903541,
    asMonths:       0.41677199074074067,
    asWeeks:        1.7147371031746033,
    asDays:         12.003159722222223,
    asHours:        288.0758333333333,
    asMinutes:      17284.55,
    asSeconds:      1037073,
    asMillis:       1037073000,

  },
  durationRentLessBJC: {
    asDuration:     Duration.fromObject({ days: 0.25 }),
    asParts:        { days: 0.25 },
    asISODur:       'P0.25D',
    asYears:        0.0006849315068493151,
    asQuarters:     0.0027472527472527475,
    asMonths:       0.008333333333333333,
    asWeeks:        0.03571428571428571,
    asDays:         0.25,
    asHours:        6,
    asMinutes:      360,
    asSeconds:      21_600,
    asMillis:       21_600_000,
  },
  duration0: {
    asDuration:     Duration.fromObject({}),
    asParts:        {},
    asISODur:       'PT0S',
    asYears:        0,
    asQuarters:     0,
    asMonths:       0,
    asWeeks:        0,
    asDays:         0,
    asHours:        0,
    asMinutes:      0,
    asSeconds:      0,
    asMillis:       0,
  },

  walkmorDates: {
    // otaku check: unf we reject dates more than 1000 years in the future,
    // so please add 1000 to the year in your calendrical stanning
    walkmor_shire_e:   ['2018-09-23T00:00:00Z', '01cr1vkk00myprettyprec10vs'],
    walkmor_meetup_e:  ['2018-10-25T00:00:00Z', '01ctm8ak00myprettyprec10vs'],
    walkmor_moria_e:   ['2019-01-15T00:00:00Z', '01d17cxh00myprettyprec10vs'],
    walkmor_mordor_e:  ['2019-03-10T00:00:00Z', '01d5jecb00myprettyprec10vs'],
    walkmor_mtdoom_e:  ['2019-03-25T00:00:00Z', '01d6s2b400myprettyprec10vs'],
    walkmor_sail_e:    ['2021-09-29T00:00:00Z', '01fgqdkn00myprettyprec10vs'],
  },
}

// == [Sample Path and Glob Examples] ==

export const ParsedPaths = {
  rootDir:             { origpath: '/',                                         abspath: '/',                                         basename: '/',                            barename: '/',                     fextffmt: null,     extname: '',           corefext: '',        knownfext: null,      comprfext: null, pathsegs: [],                                                        dirname: '/',            rootpath: '/', pathsep: '/' },
  knownfext:           { origpath: '/tmp/foo.bar/bilbo%40gmail.com.kv.json.gz', abspath: '/tmp/foo.bar/bilbo%40gmail.com.kv.json.gz', basename: 'bilbo%40gmail.com.kv.json.gz', barename: 'bilbo%40gmail.com',     fextffmt: 'jsonkv', extname: 'kv.json.gz', corefext: 'kv.json', knownfext: 'kv.json', comprfext: 'gz', pathsegs: ['tmp', 'foo.bar',      'bilbo%40gmail.com.kv.json.gz'],   dirname: '/tmp/foo.bar', rootpath: '/', pathsep: '/' },
  knownfextCAPS:       { origpath: '/tmp/foo.bar/bilbo%40gmail.com.kv.JSON.GZ', abspath: '/tmp/foo.bar/bilbo%40gmail.com.kv.JSON.GZ', basename: 'bilbo%40gmail.com.kv.JSON.GZ', barename: 'bilbo%40gmail.com',     fextffmt: 'jsonkv', extname: 'kv.JSON.GZ', corefext: 'kv.JSON', knownfext: 'kv.json', comprfext: 'gz', pathsegs: ['tmp', 'foo.bar',      'bilbo%40gmail.com.kv.JSON.GZ'],   dirname: '/tmp/foo.bar', rootpath: '/', pathsep: '/' },
  unknownfext:         { origpath: '/tmp/foo.bar/bilbo%40gmail.com.txt.foo.gz', abspath: '/tmp/foo.bar/bilbo%40gmail.com.txt.foo.gz', basename: 'bilbo%40gmail.com.txt.foo.gz', barename: 'bilbo%40gmail.com.txt', fextffmt: null,     extname: 'foo.gz',     corefext: 'foo',     knownfext: null,      comprfext: 'gz', pathsegs: ['tmp', 'foo.bar',      'bilbo%40gmail.com.txt.foo.gz'],   dirname: '/tmp/foo.bar', rootpath: '/', pathsep: '/' },
  initDotDecoy:        { origpath: '/tmp/.md',                                  abspath: '/tmp/.md',                                  basename: '.md',                          barename: '.md',                   fextffmt: null,     extname: '',           corefext: '',        knownfext: null,      comprfext: null, pathsegs: ['tmp',                                          '.md'],   dirname: '/tmp',         rootpath: '/', pathsep: '/' },
  trailingDot:         { origpath: '/tmp/.md.',                                 abspath: '/tmp/.md.',                                 basename: '.md.',                         barename: '.md.',                  fextffmt: null,     extname: '',           corefext: '',        knownfext: null,      comprfext: null, pathsegs: ['tmp',                                         '.md.'],   dirname: '/tmp',         rootpath: '/', pathsep: '/' },
  trailingDotDot:      { origpath: '/tmp/.md..',                                abspath: '/tmp/.md..',                                basename: '.md..',                        barename: '.md..',                 fextffmt: null,     extname: '',           corefext: '',        knownfext: null,      comprfext: null, pathsegs: ['tmp',                                        '.md..'],   dirname: '/tmp',         rootpath: '/', pathsep: '/' },
  trailingSlash:       { origpath: '/tmp/.md..',                                abspath: '/tmp/.md..',                                basename: '.md..',                        barename: '.md..',                 fextffmt: null,     extname: '',           corefext: '',        knownfext: null,      comprfext: null, pathsegs: ['tmp',                                        '.md..'],   dirname: '/tmp',         rootpath: '/', pathsep: '/' },
  manySlashdots:       { origpath: '////tmp//foo/../bar///../../tmp/foo/..',    abspath: '/tmp',                                      basename: 'tmp',                          barename: 'tmp',                   fextffmt: null,     extname: '',           corefext: '',        knownfext: null,      comprfext: null, pathsegs:                                                 ['tmp'],   dirname: '/',            rootpath: '/', pathsep: '/' },
  bareDir1:            { origpath: '/tmp/foo',                                  abspath: '/tmp/foo',                                  basename: 'foo',                          barename: 'foo',                   fextffmt: null,     extname: '',           corefext: '',        knownfext: null,      comprfext: null, pathsegs: ['tmp',                                          'foo'],   dirname: '/tmp',         rootpath: '/', pathsep: '/' },
  oneDots:             { origpath: '/tmp/foo/.',                                abspath: '/tmp/foo',                                  basename: 'foo',                          barename: 'foo',                   fextffmt: null,     extname: '',           corefext: '',        knownfext: null,      comprfext: null, pathsegs: ['tmp',                                          'foo'],   dirname: '/tmp',         rootpath: '/', pathsep: '/' },
  twoDots:             { origpath: '/tmp/foo/..',                               abspath: '/tmp',                                      basename: 'tmp',                          barename: 'tmp',                   fextffmt: null,     extname: '',           corefext: '',        knownfext: null,      comprfext: null, pathsegs:                                                 ['tmp'],   dirname: '/',            rootpath: '/', pathsep: '/' },
  threeDots:           { origpath: '/tmp/foo/...',                              abspath: '/tmp/foo/...',                              basename: '...',                          barename: '...',                   fextffmt: null,     extname: '',           corefext: '',        knownfext: null,      comprfext: null, pathsegs: ['tmp', 'foo',                                   '...'],   dirname: '/tmp/foo',     rootpath: '/', pathsep: '/' },
  initDotNoFext:       { origpath: '/.inputrc',                                 abspath: '/.inputrc',                                 basename: '.inputrc',                     barename: '.inputrc',              fextffmt: null,     extname: '',           corefext: '',        knownfext: null,      comprfext: null, pathsegs:                                            ['.inputrc'],   dirname: '/',            rootpath: '/', pathsep: '/' },
  dirnameNoFext:       { origpath: '/usr/local/bin',                            abspath: '/usr/local/bin',                            basename: 'bin',                          barename: 'bin',                   fextffmt: null,     extname: '',           corefext: '',        knownfext: null,      comprfext: null, pathsegs: ['usr', 'local',                                 'bin'],   dirname: '/usr/local',   rootpath: '/', pathsep: '/' },
  initDotFext:         { origpath: '/.eslintrc.cjs',                            abspath: '/.eslintrc.cjs',                            basename: '.eslintrc.cjs',                barename: '.eslintrc',             fextffmt: 'js',     extname: 'cjs',        corefext: 'cjs',     knownfext: 'cjs',     comprfext: null, pathsegs:                                         ['.eslintrc.cjs'], dirname: '/',            rootpath: '/', pathsep: '/' },
  initDotUnkFext:      { origpath: '/.eslintrc.foo.bar',                        abspath: '/.eslintrc.foo.bar',                        basename: '.eslintrc.foo.bar',            barename: '.eslintrc.foo',         fextffmt: null,     extname: 'bar',        corefext: 'bar',     knownfext: null,      comprfext: null, pathsegs:                                     ['.eslintrc.foo.bar'], dirname: '/',            rootpath: '/', pathsep: '/' },
  dinitDotFextLongDir: { origpath: '/this/that/the.other/and/those/.foo.cjs',   abspath: '/this/that/the.other/and/those/.foo.cjs',   basename: '.foo.cjs',                     barename: '.foo',                  fextffmt: 'js',     extname: 'cjs',        corefext: 'cjs',     knownfext: 'cjs',     comprfext: null, pathsegs: ['this', 'that', 'the.other', 'and', 'those', '.foo.cjs'], dirname: '/this/that/the.other/and/those', rootpath: '/', pathsep: '/' },
  // relblank:            { origpath: '.',                                         abspath: '.',                                         basename: '.',                            barename: '.',                     fextffmt: null,     extname: '',           corefext: '',        knownfext: null,      comprfext: null, pathsegs:                                            ['.'],   dirname: '/',            rootpath: '/', pathsep: '/' },
  // blank:               { origpath: '',                           errmsg: `path is required : got {path:''}: checkname='` },
  // isUndef:             { origpath: undefined,                    errmsg: `path is required : got {path:'%missing'}: checkname='` },

}

export const ParsedGlobs = {
  knownfextGlob:       { origpath: '/tmp/foo.bar/*.kv.json.gz',                                  abspath: '/tmp/foo.bar/*.kv.json.gz',  basename: '*.kv.json.gz',               barename: '*',                     fextffmt: 'jsonkv', extname: 'kv.json.gz', corefext: 'kv.json', knownfext: 'kv.json', comprfext: 'gz', pathsegs: ['tmp', 'foo.bar',      '*.kv.json.gz'], dirname: '/tmp/foo.bar', rootpath: '/', pathsep: '/' },
  knownfextCAPSGlob:   { origpath: '/tmp/foo.bar/*.kv.JSON.GZ',                                  abspath: '/tmp/foo.bar/*.kv.JSON.GZ',  basename: '*.kv.JSON.GZ',               barename: '*',                     fextffmt: 'jsonkv', extname: 'kv.JSON.GZ', corefext: 'kv.JSON', knownfext: 'kv.json', comprfext: 'gz', pathsegs: ['tmp', 'foo.bar',      '*.kv.JSON.GZ'], dirname: '/tmp/foo.bar', rootpath: '/', pathsep: '/' },
  unknownfextGlob:     { origpath: '/tmp/foo.bar/*.{md,pdf}.gz',                                 abspath: '/tmp/foo.bar/*.{md,pdf}.gz', basename: '*.{md,pdf}.gz',              barename: '*.{md,pdf}',            fextffmt: null,     extname: 'gz',         corefext: '',        knownfext: null,      comprfext: 'gz', pathsegs: ['tmp', 'foo.bar',     '*.{md,pdf}.gz'], dirname: '/tmp/foo.bar', rootpath: '/', pathsep: '/' },
  manySlashdotsGlob:   { origpath: '////tmp//foo/../bar{a,b}?///../*/../../../../**/tmp/foo/..', abspath: '/**/tmp',                    basename: 'tmp',                        barename: 'tmp',                   fextffmt: null,     extname: '',           corefext: '',        knownfext: null,      comprfext: null, pathsegs:                           ['**', 'tmp'], dirname: '/**',          rootpath: '/', pathsep: '/' },
  longGlob:            { origpath: '/**/*/the.*/and?/.??*/../../../../.foo.cjs',                 abspath: '/**/.foo.cjs',               basename: '.foo.cjs',                   barename: '.foo',                  fextffmt: 'js',     extname: 'cjs',        corefext: 'cjs',     knownfext: 'cjs',     comprfext: null, pathsegs:                      ['**', '.foo.cjs'], dirname: '/**',          rootpath: '/', pathsep: '/' },
}

export const InvalidPaths = {
  win32DriveRoot:      { origpath: 'C:\\',                       errmsg: /path should have plain or pattern characters : got/ },
  win32CIFSPath:       { origpath: '\\Users\\foo\\code\\mearth', errmsg: /path should have plain or pattern characters : got/ },
  win32NamespacedRoot: { origpath: '\\\\?\\C:\\',                errmsg: /path should have plain or pattern characters : got/ },
  hasColon:            { origpath: 'foo:bar',                    errmsg: /path should have plain or pattern characters : got/ },
  // isNull:              { origpath: null,                         errmsg: `path is required : got {path:%~null}: checkname='` },
  isNum:               { origpath: 44,                           errmsg: "path must be a `string` type, but the final value was: `44` : got {path:44}: checkname='" },
}
// --

// == [Other Miscellaneous Examples] ==

export const Wutang = ['RZA', 'GZA', 'Inspectah Deck', 'U-God', 'Ghostface Killah', 'Method Man', 'Raekwon The Chef', 'Masta Killa', 'Cappadonna', 'Ol Dirty Bastard'] as const

export const BagExamples = {
  Rewards: {
    __typename: "RewardsConnection",
    totalCount: 2,
    nodes: [
      {
        __typename: "Reward",
        id: "rwd.klee:zro-reward_f997c",
        okey: "klee",
        title: "BOGO Deal",
        tmi: {
          zro: {
            redemption_type: "Fixed Amount Discount",
            redemption_value: "25",
            eligible_tiers_list: [
              "zrl_kr_elite_tier",
              "zrl_ultimate_wash",
              "zrl_platinum",
              "zrl_gold",
            ],
            redemption_eligibility_criteria: "Tier Based",
          },
        },
        extkey: "reward_f997c",
        unitPts: {
          num: 20000,
        },
        viz: "secondary",
      },
      {
        __typename: "Reward",
        id: "rwd.klee:zro-reward_e5c59",
        okey: "klee",
        title: "INSTANT ARIMITSU SAVINGS",
        tmi: {
          zro: {
            redemption_type: "Fixed Amount Discount",
            redemption_value: "50",
            eligible_tiers_list: [
              "zrl_platinum",
              "zrl_2_bay",
              "zrl_gold",
              "zrl_silver",
              "zrl_kleen-rite_tier",
            ],
            redemption_eligibility_criteria: "Tier Based",
          },
        },
        extkey: "reward_e5c59",
        unitPts: {
          num: 50000,
        },
        viz: "hidden",
      },
    ],
  },
  RewardsBaggy: { placeholder: true },
  NestedBag:    { placeholder: true },
} as { Rewards: AnyBag, RewardsBaggy: AnyBag, NestedBag: AnyBag }
BagExamples.RewardsBaggy = _.cloneDeep(BagExamples.Rewards)
BagExamples.RewardsBaggy.byID = {}
_.each(BagExamples.Rewards.nodes, (obj) => { BagExamples.RewardsBaggy.byID[obj.id] = obj })
BagExamples.NestedBag = _.cloneDeep(BagExamples.RewardsBaggy)
BagExamples.NestedBag.byID["rwd.klee:zro-reward_f997c"][".initialdot"]  = { "internal.dot": "internal.dot value", "terminaldot.": "terminaldot. value", list: [1, "1", 5, 99] }
BagExamples.NestedBag.byID["rwd.klee:zro-reward_f997c"]["terminaldot."] = { "internal.dot": "internal.dot value", "terminaldot.": "terminaldot. value", list: [1, "1", 5, 99] }
BagExamples.NestedBag.toplist = ["-2", "-3", "-10", "-1", -2, -3, 10, -10, 1, 0, "10", "ten", 0.001, -0.001, { aa: 'aa' }, [3, 2, 1]]
// --

/* eslint-disable space-in-parens, no-unused-vars, lines-between-class-members, no-extra-semi */

// == [Primitive Type Exemplars] ==

export class BlankClass   { }

export const BoringObj = new BlankClass()

export class ExampleClass { howdy(me: string) { return `hello to ${me}` } }

export const NonPlainObj   = new BlankClass()
export const EmptyString   = ''
export const Zero          = 0
export const TrueVal       = true
export const FalseVal      = false
export const NaNVal        = NaN
export const NullVal       = null
export const NullAsString  = 'null'
export const UndVal        = undefined
export const UndAsString   = 'undefined'

export const EmptyArr     = []
export const NonEmptyArr  = [3, 1, 4, 1, 5, 9]
export const ArrOfStrings = ["uno", "dos", "tres"]
export const EmptyObj    = {}
export const NonEmptyObj = { aisfor: 'apple', bisfor: 'bee' }
export const ArrOfPairs   = _.entries(NonEmptyObj)
export const DerpNull       = 'null'
export const DerpUndefined  = 'undefined'

export const BrokenPromise  = new Promise((_yay, _boo) => { throw new Error('Fool me once...') }).catch((err) => err)
export const EmptyPromise   = Promise.resolve()
export const PromiseNothing = new Promise((yay, _boo) => { yay(0) })
export const EmptyMap       = (new Map())
export const NonEmptyMap    = new Map(ArrOfPairs)
export const EmptySet       = new Set([])
export const NonEmptySet    = new Set(NonEmptyArr)
export const EmptyBuffer    = Buffer.from([])
export const NonEmptyBuffer = Buffer.from(NonEmptyArr)
export const NonEmptyUia8   = Uint8Array.from(NonEmptyArr)
export const NonEmptyUia16  = Uint16Array.from(NonEmptyArr)
export const NonEmptyUia16b = Uint16Array.from(NonEmptyBuffer)

export const ArrowFunction  = (val: number) => (val * val)
export function RegularFunction(val: number) { return val * val * val }
export function * SyncGenFactory(val: number) { for (const ii of _.range(val, 2 * val)) { yield ii } }
export async function * AsyncGenFactory(val: number) { for (const ii of _.range(val, 2 * val)) { yield ii } }
export const SyncGenerator  = SyncGenFactory(6)
export const AsyncGenerator = AsyncGenFactory(6)

export const EmptyRegExp    = new RegExp('') // eslint-disable-line prefer-regex-literals

export const BobOclock      = new Date('2021-08-08T08:08:00.000Z')

export const BlankError     = new Error()
export class FancyError extends Error { declare extensions: AnyBag; constructor(msg: string) { super(msg); this.extensions = { level: 5 } } }
export const FancySad       = new FancyError('fancy!')
// --

// == [Primitive Type Galleries] ==

export const primtypesGallery = {
  // not falsy, not blank, not void, not nil
  NonEmptyArr, ArrOfStrings, NonEmptySet, NonEmptyBuffer, NonEmptyUia8,
  TrueVal, NonEmptyObj, BoringObj, NonEmptyMap, BlankClass, EmptyRegExp, BlankError,
  ArrowFunction, RegularFunction, SyncGenerator, AsyncGenerator,
  BrokenPromise,  // you cad...
  EmptyPromise,   // the trust is gone
  PromiseNothing, // I won't be hurt again
  // falsy, not blank, not void, not nil
  NaNVal, FalseVal, Zero,
  // nil, falsy, blank and void
  UndVal, NullVal,
  // falsy, blank and void
  EmptyString: '',
  // truthy, blank, not void
  NullAsString, UndAsString,
  // truthy, non-blank, void
  EmptyArr, EmptyObj, EmptyMap, EmptySet, EmptyBuffer,
}
export const examplesArr = _.values(primtypesGallery)

export const TheseExist = {
  NonEmptyArr, ArrOfStrings, NonEmptySet, NonEmptyBuffer, NonEmptyUia8,
  TrueVal, NonEmptyObj, BoringObj, NonEmptyMap, BlankClass, EmptyRegExp, BlankError,
  ArrowFunction, RegularFunction, SyncGenerator, AsyncGenerator,
  BrokenPromise, EmptyPromise, PromiseNothing,
}

export const PrimtypeGazette = {
  isObjectLike: [NonEmptyArr, ArrOfStrings, NonEmptySet, NonEmptyBuffer, NonEmptyUia8, NonEmptyObj, BoringObj, NonEmptyMap, EmptyRegExp, BlankError, SyncGenerator, AsyncGenerator, BrokenPromise, EmptyPromise, PromiseNothing, EmptyArr, EmptyObj, EmptyMap, EmptySet, EmptyBuffer],
  isObject:     [NonEmptyArr, ArrOfStrings, NonEmptySet, NonEmptyBuffer, NonEmptyUia8, NonEmptyObj, BoringObj, NonEmptyMap, BlankClass, EmptyRegExp, BlankError, ArrowFunction, RegularFunction, SyncGenerator, AsyncGenerator, BrokenPromise, EmptyPromise, PromiseNothing, EmptyArr, EmptyObj, EmptyMap, EmptySet, EmptyBuffer],
  isFunction:   [BlankClass, ArrowFunction, RegularFunction],
  arrayish:     [NonEmptyArr, ArrOfStrings, NonEmptySet, NonEmptyBuffer, NonEmptyUia8, SyncGenerator, EmptyArr, EmptySet, EmptyBuffer],
  baggish:      [NonEmptyObj, BoringObj, BlankError, EmptyObj],
  objectish:    [NonEmptyObj, BoringObj, NonEmptyMap, BlankError, EmptyObj, EmptyMap],
}
// --

// == [Sample String Examples] ==

export const Strings = {
  good_idkey:       '0be10ved1d0be11evew10ve1d0',
  good_non_tc:      'obelovedidobelieveuloveido',
  short:            'obelovedidob',
  idsegstr:         'a2345678901234567890123456',
  medstr:           'a234567890123456789012345678901234567890',
  len_41:           'a2345678901234567890123456789012345678901',
  fullstr:          _.repeat('1234567890', 10),
  has_dashes:       'o-beloved',
  has_underbar:     'o_beloved',
  has_whitespace:   'o be love',
  titlecase:        'O Beloved',
  camelcase:        'oBelovedIDo',
  emptystring:      '',
  null_val:          null,
  undef_val:         undefined,
  bangy:            '!',
  twiddly:          '~',
}

export const LongStrings = {
  oban_logo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/48/Gatehouse_Merchant_Adventurers_Hall%2C_Fossgate_York.jpg/1024px-Gatehouse_Merchant_Adventurers_Hall%2C_Fossgate_York.jpg',
}

export const Handleish = {
  len_16:       'obelovedidobe',
  len_25:       'a234567890123456789012345',
  len_26:       'a2345678901234567890123456',
  len_27:       'a23456789012345678901234567',
  len_40:       'a234567890123456789012345678901234567890',
  len_41:       'a2345678901234567890123456789012345678901',
  len_100:      _.repeat('a234567890', 10),
  len_101:      `${_.repeat('a234567890', 10)}1`,
}

export const IDs = {
  with_valid_prefix: _.mapValues(Strings, (idkey) => (_.isString(idkey) ? `pur.bob:${idkey}` : idkey)),
}
// --

// == [Long Text Examples] ==

export const BasicTSV = `
theme\tintish\tnumish\ttextish
nulled\t\\N\t\\N\t\\N
blank\t\t\t
short\t

plain\t1\t2\tplain
fancy\t-234\t-234.01234\t🤘 l'Épistèmê de Motörhead™ 🤙!
yikes\t\r\t\v\0\t\b
`.trim()

export const MissingHeaderTSV = `\t\tnumish\ttextish
plain\t1\t2\tplain`

export const html = _.trim(`
<div class="page-row padding-5-top">
<div class="col-xs-12 col-sm-12 col-md-12 col-lg-12">
<h2>
Product Description
</h2>
<div class="product-description-wrap"><h3>4' x 4' Gray Fiberglass Grating</h3>
<p>This product is a 4' x 4' size section of Kleen-Rite EZ-Grate in the gray color option. Kleen-Rite EZ-Grate is a tough fiberglass grating option for car wash pits and industrial drain areas. Made with durable polyester resin with a gritty no-slip grip. The reduced size of EZ-Grate allows it to be moved and lifted much easier, has a smaller footprint for shipping, allows for easier shape customization without cutting, and lets you replace small sections of grating if damage occurs rather than huge sections.</p>
<ul>
<li>Gray color option</li>
<li>4 foot x 4 foot size</li>
<li>1.25" squares, 1.5" thickness<br />
</li>
<li>Super-tough polyester resin fiberglass construction</li>
<li>Gritty non-slip top</li>
<li>Reduced size versus traditional grating</li>
</ul>
<p>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; - Easier moving and lifting</p>
<p>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; - Smaller shipping footprint</p>
<p>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; - Shape customization with less cutting</p>
<p>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; - Ability to replace smaller sections rather than huge sections<br />
</p>
<ul>
<li>Non-metal material means no theft for scrapping</li>
<li>Corrosion-resistant - perfect for wet, harsh environments</li>
<li>Weight: 70 lbs.<br />
</li>
<li><strong><a href="https://www.kleen-ritecorp.com/p-66132-kleen-rite-gray-3-ft-x-4-ft-ez-grate-fiberglass-car-wash-grating.aspx">3' x 4' section also available</a></strong></li>
<li><strong><a href="https://www.kleen-ritecorp.com/p-66916-kleen-rite-yellow-4-ft-x-4-ft-ez-grate-fiberglass-car-wash-grating.aspx">Yellow 4' x 4' section also available</a><br />
</strong></li>
<li>For load information, see the load chart listed under "Manuals"<br />
</li>
</ul></div>
</div>
</div>
`)

export const markdown = `
# Product Description

## 4' x 4' Gray Fiberglass Grating

This product is a 4' x 4' size section of Kleen-Rite EZ-Grate in the gray color option.
Kleen-Rite EZ-Grate is a tough fiberglass grating option for car wash pits and industrial
drain areas. Made with durable polyester resin with a gritty no-slip grip. The reduced size
of EZ-Grate allows it to be moved and lifted much easier, has a smaller footprint for
shipping, allows for easier shape customization without cutting, and lets you replace
small sections of grating if damage occurs rather than huge sections.

* Gray color option
* 4 foot x 4 foot size
* 1.25" squares, 1.5" thickness
* Super-tough polyester resin fiberglass construction
* Gritty non-slip top
* Reduced size versus traditional grating
  - Easier moving and lifting
  - Smaller shipping footprint
  - Shape customization with less cutting
  - Ability to replace smaller sections rather than huge sections
* Non-metal material means no theft for scrapping
* Corrosion-resistant - perfect for wet, harsh environments
* Weight: 70 lbs.
* [3' x 4' section also available](https://www.kleen-ritecorp.com/p-66132-kleen-rite-gray-3-ft-x-4-ft-ez-grate-fiberglass-car-wash-grating.aspx)
* [Yellow 4' x 4' section also available](https://www.kleen-ritecorp.com/p-66916-kleen-rite-yellow-4-ft-x-4-ft-ez-grate-fiberglass-car-wash-grating.aspx)

For load information, see the load chart listed under "Manuals"
`
// --
