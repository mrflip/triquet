import * as EST from 'es-toolkit'
import * as Markdown from './markdown'

/**
 * Shapers: markdown an author wrote, made safe to set into a place in a template where
 * markdown's structure is fragile. A clueing's second line leaves the quote its first line
 * opened; an answer's second line leaves the `~~**...**~~` around it; a recap opening `---` makes
 * the line above it a heading. Each shaper takes the text and hands back the text that keeps its
 * place. The recap bag's pre-shaped fields (`quoted.clueing`, ...) and the template helpers
 * (`{{#quote}}..{{/quote}}`, `Templating.Helpers`) are both made by these.
 */

/** A line markdown would read as underlining the line above it into a heading */
const SetextUnderlineRE = /^ {0,3}(?:=+|-+)[ \t]*$/

/**
 * `text` (a clueing, say), to follow a `> ` the template opened on its line: its indents read as
 * quotes, by the dialect's indent rule (`Markdown.indentsQuoted`), so none reads as code inside
 * the quote; every line after its first opening `> `, so none leaves the quote; blank lines at
 * either end dropped. A text opening with a quote of its own starts on the line below.
 *
 * @example quotedOf('Who?\n\nNot him')         // => 'Who?\n>\n> Not him'
 * @example quotedOf('Who wrote\n    *verse*')  // => 'Who wrote\n> > *verse*'
 */
export function quotedOf(text: string): string {
  const lines = trimmedLines(Markdown.indentsQuoted(text))
  const opened = lines[0]?.startsWith('>') ? ['', ...lines] : lines
  return opened.map((line, ii) => {
    if (ii === 0) { return line }
    return line === '' ? '>' : `> ${line}`
  }).join('\n')
}

/**
 * `text` on one line: each line trimmed, the blank ones dropped, the rest joined by a space.
 *
 * @example oneLineOf('HAMILTON\n\n(accept ROWAN)\n')  // => 'HAMILTON (accept ROWAN)'
 */
export function oneLineOf(text: string): string {
  return text.split('\n').map((line) => line.trim()).filter((line) => line !== '').join(' ')
}

/**
 * `text` (a recap, say), to set on the line straight after another: blank lines at either end
 * dropped, and a first line that would underline the line above into a heading (`---`, `===`)
 * set a blank line apart from it.
 *
 * @example belowOf('Aced.\n')        // => 'Aced.'
 * @example belowOf('---\nAfter.')    // => '\n---\nAfter.'
 */
export function belowOf(text: string): string {
  const lines = trimmedLines(text)
  const below = lines.join('\n')
  return SetextUnderlineRE.test(lines[0] ?? '') ? `\n${below}` : below
}

/** Whether `line` holds nothing but space */
function isBlank(line: string): boolean {
  return line.trim() === ''
}

/** `text`'s lines, without the blank ones at either end */
function trimmedLines(text: string): string[] {
  return EST.dropRightWhile(EST.dropWhile(text.replaceAll('\r\n', '\n').split('\n'), isBlank), isBlank)
}
