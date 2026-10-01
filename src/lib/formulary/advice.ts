import type { WidgetT } from '../../models/widget'
import type { AdviceSubject } from './formularies'

/**
 * What one formulary says in an advice prompt, around what every advice prompt says: the tool,
 * what the widget is for, the formula as it stands, and how to reply.
 */
export type AdviceSpec = {
  /** The opening paragraph: what the tool does with a widget of this formulary */
  preamble:    string
  /** What the widget's formula is called, in the singular: `formula`, `prompt` */
  noun:        string
  /** The section saying what the formula reads, heading and all */
  reads:       string
  /** The section saying what the formula should come to, in words, heading and all */
  comesTo:     string
  /** The rules the tool holds the formula to, one line each */
  constraints: readonly string[]
}

/**
 * A prompt to give a chatbot so that it writes -- or revises -- a widget's formula, whatever its
 * formulary.
 *
 * Whatever is filled in is passed along and whatever is blank is left out, so the same prompt
 * serves a brand-new widget and a mature one. A formula that is present is offered neutrally,
 * as what there is now, whether it is to be built on or replaced; one that is absent is asked
 * for. The reply is asked for as the formula's text alone, so it pastes straight back in.
 *
 * @param spec - What the widget's formulary says.
 * @param widget - The widget, however unfinished; null when nothing of it is written yet.
 * @param widgeting - The widgeting it is being written for, when there is one.
 * @returns Plain text, ready to copy.
 *
 * @example advicePrompt(JsonataAdvice, null, null)  // asks for a formula, having been told nothing
 */
export function advicePrompt(spec: Readonly<AdviceSpec>, widget: Pick<WidgetT, 'label' | 'description' | 'formula'> | null, widgeting: AdviceSubject | null): string {
  return [
    spec.preamble,
    aboutSection(widget, widgeting),
    currentSection(spec.noun, widget?.formula ?? ''),
    spec.reads,
    spec.comesTo,
    ['## Constraints', ...spec.constraints.map((line) => `- ${line}`)].join('\n'),
    replySection(spec.noun),
  ].join('\n\n')
}

/** The widgeting and widget, in the author's own words, leaving out whatever is blank */
function aboutSection(widget: Pick<WidgetT, 'label' | 'description'> | null, widgeting: AdviceSubject | null): string {
  const facts = [
    fact('The column\'s title', widgeting?.title),
    fact('The widgeting\'s label', widgeting?.label),
    fact('What the widgeting is for in this quiz', widgeting?.description),
    fact('The widget\'s label', widget?.label),
    fact('What the widget works out', widget?.description),
  ].filter((line) => line !== '')
  return ['## What I am after', ...(facts.length === 0 ? ['I have not written anything down about it yet; I will describe it as we go.'] : facts)].join('\n')
}

/** One `- Label: text` line, or nothing when the text is blank */
function fact(title: string, text: string | undefined): string {
  const tidy = (text ?? '').trim()
  return tidy === '' ? '' : `- ${title}: ${tidy}`
}

/** The current formula, offered neutrally, or the request for one */
function currentSection(noun: string, formula: string): string {
  const heading = `## The ${noun}`
  if (formula.trim() === '') { return [heading, `There is no ${noun} yet. Please write one.`].join('\n') }
  return [
    heading,
    'Here is what we have now. It may be a starting point, something half-done, or something to revise or replace; treat it as reference rather than as a requirement.',
    '',
    '```',
    formula,
    '```',
  ].join('\n')
}

/** How to reply, so the answer pastes straight back in */
function replySection(noun: string): string {
  return [
    '## How to reply',
    `Ask me anything you need to first. Once we have settled it, send the ${noun} alone: no code fence, no explanation before or after, nothing but the text of the ${noun}, so I can paste it straight into the ${noun} box.`,
  ].join('\n')
}
