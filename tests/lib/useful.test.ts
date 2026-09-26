import { describe, expect, it } from 'vitest'
import * as UU from '../../src/lib/useful'

describe('jsonify', () => {
  const Cases: [unknown, boolean | undefined, string, string][] = [
    // regular usage:
    [{ b: 1, a: 2 },               undefined, '{"a":2,"b":1}',                     'compact by default, keys sorted'],
    [{ b: 1, a: 2 },               false,     '{"a":2,"b":1}',                     'pretty: false is the default spelled out'],
    [{ b: 1, a: [3, 1] },          true,      '{\n  "a": [\n    3,\n    1\n  ],\n  "b": 1\n}', 'pretty indents two spaces; arrays keep their order'],
    // nesting:
    [{ z: { y: 1, x: 2 }, a: 0 },  undefined, '{"a":0,"z":{"x":2,"y":1}}',        'keys are sorted at every depth'],
    [[{ b: 1, a: 2 }],             undefined, '[{"a":2,"b":1}]',                   'objects inside arrays are sorted too'],
    // trivial and odd cases:
    [null,                         undefined, 'null',                              'null is the JSON null'],
    ['',                           undefined, '""',                                'an empty string is still a string'],
    [undefined,                    undefined, 'null',                              'undefined has no JSON form; it becomes null rather than the value undefined'],
    [{ a: undefined, b: 1 },       undefined, '{"b":1}',                           'an undefined field is dropped, as JSON.stringify does'],
    ["Zoë 🎉\t'q'",                undefined, String.raw`"Zoë 🎉\t'q'"`,                 'unicode survives, and a tab is escaped'],
  ]
  for (const [val, pretty, expected, describes] of Cases) {
    it(describes, () => {
      expect(UU.jsonify(val, pretty === undefined ? undefined : { pretty })).to.eq(expected)
    })
  }

  it('gives the same bytes however the object was built', () => {
    expect(UU.jsonify({ a: 1, b: { c: 2, d: 3 } })).to.eq(UU.jsonify({ b: { d: 3, c: 2 }, a: 1 }))
  })

  it('round-trips through JSON.parse', () => {
    const val = { q: [1, { z: null, a: 'x' }], b: true }
    expect(JSON.parse(UU.jsonify(val, { pretty: true }))).to.deep.eq(val)
  })
})
