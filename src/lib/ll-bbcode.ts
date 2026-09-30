import { fromMarkdown } from 'mdast-util-from-markdown'
import * as Markdown from './markdown'

// The league's BBCode: the markup its site shows, apart from anything about its import format.

/** What a quote marker is written as, and what an indented line starts with */
const Indent = ' '.repeat(4)

type MdRoot = ReturnType<typeof fromMarkdown>
type MdNode = MdRoot | MdRoot['children'][number]

/** Some of a text's source, from `beg` up to `end`, to be written as `text` instead */
type Splice = { beg: number, end: number, text: string }

/**
 * Text as the league's site shows it, on one line: markdown bold and italics become `[b]` and
 * `[i]`, a quoted or indented line is indented by four spaces, and every line break becomes
 * ` [br] `. BBCode already in the text, and every other character, is left exactly as it is.
 *
 * @param text - Markdown-ish text, as the author wrote it.
 * @returns The text in BBCode, on one line.
 *
 * @example translate('**Who** wrote\n*Hamlet*?')  // => '[b]Who[/b] wrote [br] [i]Hamlet[/i]?'
 * @example translate('$$5 | $10')                 // => '$$5 | $10'
 */
export function translate(text: string): string {
  return markdownToBbcode(text).replaceAll(/\r\n|\r|\n/g, ' [br] ')
}

/**
 * `text` with its markdown emphasis written as BBCode: `**bold**` or `__bold__` as `[b]..[/b]`,
 * `*italic*` or `_italic_` as `[i]..[/i]`, nested however markdown nests them. A quoted line's
 * `> ` is written as four spaces, and a line indented four spaces or more is read as quoted, so
 * emphasis on it converts too and it keeps every space it had. What markdown does not read as
 * emphasis (`4 * 5 * 6`, `snake_case`, a code span, an escaped `\*`) and every other character
 * are left as written.
 *
 * @param text - Markdown-ish text.
 * @returns The same text, with its emphasis markers swapped for tags and its quote markers for spaces.
 *
 * @example markdownToBbcode('***both***')        // => '[i][b]both[/b][/i]'
 * @example markdownToBbcode('**bold _both_**')   // => '[b]bold [i]both[/i][/b]'
 * @example markdownToBbcode('4 * 5 * 6')         // => '4 * 5 * 6'
 * @example markdownToBbcode('>  *verse*')        // => '     [i]verse[/i]'
 * @example markdownToBbcode('     *verse*')      // => '     [i]verse[/i]'
 */
export function markdownToBbcode(text: string): string {
  // A quote marker, not a code block, where nothing would convert; written back out as the same four spaces.
  const quoted = Markdown.indentsAsQuotes(text)
  const quoteSplices: Splice[] = []
  const tree = fromMarkdown(quoted, {
    mdastExtensions: [{
      exit: {
        // A quote's marker on each line: the `>` and the one space after it, if there is one
        blockQuotePrefix: (token) => { quoteSplices.push({ beg: token.start.offset, end: token.end.offset, text: Indent }) },
      },
    }],
  })
  const splices = [...quoteSplices, ...splicesOf(tree)].toSorted((aa, bb) => aa.beg - bb.beg)
  // Each splice picks the text back up where the one before it left off.
  const spliced = splices.map((splice, ii) => quoted.slice(splices[ii - 1]?.end ?? 0, splice.beg) + splice.text)
  return spliced.join('') + quoted.slice(splices.at(-1)?.end ?? 0)
}

/** Where each emphasis marker under `node` sits, in document order, and the tag it becomes */
function splicesOf(node: MdNode): Splice[] {
  const children: MdNode[] = 'children' in node ? node.children : []
  const inner = children.flatMap((child) => splicesOf(child))
  const first = children.at(0)
  const last = children.at(-1)
  if (! first || ! last || (node.type !== 'strong' && node.type !== 'emphasis')) { return inner }
  const tag = node.type === 'strong' ? 'b' : 'i'
  // The markers are whatever lies between the node's edges and its content's.
  return [
    { beg: spanOf(node).beg, end: spanOf(first).beg, text: `[${tag}]` },
    ...inner,
    { beg: spanOf(last).end, end: spanOf(node).end, text: `[/${tag}]` },
  ]
}

/** Where a parsed node sits in its source */
function spanOf(node: MdNode): { beg: number, end: number } {
  const { start, end } = node.position ?? {}
  if (start?.offset === undefined || end?.offset === undefined) { throw new Error(`A parsed ${node.type} came back without its place in the text`) }
  return { beg: start.offset, end: end.offset }
}
