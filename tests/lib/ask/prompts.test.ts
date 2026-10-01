import { describe, expect, it } from 'vitest'
import { renderPrompt, templateIssue, unfilledKeys } from '../../../src/lib/ask/prompts'

describe('renderPrompt', () => {
  const Cases: [[string, Record<string, unknown>], string, string][] = [
    // regular usage:
    [["Question: {{clueing}}", { clueing: 'Who?' }],                      "Question: Who?",            'fills a placeholder'],
    [["{{aa}} then {{aa}}", { aa: 'x' }],                                  "x then x",                  'fills every occurrence of a placeholder'],
    [["Spans: {{items}}", { items: [1, 2] }],                              "Spans: [1,2]",              'fills a list in as its JSON'],
    [["Item: {{item}}", { item: { text: 'three', value: 3 } }],            'Item: {"text":"three","value":3}', 'fills an object in as its JSON, keys sorted'],
    [["{{nn}} and {{yes}}", { nn: 3, yes: true }],                          "3 and true",                'fills a number and a boolean in as written'],
    [["{{#items}}[{{text}}]{{/items}}", { items: [{ text: 'a' }, { text: 'b' }] }], "[a][b]",           'repeats a section for each item of a list'],
    [["{{^hint}}No hint.{{/hint}}", { hint: '' }],                          "No hint.",                  'shows an inverted section for a blank'],
    [["Q: {{qn.hint}}", { qn: { hint: 'two' } }],                           "Q: two",                    'reads a dotted key'],
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

  it('throws on a template that does not parse', () => {
    expect(() => renderPrompt('{{#items}}', { items: [] })).to.throw(/Unclosed section/)
  })
})

describe('templateIssue', () => {
  it('is null for a template that parses', () => {
    expect(templateIssue('Question: {{clueing}}')).to.be.null
  })

  it('names an unclosed section', () => {
    expect(templateIssue('{{#items}}{{text}}')).to.match(/^Unclosed section "items"/)
  })

  it('names an unclosed tag', () => {
    expect(templateIssue('Question: {{clueing')).to.match(/^Unclosed tag/)
  })
})

describe('unfilledKeys', () => {
  const Cases: [[string, Record<string, unknown>], string[], string][] = [
    [["{{clueing}} {{hint}}", { clueing: 'Who?' }],                 ["hint"],       'a key the input lacks'],
    [["{{hint}} {{{hint}}} {{#hint}}x{{/hint}}", {}],                ["hint"],       'each key once, however it is read'],
    [["{{qn.hint}}", { qn: {} }],                                    [],             'a dotted key whose head the input holds'],
    [["{{#items}}{{text}}{{/items}}", { items: [] }],                [],             'a key read inside a section, which is the section\'s business'],
    [["{{.}} {{! a comment }}", {}],                                 [],             'the whole context and a comment, neither of them a key'],
    [["{{#items}}", {}],                                             [],             'a template that does not parse, which reads nothing'],
  ]
  for (const [[template, input], expected, describes] of Cases) {
    it(describes, () => {
      expect(unfilledKeys(template, input)).to.deep.eq(expected)
    })
  }
})
