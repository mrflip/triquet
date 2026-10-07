import { describe, expect, it } from 'vitest'
import * as Bbjank from '../../src/lib/bbjank'

const Hamilton = 'https://en.wikipedia.org/wiki/William_Rowan_Hamilton'
const Video = 'https://www.youtube.com/watch?v=SZXHoWwBcDc'
const Song = '"William Rowan Hamilton" by A Capella Science'

const BbjankCases: [string, string, string][] = [
  // the doc block's examples:
  ["Answer: ~~**HAMILTON**~~",          "Answer: [spoiler][b]HAMILTON[/b][/spoiler]",       'strikeout is a spoiler, and bold inside it converts'],
  ["~~dead {AS: the twist}~~",          "[spoiler=the twist]dead[/spoiler]",                'an {AS:} inside strikeout is the annotation, its braces dropped'],
  ["> {AS: Q1}1. Who?",                 "[quote=\"Q1\"]1. Who?[/quote]",                    'a quote opening {AS: who} is a quote by who'],
  ["> aside\n> > deeper",               "[list]aside\n[list]deeper[/list][/list]",          'a quote with no {AS:} is a list, and a quote within it a list within that'],
  ["    verse",                         "[list]verse[/list]",                               'four leading spaces are a quote level, not code'],
  ["- one\n- two",                      "[list]\n[*] one\n[*] two[/list]",                  'a bulleted list puts each item on its own line, the close after the last'],
  ["[Ham](https://ex.com/ham)",         "[url=https://ex.com/ham]Ham[/url]",                'a link with text names its address in the tag'],
  ["<b>hi</b>",                         "<b>hi</b>",                                        'HTML is written as the characters typed'],
  // spoilers:
  ["~~Bruce Willis is dead {AS: Hi I am the spoiler animation}~~\n~~The annotation isn't required~~",
    "[spoiler=Hi I am the spoiler animation]Bruce Willis is dead[/spoiler]\n[spoiler]The annotation isn't required[/spoiler]",
    "the boards' two spoilers, annotated and not"],
  ["~~x {AS: **bold** note}~~",         "[spoiler=bold note]x[/spoiler]",                   'an annotation is plain text, whatever emphasis it held'],
  ["~~shh {AS:}~~",                     "[spoiler]shh[/spoiler]",                           'an empty annotation is no annotation'],
  ["~~y {AS: a]b \"c\"}~~",             "[spoiler=a)b 'c']y[/spoiler]",                     'brackets and double quotes in an annotation cannot end the tag'],
  ["~50 years ~~**~50 YEARS**~~",       "~50 years [spoiler][b]~50 YEARS[/b][/spoiler]",    'a single tilde is a tilde, never strikeout'],
  // quotes:
  ["> {AS: bob}Hi, I'm bob",            "[quote=\"bob\"]Hi, I'm bob[/quote]",               "the boards' named quote"],
  ["> {AS: bob}\n> Hi, I'm bob",        "[quote=\"bob\"]Hi, I'm bob[/quote]",               'the text may start on the line after the name'],
  ["> {AS: Q\"1\"}text",                "[quote=\"Q'1'\"]text[/quote]",                      'a double quote in the name cannot end the tag'],
  ["> {AS: **Q1**}text",                "[list]{AS: [b]Q1[/b]}text[/list]",                 'a name with emphasis in it is no name: the quote is a list, the marker kept'],
  ["> one\n>\n> two",                   "[list]one\n\ntwo[/list]",                          'a blank line within a quote is kept'],
  ["   > three spaces",                 "[list]three spaces[/list]",                        'a quote marker indented less than four spaces is a quote'],
  ["before\n\n>\n\nafter",              "before\n\nafter",                                  'an empty quote is nothing, not an empty list tag'],
  ["> [r]: https://a.com\n\nafter",     "after",                                            'a quote holding only a definition is nothing'],
  // indents:
  ["You indent:\n    first level\n        second level", "You indent:\n[list]first level\n[list]second level[/list][/list]", 'eight spaces are two quote levels'],
  ["    first\n        second\n      six spaces\nback out",
    "[list]first\n[list]second[/list]\nsix spaces[/list]\nback out",
    'a line is quoted only as deep as it is indented, and spaces short of four are dropped'],
  ["Clue line\n    verse 1\n    verse 2\n...BUT NOT...\nhint",
    "Clue line\n[list]verse 1\nverse 2[/list]\n...BUT NOT...\nhint",
    'a line set back out of an indent leaves the quote, without a blank line'],
  ["Clue\n\n    verse\n\nback",          "Clue\n\n[list]verse[/list]\n\nback",               'blank lines around an indent are kept'],
  // lists:
  ["- bulleted\n- main bullet\n  - level two A\n  - level two B\n- level one",
    "[list]\n[*] bulleted\n[*] main bullet\n  [list]\n  [*] level two A\n  [*] level two B[/list]\n[*] level one[/list]",
    'a list within an item is a second list tag, set in'],
  ["- a\n    - four-space nested\n- b",
    "[list]\n[*] a\n  [list]\n  [*] four-space nested[/list]\n[*] b[/list]",
    'four spaces inside a list nest the list, and are not a quote'],
  ["1. Point\n2. Second Point,\n   continued\n   > {AS: fleas}Adam\n   > Had 'em\n3. Third point",
    "[list=1]\n[*] Point\n[*] Second Point,\n  continued\n  [quote=\"fleas\"]Adam\n  Had 'em[/quote]\n[*] Third point[/list]",
    'a numbered list is list=1, and an item carries its further lines and a quote'],
  ["3. three\n4. four",                 "[list=1]\n[*] three\n[*] four[/list]",            'the board numbers from 1 whatever the list starts at'],
  ["- \n- b",                           "[list]\n[*]\n[*] b[/list]",                       'an empty item is an empty bullet'],
  // code:
  ["`www iii`",                         "[code]www iii[/code]",                             'a code span is a code tag on its line'],
  ["```\nssuuuup\n    code\n```",       "[code]\nssuuuup\n    code\n[/code]",               'a fenced block is a code tag on lines of its own, its indents its own'],
  ["~~~\n> not a quote\n~~~",           "[code]\n> not a quote\n[/code]",                   'markdown inside a fence is left alone'],
  // emphasis and lines:
  ["Text may be *italicized* or **bolded**.", "Text may be [i]italicized[/i] or [b]bolded[/b].", 'italics and bold'],
  ["It *does **nested**,\nacross lines*", "It [i]does [b]nested[/b],\nacross lines[/i]",    'nested emphasis spanning a line break'],
  ["a\nb\n\nc",                         "a\nb\n\nc",                                        'line breaks and blank lines stay as typed, never [br]'],
  ["a  \nb",                            "a\nb",                                             'a hard break is a line break'],
  ["a\r\nb",                            "a\nb",                                             'a carriage return is a line break'],
  ["[u]under[/u] [b]bold[/b]",          "[u]under[/u] [b]bold[/b]",                         'BBCode already in the text passes through: the way to underline'],
  ["# Heading",                         "[b]Heading[/b]",                                   'a heading is bold'],
  ["above\n\n---\n\nbelow",             `above\n\n${'-'.repeat(40)}\n\nbelow`,              'a thematic break is a line of dashes'],
  // links:
  [`[William Rowan Hamilton](${Hamilton})`, `[url=${Hamilton}]William Rowan Hamilton[/url]`, "the boards' link with text"],
  [Hamilton,                            `[url]${Hamilton}[/url]`,                           'a bare address is a plain url tag'],
  ["<https://x.com>",                   "[url]https://x.com[/url]",                         'an autolink is a plain url tag'],
  ["see www.foo.com",                   "see [url]http://www.foo.com[/url]",                'a bare www address gains its scheme'],
  ["[](https://x.com)",                 "[url=https://x.com][/url]",                        'a link with no text still names its address'],
  ["[*a*](https://x.com/a]b)",          "[url=https://x.com/a%5Db][i]a[/i][/url]",          'a bracket in an address is encoded, so it cannot end the tag'],
  ["[ref link][r]\n\n[r]: https://ex.com/r", "[url=https://ex.com/r]ref link[/url]",        'a reference link is the link its definition makes'],
  ["[nowhere][missing]",                "[nowhere][missing]",                               'a reference to no definition is its text'],
  // images:
  ["![Alt here](https://i.imgur.com/ivJKx8U.jpeg)", "[img]https://i.imgur.com/ivJKx8U.jpeg[/img]\n[list](Alt here)[/list]", "an image's alt text goes below it in parentheses"],
  ["![](https://i.imgur.com/x.png)",    "[img]https://i.imgur.com/x.png[/img]",             'an image with no alt text is the image alone'],
  // YouTube:
  [`[![${Song}](${Video})](${Video})`,  `[youtube]SZXHoWwBcDc[/youtube]\n\n[url=${Video}]${Song}[/url]`, 'a link around a YouTube image is an embed, captioned by the link'],
  [`![${Song}](${Video})`,              `[youtube]SZXHoWwBcDc[/youtube]\n\n[url=${Video}]${Song}[/url]`, 'a YouTube image with alt text is captioned by a link to the video'],
  [`[![alt](${Video}) and more](https://ex.com/about)`, "[youtube]SZXHoWwBcDc[/youtube]\n\n[url=https://ex.com/about]alt and more[/url]", 'a wrapping link captions with alt text and its own text, to its own address'],
  [`[watch](${Video})`,                 `[url=${Video}]watch[/url]`,                        'a plain link to YouTube is only a link'],
  ["![](https://youtu.be/SZXHoWwBcDc)", "[youtube]SZXHoWwBcDc[/youtube]",                   'a YouTube image with no caption is the embed alone'],
  ["before\n\n![](https://youtu.be/SZXHoWwBcDc)\n\nafter", "before\n\n[youtube]SZXHoWwBcDc[/youtube]\n\nafter", 'an embed is set apart by blank lines'],
  // what goes nowhere safe:
  ["[js](javascript:alert(1))",         "js",                                               'a javascript: link is its text alone'],
  ["[js](JaVaScRiPt:alert(1))",         "js",                                               'a javascript: link in mixed case is no link either'],
  ["[rel](/foo)",                       "rel",                                              'a relative link goes nowhere on a board'],
  ["write a@b.com",                     "write a@b.com",                                    'an email address is its text'],
  ["![pic](http://ex.com/a.png)",       "pic",                                              'an image off https is its alt text'],  // eslint-disable-line unicorn/prefer-https -- plain http is what this case is about
  ["![pic](javascript:alert(1))",       "pic",                                              'an image to a javascript: address is its alt text'],
  ["![](data:image/png;base64,AAAA)",   "",                                                 'a data: image with no alt text comes to nothing'],
  ["<script>alert(1)</script>",         "<script>alert(1)</script>",                        'a script is written as the characters typed'],
  ["<div>\n**hi**\n</div>",             "<div>\n**hi**\n</div>",                            'an HTML block is its text, markdown inside it untouched'],
  ["<div>\n    set in\n</div>",         "<div>\n    set in\n</div>",                        "an HTML block's indents are its text, not quotes"],
  ["a <img src=x onerror=alert(1)> b",  "a <img src=x onerror=alert(1)> b",                 'inline HTML is its text'],
  // trivial cases:
  ["",                                  "",                                                 'nothing is nothing'],
  ["   \n  ",                           "",                                                 'whitespace alone is nothing'],
]

