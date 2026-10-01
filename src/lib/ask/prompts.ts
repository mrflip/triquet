/**
 * `template` with each `{{placeholder}}` replaced by what `fills` holds for it.
 *
 * @param template - A prompt template, as an `aibot` widget's formula holds it.
 * @param fills - Placeholder name to text, without the braces.
 * @returns The prompt as it will be sent.
 *
 * @example renderPrompt('Question: {{clueing}}', { clueing: 'Who?' })  // => 'Question: Who?'
 */
export function renderPrompt(template: string, fills: Record<string, string>): string {
  let text = template
  for (const [fillname, filling] of Object.entries(fills)) {
    // A function replacement, so a `$&` in an author's own clueing stays literal.
    text = text.replaceAll(`{{${fillname}}}`, () => filling)
  }
  return text
}
