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
 * allowlist; widen it here, and nowhere else.
 */
export const Allowlist: SanitizeSchema = {
  tagNames:   ['p', 'br', 'em', 'strong', 'blockquote', 'ul', 'ol', 'li', 'code', 'pre', 'a', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
  attributes: { a: ['href', 'title'], ol: ['start'] },
  protocols:  { href: ['http', 'https', 'mailto'] },
}

/**
 * How `react-markdown` renders a field: every line break is a break, as the author typed it and
 * the LL export writes it; HTML typed into a field is shown as the characters typed, never
 * built; and what comes out passes the allowlist.
 */
export const RenderOptions: Readonly<Pick<ReactMarkdownOptions, 'remarkPlugins' | 'remarkRehypeOptions' | 'rehypePlugins'>> = {
  remarkPlugins:       [remarkBreaks],
  remarkRehypeOptions: { handlers: { html: (_state: unknown, html: { value: string }) => ({ type: 'text', value: html.value }) } },
  rehypePlugins:       [[rehypeSanitize, Allowlist]],
}

/** The run of four-space indents a line opens with, one per quote level */
const IndentsRE = /^(?: {4})+/

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
  return text.replaceAll(new RegExp(IndentsRE, 'gm'), (run) => '> '.repeat(run.length / 4))
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