describe('toBbjank', () => {
  for (const [markdown, expected, blurb] of BbjankCases) {
    it(blurb, () => {
      expect(Bbjank.toBbjank(markdown)).to.eq(expected)
    })
  }

  it("writes a recap's question block as thread 5 spells it", () => {
    const block = [
      "> {AS: Q1}1. The four science YouTubers are paying homage to a notable Irish physicist. **What's his name, man?** ...BUT NOT... the progenitors [Click here](https://learnedleague.com/images/art/7998/7998_1_893016.png)",
      '',
      'Answer: ~~**(WILLIAM ROWAN / LEWIS) HAMILTON**~~',
      'Correct Answer %:',
      '{Add Optional Text For Q1 Here or Delete}',
    ].join('\n')
    expect(Bbjank.toBbjank(block)).to.eq([
      "[quote=\"Q1\"]1. The four science YouTubers are paying homage to a notable Irish physicist. [b]What's his name, man?[/b] ...BUT NOT... the progenitors [url=https://learnedleague.com/images/art/7998/7998_1_893016.png]Click here[/url][/quote]",
      '',
      'Answer: [spoiler][b](WILLIAM ROWAN / LEWIS) HAMILTON[/b][/spoiler]',
      'Correct Answer %:',
      '{Add Optional Text For Q1 Here or Delete}',
    ].join('\n'))
  })
})

