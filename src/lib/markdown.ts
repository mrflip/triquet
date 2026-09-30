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

/**
 * `text` with each line that opens with four spaces opening with a quote marker instead. To
 * markdown, those spaces would start a code block; to an author they indent a line of verse,
 * which is a quote.
 *
 * @param text - Markdown-ish text.
 * @returns The same text, with the first four spaces of an indented line as `> `.
 *
 * @example indentsAsQuotes('    *verse*')    // => '> *verse*'
 * @example indentsAsQuotes('      deeper')   // => '>   deeper'
 * @example indentsAsQuotes('prose\n   not')  // => 'prose\n   not'
 */
export function indentsAsQuotes(text: string): string {
  return text.replaceAll(/^ {4}/gm, '> ')
}
