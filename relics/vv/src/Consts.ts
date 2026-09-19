/* eslint-disable no-template-curly-in-string */

// ***********************************************************************
//
// RegExps
//
export const PFX_RE_STR          =       `[a-z]{3}`
export const PFXSTR_RE           =      /^[a-z]{3}$/
export const NODEID_RE           =   /^((([a-z]{3})\.([a-z][a-z0-9_]{1,14})):([!~a-zA-Z0-9][a-zA-Z0-9_\-]{0,39}))$/
export const CTRID_RE            =   /^((([a-z]{3})\.([a-z][a-z0-9_]{1,14})):([!~a-zA-Z0-9][a-zA-Z0-9_\-]{0,39}))$/
export const OKEY_RE             =                  /^[a-z][a-z0-9_]{1,14}$/
export const OKEY_RE_STR         =                   `[a-z][a-z0-9_]{1,14}`
export const IDENTID_RE          =              /^dnt.[a-z][a-z0-9_]{1,14}:[a-zA-Z0-9]{26}$/
// was:
export const IDKEY_RE_STR        =         `[!~a-zA-Z0-9][a-zA-Z0-9_\\-]{0,39}`
export const IDKEY_RE            =  /^(?:([!~a-zA-Z0-9][a-zA-Z0-9_\-]{0,39})|(((([a-z]{3})\.([a-z][a-z0-9_]{1,14})):([!~a-zA-Z0-9][a-zA-Z0-9_\-]{0,39}))\/((([a-z]{3})\.([a-z][a-z0-9_]{1,14})):([!~a-zA-Z0-9][a-zA-Z0-9_\-]{0,39}))))$/
export const ANYIDKEY_RE         =  /^(?:([!~a-zA-Z0-9][a-zA-Z0-9_\-]{0,39})|(((([a-z]{3})\.([a-z][a-z0-9_]{1,14})):([!~a-zA-Z0-9][a-zA-Z0-9_\-]{0,39}))\/((([a-z]{3})\.([a-z][a-z0-9_]{1,14})):([!~a-zA-Z0-9][a-zA-Z0-9_\-]{0,39}))))$/
export const CTRIDKEY_RE         =      /^[!~a-zA-Z0-9][a-zA-Z0-9_\-]{0,39}$/
export const SPANIDKEY_RE        =                                            /^(((([a-z]{3})\.([a-z][a-z0-9_]{1,14})):([!~a-zA-Z0-9][a-zA-Z0-9_\-]{0,39}))\/((([a-z]{3})\.([a-z][a-z0-9_]{1,14})):([!~a-zA-Z0-9][a-zA-Z0-9_\-]{0,39})))$/
export const SPANID_RE           =      /^((([a-z]{3})\.([a-z][a-z0-9_]{1,14}))\/(((([a-z]{3})\.([a-z][a-z0-9_]{1,14})):([!~a-zA-Z0-9][a-zA-Z0-9_\-]{0,39}))\/((([a-z]{3})\.([a-z][a-z0-9_]{1,14})):([!~a-zA-Z0-9][a-zA-Z0-9_\-]{0,39}))))$/
export const LOOSE_NODEID_RE     = /^(?:(([a-z]{3})\.([a-z][a-z0-9_]{1,14}))\/)?(((([a-z]{3})\.([a-z][a-z0-9_]{1,14})):([!~a-zA-Z0-9][a-zA-Z0-9_\-]{0,39}))(?:\/((([a-z]{3})\.([a-z][a-z0-9_]{1,14})):([!~a-zA-Z0-9][a-zA-Z0-9_\-]{0,39})))?)$/
export const SIMPLE_ID_RE        =     /^([a-z]{3})\.([a-z][a-z0-9_]{1,14})(?:(?::([!~a-zA-Z0-9][a-zA-Z0-9_\-]{0,39}))|(?:\/([a-z]{3}\.[a-z][a-z0-9_]{1,14}:[!~a-zA-Z0-9][a-zA-Z0-9_\-]{0,39}\/[a-z]{3}\.[a-z][a-z0-9_]{1,14}:[!~a-zA-Z0-9][a-zA-Z0-9_\-]{0,39})))$/
export const IDSHD_RE            =     /^([a-z]{3})\.([a-z][a-z0-9_]{1,14})[:\/]/
export const CROCKFORD_CHARS     =  'a-hjkmnpqrstv-z0-9'
// the term GUID shall alway mean a uuid as a big hairy 36-char string: 12345678-1234-4000-8000-1234567890ab
// v4 (time-based) will have a 4 and an [99ab] in the two special spots: aaaabbbb-cccc-4xxx-[89ab]xxx-xxxxyyyyzzzz
export const GUID_V1_RE       = /^[0-9a-f]{8}-[0-9a-f]{4}-1[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
export const GUID_V4_RE       = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
export const GUID_V5_RE       = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/

export const TXTK_UUID5_DB_NS = '0F0010FA-700C-7415-15A5-E2105D5009EE'
export const TXTK_UUID5_ID_NS = '5206E14A-0290-5023-A6D7-D5A63645820C'

// a ulid generated idkey is 26 characters long, lowercase, crockford encoded (no i, o, l or u)
export const ULID_RE          = /^[0-7][a-hjkmnpqrstv-z0-9]{25}$/
export const ID26_RE          = /^[0-7][a-hjkmnpqrstv-z0-9]{25}$/  // ID26 used to allow any crockford-encoded 26-char string (vs a ulid which must be a positive time value (first digit 0-7);), let's see if anything breaks.
export const TIMECODE_RE      = /^0[0-4][a-hjkmnpqrstv-z0-9]{24}$/
export const TCTIMEPART_RE    = /^0[0-4][a-hjkmnpqrstv-z0-9]{8}$/
export const TCUNIQPART_RE    = /^[a-hjkmnpqrstv-z0-9]{16}$/

// a ulid generated idkey is 26 characters long, lowercase, a-z0-9 only
// a synthetic idkey starts with
//   - `!` (force to top),
//   - `~` (force to end/most recent) or
//   - `_` (shows staticness)
// Note:
// * the member model allows 36-character guid as idkey (8-4-4-4-12)
// * old (2021) code did not require a leading `_`, `!` or `~`
export const _SYNTHKEY_RE = /^(?:[_!~a-z0-9][a-z0-9\-_]{1,25}|!|~)$/i
//
// 0x20 is space; 0x7f (escape) and 00-19 (control characters) are not included
//  !"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\]^_`abcdefghijklmnopqrstuvwxyz{|}~
// 22222222222222223333333333333333444444444444444455555555555555556666666666666666777777777777777
// 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcde
//
export const ASCIISH_RE        = /^[\x20-\x7e]*$/        // eslint-disable-line no-control-regex
export const TEXTISH_RE        = /^[\P{Cc}\t\r\n]*$/u    // eslint-disable-line no-control-regex
export const STRINGISH_RE      = /^\P{Cc}*$/u            // eslint-disable-line no-control-regex
export const CURRENCY_NICK_RE  = /^[a-zA-Z\.\/$€¥£Kč¤¢₩]*$/u

export const CTRL_SP_NOT_TABNL = /[\u0000-\u0009\u000b\u000c\u000e-\u001f\u007f\p{Z}\u0085\u009d]+/gu // eslint-disable-line no-control-regex
export const CTRL_SP_TAB_NL    = /[\p{Cc}\p{Z}]+/gu

export const PHONE_RE  /**/    = /^(((\+[1-9]{1,4}[ \.\-]?)|(\(?[0-9]{2,3}\)?[ \.\-]?)|([0-9]{2,4})[ \.\-]?){0,2}?[0-9]{3,4}?[ \.\-]?[0-9]{3,4}?(\s*#\s*\d{1,6}){0,2})?$/
// refers to https://regex101.com/r/PA10Mf/4
export const MEAN_EMAIL_RE     = /^(((([a-z0-9_][\-\.]?)*[a-z0-9_]+)((?:\+([a-z0-9_]+[\-\.]?)+)){0,2})@(((?!-)((xn--[a-z0-9]{1,59}|xn--((?![\-a-z0-9]{60,})[a-z0-9]{1,57}-[a-z0-9]{1,57})|[a-z0-9-]{1,63})\.)){1,4}((?!-)((xn--[a-z0-9]{1,59}|xn--[a-z0-9]{1,57}-[a-z0-9]{1,57}|(?![\-\.a-z0-9][\-\.a-z0-9]--)[a-z][a-z0-9-]{0,61}[a-z0-9]))))|Andrew@scrub-a-dubcarwash.com)$/
// export const COGKEY_RE         = /^(([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})|((([a-z0-9_][\-\.]?)*[a-z0-9_]+)((?:\+([a-z0-9_]+[\-\.]?)+)){0,2})@(((?!-)((xn--[a-z0-9]{1,59}|xn--((?![\-a-z0-9]{60,})[a-z0-9]{1,57}-[a-z0-9]{1,57})|[a-z0-9-]{1,63})\.)){1,4}((?!-)((xn--[a-z0-9]{1,59}|xn--[a-z0-9]{1,57}-[a-z0-9]{1,57}|(?![\-\.a-z0-9][\-\.a-z0-9]--)[a-z][a-z0-9-]{0,61}[a-z0-9]))))|Andrew@scrub-a-dubcarwash.com)$/
export const LOWALNUMBAR_RE    = /^[a-z0-9_]*$/

export const UPALNUMBAR_RE     = /^[A-Z0-9_]*$/
export const PUNCT_RE_STR      = `!"#$%&'()*+,-\\.\\/:;<=>?@\\[\\\\\\]^_\`\\{\\|\\}~` // refers to https://regex101.com/r/PA10Mf/4
export const ENDS_IN_COM_NET_ORG_PLUS_RE   = /\.(com|net|org)[^\.]+$/
export const COM_NET_ORG_VALID_TLDS_RE     = /\.(comcast|commbank|commerce|community|company|compare|computer|netflix|network|organic)$/
export const NO_UPPER_PLAIN_RE  = /^[a-z0-9 !-@\[-~]*$/
export const NO_LOWER_PLAIN_RE  = /^[A-Z0-9 !-@\{-~]*$/

// 0x20 is space; 0x7f (escape) and 00-19 (control characters) are not included
//  !"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\]^_`abcdefghijklmnopqrstuvwxyz{|}~
// 22222222222222223333333333333333444444444444444455555555555555556666666666666666777777777777777
// 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcde
//
export const LABEL_RE           = /^[a-z][a-z0-9_]*$/
export const DASHLABEL_RE       = /^[a-z][a-z0-9_\-]*$/
export const ALNUM_RE           = /^[A-Za-z0-9]*$/
export const AZALNUM_RE         = /^[a-zA-Z][a-zA-Z0-9]*$/i
export const AZALNUMBAR_RE      = /^[a-zA-Z][a-zA-Z0-9_]*$/i
export const LOAZALNUM_RE       =    /^[a-z][a-z0-9]*$/i
export const UPAZALNUM_RE       =    /^[A-Z][A-Z0-9]*$/
export const LOAZALNUMBAR_RE    =    /^[a-z][a-z0-9_]*$/
export const UPAZALNUMBAR_RE    =    /^[A-Z][A-Z0-9_]*$/
export const NO_UPPER_INTL_RE   = /^[^\p{Lu}]*$/u
export const NO_LOWER_INTL_RE   = /^[^\p{Ll}]*$/u
export const TRIMMED_RE         = /^([^\s\p{Cc}].*[^\s\p{Cc}]|[^\s\p{Cc}]|)$/su

//
export const TAB               = '\t'
export const LF                = '\n'
export const CR                = '\r'
export const WIN_NL            = CR + LF
export const NL                = LF
export const SPC               = ' '
export const ELLIPSIS_3DOTS = '...'
export const ELLIPSIS_1GLYPH = '…'

const        PUNCT_CHARS_1 /**/ = ['!', '"', '#', '$', '%', '&', `'`, '(', ')', '*', '+', ',', '-', '.', '/'] as const
export const NUM_CHARS          = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'] as const
const        PUNCT_CHARS_2      = [':', ';', '<', '=', '>', '?', '@'] as const
export const UPPER_CHARS        =               ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'] as const
export const UPPER_CROCKETS     = [...NUM_CHARS, 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H',      'J', 'K',      'M', 'N',      'P', 'Q', 'R', 'S', 'T',      'V', 'W', 'X', 'Y', 'Z'] as const
const        PUNCT_CHARS_3      = ['[', '\\', ']', '^', '_', '`'] as const
export const LOWER_CHARS        =               ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'] as const
export const LOWER_CROCKETS     = [...NUM_CHARS, 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h',      'j', 'k',      'm', 'n',      'p', 'q', 'r', 's', 't',      'v', 'w', 'x', 'y', 'z'] as const
const        PUNCT_CHARS_4      = ['{', '|', '}', '~'] as const
export const ANY_CROCKETS       = [...NUM_CHARS, 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H',      'J', 'K',      'M', 'N',      'P', 'Q', 'R', 'S', 'T',      'V', 'W', 'X', 'Y', 'Z', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h',      'j', 'k',      'm', 'n',      'p', 'q', 'r', 's', 't',      'v', 'w', 'x', 'y', 'z'] as const
//
export const WHITESPACE_CHARS = [
  '\u0009', '\u000a', '\u000b', '\u000c', '\u000d', '\u0020', '\u0020', '\u0085', '\u00a0', '\u1680', '\u2000',
  '\u2001', '\u2002', '\u2002', '\u2002', '\u2003', '\u2003', '\u2003', '\u2004', '\u2005', '\u2006', '\u2007',
  '\u2008', '\u2008', '\u2009', '\u2009', '\u2009', '\u200a', '\u2028', '\u2029', '\u202f', '\u205f', '\u3000',
]
//
export const MATCH_NEVER_RE     = /^$a/   // ze goggles... zey do nussing!
export const REPLACE_NEVER_RE   = /^$a/g
//
export const ASCII_PLAIN_PARTS  = [[SPC],  PUNCT_CHARS_1,    NUM_CHARS,    PUNCT_CHARS_2,    UPPER_CHARS,    PUNCT_CHARS_3,    LOWER_CHARS,    PUNCT_CHARS_4] as const
export const PUNCT_CHARS        =      [...PUNCT_CHARS_1,               ...PUNCT_CHARS_2,                 ...PUNCT_CHARS_3,                 ...PUNCT_CHARS_4] as const
export const NON_WHTSPC_CHARS   =      [...PUNCT_CHARS_1, ...NUM_CHARS, ...PUNCT_CHARS_2, ...UPPER_CHARS, ...PUNCT_CHARS_3, ...LOWER_CHARS, ...PUNCT_CHARS_4] as const
export const PLAIN_CHARS        = [SPC, ...NON_WHTSPC_CHARS]                               as const
export const ALPHA_CHARS        = [...UPPER_CHARS, ...LOWER_CHARS]                         as const
export const ALNUM_CHARS        = [...NUM_CHARS, ...ALPHA_CHARS]                           as const
export const LOWALNUM_CHARS     = [...NUM_CHARS,                           ...LOWER_CHARS] as const
export const LOWALNUMBAR_CHARS  = [...NUM_CHARS,                      '_', ...LOWER_CHARS] as const
export const UPALNUM_CHARS      = [...NUM_CHARS, ...UPPER_CHARS]                           as const
export const UPALNUMBAR_CHARS   = [...NUM_CHARS, ...UPPER_CHARS, '_']                      as const
export const ALNUMBAR_CHARS     = [...NUM_CHARS, ...UPPER_CHARS, '_', ...LOWER_CHARS]      as const
//
/* eslint-enable array-bracket-spacing */
export const FILENAME_CHARS     = [...ALNUMBAR_CHARS, '-', '!', '~', '%', '.', '/', '^']   as const
export const GLOB_CHARS         = [...FILENAME_CHARS, '*', '{', '}', '[',  ']', '?', ',']   as const
export const URLUNRSVDP_CHARS   =                                                             ['-', '.',                                                             '_',                      '~'] as const
export const URLGENDELIM_CHARS  =           ['#',                                                        '/', ':',                     '?', '@', '[',       ']']                                    as const
export const URLSUBDELIM_CHARS  = ['!',           '$',      '&', `'`, '(', ')', '*', '+', ',',                     ';',      '=']                                                                   as const
export const URLMUSTENC_CHARS   =      ['"',           '%',                                                             '<',      '>',                '\\',      '^',      '`', '{', '|', '}']      as const
export const PUNCT_CHARS_X /**/ = ['!', '"', '#', '$', '%', '&', `'`, '(', ')', '*', '+', ',', '-', '.', '/', ':', ';', '<', '=', '>', '?', '@', '[', '\\', ']', '^', '_', '`', '{', '|', '}', '~'] as const
export const S3BUCKET          = { re: /^(?!^xn--.*)(?!^.*(\.s3alias|--ol-s3)$)(?!^([0-9]+\.){3}[0-9]+$)(?!.*\.\.+)(^[a-z0-9][a-z0-9\-\.]{1,61}[a-z0-9]$)$/, msg: 'should match the rules from go.aws/3zQU4Ro' }
//
// Full Unicode categories of character
// to get codepoints: .map((chr) => 'u+' + chr.codePointAt().toString(16).toLowerCase())
// +0020 (Standard Space); U+00A0: Non-Breaking Space; U+2002-U+200A: Various Em Spaces; U+202F: Narrow No-Break Space; U+3000: Ideographic Space
export const SPACE_CHARS        = [' ', '\u00a0', '\u1680', '\u2000', '\u2001', '\u2002', '\u2003', '\u2004', '\u2005', '\u2006', '\u2007', '\u2008', '\u2009', '\u200a', '\u202f', '\u205f', '\u3000'] as const
export const SINGLY_QUOTES      =      [`'`,  `‘`, `’`, `‚`, `‛`,                     `❛`, `❜`,           '\u275b',  '\u275c',                     '\u276e', '\u276f'] as const
export const DOUBLY_QUOTES      = [`"`,                           `“`, `”`, `„`, `‟`,           `❝`, `❞`,                      '\u275f', '\u2760',                     '\u2e42', '\u3003', '\u301d', '\u301e', '\u301f', '\u{1f676}', '\u{1f677}', '\u{1f678}', '\u{e0022}', '\uff02'] as const
export const TICKY_QUOTES       = [`"`, `'`,  `‘`, `’`, `‚`, `‛`, `“`, `”`, `„`, `‟`, `❛`, `❜`, `❝`, `❞`, '\u275b',  '\u275c', '\u275f', '\u2760', '\u276e', '\u276f', '\u2e42', '\u3003', '\u301d', '\u301e', '\u301f', '\u{1f676}', '\u{1f677}', '\u{1f678}', '\u{e0022}', '\uff02'] as const
export const BACKTICKY_QUOTES   = ['`']      as const // this is apparently not considered a quote mark proper by unicode
export const ANGLY1_QUOTES      = ['‹', '›'] as const // !! these are also included in BRACKETISH. If munging text, treat these as ''; if it's garbage structured data assume  <> is meant
export const ANGLY2_QUOTES      = ['«', '»'] as const // !! these are also included in BRACKETISH. If munging text, treat these as ""; if it's garbage structured data assume <<>> is meant
export const QUOTES             = [...TICKY_QUOTES, ...BACKTICKY_QUOTES, ...ANGLY1_QUOTES, ...ANGLY2_QUOTES] as const
// There are many other "brackets" but they stop looking like < and > at some point
export const BRACKETISH_CHARS   = ['<', '>', '«', '»', '‹', '›', '⟪', '⟫', '‹', '›', '⟨', '⟩', '❰', '❱'] as const
export const DASHES             = ['-', '‐', '‑', '‒', '–', '—', '―', '−', '⁃', '﹘', '﹣', '－'] as const
//
export type PunctChar          = typeof PUNCT_CHARS[number]
export type UpperChar          = typeof UPPER_CHARS[number]
export type LowerChar          = typeof LOWER_CHARS[number]
export type UpperCrocket       = typeof UPPER_CROCKETS[number]
export type LowerCrocket       = typeof LOWER_CROCKETS[number]
export type AnyCrocket         = typeof ANY_CROCKETS[number]
export type NumChar            = typeof NUM_CHARS[number]
export type SpaceChar          = ' '
export type UnderbarChar       = '_'
export type AlphaChar          = UpperChar    | LowerChar
export type LowalnumChar       = LowerChar    | NumChar
export type UpalnumChar        = UpperChar    | NumChar
export type AlnumChar          = AlphaChar    | NumChar
export type AlnumbarChar       = AlnumChar    | UnderbarChar
export type LowalnumbarChar    = LowalnumChar | UnderbarChar
export type UpalnumbarChar     = UpalnumChar  | UnderbarChar
export type PlainChar          = AlnumChar    | PunctChar | SpaceChar
export type FilenameChar       = typeof FILENAME_CHARS[number]
export type GlobChar           = typeof GLOB_CHARS[number]

// ***********************************************************************
//
// Numbers
//
// −9_007_199_254_740_991 (−(2^53 − 1), ~9e15) to  9_007_199_254_740_991 (2^53 − 1, ~9e15). Yes, both are "2^n-1" as opposed to the full-range ints where you get an extra negative number
export const INTJS          = { min: Number.MIN_SAFE_INTEGER,  max: Number.MAX_SAFE_INTEGER  } as const
export const UINT_32        = { min: 0,                        max: Number((2n ** 32n) - 1n) } as const
export const SINT_32        = { min: Number(-(2n ** 31n)),     max: Number((2n ** 31n) - 1n) } as const
export const UINT_64        = { min: 0,                        max: Number((2n ** 64n) - 1n) } as const
export const SINT_64        = { min: Number(-(2n ** 63n)),     max: Number((2n ** 63n) - 1n) } as const
export const QUANTITY       = { min: 0, max: 1e7   } as const
export const PXDIM          = { min: 1, max: 20000 } as const

// ***********************************************************************
//
// Fundamental Types
//
export const GENERIC        = {}
export const BOOLEAN        = { like: 'boolish'      } as const
export const BOOLISH        = { like: 'boolish'      } as const
export const INT            = { ...SINT_32           } as const
export const SAFEINT        = { ...INTJS             } as const
export const ARRAY          = { isa: 'arr', max: 150 } as const
export const STRSET         = { isa: 'strset', of: 'pctkey', max: 20 } as const
export const ID             = { } as const
export const ENUM           = { re: LOWALNUMBAR_RE, strcase: 'lower', min: 1, max: 26, msg: "should be lowercase plain letters, numbers, or _bar" } as const

// ***********************************************************************
//
// Generic Strings
//
export const TEXTISH        = { re: TEXTISH_RE,   msg: "has weird characters" } as const
export const STRINGISH      = { re: STRINGISH_RE, msg: "has tabs, returns or weird characters" } as const
export const STRING         = { ...STRINGISH }     as const
//
export const SHORTSTR       = {         max: 15  } as const
export const IDKEYSTR       = { min: 1, max: 26  } as const
export const CODESTR        = {         max: 26  } as const
export const MEDSTR         = {         max: 40  } as const // length of a smushed uuid, 99+%ile part of person name
export const LONGSTR        = {         max: 120 } as const
export const FULLSTR        = {         max: 82  } as const // fits better on mobile. allows two medstrs / 3 idkeystr with delims, 99+%ile company name
export const BIGSTR         = {         max: 200 } as const // Max amazon product title listing
export const NOTESTR        = {         max: 3600, ...TEXTISH } as const
export const BLOBBISH       = {         max: 800800, ...TEXTISH } as const
export const STR            = FULLSTR
//
export const ALNUM          = { re: ALNUM_RE,                                           msg: "should have only plain letters/numbers" } as const
export const ALNUMBAR       = { re: /^\w*$/,                                            msg: "should have only plain letters/_/numbers" } as const
export const LABEL          = { re: LABEL_RE,       strcase: 'lower',  min: 2, max: 25, msg: "should have only plain lowercase letters/_/numbers with a letter first" } as const
export const DASHLABEL      = { re: DASHLABEL_RE,   strcase: 'lower',  min: 2, max: 25, msg: "should have only plain lowercase letters/_/-/numbers with a letter first" } as const

export const AZALNUM        = { re: AZALNUM_RE,                                         msg: "should have only plain letters/numbers with a letter first"       } as const
export const UPAZALNUM      = { re: UPAZALNUM_RE,    strcase: 'upper',                  msg: "should have only plain letters/numbers with a letter first"       } as const
export const AZALNUMBAR     = { re: AZALNUMBAR_RE,                                      msg: "should have only plain letters/_/numbers with a letter first" } as const
export const LOAZALNUMBAR   = { re: LOAZALNUMBAR_RE, strcase: 'lower',                  msg: "should have only lowercase plain letters/_/numbers with a letter first" } as const
export const UPAZALNUMBAR   = { re: UPAZALNUMBAR_RE, strcase: 'upper',                  msg: "should have only uppercase plain letters/_/numbers with a letter first" } as const
export const LOWALNUMBAR    = { re: LOWALNUMBAR_RE,  strcase: 'lower',                  msg: "should have only lowercase plain letters/_/numbers" } as const
export const UPALNUMBAR     = { re: /^[A-Z0-9_]*$/,  strcase: 'upper',                  msg: "should have only uppercase plain letters/_/numbers" } as const
export const PLAIN          = { re: /^[A-Za-z0-9 ]*$/,                                  msg: "should have only plain letters, numbers, and the occasional space" } as const
export const ASCIISH        = { re: ASCIISH_RE,                                         msg: "should have only unaccented keyboard characters" } as const
export const BEG_W_LTR      = { re: /^[A-Za-z]/,                                        msg: "should begin with a letter" } as const
export const TRIMMED        = { re: TRIMMED_RE,                                         msg: "should not begin or end with any space separators" }
export const UPPER          = { re: NO_LOWER_PLAIN_RE,                                  msg: "should be all uppercase" }
export const LOWER          = { re: NO_UPPER_PLAIN_RE,                                  msg: "should be all lowercase" }
export const UPPER_INTL     = { re: NO_LOWER_INTL_RE,                                   msg: "should be all uppercase" }
export const LOWER_INTL     = { re: NO_UPPER_INTL_RE,                                   msg: "should be all lowercase" }

//
export const TITLEISH       = { ...FULLSTR, ...STRINGISH, strcase: 'title' } as const
export const LONGTITLE      = { ...TITLEISH, max: 120 } as const
export const NOTEISH        = { ...NOTESTR } as const
export const PHRASETAG      = { min: 1, max: 40, strcase: 'lower', re: /^[a-z0-9\-]*$/, msg: "should be lowercase plain letters, numbers, or dashes" } as const
//

// ***********************************************************************
//
// Identifier Types
//

export const PFXSTR         = { len: 3,  min: 3,  max: 3,  re: PFXSTR_RE, msg: 'three lowercase letters' } as const
export const PFX            = PFXSTR
export const OKEY           = {          min: 2,  max: 15, re: OKEY_RE,   msg: 'is not an org label' } as const
//
export const SUBJIDS        = { isa: 'array', min: 1, of: 'string' }
//
export const CODISH         = { min: 1, max: 90,  re:     /^[\w\-\.]*$/,                         msg: "should be letters, numbers, . dot - dash _ bar" } as const
export const KEYISH         = { min: 1, max: 90,  re:     /^[\w\-\.\:\/\+]*$/,                   msg: "should be letters, numbers, .-_/:" } as const
export const EXTKEYISH      = { min: 1, max: 90,  re:     /^[\w\-\.\/\:\+@#]*$/,                 msg: "should be letters, numbers, .-_/:@+#" } as const
export const PCTENC_KEY     = { min: 1, max: 90,  re:    /^([\w\-\.\/\:]|%[A-F0-9][A-F0-9])*$/,  msg: "should be letters, numbers, .-_/: and percent-encoded leftovers" } as const
export const PCTKEY         = { min: 1, max: 90,  re:    /^([\w\-\.\/\:]|%[A-F0-9][A-F0-9])*$/,  msg: "should be letters, numbers, .-_/: and percent-encoded leftovers" } as const
export const PCTCODE        = PCTKEY
export const SECTAG         = { min: 6, max: 46,  re: /^[a-z0-9#][a-z0-9_\-\.\/\:!~]*$/,         msg: "should start with a letter or '#' and be alphanum or .-_/:!~" } as const
export const HANDLEISH      = { ...LOAZALNUMBAR, min: 1, max: 36 } as const
export const FLOWHANDLE     = { ...HANDLEISH,    min: 3, max: 20 } as const
export const NSPHANDLE      = { ...HANDLEISH,    min: 3, max: 10 } as const
//
export const UUIDSTR        = { len: 40, min: 40, max: 40, re: /^[0-9a-f\-]{40}$/ } as const
export const GUIDV4         = { len: 36, min: 36, max: 36, strcase: 'lower', re: GUID_V4_RE, msg: "should be a lowercase v4 (randomized) uuid in dashed-hex form" } as const
export const GUIDV5         = { len: 36, min: 36, max: 36, strcase: 'lower', re: GUID_V5_RE, msg: "should be a lowercase v5 (stable) uuid in dashed-hex form"     } as const

// FIXME -- as written ULID is too polite -- it should only mean "a valid timecode-like ID26", but in some places we are using it to mean "any 26-character crockford-safe string"
export const ULID           = { len: 26, min: 26, max: 26, re: ULID_RE,                      msg: "should be a lowercase valid ULID code" } as const
export const ID26STR        = { len: 26, min: 26, max: 26, re: ID26_RE,                      msg: "should be a lowercase valid ULID code" } as const
export const ID26           = { len: 26, min: 26, max: 26, re: ID26_RE,                      msg: "should be a lowercase valid ULID code" } as const
export const TIMECODE       = { ...ULID, re: TIMECODE_RE,  msg: `should be a lowercase timecode, starting with 00-04 (date < 2195)` } as const
export const TCTIMEPART     = { ...ULID, re: TCTIMEPART_RE, msg: `should be the first 10 of a time code, starting with 00-04 (date < 2195)` } as const
export const TCUNIQPART     = { ...ULID, re: TCUNIQPART_RE, msg: `should be timecode-legal letters (a-z1-9 but no i, l, u, or o)` } as const

// ***********************************************************************
//
// ID Types
//
export const IDSHARD_MAX    = PFX.max + 1 + OKEY.max + 1
export const CTRIDKEY_MAX   = 40
export const BIGIDKEY_MAX   = 40
export const IDENTID_MAX    = 3 + 1 + 15 + 1 + 26
export const CTRID_MAX      = IDSHARD_MAX +     CTRIDKEY_MAX   // max:  3 + 1 + 15 + 1 + 26 = 46 using ulid idkey
export const BIGID_MAX      = IDSHARD_MAX +     BIGIDKEY_MAX   // max:  3 + 1 + 15 + 1 + 40 = 60 using GUID idkey
export const SPANIDKEY_MAX  = CTRID_MAX   + 1 + CTRID_MAX      // max:          60 + 1 + 60 = 121
export const SPANID_MAX     = IDSHARD_MAX +     SPANIDKEY_MAX  // max: 20       60 + 1 + 60 = 141
export const NODEID_MAX     = SPANID_MAX
// min length of a center id = (3 + 1 + 2) + 1 + 1 = 8; min length of a span id = 6 + 1 + 8 + 1 + 8 = 24: 'foo.aa/bar.bb:!/baz.cc:!'
export const IDKEY          = { min:  1, max: 26,             re: IDKEY_RE,         msg: "should be an idkey (~! al/num/-/_) or centerID/centerID"        } as const
export const BIGIDKEY       = { min:  1, max: 40,             re: IDKEY_RE,         msg: "should be an idkey (~! al/num/-/_), GUID, or centerID/centerID" } as const
export const CTRIDKEY       = { min:  1, max: CTRIDKEY_MAX,   re: CTRIDKEY_RE,      msg: "should be an idkey (~! al/num/-/_)"                             } as const
export const SPANIDKEY      = { min: 24, max: SPANIDKEY_MAX,  re: SPANIDKEY_RE,     msg: "should be two base IDs joined by a / slash"                     } as const
export const ANYIDKEY       = { min:  1, max: SPANIDKEY_MAX,  re: ANYIDKEY_RE,      msg: "should be an idkey (~! al/num/-/_) or ctrID/ctrID"              } as const

export const CTRID          = {         max: CTRID_MAX,      re: CTRID_RE,         msg: "is not a tookstock base id",           max_msg: `max length ${CTRID_MAX } (${PFX.max}.${OKEY.max}:${IDKEYSTR.max})` } as const
export const NODEID         = {         max: NODEID_MAX,     re: NODEID_RE,        msg: "is not a center id of the right type", max_msg:     `max length ${NODEID_MAX} (${PFX.max}.${OKEY.max}:${IDKEYSTR.max})` } as const
export const BIGNODEID      = {         max: BIGID_MAX,      re: NODEID_RE,        msg: NODEID.msg,                             max_msg: `is longer than ${CTRID_MAX} (${PFX.max}.${OKEY.max}:${UUIDSTR.max})` } as const
export const SPANID         = {         max: SPANID_MAX,     re:  SPANID_RE,       msg: "is not a txtk span id",                max_msg: `is longer than ${SPANID_MAX} (${PFX.max}.${OKEY.max}/${BIGNODEID.max}/${BIGNODEID.max})` } as const
export const LOOSEID        = {         ...SPANID,           re: LOOSE_NODEID_RE,  msg: "is not a tookstock data ID" } as const
export const IDCOND         = LOOSEID
export const IDENTID        = {         max: IDENTID_MAX,     re: IDENTID_RE,        msg: "is not a tookstock data ID" } as const

// These values should be rejected by validation rules
export const ISO_EPOCH_ZERO         = "1970-01-01T00:00:00.000Z"; export const TS_EPOCH_ZERO        =             0;  export const TC_EPOCH_ZERO        = "0000000000xaaaaaaaaaaaaaaa" // zero millis date
export const ISO_PRE_ANCIENT        = "1971-01-21T18:06:59.582Z"; export const TS_PRE_ANCIENT       =   33329219582;  export const TC_PRE_ANCIENT       = "000z1971zyxaaaaaaaaaaaaaaa" // before earliest accepted date
export const ISO_POST_LAST_ALLOWED  = "2144-03-18T03:28:58.880Z"; export const TS_POST_LAST_ALLOWED = 5497558138880;  export const TC_POST_LAST_ALLOWED = "0500000000zzzzzzzzzzzzzzzz" // should be rejected
//
// These are notable allowed dates
//
export const ISO_EARLIEST           = "1971-01-21T18:06:59.583Z"; export const TS_EARLIEST          =   33329219583;  export const TC_EARLIEST          = "000z1971zzancjentzp1ch01dr" // earliest accepted date
// don't use this as a placeholder for customer records; only as the nominal date for our "this value isn't here" canaries
export const ISO_MISSING            = "1987-04-08T00:36:09.818Z"; export const TS_MISSING           =  544840569818;  export const TC_MISSING           = '00fvdgemyt1mec0de1sm1ss1ng'
export const ISO_UNKNOWN            = "1987-04-20T19:11:02.483Z"; export const TS_UNKNOWN           =  545944262483;  export const TC_UNKNOWN           = '00fwed0ntkn0wwherethjsg0es' // placeholder for "unknown" date. 4-20 is pure coincidence, I swear it.
export const ISO_UNK2021            = "2021-09-07T03:14:31.257Z"; export const TS_UNK2021           = 1630984471257;  export const TC_UNK2021           = '01fez400psg0tabad1h3r3b0ss' // former unknown placeholder; ts-iso were mistakenly misaligned so discontinued in favor of 00fwed0ntkn0wwherethjsg0es (1987-04-20)
export const ISO_2004NOV            = "2004-11-03T19:53:47.776Z"; export const TS_2004NOV           = 1099511627776;  export const TC_2004NOV           = "0100000000t00kst0ckc0deftw"
export const ISO_TOOKLOVE           = "2005-12-17T04:01:39.165Z"; export const TS_TOOKLOVE          = 1134792099165;  export const TC_TOOKLOVE          = '0110ve2haxt00kst0ckc0deftw' // our test fixture placeholder date
// Used for core records
export const ISO_SRSJRNEY           = "2021-03-05T02:00:21.305Z"; export const TS_SRSJRNEY          = 1614909621305;  export const TC_SRSJRNEY          = '01f001th1s1saser10vsj0vrny' // tookstock's birthday, ish
// Dates for **test** records in the past
export const ISO_2022JAN            = "2022-01-01T08:08:42.512Z"; export const TS_2022JAN           = 1641024522512;  export const TC_2022JAN           = "01fraay28gx01dtjme4test1ng" // bob o'clock
export const ISO_2022APR            = "2022-04-01T10:33:33.888Z"; export const TS_2022APR           = 1648809213888;  export const TC_2022APR           = "01fzjazzy0x01dtjme4test1ng"
export const ISO_2022MAY            = "2022-05-04T15:34:19.352Z"; export const TS_2022MAY           = 1651678459352;  export const TC_2022MAY           = "01g27vaderxmaythef0rthbwya"
// Purpose-specific dates
export const ISO_TOOKSUB_TRIALPAST  = "2024-04-26T20:19:49.854Z"; export const TS_TOOKSUB_TRIALPAST = 1714162789854;  export const TC_TOOKSUB_TRIALPAST = "01hwe10veyandthepartys0ver"
export const ISO_TOOKSUB_4EVAH      = "2037-05-21T00:47:30.270Z"; export const TS_TOOKSUB_4EVAH     = 2126479650270;  export const TC_TOOKSUB_4EVAH     = "01xwe10veyatxtk4evahcheers"
export const ISO_2024JUN            = "2024-06-21T23:41:36.930Z"; export const TS_2024JUN           = 1719013296930;  export const TC_2024JUN           = "01j0yjtjs2f1ndpr0dctmktfjt"
export const ISO_2025APR            = "2025-04-26T12:22:24.800Z"; export const TS_2025APR           = 1745670144800;  export const TC_2025APR           = "01jss0s0s0mvchnjcerthe3pt0"

// Dates for **test** records in the "future enough"
export const ISO_2040JAN            = "2040-01-06T01:27:30.520Z"; export const TS_2040JAN           = 2209426050520;  export const TC_2040JAN           = "0209p0w3erxjetpack4test1ng"
export const ISO_2040MAY            = "2040-05-01T13:26:30.149Z"; export const TS_2040MAY           = 2219491590149;  export const TC_2040MAY           = "020k204005xjetpack4test1ng"
export const ISO_2042NOV            = "2042-11-07T04:48:07.201Z"; export const TS_2042NOV           = 2298948487201;  export const TC_2042NOV           = "022x204211xjetpack4test1ng"
//
export const ISO_02ROLLOVER_PRE     = "2039-09-07T15:47:35.551Z"; export const TS_02ROLLOVER_PRE    = 2199023255551;  export const TC_02ROLLOVER_PRE    = "01zzzzzzzzzzzzzzzzzzzzzzzz" // last having '01' at start of timecode
export const ISO_02ROLLOVER         = "2039-09-07T15:47:35.552Z"; export const TS_02ROLLOVER        = 2199023255552;  export const TC_02ROLLOVER        = "0200000000xtc02r0110veryay" // rollover to '02' at start of timecode
// Validation Cutoff for "not so far in the future", eg credit card expirations
export const ISO_NEAR_FUT           = "2050-07-16T19:56:11.082Z"; export const TS_NEAR_FUT          = 2541614171082;  export const TC_NEAR_FUT          = "029z2050yaywecanhazjetpack" // the "near future" estimator
// Represent "so far in the future it is the end of time". For example, use endTC = TC_FARTHEST to capture a time range that accepts all future dates. Note spelling: fArthest not fUrthest
export const ISO_FARTHEST           = "2144-03-06T12:11:30.687Z"; export const TS_FARTHEST          = 5496552690687;  export const TC_FARTHEST          = "04zz2144zzfarthestp1ch01dr" // placeholder for "infinite future"
// Represent "so far in the future it will not be handled"; in particular, use begTC = TC_NEVER to endTC = TC_NEVER to capture a perfectly exclusive time range.
export const ISO_NEVER              = "2144-03-17T08:14:25.213Z"; export const TS_NEVER             = 5497488865213;  export const TC_NEVER             = "04zzxxxxxxneverestp1ch01dr" // placeholder for "will never happen"
// Largest date that our system will accept, the last moment before the timecode begins with `05` or larger.
export const ISO_LAST_ALLOWED       = "2144-03-18T03:28:58.879Z"; export const TS_LAST_ALLOWED      = 5497558138879;  export const TC_LAST_ALLOWED      = "04zzzzzzzzhardrejectcvt0ff" // largest accepted by regexp
// An interesting possibly important set of dates for internal testing of timecodes
export const ISO_EPOCHALYPSE_PRE1   = "2038-01-19T03:14:06.999Z"; export const TS_EPOCHALYPSE_PRE1  = 2147483646999;  export const TC_EPOCHALYPSE_PRE1  = "01yfzzzz0qxaaaaaaaaaaaaaah" // 1000*(2^31) - 1 millisecond before the 'seconds' epochalypse
export const ISO_EPOCHALYPSE        = "2038-01-19T03:14:07.000Z"; export const TS_EPOCHALYPSE       = 2147483647000;  export const TC_EPOCHALYPSE       = "01yfzzzz0rxaaaaaaaaaaaaaah" // the 32-bit apocalypse i.e.      2^31 epoch seconds
export const ISO_EPOCHALYPSE_PRE2   = "2038-01-19T03:14:07.999Z"; export const TS_EPOCHALYPSE_PRE2  = 2147483647999;  export const TC_EPOCHALYPSE_PRE2  = "01yfzzzzzzxaaaaaaaaaaaaaah" // 1000*(2^31) - 1 millisecond before the milliseconds rollover epochalypse
export const ISO_EPOCHALYPSE_MS     = "2038-01-19T03:14:08.000Z"; export const TS_EPOCHALYPSE_MS    = 2147483648000;  export const TC_EPOCHALYPSE_MS    = "01yg000000xaaaaaaaaaaaaaah" // the 32-bit apocalypse plus one
export const ISO_EPOCHALYPSE_POST   = "2038-01-19T03:14:08.001Z"; export const TS_EPOCHALYPSE_POST  = 2147483648001;  export const TC_EPOCHALYPSE_POST  = "01yg000001xaaaaaaaaaaaaaah" // the 32-bit apocalypse plus two
// note: in an object, keys that parse as integers <= 2^32 are not held sorted by insertion order; they preceded all others in numeric order. So no worries with timecodes or guids but timestamps must not be mixed with other keys.

export const TIMESTAMP      = { min: TS_EARLIEST, min_msg: 'improbably ancient (pre-1972)', max: TS_LAST_ALLOWED, max_msg: 'improbably futuristic (post 2144)' } as const

// ***********************************************************************
//
// Address and Contact
//
export const POSTCODE_RE = /^[a-zA-Z0-9\+\-\.\:\/ ]*$/
export const NAMESTR        = { ...FULLSTR, strcase: 'title' } as const
export const NAME           = { ...NAMESTR } as const
export const NAMEPART      = { ...MEDSTR,  strcase: 'title' } as const
export const NICKNAME       = { ...NAMEPART } as const
export const COMPANY        = { ...TITLEISH, strcase: 'title' } as const
export const COUNTRYCODE    = { re: /^[A-Z][A-Z]$/,                                     msg: 'should be an uppercase two-letter country code, eg US or CA' } as const
export const COUNTRY        = { ...COUNTRYCODE } as const
export const PHONE          = { ...MEDSTR, re: PHONE_RE,                                msg: "should be a phone number, eg 867-5309 or +00 44 9999 999999#12345" } as const
export const PHONE_STR      = { ...MEDSTR, re: PHONE_RE,                                msg: "should be a phone number, eg 867-5309 or +00 44 9999 999999#12345" } as const
export const PHONENUMBER    = { ...PHONE_STR } as const
export const POSTCODE       = { ...SHORTSTR, re: POSTCODE_RE,                           msg: "should be a valid postal code" } as const
export const EMAIL_STR      = { ...FULLSTR, re: MEAN_EMAIL_RE,                          msg: 'should be a conventional email format' } as const
export const EMAIL          = EMAIL_STR
export const EMAILADDRESS   = EMAIL_STR
export const NON_BOGUS_TLD  = { ends_re: ENDS_IN_COM_NET_ORG_PLUS_RE,                   msg: 'has an unusable suffix',  tlds_re: COM_NET_ORG_VALID_TLDS_RE }
export const COGNITOVAL     = { max: 2000,                                              max_msg: 'Cognito attributes should be less than 2000 characters' } as const
export const LNG            = { gt: -180, max: 180 } as const
export const LAT            = { gt:  -90, max:  90 } as const
export const TZSLASH        = { max: 40, re: /^(|(?:((Etc\/)?(GMT)(?:([\-\+])(\d\d?)|(0?))))|([A-Z]{3})|([A-Z]{2,3}\d[A-Z]{3})|(([A-Z][A-Za-z_\-]*[A-Za-z])(?:\/([A-Z][A-Za-z_\-]*[A-Za-z])(?:\/([A-Z][A-Za-z_\-]*[A-Za-z]))?)?))$/, msg: 'is not a America/Chicago style timezone' }
export const ADDRPART       = { ...STRINGISH, max: 200 } as const
export const EMOJI          = { ...STRINGISH, max: 20 } as const

// ***********************************************************************
//
// Security/identity related
//

export const PASSWORD       = { re: /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])/, msg: "Please use an Uppercase, a Lowercase, & a Number" } as const
export const COGKEY         = { msg: "a v4 guid or a conventionally-formatted email" } as const

// ***********************************************************************
//
// Datamodel-related strings (typename, fieldname, classname, etc)
//

export const CAMEL          = { re: /^[A-Z][A-Za-z0-9]*$/,          msg: "should be an UpperFirstLetterCamelCased name" } as const
export const LOCAMEL        = { re: /^[a-z][A-Za-z0-9]*$/,          msg: "should be a lowerFirstLetterCamelCased name" } as const
export const SNAKE          = { re: /^[a-z][a-z0-9_]*$/,            msg: "should be a lower_underscore_case name" } as const
export const CLASSNAME      = { re: /^[A-Z][A-Za-z0-9]*$/,          msg: "should be a CamelCased class name" } as const
export const FIELDNAME      = { re: /^[a-z][A-Za-z0-9_]*$/,         msg: "should be a lowerfirst label" } as const
export const VARNAME        = { re: /^[a-zA-Z][A-Za-z0-9_]*$/,      msg: "should be a label and start with a letter" } as const
export const TYPENAME       = { ...CLASSNAME } as const
export const TOPICNAME      = { ...LABEL } as const
export const TSTYPE         = { re: /^([a-z][\w\.]*(<(,? *[a-z][\w\.]*)+>)?\|?&? *)+$/i, msg: "should be a defensible tstype declaration" } as const
export const DASHDOTLABEL   = { re:       /^([a-z][\-a-z0-9_]*)(\.[a-z][\-a-z0-9_]*)*$/, msg: "is not dot-separated labels (lowercase alnumbar, starting with a letter)" } as const
export const LODOTFIELD     = { re:      /^([a-z_]\w*)(\.[a-z_]\w*)*$/,                  msg: "is not a locamel field path" } as const
export const DOTFIELD       = { re:   /^([A-Za-z_]\w*)(\.[A-Za-z_]\w*)*$/,               msg: "is not a field path" } as const
export const QTDOTFIELD     = { re: /^("?[A-Za-z_]\w*"?)(\."?[a-z_]\w*"?)*$/,            msg: "is not a maybe-quoted field path" } as const

// ***********************************************************************
//
// Versioning-related strings
//

export const SCHEMAVER      = { len:  8,                  re: /^(\d\d\d)_(\d\d\d)([a-z])$/,                                                           msg: 'should be a schema version like 002_005a' } as const
export const TKVER          = { min: 11, max:  33,        re: /^v?((\d\d\d)_(\d\d\d)_(\d\d\d))(?:-((?:\d{1,4}-)?\w{1,20}))?$/,                        msg: 'should be a tkver like 002_005_008' } as const
export const VVER           = { min:  6, max: MEDSTR.max, re: /^v((0|[1-9]\d?\d?)\.(0|[1-9]\d?\d?)\.(0|[1-9]\d?\d?))(?:-((?:\d{1,4}-)?\w{1,20}))?$/,  msg: 'should be a v and a dotted version like v2.5.8-blah' } as const
export const VMAJ           = { min:  0, max: 999, numset: 'int' } as const
export const VMIN           = { min:  0, max: 999, numset: 'int' } as const
export const VPAT           = { min:  0, max: 999, numset: 'int' } as const
export const VPRE           = { min:  1, max:  20, re: /^(?:(\d{1,4})-)?([a-z0-9A-Z]\w{0,20})$/, msg: 'should be a short az-alphanumbar label' } as const
export const GITCOMMIT      = { ...UUIDSTR, strcase: 'lower', msg: "should be a full-length (40 char) git commit" } as const
export const GITBRANCH      = { re: /^((\d{8}-\w{1,15}-\w{1,36})|(([a-z]{3,15})-((\d\d\d)_(\d\d\d)_(\d\d\d))(-\w{1,20})?))$/, msg: "should be a feature branch (yyyymmdd-took-Awesome) or deploy tag (spike-002_005_008-foo)" } as const

// ***********************************************************************
//
// Cursoring/Querying Types
//
export const SORDER             = { re: /^[~!a-z0-9\-][\w\-]*$/, max: 100, msg: 'should be lowercase a-z0-9, with optional ! or ~ at start' } as const
export const BIGASS_COL_CT  = 4e8
export const QSIZE_DEFAULT  = 42
export const QSIZE_MAX      = 200
export const NEARTOL_DEF    = 0.000_000_01 // 1e-8
export const ENDCURSOR_INF  = '8e15'
export const EndCursorMax   = ENDCURSOR_INF
export const EndCursorMaxRE = /^8e15$/
export const RECORD_COUNT   = { min: 0, max: BIGASS_COL_CT }           as const
export const TOTALCOUNT     = { ...RECORD_COUNT            }           as const
export const SortdirVals    = ['asc', 'desc']                          as const
export  type Sortdir        = typeof SortdirVals[number]
export const CURSOR_QSIZE   = { min: 0, max: QSIZE_MAX,     defaultval: QSIZE_DEFAULT  } as const
export const CURSOR_OFFSET  = { min: 0, max: ENDCURSOR_INF, defaultval: 0              } as const
export const CURSOR_STR     = { min: 0, max: 1000,          defaultval: ENDCURSOR_INF  } as const
export const ENDCURSOR      = { min: 0, max: CURSOR_STR.max, re: ASCIISH.re, msg: ASCIISH.msg }

// ***********************************************************************
//
// Numberlike Strings
//
//  0 to 2,147,483,647
export const UINT31STR = { max: 10,  re:           /^(|(?:(\d{1,9}|[0-1]\d{0,9}|2[0-1]\d{8})))$/,                msg: "should be a plain non-negative number under 21 billion" } as const
//  0 to 4,294,967,295 -- we just check that it's not insanely over                                              //
export const UINT32STR = { max: 10,  re:           /^(|(?:(\d{1,9}|[0-3]\d{0,9}|4[0-2]\d{8})))$/,                msg: "should be a plain non-negative number under 42 billion" } as const
//  -2,147,483,648 to  2,147,483,647 -- we just check that it's not insanely over                                //
export const SINT32STR = { max: 11,  re:  /^(|(?:([\+\-]?)(\d{1,9}|[0-1]\d{0,9}|2[0-1]\d{8})))$/,                msg: "should be a plain number within +/- 21 billion"              } as const
//  0 to 9 007 199 254 740 991                                                                                    //
export const UINT53STR = { max: 16,  re:          /^(|(?:(\d{1,14}|[0-8]\d{15}|900[0-7]\d{12})))$/,              msg: "should be a plain non-negative number under 9 zillion" } as const
//  0 to 18446744073709551615                                                                                    //
export const UINT64STR = { max: 20,  re:          /^(|(?:(\d{1,19}|0\d{19}|1[0-8]\d{18})))$/,                    msg: "should be a plain non-negative number under 18 gazillion" } as const
//  -9,223,372,036,854,775,808 to 9,223,372,036,854,775,807                                                      //
export const SINT64STR = { max: 20,  re: /^(|(?:([\+\-]?)(\d{1,18}|[0-8]\d{0,18}|9[0-2]\d{17})))$/,              msg: "should be a plain number within +/- 9 gazillion"              } as const
// This allows plain fractional numbers, up to the size of a signed 64 bit integer, no exponent                  //
export const UNUM64STR = { max: 20,  re:          /^(|(?:(\d{1,18}|[0-8]\d{0,18}|9[0-2]\d{17})(\.\d{1,16})?))$/, msg: "should be a non-negative number under 18 gazillion"       } as const
// This allows plain fractional numbers, up to the size of a signed 64 bit integer, no exponent                  //
export const SNUM64STR = { max: 21,  re: /^(|(?:([\+\-]?)(\d{1,18}|[0-8]\d{0,18}|9[0-2]\d{17})(\.\d{1,16})?))$/, msg: "should be a number within +/- 9 gazillion" } as const
// -1.7976931348623158e+308 to -2.2250738585072014e-308, 2.2250738585072014e-308 to 1.7976931348623158e+308      //
export const SREALSTR  = { max: 40,  re: /^(|(?:([+-]?)((\d{1,20})(?:(\.)(\d{1,16}))?)(([eE])([+-]?)(\d|\d\d|[012]\d\d|30[0-8]))?))$/, msg: "(${value}) should be a number less than about 1.8e308" }
export const WHOLENUMSTR = UINT64STR
export const NUMSTR      = SNUM64STR
export const NUMBERISH   = NUMSTR
export const QTYSTR      = UINT53STR

export const SINTSTR        = { max: 11,  re: /^(?:-?\d+)$/,                     msg: "should look like a number"              } as const
export const UINTSTR        = { max: 10,  re: /^(\d+)$/,                         msg: "should look like a non-negative number" } as const
export const SNUMSTR        = { max: 200, re: /^(?:-?\d{1,308}(\.\d{1,16})?)?$/, msg: "should look like a number"              } as const
export const UNUMSTR        = { max: 199, re:   /^(?:\d{1,308}(\.\d{1,16})?)?$/, msg: "should look like a non-negative number" } as const
export const INTSTR         = SINTSTR
export const HEXRANGE       = { max: 40,  re: /^[a-f0-9]*(-[a-f0-9]+)?$/ } as const

// ***********************************************************************
//
// URL types
//
export const HTTPORFTP_RE = /^((https?|ftp|wss?):)?\/\/(((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:)*@)?(((\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5]))|((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.?)(:\d*)?)(\/((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)+(\/(([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)*)*)?)?(\?((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|[\uE000-\uF8FF]|\/|\?)*)?(\#((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|\/|\?)*)?$/i
export const HTTP_RE      = /^((https?|wss?):)?\/\/(((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:)*@)?(((\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5]))|localhost|((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.?)(:\d*)?)(\/((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)+(\/(([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)*)*)?)?(\?((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|[\uE000-\uF8FF]|\/|\?)*)?(\#((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|\/|\?)*)?$/i
export const URLPATH_RE = /^((\/((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)+(\/(([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)*)*)?)?)$/iu
// query (\?((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|[\uE000-\uF8FF]|\/|\?)*)?
// frag  (\#((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|\/|\?)*)?

// From Yup, stricter than Zod
export const URLSTR       = { re: HTTP_RE,    msg: 'should be a conventionally formatted http web address', max: 1000, url: true } as const
export const URLPATH      = { re: URLPATH_RE, msg: 'should be a conventionally formatted web address path', max:  400 } as const
export const EXTURI       = /^((https?|s3):)?\/\/(((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:)*@)?(((\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5]))|((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.?)(:\d*)?)(\/((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)+(\/(([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)*)*)?)?(\?((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|[\uE000-\uF8FF]|\/|\?)*)?(\#((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|\/|\?)*)?$/i

export const IPV4HOST_RE = /^((([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5]))$/
export const IPV6HOST_RE = /^(((([0-9A-Fa-f]{1,4}:){7}([0-9A-Fa-f]{1,4}|:))|(([0-9A-Fa-f]{1,4}:){6}(:[0-9A-Fa-f]{1,4}|((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){5}(((:[0-9A-Fa-f]{1,4}){1,2})|:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){4}(((:[0-9A-Fa-f]{1,4}){1,3})|((:[0-9A-Fa-f]{1,4})?:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){3}(((:[0-9A-Fa-f]{1,4}){1,4})|((:[0-9A-Fa-f]{1,4}){0,2}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){2}(((:[0-9A-Fa-f]{1,4}){1,5})|((:[0-9A-Fa-f]{1,4}){0,3}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){1}(((:[0-9A-Fa-f]{1,4}){1,6})|((:[0-9A-Fa-f]{1,4}){0,4}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(:(((:[0-9A-Fa-f]{1,4}){1,7})|((:[0-9A-Fa-f]{1,4}){0,5}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:)))(%.+)?)$/
export const HOSTNAME_RE = /^((?=.{1,255}$)(?=.*[A-Za-z].*)[0-9A-Za-z](?:(?:[0-9A-Za-z]|\b-){0,61}[0-9A-Za-z])?(?:\.[0-9A-Za-z](?:(?:[0-9A-Za-z]|\b-){0,61}[0-9A-Za-z])?)*)$/
export const HOSTORIP_RE = /^(((([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5]))|(((([0-9A-Fa-f]{1,4}:){7}([0-9A-Fa-f]{1,4}|:))|(([0-9A-Fa-f]{1,4}:){6}(:[0-9A-Fa-f]{1,4}|((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){5}(((:[0-9A-Fa-f]{1,4}){1,2})|:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){4}(((:[0-9A-Fa-f]{1,4}){1,3})|((:[0-9A-Fa-f]{1,4})?:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){3}(((:[0-9A-Fa-f]{1,4}){1,4})|((:[0-9A-Fa-f]{1,4}){0,2}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){2}(((:[0-9A-Fa-f]{1,4}){1,5})|((:[0-9A-Fa-f]{1,4}){0,3}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){1}(((:[0-9A-Fa-f]{1,4}){1,6})|((:[0-9A-Fa-f]{1,4}){0,4}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(:(((:[0-9A-Fa-f]{1,4}){1,7})|((:[0-9A-Fa-f]{1,4}){0,5}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:)))(%.+)?)|((?=.{1,255}$)(?=.*[A-Za-z].*)[0-9A-Za-z](?:(?:[0-9A-Za-z]|\b-){0,61}[0-9A-Za-z])?(?:\.[0-9A-Za-z](?:(?:[0-9A-Za-z]|\b-){0,61}[0-9A-Za-z])?)*))$/

export const IPV4HOST = { re: IPV4HOST_RE, max: 255, msg: "should be a valid ipv4 network address (eg 192.168.1.1)" } as const
export const IPV6HOST = { re: IPV6HOST_RE, max: 255, msg: "should be a valid ipv6 network address (eg ::11.22.33.44)" } as const
export const HOSTNAME = { re: HOSTNAME_RE, max: 255, msg: "should be a valid hostname having no port, path or http or whatevs" } as const
export const HOSTORIP = { re: HOSTORIP_RE, max: 255, msg: "should be a valid hostname or network address" } as const

export const HttpMethods = ['POST', 'GET', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'] as const
export type HttpMethod = typeof HttpMethods[number]
export type HttpStatusCode = number

// ***********************************************************************
//
// Time Types
//
// // we are doing this by hand so that the file can be shared with the postman contraption
// const oneDayMS       = 1000 * 60 * 60 * 24
// const fiveWeeksishMS = oneDayMS * 7 * 5
// const fiveWeeksAgoTS = Math.round((Date.now() - fiveWeeksishMS ) / (7 * oneDayMS)) * (7 * oneDayMS)
// const fiveWeeksAgo   = new Date(fiveWeeksAgoTS)
//
// these need to be thought through so that old records don't fail validation by the progress of time
export const NEARFUTTC      = { ...TIMECODE,  re: /0(?:1[f-z]|2[0-9])[a-hjkmnpqrstv-z0-9]{24}$/ } // min 01f0000000 (2021 or so) max 029zzzzzzz (2050-07-16)
export const NEARTC         = { ...TIMECODE,  re: /0(?:1[0-z]|2[0-9])[a-hjkmnpqrstv-z0-9]{24}$/ } // min 0100000000 (2004-11-03) max 029zzzzzzz (2050-07-16)
export const NEARPASTTC     = { ...TIMECODE,  re: /0(?:1[0-z]|1[f-z])[a-hjkmnpqrstv-z0-9]{24}$/ } // min 0100000000 (2004-11-03) max 01zzzzzzzz (2040-11-03)
export const NEARFUTTS      = { ...TIMESTAMP, gt: 1641081600000, lt: 2524608000000, max_msg: "should not be improbably ancient or futuristic" } as const
export const NEARTS         = { ...TIMESTAMP, gt: 1104566922512, lt: 2524608000000, max_msg: "should not be improbably ancient or futuristic" } as const
export const NEARPASTTS     = { ...TIMESTAMP, gt: 1104566922512, lt: 2524608000000, max_msg: "should not be that far back in time" } as const
export const NEARFUTYEAR    = { min: 2022, max: 2050 } as const
export const NEARYEAR       = { min: 2005, max: 2050 } as const
export const NEARPASTYEAR   = { min: 2005, max: 2040 } as const
export const MONTHNUM       = { min: 1, max: 12 } as const
export const MONTHDAY       = { min: 1, max: 31 } as const
export const YEAR           = { min: 1800, max: 3000 } as const
//
export const ISODUR         = { max: 40, re: /^P(\d{1,3}(\.\d+)?Y)?(\d{1,4}(\.\d+)?M)?(\d{1,4}(\.\d+)?W)?(\d{1,5}(\.\d+)?D)?(T(?=\d)(\d{1,7}(\.\d+)?H)?(\d{1,8}(\.\d+)?M)?(\d{1,10}(\.\d+)?(\.\d{1,3}(\.\d+)?)?S)?)?$/, msg: "should be a positive ISO Duration string less than about 250 years long" } as const
//
// export const ISOTIME   /**/ = { min: 25, max: 25, re:                    /^-?\d\d\d\d-(0[1-9]|1[012])-(0[1-9]|1\d|2\d|3[01])T[0-5]\d:[0-5]\d:[0-5]\d\.\d\d\dZ/,     msg: "date and time in ISO YYYY-MM-DDThh:mm:ss.uuuZ form" } as const
export const ISOTIME   /**/ = { min: 25, max: 25, re: /(?=(?:^(?:\d\d\d\d-(?:0[1-9]|10|11|12)-(?:0[1-9]|1[0-9]|2[0-8])|\d\d\d\d-(?:0[13-9]|10|11|12)-(?:29|30)|\d\d\d\d-(?:0[13578]|10|12)-31|(?:\d\d[2468][048]|\d\d0[48]|\d\d[13579][26])-02-29|(?:[02468][048]00|[13579][26]00)-02-29)T(?:(?:0[0-9]|1[0-9]|2[0-3]):(?:[0-5][0-9]):(?:[0-5][0-9]))(?:\.\d\d\d)?(?:Z|[\+\-](?:0[0-9]|1[012]):00|\+0[34569]:30|\+10:30|-0[39]:30|\+1[34]:00|\+0[58]:45|\+12:45)$)|^(?:1972|198[1235]|199[2347]|2012|2015)-06-30T23:59:60Z$|^(?:197[2-9]|1987|1989|199[058]|2005|2008|2016)-12-31T23:59:60Z$)(?!.*-00:00$)^(\d\d\d\d)-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)(?:\.(\d\d\d))?((Z)|([\+\-])(\d\d):(\d\d))$/, msg: "should be a date-time in ISO YYYY-MM-DDThh:mm:ss.uuuZ form" } as const
export const ISO       /**/ = ISOTIME
export const ISO_NEARFUT    = { min: 25, max: 25, re:         /^20(2[2-9]|3\d|4\d|50)-(0[1-9]|1[012])-(0[1-9]|1\d|2\d|3[01])T[0-5]\d:[0-5]\d:[0-5]\d\.\d\d\dZ/,     msg: "should be a future date-time in ISO YYYY-MM-DDThh:mm:ss.uuuZ form" } as const
export const ISO_NOWISH     = { min: 25, max: 25, re: /^20(0[5-9]|1\d|2\d|3\d|4\d|50)-(0[1-9]|1[012])-(0[1-9]|1\d|2\d|3[01])T[0-5]\d:[0-5]\d:[0-5]\d\.\d\d\dZ/,     msg: "should be a not-too-far date-time in ISO YYYY-MM-DDThh:mm:ss.uuuZ form" } as const
export const ISO_NEARPAST   = { min: 25, max: 25, re:         /^20(0[5-9]|1\d|2[0-2])-(0[1-9]|1[012])-(0[1-9]|1\d|2\d|3[01])T[0-5]\d:[0-5]\d:[0-5]\d\.\d\d\dZ/,     msg: "should be a recent date-time in ISO YYYY-MM-DDThh:mm:ss.uuuZ form" } as const
export const ISO_YMDHMS     = { min: 20, max: 25, re:                    /^-?\d\d\d\d-(0[1-9]|1[012])-(0[1-9]|1\d|2\d|3[01])T[0-5]\d:[0-5]\d:[0-5]\d(\.\d\d\d)?Z?/, msg: "should be a date-time in ISO YYYY-MM-DDThh:mm:ss form" } as const
export const ISO_YMD        = { min: 10, max: 10, re:                    /^-?\d\d\d\d-(0[1-9]|1[012])-(0[1-9]|1\d|2\d|3[01])/,                                      msg: "should be a date (no time) in ISO YYYY-MM-DD form" } as const
//
// Durations:
// 250 years in nanoseconds just barely fits in a 2^63 (250 * 365.25 * 24 * 3600 * 1e9 / 2**63 = 0.855)
// 250 years in microseconds fits in a safeint (250 * 365.25 * 24 * 3600 * 1e6 / Number.MAX_SAFE_INTEGER = 0.875)
// 125 years in seconds fits in an unsigned 32-bit int
//
export const YEARS          = { min: 0, max:     250 } as const
export const QUARTERS       = { min: 0, max:     600 } as const
export const MONTHS         = { min: 0, max:    2500 } as const
export const WEEKS          = { min: 0, max:    8000 } as const
export const DAYS           = { min: 0, max:   60000 } as const
export const HOURS          = { min: 0, max:     2e6 } as const
export const MINUTES        = { min: 0, max:    12e7 } as const
export const SECONDS        = { min: 0, max:     5e9 } as const
export const MILLIS         = { min: 0, max:    5e12 } as const
//
// Note that there are 1000 milliseconds and 1024 bits ; it is a nanosecond timestamp
//

// ***********************************************************************
//
// Image and Color Types
//
export const HEXCOLOR       = { len: 7, re: /^\#[A-Z0-9]{6}$/ } as const
export const HEX_COLOR      = HEXCOLOR
export const HEXCOLORCODE   = HEXCOLOR
export const IMAGE_PATH     = { max: BIGSTR.max, re: /^(\w+\/)*\w+\.(png|jpg)$/ } as const
export const IMAGEORURL     = {}

// ***********************************************************************
//
// Price Related Types
//
export const CurrencyVals = [
  'AED', 'AFN', 'ALL', 'AMD', 'AOA', 'ARS', 'AUD', 'AWG', 'AZN', 'BAM', 'BBD', 'BDT', 'BGN', 'BHD', 'BIF', 'BMD', 'BND', 'BOB',
  'BRL', 'BSD', 'BTN', 'BWP', 'BYN', 'BZD', 'CAD', 'CDF', 'CHF', 'CLP', 'CNY', 'COP', 'CRC', 'CUP', 'CVE', 'CZK',
  'DJF', 'DKK', 'DOP', 'DZD', 'EGP', 'ERN', 'ETB', 'EUR', 'FJD', 'FKP', 'GBP', 'GEL', 'GHS', 'GIP', 'GMD', 'GNF', 'GTQ', 'GYD', 'HKD', 'HNL',
  'HTG', 'HUF', 'IDR', 'ILS', 'INR', 'IQD', 'IRR', 'ISK', 'JMD', 'JOD', 'JPY', 'KES', 'KGS', 'KHR', 'KMF', 'KPW', 'KRW', 'KWD', 'KYD', 'KZT',
  'LAK', 'LBP', 'LKR', 'LRD', 'LSL', 'LYD', 'MAD', 'MDL', 'MGA', 'MKD', 'MMK', 'MNT', 'MOP', 'MRU', 'MUR', 'MVR', 'MWK', 'MXN', 'MYR',
  'MZN', 'NAD', 'NGN', 'NIO', 'NOK', 'NPR', 'NZD', 'OMR', 'PAB', 'PEN', 'PGK', 'PHP', 'PKR', 'PLN', 'PYG', 'QAR', 'RON', 'RSD', 'RUB', 'RWF',
  'SAR', 'SBD', 'SCR', 'SDG', 'SEK', 'SGD', 'SHP', 'SLE', 'SOS', 'SRD', 'SSP', 'STN', 'SYP', 'SZL', 'THB', 'TJS', 'TMT', 'TND', 'TOP',
  'TRY', 'TTD', 'TWD', 'TZS', 'UAH', 'UGX', 'USD', 'UYU', 'UZS', 'VED', 'VND', 'VUV', 'WST', 'XAF',
  'XCD', 'XCG', 'XOF', 'XPF', 'YER', 'ZAR', 'ZMW', 'ZWG',
  // CKD, CUC, FOK, GGP, HRK, IMP, JEP, KID, SLL, TVD, ZWB, 'ANG',
  // 'CKD', 'FOK', 'CUC', 'GGP', 'IMP', 'JEP', 'KID', 'TVD', 'ZWB', 'ZWL', 'ANG',

] as const
export const SpecialCurrencyCodeVals = [
  'XXX', 'XDR', 'XUA', 'XTS', 'XDR', 'XAD', 'SVC', 'VES', 'XSU',
  'BOV', 'CLF', 'COU', 'MXV', 'USN', 'UYI', 'UYW', 'XAG', 'XAU', 'XBA', 'XBB', 'XBC', 'XBD', 'XPD', 'XPT', 'CHE', 'CHW', 'XUA', 'XXX',
] as const
export const TerritorialCurrencyCodeVals = [
  'CKD', 'FOK', 'GGP', 'IMP', 'JEP', 'KID', 'TVD', 'ZWB',
] as const
export type Currency            = typeof CurrencyVals[number]
export type SpecialCurrencyCode = typeof SpecialCurrencyCodeVals[number]
export type TerritorialCurrencyCode = typeof TerritorialCurrencyCodeVals[number]
export const UBUX           = { min: -1e12, max: 1e12 } as const
export const PRICESTR       = { re: /^-?\$?\d+\.?\d*$/, msg: "numbers, perhaps a dot and more numbers", max: 10 } as const
export const MASKED_NUM     = { ...MEDSTR, re: /^[0-9#\-]*$/, msg: 'should be numbers and ### marks' } as const
export const MONEYISH       = { max: 20, re: /^\$?\s*-?\s*[0-9]+(\.[0-9][0-9])?$/ } as const
export const RoundingModes  = [
  'HALF_ODD', 'HALF_EVEN', 'HALF_UP', 'HALF_DOWN', 'HALF_TOWARDS_ZERO', 'HALF_AWAY_FROM_ZERO', 'DOWN',
] as const

// ***********************************************************************
//
// Tree datastructure types
//
export const TREEPATH      = { max: 2000 } as const
export const TREELVL       = { min: -1, max: 12, positive: true } as const
export const TREECODE      = { max: 24, re: /^([a-hjkmnpqrstv-z0-9][a-hjkmnpqrstv-z0-9])*$/, msg: 'should be a string of crockford-32 number pairs' } as const

// ***********************************************************************
//
// Filepath Types
//

export const FextVals = [
  // Compound fexts should come first
  'jm.json', 'jl.json', 'jp.json', 'kv.json',
  //
  'json', 'jsonnd',
  'js', 'py', 'sh', 'ts', 'sql', 'psql', 'test.js', 'test.ts',
  'tsv', 'csv', 'xlsx',
  'jpg', 'png',
  'docx', 'md', 'pdf', 'txt', 'html',
] as const
export type Fext    = typeof FextVals[number]
export type AnyFext = string

export const AltFextVals = [
  'jpeg', 'markdown', 'jsonl', 'cjs', 'mjs', 'jsx', 'tsx', 'test.js', 'test.ts',
] as const
export type AltFext   = typeof AltFextVals[number]

export const ComprFextVals = ['bz2', 'gz', 'eta'] as const
export type ComprFext = typeof ComprFextVals[number]

export const KnownFextVals = [...FextVals, ...AltFextVals] as const
export type KnownFext = Fext | AltFext

export const Ffmts = [
  'jsmap', 'jsonl', 'jsonpair', 'jsonkv', 'jsonnd', 'json', 'js', 'python', 'shell', 'ts', 'sql',
  'txt', 'tsv', 'csv', 'xlsx', 'jpg', 'png', 'docx', 'md', 'pdf', 'text', 'html',
] as const
export type Ffmt = typeof Ffmts[number]
export const FfmtVals                   = [
  'archive_apk', 'archive_gzip', 'archive_tar', 'archive_zip', 'audio_m4a', 'audio_ogg', 'audio_wav', 'csv', 'data_binary',
  'data_csv', 'data_jsmap', 'data_json', 'data_jsonkv', 'data_jsonl', 'data_jsonnd', 'data_jsonpairs', 'data_xml', 'data_yaml',
  'doc_ai', 'doc_aitplt', 'doc_boxnote', 'doc_doc', 'doc_docx', 'doc_dotx', 'doc_email', 'doc_eps', 'doc_epub', 'doc_gdoc',
  'doc_gpres', 'doc_html', 'doc_indd', 'doc_keynote', 'doc_latex', 'doc_md', 'doc_mhtml', 'doc_nzb', 'doc_odp', 'doc_odt',
  'doc_pages', 'doc_pdf', 'doc_ppt', 'doc_pptx', 'doc_rtf', 'doc_sketch', 'doc_slack', 'doc_text', 'doc_vcard', 'docx', 'image_psd',
  'image_tiff', 'img_bmp', 'img_gdraw', 'img_gif', 'img_jpg', 'img_odg', 'img_odi', 'img_png', 'img_qtz', 'img_svg', 'jpg', 'js',
  'jsmap', 'json', 'jsonkv', 'jsonl', 'jsonnd', 'jsonpair', 'md', 'other', 'pdf', 'png', 'prog_applescript', 'prog_c',
  'prog_cfm', 'prog_clojure', 'prog_coffeescript', 'prog_cpp', 'prog_csharp', 'prog_css', 'prog_d', 'prog_dart', 'prog_diff',
  'prog_dockerfile', 'prog_erlang', 'prog_fortran', 'prog_fsharp', 'prog_go', 'prog_groovy', 'prog_handlebars', 'prog_haskell',
  'prog_haxe', 'prog_java', 'prog_javascript', 'prog_js', 'prog_kotlin', 'prog_lisp', 'prog_lua', 'prog_matlab', 'prog_mumps',
  'prog_objc', 'prog_ocaml', 'prog_pascal', 'prog_perl', 'prog_php', 'prog_pig', 'prog_powershell', 'prog_puppet', 'prog_python',
  'prog_r', 'prog_ruby', 'prog_rust', 'prog_sass', 'prog_scala', 'prog_scheme', 'prog_shell', 'prog_smalltalk', 'prog_sql',
  'prog_swift', 'prog_tf', 'prog_ts', 'prog_vb', 'prog_vbscript', 'prog_velocity', 'prog_verilog', 'python', 'sheet_gsheet',
  'sheet_numbers', 'sheet_ods', 'sheet_tsv', 'sheet_xls', 'sheet_xlsb', 'sheet_xlsm', 'sheet_xlsx', 'sheet_xltx', 'shell',
  'text', 'ts', 'tsv', 'video_fla', 'video_flv', 'video_mkv', 'video_mov', 'video_mp_3', 'video_mp_4', 'video_mpg',
  'video_ogv', 'video_swf', 'video_webm', 'video_wmv', 'xlsx',
] as const

export const FEXT_FOR_FFMT: Record<Ffmt, Fext> = {
  //
  jsmap:        'jm.json',
  jsonkv:       'kv.json',
  jsonl:        'jl.json',
  jsonpair:     'jp.json',
  jsonnd:       'jsonnd',
  json:         'json',
  //
  js:           'js',
  ts:           'ts',
  python:       'py',
  shell:        'sh',
  sql:          'sql',
  //
  txt:          'txt',
  html:         'html',
  //
  tsv:          'tsv',
  csv:          'csv',
  xlsx:         'xlsx',
  //
  jpg:          'jpg',
  png:          'png',
  //
  docx:         'docx',
  md:           'md',
  pdf:          'pdf',
  text:    /**/ 'txt',
} as const satisfies Partial<Record<Ffmt, Fext>>

export const FFMT_FOR_FEXT: Record<Fext | AltFext, Ffmt> = {
  'jm.json':  'jsmap',    //
  'kv.json':  'jsonkv',   //
  'jl.json':  'jsonl',    //
  'jp.json':  'jsonpair', //
  jsonnd:     'jsonnd',   //
  json:       'json',     //
  jsonl:      'json',
  js:         'js',       //
  ts:         'ts',       //
  'test.js':  'js',
  'test.ts':  'ts',
  cjs:        'js',
  mjs:        'js',
  jsx:        'js',
  tsx:        'ts',
  py:         'python',   //
  sh:         'shell',    //
  sql:        'sql',      //
  txt:        'txt',      //
  docx:       'docx',     //
  md:         'md',       //
  markdown:   'md',
  tsv:        'tsv',      //
  csv:        'csv',      //
  xlsx:       'xlsx',     //
  jpg:        'jpg',      //
  jpeg:       'jpg',
  png:        'png',      //
  pdf:        'pdf',      //
  psql:       'sql',
  html:       'html',
} as const satisfies Partial<Record<Fext, Ffmt>> & Record<AltFext, Ffmt>

export const SLASH_OR_PLAIN_RE         =          /^[ 0-9A-Za-z_\-!%^~\.\/]*$/  // omits: "&:;[]\`*?$#'<>{|}()=@,
export const SLASH_OR_GLOB_RE          =          /^[ 0-9A-Za-z_\-!%^~\.\/\{\}\?,\[\]\*]*$/  // omits: "&:;[]\`*?$#'<>{|}()=@,
export const NONSLASH_PLAIN_RE         =          /^[ 0-9A-Za-z_\-!%^~\.]*$/
export const ANYFEXT_RE                =         /(^$|^(\w+\.)*(\w*)$)/
export const JUST_PATHSEGS_PATH_RE     =                        /^(([ 0-9A-Za-z_\-!%^~\.]*\/)*([ 0-9A-Za-z_\-!%^~\.]*))$/
export const JUST_PATHSEGS_GLOB_RE     =          /^(([ 0-9A-Za-z_\-!%^~\.\/\{\}\?,\[\]\*]\/)*([ 0-9A-Za-z_\-!%^~\.\/\{\}\?,\[\]\*]*))$/
export const NONSLASH_GLOB_RE          =          /^[ 0-9A-Za-z_\-!%^~\.\{\}\?,\[\]\*]*$/
export const ROOT_OR_NONSLASH_PLAIN_RE =   /^(?:\/$|[ 0-9A-Za-z_\-!%^~\.]*)$/
export const SLASH_THEN_PLAIN_RE       =        /^\/[ 0-9A-Za-z_\-!%^~\.\/]*$/
export const ANYPATH_RE                =          /^[ 0-9A-Za-z_\-!%^~\.\/]*$/
export const ROOT_OR_NONSLASH_GLOB_RE  =   /^(?:\/$|[ 0-9A-Za-z_\-!%^~\.\{\}\?,\[\]\*]*)$/
export const SLASH_THEN_GLOB_RE        =        /^\/[ 0-9A-Za-z_\-!%^~\.\{\}\?,\[\]\*\/]*$/
export const DOTDOT_OR_DOT_THEN_SLASH_PLAIN_RE = /^\.\.?\/[\x20-\x7e]*$/
export const DOTDOT_OR_DOT_THEN_SLASH_GLOB_RE  = DOTDOT_OR_DOT_THEN_SLASH_PLAIN_RE

export const ANYGLOB_RE                 =          /^[ 0-9A-Za-z_\-!%^~\.\{\}\?,\[\]\*\/]*$/
export const ABSPATH_RE                 = SLASH_THEN_PLAIN_RE
export const ABSGLOB_RE                 = SLASH_THEN_GLOB_RE
export const DOTS_SLASH_ONLYFORREADS_RE = /^(?:\.\.?|\.?\.?\/[\x20-\x7e]*)$/
export const DOTS_SLASH_PLAIN_RE        = /^(?:\.\.?|\.?\.?\/[ 0-9A-Za-z_\-!%^~\.\{\}\?,\[\]\*\/]*)$/
export const DOTS_SLASH_GLOB_RE         = DOTS_SLASH_PLAIN_RE
//
export const KNOWN_FEXT_RE_STR_BASE = KnownFextVals.join('|').replaceAll('.', '\\.')
export const COMPR_FEXT_RE_STR      = ComprFextVals.join('|').replaceAll('.', '\\.')
export const ANY_FEXT_RE_STR_BASE   = '[a-zA-Z0-9]+?'
export const COMPR_FEXT_RE          = new RegExp(COMPR_FEXT_RE_STR + '$')
export const KNOWN_FEXT_RE          =          new RegExp(`(?:(((${KNOWN_FEXT_RE_STR_BASE                        }))(?:\\.(${COMPR_FEXT_RE_STR}))?))$`)
export const ANY_FEXT_RE            =          new RegExp(`(?:(((${KNOWN_FEXT_RE_STR_BASE})|${ANY_FEXT_RE_STR_BASE})(?:\\.(${COMPR_FEXT_RE_STR}))?))$`)
export const PARSE_KNOWNFEXT_RE     = new RegExp(`^(.+?)(?:\\.(((${KNOWN_FEXT_RE_STR_BASE                        }))(?:\\.(${COMPR_FEXT_RE_STR}))?))$`, 'i')
export const PARSE_OTHERFEXT_RE     = new RegExp(`^(.+?)(?:\\.((()${                          ANY_FEXT_RE_STR_BASE})(?:\\.(${COMPR_FEXT_RE_STR}))?))$`, 'i')
export const PARSE_NOFEXT_RE        = /^(\.?[^\.]+?|.*\.)$/
//
// export const ANY_FEXT_RE_STR_BASE   = '[a-zA-Z0-9]+?'
// export const KNOWN_FEXT_RE_STR_BASE = '('       + KnownFextVals.join('|').replaceAll('.', '\\.') + ')'
// export const COMPR_FEXT_RE_STR      = '(?:\\.(' + ComprFextVals.join('|').replaceAll('.', '\\.') + '))'
// export const KNOWN_FEXT_RE          = new RegExp(`(?:\\.((${KNOWN_FEXT_RE_STR_BASE}(?:                ){0})${COMPR_FEXT_RE_STR}?))$`)
// export const ANY_FEXT_RE            = new RegExp(`(?:\\.((${KNOWN_FEXT_RE_STR_BASE}|${ANY_FEXT_RE_STR_BASE})${COMPR_FEXT_RE_STR}?))$`)
// export const PARSE_KNOWNFEXT_RE     = new RegExp(`^(.+?)(?:\\.((${KNOWN_FEXT_RE_STR_BASE})${COMPR_FEXT_RE_STR}?))$`, 'i')
// export const PARSE_OTHERFEXT_RE     = new RegExp(`^(.+?)(?:\\.((()${ANY_FEXT_RE_STR_BASE})${COMPR_FEXT_RE_STR}?))$`, 'i')
// export const PARSE_NOFEXT_RE        = /^(\.?[^\.]+?|.*\.)$/
//
export const RELGLOB        = { re: DOTS_SLASH_GLOB_RE,        msg: 'should have plain or pattern characters' } as const
export const ANYGLOB        = { re: ANYGLOB_RE,                msg: 'should have plain or pattern characters' } as const
export const ABSGLOB        = { re: ABSGLOB_RE,                msg: 'should have plain or pattern characters and start from the root folder' } as const
export const BAREGLOB       = { re: ROOT_OR_NONSLASH_GLOB_RE,  msg: 'should have plain or pattern characters with no slashes' } as const
export const BASEGLOB       = { ...BAREGLOB } as const
export const GLOBSEG        = { re: NONSLASH_GLOB_RE,          msg: 'should be plain or pattern characters with no slashes' } as const
export const EXTGLOB        = { re: NONSLASH_GLOB_RE,          msg: 'should be plain or pattern characters with no slashes' } as const
export const GLOBSEGS       = { re: JUST_PATHSEGS_GLOB_RE,     msg: 'should have plain characters and no start or end slash' } as const
//
export const RELPATH        = { re: DOTS_SLASH_PLAIN_RE,       msg: 'should be a relative path' } as const
export const ANYFEXT        = { re: ANYFEXT_RE,                msg: 'should be a file extension with only plain characters and maybe a dot' } as const
export const ANYPATH        = { re: ANYPATH_RE,                msg: 'should be a relative path' } as const
export const ABSPATH        = { re: ABSPATH_RE,                msg: 'should be a pathname from the root folder' } as const
export const BARENAME       = { re: ROOT_OR_NONSLASH_PLAIN_RE, msg: 'should have plain characters with no slashes' } as const
export const BASENAME       = { ...BARENAME } as const
export const PATHSEG        = { re: NONSLASH_PLAIN_RE,         msg: 'should have plain characters with no slashes' } as const
export const EXTNAME        = { re: NONSLASH_PLAIN_RE,         msg: 'should have plain characters with no slashes' } as const
export const PATHSEGS       = { re: JUST_PATHSEGS_PATH_RE,     msg: 'should have plain characters and no start or end slash' } as const
//
export const FEXT_REGEXES: Record<Ffmt, RegExp> = {
  jsmap:        /\.(jm\.json)$/i,
  jsonkv:       /\.(kv\.json)$/i,
  jsonl:        /\.(jl\.json|jsonl)$/i,
  jsonpair:     /\.(jp\.json)$/i,
  json:         /\.(json)$/i,
  jsonnd:       /\.(jsonn?d)$/i,
  //
  tsv:          /\.(tsv)$/i,
  csv:          /\.(csv)$/i,
  xlsx:         /\.(xlsx)$/i,
  //
  js:           /\.(jsx?)$/i,
  python:       /\.(py)$/i,
  shell:        /\.(sh|bash)$/i,
  ts:           /\.(tsx?)$/i,
  sql:          /\.(sql)$/i,
  //
  txt:          /\.(txt)$/i,
  //
  jpg:          /\.(jpg|jpeg)$/i,
  png:          /\.(png)$/i,
  //
  docx:         /\.(txt)$/i,
  md:           /\.(md|markdown)$/i,
  pdf:          /\.(pdf)$/i,
  text:         /\.(txt)$/i,
  html:         /\.(html)$/i,
} as const satisfies Partial<Record<Ffmt, RegExp>>


export const WriterStrategies = [...Ffmts, 'tsvpick', 'base'] as const
export type WriterStrategy = typeof WriterStrategies[number]

// **********************************************************************
//
// Logging
//

export const LogStrategyVals  = ['local', 'script', 'deployed', 'request', 'err'] as const
export type  LogStrategy    = typeof LogStrategyVals[number]

export const LoglevelVals     = ['trace', 'debug', 'info', 'notice', 'warn', 'error', 'crit', 'emerg'] as const
export const ExtdLoglevelVals = [...LoglevelVals, 'alert', 'warning'] as const
export const LoglevelsSet     = new Set(ExtdLoglevelVals)
export type  Loglevel         = typeof LoglevelVals[number]
export type  BasicLoglevel    = 'debug' | 'info' | 'warn' | 'error'
export const LoglevelNums     = {
  emerg:        0,
  crit:         2,
  error:        3,
  warn:         4,
  notice:       5,
  info:         6,
  debug:        7,
  trace:        8,
} as const satisfies Record<typeof LoglevelVals[number], number>
export const ExtdLoglevelNums: Record<typeof ExtdLoglevelVals[number], number> = {
  ...LoglevelNums,
  alert:        1,
  warning:      4,
} as const satisfies Record<typeof ExtdLoglevelVals[number], number>


export const BecameVals        = ['absent', 'present', 'unknown', 'partial', 'final'] as const
export type  BecameT           = typeof BecameVals[number]
export const BeforeVals        = ['absent', 'present', 'unknown', 'partial', 'final'] as const
export type  BeforeT           = typeof BeforeVals[number]