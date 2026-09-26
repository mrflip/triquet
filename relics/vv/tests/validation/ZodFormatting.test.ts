import      _                                /**/ from 'lodash'
import      { expect }                            from 'chai'
import      { UF, Validator, CK }                 from '@freeword/meta'
import type * as TY                               from '@freeword/meta'
//
import      * as TH                               from '../TestHelpers.ts'

const { Z } = Validator

/* eslint-disable space-in-parens */

const Untrimmed = {
  tab:        '\t',
  lf:         '\n',
  cr:         '\r',
  win_nl:     '\r\n',
  space:      ' ',
}
const Disallowed = {
  '~^0000':   '\u0000',
  '~^007F':   '\u007F',
}

const SHOULD_BE_TRIMMED = [
  ['lower',   'lower',   `should be all lowercase`],
  ['upper',   'UPPER',   `should be all uppercase`],
  ['trimmed', 'trimmed', `has tabs, returns or weird characters`],
]

const TestChecks = {
  wu:             CK.obj({
    artist:       CK.oneof(TH.Examples.Wutang),
    title:        Z.string().min(1).regex(/^[A-Z]/, 'should be a title').optional(),
    somethingToEffWith: CK.bool,
    cuts: CK.arr(CK.obj({
      title:      Z.string().min(1).regex(/^[A-Z]/).nullable(),
      feat:       CK.arr(CK.oneof(UF.arrNZ(TH.Examples.Wutang))),
      year:       CK.num.min(1996).multipleOf(4),
    }).strict()).optional(),
    sales:        CK.obj({
      domestic:   CK.num.optional(),
      intl:       CK.num.optional(),
    }).strict('No sales in outer space, yet').optional(),
  }).strict(),
  //
  arr_nonempty:   CK.arr(CK.num).min(1),
  arr_empty:      CK.arr(CK.num).length(0),
  arr_eq_1:       CK.arr(CK.num).length(1),
  // arr_eq_3:    CK.arr(CK.num).length(3),
  arr_eq_3:       Z.array(CK.num).length(3),
  arr_lte_1:      CK.arr(CK.num).max(1),
  arr_lte_3:      CK.arr(CK.num).max(3),
  arr_gte_1:      CK.arr(CK.num).min(1),
  arr_gte_3:      CK.arr(CK.num).min(3),
  set_empty:      CK.jsset(CK.num).size(0),
  set_nonempty:   CK.jsset(CK.num).min(1),
  set_eq_1:       CK.jsset(CK.num).size(1), // zod doesn't test set.size correctly
  set_eq_3:       CK.jsset(CK.num).size(3), // zod doesn't test set.size correctly
  set_lte_1:      CK.jsset(CK.num).max(1),
  set_lte_3:      CK.jsset(CK.num).max(3),
  set_gte_1:      CK.jsset(CK.num).min(1),
  set_gte_3:      CK.jsset(CK.num).min(3),
  // Do NOT use the built-in checker, it accepts eg 2022-02-31 as valid.
  str_date:       Z.string().datetime(),
  // We don't use js Dates here, but need to test the error handler
  date_lte:       Z.date().max(new Date("2022-05-04")),
  date_gte:       Z.date().min(new Date("2022-05-04")),
  //
  str_eq_1:       CK.str.length(1),
  str_eq_4:       CK.str.length(4),
  str_lte:        CK.str.min(20),
  str_gte:        CK.str.max(4),
  regex_no_msg:   CK.str.regex(/C.R.E.A.M/),
  regex_with_msg: CK.str.regex(/C.R.E.A.M/, { message: 'should be def' }),
  str_includes:   CK.str.includes('C.R.E.A.M'),
  str_startsWith: CK.str.startsWith('C.R.E.A.M'),
  str_endsWith:   CK.str.endsWith('C.R.E.A.M'),
  //
  num_lt:         Z.number().lt(7),
  num_lte:        Z.number().lte(7),
  num_gt:         Z.number().gt(7),
  num_gte:        Z.number().gte(7),
  num_multipleOf: Z.number().multipleOf(7),  // Evenly divisible by 7. Alias .step(7)
  num_int:        Z.number().int(),          // value should be an integer
  num_finite:     Z.number().finite(),       // value should be finite, not Infinity or -Infinity
  num_safe:       Z.number().safe(),         // value should be between Number.MIN_SAFE_INTEGER and Number.MAX_SAFE_INTEGER
  //
  place:          CK.obj({ name: Z.string().min(1).regex(/^[A-Z]/, 'be a title'), lat: CK.lat, lng: CK.lng }).describe('Place'),
  //
  orly:           CK.obj({
    email:        CK.email.regex(/^g/).min(10),
    down:         CK.obj({ we: CK.obj({ go: Z.union([CK.str.min(1).max(2), CK.literal(true), CK.num.multipleOf(4).int().max(33)]) }).strict() }),
    down2:        CK.obj({ we: CK.obj({ go: CK.num.multipleOf(4).int().max(33).or(CK.literal(true)).or(CK.str) }).strict() }),
    muddle:       Z.union([Z.string(), Z.array(Z.string()), Z.boolean(), Z.number(), Z.symbol()]),
  }).strict(),
  foolish_union:  Z.string().or(Z.array(Z.string()).or(Z.boolean().or(Z.number()).or(Z.symbol()))),
  unionit:        Z.union([Z.string(), Z.array(Z.string()), Z.boolean(), Z.number(), Z.symbol()]),
  anyfspath:      Z.union([Z.string(), Z.array(Z.string()), Z.object({ path: Z.string().or(Z.array(Z.string())) }), Z.object({ outdir: Z.string() })]),
  // Zod will try all the alternatives but does not give a union error in complex cases; instead it only nitpicks the first.
  muym:           Z.union([Z.number().multipleOf(9).int().max(33), Z.string(), Z.number().min(1).max(2), Z.number().multipleOf(5)]),
}
const AllChecks = { ...TestChecks, ...CK } as unknown as TY.Bag<TY.Zchecker<any, any>>