const YoutubeCases: [string, string | undefined, string][] = [
  // the doc block's examples:
  ["https://www.youtube.com/watch?v=SZXHoWwBcDc",    "SZXHoWwBcDc", 'a watch address names its video'],
  ["https://youtu.be/SZXHoWwBcDc?t=3",               "SZXHoWwBcDc", 'a short link names its video, whatever follows'],
  ["https://ex.com/watch?v=SZXHoWwBcDc",             undefined,     'another host is not YouTube'],
  // the other shapes:
  ["https://youtube.com/embed/SZXHoWwBcDc",          "SZXHoWwBcDc", 'an embed address'],
  ["https://m.youtube.com/shorts/SZXHoWwBcDc",       "SZXHoWwBcDc", 'a short, on the mobile host'],
  ["https://www.youtube.com/watch?t=3&v=SZXHoWwBcDc", "SZXHoWwBcDc", 'the video wherever it sits in the query'],
  ["http://www.youtube.com/watch?v=SZXHoWwBcDc",     "SZXHoWwBcDc", 'plain http is still YouTube'],  // eslint-disable-line unicorn/prefer-https, sonarjs/no-clear-text-protocols -- plain http is what this case is about
  // not videos:
  ["https://www.youtube.com/watch?v=short",          undefined,     'an id of the wrong length is none'],
  ["https://www.youtube.com/@channel",               undefined,     'a channel is no video'],
  ["javascript://www.youtube.com/watch?v=SZXHoWwBcDc", undefined,   'an address off the web is no video'],
  ["https://notyoutube.com/watch?v=SZXHoWwBcDc",     undefined,     'a host merely ending in youtube.com is not YouTube'],
  ["not a url",                                      undefined,     'what is no address is no video'],
]

describe('youtubeIdOf', () => {
  for (const [url, expected, blurb] of YoutubeCases) {
    it(blurb, () => {
      expect(Bbjank.youtubeIdOf(url)).to.eq(expected)
    })
  }
})
