import { str } from '../kit'
import * as PA from '../patterns'

//
// == [Character sets] == what a string may contain, before any question of length
//

/** Neither begins nor ends with a space or control character */
export const trimpolice   = str.regex(PA.Trimmed.re, PA.Trimmed.msg)
/** Prose exactly as written: any character but a control character, tab and newline allowed, never trimmed */
export const textish      = str.regex(PA.Textish.re, PA.Textish.msg).max(PA.Textish.max).describe('text')
/** Any character but a control character, newlines included */
export const stringish    = str.regex(PA.Stringish.re, PA.Stringish.msg).describe('standard characters')
/** Printable ASCII only */
export const asciish      = str.trim().regex(PA.Asciish.re, PA.Asciish.msg).describe('single-line visible characters')
/** Trimmed, and free of control characters -- the base every length below is built on */
export const trimmed      = str.trim().regex(PA.Stringish.re, PA.Stringish.msg).describe('trimmed text')

export const lower        = str.trim().regex(PA.Lower.re, PA.Lower.msg).describe('plain lowercase')
export const upper        = str.trim().regex(PA.Upper.re, PA.Upper.msg).describe('all uppercase')

export const alnum        = str.trim().regex(PA.Alnum.re, PA.Alnum.msg).describe('letters/numbers')
export const alnumbar     = str.trim().regex(PA.Alnumbar.re, PA.Alnumbar.msg).describe('letters/numbers/_')
export const azalnum      = str.trim().regex(PA.Azalnum.re, PA.Azalnum.msg).describe('letters/numbers, letter first')
export const azalnumbar   = str.trim().regex(PA.Azalnumbar.re, PA.Azalnumbar.msg).describe('letters/numbers/_, letter first')
export const upazalnum    = str.trim().regex(PA.Upazalnum.re, PA.Upazalnum.msg).describe('LETTERS/numbers, letter first')
export const loazalnumbar = str.trim().regex(PA.Loazalnumbar.re, PA.Loazalnumbar.msg).describe('lowercase letters/numbers/_')
export const upazalnumbar = str.trim().regex(PA.Upazalnumbar.re, PA.Upazalnumbar.msg).describe('LETTERS/numbers/_')
export const loalnumbar   = str.trim().toLowerCase().regex(PA.Loalnumbar.re, PA.Loalnumbar.msg).describe('lowercase letters/numbers/_')
export const upalnumbar   = str.trim().toUpperCase().regex(PA.Upalnumbar.re, PA.Upalnumbar.msg).describe('LETTERS/numbers/_')
export const plain        = str.trim().regex(PA.Plain.re, PA.Plain.msg).describe('plain letters/numbers')

//
// == [Lengths] == how much text, with the character set already settled
//

export const shortstr = trimmed.max(PA.Shortstr.max).describe('short text')
export const medstr   = trimmed.max(PA.Medstr.max).describe('medium text')
export const fullstr  = trimmed.max(PA.Fullstr.max).describe('full-width text')
export const bigstr   = trimmed.max(PA.Bigstr.max).describe('long text')
export const titleish = trimmed.max(PA.Titleish.max).describe('title')
/** Prose as `textish` takes it, but trimmed: surrounding space in a note is never the point */
export const noteish  = str.trim().regex(PA.Noteish.re, PA.Noteish.msg).max(PA.Noteish.max).describe('note')
/** A formula as written: newlines welcome for laying it out, never trimmed, and never empty */
export const formulaish = str.regex(PA.Formulaish.re, PA.Formulaish.msg).min(1).max(PA.Formulaish.max).describe('formula')
/** As much text as anyone should paste in one go; past this it is a file, not a field */
export const blobbish = str.regex(PA.Textish.re, PA.Textish.msg).max(PA.Blobbish.max).describe('blob of text')

//
// == [Identifiers] == names a machine reads
//

/** Shaped as a label, whatever the word: what a label typed is cleaned up against before anyone asks whether it may be used */
export const labelshape = lower.min(PA.Label.min).max(PA.Label.max).regex(PA.Label.re, PA.Label.msg).describe('label-shaped text')
/**
 * A label: label-shaped, and none of the words the tool keeps for its own use (`PA.ReservedLabels`).
 * The reservation is a refinement rather than a second pattern, so a template built from a label
 * (`column:<label>`) still reads the label's shape as its pattern.
 */
export const label     = labelshape.refine((val) => PA.Unreserved.re.test(val), PA.Unreserved.msg).describe('simple label')
export const identlabel = lower.min(PA.Identlabel.min).max(PA.Identlabel.max).regex(PA.Identlabel.re, PA.Identlabel.msg).describe('ident label')
export const dashlabel = lower.min(PA.Dashlabel.min).max(PA.Dashlabel.max).regex(PA.Dashlabel.re, PA.Dashlabel.msg).describe('dash-separated label')
export const handleish = lower.min(PA.Handleish.min).max(PA.Handleish.max).regex(PA.Handleish.re, PA.Handleish.msg).describe('record handle')
export const keyish    = trimmed.min(PA.Keyish.min).max(PA.Keyish.max).regex(PA.Keyish.re, PA.Keyish.msg).describe('freeform key')
export const camel     = str.trim().min(2).regex(PA.Camel.re, PA.Camel.msg).describe('CamelCased name')
export const locamel   = str.trim().min(2).regex(PA.Locamel.re, PA.Locamel.msg).describe('lowerCamelCased name')
export const varname   = str.trim().min(1).regex(PA.Varname.re, PA.Varname.msg).describe('variable name')
export const snake     = str.trim().min(1).regex(PA.Snake.re, PA.Snake.msg).describe('underbar_cased name')
export const convexid  = str.regex(PA.Convexid.re, PA.Convexid.msg).describe('document id')
