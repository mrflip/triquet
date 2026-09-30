import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ReactMarkdown from 'react-markdown'
import { describe, expect, it } from 'vitest'
import * as Markdown from '../../src/lib/markdown'

/** What a field's text becomes on screen, as markup */
const rendered = (text: string): string => renderToStaticMarkup(createElement(ReactMarkdown, Markdown.RenderOptions, Markdown.indentsAsQuotes(text)))

const IndentCases: [string, string, string][] = [
  // regular usage:
  ["    *verse*",            "> *verse*",            'four leading spaces become a quote marker'],
  ["      deeper",           ">   deeper",           'spaces beyond the first four are kept'],
  ["    one\n    two",       "> one\n> two",          'every indented line is quoted'],
  // what is left alone:
  ["prose\n   not",          "prose\n   not",         'three spaces are not an indent'],
  ["a    b",                 "a    b",               'spaces inside a line are not an indent'],
  ["",                       "",                     'empty text stays empty'],
]

const RenderCases: [string, string, string][] = [
  // regular usage:
  ["**bold** and *it*",           "<p><strong>bold</strong> and <em>it</em></p>",             'emphasis renders'],
  ["one\ntwo",                    "<p>one<br/>\ntwo</p>",                                       'a line break is a break, as the author typed it'],
  ["one\n\ntwo",                  "<p>one</p>\n<p>two</p>",                                     'a blank line starts a paragraph'],
  ["    *verse*",                 "<blockquote>\n<p><em>verse</em></p>\n</blockquote>",       'an indented line is a quote, not code'],
  ["- a\n- b",                    "<ul>\n<li>a</li>\n<li>b</li>\n</ul>",                        'a list renders'],
  ["3. third",                    "<ol start=\"3\">\n<li>third</li>\n</ol>",                  'a numbered list keeps its start'],
  ["[site](https://example.com)", "<a href=\"https://example.com\">site</a>",                 'a web link keeps its address'],
  // what markdown does not call emphasis:
  ["4 * 5 * 6",                   "<p>4 * 5 * 6</p>",                                           'arithmetic is left as written'],
  ["~50 to ~60",                  "<p>~50 to ~60</p>",                                          'a tilde is not strikethrough'],
  // what never reaches the screen as written:
  ["<b>hi</b>",                   "<p>&lt;b&gt;hi&lt;/b&gt;</p>",                               'HTML shows as the characters typed'],
  ["<script>alert(1)</script>",   "&lt;script&gt;alert(1)&lt;/script&gt;",                     'a script shows as the characters typed'],
  ["![cat](https://e.co/c.png)",  "<p></p>",                                                    'an image is dropped, so nothing is fetched'],
  ["[x](javascript:alert(1))",    "<p><a>x</a></p>",                                            'a script address is dropped from its link'],
  ["[x](ftp://e.co/f)",           "<p><a>x</a></p>",                                            'an address off the web or mail is dropped'],
  ["[x](https://e.co \"t\")",     "<p><a href=\"https://e.co\" title=\"t\">x</a></p>",        'a link keeps its title'],
  // trivial cases:
  ["",                            "",                                                           'empty text renders nothing'],
]

describe("indentsAsQuotes", () => {
  it.each(IndentCases)('%j => %j: %s', (text, expected) => {
    expect(Markdown.indentsAsQuotes(text)).to.eq(expected)
  })
})

describe("RenderOptions", () => {
  it.each(RenderCases)('%j => %j: %s', (text, expected) => {
    expect(rendered(text)).to.contain(expected)
  })

  it("renders only what the allowlist names", () => {
    const markup = rendered('# Head\n\n> quote\n\n`code`\n\n```\nblock\n```\n\n---\n\n| a | b |\n|---|---|\n| 1 | 2 |')
    const tagnames = markup.matchAll(/<(\w+)/g).map((match) => match[1]).toArray()
    expect(tagnames.filter((tagname) => ! Markdown.Allowlist.tagNames?.includes(tagname ?? ''))).to.deep.equal([])
  })
})
