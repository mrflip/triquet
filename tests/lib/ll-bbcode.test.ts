import { describe, expect, it } from 'vitest'
import * as LLBBCode from '../../src/lib/ll-bbcode'

const MarkdownCases: [string, string, string][] = [
  // regular usage:
  ["**bold**",                  "[b]bold[/b]",                        'double asterisks are bold'],
  ["__bold__",                  "[b]bold[/b]",                        'double underscores are bold too'],
  ["*italic*",                  "[i]italic[/i]",                      'single asterisks are italic'],
  ["_italic_",                  "[i]italic[/i]",                      'single underscores are italic too'],
  ["Name **WHAT** it is",       "Name [b]WHAT[/b] it is",             'the text around the emphasis is untouched'],
  // bold-italics and italics-bold:
  ["***both***",                "[i][b]both[/b][/i]",                 'three asterisks are italic around bold, as markdown nests them'],
  ["**_both_**",                "[b][i]both[/i][/b]",                 'italic inside bold closes before the bold does'],
  ["_**both**_",                "[i][b]both[/b][/i]",                 'bold inside italic closes before the italic does'],
  ["*__both__*",                "[i][b]both[/b][/i]",                 'underscore bold inside asterisk italic'],
  ["**bold *both* bold**",      "[b]bold [i]both[/i] bold[/b]",       'italics partway through a bold run'],
  ["*it **both** it*",          "[i]it [b]both[/b] it[/i]",           'bold partway through an italic run'],
  ["***both** italic*",         "[i][b]both[/b] italic[/i]",          'bold closing before the italic around it'],
  ["***both* bold**",           "[b][i]both[/i] bold[/b]",            'italic closing before the bold around it'],
  // what markdown does not call emphasis:
  ["4 * 5 * 6",                 "4 * 5 * 6",                          'an asterisk with space on both sides is arithmetic, not emphasis'],
  ["snake_case_word",           "snake_case_word",                    'underscores inside a word are not emphasis'],
  ["**unclosed",                "**unclosed",                         'an unclosed marker is left as written'],
  ["`*code*`",                  "`*code*`",                           'a code span is left as written'],
  [String.raw`\*not\*`,         String.raw`\*not\*`,                  'escaped asterisks are left as written, backslashes and all'],
  // the rest of the text survives verbatim:
  ["[b]Already[/b] **new**",    "[b]Already[/b] [b]new[/b]",          'bbcode already in the text is left alone'],
  ["# Heading *it*",            "# Heading [i]it[/i]",                'a line that markdown reads as a heading keeps its hash'],
  // quotes and indents:
  ["> *verse*\n> **bold**",     "    [i]verse[/i]\n    [b]bold[/b]",  'a quote marker becomes four spaces, and emphasis inside converts'],
  [">  foo",                    "     foo",                           'a space beyond the one the marker takes is kept'],
  ["     foo",                  "     foo",                           'a line indented five spaces keeps all five'],
  ["    **verse**",             "    [b]verse[/b]",                    'an indented line is not code: its emphasis converts'],
  ["    one\n    two",          "    one\n    two",                   'every indented line keeps its indent'],
  [">foo",                      "    foo",                             'a marker with no space after it is four spaces all the same'],
  ["> > nested",                "        nested",                      'a quote within a quote is indented twice'],
  ["> quoted\nlazy",            "    quoted\nlazy",                   'a line continuing the quote without a marker is left as typed'],
  ["plain\n    indented",       "plain\n    indented",               'an indented line after a paragraph keeps its indent'],
  ["  two spaces",              "  two spaces",                       'fewer than four leading spaces are left as typed'],
  ["this > that",               "this > that",                        'a > partway along a line is not a quote'],
  // trivial cases:
  ["",                          "",                                   'empty text stays empty'],
  ["plain",                     "plain",                              'text without emphasis is untouched'],
  // weird cases:
  ["*Léon* **千**",              "[i]Léon[/i] [b]千[/b]",              'non-Latin text keeps its place around the tags'],
]

describe('markdownToBbcode', () => {
  for (const [text, expected, blurb] of MarkdownCases) {
    it(blurb, () => {
      expect(LLBBCode.markdownToBbcode(text)).to.eq(expected)
    })
  }
})

const TranslateCases: [string, string, string][] = [
  // line breaks:
  ["two\nlines",                "two [br] lines",                     'a line break becomes a spaced [br]'],
  ["two\r\nlines",              "two [br] lines",                     'a Windows line break counts once, not twice'],
  ["para\n\npara",              "para [br]  [br] para",               'a blank line is two breaks'],
  // together:
  ["**Who** wrote\n*Hamlet*?",  "[b]Who[/b] wrote [br] [i]Hamlet[/i]?", 'emphasis and line breaks convert together'],
  ["    verse\n    more",       "    verse [br]     more",            'an indented line keeps its indent after the break'],
  ["**a\nb**",                  "[b]a [br] b[/b]",                    'emphasis spanning a line break converts before the break does'],
  ["[b]x[/b] [br] $5",          "[b]x[/b] [br] $5",                   'bbcode already in the text is left alone'],
  // what only the import format cares about is left alone:
  ["$$5 | $10",                 "$$5 | $10",                          'dollar signs and pipes are kept as written'],
  // trivial cases:
  ["",                          "",                                   'empty text stays empty'],
]

describe('translate', () => {
  for (const [text, expected, blurb] of TranslateCases) {
    it(blurb, () => {
      expect(LLBBCode.translate(text)).to.eq(expected)
    })
  }
})
