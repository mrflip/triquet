// Regexes, rules and bounds, with the sentence each one wants to say when it fails.
//
// This file imports nothing, on purpose: a module that needs one pattern should pay for one
// pattern and not for a schema library. The checks are built on top, in ./checks/*.
//
// Every regex here is one RE2 reads as JavaScript does: no lookaround, no backreference, and no
// `\s`, which RE2 takes for ASCII spaces alone. What a regex could only say by looking around --
// that a label is none of a list of words -- is a rule instead.

/** A pattern, its bounds, and the advice it gives -- the shape every check below is built from */
export type Patternbag = {
  /** What the value must match */
  re?:   RegExp
  /** Advice, phrased to follow the offending value: "should have only ..." */
  msg?:  string
  /** Fewest characters */
  min?:  number
  /** Most characters */
  max?:  number
}

/** A check that is a rule rather than a pattern, and the advice it gives: what keeps a value from being any of a list of words */
export type Rulebag = {
  /** Whether the value passes */
  rule: (str: string) => boolean
  /** Advice, phrased to follow the offending value: "should not be ..." */
  msg:  string
}

//
// == [Character sets] ==
//

/** Printable ASCII and nothing else */
export const AsciishRe   = /^[\u{20}-\u{7E}]*$/u
/** Any character except a control character, though tab and the newlines are allowed */
export const TextishRe   = /^[\P{Cc}\t\r\n]*$/u
/** Any character except a control character */
export const StringishRe = /^\P{Cc}*$/u

/**
 * Neither begins nor ends with a space or a control character. A space is any JavaScript's `\s`
 * matches: `\p{White_Space}` and the byte-order mark.
 */
export const TrimmedRe   = /^([^\p{White_Space}\u{FEFF}\p{Cc}].*[^\p{White_Space}\u{FEFF}\p{Cc}]|[^\p{White_Space}\u{FEFF}\p{Cc}]|)$/su

export const Asciish   = { re: AsciishRe,   msg: 'should have only unaccented keyboard characters' } as const satisfies Patternbag
/** Paragraphs of prose: newlines and tabs welcome, control characters not, and past 3600 characters it is not a field any more */
export const Textish   = { re: TextishRe,   msg: 'has weird characters', max: 3600 } as const satisfies Patternbag
export const Stringish = { re: StringishRe, msg: 'has tabs, returns or weird characters' } as const satisfies Patternbag
export const Trimmed   = { re: TrimmedRe,   msg: 'should not begin or end with any space separators' } as const satisfies Patternbag

export const Upper     = { re: /^[^\p{Ll}]*$/u, msg: 'should be all uppercase' } as const satisfies Patternbag
export const Lower     = { re: /^[^\p{Lu}]*$/u, msg: 'should be all lowercase' } as const satisfies Patternbag

//
// == [Identifier shapes] ==
//

export const Alnum        = { re: /^[A-Za-z0-9]*$/, msg: 'should have only plain letters/numbers' } as const satisfies Patternbag
export const Alnumbar     = { re: /^\w*$/,          msg: 'should have only plain letters/_/numbers' } as const satisfies Patternbag
export const Azalnum      = { re: /^[a-zA-Z][a-zA-Z0-9]*$/,  msg: 'should have only plain letters/numbers with a letter first' } as const satisfies Patternbag
export const Azalnumbar   = { re: /^[a-zA-Z]\w*$/, msg: 'should have only plain letters/_/numbers with a letter first' } as const satisfies Patternbag
export const Upazalnum    = { re: /^[A-Z][A-Z0-9]*$/,        msg: 'should have only uppercase plain letters/numbers with a letter first' } as const satisfies Patternbag
export const Loazalnumbar = { re: /^[a-z][a-z0-9_]*$/,       msg: 'should have only lowercase plain letters/_/numbers with a letter first' } as const satisfies Patternbag
export const Upazalnumbar = { re: /^[A-Z][A-Z0-9_]*$/,       msg: 'should have only uppercase plain letters/_/numbers with a letter first' } as const satisfies Patternbag
export const Upalnumbar   = { re: /^[A-Z0-9_]*$/,            msg: 'should have only uppercase plain letters/_/numbers' } as const satisfies Patternbag
export const Loalnumbar   = { re: /^[a-z0-9_]*$/,            msg: 'should have only lowercase plain letters/_/numbers' } as const satisfies Patternbag
export const Plain        = { re: /^[A-Za-z0-9 ]*$/, msg: 'should have only plain letters, numbers, and the occasional space' } as const satisfies Patternbag

