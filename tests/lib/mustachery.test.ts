import Mustache from 'mustache'
import { describe, expect, it } from 'vitest'
import { OwnKeysContext } from '../../src/lib/mustachery'

/** `template` rendered over `view` in an `OwnKeysContext`, nothing escaped */
function rendered(template: string, view: unknown): string {
  return Mustache.render(template, new OwnKeysContext(view), {}, { escape: String })
}

const view = { qn: { hint: 'Not her', size: 3 }, qns: [{ title: 'One' }, { title: 'Two' }], fn: () => 'called', title: 'Outer' }

describe("OwnKeysContext", () => {
  const Cases: [string, string, string][] = [
    // regular usage:
    ["{{qn.hint}}",                                "Not her",          'reads a dotted key the view holds'],
    ["{{qn.size}}",                                "3",                'reads a number'],
    ["{{#qns}}[{{title}}]{{/qns}}",                "[One][Two]",       'repeats a section over a list, reading each item\'s own keys'],
    ["{{#qn}}{{hint}} ({{title}}){{/qn}}",         "Not her (Outer)",  'looks a key the section\'s item lacks up in the context it was pushed from'],
    ["{{qns.length}}",                             "2",                'reads a list\'s length, which the list holds'],
    ["{{#qns}}{{.}};{{/qns}}",                     "[object Object];[object Object];", 'reads the item itself as `.`'],
    // what reads as nothing:
    ["[{{qn.nothing}}]",                           "[]",               'a key the view lacks'],
    ["[{{fn}}]",                                   "[]",               'a function, never called'],
    ["[{{#fn}}x{{/fn}}]",                          "[]",               'a function as a section, never called'],
    ["[{{constructor}}]",                          "[]",               'the view\'s constructor'],
    ["[{{__proto__}}]",                            "[]",               'the view\'s prototype'],
    ["[{{qn.toString}}]",                          "[]",               'an inherited method'],
    ["[{{qns.map}}]",                              "[]",               'a list\'s method'],
    ["[{{qn.hint.length}}]",                       "[]",               'a property of a string'],
    ["[{{#qns.constructor.constructor}}x{{/qns.constructor.constructor}}]", "[]", 'the Function constructor, reached through a list'],
  ]
  it.each(Cases)('%j => %j: %s', (template, expected) => {
    expect(rendered(template, view)).to.eq(expected)
  })

  it("renders the doc block's examples", () => {
    expect(Mustache.render('{{qn.hint}}', new OwnKeysContext({ qn: { hint: 'Not her' } }))).to.eq('Not her')
    expect(Mustache.render('[{{constructor}}]', new OwnKeysContext({}))).to.eq('[]')
    expect(Mustache.render('[{{fn}}]', new OwnKeysContext({ fn: () => 'called' }))).to.eq('[]')
  })
})
