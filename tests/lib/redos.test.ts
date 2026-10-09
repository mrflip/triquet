import { globSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import * as Redos from '../../src/lib/redos'

const regexOf = (source: string, flags = '') => ({ source, flags })

describe('Redos.refusalOf', () => {
  it("finds nothing wrong with a pattern whose time grows no faster than the text, per the doc example", () => {
    expect(Redos.refusalOf(regexOf('^[a-z]+$'))).to.be.null
  })

  const Safe: [string, string, string][] = [
    ['^[A-Z]{3}$',                                 '',  'a fixed count of a class'],
    [String.raw`^([a-z0-9_.-]+)@([a-z0-9.-]+)\.([a-z]{2,6})$`, '',  'an address, its parts apart'],
    ['^(?:[A-Z][a-z]+ )*[A-Z][a-z]+$',            '',  'words, each starting a new way'],
    [String.raw`^\p{Lu}\p{Ll}+$`,                          'u', 'a Unicode property'],
    [String.raw`^(\w+)\s\1$`,                             '',  'a word said twice, by a backreference'],
  ]
  for (const [source, flags, describes] of Safe) {
    it(`takes ${describes}`, () => {
      expect(Redos.refusalOf(regexOf(source, flags))).to.be.null
    })
  }

  const Vulnerable: [string, string, string][] = [
    ['^(a+)+$',      'twice as long for each character more', 'a repeat of a repeat'],
    ['^(a|a)*$',     'twice as long for each character more', 'a repeat of two ways to match the same'],
    [String.raw`(\w+\s?)*$`, 'twice as long for each character more', 'a repeat of what may match nothing between words'],
    ['^.*a.*a.*$',   'as the square of its length, or worse', 'runs of anything around the same letter'],
  ]
  for (const [source, growth, describes] of Vulnerable) {
    it(`refuses ${describes}, saying how its time grows and where`, () => {
      const refusal = Redos.refusalOf(regexOf(source))
      expect(refusal).to.contain(`could take far too long to match some texts (${growth})`)
      expect(refusal).to.contain('let no part of it match the same text in more than one way')
    })
  }

  it("says where a vulnerable pattern's trouble lies", () => {
    expect(Redos.refusalOf(regexOf('^x(a+)+$'))).to.contain('around «')
  })

  it("refuses a pattern it cannot settle in the time it has", () => {
    expect(Redos.refusalOf(regexOf(String.raw`^(a+)\1$`), 20)).to.eq('took too long to check for safety: make it simpler')
  })
})

describe('Redos.firstRefusalOf', () => {
  it("finds nothing wrong with safe patterns, and names the first refused, per the doc examples", () => {
    expect(Redos.firstRefusalOf([regexOf('^[a-z]+$')])).to.be.null
    expect(Redos.firstRefusalOf([regexOf('^[a-z]+$'), regexOf('(x+x+)+y'), regexOf('^(a+)+$')])).to.match(/^The pattern «\/\(x\+x\+\)\+y\/» could take far too long/)
  })

  it("finds nothing wrong with no patterns at all", () => {
    expect(Redos.firstRefusalOf([])).to.be.null
  })

  it("refuses what is left once its budget is spent, without checking it", () => {
    expect(Redos.firstRefusalOf([regexOf('^[a-z]+$')], 0)).to.eq('The pattern «/^[a-z]+$/» could not be checked in the time left: send fewer new patterns at once.')
  })

  it("gives a check no more than the budget has left, though one check alone may take longer", () => {
    const beg = performance.now()
    expect(Redos.firstRefusalOf([regexOf(String.raw`^(a+)\1$`)], 10)).to.contain('took too long to check for safety')
    expect(performance.now() - beg).to.be.below(Redos.CheckMs)
  })

  it("checks a pattern named twice once", () => {
    expect(Redos.firstRefusalOf([regexOf('^[a-z]+$'), regexOf('^[a-z]+$')])).to.be.null
  })
})

describe("recheck's importers", () => {
  /** Every source file of the app and its server, with what it holds */
  const sources = globSync('{src,convex}/**/*.{ts,tsx}', { exclude: ['convex/_generated/**'] }).map((path) => ({ path, text: readFileSync(path, 'utf8') }))
  /** The files that import `modulename` as a statement, read when their module is */
  const importersOf = (modulename: RegExp) => sources.filter(({ text }) => new RegExp(String.raw`^import [^;\n]* from '${modulename.source}'`, 'mu').test(text)).map(({ path }) => path)

  it("is this module alone, so the one build of recheck is the one every caller asks", () => {
    expect(importersOf(/recheck[^']*/u)).to.deep.eq(['src/lib/redos.ts'])
  })

  it("is never imported by the browser's own code as a statement, which would put recheck's 3 MB in every page; only by import()", () => {
    expect(importersOf(/\.{1,2}(?:\/\.\.)*\/lib\/redos/u).filter((path) => /^src\/(?:components|state|app)\//u.test(path))).to.deep.eq([])
  })
})