const InvalidScenarios = _.map([
  [
    'wu',
    { artist: 'Kenny G', somethingToEffWith: 'maybe',  cuts: [{ title: 'Sunset at Noon', year: 1982, feat: ['Kenny G'] }] },
    `artist «'Kenny G'» should be one of RZA,GZA…Ol Dirty Bastard;; `
    + `somethingToEffWith «'maybe'» is text but should be true/false;; `
    + `cuts[0].feat[0] «'Kenny G'» should be one of RZA,GZA…Ol Dirty Bastard;; `
    + `cuts[0].year «1_982» should be «1_996» or more and should be an exact multiple of «4»`,
    { artist: "Kenny G", "cuts[0].feat[0]": "Kenny G", "cuts[0].year": 1982, somethingToEffWith: "maybe" },
  ],
  [
    'wu',
    { artist: 'Ghostface Killah', title: null, somethingToEffWith: false,  pinky: 'ring', sales: { pluto: 9 }, cuts: [{ title: 'Marvel', year: '1_996', feat: ['RZA'], only: 'built', for_what: 'Linx...', whence: 'Cuba'  }] },
    `title «null» is nil;; cuts[0].year «'1_996'» is text but should be a number;; `
    + `unknown properties cuts.0.{only=«'built'», for_what=«'Linx...'», and whence=«'Cuba'»}; sales.pluto=«9»; and pinky=«'ring'»`,
    { title: null, 'cuts[0].year': '1_996',    _unknown: { 'cuts[0]': { only: 'built', for_what: 'Linx...', whence: 'Cuba' }, sales: { pluto: 9 }, pinky: 'ring' } },
  ],
  [
    'wu',
    { artist: 'Ghostface Killah', title: null, somethingToEffWith: false, cuts: [{ title: 'Marvel', year: 1996, feat: ['RZA'], only: 'built', for_what: 'Linx...', whence: 'Cuba'  }] },
    `title «null» is nil;; unknown properties cuts.0.{only=«'built'», for_what=«'Linx...'», and whence=«'Cuba'»}`,
    { _unknown: { "cuts[0]": { for_what: "Linx...", only: "built", whence: "Cuba" } }, title: null },
  ],
  [
    'wu',
    { artist: 'Ghostface Killah', title: undefined, year: 1996, somethingToEffWith: false,  cuts: [{ year: 1996, feat: ['RZA'] }] },
    `cuts[0].title is unset;; unknown property year=«1_996»`,
    { 'cuts[0].title': undefined, _unknown: { year: 1996 } },
  ],
  [
    'wu',
    { artist: 'Ghostface Killah', title: '', year: 1996, wth: 'extra', somethingToEffWith: false,  cuts: [{ title: 'marvel', year: 1996, feat: ['RZA'] }] },
    `title «''» is blank;; cuts[0].title «'marvel'» should match pattern;; unknown properties {year=«1_996» and wth=«'extra'»}`,
    { title: '', 'cuts[0].title': 'marvel', _unknown: { year: 1996, wth: 'extra' } },
  ],
  [
    "orly", { email: '@BOB', down: { we: { go: 808 } }, muddle: new Date("2022-05-04") },
    `email «'@BOB'» should be all lowercase; should be a conventional email format; should match pattern; and is too short: «4» vs «10»;; down.we.go «808» should be «33» or less;; down2 is unset;; muddle «2022-05-04T00:00:00.000Z» should either be text; be an array; be true/false; be a number; or be a jssym`,
    { email: '@BOB', 'down.we.go': 808, down2: undefined, muddle: new Date("2022-05-04") },
  ],
  ["arr_nonempty",    [],                                 `«[]» should not be empty`],
  ["arr_empty",       [1, 2],                             `«[ 1, 2 ]» should be empty`],
  ["arr_eq_1",        [1, 2],                             `«[ 1, 2 ]» has «2» items but should have exactly one`],
  ["arr_eq_3",        [1, 2],                             `«[ 1, 2 ]» has «2» items but should have exactly «3»`],
  ["arr_lte_1",       [1, 2],                             `«[ 1, 2 ]» has «2» but should have one or fewer`],
  ["arr_lte_3",       [1, 2, 3, 4, 5],                    `«[ 1, 2, 3, 4, 5 ]» has «5» but should have «3» or fewer`],
  ["arr_gte_1",       [],                                 `«[]» should not be empty`],
  ["arr_gte_3",       [1, 2],                             `«[ 1, 2 ]» has «2» items but should have «3» or more`],
  ["set_empty",       new Set([1, 2]),                    `«Set(2) { 1, 2 }» should be empty`],
  ["set_nonempty",    new Set([]),                        `«Set(0) {}» should not be empty`],
  ["set_lte_1",       new Set([1, 2]),                    `«Set(2) { 1, 2 }» has «2» but should have one or fewer`],
  ["set_lte_3",       new Set([1, 2, 3, 4]),              `«Set(4) { 1, 2, 3, 4 }» has «4» but should have «3» or fewer`],
  ["set_gte_1",       new Set([]),                        `«Set(0) {}» should not be empty`],
  ["set_gte_3",       new Set([1, 2]),                    `«Set(2) { 1, 2 }» has «2» items but should have «3» or more`],
  // // Zod does not provide the correct 'exact' flag for these
  ['set_eq_1',        new Set([1, 2]),                    `«Set(2) { 1, 2 }» has «2» but should have one or fewer`],
  ['set_eq_3',        new Set([1, 2]),                    `«Set(2) { 1, 2 }» has «2» items but should have «3» or more`],
  // Don't use dates please, only DateTime or Timecode or Timestamp
  ["date_lte",        new Date("2075-01-01"),             `«2075-01-01T00:00:00.000Z» should be on or before «2022-05-04T00:00:00.000Z»`],
  ["date_gte",        new Date("1975-01-01"),             `«1975-01-01T00:00:00.000Z» should be on or after «2022-05-04T00:00:00.000Z»`],
  // Don't use the zod datetime helper, it accepts many bogus dates
  ["str_date",        "-1000-01-01T08:08:08Z",            `«'-1000-01-01T08:08:08Z'» should be a datetime`],
  ["str_date",        "2023-00-00",                       `«'2023-00-00'» should be a datetime`],
  ["str_date",        "October 31, 2023",                `«'October 31, 2023'» should be a datetime`],
  // no Z
  ["isotime",         "2023-01-01",                       `«'2023-01-01'» should be a date-time in ISO YYYY-MM-DDThh:mm:ss.uuuZ form`],
  ["isotime",         "2023-01-01T08:08:08",              `«'2023-01-01T08:08:08'» should be a date-time in ISO YYYY-MM-DDThh:mm:ss.uuuZ form`],
  // bad dates,
  ["isotime",         "2023-00-01T08:08:08.000Z",         `«'2023-00-01T08:08:08.000Z'» should be a date-time in ISO YYYY-MM-DDThh:mm:ss.uuuZ form`],
  ["isotime",         "2023-00-00T08:08:08.000Z",         `«'2023-00-00T08:08:08.000Z'» should be a date-time in ISO YYYY-MM-DDThh:mm:ss.uuuZ form`],
  ["isotime",         "2023-02-30T08:08:08.000Z",         `«'2023-02-30T08:08:08.000Z'» should be a date-time in ISO YYYY-MM-DDThh:mm:ss.uuuZ form`],
  ["isotime",         "October 31, 2023",                 `«'October 31, 2023'» should be a date-time in ISO YYYY-MM-DDThh:mm:ss.uuuZ form`],
  //
  ["str_eq_1",        'C.R.E.A.M',                        `«'C.R.E.A.M'» should have exactly one character`],
  ["str_eq_4",        'C.R.E.A.M',                        `«'C.R.E.A.M'» has length «9» vs «4» needed`],
  ["str_lte",         'C.R.E.A.M',                        `«'C.R.E.A.M'» is too short: «9» vs «20»`],
  ["str_gte",         'C.R.E.A.M',                        `«'C.R.E.A.M'» is too long: «9» vs «4» available`],
  ["str_includes",    'wack',                             `«'wack'» should contain «'C.R.E.A.M'»`],
  ["str_startsWith",  'wack',                             `«'wack'» should start with «'C.R.E.A.M'»`],
  ["str_endsWith",    'wack',                             `«'wack'» should end with «'C.R.E.A.M'»`],
  ["num_lt",          39,                                 `«39» should be strictly less than «7»`],
  ["num_lte",         39,                                 `«39» should be «7» or less`],
  ["num_gt",          5,                                  `«5» should be strictly more than «7»`],
  ["num_gte",         5,                                  `«5» should be «7» or more`],
  ["num_multipleOf",  39,                                 `«39» should be an exact multiple of «7»`],
  ["num_int",         39.00001,                           `«39.000_01» is a decimal but should be an integer`],
  ["num_finite",      -Infinity,                          `«-Infinity» should be finite`],
  ["num_safe",        1e55,                               `«1e+55» should not be unusually large`],
  // ["okey",            undefined,                       `okey issues: «undefined» is missing`],
  // ["okey",            null,                            `okey issues: «null» is nil`],
  // ["okey",            '',                              `okey issues: «''» is blank`],
  // ["okey",            '_wack',                         `okey issues: «'_wack'» is not an org label`],
  // ["okeyOrAny",       '_wack',                         `okey issues: «'_wack'» is not an org label`],
  // ["nodeid",          '1e29',                          `nodeid issues: «'1e29'» is not a tookstock data ID`],

  ["place",           { name: '', lat: 91, lng:  -180 },  `Place issues: name «''» is blank;; lat «91» should be «90» or less;; lng «-180» should be strictly more than «-180»`, { lat: 91, lng: -180, name: "" }],
  ["quantity",        null,                               `«null» is nil`],
  ["quantity",        -1,                                 `«-1» should be «0» or more`],
  ["quantity",        0.5,                                `«0.5» is a decimal but should be an integer`],
  ["quantity",        1e30,                               `«1e+30» should be «10_000_000» or less`],
  ["quantity",        2e7,                                `«20_000_000» should be «10_000_000» or less`],
  ["ubux",            2e12,                               `«2_000_000_000_000» should be «1_000_000_000_000» or less`],
  ["ubux",            -2e12,                              `«-2_000_000_000_000» should be «-1_000_000_000_000» or more`],
  ["timestamp",       0,                                  `ms timestamp issues: «0» improbably ancient (pre-1972)`],
  ["timestamp",       -1,                                 `ms timestamp issues: «-1» improbably ancient (pre-1972)`],
  ["regex_no_msg",    'wack',                             `«'wack'» should match pattern`],
  ["regex_with_msg",  'wack',                             `«'wack'» should be def`],
  ["titleish",        'has \b a control character',       `title issues: «'has ~^b a control character'» has tabs, returns or weird characters`],
  ["timestamp",       '1e10',                             `ms timestamp issues: «'1e10'» is text but should be a number`],
  ["timecode",        'IIII',                             `timecode issues: «'IIII'» should be all lowercase; has length «4» vs «26» needed; and should be a lowercase timecode, starting with 00-04 (date < 2195)`],
  ["timecode",        'zzzzzzzzzzzzzzzzzzzzzzzzzz',       `timecode issues: «'zzzzzzzzzzzzzzzzzzzzzzzzzz'» should be a lowercase timecode, starting with 00-04 (date < 2195)`],
  ["timecode",        '04zzzzzzzzzzzzzzzzzzzzzzzz1', /**/ `timecode issues: «'04zzzzzzzzzzzzzzzzzzzzzzzz1'» has length «27» vs «26» needed and should be a lowercase timecode, starting with 00-04 (date < 2195)`],
  ["upper",           'hASLOWERS',                        `all uppercase issues: «'hASLOWERS'» should be all uppercase`],
  ["upper",           'HAS\vCTRL',                        `all uppercase issues: «'HAS~^x0BCTRL'» should be all uppercase`],
  ["lower",           'Hasuppers',                        `plain lowercase issues: «'Hasuppers'» should be all lowercase`],
  ["lower",           'has\vctrl',                        `plain lowercase issues: «'has~^x0Bctrl'» should be all lowercase`],
  //
  ["camel",           null,                               `«null» is nil`],
  ["camel",           undefined,                          `«undefined» is missing`],
  ["camel",           '',                                 `«''» is blank`],
  ["camel",           ' camel',                           `«' camel'» should be an UpperFirstLetterCamelCased name`],
  ["camel",           ',',                                `«','» should be an UpperFirstLetterCamelCased name`],
  ["camel",           'a',                                `«'a'» should be an UpperFirstLetterCamelCased name`],
  ["camel",           '1',                                `«'1'» should be an UpperFirstLetterCamelCased name`],
  ["camel",           '_',                                `«'_'» should be an UpperFirstLetterCamelCased name`],
  ["camel",           'A_1',                              `«'A_1'» should be an UpperFirstLetterCamelCased name`],
  //
  ["locamel",         null,                               `«null» is nil`],
  ["locamel",         undefined,                          `«undefined» is missing`],
  ["locamel",         '',                                 `«''» is blank`],
  ["locamel",         'Locamel',                         `«'Locamel'» should be a lowerFirstLetterCamelCased name`],
  ["locamel",         ',',                                `«','» should be a lowerFirstLetterCamelCased name`],
  ["locamel",         'A',                                `«'A'» should be a lowerFirstLetterCamelCased name`],
  ["locamel",         '1',                                `«'1'» should be a lowerFirstLetterCamelCased name`],
  ["locamel",         '_',                                `«'_'» should be a lowerFirstLetterCamelCased name`],
  ["locamel",         'a_1',                              `«'a_1'» should be a lowerFirstLetterCamelCased name`],
  //
  ["varname",         null,                               `«null» is nil`],
  ["varname",         undefined,                          `«undefined» is missing`],
  ["varname",         '',                                 `«''» is blank`],
  ["varname",         ' 1Camel',                          `«' 1Camel'» should be a label and start with a letter`],
  ["varname",         ' _Camel',                          `«' _Camel'» should be a label and start with a letter`],
  ["varname",         ',',                                `«','» should be a label and start with a letter`],
  ["varname",         '1',                                `«'1'» should be a label and start with a letter`],
  ["varname",         '_',                                `«'_'» should be a label and start with a letter`],

  ["handleish",       'noUppers',                         `record handle issues: «'noUppers'» should be all lowercase and should have only lowercase plain letters/_/numbers with a letter first`],
  ["label",           'very-strict',                      `simple label issues: «'very-strict'» should have only plain lowercase letters/_/numbers with a letter first`],

  ["byte",            -1,                                 `byte issues: «-1» should be «0» or more`],
  ["byte",            8,                                  `byte issues: «8» should be «7» or less`],
  ["byte",            1.1,                                `byte issues: «1.1» is a decimal but should be an integer`],

  ["textish",        '\nasdf\u0001\n\n',                  `«'~^nasdf~^x01~^n~^n'» has weird characters`],
  ["blobbish",        '\nas\u0000df\n\n',                 `«'~^nas~^x00df~^n~^n'» has weird characters`],
  ["unionit",         { oops: true  },                    `«{ oops: true }» should either be text; be an array; be true/false; be a number; or be a jssym`],
  ["foolish_union",   { oops: true  },                    `«{ oops: true }» should either be text or an array or true/false or be a number or be a jssym`],
  ["anyfspath",       { path: true },                     `«{ path: true }» should either be text; be an array; path text or be an array; or outdir not be unset`],
  ["muym",            808.1,                              `«808.1» should be an exact multiple of «9»; is a decimal but should be an integer; and should be «33» or less`],
  // ["vnum", 1.1, `«1.1» is a decimal but should be an integer`], ['vver', 1, `«1» is a number but should be text`],
], ([checkname, input, msg, wantedBadprops]) => {
  // need to use _.mapValues+_.get, not pick, to get the flattened bag { foo.bar: val } not { foo: { bar: val } }
  // const wantedBadprops = propnames ? _.mapValues(input, (propname) => _.get(input, propname)) : input
  return { checkname, input, msg, wantedBadprops, propnames: _.keys(wantedBadprops) }
}) as { checkname: string, input: any, msg: string, wantedBadprops: any, propnames: string[] }[]

