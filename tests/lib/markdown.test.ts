import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ReactMarkdown from 'react-markdown'
import { describe, expect, it } from 'vitest'
import * as Markdown from '../../src/lib/markdown'

/** What a field's text becomes on screen, as markup */
const rendered = (text: string): string => renderToStaticMarkup(createElement(ReactMarkdown, Markdown.RenderOptions, Markdown.forScreen(text)))

const IndentCases: [string, string, string][] = [
  // regular usage:
  ["    *verse*",            "> *verse*",            'four leading spaces become a quote marker'],
  ["        deeper",         "> > deeper",           'each four spaces is another quote level'],
  ["      between",          ">   between",          'spaces short of another four are kept'],
  ["          ten",          "> >   ten",            'spaces past two levels are kept after both'],
  ["    one\n    two",       "> one\n> two",          'every indented line is quoted'],
  // what is left alone:
  ["prose\n   not",          "prose\n   not",         'three spaces are not an indent'],
  ["a    b",                 "a    b",               'spaces inside a line are not an indent'],
  ["",                       "",                     'empty text stays empty'],
]

const ScreenCases: [string, string, string][] = [
  // regular usage:
  ["    verse\nWho?",              "> verse\n\nWho?",            'an unindented line after a quote closes it, rather than joining it'],
  ["        two\n    one",         "> > two\n>\n> one",          'stepping back a level closes only the deeper quote'],
  ["    one\n        two",         "> one\n> > two",             'stepping in needs nothing between'],
  ["    one\n    two",             "> one\n> two",               'lines at one depth stay one quote'],
  // what is left alone:
  ["    verse\n\nWho?",            "> verse\n\nWho?",            'a blank line already closes the quote'],
  ["> typed\nlazy",               "> typed\nlazy",               'a quote marker typed by hand is markdown\'s own, laziness and all'],
  ["",                           "",                           'empty text stays empty'],
]

const RenderCases: [string, string, string][] = [
  // regular usage:
  ["**bold** and *it*",           "<p><strong>bold</strong> and <em>it</em></p>",             'emphasis renders'],
  ["one\ntwo",                    "<p>one<br/>\ntwo</p>",                                       'a line break is a break, as the author typed it'],
  ["one\n\ntwo",                  "<p>one</p>\n<p>two</p>",                                     'a blank line starts a paragraph'],
  ["    *verse*",                 "<blockquote>\n<p><em>verse</em></p>\n</blockquote>",       'an indented line is a quote, not code'],
  ["        *deep*",              "<blockquote>\n<blockquote>\n<p><em>deep</em></p>\n</blockquote>\n</blockquote>", 'eight spaces are a quote within a quote, not code'],
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

describe("forScreen", () => {
  it.each(ScreenCases)('%j => %j: %s', (text, expected) => {
    expect(Markdown.forScreen(text)).to.eq(expected)
  })

  it("renders the line after a quote outside it", () => {
    expect(rendered('Clue\n    verse one\n    verse two\nWho wrote it?')).to.eq(
      '<p>Clue</p>\n<blockquote>\n<p>verse one<br/>\nverse two</p>\n</blockquote>\n<p>Who wrote it?</p>',
    )
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