export const Label      = { re: /^[a-z](_?[a-z0-9])+$/, min: 2, max: 40, msg: 'should have only plain lowercase letters/_/numbers, with a letter first, a letter or number last, and no __ in a row' } as const satisfies Patternbag
/** A username -- an ident's label: label-shaped, and long enough to be a name someone chose rather than an initial */
export const Userlabel  = { re: /^[a-z](_?[a-z0-9])+$/, min: 6, max: 24, msg: 'should be 6 to 24 plain lowercase letters/_/numbers, with a letter first, a letter or number last, and no __ in a row' } as const satisfies Patternbag
/** A username as far as it has been typed: empty, or what typing on could still make a `Userlabel` -- every character one it keeps, with at most a trailing underscore or too few characters between it and done */
export const Userbegun  = { re: /^(?:[a-z](?:_?[a-z0-9])*_?)?$/, max: Userlabel.max, msg: 'should be plain lowercase letters/_/numbers, with a letter first and no __ in a row' } as const satisfies Patternbag
export const Dashlabel  = { re: /^[a-z][a-z0-9_-]*$/,   min: 1, max: 25, msg: 'should have only plain lowercase letters/_/-/numbers with a letter first' } as const satisfies Patternbag
export const Handleish  = { re: /^[a-z][a-z0-9_]*$/,    min: 1, max: 36, msg: 'should have only lowercase plain letters/_/numbers with a letter first' } as const satisfies Patternbag
export const Keyish     = { re: /^[\w\-.:/+]*$/,        min: 1, max: 90, msg: 'should be letters, numbers, .-_/:' } as const satisfies Patternbag
export const Camel      = { re: /^[A-Z][A-Za-z0-9]*$/,  msg: 'should be an UpperFirstLetterCamelCased name' } as const satisfies Patternbag
export const Locamel    = { re: /^[a-z][A-Za-z0-9]*$/,  msg: 'should be a lowerFirstLetterCamelCased name' } as const satisfies Patternbag
export const Varname    = { re: /^[A-Za-z]\w*$/,        msg: 'should be a label and start with a letter' } as const satisfies Patternbag
export const Snake      = { re: /^[a-z][a-z0-9_]*$/,    msg: 'should be a lower_underbar_cased name' } as const satisfies Patternbag
/** A name JavaScript takes bare after a dot: what a key may be to be written `.key`, not `['key']` */
export const Jsident    = { re: /^[A-Za-z_$][\w$]*$/,  msg: 'should be a JavaScript identifier' } as const satisfies Patternbag

/**
 * A label that is none of `words`: what keeps a name from shadowing one already in use beside it.
 * The advice is said of the word refused, which a report puts in front of it (`«rank» is a name
 * ...`), so it reads the same however long the list.
 *
 * @param words - The labels refused.
 * @param msg - The advice, said of the word refused.
 * @returns The rule, and the advice it gives.
 *
 * @example reservedOf(['rank', 'title']).rule('rank')  // => false
 * @example reservedOf(['rank']).msg                      // => 'is a name already in use beside it'
 */
export function reservedOf(words: readonly string[], msg = 'is a name already in use beside it'): Rulebag {
  const reserved = new Set(words)
  return { rule: (label) => ! reserved.has(label), msg }
}

/** The tool's own nouns, one and many: its tables, and the things its rows and bags are made of */
const ModelNouns = [
  ['hunt', 'hunts'], ['realm', 'realms'], ['quiz', 'quizzes'], ['question', 'questions'],
  ['column', 'columns'], ['widget', 'widgets'], ['widgeting', 'widgetings'], ['widgeted', 'widgeteds'],
  ['ident', 'idents'], ['identing', 'identings'], ['hunting', 'huntings'], ['review', 'reviews'],
  ['reviewing', 'reviewings'], ['persona', 'personas'], ['estimate', 'estimates'], ['ish', 'ishes'],
  ['layout', 'layouts'], ['library', 'libraries'], ['user', 'users'],
] as const

