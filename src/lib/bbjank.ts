import type * as MT from 'mdast'
import { definitions as definitionsOf, type GetDefinition } from 'mdast-util-definitions'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { gfmAutolinkLiteralFromMarkdown } from 'mdast-util-gfm-autolink-literal'
import { gfmStrikethroughFromMarkdown } from 'mdast-util-gfm-strikethrough'
import { toString as textOf } from 'mdast-util-to-string'
import { gfmAutolinkLiteral } from 'micromark-extension-gfm-autolink-literal'
import { gfmStrikethrough } from 'micromark-extension-gfm-strikethrough'
import { normalizeUri } from 'micromark-util-sanitize-uri'
import _ from 'es-toolkit/compat'
import * as Markdown from './markdown'

/**
 * bbjank: the league's message-board BBCode, as tried on its boards. A different format from the
 * one its quiz import and the smith's note take (`ll-bbcode.ts`): here a line break is a line
 * break, a quote is `[quote="who"]` or an indenting `[list]`, and strikeout is a spoiler.
 */

/** The addresses a `[url]` may go to: the web, and nothing else */
const LinkProtocols = new Set(['http:', 'https:'])

/** The addresses an `[img]` may show: the secure web alone */
const ImageProtocols = new Set(['https:'])

/** What names a spoiler's annotation or a quote's speaker, and where it begins */
const AsMarker = '{AS:'

/** A quote that opens by naming its speaker, `{AS: who}`, and the space either side of it */
const QuoteAsRE = /^\s*\{AS:([^}\n]*)\}\s*/

/** The closing brace of a spoiler's annotation, and any space after it */
const AnnotationEndRE = /\}\s*$/

