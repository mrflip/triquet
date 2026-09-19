import { mintId } from '../lib/ids'
import type { AnsweringRow } from '../db/schema'
import type { GuessDNA, GuessT } from './guess'
import type { IshesDNA, IshesT } from './ish'
import type { PlayerLabel } from './player'
import type { QuestionDNA, QuestionT } from './question'
import type { Textkind } from '../lib/ask/contract'

/** One time a player was put one of a question's texts, and what came back */
export type AnsweringT = AnsweringRow

/** One of a question's answered cells: which player, shown which of its texts, and the field it shows in */
export type AnswerSlot = {
  player_label: PlayerLabel
  textkind:     Textkind
  field:        'guess' | 'clueing_ishes' | 'hint_ishes'
}

/** Every answered cell a question has, in the order the grid shows them */
export const AnswerSlots = [
  { player_label: 'dumdum', textkind: 'clueing', field: 'guess' },
  { player_label: 'numnum', textkind: 'clueing', field: 'clueing_ishes' },
  { player_label: 'numnum', textkind: 'hint',    field: 'hint_ishes' },
] as const satisfies readonly AnswerSlot[]

/**
 * Which cell an answering belongs to, as one string.
 *
 * @example slotkeyOf({ question_id: 'q1', player_label: 'dumdum', textkind: 'clueing' })  // => 'q1:dumdum:clueing'
 */
export function slotkeyOf(answering: Pick<AnsweringT, 'question_id' | 'player_label' | 'textkind'>): string {
  return `${answering.question_id}:${answering.player_label}:${answering.textkind}`
}

/**
 * The newest answering for each cell, from any pile of them.
 *
 * @param answerings - Answerings for any number of questions, in any order.
 * @returns Each cell's newest answering, by `slotkeyOf`.
 */
export function latestBySlot(answerings: readonly AnsweringT[]): Map<string, AnsweringT> {
  const latest = new Map<string, AnsweringT>()
  for (const answering of answerings) {
    const slotkey = slotkeyOf(answering)
    const held = latest.get(slotkey)
    if (! held || answering.created_at > held.created_at) { latest.set(slotkey, answering) }
  }
  return latest
}

/**
 * The results a question shows in its answered cells, from the newest answering for each.
 *
 * A number-spotting result is stale when the text it was asked about is no longer the text the
 * question holds; a cell with no answering is null.
 *
 * @param question - The question's own fields, as stored.
 * @param latest - The newest answering for each cell, as `latestBySlot` gives them.
 * @returns The `guess`, `clueing_ishes` and `hint_ishes` fields for that question.
 */
export function resultsFor(
  question: Pick<QuestionT, 'id' | 'clueing' | 'hint'>,
  latest: ReadonlyMap<string, AnsweringT>,
): Pick<QuestionDNA, 'guess' | 'clueing_ishes' | 'hint_ishes'> {
  const answeringIn = (slot: AnswerSlot) => latest.get(slotkeyOf({ question_id: question.id, ...slot }))
  const guess   = answeringIn(AnswerSlots[0])
  const clueing = answeringIn(AnswerSlots[1])
  const hint    = answeringIn(AnswerSlots[2])
  return {
    guess:         guess ? guessFrom(guess) : null,
    clueing_ishes: clueing ? ishesFrom(clueing, question.clueing) : null,
    hint_ishes:    hint ? ishesFrom(hint, question.hint) : null,
  }
}

/**
 * The answerings a question is holding that are newer than anything already recorded.
 *
 * A cell whose result is no newer than what was recorded yields nothing, so offering the same
 * question twice records nothing the second time; an empty cell yields nothing either.
 *
 * @param question - The question as the author now has it.
 * @param recordedAt - When each cell's newest recorded answering was made, by `slotkeyOf`; a cell absent has none.
 * @param mint - Supplies each new answering's id.
 * @returns One answering per cell holding something new.
 */
export function unrecordedAnswerings(
  question: QuestionT,
  recordedAt: ReadonlyMap<string, number>,
  mint: () => string = mintId,
): AnsweringT[] {
  return AnswerSlots.flatMap((slot) => {
    const result = question[slot.field]
    if (result === null) { return [] }
    const recorded = recordedAt.get(slotkeyOf({ question_id: question.id, ...slot }))
    if (recorded !== undefined && result.updated_at <= recorded) { return [] }
    return [answeringFrom(question, slot, result, mint())]
  })
}

/** `result`, found in one of `question`'s cells, as an answering */
function answeringFrom(question: QuestionT, slot: AnswerSlot, result: NonNullable<GuessT | IshesT>, id: string): AnsweringT {
  const askedText = question[slot.textkind].trim()
  const answering: AnsweringT = {
    id,
    question_id:        question.id,
    player_label:       slot.player_label,
    textkind:           slot.textkind,
    asked_text:         askedText,
    status:             result.status,
    answer_text:        null,
    items:              null,
    message:            null,
    truncated:          false,
    model_tier_applied: null,
    approx_tokens:      null,
    created_at:         result.updated_at,
  }
  if (result.status === 'error') { return { ...answering, message: result.message } }
  const done = {
    ...answering,
    truncated:          result.truncated,
    model_tier_applied: result.model_tier_applied ?? null,
    approx_tokens:      result.approx_tokens ?? null,
  }
  if ('text' in result) { return { ...done, answer_text: result.text } }
  // A result already marked stale was asked about some earlier text, which is no longer known.
  return { ...done, items: result.items, asked_text: result.stale ? null : askedText }
}

/** A dumdum answering, as the guess it shows */
function guessFrom(answering: AnsweringT): GuessDNA {
  if (answering.status === 'error') { return errorFrom(answering) }
  return {
    status:             'done',
    text:               answering.answer_text ?? '',
    truncated:          answering.truncated,
    model_tier_applied: answering.model_tier_applied ?? undefined,
    approx_tokens:      answering.approx_tokens ?? undefined,
    updated_at:         answering.created_at,
  }
}

/** A numnum answering, as the extraction it shows for `currentText` */
function ishesFrom(answering: AnsweringT, currentText: string): IshesDNA {
  if (answering.status === 'error') { return errorFrom(answering) }
  return {
    status:             'done',
    items:              answering.items ?? [],
    truncated:          answering.truncated,
    stale:              answering.asked_text !== currentText.trim(),
    model_tier_applied: answering.model_tier_applied ?? undefined,
    approx_tokens:      answering.approx_tokens ?? undefined,
    updated_at:         answering.created_at,
  }
}

/** A failed answering, as the error its cell shows */
function errorFrom(answering: AnsweringT) {
  return { status: 'error' as const, message: answering.message ?? '', updated_at: answering.created_at }
}