/**
 * The words no label may be, wherever it is used, grouped by why. Each is a word a label could
 * one day be mistaken for, beside the fields of a row, in a formula's bag, in an export's columns
 * or in a path, and so trouble that is cheap to refuse now and dear to unpick later: easier to
 * take a word off later than to add one. A word in two groups is harmless. What only one
 * namespace must avoid is that namespace's own list (`ReservedWidgetingLabels`).
 */
export const ReservedLabelGroups = {
  /** What rows carry beside their label, to say what and where they are and when they were made */
  fields:      [
    'id', 'ids', 'key', 'label', 'labels', 'position', 'kind', 'type',
    'created_at', 'createdat', 'updated_at', 'updatedat', 'deleted_at', 'deletedat', 'creation_time', 'creationtime',
  ],
  /** The tool's own nouns, and what a formula's bag calls a question and its quiz's questions */
  models:      [...ModelNouns.flat(), 'qn', 'qns', 'bag'],
  /** A noun and `id` run together: what a pointer to a row would be called with its underbar dropped */
  pointers:    ModelNouns.flatMap(([one]) => [`${one}id`, `${one}ids`]),
  /** Names every plain object answers to, so a lookup by label finds something the bag never held */
  prototypes:  ['constructor', 'prototype'],
  /** What JSON, JSONata and a spreadsheet read as no value, or as yes or no, rather than as a word: a formula cannot name `qn.null` */
  literals:    ['null', 'nil', 'none', 'undefined', 'nan', 'inf', 'infinity', 'true', 'false'],
  /** Names Windows will not give a file, whatever its extension: a hunt, realm or quiz is a folder or file in the git repository it exports to */
  devices:     ['con', 'prn', 'aux', 'nul', ...Array.from({ length: 10 }, (_unused, digit) => [`com${String(digit)}`, `lpt${String(digit)}`]).flat()],
  /** What an address might one day say beside a label, as `/h/new` */
  routes:      ['new', 'edit', 'api', 'admin'],
  /** What a value is, rather than what it is of: the names of types, and of the entry families that take them */
  types:       ['string', 'number', 'integer', 'float', 'boolean', 'object', 'array', 'list', 'json', 'date', 'time', 'datetime', 'enum', 'text'],
  /** The languages and engines a quiz's text may one day be worked by, and the words for what they work */
  engines:     [
    'liquid', 'mustache', 'template', 'templates', 'templated', 'js', 'ts', 'javascript', 'typescript', 'wasm', 'rust',
    'python', 'py', 'apicall', 'worker', 'workers', 'script', 'scripts', 'code', 'eval', 'exec', 'html', 'css', 'sql',
    'yaml', 'xml', 'markdown', 'md', 'bbcode', 'bbjank', 'prompt', 'prompts', 'formula', 'formulas', 'formulary',
    'formularies', 'regex',
  ],
  /** What a sheet or a formula calls a reduction: a widgeting wanting one says of what, as `clueing_sum` */
  aggregates:  ['average', 'avg', 'mean', 'median', 'stdev', 'sum', 'total', 'count', 'min', 'max'],
  /** JSONata's own words, which a path cannot say: `qn.and` will not parse, so nothing so labelled could be read */
  jsonata:     ['and', 'or', 'in', 'function'],
  /** How a value stands, and what a cell is called by it */
  status:      ['result', 'results', 'error', 'errors', 'ok', 'stale', 'missing', 'current', 'blank', 'default', 'defaults'],
  /** What a sheet or the grid itself calls its parts */
  grid:        ['row', 'rows', 'col', 'cols', 'cell', 'cells', 'header', 'headers', 'index', 'idx', 'sort', 'order'],
  /** What a lookup mistakes for the thing itself, or for its holder */
  self:        ['self', 'this', 'me', 'it', 'name', 'names', 'data', 'item', 'items', 'object', 'root', 'parent'],
} as const

