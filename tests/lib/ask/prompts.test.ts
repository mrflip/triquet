import { describe, expect, it } from 'vitest'
import { renderPrompt, templateIssue, unfilledKeys } from '../../../src/lib/ask/prompts'

describe('renderPrompt', () => {
  const Cases: [[string, Record<string, unknown>], string, string][] = [
    // regular usage:
    [["Question: {{clueing}}", { clueing: 'Who?' }],                      "Question: Who?",            'fills a placeholder'],
    [["Question: {{ clueing }}", { clueing: 'Who?' }],                    "Question: Who?",            'fills a placeholder written with spaces'],
    [["{{aa}} then {{aa}}", { aa: 'x' }],                                  "x then x",                  'fills every occurrence of a placeholder'],
    [["Spans: {{items}}", { items: [1, 2] }],                              "Spans: [1,2]",              'fills a list in as its JSON'],
    [["Item: {{item}}", { item: { text: 'three', value: 3 } }],            'Item: {"text":"three","value":3}', 'fills an object in as its JSON, keys sorted'],
    [["{{nn}} and {{yes}}", { nn: 3, yes: true }],                          "3 and true",                'fills a number and a boolean in as written'],
    [["{% for item in items %}[{{ item.text }}]{% endfor %}", { items: [{ text: 'a' }, { text: 'b' }] }], "[a][b]", 'repeats a loop for each item of a list'],
    [["{% unless hint %}No hint.{% endunless %}", { hint: '' }],           "No hint.",                  'counts a blank as false'],
    [["Q: {{qn.hint}}", { qn: { hint: 'two' } }],                           "Q: two",                    'reads a dotted key'],
    [["{{ items | join: ', ' }}", { items: ['a', 'b'] }],                  "a, b",                      "uses Liquid's own filters"],
    // nothing to fill in:
    [["{{clueing}} {{hint}}", { clueing: 'Who?' }],                         "Who? ",                     'fills a key the input lacks with nothing'],
    [["{{clueing}}", { clueing: null }],                                    "",                          'fills null with nothing'],
    // the author's own text:
    [["Q: {{clueing}}", { clueing: "Tom & Jerry's <b>\"best\"</b>" }],    "Q: Tom & Jerry's <b>\"best\"</b>", 'escapes nothing: the prompt is prose, not a page'],
    [["Q: {{clueing}}", { clueing: 'Worth $& more' }],                      "Q: Worth $& more",          'keeps a dollar-ampersand literal'],
    [["Q: {{clueing}}", { clueing: 'see {{hint}}' }],                       "Q: see {{hint}}",           'keeps text that merely looks like a placeholder alone'],
  ]
  for (const [[template, input], expected, describes] of Cases) {
    it(describes, () => {
      expect(renderPrompt(template, input)).to.eq(expected)
    })
  }

  it('throws on a template that does not read', () => {
    expect(() => renderPrompt('{% for item in items %}', { items: [] })).to.throw(/not closed/)
  })

  /** Tags reaching past the input's own keys, or at a function in it, each of which must fill in as nothing */
  const PastTheInput: [string, string][] = [
    ["[{{constructor}}]",                                                       'the input\'s constructor'],
    ["[{{__proto__}}]",                                                         'the input\'s prototype'],
    ["[{{qn.toString}}]",                                                       'an inherited method'],
    ["[{{items.map}}]",                                                         'a list\'s method'],
    ["[{% if constructor.constructor %}x{% endif %}]",                          'a condition on the Function constructor'],
    ["[{% for each in items.constructor.prototype %}x{% endfor %}]",            'a loop over what a list inherits'],
    ["[{{fn}}]",                                                                'a function in the input, never called'],
    ["[{% if fn %}x{% endif %}]",                                               'a function in the input as a condition, never called'],
  ]
  for (const [template, describes] of PastTheInput) {
    it(`fills in nothing for ${describes}`, () => {
      let called = 0
      const input = { clueing: 'Who?', qn: { hint: 'two' }, items: [1, 2], fn: () => { called += 1; return 'called' } }
      expect(renderPrompt(template, input)).to.eq('[]')
      expect(called).to.eq(0)
    })
  }
})

describe('templateIssue', () => {
  it('is null for a template that reads', () => {
    expect(templateIssue('Question: {{clueing}}')).to.be.null
  })

  const Cases: [string, string, string][] = [
    ["{% for item in items %}{{ item.text }}", "tag {% for item in items %} not closed, line:1, col:1",                         'names an unclosed loop'],
    ["Question: {{clueing",                    'output "{{clueing" not closed, line:1, col:11',                                'names an unclosed tag'],
    ["{{ clueing | shout }}",                  "undefined filter: shout, line:1, col:1",                                        'names a filter there is none of'],
    ['{% include "header" %}',                 "{% include %} includes another template, and there are none to include, line:1, col:1", 'refuses an included template'],
  ]
  for (const [template, issue, describes] of Cases) {
    it(describes, () => {
      expect(templateIssue(template)).to.eq(issue)
    })
  }
})

describe('unfilledKeys', () => {
  const Cases: [[string, Record<string, unknown>], string[], string][] = [
    [["{{clueing}} {{hint}}", { clueing: 'Who?' }],                                  ["hint"],  'a key the input lacks'],
    [["{{hint}} {% if hint %}x{% endif %} {{ hint | upcase }}", {}],                  ["hint"],  'each key once, however it is read'],
    [["{{qn.hint}}", { qn: {} }],                                                     [],        'a dotted key whose head the input holds'],
    [["{% for item in items %}{{ item.text }}{% endfor %}", { items: [] }],           [],        'a name a loop makes, which is the template\'s own'],
    [["{% for item in items %}{{ other }}{% endfor %}", { items: [] }],               ["other"], 'a key the input lacks, read inside a loop'],
    [["{% assign tone = 'dry' %}{{ tone }} {% comment %}{{ gone }}{% endcomment %}", {}], [], 'a name an assign makes, and a comment'],
    [["{% for item in items %}", {}],                                                 [],        'a template that does not read, which reads nothing'],
  ]
  for (const [[template, input], expected, describes] of Cases) {
    it(describes, () => {
      expect(unfilledKeys(template, input)).to.deep.eq(expected)
    })
  }
})
