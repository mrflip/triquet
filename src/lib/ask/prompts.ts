import * as UU from '../useful'
import * as Formulas from '../formulas'
import * as Liquidry from '../liquidry'

/** What one value fills in as: nothing for none, a string as it is, anything else as its JSON */
function fillingOf(val: unknown): string {
  if (val === null || val === undefined) { return '' }
  return typeof val === 'string' ? val : UU.jsonify(val)
}

/** The language every prompt template is read and rendered with: Liquid, as `Liquidry` holds it, with no filters of the app's */
const Renderer = Liquidry.rendererFor({ fillingOf })

/**
 * `template`, a Liquid prompt template, rendered over `input`.
 *
 * Nothing is HTML-escaped: the prompt is prose for a model, never a page. A string fills in as
 * it is; any other value fills in as its JSON, so `{{ items }}` over a list of spans reads as the
 * list rather than as `[object Object]`. A key the input lacks fills in as nothing, and so does
 * anything past the input's own keys (`{{ constructor }}`). A function in the input is dropped
 * before the template reads it, so nothing is ever called.
 *
 * @param template - A prompt template, as an `aibot` widget's formula holds it.
 * @param input - What the widget's input formula came to.
 * @returns The prompt as it will be sent.
 * @throws When the template does not read, or reads too much; `templateIssue` names the first first.
 *
 * @example renderPrompt('Question: {{ clueing }}', { clueing: 'Who?' })  // => 'Question: Who?'
 * @example renderPrompt('Spans: {{ items }}', { items: [1, 2] })        // => 'Spans: [1,2]'
 */
export function renderPrompt(template: string, input: Readonly<Record<string, unknown>>): string {
  const { text, issue } = Renderer.render(template, Formulas.plainJson(input) ?? {})
  if (issue !== null) { throw new Error(issue) }
  return text
}

/**
 * What is wrong with `template` as a prompt template, or null when nothing is: one that does not
 * read as Liquid, names a filter there is none of, or includes another template.
 *
 * @example templateIssue('{% for item in items %}{{ item.text }}')  // => 'tag {% for item in items %} not closed, line:1, col:1'
 * @example templateIssue('Question: {{ clueing }}')                 // => null
 */
export function templateIssue(template: string): string | null {
  return Renderer.issueOf(template)
}

/**
 * The keys of the input a template reads at its top level and `input` does not hold: each fills
 * in as nothing. A name a loop or an `assign` makes is the template's own, and is left out.
 *
 * @param template - A prompt template; one that does not read reads nothing.
 * @param input - What the template is rendered over.
 * @returns The keys, in the order the template first reads them.
 *
 * @example unfilledKeys('{{ clueing }} {{ hint }}', { clueing: 'Who?' })  // => ['hint']
 * @example unfilledKeys('{{ qn.hint }}', { qn: {} })                     // => []
 */
export function unfilledKeys(template: string, input: Readonly<Record<string, unknown>>): string[] {
  return Renderer.globalsOf(template).filter((key) => ! Object.hasOwn(input, key))
}