/** Every reserved word, each group's in turn, each once */
export const ReservedLabels: readonly string[] = [...new Set<string>(Object.values(ReservedLabelGroups).flat())]

const ReservedLabelSet: ReadonlySet<string> = new Set(ReservedLabels)

/**
 * A label that is no reserved word, and does not end in `_id` or `_ids`, which is how a pointer
 * to a row is named. Says nothing of the label's shape, which is `Label`'s business.
 */
export const Unreserved = {
  rule: (label: string) => ! ReservedLabelSet.has(label) && ! label.endsWith('_id') && ! label.endsWith('_ids'),
  msg:  'is a word the tool keeps for its own use, or ends in _id as a pointer does: add to it, as my_label or label_2',
} as const satisfies Rulebag

/**
 * Whether `val` is none of the words the tool keeps for its own use (`Unreserved`), or is one that
 * `allowed` lets through all the same: the one reserved-word check, which a namespace whose own
 * names are reserved elsewhere (an entry's params, `min` and `max`) hands its names to.
 *
 * @param val - A label-shaped word.
 * @param allowed - Words let through whatever the reserved lists say.
 * @returns True when the word may be used.
 *
 * @example isUnreserved('min')                    // => false
 * @example isUnreserved('min', new Set(['min']))  // => true
 */
export function isUnreserved(val: string, allowed?: ReadonlySet<string>): boolean {
  return allowed?.has(val) === true || Unreserved.rule(val)
}

/**
 * The words no hunt and no ident may be labelled, beyond those no label may be. A hunt's label and
 * an ident's are each global, the first word of an address or the name a person goes by, so these
 * are kept for the app's own pages and for whoever speaks for it.
 */
export const ReservedToplevelGroups = {
  /** The app's own corners, and the words for signing in and keeping an account */
  app:     [
    'lib', 'sys', 'pub', 'my', 'home', 'www', 'static', 'assets', 'public', 'search', 'status',
    'stats', 'dashboard', 'settings', 'account', 'accounts', 'acct', 'auth', 'oauth', 'logout',
    'signin', 'signout', 'signup', 'register', 'mail', 'email',
  ],
  /** What a site's marketing and help pages are called */
  pages:   [
    'about', 'career', 'careers', 'job', 'jobs', 'team', 'teams', 'faq', 'docs', 'blog', 'news',
    'press', 'pricing', 'plans', 'features', 'contact', 'privacy', 'terms', 'tos', 'legal',
    'cookies', 'enterprise', 'partners', 'store', 'shop', 'billing', 'download', 'downloads', 'brand',
  ],
  /** Names that would pass for the app itself speaking */
  voices:  [
    'staff', 'system', 'moderator', 'mod', 'everyone', 'anonymous',
    'guest', 'nobody', 'webmaster', 'postmaster', 'hostmaster', 'abuse', 'noreply', 'no_reply',
  ],
} as const

/** Every top-level reserved word, each group's in turn */
export const ReservedToplevel: readonly string[] = Object.values(ReservedToplevelGroups).flat()

/**
 * How no hunt's or ident's label may begin: what would pass for the app's own desk or its say-so
 * with anything after it (`help_desk`, `triquet_team`, `verified_ben`). A prefix is here when
 * the trick it plays is a bad one and few real names begin with it; one too common to refuse
 * (`staff`, as Stafford; `mod`, as modern) is reserved only as the whole word.
 */
export const ReservedToplevelPrefixes: readonly string[] = ['secur', 'login', 'triquet', 'help', 'admin', 'support', 'official', 'verif']

/** Whole labels of these forms are kept too, each a regex of the whole label: `pub` and two characters more, for scopes of the library beside `pub` */
export const ReservedToplevelForms: readonly string[] = ['pub..']

const ReservedToplevelSet: ReadonlySet<string> = new Set(ReservedToplevel)
const ReservedToplevelFormRe = new RegExp(`^(?:${ReservedToplevelForms.join('|')})$`)

/**
 * A hunt's or an ident's label that is no top-level reserved word or form, and begins with no
 * reserved prefix. Says nothing of the words every label is kept from, which is `Unreserved`'s
 * business.
 */