// const _Valids = [
//   ["upper",           '',                                 ``],
//   ["upper",           '12345',                            ``],
//   ["upper",           ',',                                ``],
//   ["lower",           'asdf',                             ``],
//   ["lower",           '',                                 ``],
//   ["lower",           '12345',                            ``],
//   ["lower",           ',',                                ``],
//   ["camel",           'Booya',                            ``],
//   ["camel",           'A1',                               ``],
//   ["camel",           ',',                                ``],
//   ["camel",           'a',                                ``],
//   ["camel",           '1',                                ``],
//   ["camel",           '_',                                ``],
//   ["camel",           'Booya',                            ``],
//   ["camel",           'A1',                               ``],
//   ["varname",         'A_1',                              `«'_'» should start with a letter and be [A-Za-z0-9_]`],
//   ["varname",         'a',                                ``],
//   ["blobbish",        '\nasdf\n\n',  ``],
//   ["muym",              5,       ``],
//   ["muym",              1,       ``],
//   ["str_date",        "2023-00-00T08:08:08Z",             `«'2023-00-00T08:08:08Z'» should be a datetime`],
//   ["str_date",        "2023-01-01T08:08:08Z",             `«'2023-01-01'» should be a datetime`],
//   ["str_date",        "2023-02-30T08:08:08Z",             `«'2023-02-30'» should be a datetime`],
//   ["str_date",        "2023-02-30T08:08:08.000Z",         `«'2023-02-30'» should be a datetime`],
//   ["vnum", 1, ``], ['vver', '001', ``],
// ]

