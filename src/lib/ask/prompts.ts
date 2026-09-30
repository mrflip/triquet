/**
 * The four prompt templates, verbatim.
 *
 * These are content, not implementation. The author is spending their own model usage on these
 * asks and reading the answers as evidence about their own questions, so they are entitled to
 * see exactly what was sent -- the Prompts used panel shows these strings unchanged, with their
 * placeholders visible.
 *
 * The placeholder is `{{clueing}}`, because that is what the field is called here; the prose
 * still says "question" to the model, which is the word a player would use.
 */

export const QuickGuessPrompt = `You are answering a trivia question the way a fast, not-especially-careful player would — a literal, first-instinct read, not a careful expert analysis.

Question: {{clueing}}

Reply with only your best short answer, one line, no explanation and no hedging.`

const IshRules = `Rules:
- A span written in digits ("300", "1990") is kind "numeral".
- A span that reads as a number in words counts too: spelled-out numbers ("one", "twenty-three"), ordinals ("third"), and magnitude phrases ("300 million", "a dozen", "千", "douzaine") — kind "wordish". Give a magnitude phrase as one item with its full numeric value ("300 million" is one item worth 300000000), not split into pieces.
- Do not include the indefinite article "a"/"an" on its own, and do not include Roman numerals ("IV", "LIV").`

export const ClueingIshesPrompt = `A trivia question sometimes hides a second, numeric puzzle: adding together every number-like element in its text.

List every text span in the question below that a reasonable person might read as a number, in the order it appears.

Question: {{clueing}}

${IshRules}
- If nothing in the question reads as a number, return an empty array.

Reply with only a JSON array of objects {"text": string, "value": number, "kind": "numeral" | "wordish"}, no other text.`

export const HintIshesPrompt = `A puzzle hint can hide a numeric puzzle of its own: adding together every number-like element in its text.

List every text span in the hint below that a reasonable person might read as a number, in the order it appears.

Hint: {{hint}}

${IshRules}
- If nothing in the hint reads as a number, return an empty array.

Reply with only a JSON array of objects {"text": string, "value": number, "kind": "numeral" | "wordish"}, no other text.`

export const BulkIshesPrompt = `Below are several trivia questions and hints, each tagged with a [key]. Some hide a second, numeric puzzle: adding together every number-like element in their text.

For each one, list every text span in it that a reasonable person might read as a number, in the order it appears.

{{items}}

${IshRules}
- If nothing in an item's text reads as a number, give it an empty array.

Reply with only a JSON array with one entry per item above, in the same order, each shaped {"key": string (copied exactly from its [key] tag), "items": [{"text": string, "value": number, "kind": "numeral" | "wordish"}]}. No other text.`

/** Every template, in the order the Prompts used panel shows them, one to a tab */
export const PromptTemplates = [
  { title: 'Quick-model guess',                 body: QuickGuessPrompt },
  { title: 'Clueing ishes',                     body: ClueingIshesPrompt },
  { title: 'Hint ishes',                        body: HintIshesPrompt },
  { title: 'Batched ishes (Recalculate all)',   body: BulkIshesPrompt },
] as const

/**
 * `template` with each `{{placeholder}}` replaced by what `fills` holds for it.
 *
 * @param template - One of the templates above.
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

/**
 * The `{{items}}` block of the batched prompt: each text as `[key] text`, blank-line separated.
 *
 * @param items - The texts to extract from, each already carrying its key.
 * @returns One block ready to drop into the batched template.
 *
 * @example bulkItemsBlock([{ key: 'c:abc', text: 'Two things' }])  // => '[c:abc] Two things'
 */
export function bulkItemsBlock(items: readonly { key: string, text: string }[]): string {
  return items.map((item) => `[${item.key}] ${item.text}`).join('\n\n')
}
