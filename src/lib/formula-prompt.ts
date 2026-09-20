import * as UU from './useful'
import { FormulaMax } from './formulas'
import { inputSchema, outputSchema } from '../models/quiz-bag'
import type { ExpressingT } from '../models/widget'
import type { ExpressionT } from '../models/expression'

/**
 * What a prompt is written about: a column and the expression behind it, either of which may be
 * partly blank or absent, and optionally one real input to show.
 */
export type PromptSubject = {
  expressing: (Pick<ExpressingT, 'label' | 'description'> & { title?: string }) | null
  expression: Pick<ExpressionT, 'label' | 'description' | 'formula'> | null
  /** One real question's `qn`, as the formula would see it, to make the schema concrete */
  sample:     Record<string, unknown> | null
}

/**
 * A prompt to give a chatbot so that it writes -- or revises -- a formula.
 *
 * Whatever is filled in is passed along and whatever is blank is left out, so the same prompt
 * serves a brand-new expression and a mature one. A formula that is present is offered neutrally,
 * as what there is now, whether it is to be built on or replaced; one that is absent is asked for.
 * The input and output schemas are always included, and the reply is asked for as the formula
 * text alone, so that it pastes straight back into the formula box.
 *
 * @param subject - The column, the expression, and optionally a sample input.
 * @returns Plain text, ready to copy.
 *
 * @example formulaPrompt({ expressing: null, expression: null, sample: null })  // asks for a formula, having been told nothing
 */
export function formulaPrompt(subject: Readonly<PromptSubject>): string {
  return [
    Preamble,
    aboutSection(subject),
    formulaSection(subject.expression?.formula ?? ''),
    inputSection(subject.sample),
    outputSection(),
    NotesSection,
    ReplySection,
  ].join('\n\n')
}

const Preamble = `I use a small quiz-editing tool. In it, a column can be computed for every question of a quiz by a formula written in JSONata (the JavaScript reference implementation, version 1.8 -- synchronous, no async). The formula is run once per question and comes to one value, which the tool shows in that column. I would like your help with the formula for one such column.`

/** The column and expression, in the author's own words, leaving out whatever is blank */
function aboutSection({ expressing, expression }: Readonly<PromptSubject>): string {
  const facts = [
    fact('The column\'s title', expressing?.title),
    fact('The widget\'s label', expressing?.label),
    fact('What the widget is for in this quiz', expressing?.description),
    fact('The expression\'s label', expression?.label),
    fact('What the expression works out', expression?.description),
  ].filter((line) => line !== '')
  return ['## What I am after', ...(facts.length === 0 ? ['I have not written anything down about it yet; I will describe it as we go.'] : facts)].join('\n')
}

/** One `- Label: text` line, or nothing when the text is blank */
function fact(title: string, text: string | undefined): string {
  const tidy = (text ?? '').trim()
  return tidy === '' ? '' : `- ${title}: ${tidy}`
}

/** The current formula, offered neutrally, or the request for one */
function formulaSection(formula: string): string {
  if (formula.trim() === '') {
    return ['## The formula', 'There is no formula yet. Please write one.'].join('\n')
  }
  return [
    '## The formula',
    'Here is what we have now. It may be a starting point, something half-done, or something to revise or replace; treat it as reference rather than as a requirement.',
    '',
    '```',
    formula,
    '```',
  ].join('\n')
}

/** The input schema, and one real input when there is one */
function inputSection(sample: PromptSubject['sample']): string {
  return [
    '## What the formula reads',
    'The formula is evaluated against one JSON document, so its top-level keys are the names it can use directly, e.g. `qn.clueing`. `qn` is the question the value is being worked out for and `qns` holds every question of the quiz, including `qn`. Nothing has an id: questions refer to each other by `label`. This is its JSON Schema:',
    '',
    '```json',
    UU.jsonify(inputSchema(), { pretty: true }),
    '```',
    ...(sample === null ? [] : [
      '',
      'For example, `qn` for one real question is:',
      '',
      '```json',
      UU.jsonify(sample, { pretty: true }),
      '```',
    ]),
  ].join('\n')
}

/** What a formula may come to */
function outputSection(): string {
  return [
    '## What the formula returns',
    'One value per question, matching this JSON Schema. Returning nothing (JSONata `undefined`), `null` or an empty string means "nothing to say here" and is shown as a muted dash; that is different from zero. To grey a value that is out of date, return `{ "value": ..., "stale": true }`.',
    '',
    '```json',
    UU.jsonify(outputSchema(), { pretty: true }),
    '```',
  ].join('\n')
}

const NotesSection = `## Constraints
- At most ${String(FormulaMax)} characters. Newlines are welcome, for laying a formula out to be read.
- Inside a predicate such as \`qns[label = ...]\` the context is each item, so reach the question being worked out with \`$$.qn\`.
- JSONata's \`$round\` rounds halves to even; use \`$floor(x + 0.5)\` if halves should go up.
- Prefer plain, readable JSONata over cleverness.`

const ReplySection = `## How to reply
Ask me anything you need to first. Once we have settled it, send the formula alone: no code fence, no explanation before or after, nothing but the text of the formula, so I can paste it straight into the formula box.`