/** A line that opens a fenced code block, whose indented lines are code and not quotes */
const FenceOpenerRE = /^ {0,3}(?:```|~~~)/

/** What a carriage return comes to: one line break, however the text was typed */
const CarriageReturnRE = /\r\n?/g

/** The hosts a YouTube video is watched on, besides its short links' `youtu.be` */
const YoutubeHosts = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com'])

/** A YouTube address's path naming its video after a word: `/embed/ID`, `/shorts/ID` and the like */
const YoutubePathRE = /^\/(?:embed|shorts|live|v)\/([^/]+)/

/** What a YouTube video id looks like */
const YoutubeIdRE = /^[\w-]{11}$/

/** A thematic break (`---`), as the board shows one */
export const RuleLine = '-'.repeat(40)

/** How far a list item's lines past its first are set in, for the reader's sake: the board ignores it */
const ItemIndent = '  '

type FlowNode = MT.RootContent
/** What every writer needs from the document: its source, the lines put in to close a quote, and its link definitions by identifier, wherever in the document each stands */
type Context = { source: string, closers: Set<number>, definitions: GetDefinition }

/**
 * Markdown as the league's message boards take it. Strikeout becomes a spoiler; a quote opening
 * `{AS: who}` becomes `[quote="who"]`, any other quote an indenting `[list]`; every four spaces a
 * line opens with is a quote level, as an author indents verse, and a line is quoted exactly as
 * deep as it is indented (as the screen shows it: `Markdown.forScreen`). Bold and italics, lists, code,
 * links and https images become their tags, and an image of a YouTube video becomes an embed with
 * its caption. Line breaks stay line breaks. What markdown reads as HTML is written as the
 * characters typed, and BBCode already in the text passes through as typed (so `[u]` is how to
 * underline: markdown has no underline of its own). A link or image to an address off the web is
 * written as its text alone.
 *
 * @param markdown - Markdown, as the author wrote it (or as a template filled it).
 * @returns The same text in bbjank, ready to paste into a post.
 *
 * @example toBbjank('Answer: ~~**HAMILTON**~~')       // => 'Answer: [spoiler][b]HAMILTON[/b][/spoiler]'
 * @example toBbjank('~~dead {AS: the twist}~~')         // => '[spoiler=the twist]dead[/spoiler]'
 * @example toBbjank('> {AS: Q1}1. Who?')                // => '[quote="Q1"]1. Who?[/quote]'
 * @example toBbjank('> aside\n> > deeper')             // => '[list]aside\n[list]deeper[/list][/list]'
 * @example toBbjank('    verse')                        // => '[list]verse[/list]'
 * @example toBbjank('- one\n- two')                     // => '[list]\n[*] one\n[*] two[/list]'
 * @example toBbjank('[Ham](https://ex.com/ham)')        // => '[url=https://ex.com/ham]Ham[/url]'
 * @example toBbjank('<b>hi</b>')                        // => '<b>hi</b>'
 */
export function toBbjank(markdown: string): string {
  const { source, closers } = quotedByIndent(markdown.replaceAll(CarriageReturnRE, '\n'))
  const tree = parse(source)
  return blocksOf(tree.children, { source, closers, definitions: definitionsOf(tree) })
}

/**
 * `markdown` with its indents read as quotes, as `toBbjank` reads them before anything else: every
 * four spaces a line opens with a quote level (`> `), each line quoted as deep as it is indented,
 * and a list's, a fenced code block's and an HTML block's own indents left as they are. For a text
 * that is to be set inside a quote of its own, where an indent would read as code.
 *
 * @example indentsQuoted('Who wrote\n    *verse*')  // => 'Who wrote\n> *verse*'
 * @example indentsQuoted('- one\n    - two')       // => '- one\n    - two'
 */
export function indentsQuoted(markdown: string): string {
  return quotedByIndent(markdown.replaceAll(CarriageReturnRE, '\n')).source
}

/** The markdown's tree: CommonMark, with GFM's `~~strikeout~~` (never a single `~`) and bare web addresses */
function parse(source: string): MT.Root {
  return fromMarkdown(source, {
    extensions:      [gfmStrikethrough({ singleTilde: false }), gfmAutolinkLiteral()],
    mdastExtensions: [gfmStrikethroughFromMarkdown(), gfmAutolinkLiteralFromMarkdown()],
  })
}

/**
 * `text` with its indents read as quotes, as the screen reads them (`Markdown.forScreen`): four
 * spaces a quote level, each line quoted as deep as it is indented. A list's lines and a fenced
 * code block's are left as they are, their indents being markdown's own, and an HTML block's, which
 * is written as typed. Also the lines `forScreen` put in to close a deeper quote, counting from 1,
 * which are no blank line of the author's.
 */
function quotedByIndent(text: string): { source: string, closers: Set<number> } {
  const owned = parse(text).children
    .filter((node) => node.type === 'list' || node.type === 'html' || (node.type === 'code' && isFenced(node, text)))
    .map((node) => linesOf(node))
  const isOwned = (lineIdx: number) => owned.some(({ beg, end }) => beg <= lineIdx + 1 && lineIdx + 1 <= end)
  // Runs of lines, each wholly markdown's own or wholly the author's indents.
  const lines = text.split('\n')
  const runBegs = lines.keys().filter((lineIdx) => lineIdx === 0 || isOwned(lineIdx) !== isOwned(lineIdx - 1)).toArray()
  const marked = runBegs.flatMap((runBeg, ii) => {
    const run = lines.slice(runBeg, runBegs[ii + 1] ?? lines.length)
    return isOwned(runBeg) ? run.map((line) => ({ line, closer: false })) : screenedLines(run)
  })
  return {
    source:  marked.map(({ line }) => line).join('\n'),
    closers: new Set(marked.flatMap(({ closer }, ii) => (closer ? [ii + 1] : []))),
  }
}

/** `lines` as `Markdown.forScreen` writes them, each marked as one of the author's or a quote closer it put in */
function screenedLines(lines: readonly string[]): { line: string, closer: boolean }[] {
  const screened = Markdown.forScreen(lines.join('\n')).split('\n')
  // A closer stands just before an author's line, and is never what that line became.
  const marked: { line: string, closer: boolean }[] = []
  let taken = 0
  for (const line of screened) {
    const closer = Markdown.indentsAsQuotes(lines[taken] ?? '') !== line
    if (! closer) { taken += 1 }
    marked.push({ line, closer })
  }
  return marked
}

/** Whether a code block was fenced, rather than indented */
function isFenced(code: MT.Code, text: string): boolean {
  return FenceOpenerRE.test(text.slice(code.position?.start.offset ?? 0))
}

/** The lines a node covers, first and last, counting from 1 */
function linesOf(node: MT.Node): { beg: number, end: number } {
  return { beg: node.position?.start.line ?? 0, end: node.position?.end.line ?? 0 }
}

/**
 * Blocks one after another, as far apart as the author set them: a blank line between blocks
 * that had one, a line break between blocks that touched. A block that comes to nothing is left out.
 */
function blocksOf(nodes: readonly FlowNode[], ctx: Context): string {
  const written = nodes.map((node) => ({ node, text: blockOf(node, ctx) })).filter(({ text }) => text !== '')
  return written.map(({ node, text }, ii) => {
    const prev = written[ii - 1]?.node
    if (! prev) { return text }
    return (isBlankBetween(prev, node, ctx) ? '\n\n' : '\n') + text
  }).join('')
}

/** Whether the author left a blank line between two blocks: a line between them that is not a quote closer */
function isBlankBetween(prev: MT.Node, next: MT.Node, ctx: Context): boolean {
  const between = Array.from({ length: Math.max(0, linesOf(next).beg - linesOf(prev).end - 1) }, (_, ii) => linesOf(prev).end + 1 + ii)
  return between.some((lineNum) => ! ctx.closers.has(lineNum))
}

/** One block, in bbjank */
function blockOf(node: FlowNode, ctx: Context): string {
  switch (node.type) {
  case 'paragraph':     { return _.trim(inlinesOf(node.children, ctx), '\n') }
  case 'heading':       { return `[b]${inlinesOf(node.children, ctx)}[/b]` }
  case 'blockquote':    { return quoteOf(node, ctx) }
  case 'list':          { return listOf(node, ctx) }
  case 'code':          { return `[code]\n${node.value}\n[/code]` }
  case 'thematicBreak': { return RuleLine }
  case 'html':          { return node.value }
  case 'definition':    { return '' }
  default:              { return textOf(node) }
  }
}

/**
 * A quote: `[quote="who"]` when it opens with `{AS: who}` (the marker taken off), otherwise a
 * `[list]`, which the board shows indented. A quote within a quote is a `[list]` within it. An
 * unnamed quote that comes to nothing (a link definition alone, or no text) is nothing.
 */
function quoteOf(quote: MT.Blockquote, ctx: Context): string {
  const [first, ...rest] = quote.children
  const paragraph = first?.type === 'paragraph' ? first : undefined
  const [opener, ...after] = paragraph?.children ?? []
  const named = opener?.type === 'text' ? QuoteAsRE.exec(opener.value) : null
  if (! named || ! paragraph || opener?.type !== 'text') {
    const inner = blocksOf(quote.children, ctx)
    return inner ? `[list]${inner}[/list]` : ''
  }
  const shorn: MT.Paragraph = { ...paragraph, children: [{ ...opener, value: opener.value.slice(named[0].length) }, ...after] }
  return `[quote="${tagArgOf(named[1] ?? '')}"]${blocksOf([shorn, ...rest], ctx)}[/quote]`
}

/**
 * A list: `[list]`, or `[list=1]` for a numbered one (the board numbers from 1 whatever it is
 * told), then each item on a line of its own after `[*] `, the closing tag after the last. An
 * item's further lines, a list within it among them, are set in a little.
 */
function listOf(list: MT.List, ctx: Context): string {
  const items = list.children.map((item) => {
    const blocks = item.children.map((child) => blockOf(child, ctx)).filter((text) => text !== '')
    return ('[*] ' + blocks.join('\n').split('\n').join('\n' + ItemIndent)).trimEnd()
  })
  return `${list.ordered ? '[list=1]' : '[list]'}\n${items.join('\n')}[/list]`
}

/** A run of inline markdown, in bbjank */
function inlinesOf(nodes: readonly MT.PhrasingContent[], ctx: Context): string {
  return nodes.map((node) => inlineOf(node, ctx)).join('')
}

/** One piece of inline markdown, in bbjank; what this writer does not know is written as its text */
function inlineOf(node: MT.PhrasingContent, ctx: Context): string {
  switch (node.type) {
  case 'text':           { return node.value }
  case 'html':           { return node.value }
  case 'strong':         { return `[b]${inlinesOf(node.children, ctx)}[/b]` }
  case 'emphasis':       { return `[i]${inlinesOf(node.children, ctx)}[/i]` }
  case 'delete':         { return spoilerOf(node, ctx) }
  case 'inlineCode':     { return `[code]${node.value}[/code]` }
  case 'break':          { return '\n' }
  case 'link':           { return linkOf(node, ctx, isBare(node, ctx)) }
  case 'image':          { return imageOf(node) }
  case 'linkReference':  { return referenceOf(node, ctx) }
  case 'imageReference': { return imageOf({ type: 'image', url: ctx.definitions(node.identifier)?.url ?? '', alt: node.alt }) }
  default:               { return textOf(node) }
  }
}

/**
 * Strikeout as a spoiler. From `{AS:` to the strikeout's end is the spoiler's annotation, its
 * closing brace dropped: `~~dead {AS: the twist}~~` is `[spoiler=the twist]dead[/spoiler]`.
 */
function spoilerOf(strikeout: MT.Delete, ctx: Context): string {
  const markIdx = strikeout.children.findIndex((child) => child.type === 'text' && child.value.includes(AsMarker))
  const marked = strikeout.children[markIdx]
  if (marked?.type !== 'text') { return `[spoiler]${inlinesOf(strikeout.children, ctx)}[/spoiler]` }
  const cut = marked.value.indexOf(AsMarker)
  const shown = inlinesOf([...strikeout.children.slice(0, markIdx), { type: 'text', value: marked.value.slice(0, cut) }], ctx)
  const annotation = [marked.value.slice(cut + AsMarker.length), ...strikeout.children.slice(markIdx + 1).map((child) => textOf(child))].join('')
  const label = tagArgOf(annotation.replace(AnnotationEndRE, ''))
  const opening = label ? `[spoiler=${label}]` : '[spoiler]'
  return `${opening}${shown.trimEnd()}[/spoiler]`
}

/**
 * A link: `[url]address[/url]` for an address written bare, otherwise `[url=address]text[/url]`,
 * even when the text is empty. A YouTube image inside it becomes an embed, captioned by the
 * link. A link off the web is written as its text alone.
 */
function linkOf(link: MT.Link, ctx: Context, bare: boolean): string {
  const href = hrefOf(link.url, LinkProtocols)
  const video = link.children.find((child): child is MT.Image => child.type === 'image' && youtubeIdOf(child.url) !== undefined)
  if (video) {
    const caption = [video.alt ?? '', inlinesOf(link.children.filter((child) => child !== video), ctx)].map((text) => text.trim()).filter(Boolean).join(' ')
    return embedOf(video.url, href ?? hrefOf(video.url, LinkProtocols), caption)
  }
  const text = inlinesOf(link.children, ctx)
  if (! href) { return text }
  return bare ? `[url]${href}[/url]` : `[url=${href}]${text}[/url]`
}

/** A reference-style link (`[text][label]`), written as the link its definition makes it */
function referenceOf(reference: MT.LinkReference, ctx: Context): string {
  const definition = ctx.definitions(reference.identifier)
  if (! definition) { return inlinesOf(reference.children, ctx) }
  return linkOf({ type: 'link', url: definition.url, children: reference.children }, ctx, false)
}

/** Whether a link is an address written bare (`<https://ex.com>`, or just `https://ex.com`), rather than bracketed text */
function isBare(link: MT.Link, ctx: Context): boolean {
  return ! ctx.source.startsWith('[', link.position?.start.offset ?? 0)
}

/**
 * An image: a YouTube video's becomes an embed, captioned by its alt text as a link to it;
 * an https one becomes `[img]`, its alt text on the line below in parentheses (the board shows no
 * alt text of its own). Any other is written as its alt text alone.
 */
function imageOf(image: MT.Image): string {
  const href = hrefOf(image.url, ImageProtocols)
  const alt = image.alt ?? ''
  if (youtubeIdOf(image.url)) { return embedOf(image.url, hrefOf(image.url, LinkProtocols), alt) }
  if (! href) { return alt }
  return alt ? `[img]${href}[/img]\n[list](${alt})[/list]` : `[img]${href}[/img]`
}

/**
 * A YouTube embed, set apart by blank lines, and its caption below it as a link: left out when
 * there is no caption, and written as plain text when there is nowhere safe to link it to.
 */
function embedOf(url: string, href: string | undefined, caption: string): string {
  const embed = `\n\n[youtube]${youtubeIdOf(url) ?? ''}[/youtube]\n\n`
  if (! caption) { return embed }
  return embed + (href ? `[url=${href}]${caption}[/url]` : caption) + '\n\n'
}

/**
 * The video a YouTube address names, if it is one: `watch?v=`, a `youtu.be` short link, or an
 * `/embed/`, `/shorts/`, `/live/` or `/v/` path, on the web.
 *
 * @example youtubeIdOf('https://www.youtube.com/watch?v=SZXHoWwBcDc')  // => 'SZXHoWwBcDc'
 * @example youtubeIdOf('https://youtu.be/SZXHoWwBcDc?t=3')             // => 'SZXHoWwBcDc'
 * @example youtubeIdOf('https://ex.com/watch?v=SZXHoWwBcDc')           // => undefined
 */
export function youtubeIdOf(url: string): string | undefined {
  if (! URL.canParse(url)) { return undefined }
  const { protocol, hostname, pathname, searchParams } = new URL(url)
  if (! LinkProtocols.has(protocol)) { return undefined }
  const candidate = YoutubeHosts.has(hostname) ? watchedOf(pathname, searchParams) : undefined
  const shortened = hostname === 'youtu.be' ? pathname.slice(1) : candidate
  return shortened && YoutubeIdRE.test(shortened) ? shortened : undefined
}

/** The video a youtube.com address's path and query name: `watch?v=ID`, or `/embed/ID` and the like */
function watchedOf(pathname: string, searchParams: URLSearchParams): string | undefined {
  if (pathname === '/watch') { return searchParams.get('v') ?? undefined }
  return YoutubePathRE.exec(pathname)?.[1]
}

/**
 * `url` as a tag may carry it, if it goes somewhere `protocols` allows: percent-encoded, so no
 * bracket, quote or space in it can end the tag early. A relative address goes nowhere on a board.
 */
function hrefOf(url: string, protocols: ReadonlySet<string>): string | undefined {
  const href = normalizeUri(url)
  if (! URL.canParse(href)) { return undefined }
  return protocols.has(new URL(href).protocol) ? href : undefined
}

/** A spoiler's annotation or a quote's speaker as an opening tag may carry it: trimmed, its brackets and double quotes softened */
function tagArgOf(text: string): string {
  return text.trim().replaceAll('[', '(').replaceAll(']', ')').replaceAll('"', "'")
}
