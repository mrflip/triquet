import type * as MT from 'mdast'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { gfmAutolinkLiteralFromMarkdown } from 'mdast-util-gfm-autolink-literal'
import { gfmStrikethroughFromMarkdown } from 'mdast-util-gfm-strikethrough'
import { gfmAutolinkLiteral } from 'micromark-extension-gfm-autolink-literal'
import { gfmStrikethrough } from 'micromark-extension-gfm-strikethrough'
import type { Options as ReactMarkdownOptions } from 'react-markdown'
import rehypeSanitize, { type Options as SanitizeSchema } from 'rehype-sanitize'
import remarkBreaks from 'remark-breaks'

/**
 * The markdown a quiz's text is written in, our dialect of it (`notes/markdown.md`): what the
 * screen draws of it, and what the league's two outputs read of it, so all three agree on what a
 * quoted line, a line break or a strikeout is.
 */

/**
 * The elements a field's markdown may become on screen, and the one attribute worth keeping on
 * each. Anything else markdown makes is dropped and its text kept: an image, whose address would
 * be fetched on sight, comes to nothing. Links go only to the web or to mail. This is the one
 * allowlist; widen it here, and nowhere else (`TemplatedAllowlist` is this one, with images).
 */
export const Allowlist: SanitizeSchema = {
  tagNames:   ['p', 'br', 'em', 'strong', 'del', 'blockquote', 'ul', 'ol', 'li', 'code', 'pre', 'a', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
  attributes: { a: ['href', 'title'], ol: ['start'] },
  protocols:  { href: ['http', 'https', 'mailto'] },
}

/**
 * An image's address, as the templated allowlist keeps one: a whole `https` address, naming its
 * host. The sanitizer's own protocol check lets a relative address through (`/api/..`, or
 * `//elsewhere`, which takes the page's scheme), so the address is held to this as well.
 */
const ImageSrcRE = /^https:\/\/[^\s/\\]/

/**
 * The allowlist for a field the quiz templates (`Templating`): the one allowlist, and images too,
 * by a whole `https` address only, with their alt text. A templated field is one the author asked
 * to have filled in, images and all; every other field still fetches nothing on sight.
 */
export const TemplatedAllowlist: SanitizeSchema = {
  tagNames:   [...Allowlist.tagNames ?? [], 'img'],
  attributes: { ...Allowlist.attributes, img: [['src', ImageSrcRE], 'alt'] },
  protocols:  { ...Allowlist.protocols, src: ['https'] },
}

/** Strikeout, as the dialect has it: `~~text~~`, and never a single `~`, which trivia needs for `~50 years` */
const strikeoutSyntax = () => gfmStrikethrough({ singleTilde: false })

/** What a remark plugin that teaches the parser a syntax adds to: the processor's lists of parser extensions */
type ParserData = { micromarkExtensions?: unknown[], fromMarkdownExtensions?: unknown[] }

/**
 * The dialect's strikeout for `react-markdown` (`~~struck~~`, never `~50 years`), which it shows as
 * `del`. A remark plugin of GFM's one extension, since `remark-gfm` comes whole and takes a single `~`.
 */
function remarkStrikeout(this: { data: () => object }): void {
  // unified types its data bare until remark-parse's types register these two lists, which are where its parser looks
  const data = this.data() as ParserData
  data.micromarkExtensions = [...data.micromarkExtensions ?? [], strikeoutSyntax()]
  data.fromMarkdownExtensions = [...data.fromMarkdownExtensions ?? [], gfmStrikethroughFromMarkdown()]
}

/** The parse every field's markdown gets, and the sanitizing pass, always the last step, under `schema` */
function renderOptionsFor(schema: SanitizeSchema): Readonly<Pick<ReactMarkdownOptions, 'remarkPlugins' | 'remarkRehypeOptions' | 'rehypePlugins'>> {
  return {
    remarkPlugins:       [remarkStrikeout, remarkBreaks],
    remarkRehypeOptions: { handlers: { html: (_state: unknown, html: { value: string }) => ({ type: 'text', value: html.value }) } },
    rehypePlugins:       [[rehypeSanitize, schema]],
  }
}

/**
 * How `react-markdown` renders a field: every line break is a break, as the author typed it and
 * the LL export writes it; `~~strikeout~~` is struck through; HTML typed into a field is shown as
 * the characters typed, never built; and what comes out passes the allowlist. Hand it the text as
 * `indentsQuoted` writes it.
 */
export const RenderOptions = renderOptionsFor(Allowlist)

/**
 * How `react-markdown` renders a templated field, once it is filled in: as any field, but
 * passing the templated allowlist, which keeps images.
 */
export const TemplatedRenderOptions = renderOptionsFor(TemplatedAllowlist)

/**
 * `source`'s tree, as the league's outputs read it: CommonMark, with strikeout (`~~text~~`, never a
 * single `~`) and bare web addresses (`https://..`, `www.`) as links.
 *
 * @example treeOf('~~gone~~ ~50').children[0]  // => a paragraph holding a `delete` and the text ' ~50'
 */
export function treeOf(source: string): MT.Root {
  return fromMarkdown(source, {
    extensions:      [strikeoutSyntax(), gfmAutolinkLiteral()],
    mdastExtensions: [gfmStrikethroughFromMarkdown(), gfmAutolinkLiteralFromMarkdown()],
  })
}

/** The run of four-space indents a line opens with, one per quote level */
const IndentsRE = /^(?: {4})+/

/** A line that opens a fenced code block, whose indented lines are code and not quotes */
const FenceOpenerRE = /^ {0,3}(?:```|~~~)/

/** What a carriage return comes to: one line break, however the text was typed */
const CarriageReturnRE = /\r\n?/g

/** `line` with each four spaces it opens with as a quote marker, `> `; spaces short of another four kept */
function lineQuotedOf(line: string): string {
  return line.replace(IndentsRE, (run) => '> '.repeat(run.length / 4))
}

/** How many quote levels a line's indent makes */
function depthOf(line: string): number {
  return (IndentsRE.exec(line)?.[0].length ?? 0) / 4
}

/**
 * Whether each line of `text` (by its index, from 0) is indented by markdown's own rules rather
 * than the author's: a top-level list's lines, a fenced code block's, an HTML block's.
 */
function markdownsOwnLinesOf(text: string): (lineIdx: number) => boolean {
  const owned = treeOf(text).children
    .filter((node) => node.type === 'list' || node.type === 'html' || (node.type === 'code' && isFenced(node, text)))
    .map(({ position }) => ({ beg: position?.start.line ?? 0, end: position?.end.line ?? 0 }))
  return (lineIdx) => owned.some(({ beg, end }) => beg <= lineIdx + 1 && lineIdx + 1 <= end)
}

/** Whether a code block was fenced, rather than indented */
function isFenced(code: MT.Code, text: string): boolean {
  return FenceOpenerRE.test(text.slice(code.position?.start.offset ?? 0))
}

/**
 * **The indent rule**, the dialect's own, line by line: each four spaces a line opens with is a
 * quote marker instead, one level for each. To markdown those spaces would start a code block; to
 * an author they indent a line of verse, which is a quote, and eight spaces indent it twice. Spaces
 * short of another four are kept. A list's, a fenced code block's and an HTML block's lines keep
 * their indents, which are markdown's own. The LL export reads text this way, each line keeping its
 * own indent; the screen and bbjank take `indentsQuoted`, which also follows the indents out.
 *
 * @param text - Markdown-ish text.
 * @returns The same text, with each four leading spaces of a line as `> `.
 *
 * @example indentsAsQuotes('    *verse*')      // => '> *verse*'
 * @example indentsAsQuotes('        deeper')   // => '> > deeper'
 * @example indentsAsQuotes('      between')    // => '>   between'
 * @example indentsAsQuotes('prose\n   not')    // => 'prose\n   not'
 * @example indentsAsQuotes('- a\n    - b')     // => '- a\n    - b'
 */
export function indentsAsQuotes(text: string): string {
  const isOwned = markdownsOwnLinesOf(text)
  return text.split('\n').map((line, lineIdx) => (isOwned(lineIdx) ? line : lineQuotedOf(line))).join('\n')
}

/**
 * Markdown as the dialect reads it, before anything renders it (on screen, in bbjank): the indent
 * rule (`indentsAsQuotes`), and every line quoted exactly as deep as it is indented. Markdown
 * would carry a line on into the quote above it (`lazy continuation`), so where the indent steps
 * back, a line quoted only as deep as the next one closes the deeper quote first. The LL export
 * needs no such line: it writes each line's own indent, however markdown groups them.
 *
 * @param text - Markdown-ish text, as the author wrote it (or a template filled it).
 * @returns Markdown whose quotes follow the indents.
 *
 * @example indentsQuoted('    verse\nWho?')          // => '> verse\n\nWho?'
 * @example indentsQuoted('        two\n    one')     // => '> > two\n>\n> one'
 * @example indentsQuoted('    one\n        two')     // => '> one\n> > two'
 * @example indentsQuoted('- one\n    - two')         // => '- one\n    - two'
 */
export function indentsQuoted(text: string): string {
  return quotedByIndent(text).source
}

/** Markdown as `indentsQuoted` writes it, and the lines it put in to close a deeper quote, counting from 1 */
export type IndentsQuotedT = {
  source:  string
  /** The lines put in to close a quote, which are no blank line of the author's */
  closers: ReadonlySet<number>
}

/**
 * `text` as `indentsQuoted` writes it, and which of its lines are the ones put in to close a
 * deeper quote: a writer that keeps the author's blank lines (bbjank) passes over those.
 *
 * @example quotedByIndent('    verse\nWho?')   // => { source: '> verse\n\nWho?', closers: Set { 2 } }
 */
export function quotedByIndent(text: string): IndentsQuotedT {
  const normal = text.replaceAll(CarriageReturnRE, '\n')
  const isOwned = markdownsOwnLinesOf(normal)
  // Runs of lines, each wholly markdown's own indents or wholly the author's.
  const lines = normal.split('\n')
  const runBegs = lines.keys().filter((lineIdx) => lineIdx === 0 || isOwned(lineIdx) !== isOwned(lineIdx - 1)).toArray()
  const marked = runBegs.flatMap((runBeg, ii) => {
    const run = lines.slice(runBeg, runBegs[ii + 1] ?? lines.length)
    return isOwned(runBeg) ? run.map((line) => ({ line, closer: false })) : closedLines(run)
  })
  return {
    source:  marked.map(({ line }) => line).join('\n'),
    closers: new Set(marked.flatMap(({ closer }, ii) => (closer ? [ii + 1] : []))),
  }
}

/**
 * The author's `lines` under the indent rule, each quoted as deep as it is indented: a line that
 * steps back out of a deeper quote has a closing line put in before it, marked as a closer.
 */
function closedLines(lines: readonly string[]): { line: string, closer: boolean }[] {
  return lines.flatMap((line, ii) => {
    const depth = depthOf(line)
    const steppedBack = ii > 0 && depth < depthOf(lines[ii - 1] ?? '') && line.trim() !== ''
    const quoted = { line: lineQuotedOf(line), closer: false }
    return steppedBack ? [{ line: '> '.repeat(depth).trimEnd(), closer: true }, quoted] : [quoted]
  })
}
