import Mustache, { type TemplateSpans } from 'mustache'
import * as UU from '../useful'
import { OwnKeysContext } from '../mustachery'

/** The kinds of template span that read a key of the input: `{{name}}`, `{{{name}}}`, `{{#name}}`, `{{^name}}` */
const ReadingSpans: ReadonlySet<string> = new Set(['name', '&', '#', '^'])

/**
 * `template`, a mustache prompt template, rendered over `input`.
 *
 * Nothing is HTML-escaped: the prompt is prose for a model, never a page. A string fills in as
 * it is; any other value fills in as its JSON, so `{{items}}` over a list of spans reads as the
 * list rather than as `[object Object]`. A key the input lacks fills in as nothing, and so does
 * anything past the input's own keys (`{{constructor}}`) or a function in it: the template reads
 * the input, and calls nothing (`OwnKeysContext`).
 *
 * @param template - A prompt template, as an `aibot` widget's formula holds it.
 * @param input - What the widget's input formula came to.
 * @returns The prompt as it will be sent.
 * @throws When the template does not parse (an unclosed section, say); `templateIssue` names it first.
 *
 * @example renderPrompt('Question: {{clueing}}', { clueing: 'Who?' })  // => 'Question: Who?'
 * @example renderPrompt('Spans: {{items}}', { items: [1, 2] })        // => 'Spans: [1,2]'
 */
export function renderPrompt(template: string, input: Readonly<Record<string, unknown>>): string {
  return Mustache.render(template, new OwnKeysContext(input), {}, { escape: fillingOf })
}

/**
 * What is wrong with `template` as a prompt template, or null when nothing is: a template that
 * does not parse, or one that fills a key in raw (`{{{name}}}` or `{{&name}}`), which would fill a
 * list or an object in as `[object Object]` where `{{name}}` fills it in as its JSON.
 *
 * @example templateIssue('{{#items}}{{text}}')  // => 'Unclosed section "items" at 18'
 * @example templateIssue('Question: {{{clueing}}}')  // => '{{{clueing}}} would fill a list or an object in as [object Object]: write {{clueing}}, ...'
 * @example templateIssue('Question: {{clueing}}')  // => null
 */
export function templateIssue(template: string): string | null {
  return parseIssue(template) ?? rawTagIssue(template)
}

/**
 * The keys of the input a template reads at its top level and `input` does not hold: each fills
 * in as nothing. A key read only inside a section is the section's business, and is left out.
 *
 * @param template - A prompt template; one that does not parse reads nothing.
 * @param input - What the template is rendered over.
 * @returns The keys, in the order the template first reads them.
 *
 * @example unfilledKeys('{{clueing}} {{hint}}', { clueing: 'Who?' })  // => ['hint']
 * @example unfilledKeys('{{qn.hint}}', { qn: {} })                   // => []
 */
export function unfilledKeys(template: string, input: Readonly<Record<string, unknown>>): string[] {
  if (parseIssue(template) !== null) { return [] }
  const keys = readKeys(Mustache.parse(template)).map((key) => key.split('.', 1)[0] ?? key)
  return [...new Set(keys)].filter((key) => key !== '' && ! Object.hasOwn(input, key))
}

/** The keys the top level of a parsed template reads, `.` (the whole context) aside */
function readKeys(spans: TemplateSpans): string[] {
  return spans
    .filter(([spankind]) => ReadingSpans.has(spankind))
    .map(([, key]) => key)
    .filter((key) => key !== '.')
}

/** What one value fills in as: a string as it is, anything else as its JSON */
function fillingOf(val: unknown): string {
  return typeof val === 'string' ? val : UU.jsonify(val)
}

/** Why `template` does not parse as mustache, or null when it does */
function parseIssue(template: string): string | null {
  try {
    Mustache.parse(template)
    return null
  } catch (err) {
    return err instanceof Error ? err.message : 'The prompt does not read as a template'
  }
}

/** The first tag of a template that parses which fills a key in raw, said with what to write instead; null when none does */
function rawTagIssue(template: string): string | null {
  const raw = rawSpansOf(Mustache.parse(template))[0]
  if (raw === undefined) { return null }
  const [, key, beg, end] = raw
  return `${template.slice(beg, end)} would fill a list or an object in as [object Object]: write {{${key}}}, which fills in text as it is and anything else as its JSON`
}

/** Every span of a parsed template, its sections' included, that fills a key in raw */
function rawSpansOf(spans: TemplateSpans): TemplateSpans {
  return spans.flatMap((span) => {
    if (span[0] === '&') { return [span] }
    const inner = span[4]
    return Array.isArray(inner) ? rawSpansOf(inner) : []
  })
}
