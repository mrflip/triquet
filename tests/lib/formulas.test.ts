import { describe, expect, it } from 'vitest'
import * as Formulas from '../../src/lib/formulas'

describe('Formulas.evaluate', () => {
  const Cases: [string, Record<string, unknown>, unknown, string][] = [
    // regular usage:
    ["a + 1",                                    { a: 2 },                          3,           'arithmetic on a field'],
    ["$sum(x.v)",                                { x: [{ v: 1 }, { v: 2 }] },       3,           'a sum down a list of objects'],
    ["$join($reverse($split(word, '')))",        { word: 'stressed' },              'desserts',  'the letters of a word reversed'],
    ["qns[label = $$.qn.chains_to].title",       { qns: [{ label: 'aa', title: 'Alpha' }, { label: 'bb', title: 'Beta' }], qn: { chains_to: 'bb' } }, 'Beta', 'a lookup by label through the root'],
    ["{ 'value': 4, 'stale': true }",            {},                                { value: 4, stale: true }, 'an object comes back as an object'],
    // trivial cases:
    ["nope.nada",                                {},                                undefined,   'a path that leads nowhere finds nothing'],
    ["a ? 1",                                    { a: false },                      undefined,   'a condition with no else finds nothing'],
    ["$sum(x)",                                  {},                                undefined,   'summing nothing at all is nothing, not nought'],
    ["$sum($append([0], x.v))",                  {},                                0,           'summing nothing plus a zero is nought'],
  ]
  for (const [formula, bag, expected, describes] of Cases) {
    it(describes, () => {
      const outcome = Formulas.evaluate(formula, bag)
      expect(outcome).to.deep.eq({ ok: true, val: expected })
    })
  }

  it('reports a formula that does not parse as a syntax failure, saying where', () => {
    const outcome = Formulas.evaluate('$sum(', {})
    expect(outcome.ok).to.be.false
    if (outcome.ok) { return }
    expect(outcome.failkind).to.eq('syntax')
    expect(outcome.message).to.match(/at \d+/)
  })

  it('reports a formula that errors as it runs as a runtime failure', () => {
    const outcome = Formulas.evaluate('"a" + 1', {})
    expect(outcome.ok).to.be.false
    if (outcome.ok) { return }
    expect(outcome.failkind).to.eq('runtime')
  })

  it('stops a formula that would never end, and says so', () => {
    const beganAt = Date.now()
    const outcome = Formulas.evaluate('( $spin := function() { $spin() }; $spin() )', {})
    expect(outcome.ok).to.be.false
    if (outcome.ok) { return }
    expect(outcome.failkind).to.eq('timeout')
    expect(Date.now() - beganAt).to.be.lessThan(2000)
  })

  it('stops a formula that recurses without end past the depth it allows', () => {
    const outcome = Formulas.evaluate('( $dive := function($nn) { 1 + $dive($nn + 1) }; $dive(0) )', {})
    expect(outcome.ok).to.be.false
    if (outcome.ok) { return }
    expect(outcome.failkind).to.be.oneOf(['timeout', 'runtime'])
  })

  it('gives a formula a fresh clock every time it is run', () => {
    const slowish = '( $count := function($nn) { $nn > 300 ? $nn : $count($nn + 1) }; $count(0) )'
    const outcomes = [1, 2, 3].map(() => Formulas.evaluate(slowish, {}))
    expect(outcomes).to.deep.eq(Array.from({ length: 3 }, () => ({ ok: true, val: 301 })))
  })

  it('does not change the bag it reads', () => {
    const bag = { xs: [3, 1, 2] }
    Formulas.evaluate('$sort(xs)', bag)
    expect(bag.xs).to.deep.eq([3, 1, 2])
  })
})

describe('Formulas.check', () => {
  it('is null for a formula that parses', () => {
    expect(Formulas.check('$sum(qn.clueing_ishes.items.value)')).to.be.null
  })

  it('is null for a formula that would fail at runtime, because parsing is all it judges', () => {
    expect(Formulas.check('"a" + 1')).to.be.null
  })

  it('names the trouble with a formula that does not parse', () => {
    expect(Formulas.check('$sum(')).to.be.a('string').and.not.eq('')
  })

  it('remembers formulas without growing forever', () => {
    const formulas = Array.from({ length: 500 }, (_val, kk) => `${String(kk)} + 1`)
    expect(formulas.map((formula) => Formulas.check(formula))).to.deep.eq(formulas.map(() => null))
    expect(Formulas.check('1 + 1')).to.be.null
  })
})
