// Regexes and bounds, with the sentence each one wants to say when it fails.
//
// This file imports nothing, on purpose: a module that needs one pattern should pay for one
// pattern and not for a schema library. The checks are built on top, in ./checks/*.

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

//
// == [Character sets] ==
//

/** Printable ASCII and nothing else */
export const AsciishRe   = /^[\u{20}-\u{7E}]*$/u
/** Any character except a control character, though tab and the newlines are allowed */
export const TextishRe   = /^[\P{Cc}\t\r\n]*$/u
/** Any character except a control character */
export const StringishRe = /^\P{Cc}*$/u

/** Neither begins nor ends with a space or a control character */
export const TrimmedRe   = /^([^\s\p{Cc}].*[^\s\p{Cc}]|[^\s\p{Cc}]|)$/su

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
export const Dashlabel  = { re: /^[a-z][a-z0-9_-]*$/,   min: 1, max: 25, msg: 'should have only plain lowercase letters/_/-/numbers with a letter first' } as const satisfies Patternbag
export const Handleish  = { re: /^[a-z][a-z0-9_]*$/,    min: 1, max: 36, msg: 'should have only lowercase plain letters/_/numbers with a letter first' } as const satisfies Patternbag
export const Keyish     = { re: /^[\w\-.:/+]*$/,        min: 1, max: 90, msg: 'should be letters, numbers, .-_/:' } as const satisfies Patternbag
export const Camel      = { re: /^[A-Z][A-Za-z0-9]*$/,  msg: 'should be an UpperFirstLetterCamelCased name' } as const satisfies Patternbag
export const Locamel    = { re: /^[a-z][A-Za-z0-9]*$/,  msg: 'should be a lowerFirstLetterCamelCased name' } as const satisfies Patternbag
export const Varname    = { re: /^[A-Za-z]\w*$/,        msg: 'should be a label and start with a letter' } as const satisfies Patternbag
export const Snake      = { re: /^[a-z][a-z0-9_]*$/,    msg: 'should be a lower_snake_cased name' } as const satisfies Patternbag

/** Lowercase Crockford base32, 26 characters, sortable by time */
export const Ulid       = { re: /^[0-7][a-hjkmnp-tv-z0-9]{25}$/, min: 26, max: 26, msg: 'should be a 26-character lowercase ulid' } as const satisfies Patternbag

//
// == [String lengths] ==
//

export const Shortstr = { max: 15 } as const satisfies Patternbag
export const Medstr   = { max: 40 } as const satisfies Patternbag      // a smushed uuid, or most of a person's name
export const Fullstr  = { max: 82 } as const satisfies Patternbag      // fits a phone; two medstrs with delimiters
export const Bigstr   = { max: 200 } as const satisfies Patternbag     // about the longest product title anyone writes
/** The same bounds as `Textish`; a note differs only in being trimmed, which is the check's business */
export const Noteish  = { ...Textish } as const satisfies Patternbag
export const Blobbish = { ...Textish, max: 800_800 } as const satisfies Patternbag
/** A formula is prose a person types and reads back, so it takes what `Textish` takes and stops at a screenful */
export const Formulaish = { ...Textish, max: 999 } as const satisfies Patternbag
export const Titleish = { max: 82, ...Stringish } as const satisfies Patternbag

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
/** A money amount in the smallest unit, capped where a mistake stops looking like a typo */
export const Ubux     = { min: -1e12, max: 1e12 } as const

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
