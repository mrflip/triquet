import { describe, expect, it } from 'vitest'
import * as Regexes from '../../src/lib/regexes'

describe('Regexes.compileIssueOf', () => {
  it("says why a pattern will not compile, and nothing of one that does, per the doc examples", () => {
    expect(Regexes.compileIssueOf({ source: '(a', flags: '' })).to.eq('will not compile: Unterminated group')
    expect(Regexes.compileIssueOf({ source: '^a+$', flags: 'i' })).to.be.null
  })

  it("reads the pattern as its flags say: an escape Unicode mode knows nothing of will not do in it", () => {
    expect(Regexes.compileIssueOf({ source: String.raw`^\p{Lu}`, flags: 'u' })).to.be.null
    expect(Regexes.compileIssueOf({ source: String.raw`\-`, flags: 'u' })).to.eq('will not compile: Invalid escape')
    expect(Regexes.compileIssueOf({ source: String.raw`\-`, flags: '' })).to.be.null
  })
})

describe('Regexes.compiled', () => {
  it("is the pattern compiled with its flags, per the doc example", () => {
    expect(Regexes.compiled({ source: '^a+$', flags: 'i' }).test('AA')).to.be.true
  })

  it("compiles a pattern once, however often it is asked for", () => {
    expect(Regexes.compiled({ source: '^b+$', flags: '' })).to.eq(Regexes.compiled({ source: '^b+$', flags: '' }))
    expect(Regexes.compiled({ source: '^b+$', flags: 'i' })).not.to.eq(Regexes.compiled({ source: '^b+$', flags: '' }))
  })

  it("checks the same text the same way each time: no flag makes it remember where it last matched", () => {
    const regex = Regexes.compiled({ source: 'otter', flags: 'i' })
    expect([regex.test('Otter'), regex.test('Otter')]).to.deep.eq([true, true])
  })
})

describe('Regexes.shown', () => {
  it("writes a pattern as JavaScript does, per the doc example", () => {
    expect(Regexes.shown({ source: '^a+$', flags: 'i' })).to.eq('/^a+$/i')
    expect(Regexes.shown({ source: 'a/b', flags: '' })).to.eq('/a/b/')
  })
})

describe('Regexes.toggled', () => {
  it("turns a flag on or off, keeping the flags in their order, per the doc examples", () => {
    expect(Regexes.toggled('is', 'm')).to.eq('ims')
    expect(Regexes.toggled('ims', 'i')).to.eq('ms')
    expect(Regexes.toggled('', 'u')).to.eq('u')
  })

  it("keeps the flags as a stored pattern holds them", () => {
    const flags = Regexes.toggled(Regexes.toggled('u', 'i'), 's')
    expect([flags, Regexes.FlagsRe.test(flags)]).to.deep.eq(['isu', true])
  })
})
