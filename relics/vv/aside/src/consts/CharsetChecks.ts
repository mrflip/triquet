import { str }                            from '../checks/BootChecks.ts'
import * as CO                            from './internal.ts'

//
export type ZRefining = Parameters<typeof str["refine"]>
export const trimpolice     = str.regex(CO.TRIMMED.re,             CO.TRIMMED.msg)
const lower                 = str.trim().regex(CO.LOWER.re,        CO.LOWER.msg)
export const upper          = str.trim().regex(CO.UPPER.re,        CO.UPPER.msg).describe('all uppercase')
export const alnum          = str.trim().regex(CO.ALNUMBAR.re,     CO.ALNUMBAR.msg).describe('Letters/Numbers')
export const alnumbar       = str.trim().regex(CO.ALNUMBAR.re,     CO.ALNUMBAR.msg).describe('Letters/Numbers/_')
export const azalnum        = str.trim().regex(CO.AZALNUM.re,      CO.AZALNUM.msg).describe('Letters/numbers with a letter first')
export const upazalnum      = str.trim().regex(CO.UPAZALNUM.re,    CO.UPAZALNUM.msg).describe('LETTERS/numbers with a letter first')
export const azalnumbar     = str.trim().regex(CO.AZALNUMBAR.re,   CO.AZALNUMBAR.msg).describe('Letters/Numbers/_')
export const loazalnumbar   = str.trim().regex(CO.LOAZALNUMBAR.re, CO.LOAZALNUMBAR.msg).describe('lowercase letters/numbers/_')
export const upazalnumbar   = str.trim().regex(CO.UPAZALNUMBAR.re, CO.UPAZALNUMBAR.msg).describe('LETTERS/numbers/_')
export const loalnumbar     = str.trim().toLowerCase().regex(CO.ALNUMBAR.re,   CO.ALNUMBAR.msg).describe('lowercase letters/numbers')
export const upalnumbar     = str.trim().toUpperCase().regex(CO.UPALNUMBAR.re, CO.UPALNUMBAR.msg).describe('uppercase letters/numbers')
export const plain          = str.trim().regex(CO.PLAIN.re,        CO.PLAIN.msg).describe('plain letters/numbers')
export const asciish        = str.trim().regex(CO.ASCIISH.re,      CO.ASCIISH.msg).describe('single-line visible characters')
export const stringish      = str.regex(CO.STRINGISH.re,          CO.STRINGISH.msg).describe('standard characters')
//
export const label          = lower.min(1).max(CO.LABEL.max).regex(CO.LABEL.re, CO.LABEL.msg).describe('simple label')
export const dashlabel      = lower.min(1).max(CO.DASHLABEL.max).regex(CO.DASHLABEL.re, CO.DASHLABEL.msg).describe('simple dash-separated label')
export const handleish      = lower.min(1).max(CO.HANDLEISH.max).regex(CO.HANDLEISH.re, CO.HANDLEISH.msg).describe('record handle')
//
