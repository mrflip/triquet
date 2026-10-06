import type { Options as ReactMarkdownOptions } from 'react-markdown'
import rehypeSanitize, { type Options as SanitizeSchema } from 'rehype-sanitize'
import remarkBreaks from 'remark-breaks'

/**
 * The markdown a quiz's text is written in: what the screen draws of it, and what the LL export
 * reads of it, so the two agree on what a quoted line or a line break is.
 */

/**
 * The elements a field's markdown may become on screen, and the one attribute worth keeping on
 * each. Anything else markdown makes is dropped and its text kept: an image, whose address would
 * be fetched on sight, comes to nothing. Links go only to the web or to mail. This is the one
 * allowlist; widen it here, and nowhere else (`TemplatedAllowlist` is this one, with images).
 */
export const Allowlist: SanitizeSchema = {
  tagNames:   ['p', 'br', 'em', 'strong', 'blockquote', 'ul', 'ol', 'li', 'code', 'pre', 'a', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
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

/** The parse every field's markdown gets, and the sanitizing pass, always the last step, under `schema` */
function renderOptionsFor(schema: SanitizeSchema): Readonly<Pick<ReactMarkdownOptions, 'remarkPlugins' | 'remarkRehypeOptions' | 'rehypePlugins'>> {
  return {
    remarkPlugins:       [remarkBreaks],
    remarkRehypeOptions: { handlers: { html: (_state: unknown, html: { value: string }) => ({ type: 'text', value: html.value }) } },
    rehypePlugins:       [[rehypeSanitize, schema]],
  }
}

/**
 * How `react-markdown` renders a field: every line break is a break, as the author typed it and
 * the LL export writes it; HTML typed into a field is shown as the characters typed, never
 * built; and what comes out passes the allowlist.
 */
export const RenderOptions = renderOptionsFor(Allowlist)

/**
 * How `react-markdown` renders a templated field, once it is filled in: as any field, but
 * passing the templated allowlist, which keeps images.
 */
export const TemplatedRenderOptions = renderOptionsFor(TemplatedAllowlist)

/** The run of four-space indents a line opens with, one per quote level */
const IndentsRE = /^(?: {4})+/
const IndentsREMulti = new RegExp(IndentsRE, 'gm')

/**
 * `text` with each four spaces a line opens with written as a quote marker instead, one level for
 * each. To markdown, those spaces would start a code block; to an author they indent a line of
 * verse, which is a quote, and eight spaces indent it twice. Spaces short of another four are kept.
 *
 * @param text - Markdown-ish text.
 * @returns The same text, with each four leading spaces of a line as `> `.
 *
 * @example indentsAsQuotes('    *verse*')      // => '> *verse*'
 * @example indentsAsQuotes('        deeper')   // => '> > deeper'
 * @example indentsAsQuotes('      between')    // => '>   between'
 * @example indentsAsQuotes('prose\n   not')    // => 'prose\n   not'
 */
export function indentsAsQuotes(text: string): string {
  return text.replaceAll(IndentsREMulti, (run) => '> '.repeat(run.length / 4))
}

/** How many quote levels a line's indent makes */
function depthOf(line: string): number {
  return (IndentsRE.exec(line)?.[0].length ?? 0) / 4
}

/**
 * `text` as the screen parses it: indents as quotes, and every line quoted exactly as deep as it
 * is indented. Markdown would carry a line on into the quote above it (`lazy continuation`), so
 * where the indent steps back, a line quoted only as deep as the next one closes the deeper quote
 * first. The LL export needs no such line: it writes each line's own indent, however markdown
 * groups them.
 *
 * @param text - Markdown-ish text.
 * @returns Markdown whose quotes follow the indents.
 *
 * @example forScreen('    verse\nWho?')          // => '> verse\n\nWho?'
 * @example forScreen('        two\n    one')     // => '> > two\n>\n> one'
 * @example forScreen('    one\n        two')     // => '> one\n> > two'
 */
export function forScreen(text: string): string {
  const lines = text.split('\n')
  return lines.flatMap((line, ii) => {
    const depth = depthOf(line)
    const steppedBack = ii > 0 && depth < depthOf(lines[ii - 1] ?? '') && line.trim() !== ''
    return steppedBack ? ['> '.repeat(depth).trimEnd(), indentsAsQuotes(line)] : [indentsAsQuotes(line)]
  }).join('\n')
}
