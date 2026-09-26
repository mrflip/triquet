import { describe, expect, it } from 'vitest'
import * as UU from '../../src/lib/useful'
import { Uninspectable, inspectify } from '../../src/lib/inspectify'
import { runInspect as browserInspect } from '../../src/lib/inspectify-browser'
import { runInspect as nodeInspect } from '../../src/lib/inspectify-node'

// Vitest resolves `#inspect-env` to the node half, so `inspectify` alone would never exercise
// the browser formatter. Running the table through both is what keeps the two in agreement.
const Renderers = { node: nodeInspect, browser: browserInspect }

describe('inspectify', () => {
  const Cases: [unknown, string, string][] = [
    // scalars:
    ['hi',                        "'hi'",                       'a string comes back quoted, so blank and spacey values are visible'],
    ['',                          "''",                         'the empty string is distinguishable from a missing one'],
    [42,                          '42',                         'a number prints plainly'],
    [-0,                          '-0',                         'negative zero keeps its sign, which JSON drops'],
    [NaN,                         'NaN',                        'NaN survives, where JSON would call it null'],
    [Infinity,                    'Infinity',                   'infinities survive, where JSON would call them null'],
    [true,                        'true',                       'a boolean prints plainly'],
    [null,                        'null',                       'null is null'],
    [undefined,                   'undefined',                  'undefined says so rather than vanishing'],
    [10n,                         '10n',                        'a bigint keeps its suffix, where JSON would throw'],
    // the point of the exercise -- what a JSON dump swallows:
    [{ aa: undefined },           '{ aa: undefined }',          'a property set to undefined is shown, not dropped'],
    [{ aa: 1, bb: undefined },    '{ aa: 1, bb: undefined }',   'an undefined property among real ones is still shown'],
    // containers:
    [[],                          '[]',                         'an empty array is compact'],
    [[1, 2],                      '[ 1, 2 ]',                   'array items are spaced inside the brackets'],
    [[1, [2, [3]]],               '[ 1, [ 2, [ 3 ] ] ]',        'nesting within the depth budget is followed'],
    [{},                          '{}',                         'an empty object is compact'],
    [{ aa: 1 },                   '{ aa: 1 }',                  'an object is spaced inside the braces'],
    [{ 'not-ident': 1 },          "{ 'not-ident': 1 }",         'a key that is not an identifier gets quoted'],
    [new Set([1, 2]),             'Set(2) { 1, 2 }',            'a Set reports its size, where JSON would emit {}'],
    [new Set(),                   'Set(0) {}',                  'an empty Set still reports its size'],
    [new Map([['aa', 1]]),        "Map(1) { 'aa' => 1 }",       'a Map shows its pairs, where JSON would emit {}'],
    // things with a one-line spelling:
    [new Date('2022-05-04T00:00:00Z'), '2022-05-04T00:00:00.000Z', 'a date prints as its ISO form, unquoted'],
    [/ab+c/gi,                    '/ab+c/gi',                   'a regexp prints as a literal, where JSON would emit {}'],
    // strings that would otherwise wreck the line they land in:
    ['a\nb',                      String.raw`'a\nb'`,           'a newline inside a string is escaped, not emitted raw'],
    ['ab',                  String.raw`'a\x01b'`,         'an unnameable control character becomes a hex escape'],
    ["it's",                      `"it's"`,                     'a string containing a quote switches to the other quote'],
  ]

  for (const [rendererkind, render] of Object.entries(Renderers)) {
    describe(`rendered by the ${rendererkind} half`, () => {
      for (const [val, wanted, blurb] of Cases) {
        it(blurb, () => { expect(render(val)).to.eq(wanted) })
      }

      it('names a function rather than dropping it', () => {
        expect(render(function greet() { /* noop */ })).to.eq('[Function: greet]')
        expect(render(() => 1)).to.match(/^\[Function/)
      })

      it('names the class of an instance', () => {
        class Lightbulb { lumens = 40 }
        expect(render(new Lightbulb())).to.eq('Lightbulb { lumens: 40 }')
      })

      it('reports a cycle instead of chasing it', () => {
        const looped: Record<string, unknown> = { aa: 1 }
        looped.self = looped
        expect(render(looped)).to.match(/Circular/)
      })

      describe('depth', () => {
        const deep = { aa: { bb: { cc: { dd: { ee: { ff: 1 } } } } } }
        it('elides below the default budget rather than running away', () => {
          expect(render(deep)).to.eq('{ aa: { bb: { cc: { dd: { ee: [Object] } } } } }')
        })
        it('takes a shallower budget', () => {
          expect(render(deep, { depth: 1 })).to.eq('{ aa: { bb: [Object] } }')
        })
        it('descends the whole way when asked', () => {
          expect(render(deep, { depth: null })).to.eq('{ aa: { bb: { cc: { dd: { ee: { ff: 1 } } } } } }')
        })
        it('elides an array as an array', () => {
          expect(render({ aa: { bb: [1] } }, { depth: 1 })).to.eq('{ aa: { bb: [Array] } }')
        })
      })
    })
  }

  describe('maxlen', () => {
    it('clamps and marks the cut', () => {
      expect(inspectify({ aa: 'wordy' }, { maxlen: 10 })).to.eq("{ aa: 'wo…")
    })
    it('leaves a value that already fits alone', () => {
      expect(inspectify({ aa: 1 }, { maxlen: 400 })).to.eq('{ aa: 1 }')
    })
    it('honours a clamp of exactly the rendered length', () => {
      expect(inspectify('hi', { maxlen: 4 })).to.eq("'hi'")
    })
    it('survives an absurd clamp', () => {
      expect(inspectify('hi', { maxlen: 0 })).to.eq('')
      expect(inspectify('hi', { maxlen: 1 })).to.eq('…')
    })
  })

  describe('never throws', () => {
    it('reports a property whose getter explodes', () => {
      const booby = { get boom(): never { throw new Error('nope') } }
      expect(inspectify(booby)).to.be.a('string').and.match(/boom/)
    })
    it('survives an object with no prototype at all', () => {
      const bare = Object.create(null) as object
      expect(() => inspectify(bare)).to.not.throw()
      expect(inspectify(bare)).to.be.a('string')
    })
    it('survives a proxy that throws on every trap', () => {
      const trapped = new Proxy({}, {
        get()     { throw new Error('nope') },
        ownKeys() { throw new Error('nope') },
      })
      expect(() => inspectify(trapped)).to.not.throw()
      expect(inspectify(trapped)).to.be.a('string')
    })
    it('falls all the way back rather than surfacing a formatter failure', () => {
      // Defeats the formatter, stable JSON and String() alike.
      const unstringifiable = new Proxy({}, {
        get()     { throw new Error('nope') },
        ownKeys() { throw new Error('nope') },
        has()     { throw new Error('nope') },
      })
      expect([Uninspectable, '{}']).to.include(inspectify(unstringifiable))
    })
    it('the browser half alone also refuses to take a dump down', () => {
      const booby = { get boom(): never { throw new Error('nope') } }
      expect(browserInspect(booby)).to.match(/unreadable/)
    })
  })

  it('is re-exported by the useful toolkit', () => {
    expect(UU.inspectify({ aa: undefined })).to.eq('{ aa: undefined }')
  })

  it('renders a mixed bag the same way each run', () => {
    expect(inspectify({
      str: 'hi', num: 1, nope: undefined, nil: null,
      list: [1, { deep: true }], set: new Set(['aa']),
    })).toMatchSnapshot()
  })
})
