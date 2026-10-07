import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ReactMarkdown from 'react-markdown'
import { describe, expect, it } from 'vitest'
import * as Markdown from '../../src/lib/markdown'

/** What a field's text becomes on screen, as markup */
const rendered = (text: string): string => renderToStaticMarkup(createElement(ReactMarkdown, Markdown.RenderOptions, Markdown.indentsQuoted(text)))

const IndentCases: [string, string, string][] = [
  // regular usage:
  ["    *verse*",            "> *verse*",            'four leading spaces become a quote marker'],
  ["        deeper",         "> > deeper",           'each four spaces is another quote level'],
  ["      between",          ">   between",          'spaces short of another four are kept'],
  ["- a\n    - b",            "- a\n    - b",          "a list's indents are its own: four spaces nest it"],
  ["```\n    code\n```",      "```\n    code\n```",    "a fenced code block's indents are its own"],
  ["<div>\n    in\n</div>",   "<div>\n    in\n</div>",  "an HTML block's indents are its own"],
  ["- a\n\n        *b*",       "- a\n\n> > *b*",       "an indent markdown would make code inside a list is the author's, and quoted"],
  ["a\r\r    b\r\n    c",     "a\r\r> b\r\n> c",      'a carriage return parts lines, and every line break stays as typed'],
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
  ["- a\n    - b\nafter",           "- a\n    - b\nafter",           'a list nested four spaces in is still a list'],
  ["Clue\n```\n    code\n```\n    verse", "Clue\n```\n    code\n```\n> verse", 'indents inside a fence are kept, and outside it read as quotes'],
  ["    verse\r\nWho?",             "> verse\n\nWho?",            'a carriage return is a line break'],
  ["- a\n\n        *b*\n- c",        "- a\n\n> > *b*\n- c",        "an indent markdown would make code inside a list reads as a quote, not code"],
  ["",                           "",                           'empty text stays empty'],
]

const RenderCases: [string, string, string][] = [
  // regular usage:
  ["**bold** and *it*",           "<p><strong>bold</strong> and <em>it</em></p>",             'emphasis renders'],
  ["__bold__ and _it_",           "<p><strong>bold</strong> and <em>it</em></p>",             'underscores make the same emphasis: underline is bbjank\'s alone'],
  ["~~gone~~ ~50",                "<p><del>gone</del> ~50</p>",                                 'a double tilde strikes out, and a single one is a tilde'],
  ["- a\n    - b",                 "<ul>\n<li>a\n<ul>\n<li>b</li>\n</ul>\n</li>\n</ul>",               'a list nested four spaces in is a list within the item, not a quote'],
  ["```\n    code\n```",           "<pre><code>    code\n</code></pre>",                         'a fenced code block keeps its indents'],
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
  ["~one tilde~",                 "<p>~one tilde~</p>",                                         'a single tilde either side is not strikethrough'],
  // what never reaches the screen as written:
  ["<b>hi</b>",                   "<p>&lt;b&gt;hi&lt;/b&gt;</p>",                               'HTML shows as the characters typed'],
  ["<script>alert(1)</script>",   "&lt;script&gt;alert(1)&lt;/script&gt;",                     'a script shows as the characters typed'],
  ["[x](javascript:alert(1))",    "<p><a>x</a></p>",                                            'a script address is dropped from its link'],
  ["[x](ftp://e.co/f)",           "<p><a>x</a></p>",                                            'an address off the web or mail is dropped'],
  ["[x](https://e.co \"t\")",     "<p><a href=\"https://e.co\" title=\"t\">x</a></p>",        'a link keeps its title'],
  // trivial cases:
  ["",                            "",                                                           'empty text renders nothing'],
]