const invalidChecksInUse = _.uniq(_.map(InvalidScenarios, 'checkname'))
const missing = _.difference(_.keys(TestChecks), invalidChecksInUse)
if (! _.isEmpty(missing)) { console.warn(`no tests set up for ${UF.prettify(missing)}`) }

function runFailingChecker(checkname: string, input: any, msg: string): TY.BadParseReport<any, any> {
  const checker = AllChecks[checkname as keyof typeof AllChecks]
  if (! checker?.report) { throw UF.throwable(`missing checker ${checkname} -- this is most likely an error in the test file, not in the code (or you did not re-export the checker in Typechecks.ts)`, 'missing', { checkname, input, msg }) }
  const report = checker.report(input) as TY.BadParseReport<any, any>
  if (report.success) {
    console.error(report)
    throw new Error(`Checking ${checkname} against ${UF.prettify(input)} should have failed with ${msg} but succeeded to fail to fail successfully`)
  }
  // if (err.message !== msg) {
  //   console.warn(checkname, '\n', err.message)
  //   console.warn({ checkname, wanted: msg, actual: err.message }, TH.prettify(err), TH.prettify(err.pathed), 'input', TH.stringify(input).slice(10000))
  // }
  return report as TY.BadParseReport<any, any>
}

describe('Zod error formatting', () => {

  describe('Structured', () => {
    describe.each(InvalidScenarios)('$checkname on $input', (({ checkname, input, msg, propnames, wantedBadprops }: { checkname: string, input: any, msg: string, propnames: string[], wantedBadprops: any }) => {
      it(`extracts bad props ${propnames}`, () => {
        const err = runFailingChecker(checkname, input, msg)
        const wanted = wantedBadprops ?? { it: input }
        if (! _.isEqual(err?.badprops, wanted)) { console.warn('mismatch; expected: ', wanted, ' but got: \n', UF.prettify(err?.badprops)) }
        expect(err).property('badprops').to.eql(wanted)
      })
      it(`gives error ++${msg}++`, () => {
        const err = runFailingChecker(checkname, input, msg)
        expect(err).property('message').to.eql(msg)
      })
    }) as any)
    it('snapshot of invalid examples', () => {
      const result = _.map(InvalidScenarios, ({ checkname, input, msg }) => (
        runFailingChecker(checkname, input, msg)
      ))
      expect(TH.checkSnapshot(result)).to.be.true
    })
    it.each(SHOULD_BE_TRIMMED)('%s casts to a trimmed string', (checkname, safeVal, _msgtail) => {
      const checker = AllChecks[checkname]!
      _.each(Untrimmed, (char, _charcode) => {
        expect(checker.cast(       `${safeVal}${char}`)).to.eql(safeVal)
        expect(checker.cast(`${char}${safeVal}`          )).to.eql(safeVal)
        expect(checker.cast(`${char}${safeVal}${char}`)).to.eql(safeVal)
      })
    })
    it.each(SHOULD_BE_TRIMMED)('%s should have no control characters at start', (checkname, safeVal, msgtail) => {
      const checker = AllChecks[checkname]!
      _.each(Disallowed, (char, _charcode) => {
        expect(() => checker.cast(`${char}${safeVal}`)).to.throw(msgtail)
      })
    })

    it('blobbish lets you get a little crazy but not too too', () => {
      const result = runFailingChecker("blobbish", _.repeat(`all work and no play makes homer something something `, 20_000), '')
      expect(result.success).to.be.false
    })
    it('blobbish directly', () => {
      const crzy = _.repeat(`all work and no play makes homer something something `, 20_000)
      const result = CK.blobbish.report(crzy)
      expect(result).property('success').to.be.false
      expect(result).property('message').to.have.length(226)
      expect(result).property('message').to.match(/«'all work and no play makes[\w ]+…» is too long: «1_060_000» vs «800_800» available/)
    })

    it('Date checker', () => {
      const Validate = Validator(() => {
        const dategte = Z.date().min(new Date('1972-01-01T12:34:56Z'))
        return {
          jsdater: dategte,
        }
      })
      const report = Validate.jsdater.report(new Date('1972-01-01T01:00:00Z'))
      expect(report).property('message').to.eql(`jsdater issues: «1972-01-01T01:00:00.000Z» should be on or after «1972-01-01T12:34:56.000Z»`)
    })
  })
})