export const UnreservedToplevel = {
  rule: (label: string) => ! ReservedToplevelSet.has(label)
    && ! ReservedToplevelFormRe.test(label)
    && ReservedToplevelPrefixes.every((prefix) => ! label.startsWith(prefix)),
  msg:  'is kept for the app\'s own pages and people: add to it, as my_label or label_2',
} as const satisfies Rulebag

/** A web address: `http://` or `https://`, then no space, up to what a browser's address bar holds comfortably */
export const Weburl     = { re: /^https?:\/\/[^\p{White_Space}/?#]\P{White_Space}*$/iu, max: 2000, msg: 'should be a web address, beginning http:// or https://' } as const satisfies Patternbag

/** A Convex document id: lowercase letters and digits, about 32 of them */
export const Convexid   = { re: /^[0-9a-z]{31,37}$/, min: 31, max: 37, msg: 'should be a document id, 31 to 37 lowercase letters/numbers' } as const satisfies Patternbag

//
// == [String lengths] ==
//

export const Shortstr = { max: 15 } as const satisfies Patternbag
export const Medstr   = { max: 40 } as const satisfies Patternbag      // a smushed uuid, or most of a person's name
export const Fullstr  = { max: 82 } as const satisfies Patternbag      // fits a phone; two medstrs with delimiters
export const Bigstr   = { max: 200 } as const satisfies Patternbag     // about the longest product title anyone writes
/** The same bounds as `Textish`; a note differs only in being trimmed, which is the check's business */
export const Noteish  = { ...Textish } as const satisfies Patternbag
/** A note that runs to pages: a quiz's own long texts (its smith's note, its recap's head, tail and template), the same characters as `Noteish`, to 20,000 */
export const Longnote = { ...Noteish, max: 20_000 } as const satisfies Patternbag
export const Blobbish = { ...Textish, max: 800_800 } as const satisfies Patternbag
/** A formula is prose a person types and reads back, so it takes what `Textish` takes and stops at a screenful */
export const Formulaish = { ...Textish, max: 999 } as const satisfies Patternbag
/** A prompt as it is put to a model: a template's screenful, filled in from a question's texts, and no more */
export const Promptish = { ...Textish, max: 16_000 } as const satisfies Patternbag
export const Titleish = { max: 82, ...Stringish } as const satisfies Patternbag

//
// == [JSON sizes] == how long a stored JSON value may run, counted as its JSON text
//

/** A widgeted's value, and the free bag of how it ran: room for a long list of spans, short of a document */
export const WidgetedJson = { max: 40_000, msg: 'is too large to keep' } as const satisfies Patternbag
/** A key of a model's reply object, as the database will keep one: printable ASCII, not opening with `$` */
export const Replykey     = { re: /^(?:[\u{20}-\u{23}\u{25}-\u{7E}][\u{20}-\u{7E}]*)?$/u, max: 200, msg: 'is not a key the tool can keep' } as const satisfies Patternbag
/**
 * How deep a model's reply object may nest, how many items one list of it may hold, and how many
 * keys one object of it may hold. Kept as a widgeted's value, the reply sits one level down in a
 * row the database nests at most 16 levels deep, with at most 1024 keys to an object.
 */
export const ReplyShape   = { depth: 15, items: 2000, keys: 1024 } as const
/** What a widgeting hands its widget: a few settings */
export const ParamsJson   = { max: 4000, msg: 'is too large to keep' } as const satisfies Patternbag

//
// == [Numeric bounds] ==
//

export const Uint32   = { min: 0, max: (2 ** 32) - 1 } as const
export const Sint32   = { min: -(2 ** 31), max: (2 ** 31) - 1 } as const
export const Uint64   = { min: 0, max: Number((2n ** 64n) - 1n) } as const
export const Sint64   = { min: Number(-(2n ** 63n)), max: Number((2n ** 63n) - 1n) } as const
export const Safeint  = { min: Number.MIN_SAFE_INTEGER, max: Number.MAX_SAFE_INTEGER } as const
export const Quantity = { min: 0, max: 1e7 } as const
export const Byte     = { min: 0, max: 255 } as const
export const Lat      = { min: -90, max: 90 } as const
export const Lng      = { min: -180, max: 180 } as const
export const Portnum  = { min: 0, max: 65_535 } as const
/** An HTTP response's status code */
export const Httpstatus = { min: 100, max: 599 } as const
/** Minutes a person says they spent on one thing: past this it is a typo, not a long think */
export const Minutes  = { min: 0, max: 999 } as const
/** A money amount in the smallest unit, capped where a mistake stops looking like a typo */
export const Ubux     = { min: -1e12, max: 1e12 } as const

//
// == [Numberlike strings] == a number written as plain text: digits, an optional sign, an
// optional decimal point. No exponent, no grouping, no spaces. Lengths leave room for a safe
// integer's 16 digits, and 16 more past the point; how large the number may be is the check's
// business, against the numeric bounds above.
//

export const Intstr  = { re: /^[+-]?\d+$/,          max: 17, msg: 'should be a whole number, written as plain digits' } as const satisfies Patternbag
export const Uintstr = { re: /^\d+$/,               max: 16, msg: 'should be a whole number, zero or more, written as plain digits' } as const satisfies Patternbag
export const Numstr  = { re: /^[+-]?\d+(\.\d+)?$/,  max: 34, msg: 'should be a number, written as plain digits with an optional decimal point' } as const satisfies Patternbag
export const Unumstr = { re: /^\d+(\.\d+)?$/,       max: 33, msg: 'should be a number, zero or more, written as plain digits with an optional decimal point' } as const satisfies Patternbag

//
// == [Collection sizes] ==
//
// The most one parent holds of a kind of child: what a read of them takes, and past which adding
// one more is refused.

/** Questions in one quiz */
export const QuestionsPerQuiz   = { min: 0, max: 999 } as const
/** Widgetings in one quiz: the widgets it puts to work */
export const WidgetingsPerQuiz  = { min: 0, max: 99 } as const
/** Widgets in the library */
export const WidgetsInLibrary   = { min: 0, max: 999 } as const
/** Widgetings of one widget a usage count reads, across every hunt; past this many it counts at least that */
export const WidgetingsCounted  = { min: 0, max: 999 } as const
/** Columns in one quiz */
export const ColumnsPerQuiz     = { min: 0, max: 99 } as const
/** Reviews of one quiz, one per ident that opened one */
export const ReviewsPerQuiz     = { min: 0, max: 999 } as const
/** Questions one review picks as its top 3, and likewise as its meh 3 */
export const PicksPerReview     = { min: 0, max: 3 } as const
/** Quizzes in one realm; a realm is never without one */
export const QuizzesPerRealm    = { min: 1, max: 999 } as const
/** Realms in one hunt; every hunt has at least its home realm */
export const RealmsPerHunt      = { min: 1, max: 99 } as const
/** Idents on one hunt, one hunting each */
export const HuntingsPerHunt    = { min: 0, max: 999 } as const
/** Hunts in the whole app: roomy enough for a whole e2e run's, each spec making its own */
export const HuntsInApp         = { min: 0, max: 999 } as const
/** Hunts one org may make, a tenth of the app's: roomy for a person, but no one username fills the app */
export const HuntsPerOrg        = { min: 0, max: 99 } as const

//
// == [Contact shapes] ==
//

export const Postcode = { re: /^[A-Za-z0-9][A-Za-z0-9 -]{1,10}$/, msg: 'should be a postal code' } as const satisfies Patternbag
/** Deliberately stricter than the RFC: one delimiter per segment, at most two plus-parts, no bare IPs */
export const Email    = {
  re: /^[a-z0-9_]+(?:[-.+][a-z0-9_]+){0,3}@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/,
  max: 82,
  msg: 'should be a conventional email format',
} as const satisfies Patternbag
export const Phone    = { max: 40, msg: 'should be a phone number' } as const satisfies Patternbag
export const Namestr  = { max: 82, ...Stringish } as const satisfies Patternbag
export const Namepart = { max: 40, ...Stringish } as const satisfies Patternbag