const ImageCases: [string, string, string][] = [
  // regular usage:
  ["![cat](https://e.co/c.png)",       "<p><img src=\"https://e.co/c.png\" alt=\"cat\"/></p>",  'an image at an https address is kept, with its alt text'],
  ["**bold** [x](https://e.co)",       "<p><strong>bold</strong> <a href=\"https://e.co\">x</a></p>", 'everything the one allowlist keeps is kept'],
  // what never reaches the screen as written:
  ["![cat](http://e.co/c.png)",        "<p><img alt=\"cat\"/></p>",                            'a plain-http image loses its address'], // eslint-disable-line unicorn/prefer-https
  ["![cat](HTTPS://e.co/c.png)",       "<p><img alt=\"cat\"/></p>",                            'a shouted protocol is not https'],
  ["![cat](//e.co/c.png)",             "<p><img alt=\"cat\"/></p>",                            'an address borrowing the page\'s scheme loses its address'],
  ["![cat](/api/ask)",                 "<p><img alt=\"cat\"/></p>",                            'an address on this site loses its address'],
  ["![cat](c.png)",                    "<p><img alt=\"cat\"/></p>",                            'a relative address loses its address'],
  ["![cat](javascript:alert(1))",      "<p><img alt=\"cat\"/></p>",                            'a script address loses its address'],
  ["![cat](data:image/png;base64,AA)", "<p><img alt=\"cat\"/></p>",                            'a data address loses its address'],
  ["![cat](https://e.co/c.png \"t\")", "<p><img src=\"https://e.co/c.png\" alt=\"cat\"/></p>", 'an image keeps no title'],
  ["<img src=\"https://e.co/c.png\">", "&lt;img src=&quot;https://e.co/c.png&quot;&gt;",        'an image typed as HTML shows as the characters typed'],
]

describe("indentsAsQuotes", () => {
  it.each(IndentCases)('%j => %j: %s', (text, expected) => {
    expect(Markdown.indentsAsQuotes(text)).to.eq(expected)
  })
})

describe("forScreen", () => {
  it.each(ScreenCases)('%j => %j: %s', (text, expected) => {
    expect(Markdown.indentsQuoted(text)).to.eq(expected)
  })

  it("marks the lines it put in to close a quote, and no others", () => {
    expect(Markdown.quotedByIndent('    verse\nWho?\n\nNext')).to.deep.eq({ source: '> verse\n\nWho?\n\nNext', closers: new Set([2]) })
    expect(Markdown.quotedByIndent('        two\n    one')).to.deep.eq({ source: '> > two\n>\n> one', closers: new Set([2]) })
  })

  it("reads a long text of many blocks in one pass, as a filled template may come to", { timeout: 10_000 }, () => {
    const blocks = '<b>\n\n'.repeat(60_000)
    expect(Markdown.indentsQuoted(blocks)).to.eq(blocks)
    expect(Markdown.indentsAsQuotes(blocks)).to.eq(blocks)
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
    const markup = rendered('# Head\n\n~~struck~~\n\n> quote\n\n`code`\n\n```\nblock\n```\n\n---\n\n| a | b |\n|---|---|\n| 1 | 2 |')
    const tagnames = markup.matchAll(/<(\w+)/g).map((match) => match[1]).toArray()
    expect(tagnames.filter((tagname) => ! Markdown.Allowlist.tagNames?.includes(tagname ?? ''))).to.deep.equal([])
  })
})

describe("RenderOptions, on images", () => {
  it.each(ImageCases)('%j => %j: %s', (text, expected) => {
    expect(rendered(text)).to.contain(expected)
  })

  it("keeps an image at an entity-encoded or backslashed address only when it is still a whole https one", () => {
    expect(rendered('![cat](&#104;ttps://e.co/c.png)')).to.contain('<img src="https://e.co/c.png" alt="cat"/>')
    expect(rendered('![cat](javascript&#58;alert(1))')).to.contain('<img alt="cat"/>')
    expect(rendered(String.raw`![cat](https:\\e.co/c.png)`)).to.contain('<img alt="cat"/>')
  })
})
